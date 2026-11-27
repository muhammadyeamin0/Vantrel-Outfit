import type { Product, CartItem, Order } from '../types';
import { isSearchCrawler } from './crawlerDetect';

export const DEFAULT_META_PIXEL_ID = '2167529260510757';

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: unknown;
    __vantrelInitializedPixelId?: string;
    __vantrelLoadMetaPixel?: () => void;
    __vantrelInitialPathname?: string;
    __vantrelPageViewBootstrappedAt?: number;
  }
}

export function sanitizeMetaPixelId(rawId?: string): string {
  const digits = String(rawId || '').replace(/[^\d]/g, '').trim();
  return digits.length >= 8 ? digits : DEFAULT_META_PIXEL_ID;
}

const firedViewContentKeys = new Set<string>();
const firedCheckoutKeys = new Set<string>();
const firedPurchaseOrderNumbers = new Set<string>();
let lastTrackedRouteKey = '';
let lastTrackedPathname = '';

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

export function ensureMetaPixelLoaded(pixelId?: string, enabled: boolean = true): boolean {
  if (!canTrack(pixelId, enabled)) return false;

  const cleanId = sanitizeMetaPixelId(pixelId);
  if (typeof window.__vantrelLoadMetaPixel === 'function') {
    window.__vantrelLoadMetaPixel();
  }

  if (typeof window.fbq === 'function') {
    if (window.__vantrelInitializedPixelId !== cleanId) {
      window.fbq('init', cleanId);
      window.__vantrelInitializedPixelId = cleanId;
    }
    return true;
  }
  return false;
}

export function trackMetaPageView(routeKey: string, pixelId?: string, enabled: boolean = true): void {
  if (!ensureMetaPixelLoaded(pixelId, enabled)) return;
  if (!routeKey) return;

  const currentPathname = typeof window !== 'undefined' ? window.location.pathname || '/' : '/';
  const initialPathname = typeof window !== 'undefined' ? window.__vantrelInitialPathname || '/' : '/';
  const bootstrappedAt = typeof window !== 'undefined' ? Number(window.__vantrelPageViewBootstrappedAt || 0) : 0;
  const isInitialHydration =
    !lastTrackedRouteKey ||
    (bootstrappedAt > 0 && Date.now() - bootstrappedAt < 2500 && currentPathname === initialPathname && !lastTrackedPathname);

  // Avoid double-firing PageView during initial React/URL hydration (index.html already fired the initial PageView)
  if (isInitialHydration) {
    lastTrackedRouteKey = routeKey;
    if (currentPathname === initialPathname) {
      lastTrackedPathname = currentPathname;
    }
    return;
  }

  if (lastTrackedRouteKey === routeKey && lastTrackedPathname === currentPathname) return;
  lastTrackedRouteKey = routeKey;
  lastTrackedPathname = currentPathname;

  window.fbq?.('track', 'PageView');
}

export function trackMetaViewContent(
  product: Product,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!product || !product.id) return;
  if (!ensureMetaPixelLoaded(pixelId, enabled)) return;

  const prodId = String(product.id).trim();
  if (!prodId) return;

  if (firedViewContentKeys.has(prodId)) return;
  firedViewContentKeys.add(prodId);
  window.setTimeout(() => firedViewContentKeys.delete(prodId), 15000);

  const unitPrice = resolveProductUnitPrice(product);
  const payload: Record<string, unknown> = {
    content_ids: [prodId],
    content_name: String(product.name || 'Vantrel Outfit Apparel').trim(),
    content_category: String(product.category || 'Apparel').trim(),
    content_type: 'product',
    contents: [
      {
        id: prodId,
        quantity: 1,
        ...(unitPrice > 0 ? { item_price: unitPrice } : {})
      }
    ]
  };

  if (unitPrice > 0) {
    payload.value = unitPrice;
    payload.currency = 'BDT';
  }

  window.fbq?.('track', 'ViewContent', payload);
}

export function trackMetaAddToCart(
  product: Product,
  _size: string,
  _color: string,
  quantity: number,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!product || !product.id) return;
  if (!ensureMetaPixelLoaded(pixelId, enabled)) return;

  const prodId = String(product.id).trim();
  if (!prodId) return;

  const unitPrice = resolveProductUnitPrice(product);
  const qty = Math.max(1, Math.floor(Number(quantity || 1)));
  const totalValue = roundBdt(unitPrice * qty);

  const payload: Record<string, unknown> = {
    content_ids: [prodId],
    content_name: String(product.name || 'Vantrel Outfit Apparel').trim(),
    content_category: String(product.category || 'Apparel').trim(),
    content_type: 'product',
    num_items: qty,
    contents: [
      {
        id: prodId,
        quantity: qty,
        ...(unitPrice > 0 ? { item_price: unitPrice } : {})
      }
    ]
  };

  if (totalValue > 0) {
    payload.value = totalValue;
    payload.currency = 'BDT';
  }

  window.fbq?.('track', 'AddToCart', payload);
}

export function trackMetaInitiateCheckout(
  cart: CartItem[],
  subtotal: number,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!Array.isArray(cart) || cart.length === 0) return;
  if (!ensureMetaPixelLoaded(pixelId, enabled)) return;

  const signature = cart.map((i) => `${i.productId || i.id}:${i.quantity}`).join('|');
  if (firedCheckoutKeys.has(signature)) return;
  firedCheckoutKeys.add(signature);
  window.setTimeout(() => firedCheckoutKeys.delete(signature), 30000);

  const contents = cart
    .map((i) => {
      const id = String(i.productId || i.id || '').trim();
      const qty = Math.max(1, Math.floor(Number(i.quantity || 1)));
      const itemPrice = roundBdt(i.price);
      if (!id) return null;
      return {
        id,
        quantity: qty,
        ...(itemPrice > 0 ? { item_price: itemPrice } : {})
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (contents.length === 0) return;

  const numItems = contents.reduce((sum, item) => sum + item.quantity, 0);
  const computedSubtotal = contents.reduce((sum, item) => sum + Number(item.item_price || 0) * item.quantity, 0);
  const safeValue = roundBdt(Number(subtotal) > 0 ? subtotal : computedSubtotal);

  const payload: Record<string, unknown> = {
    content_ids: contents.map((c) => c.id),
    content_type: 'product',
    num_items: numItems,
    contents
  };

  if (safeValue > 0) {
    payload.value = safeValue;
    payload.currency = 'BDT';
  }

  window.fbq?.('track', 'InitiateCheckout', payload);
}

export function trackMetaPurchase(
  order: Order,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!order || !order.orderNumber) return;
  if (!ensureMetaPixelLoaded(pixelId, enabled)) return;

  if (firedPurchaseOrderNumbers.has(order.orderNumber)) return;
  firedPurchaseOrderNumbers.add(order.orderNumber);

  const items = Array.isArray(order.items) ? order.items : [];
  const contents = items
    .map((i) => {
      const id = String(i.productId || i.id || '').trim();
      const qty = Math.max(1, Math.floor(Number(i.quantity || 1)));
      const itemPrice = roundBdt(i.price);
      if (!id) return null;
      return {
        id,
        quantity: qty,
        ...(itemPrice > 0 ? { item_price: itemPrice } : {})
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const numItems = Math.max(1, contents.reduce((sum, item) => sum + item.quantity, 0));
  const computedSubtotal = contents.reduce((sum, item) => sum + Number(item.item_price || 0) * item.quantity, 0);
  const safeValue = roundBdt(Number(order.total) > 0 ? order.total : computedSubtotal);

  const payload: Record<string, unknown> = {
    content_ids: contents.length > 0 ? contents.map((c) => c.id) : [String(order.orderNumber)],
    content_type: 'product',
    num_items: numItems,
    value: safeValue > 0 ? safeValue : 1,
    currency: 'BDT',
    ...(contents.length > 0 ? { contents } : {})
  };

  window.fbq?.('track', 'Purchase', payload, { eventID: String(order.orderNumber) });
}
