import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import {
  INITIAL_ORDERS,
  INITIAL_COUPONS,
  INITIAL_SETTINGS,
  INITIAL_CUSTOMERS,
  INITIAL_SMS_LOGS,
  INITIAL_AUDIT_LOGS,
  INITIAL_FINANCIAL_RECORDS,
  INITIAL_MODERATORS,
  INITIAL_THEME,
  INITIAL_3D_BANNERS
} from './src/data/products.ts';
import type {
  Order,
  OrderStatus,
  Product,
  User,
  SmsLog,
  AuditLog,
  FinancialRecord,
  StaffModerator,
  ThemeConfig,
  Banner3DConfig,
  WhatsAppLog
} from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Enable gzip/brotli compression for all requests (reduces payload by 70%+)
app.use(compression());

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const LEGACY_PRIMARY_PRODUCT_IDS = new Set([
  'prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005',
  'prod-006', 'prod-007', 'prod-008', 'prod-009', 'prod-010',
  'prod-011', 'prod-012', 'prod-013', 'prod-014', 'prod-015',
  'prod-016', 'prod-017', 'prod-018', 'prod-019', 'prod-overcoat-005'
]);

// In-Memory Persistent Database (strictly Admin-managed / Firestore-synced; NEVER auto-seeded with primary products)
let products: Product[] = [];
let orders: Order[] = [...INITIAL_ORDERS];

const PRODUCTS_PERSIST_FILE = path.resolve(__dirname, 'data', 'products_store.json');
function saveProductsToDisk() {
  try {
    const dir = path.dirname(PRODUCTS_PERSIST_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PRODUCTS_PERSIST_FILE, JSON.stringify(products, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Products disk persistence warning:', e);
  }
}
function loadProductsFromDisk() {
  try {
    if (fs.existsSync(PRODUCTS_PERSIST_FILE)) {
      const content = fs.readFileSync(PRODUCTS_PERSIST_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        products = parsed.filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id));
        console.log(`[VANTREL ENGINE] Loaded ${products.length} persistent products from disk.`);
        return;
      }
    }
    products = [];
    saveProductsToDisk();
  } catch (e) {
    console.warn('Products disk load warning:', e);
  }
}
loadProductsFromDisk();

async function syncProductsFromFirestore() {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return;
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const firestoreDb = firebaseConfig.firestoreDatabaseId
      ? getFirestore(fbApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(fbApp);

    const snapshot = await getDocs(collection(firestoreDb, 'products'));
    const remoteProducts: Product[] = [];
    snapshot.forEach((docSnap) => {
      if (LEGACY_PRIMARY_PRODUCT_IDS.has(docSnap.id)) return;
      const data = docSnap.data() as Product;
      remoteProducts.push({
        ...data,
        id: docSnap.id,
        isArchived: Boolean(data.isArchived || data.status === 'archived')
      });
    });

    remoteProducts.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (typeof a.sortOrder === 'number' && typeof b.sortOrder === 'number') {
        return a.sortOrder - b.sortOrder;
      }
      return 0;
    });

    products = remoteProducts;
    saveProductsToDisk();
    console.log(`[VANTREL ENGINE] Synced ${products.length} admin products from Firebase Firestore.`);
  } catch (err) {
    console.warn('[VANTREL ENGINE] Firestore startup sync notice (keeping disk cache):', err);
  }
}

const ORDERS_PERSIST_FILE = path.resolve(__dirname, 'data', 'orders_store.json');
function saveOrdersToDisk() {
  try {
    const dir = path.dirname(ORDERS_PERSIST_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ORDERS_PERSIST_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Orders disk persistence warning:', e);
  }
}
function loadOrdersFromDisk() {
  try {
    if (fs.existsSync(ORDERS_PERSIST_FILE)) {
      const content = fs.readFileSync(ORDERS_PERSIST_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        orders = parsed;
        console.log(`[VANTREL ENGINE] Successfully loaded ${orders.length} persistent orders from disk.`);
      }
    }
  } catch (e) {
    console.warn('Orders disk load warning:', e);
  }
}
loadOrdersFromDisk();
let coupons = [...INITIAL_COUPONS];
let customers: User[] = [...INITIAL_CUSTOMERS];
let smsLogs: SmsLog[] = [...INITIAL_SMS_LOGS];
let auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
let settings = { ...INITIAL_SETTINGS };
let financialRecords: FinancialRecord[] = [...INITIAL_FINANCIAL_RECORDS];
let staffModerators: StaffModerator[] = [...INITIAL_MODERATORS];
let themeConfig: ThemeConfig = { ...INITIAL_THEME };
let banners3D: Banner3DConfig[] = [...INITIAL_3D_BANNERS];
let whatsappLogs: WhatsAppLog[] = [];

const MERCHANT_WHATSAPP_LINK = 'https://wa.me/message/E6PISGJZC63TA1';

// Temporary OTP memory cache (phone -> { code, expiresAt })
const otpStore = new Map<string, { code: string; expiresAt: number }>();

// Helper: Format Bangladesh mobile number for WhatsApp international standard (8801XXXXXXXXX)
function formatBdPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`;
  return digits;
}

// Helper: Format official Bengali WhatsApp Order Confirmation Message
function formatWhatsAppOrderMessage(order: any): string {
  const customerName = order.customer?.fullName || 'সম্মানিত গ্রাহক';
  const orderNum = order.orderNumber || 'N/A';
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsText = items
    .map(
      (item: any, idx: number) =>
        `${idx + 1}. *${item.name || 'পোশাক'}* - সাইজ: ${item.size || 'M'}, কালার: ${item.color || 'Standard'}, পরিমাণ: ${item.quantity || 1}টি (৳${(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()} BDT)`
    )
    .join('\n');

  const totalBill = Number(order.total || 0).toLocaleString();
  const address = `${order.customer?.streetAddress || ''}, ${order.customer?.district || ''}`;
  const paymentMethod = order.paymentMethod || 'Cash on Delivery (COD)';

  return `🎉 *VANTREL OUTFIT - অর্ডার নিশ্চিতকরণ নোটিফিকেশন*

প্রিয় *${customerName}*,
আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!

📦 *অর্ডার নম্বর:* #${orderNum}
📅 *তারিখ:* ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB')}
👕 *আপনার অর্ডারকৃত পণ্যসমূহ:*
${itemsText}

💰 *সর্বমোট বিল:* ৳${totalBill} BDT (${paymentMethod})
📍 *ডেলিভারি ঠিকানা:* ${address}

⏱️ *১৫ মিনিটের ক্যানসেল সুবিধা:*
অর্ডারে কোনো ভুল থাকলে বা বাতিল করতে চাইলে আগামী ১৫ মিনিটের মধ্যে ওয়েবসাইট থেকে বাতিল করতে পারবেন। ১৫ মিনিট পর স্বয়ংক্রিয়ভাবে পার্সেল পাঠানো হবে।

🚚 *জরুরি ডেলিভারি শর্তাবলী:*
১. ডেলিভারি ম্যান উপস্থিত থাকাকালীন পণ্য পরীক্ষা করুন।
২. ডেলিভারি ম্যান চলে যাওয়ার পর ফেরত/বিনিময়ের জন্য অতিরিক্ত ডেলিভারি চার্জ প্রযোজ্য হবে।

🔗 *লাইভ অর্ডার ট্র্যাকিং লিংক:*
https://vantrel.store/tracking?order=${orderNum}

💬 *সরাসরি সাপোর্ট ও মেসেজিং:*
${MERCHANT_WHATSAPP_LINK}

VANTREL OUTFIT বেছে নেওয়ার জন্য ধন্যবাদ!`;
}

// Helper: Dispatch / Prepare WhatsApp Confirmation
function dispatchWhatsAppConfirmation(order: any): WhatsAppLog {
  const rawPhone = order.customer?.phone || '';
  const waPhone = formatBdPhoneForWhatsApp(rawPhone);
  const message = formatWhatsAppOrderMessage(order);
  const encodedText = encodeURIComponent(message);
  const directSendUrl = waPhone
    ? `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodedText}`
    : `${MERCHANT_WHATSAPP_LINK}?text=${encodedText}`;

  const log: WhatsAppLog = {
    id: `wa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    recipientPhone: rawPhone,
    message,
    status: 'Ready',
    dispatchedAt: new Date().toISOString(),
    directSendUrl,
    merchantOrigin: MERCHANT_WHATSAPP_LINK
  };

  whatsappLogs.unshift(log);
  if (whatsappLogs.length > 200) whatsappLogs.pop();
  console.log(`[VANTREL WHATSAPP] Prepared automated WhatsApp confirmation for #${order.orderNumber} to ${rawPhone} (Target: ${waPhone})`);
  return log;
}

// Helper: Log audit trail
function recordAudit(actor: string, role: string, action: string, details: string) {
  const log: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    actor,
    role,
    action,
    details,
    timestamp: new Date().toISOString()
  };
  auditLogs.unshift(log);
  if (auditLogs.length > 200) auditLogs.pop();
  return log;
}

// Helper: Send Transactional SMS
function dispatchSms(phone: string, templateKey: string, message: string) {
  const log: SmsLog = {
    id: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    recipientPhone: phone,
    templateKey,
    message,
    status: 'Delivered',
    provider: settings.smsProvider,
    dispatchedAt: new Date().toISOString()
  };
  smsLogs.unshift(log);
  return log;
}

// Helper: Send High-Priority Order Notification to Gmail (muhammadeyamin0@gmail.com)
async function sendGmailOrderNotification(order: any) {
  const recipient = settings.orderNotificationEmail || process.env.ORDER_NOTIFICATION_EMAIL || 'muhammadeyamin0@gmail.com';
  const senderUser = settings.gmailNotificationUser || process.env.GMAIL_USER || 'muhammadeyamin0@gmail.com';
  const appPassword = settings.gmailNotificationAppPassword || process.env.GMAIL_APP_PASSWORD;

  const itemsList = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = itemsList
    .map(
      (item: any) => `
      <tr style="border-bottom: 1px solid #E5E1D5;">
        <td style="padding: 12px 8px; font-weight: bold; color: #14221C;">
          ${item.name || 'Garment Piece'}
          <div style="font-size: 11px; color: #78716c; font-weight: normal; margin-top: 2px;">
            Size: <strong>${item.size || 'N/A'}</strong> | Color: <strong>${item.color || 'Standard'}</strong>
          </div>
        </td>
        <td style="padding: 12px 8px; text-align: center; color: #14221C; font-weight: bold;">
          ${item.quantity || 1}
        </td>
        <td style="padding: 12px 8px; text-align: right; color: #14221C;">
          ৳${Number(item.price || 0).toLocaleString()}
        </td>
        <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: #14221C;">
          ৳${(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}
        </td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Order ${order.orderNumber || ''}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F5EF; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E5E1D5; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background-color: #14221C; padding: 28px 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 26px; letter-spacing: 2px; font-weight: 900; color: #FF762E;">VANTREL</h1>
          <p style="margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.8;">NEW CUSTOMER ORDER RECEIVED</p>
        </div>

        <!-- Banner Info -->
        <div style="padding: 16px 24px; background: #FFF8F3; border-bottom: 1px solid #FFE4D3;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>
                <div style="font-size: 11px; text-transform: uppercase; color: #78716c; font-weight: bold;">Order Number</div>
                <div style="font-size: 18px; font-weight: 800; color: #14221C; font-family: monospace;">${order.orderNumber}</div>
              </td>
              <td style="text-align: right;">
                <div style="font-size: 11px; text-transform: uppercase; color: #78716c; font-weight: bold;">Order Date</div>
                <div style="font-size: 13px; color: #14221C; font-weight: 600;">${new Date(order.createdAt || Date.now()).toLocaleString('en-GB')}</div>
              </td>
            </tr>
          </table>
        </div>

        <div style="padding: 24px;">
          <!-- Customer Details Card -->
          <div style="background-color: #F7F5EF; border: 1px solid #E5E1D5; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #FF762E; font-weight: bold;">
              Customer & Delivery Details
            </h3>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #78716c; width: 130px;">Customer Name:</td>
                <td style="padding: 4px 0; font-weight: bold; color: #14221C;">${order.customer?.fullName || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Mobile Phone:</td>
                <td style="padding: 4px 0; font-weight: bold; color: #0284c7;">
                  <a href="tel:${order.customer?.phone}" style="color: #0284c7; text-decoration: none;">${order.customer?.phone || 'N/A'}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c;">District:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #14221C;">${order.customer?.district || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Upazila / Thana:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #14221C;">${order.customer?.upazila || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c; vertical-align: top;">Street Address:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #14221C; line-height: 1.4;">${order.customer?.streetAddress || 'N/A'}</td>
              </tr>
              ${order.customer?.email ? `
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Customer Email:</td>
                <td style="padding: 4px 0; color: #14221C;">${order.customer.email}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Payment Method:</td>
                <td style="padding: 4px 0; font-weight: bold; color: #14221C;">${order.paymentMethod || 'Cash on Delivery'} (${order.paymentStatus || 'Pending'})</td>
              </tr>
            </table>
          </div>

          <!-- Items Table -->
          <h3 style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #14221C; font-weight: bold;">
            Ordered Products (${itemsList.length})
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
            <thead>
              <tr style="background: #F7F5EF; border-bottom: 2px solid #E5E1D5; text-align: left;">
                <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #78716c;">Product</th>
                <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #78716c; text-align: center;">Qty</th>
                <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #78716c; text-align: right;">Price</th>
                <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #78716c; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Financial Summary -->
          <div style="background: #F7F5EF; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Subtotal:</td>
                <td style="padding: 4px 0; text-align: right; color: #14221C;">৳${Number(order.subtotal || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Delivery Fee:</td>
                <td style="padding: 4px 0; text-align: right; color: #14221C;">৳${Number(order.deliveryFee || order.deliveryCharge || 0).toLocaleString()}</td>
              </tr>
              ${order.discount ? `
              <tr>
                <td style="padding: 4px 0; color: #16a34a;">Discounts:</td>
                <td style="padding: 4px 0; text-align: right; color: #16a34a;">-৳${Number(order.discount).toLocaleString()}</td>
              </tr>` : ''}
              <tr style="border-top: 1px solid #E5E1D5; font-size: 16px;">
                <td style="padding: 10px 0 0; font-weight: bold; color: #14221C;">Total Price:</td>
                <td style="padding: 10px 0 0; text-align: right; font-weight: 900; color: #FF762E;">৳${Number(order.total || 0).toLocaleString()} BDT</td>
              </tr>
            </table>
          </div>

          <!-- Footer Note -->
          <p style="font-size: 11px; color: #78716c; text-align: center; margin: 16px 0 0; line-height: 1.5;">
            This is an automated order notification from your VANTREL online store system.<br/>
            All customer order records are synchronized with your Google Cloud Firestore database.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  console.log(`\n======================================================`);
  console.log(` 📧 [GMAIL ORDER NOTIFICATION DISPATCH]`);
  console.log(` Recipient: ${recipient}`);
  console.log(` Order: #${order.orderNumber} | Customer: ${order.customer?.fullName} (${order.customer?.phone})`);
  console.log(` Total: ৳${order.total} BDT | Items: ${itemsList.length}`);
  console.log(`======================================================\n`);

  if (appPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: senderUser,
          pass: appPassword.replace(/\s+/g, '')
        }
      });

      const info = await transporter.sendMail({
        from: `"VANTREL Clothing" <${senderUser}>`,
        to: recipient,
        subject: `[VANTREL NEW ORDER] #${order.orderNumber} - ৳${Number(order.total || 0).toLocaleString()} BDT (${order.customer?.fullName})`,
        html: htmlContent
      });

      console.log(`✅ Order notification successfully sent to ${recipient}. MessageId: ${info.messageId}`);
      recordAudit('System Email Engine', 'Automated Dispatch', 'GMAIL_ORDER_SENT', `Notification for #${order.orderNumber} sent to ${recipient}`);
      return { success: true, messageId: info.messageId, delivered: true, recipient };
    } catch (err: any) {
      console.error(`⚠️ Failed to send Gmail via SMTP:`, err.message);
      recordAudit('System Email Engine', 'Automated Dispatch', 'GMAIL_ORDER_ERROR', `SMTP error: ${err.message}`);
      return { success: false, error: err.message, delivered: false, recipient };
    }
  } else {
    recordAudit('System Email Engine', 'Automated Dispatch', 'GMAIL_ORDER_PREPARED', `Order #${order.orderNumber} prepared for ${recipient} (App Password pending).`);
    return { success: true, delivered: false, note: 'Notification prepared; configure GMAIL_APP_PASSWORD for direct live delivery', recipient };
  }
}

// Helper: Send High-Priority Auto-Confirmation Notification to muhammadeyamin0@gmail.com
async function sendGmailAutoConfirmNotification(order: any) {
  const recipient = settings.orderNotificationEmail || process.env.ORDER_NOTIFICATION_EMAIL || 'muhammadeyamin0@gmail.com';
  const senderUser = settings.gmailNotificationUser || process.env.GMAIL_USER || 'muhammadeyamin0@gmail.com';
  const appPassword = settings.gmailNotificationAppPassword || process.env.GMAIL_APP_PASSWORD;

  const itemsList = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = itemsList
    .map(
      (item: any) => `
      <tr style="border-bottom: 1px solid #E5E1D5;">
        <td style="padding: 12px 8px; font-weight: bold; color: #14221C;">
          ${item.name || 'Garment Piece'}
          <div style="font-size: 11px; color: #78716c; font-weight: normal; margin-top: 2px;">
            Size: <strong>${item.size || 'N/A'}</strong> | Color: <strong>${item.color || 'Standard'}</strong>
          </div>
        </td>
        <td style="padding: 12px 8px; text-align: center; color: #14221C; font-weight: bold;">
          ${item.quantity || 1}
        </td>
        <td style="padding: 12px 8px; text-align: right; color: #14221C;">
          ৳${Number(item.price || 0).toLocaleString()}
        </td>
        <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: #14221C;">
          ৳${(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}
        </td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmed ${order.orderNumber || ''}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F5EF; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E5E1D5; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background-color: #14221C; padding: 28px 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 26px; letter-spacing: 2px; font-weight: 900; color: #FF762E;">VANTREL OUTFIT</h1>
          <p style="margin: 6px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #22c55e; font-weight: bold;">
            ✓ ORDER 100% CONFIRMED (15-MIN WINDOW ELAPSED)
          </p>
        </div>

        <!-- Banner Info -->
        <div style="padding: 16px 24px; background: #ECFDF5; border-bottom: 1px solid #A7F3D0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>
                <div style="font-size: 11px; text-transform: uppercase; color: #065f46; font-weight: bold;">Order Number</div>
                <div style="font-size: 20px; font-weight: 900; color: #065f46; font-family: monospace;">${order.orderNumber}</div>
              </td>
              <td style="text-align: right;">
                <div style="font-size: 11px; text-transform: uppercase; color: #065f46; font-weight: bold;">Status</div>
                <div style="font-size: 14px; color: #047857; font-weight: 800;">ORDER CONFIRMED</div>
              </td>
            </tr>
          </table>
          <p style="margin: 8px 0 0; font-size: 12px; color: #065f46; line-height: 1.4;">
            গ্রাহক ১৫ মিনিটের মধ্যে অর্ডার বাতিল করেননি। তাই অর্ডারটি স্বয়ংক্রিয়ভাবে কনফার্ম হয়েছে। অবিলম্বে পার্সেল প্যাকিং ও ডেলিভারি প্রস্তুত করুন।
          </p>
        </div>

        <div style="padding: 24px;">
          <!-- Customer Details Card -->
          <div style="background-color: #F7F5EF; border: 1px solid #E5E1D5; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #FF762E; font-weight: bold;">
              Customer & Delivery Details
            </h3>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #78716c; width: 130px;">Customer Name:</td>
                <td style="padding: 4px 0; font-weight: bold; color: #14221C;">${order.customer?.fullName || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Mobile Phone:</td>
                <td style="padding: 4px 0; font-weight: bold; color: #0284c7;">
                  <a href="tel:${order.customer?.phone}" style="color: #0284c7; text-decoration: none;">${order.customer?.phone || 'N/A'}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c;">District:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #14221C;">${order.customer?.district || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Upazila / Thana:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #14221C;">${order.customer?.upazila || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c; vertical-align: top;">Street Address:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #14221C; line-height: 1.4;">${order.customer?.streetAddress || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Payment Method:</td>
                <td style="padding: 4px 0; font-weight: bold; color: #14221C;">${order.paymentMethod || 'Cash on Delivery'}</td>
              </tr>
            </table>
          </div>

          <!-- Items Table -->
          <h3 style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #14221C; font-weight: bold;">
            Ordered Items (${itemsList.length})
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
            <thead>
              <tr style="background: #F7F5EF; border-bottom: 2px solid #E5E1D5; text-align: left;">
                <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #78716c;">Product</th>
                <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #78716c; text-align: center;">Qty</th>
                <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #78716c; text-align: right;">Price</th>
                <th style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #78716c; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Financial Summary -->
          <div style="background: #F7F5EF; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Subtotal:</td>
                <td style="padding: 4px 0; text-align: right; color: #14221C;">৳${Number(order.subtotal || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #78716c;">Delivery Fee:</td>
                <td style="padding: 4px 0; text-align: right; color: #14221C;">৳${Number(order.deliveryFee || order.deliveryCharge || 0).toLocaleString()}</td>
              </tr>
              <tr style="border-top: 1px solid #E5E1D5; font-size: 16px;">
                <td style="padding: 10px 0 0; font-weight: bold; color: #14221C;">Total Payable Amount:</td>
                <td style="padding: 10px 0 0; text-align: right; font-weight: 900; color: #FF762E;">৳${Number(order.total || 0).toLocaleString()} BDT</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  console.log(`\n======================================================`);
  console.log(` 📧 [GMAIL AUTO-CONFIRMATION DISPATCH]`);
  console.log(` Recipient: ${recipient}`);
  console.log(` Order #${order.orderNumber} is now officially CONFIRMED!`);
  console.log(` Total: ৳${order.total} BDT | Customer: ${order.customer?.fullName} (${order.customer?.phone})`);
  console.log(`======================================================\n`);

  if (appPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: senderUser,
          pass: appPassword.replace(/\s+/g, '')
        }
      });

      const info = await transporter.sendMail({
        from: `"VANTREL OUTFIT" <${senderUser}>`,
        to: recipient,
        subject: `[অর্ডার কনফার্মড] #${order.orderNumber} - গ্রাহক ১৫ মিনিটে বাতিল না করায় স্বয়ংক্রিয়ভাবে কনফার্ম হয়েছে (৳${Number(order.total || 0).toLocaleString()} BDT)`,
        html: htmlContent
      });

      console.log(`✅ Order auto-confirmation email successfully sent to ${recipient}. MessageId: ${info.messageId}`);
      recordAudit('System Email Engine', 'Automated Dispatch', 'GMAIL_CONFIRMATION_SENT', `Auto-confirmed order #${order.orderNumber} sent to ${recipient}`);
      return { success: true, messageId: info.messageId, delivered: true, recipient };
    } catch (err: any) {
      console.error(`⚠️ Failed to send Gmail via SMTP:`, err.message);
      recordAudit('System Email Engine', 'Automated Dispatch', 'GMAIL_CONFIRMATION_ERROR', `SMTP error: ${err.message}`);
      return { success: false, error: err.message, delivered: false, recipient };
    }
  } else {
    recordAudit('System Email Engine', 'Automated Dispatch', 'GMAIL_CONFIRMATION_PREPARED', `Auto-confirmed order #${order.orderNumber} prepared for ${recipient}`);
    return { success: true, delivered: false, note: 'Notification prepared for muhammadeyamin0@gmail.com', recipient };
  }
}

// Background automated job: Check 15-minute confirmation deadlines
// If user does not cancel within 15 minutes -> Automatically Confirm Order & Send message/email to muhammadeyamin0@gmail.com
setInterval(() => {
  const now = Date.now();
  let updatedCount = 0;

  orders = orders.map((ord) => {
    const deadline = ord.confirmationDeadline || ord.canCancelUntil || ord.customerConfirmationDeadline;
    const isPastDeadline = Boolean(deadline && !isNaN(new Date(deadline).getTime()) && new Date(deadline).getTime() <= now);
    const isPending = ord.orderStatus === 'Pending Customer Confirmation' || ord.orderStatus === 'Customer Confirmed';

    if (isPending && isPastDeadline) {
      updatedCount++;
      recordAudit(
        'Automated System',
        'Cron Processor',
        'Auto-Customer Confirmation Deadline Elapsed',
        `Order ${ord.orderNumber} reached 15-minute customer edit deadline without cancellation. Transitioned to 'Order Confirmed'.`
      );
      dispatchSms(
        ord.customer.phone,
        'ORDER_CONFIRMED',
        `VANTREL: Order ${ord.orderNumber} is now officially confirmed & forwarded to warehouse for packaging & dispatch.`
      );
      const confirmedOrder: Order = {
        ...ord,
        confirmationDeadline: deadline,
        canCancelUntil: deadline,
        customerConfirmationDeadline: deadline,
        orderStatus: 'Order Confirmed' as OrderStatus,
        statusHistory: [
          ...(ord.statusHistory || []),
          {
            status: 'Order Confirmed' as OrderStatus,
            timestamp: new Date().toISOString(),
            note: '15-minute customer cancellation window elapsed. Order automatically confirmed by system and queued for packaging.'
          }
        ]
      };

      // Dispatch auto-confirmation message to muhammadeyamin0@gmail.com
      sendGmailAutoConfirmNotification(confirmedOrder).catch((err) => {
        console.warn('Auto-confirmation email dispatch warning:', err);
      });

      return confirmedOrder;
    }
    return ord;
  });

  if (updatedCount > 0) {
    saveOrdersToDisk();
    console.log(`[VANTREL CRON] Automatically confirmed ${updatedCount} orders and dispatched email to muhammadeyamin0@gmail.com.`);
  }
}, 3000);

// ==========================================
// REST API ROUTES
// ==========================================

// 1. Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    brand: 'VANTREL',
    tagline: 'Define Your Narrative.',
    market: 'Bangladesh (BDT ৳)',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      productsCount: products.length,
      ordersCount: orders.length,
      customersCount: customers.length,
      couponsCount: coupons.length
    }
  });
});

// 2. Products Endpoints
app.get('/api/products', (req: Request, res: Response) => {
  const { category, search, sort } = req.query;
  let result = [...products];

  if (category && category !== 'All') {
    result = result.filter((p) => p.category.toLowerCase() === String(category).toLowerCase());
  }

  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }

  if (sort === 'price-low') {
    result.sort((a, b) => (a.discountPrice || a.regularPrice) - (b.discountPrice || b.regularPrice));
  } else if (sort === 'price-high') {
    result.sort((a, b) => (b.discountPrice || b.regularPrice) - (a.discountPrice || a.regularPrice));
  } else if (sort === 'rating') {
    result.sort((a, b) => b.rating - a.rating);
  }

  res.json({ success: true, count: result.length, data: result });
});

app.get('/api/products/:id', (req: Request, res: Response) => {
  const found = products.find((p) => p.id === req.params.id || p.slug === req.params.id);
  if (!found) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, data: found });
});

app.post('/api/products', (req: Request, res: Response) => {
  const body = req.body;
  if (!body.name || !body.regularPrice || !body.sku) {
    return res.status(400).json({ success: false, error: 'Name, regularPrice, and SKU are required' });
  }

  const newProd: Product = {
    id: body.id || `prod-vt-${Date.now()}`,
    slug: body.slug || (body.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: body.name,
    tagline: body.tagline || 'Modern garment engineered in Bangladesh.',
    description: body.description || '',
    category: body.category || 'Hoodies',
    subCategory: body.subCategory || 'Streetwear',
    brand: body.brand || 'VANTREL OUTFIT',
    sku: body.sku,
    regularPrice: Number(body.regularPrice),
    discountPrice: body.discountPrice ? Number(body.discountPrice) : undefined,
    discountPercent: body.discountPercent ? Number(body.discountPercent) : undefined,
    costPrice: body.costPrice !== undefined ? Number(body.costPrice) : undefined,
    images: Array.isArray(body.images) ? body.images : [],
    sizes: Array.isArray(body.sizes) && body.sizes.length > 0 ? body.sizes : ['M', 'L', 'XL', 'XXL'],
    colors: Array.isArray(body.colors) ? body.colors : [],
    variants: body.variants || [],
    fabric: body.fabric || '420 GSM 100% Cotton',
    fit: body.fit || 'Relaxed Oversized Fit',
    care: body.care || ['Machine wash cold', 'Dry flat in shade'],
    tags: body.tags || ['VANTREL', 'Streetwear'],
    isFeatured: body.isFeatured ?? true,
    isNewArrival: body.isNewArrival ?? true,
    isBestSeller: body.isBestSeller ?? false,
    rating: body.rating || 5.0,
    reviewCount: body.reviewCount || 0,
    totalStock: Number(body.totalStock || 50),
    createdDate: body.createdDate || new Date().toISOString()
  };

  const existingIdx = products.findIndex((p) => p.id === newProd.id);
  if (existingIdx >= 0) {
    products[existingIdx] = { ...products[existingIdx], ...newProd };
  } else {
    products.unshift(newProd);
  }

  saveProductsToDisk();
  recordAudit('Admin Staff', 'Product Moderator', 'Product Created/Synced', `Saved product: ${newProd.name} (${newProd.sku})`);

  res.status(201).json({ success: true, message: 'Product created and synced to server disk', data: newProd });
});

app.post('/api/products/recalculate-prices', (_req: Request, res: Response) => {
  products = products.map((p) => {
    const cleanCost =
      typeof p.costPrice === 'number' && p.costPrice > 0
        ? Math.round(p.costPrice)
        : Math.max(0, Math.round((p.discountPrice ?? p.regularPrice ?? 0) - 180));
    const sellingPrice = cleanCost + 180;
    const regularPrice = sellingPrice + 200;
    const discountPercent =
      regularPrice > 0 ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100) : 0;
    return {
      ...p,
      costPrice: cleanCost,
      discountPrice: sellingPrice,
      regularPrice,
      discountPercent
    };
  });
  saveProductsToDisk();
  recordAudit(
    'Admin Staff',
    'Pricing Engine',
    'Bulk Price Recalculation',
    `Recalculated prices (Cost + 180 selling, + 200 regular) across ${products.length} products.`
  );
  res.json({ success: true, count: products.length, data: products });
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  const idx = products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    // If not found, create or upsert
    const created: Product = {
      id: req.params.id,
      name: req.body.name || 'Unnamed Product',
      sku: req.body.sku || `VT-${Date.now().toString().slice(-4)}`,
      regularPrice: req.body.regularPrice || 1000,
      totalStock: req.body.totalStock || 20,
      ...req.body
    };
    products.unshift(created);
    saveProductsToDisk();
    recordAudit('Admin Staff', 'Product Moderator', 'Product Upserted', `Upserted product: ${created.name}`);
    return res.json({ success: true, data: created });
  }

  products[idx] = { ...products[idx], ...req.body };
  saveProductsToDisk();
  recordAudit('Admin Staff', 'Product Moderator', 'Product Updated', `Updated product: ${products[idx].name}`);
  res.json({ success: true, data: products[idx] });
});

app.delete('/api/products', (_req: Request, res: Response) => {
  const previousCount = products.length;
  products = [];
  saveProductsToDisk();
  recordAudit('Super Admin', 'Super Admin', 'All Products Deleted', `Cleared ${previousCount} products from server memory and disk`);
  res.json({ success: true, message: 'All products deleted from server memory and disk', deletedCount: previousCount });
});

app.delete('/api/products/:id', (req: Request, res: Response) => {
  const idx = products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const deleted = products.splice(idx, 1)[0];
  saveProductsToDisk();
  recordAudit('Super Admin', 'Super Admin', 'Product Deleted', `Removed product: ${deleted.name} (${deleted.sku})`);
  res.json({ success: true, message: 'Product deleted from server memory and disk', data: deleted });
});

// 3. Orders Endpoints
app.get('/api/orders', (req: Request, res: Response) => {
  const { status, phone, search } = req.query;
  let result = [...orders];

  if (status && status !== 'All') {
    result = result.filter((o) => o.orderStatus === status);
  }

  if (phone) {
    result = result.filter((o) => o.customer.phone.includes(String(phone)));
  }

  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.fullName.toLowerCase().includes(q) ||
        o.customer.phone.includes(q)
    );
  }

  res.json({ success: true, count: result.length, data: result });
});

app.get('/api/orders/:id', (req: Request, res: Response) => {
  const found = orders.find((o) => o.id === req.params.id || o.orderNumber === req.params.id);
  if (!found) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  res.json({ success: true, data: found });
});

app.post('/api/orders', (req: Request, res: Response) => {
  // If an entire pre-constructed order object is received from frontend client
  if (req.body.id && req.body.orderNumber && req.body.customer && req.body.items) {
    const incomingOrder: Order = req.body;
    const deadlineVal =
      incomingOrder.confirmationDeadline ||
      incomingOrder.canCancelUntil ||
      incomingOrder.customerConfirmationDeadline ||
      new Date(Date.now() + 15 * 60 * 1000).toISOString();
    incomingOrder.confirmationDeadline = deadlineVal;
    incomingOrder.canCancelUntil = deadlineVal;
    incomingOrder.customerConfirmationDeadline = deadlineVal;

    const existingIndex = orders.findIndex(
      (o) => o.id === incomingOrder.id || o.orderNumber === incomingOrder.orderNumber
    );

    if (existingIndex >= 0) {
      orders[existingIndex] = { ...orders[existingIndex], ...incomingOrder };
    } else {
      orders.unshift(incomingOrder);
      // Deduct variant and total stocks if new
      incomingOrder.items.forEach((ordItem: any) => {
        const prod = products.find((p) => p.id === ordItem.productId);
        if (prod) {
          prod.totalStock = Math.max(0, prod.totalStock - ordItem.quantity);
          const variant = prod.variants?.find((v) => v.size === ordItem.size && v.color === ordItem.color);
          if (variant) {
            variant.stock = Math.max(0, variant.stock - ordItem.quantity);
          }
        }
      });
    }

    saveOrdersToDisk();

    recordAudit(
      incomingOrder.customer.fullName || 'Customer',
      'Customer / Store Engine',
      'Order Synced to Server',
      `Synchronized order #${incomingOrder.orderNumber} (৳${incomingOrder.total}) to central store database`
    );

    // Prepare & dispatch automated WhatsApp confirmation
    const waLog = dispatchWhatsAppConfirmation(incomingOrder);

    // Send Gmail notification asynchronously
    sendGmailOrderNotification(incomingOrder).catch((err) => {
      console.warn('Gmail order notification dispatch error:', err);
    });

    return res.status(201).json({
      success: true,
      message: 'Order synchronized successfully to store engine',
      data: incomingOrder,
      whatsapp: waLog
    });
  }

  const { customer, items, paymentMethod, discountAmount = 0, loyaltyPointsRedeemed = 0, referralDiscount = 0 } = req.body;

  if (!customer?.fullName || !customer?.phone || !items?.length) {
    return res.status(400).json({ success: false, error: 'Customer details and items are required' });
  }

  const subtotal = items.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);
  const deliveryCharge = customer.deliveryCharge || (customer.district === 'Dhaka' ? 70 : 130);
  const total = Math.max(0, subtotal + deliveryCharge - discountAmount - loyaltyPointsRedeemed - referralDiscount);

  const windowMinutes = settings.confirmationWindowMinutes || 15;
  const deadline = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();
  const orderNum = `VT-${Math.floor(100000 + Math.random() * 900000)}`;

  // Deduct variant and total stocks
  items.forEach((ordItem: any) => {
    const prod = products.find((p) => p.id === ordItem.productId);
    if (prod) {
      prod.totalStock = Math.max(0, prod.totalStock - ordItem.quantity);
      const variant = prod.variants?.find((v) => v.size === ordItem.size && v.color === ordItem.color);
      if (variant) {
        variant.stock = Math.max(0, variant.stock - ordItem.quantity);
      }
    }
  });

  const newOrder: Order = {
    id: `ord-${Date.now()}`,
    orderNumber: orderNum,
    createdAt: new Date().toISOString(),
    customer,
    items,
    subtotal,
    deliveryCharge,
    discountAmount,
    loyaltyPointsRedeemed,
    referralDiscount,
    total,
    paymentMethod: paymentMethod || 'Cash on Delivery',
    paymentStatus: paymentMethod === 'Cash on Delivery' ? 'Pending' : 'Paid',
    orderStatus: 'Pending Customer Confirmation',
    confirmationDeadline: deadline,
    canCancelUntil: deadline,
    statusHistory: [
      {
        status: 'Pending Customer Confirmation',
        timestamp: new Date().toISOString(),
        note: `Order placed. 15-min edit/confirmation window expires at ${new Date(deadline).toLocaleTimeString()}`
      }
    ]
  };

  orders.unshift(newOrder);
  saveOrdersToDisk();

  // Send Transactional SMS
  dispatchSms(
    customer.phone,
    'ORDER_PLACED',
    `VANTREL: Order ${orderNum} received! Total: BDT ${total.toLocaleString()}. You have ${windowMinutes}m to review or edit your order: https://vantrel.store/track/${orderNum}`
  );

  recordAudit(
    customer.fullName,
    'Customer',
    'Order Placed',
    `Placed order ${orderNum} for BDT ${total.toLocaleString()} via ${paymentMethod}`
  );

  // Send automatic Gmail order notification to muhammadeyamin0@gmail.com
  sendGmailOrderNotification(newOrder).catch((err) => {
    console.warn('Gmail order notification dispatch error:', err);
  });

  // Prepare & dispatch automated WhatsApp confirmation
  const waLog = dispatchWhatsAppConfirmation(newOrder);

  res.status(201).json({
    success: true,
    message: 'Order created with 15-minute confirmation window and automated WhatsApp notification',
    data: newOrder,
    whatsapp: waLog
  });
});

// GET: WhatsApp Confirmation Logs
app.get('/api/whatsapp-logs', (_req: Request, res: Response) => {
  res.json({
    success: true,
    total: whatsappLogs.length,
    merchantOrigin: MERCHANT_WHATSAPP_LINK,
    data: whatsappLogs
  });
});

// POST: Trigger WhatsApp Confirmation for a specific order
app.post('/api/send-whatsapp-confirmation', (req: Request, res: Response) => {
  const { orderId, orderNumber, phone } = req.body;
  const target = orders.find((o) => o.id === orderId || o.orderNumber === orderNumber || (phone && o.customer?.phone === phone));

  if (!target) {
    return res.status(404).json({ success: false, error: 'Order not found for WhatsApp confirmation' });
  }

  const log = dispatchWhatsAppConfirmation(target);
  recordAudit(
    target.customer?.fullName || 'System',
    'Store Engine',
    'WhatsApp Confirmation Sent',
    `Generated WhatsApp notification for order #${target.orderNumber} to ${target.customer?.phone}`
  );

  res.json({
    success: true,
    message: 'WhatsApp confirmation generated successfully',
    data: log
  });
});

app.patch('/api/orders/:id/status', (req: Request, res: Response) => {
  const { status, note } = req.body;
  const idx = orders.findIndex((o) => o.id === req.params.id || o.orderNumber === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const prevStatus = orders[idx].orderStatus;
  orders[idx].orderStatus = status as OrderStatus;
  orders[idx].statusHistory = [
    ...(orders[idx].statusHistory || []),
    {
      status: status as OrderStatus,
      timestamp: new Date().toISOString(),
      note: note || `Status transitioned from ${prevStatus} to ${status}`
    }
  ];

  recordAudit(
    'Staff Operator',
    'Order Moderator',
    'Order Status Changed',
    `Order ${orders[idx].orderNumber} changed from ${prevStatus} -> ${status}`
  );

  // Send contextual SMS
  if (status === 'Shipped') {
    dispatchSms(
      orders[idx].customer.phone,
      'ORDER_SHIPPED',
      `VANTREL: Order ${orders[idx].orderNumber} has been dispatched with ${orders[idx].courierName || 'Steadfast'}. Tracking: ${orders[idx].courierTrackingCode || 'N/A'}`
    );
  } else if (status === 'Delivered') {
    dispatchSms(
      orders[idx].customer.phone,
      'ORDER_DELIVERED',
      `VANTREL: Order ${orders[idx].orderNumber} delivered! Thank you for defining your narrative with us.`
    );
  }

  res.json({ success: true, data: orders[idx] });
});

// 15-Minute Auto-Confirmation Endpoint (called when 15-min countdown completes)
app.post('/api/orders/:id/auto-confirm', (req: Request, res: Response) => {
  const idx = orders.findIndex((o) => o.id === req.params.id || o.orderNumber === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const order = orders[idx];
  const isPending =
    order.orderStatus === 'Pending Customer Confirmation' ||
    order.orderStatus === 'Customer Confirmed' ||
    order.orderStatus === 'Awaiting Staff Approval';

  if (isPending) {
    order.orderStatus = 'Order Confirmed';
    order.statusHistory = [
      ...(order.statusHistory || []),
      {
        status: 'Order Confirmed',
        timestamp: new Date().toISOString(),
        note: '15-minute customer window elapsed without cancellation. Order confirmed automatically.'
      }
    ];

    saveOrdersToDisk();

    recordAudit(
      'Automated System',
      'Order Processor',
      'Auto-Confirmed Order',
      `Order ${order.orderNumber} auto-confirmed after 15-min window without cancellation.`
    );

    // Send high-priority email notification to muhammadeyamin0@gmail.com
    sendGmailAutoConfirmNotification(order).catch((err) => {
      console.warn('Auto-confirmation email dispatch warning:', err);
    });

    dispatchSms(
      order.customer.phone,
      'ORDER_CONFIRMED',
      `VANTREL: Order ${order.orderNumber} is now officially confirmed & forwarded to warehouse for packaging & dispatch.`
    );
  }

  res.json({ success: true, message: 'Order auto-confirmed successfully', data: order });
});

// Staff Approval endpoint
app.post('/api/orders/:id/approve', (req: Request, res: Response) => {
  const idx = orders.findIndex((o) => o.id === req.params.id || o.orderNumber === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  orders[idx].orderStatus = 'Order Confirmed';
  orders[idx].statusHistory = [
    ...(orders[idx].statusHistory || []),
    {
      status: 'Order Confirmed',
      timestamp: new Date().toISOString(),
      note: 'Order approved by authorized store staff and pushed to warehouse packing queue.'
    }
  ];

  recordAudit(
    'Staff Operator',
    'Order Moderator',
    'Staff Order Approval',
    `Approved order ${orders[idx].orderNumber}. Moved to warehouse processing queue.`
  );

  res.json({ success: true, message: 'Order approved by staff', data: orders[idx] });
});

// Customer / Staff Cancellation with stock restoration
app.post('/api/orders/:id/cancel', (req: Request, res: Response) => {
  const { reason = 'Cancelled by customer' } = req.body;
  const idx = orders.findIndex((o) => o.id === req.params.id || o.orderNumber === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const order = orders[idx];
  // Restore variant and total stock
  order.items.forEach((item) => {
    const prod = products.find((p) => p.id === item.productId);
    if (prod) {
      prod.totalStock += item.quantity;
      const variant = prod.variants?.find((v) => v.size === item.size && v.color === item.color);
      if (variant) {
        variant.stock += item.quantity;
      }
    }
  });

  order.orderStatus = 'Cancelled';
  order.cancellationReason = reason;
  order.statusHistory = [
    ...(order.statusHistory || []),
    {
      status: 'Cancelled',
      timestamp: new Date().toISOString(),
      note: `Cancelled: ${reason}. Product stock restored to inventory.`
    }
  ];

  saveOrdersToDisk();

  recordAudit(
    'System',
    'Inventory & Order',
    'Order Cancelled',
    `Order ${order.orderNumber} cancelled. Stock restored. Reason: ${reason}`
  );

  dispatchSms(
    order.customer.phone,
    'ORDER_CANCELLED',
    `VANTREL: Order ${order.orderNumber} has been cancelled. Any pre-payment will be refunded in 24h. Reason: ${reason}`
  );

  res.json({ success: true, message: 'Order cancelled and stock restored', data: order });
});

// Delete a single order by ID
app.delete('/api/orders/:id', (req: Request, res: Response) => {
  const targetId = req.params.id;
  const initialLen = orders.length;
  orders = orders.filter((o) => o.id !== targetId && o.orderNumber !== targetId);
  saveOrdersToDisk();

  recordAudit(
    'Admin',
    'Super Admin',
    'Order Deleted',
    `Permanently deleted order ID/Number ${targetId}`
  );

  res.json({
    success: true,
    message: 'Order deleted successfully from server storage',
    deletedCount: initialLen - orders.length
  });
});

// Clear ALL Orders from server memory and disk
app.delete('/api/orders', (_req: Request, res: Response) => {
  const count = orders.length;
  orders = [];
  saveOrdersToDisk();

  recordAudit(
    'Admin',
    'Super Admin',
    'All Orders Cleared',
    `Permanently purged all ${count} orders from system`
  );

  res.json({
    success: true,
    message: `All ${count} orders cleared successfully from server`,
    count
  });
});

// Assign Courier
app.post('/api/orders/:id/courier', (req: Request, res: Response) => {
  const { courierName, trackingCode } = req.body;
  const idx = orders.findIndex((o) => o.id === req.params.id || o.orderNumber === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  orders[idx].courierName = courierName || 'Steadfast';
  orders[idx].courierTrackingCode = trackingCode;
  orders[idx].trackingNumber = trackingCode;
  orders[idx].orderStatus = 'Shipped';
  orders[idx].statusHistory = [
    ...(orders[idx].statusHistory || []),
    {
      status: 'Shipped',
      timestamp: new Date().toISOString(),
      note: `Assigned ${courierName} consignment tracking: ${trackingCode}`
    }
  ];

  recordAudit(
    'Staff Operator',
    'Order Moderator',
    'Courier Consignment Assigned',
    `Order ${orders[idx].orderNumber} dispatched via ${courierName} with tracking code ${trackingCode}`
  );

  dispatchSms(
    orders[idx].customer.phone,
    'ORDER_SHIPPED',
    `VANTREL: Order ${orders[idx].orderNumber} dispatched via ${courierName}! Consignment Tracking ID: ${trackingCode}. Track: https://steadfast.com.bd/t/${trackingCode}`
  );

  res.json({ success: true, data: orders[idx] });
});

// Automatic Gmail Notification Endpoints for Orders
app.post('/api/send-order-notification', async (req: Request, res: Response) => {
  const { order } = req.body;
  if (!order || !order.customer) {
    return res.status(400).json({ success: false, error: 'Order details with customer info required' });
  }

  try {
    const result = await sendGmailOrderNotification(order);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/test-email-notification', async (_req: Request, res: Response) => {
  const dummyOrder: any = {
    orderNumber: `VT-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
    createdAt: new Date().toISOString(),
    customer: {
      fullName: 'Muhammad Yeamin (Store Owner)',
      phone: '01711234567',
      district: 'Dhaka',
      upazila: 'Banani',
      streetAddress: 'House 14, Road 11, Block D',
      email: 'muhammadeyamin0@gmail.com'
    },
    items: [
      {
        name: 'VANTREL Essential Oversized Tee (Heavyweight 260 GSM)',
        size: 'L',
        color: 'Pitch Black',
        quantity: 1,
        price: 1850
      }
    ],
    subtotal: 1850,
    deliveryFee: 0,
    total: 1850,
    paymentMethod: 'Cash on Delivery (COD)',
    paymentStatus: 'Pending'
  };

  try {
    const result = await sendGmailOrderNotification(dummyOrder);
    res.json({
      success: true,
      message: `Test email notification dispatched for ${result.recipient}`,
      details: result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Coupons Endpoints
app.get('/api/coupons', (_req: Request, res: Response) => {
  res.json({ success: true, data: coupons });
});

app.post('/api/coupons/validate', (req: Request, res: Response) => {
  const { code, cartSubtotal = 0 } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: 'Coupon code is required' });
  }

  const found = coupons.find((c) => c.code.toUpperCase() === String(code).trim().toUpperCase());
  if (!found || !found.isActive) {
    return res.status(400).json({ success: false, error: 'Invalid or inactive promotional voucher' });
  }

  if (cartSubtotal < found.minOrder) {
    return res.status(400).json({
      success: false,
      error: `Minimum order amount of ৳${found.minOrder.toLocaleString()} required for this coupon`
    });
  }

  const discount =
    found.type === 'percent'
      ? Math.round((cartSubtotal * found.value) / 100)
      : Math.min(found.value, cartSubtotal);

  res.json({
    success: true,
    data: {
      code: found.code,
      discountType: found.type,
      discountValue: found.value,
      calculatedDiscountBDT: discount,
      payableSubtotal: Math.max(0, cartSubtotal - discount)
    }
  });
});

// 5. Auth & OTP Endpoints (+880 validation)
app.post('/api/auth/send-otp', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Phone number is required' });
  }

  const cleanPhone = String(phone).replace(/\s+/g, '');
  const isValidBd = /^(?:\+8801|8801|01)[3-9]\d{8}$/.test(cleanPhone);
  if (!isValidBd) {
    return res.status(400).json({ success: false, error: 'Invalid Bangladesh mobile number (+8801XXXXXXXXX)' });
  }

  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(cleanPhone, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes validity
  });

  dispatchSms(
    cleanPhone,
    'OTP_VERIFICATION',
    `VANTREL Security Code: ${code}. Valid for 5 minutes. Never disclose this OTP to anyone.`
  );

  res.json({
    success: true,
    message: `OTP sent successfully to ${cleanPhone}`,
    // Return OTP in development response for easy testing
    otpCode: code,
    expiresInSeconds: 300
  });
});

app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
  const { phone, code } = req.body;
  const cleanPhone = String(phone).replace(/\s+/g, '');
  const record = otpStore.get(cleanPhone);

  if (!record || record.expiresAt < Date.now()) {
    return res.status(400).json({ success: false, error: 'OTP has expired or was not requested' });
  }

  if (record.code !== String(code).trim()) {
    return res.status(400).json({ success: false, error: 'Incorrect OTP code entered' });
  }

  otpStore.delete(cleanPhone);

  let user = customers.find((c) => c.phone === cleanPhone);
  if (!user) {
    user = {
      id: `usr-ph-${Date.now()}`,
      name: `VANTREL Client (${cleanPhone.slice(-4)})`,
      email: `${cleanPhone}@customer.vantrel.store`,
      phone: cleanPhone,
      role: 'customer',
      loyaltyPoints: 100, // 100 welcome points
      referralCode: `VT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      joinedDate: new Date().toISOString().split('T')[0],
      savedAddresses: [],
      pointsHistory: []
    };
    customers.push(user);
    recordAudit(user.name, 'Customer', 'Customer Registration', `Registered via Phone OTP verification`);
  }

  res.json({
    success: true,
    message: 'OTP verified successfully',
    token: `jwt-vt-${Buffer.from(user.id).toString('base64')}-${Date.now()}`,
    user
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = customers.find((c) => c.email.toLowerCase() === String(email).toLowerCase());

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid email credentials' });
  }

  res.json({
    success: true,
    token: `jwt-vt-${Buffer.from(user.id).toString('base64')}-${Date.now()}`,
    user
  });
});

// 6. SMS Logs & Audit Trail
app.get('/api/sms/logs', (_req: Request, res: Response) => {
  res.json({ success: true, count: smsLogs.length, data: smsLogs });
});

app.get('/api/audit-logs', (_req: Request, res: Response) => {
  res.json({ success: true, count: auditLogs.length, data: auditLogs });
});

app.get('/api/customers', (_req: Request, res: Response) => {
  res.json({ success: true, count: customers.length, data: customers });
});

// 7. Business Finance & Profit Management Endpoints
app.get('/api/finances', (_req: Request, res: Response) => {
  const recordedSalesRevenue = orders
    .filter((o) => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Refunded')
    .reduce((sum, o) => sum + o.total, 0);

  const manualExpenses = financialRecords
    .filter((r) => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const manualIncome = financialRecords
    .filter((r) => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const cogs = financialRecords
    .filter((r) => r.type === 'expense' && r.category === 'Product purchase or manufacturing costs')
    .reduce((sum, r) => sum + r.amount, 0);

  const operatingExpenses = manualExpenses - cogs;
  const grossProfit = recordedSalesRevenue - cogs;
  const netProfit = grossProfit - operatingExpenses + manualIncome;

  res.json({
    success: true,
    data: financialRecords,
    summary: {
      recordedSalesRevenue,
      manualIncome,
      manualExpenses,
      cogs,
      operatingExpenses,
      grossProfit,
      netProfit,
      totalOrdersCount: orders.length
    }
  });
});

app.post('/api/finances', (req: Request, res: Response) => {
  const { title, amount, type, date, category, description } = req.body;
  if (!title || !amount || !type || !category) {
    return res.status(400).json({ success: false, error: 'Title, amount, type, and category are required.' });
  }

  const record: FinancialRecord = {
    id: `fin-${Date.now()}`,
    title: String(title).trim(),
    amount: Math.abs(Number(amount)),
    type: type === 'income' ? 'income' : 'expense',
    date: date || new Date().toISOString().split('T')[0],
    category: String(category).trim(),
    description: description ? String(description).trim() : undefined,
    createdAt: new Date().toISOString()
  };

  financialRecords.unshift(record);
  recordAudit('Administrator', 'Finance Manager', 'FINANCE_ENTRY_ADD', `Added ${record.type} "${record.title}" (৳${record.amount})`);
  res.status(201).json({ success: true, record });
});

app.put('/api/finances/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = financialRecords.findIndex((r) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Financial record not found' });
  }

  financialRecords[index] = {
    ...financialRecords[index],
    ...req.body,
    id
  };
  res.json({ success: true, record: financialRecords[index] });
});

app.delete('/api/finances/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  financialRecords = financialRecords.filter((r) => r.id !== id);
  recordAudit('Administrator', 'Finance Manager', 'FINANCE_ENTRY_DELETE', `Deleted financial entry ${id}`);
  res.json({ success: true, message: 'Record deleted successfully' });
});

// 8. Staff & Moderator Management Endpoints
app.get('/api/moderators', (_req: Request, res: Response) => {
  res.json({ success: true, count: staffModerators.length, data: staffModerators });
});

app.post('/api/moderators', (req: Request, res: Response) => {
  const { name, email, phone, role, canManageFinances } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ success: false, error: 'Name, email, and role are required' });
  }

  const newMod: StaffModerator = {
    id: `mod-${Date.now()}`,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    phone: phone ? String(phone).trim() : '01700000000',
    role,
    status: 'Active',
    assignedDate: new Date().toISOString().split('T')[0],
    lastActive: 'Never',
    canManageFinances: role === 'Super Admin' || role === 'Finance Moderator' || !!canManageFinances
  };

  staffModerators.push(newMod);
  recordAudit('Owner / Super Admin', 'Super Admin', 'MODERATOR_CREATE', `Created staff account for ${newMod.name} as ${newMod.role}`);
  res.status(201).json({ success: true, moderator: newMod });
});

app.put('/api/moderators/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = staffModerators.findIndex((m) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Moderator not found' });
  }

  staffModerators[index] = {
    ...staffModerators[index],
    ...req.body,
    id
  };
  recordAudit('Owner / Super Admin', 'Super Admin', 'MODERATOR_UPDATE', `Updated permissions/status for ${staffModerators[index].name}`);
  res.json({ success: true, moderator: staffModerators[index] });
});

app.delete('/api/moderators/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const target = staffModerators.find((m) => m.id === id);
  if (target?.role === 'Super Admin') {
    return res.status(403).json({ success: false, error: 'Primary Super Admin account cannot be revoked.' });
  }

  staffModerators = staffModerators.filter((m) => m.id !== id);
  recordAudit('Owner / Super Admin', 'Super Admin', 'MODERATOR_REVOKE', `Revoked moderator account for ${target?.name || id}`);
  res.json({ success: true, message: 'Moderator access revoked.' });
});

// 9. Visual Themes & 3D Banners Endpoints
app.get('/api/theme', (_req: Request, res: Response) => {
  res.json({ success: true, theme: themeConfig });
});

app.post('/api/theme', (req: Request, res: Response) => {
  themeConfig = { ...themeConfig, ...req.body };
  recordAudit('Owner / Super Admin', 'Super Admin', 'THEME_UPDATE', `Updated visual theme to preset ${themeConfig.preset}`);
  res.json({ success: true, theme: themeConfig });
});

app.get('/api/banners-3d', (_req: Request, res: Response) => {
  res.json({ success: true, data: banners3D });
});

app.post('/api/banners-3d', (req: Request, res: Response) => {
  const banner: Banner3DConfig = {
    ...req.body,
    id: req.body.id || `b3d-${Date.now()}`
  };
  const index = banners3D.findIndex((b) => b.id === banner.id);
  if (index >= 0) {
    banners3D[index] = banner;
  } else {
    banners3D.push(banner);
  }
  recordAudit('Staff', 'Content Moderator', 'BANNER_3D_SAVE', `Saved 3D fashion banner: ${banner.title}`);
  res.json({ success: true, banner });
});


// ==========================================
// STATIC ASSETS & IMAGE ROUTING (PRODUCTION & DEV)
// ==========================================
const publicAssetsImages = path.resolve(__dirname, 'public', 'assets', 'images');
const publicAistudioImages = path.resolve(__dirname, 'public', 'assets', 'aistudio');
const srcAssetsImages = path.resolve(__dirname, 'src', 'assets', 'images');

// Support /assets/images & /assets/aistudio statically with aggressive caching
app.use('/assets/images', express.static(publicAssetsImages, { maxAge: '30d', etag: true }));
app.use('/assets/aistudio', express.static(publicAistudioImages, { maxAge: '30d', etag: true }));
app.use(express.static(path.resolve(__dirname, 'public'), { maxAge: '30d', etag: true }));

app.get('/src/assets/images/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const p1 = path.join(publicAssetsImages, filename);
  const p2 = path.join(srcAssetsImages, filename);
  if (fs.existsSync(p1)) return res.sendFile(p1);
  if (fs.existsSync(p2)) return res.sendFile(p2);
  const fallback = path.join(publicAssetsImages, 'vantrel-logo.png');
  if (fs.existsSync(fallback)) return res.sendFile(fallback);
  res.status(404).type('text/plain').send('Image Not Found');
});

// ==========================================
// SEARCH ENGINE & AI ENGINE CRAWLER ROUTES (GOOGLE, META, GEMINI, AI)
// ==========================================
app.get('/robots.txt', (req: Request, res: Response) => {
  const host = req.get('host') || 'www.vantreloutfit.shop';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const robots = `# VANTREL OUTFIT Web Crawling & AI Engine Directive
# Allow Google, Meta, Gemini, and AI scrapers to access all product details, images, and prices.
# Disallow admin panel and private administrative endpoints.

User-agent: *
Allow: /
Allow: /products
Allow: /products/*
Allow: /product/*
Allow: /track
Allow: /track/*
Allow: /assets/
Allow: /src/assets/
Disallow: /admin
Disallow: /admin/*
Disallow: /api/admin
Disallow: /api/admin/*
Disallow: /api/moderators
Disallow: /api/finances
Disallow: /api/audit-logs
Disallow: /api/sms/logs

# Google Search & Image Crawlers
User-agent: Googlebot
Allow: /
Disallow: /admin
Disallow: /admin/*

User-agent: Googlebot-Image
Allow: /
Allow: /assets/
Allow: /src/assets/

# Google Gemini & Extended AI Models
User-agent: Google-Extended
Allow: /
Disallow: /admin
Disallow: /admin/*

# Meta (Facebook & Instagram) Crawlers & Catalog Scrapers
User-agent: facebookexternalhit
Allow: /
Disallow: /admin
Disallow: /admin/*

User-agent: Facebot
Allow: /
Disallow: /admin
Disallow: /admin/*

User-agent: meta-externalagent
Allow: /
Disallow: /admin
Disallow: /admin/*

# OpenAI & ChatGPT
User-agent: GPTBot
Allow: /
Disallow: /admin
Disallow: /admin/*

User-agent: ChatGPT-User
Allow: /
Disallow: /admin
Disallow: /admin/*

# Anthropic / Claude
User-agent: ClaudeBot
User-agent: anthropic-ai
Allow: /
Disallow: /admin
Disallow: /admin/*

# Perplexity AI
User-agent: PerplexityBot
Allow: /
Disallow: /admin
Disallow: /admin/*

# Apple, Bing, DuckDuckGo
User-agent: Applebot
User-agent: Bingbot
User-agent: DuckDuckBot
Allow: /
Disallow: /admin
Disallow: /admin/*

Sitemap: ${protocol}://${host}/sitemap.xml
`;
  res.type('text/plain').send(robots);
});

app.get('/sitemap.xml', (req: Request, res: Response) => {
  const host = req.get('host') || 'www.vantreloutfit.shop';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const baseUrl = `${protocol}://${host}`;
  const now = new Date().toISOString();

  const staticUrls = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${baseUrl}/products`, priority: '0.9', changefreq: 'daily' },
    { loc: `${baseUrl}/track`, priority: '0.7', changefreq: 'monthly' }
  ];

  const productUrls = products
    .filter((prod) => !prod.isArchived && prod.status !== 'archived')
    .map((prod) => {
      const rawImg = prod.images && prod.images[0] ? prod.images[0] : '';
      const imgUrl = rawImg ? (rawImg.startsWith('http') ? rawImg : `${baseUrl}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`) : '';
      const price = prod.discountPrice || prod.regularPrice;
      const cleanName = (prod.name || 'Product').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const cleanDesc = (prod.tagline || prod.description || prod.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      return `  <url>
    <loc>${baseUrl}/product/${prod.slug || prod.id}</loc>
    <lastmod>${prod.createdDate ? new Date(prod.createdDate).toISOString() : now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
    ${imgUrl ? `<image:image>
      <image:loc>${imgUrl}</image:loc>
      <image:title>${cleanName}</image:title>
      <image:caption>${cleanDesc} - Price: ৳${price} BDT</image:caption>
    </image:image>` : ''}
  </url>`;
    }).join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticUrls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
${productUrls}
</urlset>`;

  res.type('application/xml').send(sitemapXml);
});

app.get('/api/public/products-feed.json', (req: Request, res: Response) => {
  const host = req.get('host') || 'www.vantreloutfit.shop';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const baseUrl = `${protocol}://${host}`;

  const feed = products
    .filter((p) => !p.isArchived && p.status !== 'archived')
    .map((p) => {
      const rawImg = p.images && p.images[0] ? p.images[0] : '';
      const imgUrl = rawImg ? (rawImg.startsWith('http') ? rawImg : `${baseUrl}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`) : '';
      return {
        id: p.id,
        title: p.name,
        description: p.description || p.tagline,
        availability: (p.totalStock > 0) ? 'in stock' : 'out of stock',
        price: `${p.discountPrice || p.regularPrice} BDT`,
        regular_price: `${p.regularPrice} BDT`,
        sale_price: p.discountPrice ? `${p.discountPrice} BDT` : undefined,
        link: `${baseUrl}/product/${p.slug || p.id}`,
        image_link: imgUrl,
        additional_image_links: p.images?.slice(1).map((img) => img.startsWith('http') ? img : `${baseUrl}${img.startsWith('/') ? '' : '/'}${img}`),
        brand: 'VANTREL OUTFIT',
        category: p.category,
        sizes: p.sizes,
        colors: p.colors?.map((c) => c.name),
        condition: 'new'
      };
    });

  res.json({
    store: 'VANTREL OUTFIT',
    currency: 'BDT',
    item_count: feed.length,
    updated_at: new Date().toISOString(),
    products: feed
  });
});

// Official Google Merchant Center Product Feed (RSS 2.0 XML with Google Shopping Extensions)
app.get('/api/public/google-product-feed.xml', (req: Request, res: Response) => {
  const host = req.get('host') || 'www.vantreloutfit.shop';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const baseUrl = `${protocol}://${host}`;

  const itemsXml = products
    .filter((p) => !p.isArchived && p.status !== 'archived')
    .map((p) => {
      const rawImg = p.images && p.images[0] ? p.images[0] : '';
      const imgUrl = rawImg ? (rawImg.startsWith('http') ? rawImg : `${baseUrl}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`) : '';
      const cleanTitle = (p.name || 'VANTREL Product').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const cleanDesc = (p.description || p.tagline || p.name || 'Premium fashion by VANTREL OUTFIT Bangladesh.').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const availability = p.totalStock > 0 ? 'in_stock' : 'out_of_stock';
      const sizeStr = Array.isArray(p.sizes) ? p.sizes.join('/') : 'M';
      const colorStr = Array.isArray(p.colors) && p.colors.length > 0 ? p.colors.map((c) => c.name).join('/') : '';

      return `    <item>
      <g:id>${p.id}</g:id>
      <g:title>${cleanTitle}</g:title>
      <g:description>${cleanDesc}</g:description>
      <g:link>${baseUrl}/product/${p.slug || p.id}</g:link>
      ${imgUrl ? `<g:image_link>${imgUrl}</g:image_link>` : ''}
      <g:condition>new</g:condition>
      <g:availability>${availability}</g:availability>
      <g:price>${p.regularPrice} BDT</g:price>
      ${p.discountPrice ? `<g:sale_price>${p.discountPrice} BDT</g:sale_price>` : ''}
      <g:brand>VANTREL OUTFIT</g:brand>
      <g:product_type>${(p.category || 'Apparel & Accessories').replace(/&/g, '&amp;')}</g:product_type>
      <g:google_product_category>1604</g:google_product_category>
      <g:size>${sizeStr}</g:size>
      ${colorStr ? `<g:color>${colorStr}</g:color>` : ''}
      <g:shipping>
        <g:country>BD</g:country>
        <g:service>Standard Nationwide</g:service>
        <g:price>70 BDT</g:price>
      </g:shipping>
    </item>`;
    })
    .join('\n');

  const xmlFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>VANTREL OUTFIT - Google Merchant Center Product Catalog</title>
    <link>${baseUrl}</link>
    <description>Live product catalog for Google Shopping, Ads, and Performance Max campaigns across Bangladesh.</description>
${itemsXml}
  </channel>
</rss>`;

  res.type('application/xml').send(xmlFeed);
});

// Meta (Facebook / Instagram) Commerce Manager Standard CSV Catalog
app.get('/api/public/meta-catalog.csv', (req: Request, res: Response) => {
  const host = req.get('host') || 'www.vantreloutfit.shop';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const baseUrl = `${protocol}://${host}`;

  const headers = [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
    'google_product_category',
    'fb_product_category',
    'sale_price'
  ];

  const rows = products
    .filter((p) => !p.isArchived && p.status !== 'archived')
    .map((p) => {
      const rawImg = p.images && p.images[0] ? p.images[0] : '';
      const imgUrl = rawImg ? (rawImg.startsWith('http') ? rawImg : `${baseUrl}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`) : '';
      const avail = p.totalStock > 0 ? 'in stock' : 'out of stock';
      const cleanTitle = `"${(p.name || '').replace(/"/g, '""')}"`;
      const cleanDesc = `"${(p.description || p.tagline || p.name || '').replace(/"/g, '""')}"`;
      const priceStr = `"${p.regularPrice} BDT"`;
      const salePriceStr = p.discountPrice ? `"${p.discountPrice} BDT"` : '""';
      const link = `"${baseUrl}/product/${p.slug || p.id}"`;
      const imageLink = `"${imgUrl}"`;

      return [
        p.id,
        cleanTitle,
        cleanDesc,
        avail,
        'new',
        priceStr,
        link,
        imageLink,
        '"VANTREL OUTFIT"',
        '"1604"',
        '"Clothing & Accessories"',
        salePriceStr
      ].join(',');
    });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="vantrel_meta_catalog.csv"');
  res.send(csvContent);
});

// ==========================================
// CRAWLER & SOCIAL PREVIEW INTERCEPTOR
// (Googlebot, Googlebot-Image, Google-InspectionTool, Facebook, WhatsApp, AI)
// ==========================================
function escapeHtmlAttr(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveProductMatchedFromReq(req: Request): Product | undefined {
  const pathParts = req.path.split('/').filter(Boolean);
  if (pathParts[0] === 'product' && pathParts[1]) {
    const slugOrId = decodeURIComponent(pathParts[1]);
    return products.find((p) => p.slug === slugOrId || p.id === slugOrId);
  }
  if (req.query.product || req.query.productId) {
    const pId = String(req.query.product || req.query.productId);
    return products.find((p) => p.id === pId || p.slug === pId);
  }
  return undefined;
}

function buildProductJsonLd(prod: Product, baseUrl: string): Record<string, unknown> {
  const productUrl = `${baseUrl}/product/${encodeURIComponent(prod.slug || prod.id)}`;
  const resolvedImages = (prod.images || [])
    .filter((img) => Boolean(img && typeof img === 'string'))
    .map((img) => (img.startsWith('http') ? img : `${baseUrl}${img.startsWith('/') ? '' : '/'}${img}`));
  const effectivePrice = prod.discountPrice || prod.regularPrice;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: prod.name,
    url: productUrl,
    image: resolvedImages.length > 0 ? resolvedImages : [`${baseUrl}/assets/images/vantrel-logo.png`],
    description: (prod.description || prod.tagline || `Buy ${prod.name} from VANTREL OUTFIT Bangladesh.`).trim(),
    sku: prod.sku || prod.id,
    mpn: prod.sku || prod.id,
    category: prod.category,
    brand: {
      '@type': 'Brand',
      name: 'VANTREL OUTFIT'
    },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'BDT',
      price: String(effectivePrice),
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      availability: prod.totalStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'VANTREL OUTFIT'
      }
    }
  };

  if (prod.reviewCount > 0 && prod.rating > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(prod.rating),
      reviewCount: String(prod.reviewCount)
    };
  }

  return schema;
}

app.get('*', (req: Request, res: Response, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const isSocialCrawler = /facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Pinterest|Googlebot|Googlebot-Image|Google-InspectionTool|AdsBot-Google|Storebot-Google|Applebot|Slackbot|OAI-SearchBot|GPTBot|ClaudeBot|PerplexityBot|bingbot|DuckDuckBot|Discordbot/i.test(userAgent);

  if (!isSocialCrawler) {
    return next();
  }

  const host = req.get('host') || 'www.vantreloutfit.shop';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const baseUrl = `${protocol}://${host}`;
  const fullUrl = `${baseUrl}${req.originalUrl}`;

  const matchedProduct = resolveProductMatchedFromReq(req);

  const siteTitle = matchedProduct
    ? `${matchedProduct.name} - ৳${(matchedProduct.discountPrice || matchedProduct.regularPrice).toLocaleString()} | VANTREL OUTFIT`
    : 'VANTREL OUTFIT - Premium Quality & Trendsetting Fashion Bangladesh';

  const siteDesc = matchedProduct
    ? (matchedProduct.description || matchedProduct.tagline || `Buy ${matchedProduct.name} online in Bangladesh. 100% genuine premium streetwear by VANTREL OUTFIT. Fast Cash on Delivery across 64 districts.`)
    : 'এক ছাদের নিচে আপনার পছন্দের স্টাইলিশ ও প্রিমিয়াম ফ্যাশন কালেকশন। ক্যাশ অন ডেলিভারিতে সারাদেশে দ্রুত ডেলিভারি।';

  const productImages = matchedProduct
    ? (matchedProduct.images || [])
        .filter((img) => Boolean(img && typeof img === 'string'))
        .map((img) => (img.startsWith('http') ? img : `${baseUrl}${img.startsWith('/') ? '' : '/'}${img}`))
    : [];

  const siteImage = productImages[0] || `${baseUrl}/assets/images/vantrel-logo.png`;
  const effectivePrice = matchedProduct ? (matchedProduct.discountPrice || matchedProduct.regularPrice) : null;
  const canonicalUrl = matchedProduct
    ? `${baseUrl}/product/${encodeURIComponent(matchedProduct.slug || matchedProduct.id)}`
    : fullUrl;

  const publishedProducts = products.filter((p) => !p.isArchived && p.status !== 'archived');
  const jsonLdPayload = matchedProduct
    ? buildProductJsonLd(matchedProduct, baseUrl)
    : {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'VANTREL OUTFIT Product Catalog',
        numberOfItems: publishedProducts.length,
        itemListElement: publishedProducts.slice(0, 100).map((p, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          item: buildProductJsonLd(p, baseUrl)
        }))
      };

  const safeJsonLd = JSON.stringify(jsonLdPayload).replace(/</g, '\\u003c');

  const bodyContent = matchedProduct
    ? `<h1>${escapeHtmlAttr(matchedProduct.name)}</h1>
  <p>Brand: VANTREL OUTFIT | Price: ৳${effectivePrice} BDT</p>
  <p>${escapeHtmlAttr(siteDesc)}</p>
  ${(productImages.length > 0 ? productImages : [siteImage])
    .map((imgUrl, idx) => `<img src="${escapeHtmlAttr(imgUrl)}" alt="${escapeHtmlAttr(matchedProduct.name)} - VANTREL OUTFIT (${idx + 1})" />`)
    .join('\n  ')}
  <a href="${escapeHtmlAttr(canonicalUrl)}">View ${escapeHtmlAttr(matchedProduct.name)} on VANTREL OUTFIT</a>`
    : `<h1>${escapeHtmlAttr(siteTitle)}</h1>
  <p>${escapeHtmlAttr(siteDesc)}</p>
  ${publishedProducts
    .map((p) => {
      const rawImg = p.images?.[0] || '/assets/images/vantrel-logo.png';
      const absImg = rawImg.startsWith('http') ? rawImg : `${baseUrl}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
      const pUrl = `${baseUrl}/product/${encodeURIComponent(p.slug || p.id)}`;
      const pPrice = p.discountPrice || p.regularPrice;
      return `<article>
    <a href="${escapeHtmlAttr(pUrl)}">
      <img src="${escapeHtmlAttr(absImg)}" alt="${escapeHtmlAttr(p.name)} - VANTREL OUTFIT" />
      <h2>${escapeHtmlAttr(p.name)}</h2>
    </a>
    <p>Brand: VANTREL OUTFIT | Price: ${pPrice} BDT</p>
  </article>`;
    })
    .join('\n  ')}`;

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtmlAttr(siteTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(siteDesc)}">
  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}">

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="${matchedProduct ? 'product' : 'website'}">
  <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtmlAttr(siteTitle)}">
  <meta property="og:description" content="${escapeHtmlAttr(siteDesc)}">
  <meta property="og:image" content="${escapeHtmlAttr(siteImage)}">
  <meta property="og:image:secure_url" content="${escapeHtmlAttr(siteImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="VANTREL OUTFIT">
  <meta property="og:locale" content="bn_BD">
  ${effectivePrice ? `<meta property="product:price:amount" content="${effectivePrice}">
  <meta property="product:price:currency" content="BDT">
  <meta property="product:availability" content="${matchedProduct && matchedProduct.totalStock > 0 ? 'in stock' : 'out of stock'}">` : ''}

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtmlAttr(siteTitle)}">
  <meta name="twitter:description" content="${escapeHtmlAttr(siteDesc)}">
  <meta name="twitter:image" content="${escapeHtmlAttr(siteImage)}">

  <!-- Schema.org JSON-LD Product Markup for Google Search & Google Images -->
  <script type="application/ld+json">${safeJsonLd}</script>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

  return res.type('text/html').send(html);
});

// ==========================================
// VITE DEV SERVER OR PRODUCTION SERVING
// ==========================================
async function startServer() {
  // Always hydrate latest Admin products from Firebase Firestore on server startup
  await syncProductsFromFirestore();
  setInterval(() => {
    syncProductsFromFirestore().catch(() => {});
  }, 5 * 60 * 1000);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const distIndexPath = path.join(distDir, 'index.html');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response) => {
      const matchedProduct = resolveProductMatchedFromReq(req);
      if (matchedProduct && fs.existsSync(distIndexPath)) {
        try {
          const host = req.get('host') || 'www.vantreloutfit.shop';
          const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
          const baseUrl = `${protocol}://${host}`;
          const productSchema = buildProductJsonLd(matchedProduct, baseUrl);
          const safeJsonLd = JSON.stringify(productSchema).replace(/</g, '\\u003c');
          const effectivePrice = matchedProduct.discountPrice || matchedProduct.regularPrice;
          const productTitle = escapeHtmlAttr(`${matchedProduct.name} - ৳${effectivePrice.toLocaleString()} | VANTREL OUTFIT`);
          const productDesc = escapeHtmlAttr((matchedProduct.description || matchedProduct.tagline || matchedProduct.name).trim());
          const rawImg = matchedProduct.images?.[0] || '/assets/images/vantrel-logo.png';
          const absImg = escapeHtmlAttr(rawImg.startsWith('http') ? rawImg : `${baseUrl}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`);

          let html = fs.readFileSync(distIndexPath, 'utf-8');
          html = html
            .replace(/<title>[\s\S]*?<\/title>/i, `<title>${productTitle}</title>`)
            .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${productDesc}" />`)
            .replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${absImg}" />`)
            .replace(
              '</head>',
              `  <script type="application/ld+json" id="vantrel-product-jsonld">${safeJsonLd}</script>\n  </head>`
            );
          return res.type('text/html').send(html);
        } catch (err) {
          console.warn('Production product HTML injection warning:', err);
        }
      }
      res.sendFile(distIndexPath);
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`  ✦ VANTREL Clothing E-Commerce Engine ✦`);
    console.log(`  Market: Bangladesh (BDT ৳)`);
    console.log(`  Server running at: http://0.0.0.0:${PORT}`);
    console.log(`  API Base: http://0.0.0.0:${PORT}/api/health`);
    console.log(`======================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting VANTREL server:', err);
  process.exit(1);
});
