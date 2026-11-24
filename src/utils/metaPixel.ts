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

  // Avoid double-firing PageView on the initial bootstrap (index.html already queues the first PageView)
  if (!lastTrackedRouteKey) {
    lastTrackedRouteKey = routeKey;
    return;
  }
  if (lastTrackedRouteKey === routeKey) return;
  lastTrackedRouteKey = routeKey;

  window.fbq?.('track', 'PageView');
}

export function trackMetaViewContent(
  product: Product,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!product || !product.id) return;
  if (!ensureMetaPixelLoaded(pixelId, enabled)) return;

  if (firedViewContentKeys.has(product.id)) return;
  firedViewContentKeys.add(product.id);
  window.setTimeout(() => firedViewContentKeys.delete(product.id), 15000);

  const unitPrice = Number(product.discountPrice ?? product.regularPrice ?? 0);
  window.fbq?.('track', 'ViewContent', {
    content_ids: [product.id],
    content_name: product.name,
    content_category: product.category,
    content_type: 'product',
    value: unitPrice,
    currency: 'BDT'
  });
}

export function trackMetaAddToCart(
  product: Product,
  size: string,
  color: string,
  quantity: number,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!product || !product.id) return;
  if (!ensureMetaPixelLoaded(pixelId, enabled)) return;

  const unitPrice = Number(product.discountPrice ?? product.regularPrice ?? 0);
  const qty = Math.max(1, Number(quantity || 1));

  window.fbq?.('track', 'AddToCart', {
    content_ids: [product.id],
    content_name: product.name,
    content_category: product.category,
    content_type: 'product',
    variant: `${size}/${color}`,
    value: unitPrice * qty,
    currency: 'BDT',
    contents: [
      {
        id: product.id,
        quantity: qty,
        item_price: unitPrice
      }
    ]
  });
}

export function trackMetaInitiateCheckout(
  cart: CartItem[],
  subtotal: number,
  pixelId?: string,
  enabled: boolean = true
): void {
  if (!Array.isArray(cart) || cart.length === 0) return;
  if (!ensureMetaPixelLoaded(pixelId, enabled)) return;

  const signature = cart.map((i) => `${i.id}:${i.quantity}`).join('|');
  if (firedCheckoutKeys.has(signature)) return;
  firedCheckoutKeys.add(signature);
  window.setTimeout(() => firedCheckoutKeys.delete(signature), 30000);

  const numItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  window.fbq?.('track', 'InitiateCheckout', {
    content_ids: cart.map((i) => i.productId || i.id),
    content_type: 'product',
    num_items: numItems,
    value: Number(subtotal || 0),
    currency: 'BDT',
    contents: cart.map((i) => ({
      id: i.productId || i.id,
      quantity: i.quantity || 1,
      item_price: Number(i.price || 0)
    }))
  });
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
  const numItems = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  window.fbq?.(
    'track',
    'Purchase',
    {
      content_ids: items.map((i) => i.productId || i.id),
      content_type: 'product',
      num_items: numItems,
      value: Number(order.total || 0),
      currency: 'BDT',
      order_id: order.orderNumber,
      contents: items.map((i) => ({
        id: i.productId || i.id,
        quantity: i.quantity || 1,
        item_price: Number(i.price || 0)
      }))
    },
    { eventID: order.orderNumber }
  );
}
