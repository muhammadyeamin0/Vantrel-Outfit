import type { IncomingMessage, ServerResponse } from 'http';
import nodemailer from 'nodemailer';
import { getRequestUrl, readJsonBody, sendJson, verifyAdminRequest } from './_lib/httpUtils.js';

const MERCHANT_WHATSAPP_LINK = 'https://wa.me/message/E6PISGJZC63TA1';

interface OrderLike {
  id?: string;
  orderNumber?: string;
  createdAt?: string;
  total?: number;
  subtotal?: number;
  deliveryFee?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  customer?: {
    fullName?: string;
    phone?: string;
    district?: string;
    upazila?: string;
    streetAddress?: string;
    email?: string;
  };
  items?: Array<{
    name?: string;
    size?: string;
    color?: string;
    quantity?: number;
    price?: number;
  }>;
}

function formatBdPhoneForWhatsApp(phone: string): string {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`;
  return digits;
}

function sanitizeEnvCred(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^["']+|["']+$/g, '').trim();
}

interface SmtpFallbackConfig {
  recipientEmail?: string;
  senderUser?: string;
  appPassword?: string;
}

async function dispatchOrderEmail(order: OrderLike, smtpFallback?: SmtpFallbackConfig) {
  const recipient =
    sanitizeEnvCred(smtpFallback?.recipientEmail) ||
    sanitizeEnvCred(process.env.ORDER_NOTIFICATION_EMAIL) ||
    'muhammadeyamin0@gmail.com';
  const senderUser =
    sanitizeEnvCred(process.env.GMAIL_USER) ||
    sanitizeEnvCred(smtpFallback?.senderUser) ||
    'muhammadeyamin0@gmail.com';
  const envPassword = sanitizeEnvCred(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '');
  const fallbackPassword = sanitizeEnvCred(smtpFallback?.appPassword).replace(/\s+/g, '');
  const appPassword = envPassword || fallbackPassword;

  if (!appPassword) {
    return {
      success: true,
      delivered: false,
      recipient,
      senderUser,
      note: 'Email payload validated; set GMAIL_APP_PASSWORD environment variable or enter Server SMTP Credential in Admin Settings'
    };
  }

  const itemsList = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = itemsList
    .map(
      (item) => `
      <tr style="border-bottom:1px solid #E5E1D5;">
        <td style="padding:10px 8px;"><strong>${item.name || 'Garment'}</strong><br/><small>Size: ${item.size || 'N/A'} | Color: ${item.color || 'Standard'}</small></td>
        <td style="padding:10px 8px;text-align:center;">${item.quantity || 1}</td>
        <td style="padding:10px 8px;text-align:right;">৳${(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}</td>
      </tr>`
    )
    .join('');

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: senderUser,
        pass: appPassword
      }
    });

    const info = await transporter.sendMail({
      from: `"VANTREL OUTFIT" <${senderUser}>`,
      to: recipient,
      subject: `[VANTREL ORDER] #${order.orderNumber || 'N/A'} - ৳${Number(order.total || 0).toLocaleString()} BDT`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e1d5;border-radius:12px;">
        <h2 style="margin:0 0 8px;">VANTREL OUTFIT — New Order #${order.orderNumber || 'N/A'}</h2>
        <p><strong>Customer:</strong> ${order.customer?.fullName || 'N/A'} (${order.customer?.phone || 'N/A'})</p>
        <p><strong>Address:</strong> ${order.customer?.streetAddress || ''}, ${order.customer?.upazila || ''}, ${order.customer?.district || ''}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">${itemsHtml}</table>
        <p style="font-size:16px;font-weight:bold;">Total: ৳${Number(order.total || 0).toLocaleString()} BDT (${order.paymentMethod || 'COD'})</p>
      </div>`
    });

    return { success: true, delivered: true, recipient, senderUser, messageId: info.messageId };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err || 'SMTP error');
    const authFailed = /535|Invalid login|Username and Password not accepted/i.test(errMsg);
    console.warn(`[VANTREL SMTP] Dispatch notice: ${errMsg}`);
    return {
      success: true,
      delivered: false,
      authFailed,
      recipient,
      senderUser,
      error: authFailed
        ? `Gmail SMTP rejected login for ${senderUser} (535). Generate a 16-character Google App Password (with 2-Step Verification enabled) for GMAIL_APP_PASSWORD.`
        : errMsg
    };
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const url = getRequestUrl(req);
  const op = (url.searchParams.get('op') || '').toLowerCase();

  try {
    const body = req.method === 'GET' ? {} : await readJsonBody<Record<string, unknown>>(req);

    if (op === 'save-smtp-config') {
      const adminCheck = await verifyAdminRequest(req);
      if (!adminCheck.authorized) {
        sendJson(res, 401, { success: false, error: 'Unauthorized' });
        return;
      }
      const cleaned = sanitizeEnvCred(String(body.gmailNotificationAppPassword || '')).replace(/\s+/g, '');
      sendJson(res, 200, {
        success: true,
        hasFallbackPassword: Boolean(cleaned),
        recipient: sanitizeEnvCred(String(body.orderNotificationEmail || '')) || 'muhammadeyamin0@gmail.com'
      });
      return;
    }

    if (op === 'send-order-notification') {
      const order = body.order as OrderLike | undefined;
      const smtpFallback = body.smtpFallback as SmtpFallbackConfig | undefined;
      if (!order || !order.customer) {
        sendJson(res, 400, { success: false, error: 'Order details with customer info required' });
        return;
      }
      const result = await dispatchOrderEmail(order, smtpFallback);
      sendJson(res, 200, result);
      return;
    }

    if (op === 'test-email-notification') {
      const adminCheck = await verifyAdminRequest(req);
      if (!adminCheck.authorized) {
        sendJson(res, 401, { success: false, error: 'Unauthorized' });
        return;
      }
      const smtpFallback: SmtpFallbackConfig = {
        recipientEmail: typeof body.recipientEmail === 'string' ? body.recipientEmail : undefined,
        senderUser: typeof body.senderUser === 'string' ? body.senderUser : undefined,
        appPassword: typeof body.appPassword === 'string' ? body.appPassword : undefined
      };
      const result = await dispatchOrderEmail(
        {
          orderNumber: `VT-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
          total: 1850,
          paymentMethod: 'Cash on Delivery (COD)',
          customer: {
            fullName: 'VANTREL Admin Test',
            phone: 'Verified Store Test',
            district: 'Dhaka',
            upazila: 'Banani',
            streetAddress: 'Banani Studio'
          },
          items: [{ name: 'VANTREL Test Garment', size: 'L', color: 'Black', quantity: 1, price: 1850 }]
        },
        smtpFallback
      );
      sendJson(res, 200, { success: true, details: result });
      return;
    }

    if (op === 'send-whatsapp-confirmation') {
      const orderNumber = String(body.orderNumber || 'N/A');
      const phone = String(body.phone || '');
      const waPhone = formatBdPhoneForWhatsApp(phone);
      const msg = `VANTREL OUTFIT - অর্ডার #${orderNumber} গ্রহণ করা হয়েছে।`;
      const encoded = encodeURIComponent(msg);
      const directSendUrl = waPhone
        ? `https://api.whatsapp.com/send?phone=${waPhone}&text=${encoded}`
        : `${MERCHANT_WHATSAPP_LINK}?text=${encoded}`;

      sendJson(res, 200, {
        success: true,
        data: {
          orderNumber,
          recipientPhone: phone,
          directSendUrl,
          merchantOrigin: MERCHANT_WHATSAPP_LINK,
          status: 'Ready'
        }
      });
      return;
    }

    if (op === 'finances' || op === 'moderators' || op === 'theme' || op === 'banners-3d') {
      const adminCheck = await verifyAdminRequest(req);
      if (req.method !== 'GET' && !adminCheck.authorized) {
        sendJson(res, 401, { success: false, error: 'Unauthorized' });
        return;
      }
      sendJson(res, 200, { success: true, data: [] });
      return;
    }

    sendJson(res, 404, { success: false, error: 'Unknown store operation' });
  } catch (err) {
    sendJson(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : 'Store operation error'
    });
  }
}
