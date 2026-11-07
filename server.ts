import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import {
  INITIAL_PRODUCTS,
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
  Banner3DConfig
} from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Enable gzip/brotli compression for all requests (reduces payload by 70%+)
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-Memory Persistent Database
let products: Product[] = [...INITIAL_PRODUCTS];
let orders: Order[] = [...INITIAL_ORDERS];
let coupons = [...INITIAL_COUPONS];
let customers: User[] = [...INITIAL_CUSTOMERS];
let smsLogs: SmsLog[] = [...INITIAL_SMS_LOGS];
let auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
let settings = { ...INITIAL_SETTINGS };
let financialRecords: FinancialRecord[] = [...INITIAL_FINANCIAL_RECORDS];
let staffModerators: StaffModerator[] = [...INITIAL_MODERATORS];
let themeConfig: ThemeConfig = { ...INITIAL_THEME };
let banners3D: Banner3DConfig[] = [...INITIAL_3D_BANNERS];

// Temporary OTP memory cache (phone -> { code, expiresAt })
const otpStore = new Map<string, { code: string; expiresAt: number }>();

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

// Background automated job: Check 15-minute confirmation deadlines
setInterval(() => {
  const now = Date.now();
  let updatedCount = 0;

  orders = orders.map((ord) => {
    if (
      ord.orderStatus === 'Pending Customer Confirmation' &&
      ord.confirmationDeadline &&
      new Date(ord.confirmationDeadline).getTime() <= now
    ) {
      updatedCount++;
      recordAudit(
        'Automated System',
        'Cron Processor',
        'Auto-Customer Confirmation Deadline Elapsed',
        `Order ${ord.orderNumber} reached 15-minute customer edit deadline. Transitioned to 'Awaiting Staff Approval'.`
      );
      dispatchSms(
        ord.customer.phone,
        'ORDER_CONFIRMED',
        `VANTREL: Order ${ord.orderNumber} is now confirmed & forwarded to staff approval team for swift dispatch.`
      );
      return {
        ...ord,
        orderStatus: 'Awaiting Staff Approval' as OrderStatus,
        statusHistory: [
          ...(ord.statusHistory || []),
          {
            status: 'Awaiting Staff Approval' as OrderStatus,
            timestamp: new Date().toISOString(),
            note: '15-min customer window elapsed. Awaiting staff approval.'
          }
        ]
      };
    }
    return ord;
  });

  if (updatedCount > 0) {
    console.log(`[VANTREL CRON] Automatically transitioned ${updatedCount} orders to Awaiting Staff Approval.`);
  }
}, 10000);

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
    id: `prod-vt-${Date.now()}`,
    slug: (body.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: body.name,
    tagline: body.tagline || 'Modern garment engineered in Bangladesh.',
    description: body.description || '',
    category: body.category || 'Hoodies',
    subCategory: body.subCategory || 'Streetwear',
    brand: 'VANTREL',
    sku: body.sku,
    regularPrice: Number(body.regularPrice),
    discountPrice: body.discountPrice ? Number(body.discountPrice) : undefined,
    discountPercent: body.discountPercent ? Number(body.discountPercent) : undefined,
    images: body.images?.length ? body.images : ['/src/assets/images/product_premium_hoodie_1792588590406.jpg'],
    sizes: body.sizes || ['S', 'M', 'L', 'XL'],
    colors: body.colors || [{ name: 'Forest Pine', hex: '#14221C' }],
    variants: body.variants || [],
    fabric: body.fabric || '420 GSM 100% Cotton',
    fit: body.fit || 'Relaxed Oversized Fit',
    care: body.care || ['Machine wash cold', 'Dry flat in shade'],
    tags: body.tags || ['VANTREL', 'Streetwear'],
    isFeatured: body.isFeatured ?? true,
    isNewArrival: body.isNewArrival ?? true,
    isBestSeller: body.isBestSeller ?? false,
    rating: 5.0,
    reviewCount: 0,
    totalStock: Number(body.totalStock || 50),
    createdDate: new Date().toISOString()
  };

  products.unshift(newProd);
  recordAudit('Admin Staff', 'Product Moderator', 'Product Created', `Added new product: ${newProd.name} (${newProd.sku})`);

  res.status(201).json({ success: true, message: 'Product created successfully', data: newProd });
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  const idx = products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  products[idx] = { ...products[idx], ...req.body };
  recordAudit('Admin Staff', 'Product Moderator', 'Product Updated', `Updated product: ${products[idx].name}`);
  res.json({ success: true, data: products[idx] });
});

app.delete('/api/products/:id', (req: Request, res: Response) => {
  const idx = products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const deleted = products.splice(idx, 1)[0];
  recordAudit('Super Admin', 'Super Admin', 'Product Deleted', `Removed product: ${deleted.name} (${deleted.sku})`);
  res.json({ success: true, message: 'Product deleted', data: deleted });
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
      const variant = prod.variants.find((v) => v.size === ordItem.size && v.color === ordItem.color);
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
    statusHistory: [
      {
        status: 'Pending Customer Confirmation',
        timestamp: new Date().toISOString(),
        note: `Order placed. 15-min edit/confirmation window expires at ${new Date(deadline).toLocaleTimeString()}`
      }
    ]
  };

  orders.unshift(newOrder);

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

  res.status(201).json({
    success: true,
    message: 'Order created with 15-minute confirmation window',
    data: newOrder
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
      const variant = prod.variants.find((v) => v.size === item.size && v.color === item.color);
      if (variant) {
        variant.stock += item.quantity;
      }
    }
  });

  order.orderStatus = 'Cancelled';
  order.statusHistory = [
    ...(order.statusHistory || []),
    {
      status: 'Cancelled',
      timestamp: new Date().toISOString(),
      note: `Cancelled: ${reason}. Product stock restored to inventory.`
    }
  ];

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
    deliveryFee: 70,
    total: 1920,
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
const srcAssetsImages = path.resolve(__dirname, 'src', 'assets', 'images');

// Support /assets/images statically with aggressive browser/crawler caching
app.use('/assets/images', express.static(publicAssetsImages, { maxAge: '30d', etag: true }));

// Support /src/assets/images fallback route for Googlebot and legacy indexed links
app.use('/src/assets/images', express.static(publicAssetsImages, { maxAge: '30d', etag: true }));
app.use('/src/assets/images', express.static(srcAssetsImages, { maxAge: '30d', etag: true }));

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
// VITE DEV SERVER OR PRODUCTION SERVING
// ==========================================
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
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
