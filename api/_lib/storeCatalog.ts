import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import {
  VANTREL_CANONICAL_ORIGIN,
  type MinimalProductRecord,
  rewriteProductImagesToProxy,
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

const CACHE_TTL_MS = 60 * 1000;
let cachedProducts: ProductRecord[] | null = null;
let cachedOutOfStockDefaultBehavior: 'show' | 'hide' = 'show';
let cachedAt = 0;
let refreshPromise: Promise<ProductRecord[]> | null = null;

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

function normalizeProductsList(list: ProductRecord[]): ProductRecord[] {
  const normalized = list
    .filter((p) => p && !LEGACY_PRIMARY_PRODUCT_IDS.has(p.id))
    .map((p) => ({
      ...p,
      brand: p.brand || 'VANTREL OUTFIT',
      images: rewriteProductImagesToProxy(p.images),
      isArchived: Boolean(p.isArchived || p.status === 'archived')
    }));

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

async function refreshFromFirestoreBackground(): Promise<ProductRecord[]> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const firebaseConfig = readJsonFile<{
        apiKey?: string;
        authDomain?: string;
        projectId?: string;
        storageBucket?: string;
        messagingSenderId?: string;
        appId?: string;
        firestoreDatabaseId?: string;
      }>('firebase-applet-config.json');

      if (firebaseConfig && firebaseConfig.projectId) {
        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const db = firebaseConfig.firestoreDatabaseId
          ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
          : getFirestore(app);

        const [snapshot, storeDocSnap] = await Promise.race([
          Promise.all([
            getDocs(collection(db, 'products')),
            getDoc(doc(db, 'settings', 'store')).catch(() => null)
          ]),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore read timeout')), 2500)
          )
        ]);

        if (storeDocSnap && storeDocSnap.exists()) {
          const storeData = storeDocSnap.data() as Record<string, unknown>;
          cachedOutOfStockDefaultBehavior = storeData?.outOfStockDefaultBehavior === 'hide' ? 'hide' : 'show';
        }

        const remote: ProductRecord[] = [];
        snapshot.forEach((docSnap) => {
          if (LEGACY_PRIMARY_PRODUCT_IDS.has(docSnap.id)) return;
          const data = docSnap.data() as ProductRecord;
          remote.push({
            ...data,
            id: docSnap.id
          });
        });

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

  // Instant stale-while-revalidate: serve warm cache or local disk catalog in <2ms while syncing Firestore in background
  if (!forceRefresh) {
    if (cachedProducts && cachedProducts.length > 0) {
      cachedAt = now;
      void refreshFromFirestoreBackground();
      return cachedProducts;
    }
    const fallbackData = readJsonFile<ProductRecord[]>('data/products_store.json');
    if (Array.isArray(fallbackData) && fallbackData.length > 0) {
      cachedProducts = normalizeProductsList(fallbackData);
      cachedAt = now;
      void refreshFromFirestoreBackground();
      return cachedProducts;
    }
  }

  const fresh = await refreshFromFirestoreBackground();
  if (fresh.length > 0) return fresh;

  const fallbackData = readJsonFile<ProductRecord[]>('data/products_store.json');
  const fallbackList = Array.isArray(fallbackData) ? fallbackData : [];
  cachedProducts = normalizeProductsList(fallbackList);
  cachedAt = now;
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

  // 4. Fallback to direct Firestore document lookup (e.g. newly added products not yet in static JSON)
  try {
    const firebaseConfig = readJsonFile<{
      apiKey?: string;
      authDomain?: string;
      projectId?: string;
      storageBucket?: string;
      messagingSenderId?: string;
      appId?: string;
      firestoreDatabaseId?: string;
    }>('firebase-applet-config.json');

    if (firebaseConfig?.projectId) {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const db = firebaseConfig.firestoreDatabaseId
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(app);

      const snap = await Promise.race([
        getDoc(doc(db, 'products', cleanId)),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]);
      if (snap.exists()) {
        const data = snap.data() as { images?: unknown };
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
  const resolvedImages = (prod.images || [])
    .filter((img) => Boolean(img && typeof img === 'string'))
    .map((img) => toCanonicalSeoImageUrl(img, VANTREL_CANONICAL_ORIGIN));
  const effectivePrice = prod.discountPrice ?? prod.regularPrice;
  const brandName = (prod.brand || 'VANTREL OUTFIT').trim();

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: prod.name,
    url: productUrl,
    image: resolvedImages.length > 0 ? resolvedImages : [`${VANTREL_CANONICAL_ORIGIN}/assets/images/vantrel-og-image.jpg`],
    description: (prod.description || prod.tagline || `${prod.name} by ${brandName}.`).trim(),
    sku: prod.sku || prod.id,
    mpn: prod.sku || prod.id,
    category: prod.category,
    brand: {
      '@type': 'Brand',
      name: brandName
    },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'BDT',
      price: String(effectivePrice),
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      availability: (prod.totalStock ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'VANTREL OUTFIT'
      }
    }
  };

  if ((prod.reviewCount ?? 0) > 0 && (prod.rating ?? 0) > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(prod.rating),
      reviewCount: String(prod.reviewCount)
    };
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
