import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import type { Product } from '../../src/types';
import {
  VANTREL_CANONICAL_ORIGIN,
  rewriteProductImagesToProxy,
  toCanonicalSeoImageUrl
} from '../../src/utils/imageProxy';
import { getProductSeoSlug, getCategorySlug } from '../../src/utils/seoSlug';
import firebaseConfig from '../../firebase-applet-config.json';
import fallbackProductsData from '../../data/products_store.json';

const LEGACY_PRIMARY_PRODUCT_IDS = new Set([
  'prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005',
  'prod-006', 'prod-007', 'prod-008', 'prod-009', 'prod-010',
  'prod-011', 'prod-012', 'prod-013', 'prod-014', 'prod-015',
  'prod-016', 'prod-017', 'prod-018', 'prod-019', 'prod-overcoat-005'
]);

const CACHE_TTL_MS = 120 * 1000;
let cachedProducts: Product[] | null = null;
let cachedAt = 0;

function normalizeProductsList(list: Product[]): Product[] {
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

export async function getLiveProducts(forceRefresh = false): Promise<Product[]> {
  const now = Date.now();
  if (!forceRefresh && cachedProducts && now - cachedAt < CACHE_TTL_MS) {
    return cachedProducts;
  }

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);

    const snapshot = await Promise.race([
      getDocs(collection(db, 'products')),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore read timeout')), 3500)
      )
    ]);

    const remote: Product[] = [];
    snapshot.forEach((docSnap) => {
      if (LEGACY_PRIMARY_PRODUCT_IDS.has(docSnap.id)) return;
      const data = docSnap.data() as Product;
      remote.push({
        ...data,
        id: docSnap.id
      });
    });

    if (remote.length > 0) {
      cachedProducts = normalizeProductsList(remote);
      cachedAt = now;
      return cachedProducts;
    }
  } catch (err) {
    console.warn('[VANTREL SEO] Firestore live fetch fallback to bundled store:', err instanceof Error ? err.message : err);
  }

  const fallbackList = Array.isArray(fallbackProductsData)
    ? (fallbackProductsData as unknown as Product[])
    : [];
  cachedProducts = normalizeProductsList(fallbackList);
  cachedAt = now;
  return cachedProducts;
}

export function getPublishedProducts(allProducts: Product[]): Product[] {
  return allProducts.filter((p) => !p.isArchived && p.status !== 'archived');
}

export function getActiveCategories(publishedProducts: Product[]): string[] {
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

export function buildProductJsonLd(prod: Product, allProducts: Product[], baseUrl: string = VANTREL_CANONICAL_ORIGIN): Record<string, unknown> {
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
    image: resolvedImages.length > 0 ? resolvedImages : [`${VANTREL_CANONICAL_ORIGIN}/assets/images/vantrel-logo.png`],
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

  if (prod.reviewCount > 0 && prod.rating > 0) {
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
