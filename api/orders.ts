import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { doc, setDoc } from 'firebase/firestore';
import {
  getFirestoreClient,
  getRequestUrl,
  normalizeBdPhoneLast10,
  readJsonBody,
  sendJson,
  verifyAdminRequest
} from './_lib/httpUtils.js';
import { getLiveProducts } from './_lib/storeCatalog.js';

interface OrderItemRecord {
  productId?: string;
  name?: string;
  size?: string;
  color?: string;
  price: number;
  quantity: number;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  customer: {
    fullName: string;
    phone: string;
    district: string;
    upazila: string;
    streetAddress: string;
    email?: string;
    division?: string;
  };
  items: OrderItemRecord[];
  subtotal: number;
  deliveryFee?: number;
  deliveryCharge?: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  confirmationDeadline?: string;
  canCancelUntil?: string;
  customerConfirmationDeadline?: string;
  cancellationReason?: string;
  courierName?: string;
  courierTrackingCode?: string;
  trackingNumber?: string;
  userId?: string;
  statusHistory?: Array<{
    status: string;
    timestamp: string;
    note?: string;
    actor?: string;
  }>;
  [key: string]: unknown;
}

const TMP_ORDERS_FILE = '/tmp/vantrel_orders_cache.json';
let ordersCache: OrderRecord[] | null = null;

function loadOrdersCache(): OrderRecord[] {
  if (ordersCache) return ordersCache;
  try {
    if (fs.existsSync(TMP_ORDERS_FILE)) {
      const raw = fs.readFileSync(TMP_ORDERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        ordersCache = parsed as OrderRecord[];
        return ordersCache;
      }
    }
  } catch {
    // ignore read error
  }
  ordersCache = [];
  return ordersCache;
}

function saveOrdersCache(list: OrderRecord[]): void {
  ordersCache = list;
  try {
    fs.writeFileSync(TMP_ORDERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {
    // ignore /tmp write failure
  }
}

async function persistOrderToFirestore(order: OrderRecord): Promise<void> {
  const db = getFirestoreClient();
  if (!db) return;
  const cleanPayload = JSON.parse(JSON.stringify(order));
  await setDoc(doc(db, 'orders', order.id), {
    ...cleanPayload,
    savedToFirestoreAt: new Date().toISOString()
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const url = getRequestUrl(req);
  const pathname = url.pathname.replace(/\/+$/, '');
  const idParam = (url.searchParams.get('id') || '').trim();
  const actionParam = (url.searchParams.get('action') || '').trim().toLowerCase();
  const orderNumberParam = (url.searchParams.get('orderNumber') || '').trim().toUpperCase();
  const phoneParam = (url.searchParams.get('phone') || '').trim();

  const orders = loadOrdersCache();

  if (req.method === 'GET') {
    const adminCheck = await verifyAdminRequest(req);

    // Public tracking lookup strictly requires BOTH orderNumber/trackingCode AND 10-digit phone (unless verified Admin)
    if (orderNumberParam && phoneParam) {
      const cleanPhoneLast10 = normalizeBdPhoneLast10(phoneParam);
      if (cleanPhoneLast10.length < 10) {
        sendJson(res, 200, { success: true, count: 0, data: [] });
        return;
      }
      const foundList = orders.filter((o) => {
        const matchNum =
          o.orderNumber.toUpperCase() === orderNumberParam ||
          String(o.trackingNumber || '').trim().toUpperCase() === orderNumberParam ||
          String(o.courierTrackingCode || '').trim().toUpperCase() === orderNumberParam;
        const ordPhoneLast10 = normalizeBdPhoneLast10(o.customer?.phone || '');
        const matchPhone = ordPhoneLast10 === cleanPhoneLast10;
        const matchId = idParam ? (o.id === idParam || o.orderNumber.toUpperCase() === idParam.toUpperCase()) : true;
        return matchId && matchNum && matchPhone;
      });
      sendJson(res, 200, { success: true, count: foundList.length, data: foundList });
      return;
    }

    // Any single-field lookup, ID lookup, or full list strictly requires verified Google Admin
    if (!adminCheck.authorized) {
      sendJson(res, 200, { success: true, count: 0, data: [] });
      return;
    }

    if (idParam || orderNumberParam || phoneParam) {
      const cleanPhoneLast10 = normalizeBdPhoneLast10(phoneParam);
      const foundList = orders.filter((o) => {
        const matchId = idParam ? (o.id === idParam || o.orderNumber.toUpperCase() === idParam.toUpperCase()) : true;
        const matchNum = orderNumberParam ? o.orderNumber.toUpperCase() === orderNumberParam : true;
        const ordPhoneLast10 = normalizeBdPhoneLast10(o.customer?.phone || '');
        const matchPhone = cleanPhoneLast10 ? ordPhoneLast10 === cleanPhoneLast10 : true;
        return matchId && matchNum && matchPhone;
      });

      if (idParam && !orderNumberParam && !phoneParam) {
        if (foundList.length === 0) {
          sendJson(res, 404, { success: false, error: 'Order not found' });
          return;
        }
        sendJson(res, 200, { success: true, data: foundList[0] });
        return;
      }

      sendJson(res, 200, { success: true, count: foundList.length, data: foundList });
      return;
    }

    sendJson(res, 200, { success: true, count: orders.length, data: orders });
    return;
  }

  try {
    const body = req.method === 'DELETE' ? {} : await readJsonBody<Record<string, unknown>>(req);

    // Auto-Confirm 15-minute grace window endpoint
    if (req.method === 'POST' && (actionParam === 'auto-confirm' || pathname.endsWith('/auto-confirm'))) {
      const targetId = idParam || pathname.split('/').slice(-2, -1)[0] || '';
      const idx = orders.findIndex((o) => o.id === targetId || o.orderNumber === targetId);
      if (idx === -1) {
        sendJson(res, 404, { success: false, error: 'Order not found' });
        return;
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
            note: '15-minute customer window elapsed without cancellation. Order auto-confirmed.'
          }
        ];
        saveOrdersCache(orders);
      }
      sendJson(res, 200, { success: true, message: 'Order auto-confirmed successfully', data: order });
      return;
    }

    // Cancel order within grace window
    if (req.method === 'POST' && (actionParam === 'cancel' || pathname.endsWith('/cancel'))) {
      const targetId = idParam || pathname.split('/').slice(-2, -1)[0] || '';
      const idx = orders.findIndex((o) => o.id === targetId || o.orderNumber === targetId);
      if (idx === -1) {
        sendJson(res, 404, { success: false, error: 'Order not found' });
        return;
      }
      const reason = String(body.reason || 'Cancelled by customer');
      const order = orders[idx];
      order.orderStatus = 'Cancelled';
      order.cancellationReason = reason;
      order.statusHistory = [
        ...(order.statusHistory || []),
        {
          status: 'Cancelled',
          timestamp: new Date().toISOString(),
          note: `Cancelled: ${reason}`
        }
      ];
      saveOrdersCache(orders);
      sendJson(res, 200, { success: true, message: 'Order cancelled', data: order });
      return;
    }

    // Approve order (Admin only)
    if (req.method === 'POST' && (actionParam === 'approve' || pathname.endsWith('/approve'))) {
      const adminCheck = await verifyAdminRequest(req);
      if (!adminCheck.authorized) {
        sendJson(res, 401, { success: false, error: 'Unauthorized' });
        return;
      }
      const targetId = idParam || pathname.split('/').slice(-2, -1)[0] || '';
      let idx = orders.findIndex((o) => o.id === targetId || o.orderNumber === targetId);
      const snapshot = body.orderSnapshot as OrderRecord | undefined;
      if (idx === -1 && snapshot && typeof snapshot === 'object' && snapshot.id) {
        orders.unshift(snapshot);
        idx = 0;
      }
      if (idx === -1) {
        sendJson(res, 404, { success: false, error: 'Order not found' });
        return;
      }
      const approveNote = String(body.note || 'Order approved by admin');
      orders[idx].orderStatus = 'Order Confirmed';
      orders[idx].currentLocationNote = approveNote;
      orders[idx].statusHistory = [
        ...(orders[idx].statusHistory || []),
        {
          status: 'Order Confirmed',
          timestamp: new Date().toISOString(),
          note: approveNote
        }
      ];
      saveOrdersCache(orders);
      sendJson(res, 200, { success: true, message: 'Order approved', data: orders[idx] });
      return;
    }

    // Assign courier tracking (Admin only)
    if (req.method === 'POST' && (actionParam === 'courier' || pathname.endsWith('/courier'))) {
      const adminCheck = await verifyAdminRequest(req);
      if (!adminCheck.authorized) {
        sendJson(res, 401, { success: false, error: 'Unauthorized' });
        return;
      }
      const targetId = idParam || pathname.split('/').slice(-2, -1)[0] || '';
      let idx = orders.findIndex((o) => o.id === targetId || o.orderNumber === targetId);
      const snapshot = body.orderSnapshot as OrderRecord | undefined;
      if (idx === -1 && snapshot && typeof snapshot === 'object' && snapshot.id) {
        orders.unshift(snapshot);
        idx = 0;
      }
      if (idx === -1) {
        sendJson(res, 404, { success: false, error: 'Order not found' });
        return;
      }
      const courierName = String(body.courierName || orders[idx].courierName || 'Steadfast');
      const trackingCode = String(body.trackingCode || body.trackingNumber || '').trim();
      const targetStatus = String(
        body.targetStatus ||
          (orders[idx].orderStatus === 'Pending Customer Confirmation' ||
          orders[idx].orderStatus === 'Customer Confirmed' ||
          orders[idx].orderStatus === 'Awaiting Staff Approval'
            ? 'Order Confirmed'
            : orders[idx].orderStatus === 'Order Confirmed'
            ? 'Shipped'
            : orders[idx].orderStatus)
      );
      const note = String(body.note || `Assigned ${courierName} Tracking ID: ${trackingCode}`);
      orders[idx].courierName = courierName;
      orders[idx].courierTrackingCode = trackingCode;
      orders[idx].trackingNumber = trackingCode;
      if (typeof body.trackingUrl === 'string' && body.trackingUrl.trim()) {
        orders[idx].trackingUrl = body.trackingUrl.trim();
      }
      orders[idx].trackingAssignedAt = new Date().toISOString();
      orders[idx].currentLocationNote = note;
      orders[idx].orderStatus = targetStatus;
      orders[idx].statusHistory = [
        ...(orders[idx].statusHistory || []),
        {
          status: targetStatus,
          timestamp: new Date().toISOString(),
          note
        }
      ];
      saveOrdersCache(orders);
      sendJson(res, 200, { success: true, data: orders[idx] });
      return;
    }

    // Update status (Admin only)
    if (req.method === 'PATCH' || actionParam === 'status') {
      const adminCheck = await verifyAdminRequest(req);
      if (!adminCheck.authorized) {
        sendJson(res, 401, { success: false, error: 'Unauthorized' });
        return;
      }
      const targetId = idParam || pathname.split('/').slice(-2, -1)[0] || '';
      let idx = orders.findIndex((o) => o.id === targetId || o.orderNumber === targetId);
      const snapshot = body.orderSnapshot as OrderRecord | undefined;
      if (idx === -1 && snapshot && typeof snapshot === 'object' && snapshot.id) {
        orders.unshift(snapshot);
        idx = 0;
      }
      if (idx === -1) {
        sendJson(res, 404, { success: false, error: 'Order not found' });
        return;
      }
      const status = String(body.status || orders[idx].orderStatus);
      const note = String(body.note || `Updated status to ${status}`);
      orders[idx].orderStatus = status;
      orders[idx].currentLocationNote = note;
      orders[idx].statusHistory = [
        ...(orders[idx].statusHistory || []),
        { status, timestamp: new Date().toISOString(), note }
      ];
      saveOrdersCache(orders);
      sendJson(res, 200, { success: true, data: orders[idx] });
      return;
    }

    // Create / Sync New Customer Order
    if (req.method === 'POST') {
      const incoming = body as Partial<OrderRecord>;
      if (!incoming.customer?.fullName || !incoming.customer?.phone || !Array.isArray(incoming.items) || incoming.items.length === 0) {
        sendJson(res, 400, { success: false, error: 'Customer details and items are required' });
        return;
      }

      const deadline =
        incoming.confirmationDeadline ||
        incoming.canCancelUntil ||
        incoming.customerConfirmationDeadline ||
        new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const subtotal = Number(
        incoming.subtotal ??
          incoming.items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 1), 0)
      );
      const deliveryFee = Number(incoming.deliveryFee ?? incoming.deliveryCharge ?? 0);
      const total = Math.max(0, Number(incoming.total ?? subtotal + deliveryFee));

      const order: OrderRecord = {
        ...(incoming as OrderRecord),
        id: String(incoming.id || `ord-${Date.now()}`),
        orderNumber: String(incoming.orderNumber || `VT-${Math.floor(10000 + Math.random() * 90000)}`),
        subtotal,
        deliveryFee,
        total,
        paymentMethod: String(incoming.paymentMethod || 'Cash on Delivery (COD)'),
        paymentStatus:
          String(incoming.paymentMethod || '').includes('COD') ? 'Pending' : String(incoming.paymentStatus || 'Pending'),
        orderStatus: 'Pending Customer Confirmation',
        createdAt: String(incoming.createdAt || new Date().toISOString()),
        confirmationDeadline: deadline,
        canCancelUntil: deadline,
        customerConfirmationDeadline: deadline,
        statusHistory: Array.isArray(incoming.statusHistory) && incoming.statusHistory.length > 0
          ? incoming.statusHistory
          : [
              {
                status: 'Pending Customer Confirmation',
                timestamp: new Date().toISOString(),
                note: 'Order received. 15-minute cancellation window active.'
              }
            ]
      };

      const existingIdx = orders.findIndex((o) => o.id === order.id || o.orderNumber === order.orderNumber);
      if (existingIdx === -1) {
        // Reject newly placed orders for Out-of-Stock / archived products
        const liveCatalog = await getLiveProducts().catch(() => []);
        if (liveCatalog.length > 0) {
          for (const item of incoming.items) {
            if (!item.productId) continue;
            const liveProd = liveCatalog.find((p) => p.id === item.productId);
            if (!liveProd) continue;
            const prodVariants = Array.isArray((liveProd as Record<string, unknown>).variants)
              ? ((liveProd as Record<string, unknown>).variants as Array<{ size?: string; color?: string; stock?: number }>)
              : [];
            const matchedVar = prodVariants.find((v) => v.size === item.size && v.color === item.color);
            const avail = matchedVar ? Number(matchedVar.stock ?? 0) : Number(liveProd.totalStock ?? 0);
            if (liveProd.isArchived || liveProd.status === 'archived' || Number(liveProd.totalStock ?? 0) <= 0 || avail <= 0 || Number(item.quantity || 1) > avail) {
              sendJson(res, 400, {
                success: false,
                error: `${item.name || liveProd.name} বর্তমানে Out of Stock (${avail}টি স্টকে আছে)।`
              });
              return;
            }
          }
        }
        orders.unshift(order);
      } else {
        orders[existingIdx] = { ...orders[existingIdx], ...order };
      }
      saveOrdersCache(orders);

      try {
        await persistOrderToFirestore(order);
      } catch (fbErr) {
        console.warn('[VANTREL ORDERS API] Firestore order sync notice:', fbErr instanceof Error ? fbErr.message : fbErr);
      }

      sendJson(res, 201, {
        success: true,
        message: 'Order synchronized successfully',
        data: order
      });
      return;
    }

    // Delete order(s) (Admin only)
    if (req.method === 'DELETE') {
      const adminCheck = await verifyAdminRequest(req);
      if (!adminCheck.authorized) {
        sendJson(res, 401, { success: false, error: 'Unauthorized' });
        return;
      }
      if (idParam) {
        const nextList = orders.filter((o) => o.id !== idParam && o.orderNumber !== idParam);
        saveOrdersCache(nextList);
        sendJson(res, 200, { success: true, deletedCount: orders.length - nextList.length });
      } else {
        const count = orders.length;
        saveOrdersCache([]);
        sendJson(res, 200, { success: true, count });
      }
      return;
    }

    sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  } catch (err) {
    sendJson(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : 'Order endpoint error'
    });
  }
}
