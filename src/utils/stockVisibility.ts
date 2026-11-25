import type { Product } from '../types';

export type OutOfStockBehavior = 'default' | 'show' | 'hide';
export type OutOfStockDefaultBehavior = 'show' | 'hide';

export function isProductOutOfStock(
  product?: Pick<Product, 'totalStock'> | null
): boolean {
  if (!product) return true;
  const stock = Number(product.totalStock ?? 0);
  return !Number.isFinite(stock) || stock <= 0;
}

export function resolveOutOfStockBehavior(
  product?: Pick<Product, 'outOfStockBehavior'> | null,
  defaultBehavior: OutOfStockDefaultBehavior = 'show'
): 'show' | 'hide' {
  if (product?.outOfStockBehavior === 'show' || product?.outOfStockBehavior === 'hide') {
    return product.outOfStockBehavior;
  }
  return defaultBehavior === 'hide' ? 'hide' : 'show';
}

export function isProductHiddenByOutOfStock(
  product?: Pick<Product, 'totalStock' | 'outOfStockBehavior'> | null,
  defaultBehavior: OutOfStockDefaultBehavior = 'show'
): boolean {
  if (!product) return true;
  if (!isProductOutOfStock(product)) return false;
  return resolveOutOfStockBehavior(product, defaultBehavior) === 'hide';
}

export function shouldHideProductFromPublic(
  product?: Pick<Product, 'isArchived' | 'status' | 'totalStock' | 'outOfStockBehavior'> | null,
  defaultBehavior: OutOfStockDefaultBehavior = 'show'
): boolean {
  if (!product) return true;
  if (product.isArchived || product.status === 'archived' || product.status === 'draft') {
    return true;
  }
  return isProductHiddenByOutOfStock(product, defaultBehavior);
}
