import type { Product } from '../types';

export function toCleanSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates a unique, deterministic, SEO-friendly slug for every product.
 * If multiple products share the same base slug (e.g., duplicate drop names),
 * appends the last 4 characters of product.id so every product gets a unique URL.
 */
export function getProductSeoSlug(product: Pick<Product, 'id' | 'name' | 'slug'>, allProducts?: Array<Pick<Product, 'id' | 'name' | 'slug'>>): string {
  const baseSlug = toCleanSlug(product.slug || product.name || product.id) || toCleanSlug(product.id) || 'product';
  if (!allProducts || allProducts.length === 0) {
    return baseSlug;
  }

  const sameSlugCount = allProducts.filter((p) => {
    const pBase = toCleanSlug(p.slug || p.name || p.id);
    return pBase === baseSlug;
  }).length;

  if (sameSlugCount > 1) {
    const idTail = toCleanSlug(product.id).slice(-4);
    return idTail && !baseSlug.endsWith(`-${idTail}`) ? `${baseSlug}-${idTail}` : baseSlug;
  }

  return baseSlug;
}

/**
 * Resolves a product from either a unique SEO slug, raw slug, disambiguated slug, or product ID.
 */
export function findProductByUrlParam<T extends Pick<Product, 'id' | 'name' | 'slug'>>(
  param: string,
  allProducts: T[]
): T | undefined {
  const raw = String(param || '').trim();
  if (!raw || !Array.isArray(allProducts)) return undefined;

  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();

  const exactId = allProducts.find((p) => p.id === decoded);
  if (exactId) return exactId;

  const exactSeoSlug = allProducts.find((p) => getProductSeoSlug(p, allProducts) === decoded);
  if (exactSeoSlug) return exactSeoSlug;

  const cleanedTarget = toCleanSlug(decoded);
  const exactRawSlug = allProducts.find((p) => p.slug === decoded || toCleanSlug(p.slug || '') === cleanedTarget);
  if (exactRawSlug) return exactRawSlug;

  return allProducts.find((p) => toCleanSlug(p.name) === cleanedTarget);
}

export function getCategorySlug(category: string): string {
  const clean = toCleanSlug(category);
  return clean || 'all';
}

export function findCategoryBySlug(slug: string, categories: string[]): string | undefined {
  const cleaned = toCleanSlug(slug);
  if (!cleaned || cleaned === 'all') return 'All';
  return categories.find((cat) => getCategorySlug(cat) === cleaned);
}
