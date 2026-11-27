import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  VANTREL_CANONICAL_ORIGIN,
  type MinimalProductRecord,
  rewriteProductImagesToProxy,
  resolveSeoProductImages,
  toCanonicalSeoImageUrl,
  getProductSeoSlug,
  getCategorySlug
} from './seoUtils.js';

export type ProductRecord = MinimalProductRecord;

const LEGACY_PRIMARY_PRODUCT_IDS = new Set([
  'prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005',
  'prod-006', 'prod-007', 'prod-008', 'prod-009', 'prod-010',
  'prod-011', 'prod-012', 'prod-013', 'prod-014', 'prod-015',
  'prod-016', 'prod-017', 'prod-018', 'prod-019', 'prod-overcoat-005'
]);

const CACHE_TTL_MS = 15 * 60 * 1000;
let cachedProducts: ProductRecord[] | null = null;
let cachedOutOfStockDefaultBehavior: 'show' | 'hide' = 'show';
let cachedAt = 0;
let firestoreQuotaBackoffUntil = 0;
let refreshPromise: Promise<ProductRecord[]> | null = null;

export function applyLiveProductsCache(next: ProductRecord[]): void {
  cachedProducts = normalizeProductsList(next);
  cachedAt = Date.now();
}

export function invalidateLiveProductsCache(): void {
  cachedAt = 0;
}

function resolveRepoFilePath(relativePath: string): string | null {
  const candidates: string[] = [path.resolve(process.cwd(), relativePath)];
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.resolve(dir, '../../', relativePath));
    candidates.push(path.resolve(dir, '../', relativePath));
  } catch {
    // ignore
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function readRepoTextFile(relativePath: string): string | null {
  const resolved = resolveRepoFilePath(relativePath);
  if (!resolved) return null;
  try {
    return fs.readFileSync(resolved, 'utf-8');
  } catch {
    return null;
  }
}

function readJsonFile<T>(relativePath: string): T | null {
  const raw = readRepoTextFile(relativePath);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function applyCostMarkupToRecord(p: ProductRecord): ProductRecord {
  const rawCost = typeof p.costPrice === 'number' ? p.costPrice : Number(p.costPrice);
  if (Number.isFinite(rawCost) && rawCost > 0) {
    const cleanCost = Math.round(rawCost);
    const sellingPrice = cleanCost + 220;
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
  }
  return {
    ...p,
    discountPrice:
      typeof p.discountPrice === 'number' && p.discountPrice > 0 ? p.discountPrice : undefined
  };
}

function normalizeProductsList(list: ProductRecord[]): ProductRecord[] {
  const normalized = list
    .filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id))
    .map((p) =>
      applyCostMarkupToRecord({
        ...p,
        brand: p.brand || 'VANTREL OUTFIT',
        images: rewriteProductImagesToProxy(p.images),
        isArchived: Boolean(p.isArchived || p.status === 'archived')
      })
    );

  normalized.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (typeof a.sortOrder === 'number' && typeof b.sortOrder === 'number') {
      return a.sortOrder - b.sortOrder;
    }
    return 0;
  });

  return normalized;
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

async function refreshFromFirestoreBackground(): Promise<ProductRecord[]> {
  if (Date.now() < firestoreQuotaBackoffUntil) {
    return cachedProducts || [];
  }
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const firebaseConfig = readJsonFile<{
        apiKey?: string;
        projectId?: string;
        firestoreDatabaseId?: string;
      }>('firebase-applet-config.json');

      const projectId = firebaseConfig?.projectId;
      const apiKey = firebaseConfig?.apiKey;
      const dbId = firebaseConfig?.firestoreDatabaseId || '(default)';
      if (projectId && apiKey) {
        const baseDocUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(dbId)}/documents`;
        const remote: ProductRecord[] = [];
        let pageToken = '';

        do {
          const productsUrl = `${baseDocUrl}/products?pageSize=300&key=${encodeURIComponent(apiKey)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
          const res = await fetch(productsUrl, { signal: AbortSignal.timeout(4500) });
          if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            if (res.status === 429 || errBody.includes('RESOURCE_EXHAUSTED') || errBody.includes('Quota limit exceeded')) {
              firestoreQuotaBackoffUntil = Date.now() + 6 * 60 * 60 * 1000;
              return cachedProducts || [];
            }
            throw new Error(`Firestore REST HTTP ${res.status}`);
          }

          const payload = (await res.json()) as {
            documents?: Array<{ name?: string; fields?: Record<string, unknown> }>;
            nextPageToken?: string;
          };
          const docs = Array.isArray(payload.documents) ? payload.documents : [];
          for (const docItem of docs) {
            const docId = String(docItem.name || '').split('/').pop() || '';
            if (!docId || LEGACY_PRIMARY_PRODUCT_IDS.has(docId)) continue;
            const data = decodeFirestoreFields(docItem.fields) as unknown as ProductRecord;
            remote.push({
              ...data,
              id: docId
            });
          }
          pageToken = payload.nextPageToken || '';
        } while (pageToken);

        try {
          const storeRes = await fetch(`${baseDocUrl}/settings/store?key=${encodeURIComponent(apiKey)}`, {
            signal: AbortSignal.timeout(2500)
          });
          if (storeRes.ok) {
            const storeDoc = (await storeRes.json()) as { fields?: Record<string, unknown> };
            const storeData = decodeFirestoreFields(storeDoc.fields);
            cachedOutOfStockDefaultBehavior = storeData?.outOfStockDefaultBehavior === 'hide' ? 'hide' : 'show';
          }
        } catch {
          // Optional setting fetch failure should not block product sync
        }

        if (remote.length > 0) {
          cachedProducts = normalizeProductsList(remote);
          cachedAt = Date.now();
          return cachedProducts;
        }
      }
    } catch (err) {
      console.warn('[VANTREL SEO] Background Firestore refresh notice:', err instanceof Error ? err.message : err);
    } finally {
      refreshPromise = null;
    }
    return cachedProducts || [];
  })();
  return refreshPromise;
}

export async function getLiveProducts(forceRefresh = false): Promise<ProductRecord[]> {
  const now = Date.now();
  if (!forceRefresh && cachedProducts && now - cachedAt < CACHE_TTL_MS) {
    return cachedProducts;
  }

  // If warm cache exists, return instantly and refresh from Firestore in background
  if (!forceRefresh && cachedProducts && cachedProducts.length > 0) {
    cachedAt = now;
    void refreshFromFirestoreBackground();
    return cachedProducts;
  }

  // On cold start or forceRefresh, load live Firestore only if not in quota backoff
  if (Date.now() >= firestoreQuotaBackoffUntil) {
    try {
      const fresh = await Promise.race([
        refreshFromFirestoreBackground(),
        new Promise<ProductRecord[]>((resolve) => setTimeout(() => resolve([]), forceRefresh ? 3000 : 1800))
      ]);
      if (fresh.length > 0) return fresh;
    } catch {
      // Fall back cleanly to local disk snapshot below
    }
  }

  const fallbackData = readJsonFile<ProductRecord[]>('data/products_store.json');
  const fallbackList = Array.isArray(fallbackData) ? fallbackData : [];
  cachedProducts = normalizeProductsList(fallbackList);
  // Reuse disk cache for 5 minutes before retrying live Firestore
  cachedAt = now - CACHE_TTL_MS + 5 * 60 * 1000;
  return cachedProducts;
}

const rawImagesCache = new Map<string, { images: string[]; cachedAt: number }>();
let rawDiskIndexBuilt = false;
const rawDiskById = new Map<string, string[]>();
const rawDiskBySlug = new Map<string, string[]>();

function ensureRawDiskImageIndex(): void {
  if (rawDiskIndexBuilt) return;
  rawDiskIndexBuilt = true;
  const list = readJsonFile<ProductRecord[]>('data/products_store.json');
  if (!Array.isArray(list)) return;
  for (const p of list) {
    if (!p || !p.id || LEGACY_PRIMARY_PRODUCT_IDS.has(p.id) || !Array.isArray(p.images)) continue;
    rawDiskById.set(p.id, p.images);
    const slugKey = getProductSeoSlug(p);
    if (slugKey) rawDiskBySlug.set(slugKey, p.images);
    if (p.slug) rawDiskBySlug.set(String(p.slug).toLowerCase(), p.images);
  }
}

export async function getProductImagesFast(productId: string): Promise<string[] | null> {
  const cleanId = String(productId || '').trim();
  if (!cleanId) return null;

  // 1. Check warm catalog cache first if already populated
  if (cachedProducts && cachedProducts.length > 0) {
    const match = cachedProducts.find(
      (p) => p.id === cleanId || p.slug === cleanId || getProductSeoSlug(p, cachedProducts!) === cleanId
    );
    if (match?.images && match.images.length > 0) {
      return match.images;
    }
  }

  // 2. Check raw per-product cache (avoids re-querying Firestore across idx=0..3 & responsive widths)
  const mem = rawImagesCache.get(cleanId);
  if (mem && Date.now() - mem.cachedAt < 5 * 60 * 1000) {
    return mem.images;
  }

  // 3. Check lightweight disk index (no full-catalog URL normalization overhead)
  ensureRawDiskImageIndex();
  const diskMatch =
    rawDiskById.get(cleanId) ||
    rawDiskBySlug.get(cleanId) ||
    rawDiskBySlug.get(cleanId.toLowerCase());
  if (diskMatch && diskMatch.length > 0) {
    rawImagesCache.set(cleanId, { images: diskMatch, cachedAt: Date.now() });
    return diskMatch;
  }

  // 4. Fallback to direct Firestore REST document lookup (e.g. newly added products not yet in static JSON)
  if (Date.now() >= firestoreQuotaBackoffUntil) {
    try {
      const firebaseConfig = readJsonFile<{
        apiKey?: string;
        projectId?: string;
        firestoreDatabaseId?: string;
      }>('firebase-applet-config.json');

      const projectId = firebaseConfig?.projectId;
      const apiKey = firebaseConfig?.apiKey;
      const dbId = firebaseConfig?.firestoreDatabaseId || '(default)';
      if (projectId && apiKey) {
        const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(dbId)}/documents/products/${encodeURIComponent(cleanId)}?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(docUrl, { signal: AbortSignal.timeout(2500) });
        if (res.status === 429) {
          firestoreQuotaBackoffUntil = Date.now() + 6 * 60 * 60 * 1000;
        } else if (res.ok) {
          const docJson = (await res.json()) as { fields?: Record<string, unknown> };
          const data = decodeFirestoreFields(docJson.fields) as { images?: unknown };
          if (Array.isArray(data.images) && data.images.length > 0) {
            const imgs = data.images.filter((x): x is string => typeof x === 'string' && x.length > 0);
            if (imgs.length > 0) {
              rawImagesCache.set(cleanId, { images: imgs, cachedAt: Date.now() });
              return imgs;
            }
          }
        }
      }
    } catch {
      // ignore timeout / network failure
    }
  }

  return null;
}

export function isCatalogProductHiddenByOutOfStock(
  p: ProductRecord,
  defaultBehavior: 'show' | 'hide' = cachedOutOfStockDefaultBehavior
): boolean {
  if ((p.totalStock ?? 0) > 0) return false;
  const effective = p.outOfStockBehavior === 'hide' || p.outOfStockBehavior === 'show'
    ? p.outOfStockBehavior
    : defaultBehavior;
  return effective === 'hide';
}

export function getPublishedProducts(allProducts: ProductRecord[]): ProductRecord[] {
  return allProducts.filter(
    (p) =>
      !p.isArchived &&
      p.status !== 'archived' &&
      p.status !== 'draft' &&
      !isCatalogProductHiddenByOutOfStock(p)
  );
}

export function getActiveCategories(publishedProducts: ProductRecord[]): string[] {
  const seen = new Set<string>();
  const cats: string[] = [];
  for (const p of publishedProducts) {
    const c = (p.category || '').trim();
    if (c && c.toLowerCase() !== 'all' && !seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      cats.push(c);
    }
  }
  return cats;
}

export function escapeXml(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeHtmlAttr(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildProductJsonLd(
  prod: ProductRecord,
  allProducts: ProductRecord[],
  baseUrl: string = VANTREL_CANONICAL_ORIGIN
): Record<string, unknown> {
  const seoSlug = getProductSeoSlug(prod, allProducts);
  const productUrl = `${baseUrl}/product/${encodeURIComponent(seoSlug)}`;
  const resolvedImages = resolveSeoProductImages(prod, VANTREL_CANONICAL_ORIGIN);
  const effectivePrice = Number(prod.discountPrice ?? prod.regularPrice ?? 0);
  const regularPrice = Number(prod.regularPrice ?? effectivePrice);
  const brandName = (prod.brand || 'VANTREL OUTFIT').trim();
  const inStock = Number(prod.totalStock ?? 0) > 0;
  const priceValidUntil = `${new Date().getFullYear() + 1}-12-31`;

  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url: productUrl,
    priceCurrency: 'BDT',
    price: effectivePrice,
    priceValidUntil,
    itemCondition: 'https://schema.org/NewCondition',
    availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    seller: {
      '@type': 'Organization',
      name: 'VANTREL OUTFIT',
      url: `${VANTREL_CANONICAL_ORIGIN}/`
    },
    shippingDetails: [
      {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: 0,
          currency: 'BDT'
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'BD',
          addressRegion: 'Dhaka'
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 0,
            maxValue: 1,
            unitCode: 'DAY'
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 2,
            unitCode: 'DAY'
          }
        }
      },
      {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: 50,
          currency: 'BDT'
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'BD'
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 0,
            maxValue: 1,
            unitCode: 'DAY'
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 2,
            maxValue: 4,
            unitCode: 'DAY'
          }
        }
      }
    ],
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'BD',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/FreeReturn'
    }
  };

  if (regularPrice > effectivePrice && effectivePrice > 0) {
    offer.priceSpecification = {
      '@type': 'UnitPriceSpecification',
      priceType: 'https://schema.org/StrikethroughPrice',
      priceCurrency: 'BDT',
      price: regularPrice
    };
  }

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: prod.name,
    url: productUrl,
    image:
      resolvedImages.length > 0
        ? resolvedImages
        : [`${VANTREL_CANONICAL_ORIGIN}/assets/images/vantrel-og-image.jpg`],
    description: (prod.description || prod.tagline || `${prod.name} by ${brandName}.`).replace(/\s+/g, ' ').trim(),
    sku: prod.sku || prod.id,
    mpn: prod.sku || prod.id,
    category: prod.category,
    brand: {
      '@type': 'Brand',
      name: brandName
    },
    offers: offer
  };

  if (prod.fabric) {
    schema.material = prod.gsm ? `${prod.fabric} (${prod.gsm} GSM)` : prod.fabric;
  }
  if (Array.isArray(prod.sizes) && prod.sizes.length > 0) {
    schema.size = prod.sizes.join(', ');
  }
  if (Array.isArray(prod.colors) && prod.colors.length > 0) {
    const colorNames = prod.colors.map((c) => c?.name).filter(Boolean);
    if (colorNames.length > 0) {
      schema.color = colorNames.join(', ');
    }
  }

  if ((prod.reviewCount ?? 0) > 0 && (prod.rating ?? 0) > 0) {
    const clampedRating = Number(Math.min(5, Math.max(1, Number(prod.rating))).toFixed(1));
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: clampedRating,
      reviewCount: Math.max(1, Math.round(Number(prod.reviewCount))),
      bestRating: 5,
      worstRating: 1
    };
  }

  if (Array.isArray(prod.reviews) && prod.reviews.length > 0) {
    const validReviews = prod.reviews
      .filter((r) => r && r.author && r.comment)
      .slice(0, 5)
      .map((r) => ({
        '@type': 'Review',
        author: {
          '@type': 'Person',
          name: String(r.author).trim()
        },
        ...(r.date ? { datePublished: String(r.date).trim() } : {}),
        reviewBody: String(r.comment).trim(),
        reviewRating: {
          '@type': 'Rating',
          ratingValue: Number(Math.min(5, Math.max(1, Number(r.rating || 5))).toFixed(1)),
          bestRating: 5,
          worstRating: 1
        }
      }));
    if (validReviews.length > 0) {
      schema.review = validReviews;
    }
  }

  return schema;
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url
    }))
  };
}

export function buildCategoryUrl(category: string, baseUrl: string = VANTREL_CANONICAL_ORIGIN): string {
  if (!category || category.toLowerCase() === 'all') return `${baseUrl}/shop`;
  return `${baseUrl}/category/${encodeURIComponent(getCategorySlug(category))}`;
}
