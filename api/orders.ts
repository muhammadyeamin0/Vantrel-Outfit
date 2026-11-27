import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import {
  getFirebaseAppletConfig,
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
  [key: string]: unknown;
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
    notes?: string;
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
  trackingUrl?: string;
  trackingAssignedAt?: string;
  currentLocationNote?: string;
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
const TMP_DELETED_ORDERS_FILE = '/tmp/vantrel_deleted_orders.json';
const QUOTA_BACKOFF_MS = 6 * 60 * 60 * 1000;
const ORDERS_SYNC_TTL_MS = 15 * 60 * 1000;
const DEFAULT_ORDER_QUERY_LIMIT = 50;

let ordersCache: OrderRecord[] | null = null;
let deletedOrderIdsCache: Record<string, number> | null = null;
let firestoreQuotaBackoffUntil = 0;
let lastOrdersFirestoreSyncAt = 0;

function extractBearerToken(req: IncomingMessage): string {
  const authHeader = String(req.headers.authorization || '');
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

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

function loadDeletedOrderIds(): Record<string, number> {
  if (deletedOrderIdsCache) return deletedOrderIdsCache;
  try {
    if (fs.existsSync(TMP_DELETED_ORDERS_FILE)) {
      const raw = fs.readFileSync(TMP_DELETED_ORDERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        deletedOrderIdsCache = parsed as Record<string, number>;
        return deletedOrderIdsCache;
      }
    }
  } catch {
    // ignore read error
  }
  deletedOrderIdsCache = {};
  return deletedOrderIdsCache;
}

function saveDeletedOrderIds(map: Record<string, number>): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const pruned: Record<string, number> = {};
  for (const [k, ts] of Object.entries(map)) {
    if (typeof ts === 'number' && ts >= cutoff) {
      pruned[k] = ts;
    }
  }
  deletedOrderIdsCache = pruned;
  try {
    fs.writeFileSync(TMP_DELETED_ORDERS_FILE, JSON.stringify(pruned), 'utf-8');
  } catch {
    // ignore /tmp write error
  }
}

function markOrderDeleted(id: string): void {
  const map = loadDeletedOrderIds();
  map[id] = Date.now();
  saveDeletedOrderIds(map);
}

function unmarkOrderDeleted(id: string): void {
  const map = loadDeletedOrderIds();
  if (id in map) {
    delete map[id];
    saveDeletedOrderIds(map);
  }
}

function encodeFirestoreValue(val: unknown): Record<string, unknown> | undefined {
  if (val === undefined) return undefined;
  if (val === null) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { integerValue: '0' };
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    const values = val
      .map((item) => encodeFirestoreValue(item))
      .filter((item): item is Record<string, unknown> => item !== undefined);
    return { arrayValue: { values } };
  }
  if (typeof val === 'object') {
    return { mapValue: { fields: encodeFirestoreFields(val as Record<string, unknown>) } };
  }
  return undefined;
}

function encodeFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const encoded = encodeFirestoreValue(val);
    if (encoded !== undefined) {
      fields[key] = encoded;
    }
  }
  return fields;
}

function decodeFirestoreValue(val: unknown): unknown {
  if (!val || typeof val !== 'object') return undefined;
  const v = val as Record<string, unknown>;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return String(v.stringValue);
  if ('timestampValue' in v) return String(v.timestampValue);
  if ('arrayValue' in v) {
    const arr = (v.arrayValue as { values?: unknown[] } | undefined)?.values;
    return Array.isArray(arr) ? arr.map((item) => decodeFirestoreValue(item)) : [];
  }
  if ('mapValue' in v) {
    const fields = (v.mapValue as { fields?: Record<string, unknown> } | undefined)?.fields;
    return decodeFirestoreFields(fields);
  }
  return undefined;
}

function decodeFirestoreFields(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields || typeof fields !== 'object') return out;
  for (const [key, value] of Object.entries(fields)) {
    const decoded = decodeFirestoreValue(value);
    if (decoded !== undefined) out[key] = decoded;
  }
  return out;
}

function getFirestoreBaseUrl(): { baseDocUrl: string; apiKey: string } | null {
  const cfg = getFirebaseAppletConfig();
  if (!cfg?.projectId || !cfg?.apiKey) return null;
  const dbId = cfg.firestoreDatabaseId || '(default)';
  return {
    baseDocUrl: `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/${encodeURIComponent(dbId)}/documents`,
    apiKey: cfg.apiKey
  };
}

function isQuotaErrorResponse(status: number, bodyText: string): boolean {
  return (
    status === 429 ||
    bodyText.includes('RESOURCE_EXHAUSTED') ||
    bodyText.includes('Quota limit exceeded') ||
    bodyText.includes('quota metric')
  );
}

function sanitizeOrderForFirestore(order: OrderRecord): OrderRecord {
  const cleanId = String(order.id || `ord-${Date.now()}`)
    .replace(/[/\\.]/g, '-')
    .slice(0, 128);
  const rawOrderNum = String(order.orderNumber || `VT-${Math.floor(10000 + Math.random() * 90000)}`)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-');
  const cleanOrderNumber = (rawOrderNum.startsWith('VT-') ? rawOrderNum : `VT-${rawOrderNum}`).slice(0, 40);

  const rawCustomer = order.customer || ({} as OrderRecord['customer']);
  const cleanCustomer: OrderRecord['customer'] = {
    fullName: String(rawCustomer.fullName || 'Customer').trim().slice(0, 120) || 'Customer',
    phone: String(rawCustomer.phone || '01700000000').trim().slice(0, 24) || '01700000000',
    district: String(rawCustomer.district || 'Dhaka').trim().slice(0, 80) || 'Dhaka',
    upazila: String(rawCustomer.upazila || rawCustomer.district || 'সদর').trim().slice(0, 80) || 'সদর',
    streetAddress:
      String(rawCustomer.streetAddress || 'Bangladesh').trim().slice(0, 400) || 'Bangladesh',
    ...(rawCustomer.email ? { email: String(rawCustomer.email).trim().slice(0, 160) } : {}),
    ...(rawCustomer.division ? { division: String(rawCustomer.division).trim().slice(0, 80) } : {}),
    ...(rawCustomer.notes ? { notes: String(rawCustomer.notes).trim().slice(0, 400) } : {})
  };

  const paymentMethod = String(order.paymentMethod || 'Cash on Delivery (COD)').trim().slice(0, 80) || 'Cash on Delivery (COD)';
  const paymentStatus =
    paymentMethod === 'Cash on Delivery (COD)' && !['Paid', 'Refunded', 'Partially Paid'].includes(String(order.paymentStatus))
      ? 'Pending'
      : String(order.paymentStatus || 'Pending');

  const cleanObj = JSON.parse(
    JSON.stringify({
      ...order,
      id: cleanId,
      orderNumber: cleanOrderNumber,
      customer: cleanCustomer,
      items: Array.isArray(order.items) ? order.items.slice(0, 50) : [],
      subtotal: Math.max(0, Math.min(5000000, Number(order.subtotal) || 0)),
      deliveryFee:
        order.deliveryFee !== undefined
          ? Math.max(0, Math.min(5000, Number(order.deliveryFee) || 0))
          : Math.max(0, Math.min(5000, Number(order.deliveryCharge) || 0)),
      total: Math.max(0, Math.min(5000000, Number(order.total) || 0)),
      paymentMethod,
      paymentStatus,
      createdAt: String(order.createdAt || new Date().toISOString()).slice(0, 64),
      ...(order.userId ? { userId: String(order.userId).slice(0, 128) } : {}),
      savedToFirestoreAt: new Date().toISOString()
    })
  ) as OrderRecord;

  return cleanObj;
}

async function persistOrderToFirestoreRest(order: OrderRecord): Promise<void> {
  if (Date.now() < firestoreQuotaBackoffUntil) return;
  const conn = getFirestoreBaseUrl();
  if (!conn) return;

  const clean = sanitizeOrderForFirestore(order);
  const url = `${conn.baseDocUrl}/orders?documentId=${encodeURIComponent(clean.id)}&key=${encodeURIComponent(conn.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFirestoreFields(clean as Record<string, unknown>) }),
    signal: AbortSignal.timeout(7000)
  });

  if (res.ok || res.status === 409) {
    return;
  }

  const errBody = await res.text().catch(() => '');
  if (isQuotaErrorResponse(res.status, errBody)) {
    firestoreQuotaBackoffUntil = Date.now() + QUOTA_BACKOFF_MS;
    return;
  }
  throw new Error(`Firestore REST create HTTP ${res.status}: ${errBody.slice(0, 220)}`);
}

async function patchOrderInFirestoreRest(order: OrderRecord, bearerToken?: string): Promise<void> {
  if (!bearerToken || Date.now() < firestoreQuotaBackoffUntil) return;
  const conn = getFirestoreBaseUrl();
  if (!conn) return;

  const clean = sanitizeOrderForFirestore(order);
  const url = `${conn.baseDocUrl}/orders/${encodeURIComponent(clean.id)}?key=${encodeURIComponent(conn.apiKey)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`
    },
    body: JSON.stringify({ fields: encodeFirestoreFields(clean as Record<string, unknown>) }),
    signal: AbortSignal.timeout(7000)
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    if (isQuotaErrorResponse(res.status, errBody)) {
      firestoreQuotaBackoffUntil = Date.now() + QUOTA_BACKOFF_MS;
      return;
    }
    throw new Error(`Firestore REST patch HTTP ${res.status}: ${errBody.slice(0, 200)}`);
  }
}

async function fetchSingleOrderFromFirestoreRest(id: string, bearerToken: string): Promise<OrderRecord | null> {
  if (!bearerToken || Date.now() < firestoreQuotaBackoffUntil) return null;
  const conn = getFirestoreBaseUrl();
  if (!conn) return null;

  const url = `${conn.baseDocUrl}/orders/${encodeURIComponent(id)}?key=${encodeURIComponent(conn.apiKey)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) return null;
  const docObj = (await res.json()) as { name?: string; fields?: Record<string, unknown> };
  const docId = String(docObj.name || '').split('/').pop() || id;
  const decoded = decodeFirestoreFields(docObj.fields) as unknown as OrderRecord;
  return { ...decoded, id: docId };
}

async function fetchOrdersFromFirestoreRest(
  bearerToken: string,
  options?: { force?: boolean; limit?: number; sinceDays?: number | null }
): Promise<{
  orders: OrderRecord[];
  quotaExceeded: boolean;
  hasMore: boolean;
  usedCache: boolean;
  lastSyncedAt: string | null;
  error?: string;
}> {
  if (!bearerToken) {
    return {
      orders: [],
      quotaExceeded: false,
      hasMore: false,
      usedCache: true,
      lastSyncedAt: lastOrdersFirestoreSyncAt ? new Date(lastOrdersFirestoreSyncAt).toISOString() : null
    };
  }
  if (Date.now() < firestoreQuotaBackoffUntil) {
    return {
      orders: [],
      quotaExceeded: true,
      hasMore: false,
      usedCache: true,
      lastSyncedAt: lastOrdersFirestoreSyncAt ? new Date(lastOrdersFirestoreSyncAt).toISOString() : null,
      error: 'Firestore daily read quota temporarily paused; showing cached orders.'
    };
  }

  const cachedList = loadOrdersCache();
  if (
    !options?.force &&
    lastOrdersFirestoreSyncAt > 0 &&
    Date.now() - lastOrdersFirestoreSyncAt < ORDERS_SYNC_TTL_MS &&
    cachedList.length > 0
  ) {
    return {
      orders: [],
      quotaExceeded: false,
      hasMore: false,
      usedCache: true,
      lastSyncedAt: new Date(lastOrdersFirestoreSyncAt).toISOString()
    };
  }

  const conn = getFirestoreBaseUrl();
  if (!conn) {
    return {
      orders: [],
      quotaExceeded: false,
      hasMore: false,
      usedCache: true,
      lastSyncedAt: lastOrdersFirestoreSyncAt ? new Date(lastOrdersFirestoreSyncAt).toISOString() : null
    };
  }

  const fetchLimit = Math.max(1, Math.min(300, Number(options?.limit) || DEFAULT_ORDER_QUERY_LIMIT));
  const sinceDays = options?.sinceDays && options.sinceDays > 0 ? options.sinceDays : null;

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: 'orders' }],
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
    limit: fetchLimit
  };
  if (sinceDays) {
    const cutoffIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'createdAt' },
        op: 'GREATER_THAN_OR_EQUAL',
        value: { stringValue: cutoffIso }
      }
    };
  }

  const remoteOrders: OrderRecord[] = [];
  try {
    const runQueryUrl = `${conn.baseDocUrl}:runQuery?key=${encodeURIComponent(conn.apiKey)}`;
    const res = await fetch(runQueryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`
      },
      body: JSON.stringify({ structuredQuery }),
      signal: AbortSignal.timeout(8500)
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (isQuotaErrorResponse(res.status, errBody)) {
        firestoreQuotaBackoffUntil = Date.now() + QUOTA_BACKOFF_MS;
        return {
          orders: [],
          quotaExceeded: true,
          hasMore: false,
          usedCache: true,
          lastSyncedAt: lastOrdersFirestoreSyncAt ? new Date(lastOrdersFirestoreSyncAt).toISOString() : null,
          error: 'Firebase Firestore free daily read quota limit exceeded.'
        };
      }
      return {
        orders: [],
        quotaExceeded: false,
        hasMore: false,
        usedCache: true,
        lastSyncedAt: lastOrdersFirestoreSyncAt ? new Date(lastOrdersFirestoreSyncAt).toISOString() : null,
        error: `Firestore REST HTTP ${res.status}`
      };
    }

    const rows = (await res.json()) as Array<{
      document?: { name?: string; fields?: Record<string, unknown> };
    }>;
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (!row?.document?.name) continue;
        const docId = String(row.document.name).split('/').pop() || '';
        if (!docId) continue;
        const decoded = decodeFirestoreFields(row.document.fields) as unknown as OrderRecord;
        remoteOrders.push({ ...decoded, id: docId });
      }
    }

    lastOrdersFirestoreSyncAt = Date.now();
    return {
      orders: remoteOrders,
      quotaExceeded: false,
      hasMore: remoteOrders.length >= fetchLimit,
      usedCache: false,
      lastSyncedAt: new Date(lastOrdersFirestoreSyncAt).toISOString()
    };
  } catch (err) {
    return {
      orders: remoteOrders,
      quotaExceeded: false,
      hasMore: false,
      usedCache: true,
      lastSyncedAt: lastOrdersFirestoreSyncAt ? new Date(lastOrdersFirestoreSyncAt).toISOString() : null,
      error: err instanceof Error ? err.message : 'Firestore REST fetch failed'
    };
  }
}

async function deleteOrderFromFirestoreRest(id: string, bearerToken: string): Promise<void> {
  if (!bearerToken || Date.now() < firestoreQuotaBackoffUntil) return;
  const conn = getFirestoreBaseUrl();
  if (!conn) return;
  const url = `${conn.baseDocUrl}/orders/${encodeURIComponent(id)}?key=${encodeURIComponent(conn.apiKey)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${bearerToken}` },
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok && res.status !== 404) {
    const errBody = await res.text().catch(() => '');
    if (isQuotaErrorResponse(res.status, errBody)) {
      firestoreQuotaBackoffUntil = Date.now() + QUOTA_BACKOFF_MS;
    }
  }
}

function mergeOrderCollections(localOrders: OrderRecord[], remoteOrders: OrderRecord[]): OrderRecord[] {
  const deletedMap = loadDeletedOrderIds();
  const map = new Map<string, OrderRecord>();

  const upsert = (ord: OrderRecord) => {
    if (!ord || !ord.id) return;
    const deletedAt = deletedMap[ord.id];
    if (deletedAt) {
      const createdMs = new Date(ord.createdAt || 0).getTime();
      if (!Number.isFinite(createdMs) || createdMs <= deletedAt) return;
    }
    const existing = map.get(ord.id);
    if (!existing) {
      map.set(ord.id, ord);
      return;
    }
    const existingHistLen = Array.isArray(existing.statusHistory) ? existing.statusHistory.length : 0;
    const incomingHistLen = Array.isArray(ord.statusHistory) ? ord.statusHistory.length : 0;
    const existingHasTracking = Boolean(existing.trackingNumber || existing.courierTrackingCode);
    const incomingHasTracking = Boolean(ord.trackingNumber || ord.courierTrackingCode);

    if (incomingHistLen > existingHistLen || (!existingHasTracking && incomingHasTracking)) {
      map.set(ord.id, { ...existing, ...ord });
    } else if (existingHistLen > incomingHistLen) {
      map.set(ord.id, { ...ord, ...existing });
    } else {
      map.set(ord.id, { ...existing, ...ord });
    }
  };

  localOrders.forEach(upsert);
  remoteOrders.forEach(upsert);

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
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
  const bearerToken = extractBearerToken(req);

  let orders = loadOrdersCache();

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

    const forceSync = url.searchParams.get('force') === '1' || url.searchParams.get('force') === 'true';
    const limitParam = Number(url.searchParams.get('limit') || DEFAULT_ORDER_QUERY_LIMIT);
    const sinceDaysRaw = url.searchParams.get('sinceDays') || '';
    const sinceDays =
      sinceDaysRaw && sinceDaysRaw !== 'all' && Number.isFinite(Number(sinceDaysRaw))
        ? Math.max(1, Math.min(365, Math.round(Number(sinceDaysRaw))))
        : null;
    const statusParam = (url.searchParams.get('status') || '').trim();

    const remoteResult = await fetchOrdersFromFirestoreRest(bearerToken, {
      force: forceSync,
      limit: limitParam,
      sinceDays
    });
    if (remoteResult.orders.length > 0) {
      orders = mergeOrderCollections(orders, remoteResult.orders);
      saveOrdersCache(orders);
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

      sendJson(res, 200, {
        success: true,
        count: foundList.length,
        data: foundList,
        lastSyncedAt: remoteResult.lastSyncedAt,
        ...(remoteResult.quotaExceeded ? { quotaExceeded: true, warning: remoteResult.error } : {})
      });
      return;
    }

    let filteredOrders = orders;
    if (statusParam && statusParam !== 'All') {
      filteredOrders = filteredOrders.filter((o) => o.orderStatus === statusParam);
    }
    if (sinceDays) {
      const cutoffMs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
      filteredOrders = filteredOrders.filter((o) => new Date(o.createdAt || 0).getTime() >= cutoffMs);
    }

    sendJson(res, 200, {
      success: true,
      count: filteredOrders.length,
      data: filteredOrders,
      hasMore: remoteResult.hasMore,
      usedCache: remoteResult.usedCache,
      lastSyncedAt: remoteResult.lastSyncedAt,
      ...(remoteResult.quotaExceeded ? { quotaExceeded: true, warning: remoteResult.error } : {})
    });
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
      if (idx === -1 && targetId && bearerToken) {
        const fetched = await fetchSingleOrderFromFirestoreRest(targetId, bearerToken);
        if (fetched) {
          orders.unshift(fetched);
          idx = 0;
        }
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
      await patchOrderInFirestoreRest(orders[idx], bearerToken).catch((err) => {
        console.warn('[VANTREL ORDERS API] Firestore approve sync notice:', err instanceof Error ? err.message : err);
      });
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
      if (idx === -1 && targetId && bearerToken) {
        const fetched = await fetchSingleOrderFromFirestoreRest(targetId, bearerToken);
        if (fetched) {
          orders.unshift(fetched);
          idx = 0;
        }
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
      await patchOrderInFirestoreRest(orders[idx], bearerToken).catch((err) => {
        console.warn('[VANTREL ORDERS API] Firestore courier sync notice:', err instanceof Error ? err.message : err);
      });
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
      if (idx === -1 && targetId && bearerToken) {
        const fetched = await fetchSingleOrderFromFirestoreRest(targetId, bearerToken);
        if (fetched) {
          orders.unshift(fetched);
          idx = 0;
        }
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
      await patchOrderInFirestoreRest(orders[idx], bearerToken).catch((err) => {
        console.warn('[VANTREL ORDERS API] Firestore status sync notice:', err instanceof Error ? err.message : err);
      });
      sendJson(res, 200, { success: true, data: orders[idx] });
      return;
    }

    // Create / Sync New Customer Order
    if (req.method === 'POST') {
      const { skipEmailNotification: _skipEmail, smtpFallback: _smtp, ...rawIncoming } = body as Record<string, unknown>;
      const incoming = rawIncoming as Partial<OrderRecord>;
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

      const rawCustomer = incoming.customer;
      const order: OrderRecord = {
        ...(incoming as OrderRecord),
        id: String(incoming.id || `ord-${Date.now()}`),
        orderNumber: String(incoming.orderNumber || `VT-${Math.floor(10000 + Math.random() * 90000)}`),
        customer: {
          ...rawCustomer,
          fullName: String(rawCustomer.fullName || '').trim() || 'Customer',
          phone: String(rawCustomer.phone || '').trim(),
          district: String(rawCustomer.district || 'Dhaka').trim() || 'Dhaka',
          upazila: String(rawCustomer.upazila || rawCustomer.district || 'সদর').trim() || 'সদর',
          streetAddress: String(rawCustomer.streetAddress || 'Bangladesh').trim() || 'Bangladesh'
        },
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

      unmarkOrderDeleted(order.id);

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
        await persistOrderToFirestoreRest(order);
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
        const matched = orders.filter((o) => o.id === idParam || o.orderNumber === idParam);
        const nextList = orders.filter((o) => o.id !== idParam && o.orderNumber !== idParam);
        saveOrdersCache(nextList);
        markOrderDeleted(idParam);
        for (const m of matched) {
          markOrderDeleted(m.id);
          await deleteOrderFromFirestoreRest(m.id, bearerToken).catch(() => {});
        }
        if (matched.length === 0) {
          await deleteOrderFromFirestoreRest(idParam, bearerToken).catch(() => {});
        }
        sendJson(res, 200, { success: true, deletedCount: orders.length - nextList.length });
      } else {
        const count = orders.length;
        orders.forEach((o) => markOrderDeleted(o.id));
        const remote = await fetchOrdersFromFirestoreRest(bearerToken);
        for (const r of remote.orders) {
          markOrderDeleted(r.id);
          await deleteOrderFromFirestoreRest(r.id, bearerToken).catch(() => {});
        }
        for (const o of orders) {
          await deleteOrderFromFirestoreRest(o.id, bearerToken).catch(() => {});
        }
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
