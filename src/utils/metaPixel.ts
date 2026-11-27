import type { Product, CartItem, Order } from '../types';
import { isSearchCrawler } from './crawlerDetect';

export const DEFAULT_META_PIXEL_ID = '2167529260510757';
const PURCHASE_DEDUP_STORAGE_KEY = 'vt_meta_purchased_orders_v1';

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
      disablePushState?: boolean;
    };
    _fbq?: unknown;
    __vantrelInitializedPixelId?: string;
    __vantrelLoadMetaPixel?: () => void;
    __vantrelInitialPathname?: string;
    __vantrelPageViewBootstrappedAt?: number;
    __vantrelInitialPageViewTracked?: boolean;
    __vantrelInitialPageViewEventId?: string;
  }
}

export interface MetaAdvancedMatchingInput {
  email?: string;
  phone?: string;
  fullName?: string;
  city?: string;
  country?: string;
}

export function sanitizeMetaPixelId(rawId?: string): string {
  const digits = String(rawId || '').replace(/[^\d]/g, '').trim();
  return digits.length >= 8 ? digits : DEFAULT_META_PIXEL_ID;
}

const recentViewContentTimestamps = new Map<string, number>();
const recentCheckoutTimestamps = new Map<string, number>();
const firedPurchaseOrderIds = new Set<string>();
let hasConsumedInitialPageView = false;
let lastTrackedRouteKey = '';
let lastTrackedPathname = '';

function normalizePixelPath(pathname: string): string {
  const clean = String(pathname || '/').trim() || '/';
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1);
  }
  return clean;
}

function roundBdt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

function resolveProductUnitPrice(product: Product): number {
  const disc = Number(product.discountPrice);
  const reg = Number(product.regularPrice);
  if (Number.isFinite(disc) && disc > 0) return roundBdt(disc);
  if (Number.isFinite(reg) && reg > 0) return roundBdt(reg);
  return 0;
}

function canTrack(pixelId?: string, enabled: boolean = true): boolean {
  if (typeof window === 'undefined') return false;
  if (!enabled) return false;
  if (isSearchCrawler()) return false;
  const cleanId = sanitizeMetaPixelId(pixelId);
  return Boolean(cleanId);
}

/**
 * Generates a unique eventID for Meta Pixel / CAPI event deduplication.
 */
export function generateMetaEventId(prefix: string = 'evt'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch {
    // Fallback below
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Formats Bangladesh phone numbers into international digits-only format (e.g. 8801XXXXXXXXX).
 */
function normalizeInternationalPhoneDigits(rawPhone?: string): string {
  const digits = String(rawPhone || '').replace(/[^\d]/g, '').trim();
  if (!digits) return '';
  if (digits.startsWith('880') && digits.length >= 13) return digits;
  if (digits.startsWith('01') && digits.length === 11) return `88${digits}`;
  if (digits.startsWith('1') && digits.length === 10) return `880${digits}`;
  return digits;
}

function loadPersistedPurchaseIds(): Set<string> {
  const ids = new Set<string>(firedPurchaseOrderIds);
  if (typeof window === 'undefined') return ids;
  try {
    const raw = localStorage.getItem(PURCHASE_DEDUP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          const clean = String(id || '').trim();
          if (clean) ids.add(clean);
        });
      }
    }
  } catch {
    // Ignore storage read failure
  }
  return ids;
}

function persistPurchaseId(orderKey: string): void {
  const clean = String(orderKey || '').trim();
  if (!clean) return;
  firedPurchaseOrderIds.add(clean);
  if (typeof window === 'undefined') return;
  try {
    const existing = Array.from(loadPersistedPurchaseIds());
    const trimmed = existing.slice(-100);
    localStorage.setItem(PURCHASE_DEDUP_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage write failure
  }
}

export function hasTrackedMetaPurchase(orderKey?: string): boolean {
  const clean = String(orderKey || '').trim();
  if (!clean) return false;
  return loadPersistedPurchaseIds().has(clean);
}

/**
 * Ensures Meta Pixel script is injected and initialized once without throwing if blocked.
 */
export function ensureMetaPixelLoaded(pixelId?: string, enabled: boolean = true): boolean {
  if (!canTrack(pixelId, enabled)) return false;

  const cleanId = sanitizeMetaPixelId(pixelId);
  try {
    if (typeof window.__vantrelLoadMetaPixel === 'function') {
      window.__vantrelLoadMetaPixel();
    }

    if (typeof window.fbq === 'function') {
      // Prevent Meta's fbevents.js from auto-firing PageView on History pushState/replaceState
      window.fbq.disablePushState = true;
      if (window.__vantrelInitializedPixelId !== cleanId) {
        window.fbq('init', cleanId);
        window.__vantrelInitializedPixelId = cleanId;
      }
      return true;
    }
  } catch {
    // Never crash checkout or storefront if fbq is blocked by an ad-blocker
  }
  return false;
}

/**
 * Central safe Meta Pixel event dispatcher with unique eventID for deduplication.
 * Never throws if fbq is blocked or unavailable.
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string,
  pixelId?: string,
  enabled: boolean = true
): string | null {
  if (!ensureMetaPixelLoaded(pixelId, enabled)) return null;
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return null;

  const finalEventId = String(eventId || generateMetaEventId(eventName.toLowerCase())).trim();

  try {
    if (params && Object.keys(params).length > 0) {
      window.fbq('track', eventName, params, { eventID: finalEventId });
    } else {
      window.fbq('track', eventName, undefined, { eventID: finalEventId });
    }
    return finalEventId;
  } catch {
    // Swallow blocked/third-party script errors silently
    return null;
  }
}

/**
 * Sends normalized, lowercased & trimmed customer data via fbq('init', ...)
 * right on checkout submission to boost Meta Event Match Quality (EMQ).
 * Never logs customer PII anywhere.
 */
export function applyMetaAdvancedMatching(
  customer: MetaAdvancedMatchingInput,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!canTrack(pixelId, enabled)) return;
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.__vantrelLoadMetaPixel === 'function') {
      window.__vantrelLoadMetaPixel();
    }
    if (typeof window.fbq !== 'function') return;

    const cleanId = sanitizeMetaPixelId(pixelId);
    const cleanFullName = String(customer.fullName || '').trim().toLowerCase();
    const nameParts = cleanFullName ? cleanFullName.split(/\s+/).filter(Boolean) : [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const cleanEmail = String(customer.email || '').trim().toLowerCase();
    const cleanPhone = normalizeInternationalPhoneDigits(customer.phone);
    const cleanCity = String(customer.city || '').trim().toLowerCase();
    const cleanCountry = String(customer.country || 'bd').trim().toLowerCase() || 'bd';

    const userData: Record<string, string> = {
      country: cleanCountry
    };
    if (cleanEmail && cleanEmail.includes('@') && !cleanEmail.endsWith('@vantrel.com')) {
      userData.em = cleanEmail;
    }
    if (cleanPhone) {
      userData.ph = cleanPhone;
    }
    if (firstName) {
      userData.fn = firstName;
    }
    if (lastName) {
      userData.ln = lastName;
    }
    if (cleanCity) {
      userData.ct = cleanCity;
    }

    window.fbq('init', cleanId, userData);
    window.__vantrelInitializedPixelId = cleanId;
  } catch {
    // Never fail checkout if Meta Pixel is blocked
  }
}

/**
 * Tracks SPA PageView once per unique route change (without double-firing on re-renders).
 */
export function trackMetaPageView(routeKey: string, pixelId?: string, enabled: boolean = true): void {
  if (!ensureMetaPixelLoaded(pixelId, enabled)) return;
  const cleanRouteKey = String(routeKey || '').trim();
  if (!cleanRouteKey) return;

  const currentPathname = normalizePixelPath(
    typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
  );
  const initialPathname = normalizePixelPath(
    typeof window !== 'undefined' ? window.__vantrelInitialPathname || '/' : '/'
  );

  // Skip only the first hydration pass if index.html already tracked this exact landing path
  if (!hasConsumedInitialPageView) {
    hasConsumedInitialPageView = true;
    if (window.__vantrelInitialPageViewTracked && currentPathname === initialPathname) {
      lastTrackedRouteKey = cleanRouteKey;
      lastTrackedPathname = currentPathname;
      return;
    }
  }

  // Deduplicate by both canonical route key and URL pathname so re-renders never double-fire
  if (cleanRouteKey === lastTrackedRouteKey || currentPathname === lastTrackedPathname) {
    lastTrackedRouteKey = cleanRouteKey;
    lastTrackedPathname = currentPathname;
    return;
  }

  lastTrackedRouteKey = cleanRouteKey;
  lastTrackedPathname = currentPathname;

  trackEvent('PageView', undefined, generateMetaEventId('pv'), pixelId, enabled);
}

/**
 * Tracks ViewContent whenever a product detail view opens.
 */
export function trackMetaViewContent(
  product: Product,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!product || !product.id) return;
  const prodId = String(product.id).trim();
  if (!prodId) return;

  // Brief 600ms guard prevents React StrictMode double-mount duplicates while allowing repeat visits
  const now = Date.now();
  const lastFired = recentViewContentTimestamps.get(prodId) || 0;
  if (now - lastFired < 600) return;
  recentViewContentTimestamps.set(prodId, now);

  const unitPrice = Number(resolveProductUnitPrice(product));
  const payload: Record<string, unknown> = {
    content_ids: [prodId],
    content_name: String(product.name || 'Vantrel Outfit Apparel').trim(),
    content_category: String(product.category || 'Apparel').trim(),
    content_type: 'product',
    value: unitPrice,
    currency: 'BDT',
    contents: [
      {
        id: prodId,
        quantity: 1,
        ...(unitPrice > 0 ? { item_price: unitPrice } : {})
      }
    ]
  };

  trackEvent('ViewContent', payload, generateMetaEventId('vc'), pixelId, enabled);
}

/**
 * Tracks AddToCart when customer clicks Add to Cart / Buy Now.
 */
export function trackMetaAddToCart(
  product: Product,
  _size: string,
  _color: string,
  quantity: number,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!product || !product.id) return;
  const prodId = String(product.id).trim();
  if (!prodId) return;

  const unitPrice = Number(resolveProductUnitPrice(product));
  const qty = Math.max(1, Math.floor(Number(quantity || 1)));
  const totalValue = Number(roundBdt(unitPrice * qty));

  const payload: Record<string, unknown> = {
    content_ids: [prodId],
    content_name: String(product.name || 'Vantrel Outfit Apparel').trim(),
    content_category: String(product.category || 'Apparel').trim(),
    content_type: 'product',
    value: totalValue,
    currency: 'BDT',
    num_items: qty,
    contents: [
      {
        id: prodId,
        quantity: qty,
        ...(unitPrice > 0 ? { item_price: unitPrice } : {})
      }
    ]
  };

  trackEvent('AddToCart', payload, generateMetaEventId('atc'), pixelId, enabled);
}

/**
 * Tracks InitiateCheckout when checkout opens or customer begins direct cart checkout.
 */
export function trackMetaInitiateCheckout(
  cart: CartItem[],
  subtotal: number,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!Array.isArray(cart) || cart.length === 0) return;

  const signature = `${cart.map((i) => `${i.productId || i.id}:${i.quantity}`).join('|')}:${roundBdt(subtotal)}`;
  const now = Date.now();
  const lastFired = recentCheckoutTimestamps.get(signature) || 0;
  if (now - lastFired < 1200) return;
  recentCheckoutTimestamps.set(signature, now);

  const contents = cart
    .map((i) => {
      const id = String(i.productId || i.id || '').trim();
      const qty = Math.max(1, Math.floor(Number(i.quantity || 1)));
      if (!id) return null;
      return { id, quantity: qty };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (contents.length === 0) return;

  const numItems = contents.reduce((sum, item) => sum + item.quantity, 0);
  const computedSubtotal = cart.reduce(
    (sum, item) => sum + roundBdt(item.price) * Math.max(1, Math.floor(Number(item.quantity || 1))),
    0
  );
  const safeValue = Number(roundBdt(Number(subtotal) > 0 ? subtotal : computedSubtotal));

  const payload: Record<string, unknown> = {
    content_ids: contents.map((c) => c.id),
    contents,
    num_items: numItems,
    value: safeValue,
    currency: 'BDT'
  };

  trackEvent('InitiateCheckout', payload, generateMetaEventId('ic'), pixelId, enabled);
}

/**
 * Tracks Purchase ONCE per unique order (persisted across page refreshes in localStorage).
 */
export function trackMetaPurchase(
  order: Order,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!order) return;
  const dedupKey = String(order.orderNumber || order.id || '').trim();
  if (!dedupKey) return;

  if (hasTrackedMetaPurchase(dedupKey) || (order.id && hasTrackedMetaPurchase(order.id))) {
    return;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const contents = items
    .map((i) => {
      const id = String(i.productId || i.id || '').trim();
      const qty = Math.max(1, Math.floor(Number(i.quantity || 1)));
      if (!id) return null;
      return { id, quantity: qty };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const numItems = Math.max(1, contents.reduce((sum, item) => sum + item.quantity, 0));
  const computedSubtotal = items.reduce(
    (sum, item) => sum + roundBdt(item.price) * Math.max(1, Math.floor(Number(item.quantity || 1))),
    0
  );
  const safeValue = Number(roundBdt(Number(order.total) > 0 ? order.total : computedSubtotal));

  const payload: Record<string, unknown> = {
    content_ids: contents.length > 0 ? contents.map((c) => c.id) : [dedupKey],
    contents: contents.length > 0 ? contents : [{ id: dedupKey, quantity: numItems }],
    content_type: 'product',
    num_items: numItems,
    value: safeValue,
    currency: 'BDT'
  };

  const sentEventId = trackEvent('Purchase', payload, `purchase-${dedupKey}`, pixelId, enabled);
  if (sentEventId) {
    persistPurchaseId(dedupKey);
    if (order.id && order.id !== dedupKey) {
      persistPurchaseId(order.id);
    }
  }
}
