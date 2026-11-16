import { Product, ProductCategory } from '../types';

function normalizeCatText(value: string): string {
  return (value || '').trim().toLowerCase();
}

export function doesProductMatchCategory(product: Product, category: ProductCategory): boolean {
  const catKey = normalizeCatText(category);
  if (!catKey || catKey === 'all') return true;

  const pCat = normalizeCatText(product.category);
  const pSub = normalizeCatText(product.subCategory || '');
  const pName = normalizeCatText(product.name);
  const pTags = (product.tags || []).map((t) => normalizeCatText(t));

  if (pCat === catKey || pSub === catKey) return true;

  // Handle standard singular/plural category naming equivalences cleanly
  const singularCat = catKey.replace(/s$/, '');
  const singularPCat = pCat.replace(/s$/, '');
  if (singularCat && singularCat === singularPCat) return true;

  if (catKey.includes('sweeter') || catKey.includes('sweater')) {
    return pCat.includes('sweater') || pCat.includes('sweeter') || pName.includes('sweater');
  }
  if (catKey.includes('pant') || catKey.includes('jogger') || catKey.includes('trouser')) {
    return (
      pCat.includes('pant') ||
      pCat.includes('jogger') ||
      pCat.includes('trouser') ||
      pCat.includes('jean') ||
      pCat.includes('denim')
    );
  }
  if (catKey.includes('polo')) {
    return pCat.includes('polo') || pTags.includes('polo');
  }
  if (catKey.includes('hoodie')) {
    return pCat.includes('hoodie');
  }
  if (catKey.includes('t-shirt') || catKey.includes('tshirt')) {
    return pCat.includes('t-shirt') || pCat.includes('tee') || pCat.includes('drop shoulder');
  }
  if (catKey.includes('shirt')) {
    return pCat.includes('shirt') && !pCat.includes('t-shirt') && !pCat.includes('sweatshirt');
  }
  if (catKey.includes('panjabi') || catKey.includes('traditional')) {
    return pCat.includes('panjabi') || pCat.includes('traditional');
  }
  if (catKey.includes('winter')) {
    return (
      pCat.includes('winter') ||
      pCat.includes('hoodie') ||
      pCat.includes('jacket') ||
      pCat.includes('sweater') ||
      pCat.includes('sweatshirt')
    );
  }

  return pCat.includes(catKey) || (catKey.length > 3 && pSub.includes(catKey));
}

export function getProductsForCategory(category: ProductCategory, products: Product[]): Product[] {
  const active = products.filter(
    (p) => !p.isArchived && p.status !== 'archived' && Array.isArray(p.images) && p.images.length > 0
  );

  const catKey = normalizeCatText(category);
  const exact = active.filter((p) => normalizeCatText(p.category) === catKey);
  if (exact.length > 0) return exact;

  return active.filter((p) => doesProductMatchCategory(p, category));
}

export function sortProductsByBestScore(items: Product[]): Product[] {
  return [...items].sort((a, b) => {
    // 1. Admin manually picked showcase product for this category section
    if (Boolean(a.isCategoryShowcase) !== Boolean(b.isCategoryShowcase)) {
      return a.isCategoryShowcase ? -1 : 1;
    }
    // 2. Pinned product
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return a.isPinned ? -1 : 1;
    }
    // 3. Best seller flag
    if (Boolean(a.isBestSeller) !== Boolean(b.isBestSeller)) {
      return a.isBestSeller ? -1 : 1;
    }
    // 4. Top Product / Popular highlight
    if (Boolean(a.isTopProduct) !== Boolean(b.isTopProduct)) {
      return a.isTopProduct ? -1 : 1;
    }
    // 5. Highest rating & review count
    const ratingDiff = (b.rating || 0) - (a.rating || 0);
    if (Math.abs(ratingDiff) > 0.05) return ratingDiff;

    const reviewDiff = (b.reviewCount || 0) - (a.reviewCount || 0);
    if (reviewDiff !== 0) return reviewDiff;

    // 6. Admin custom sortOrder
    const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 9999;
    const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 9999;
    if (orderA !== orderB) return orderA - orderB;

    return 0;
  });
}

export function findBestProductForCategory(category: ProductCategory, products: Product[]): Product | undefined {
  const matching = getProductsForCategory(category, products);
  if (matching.length === 0) return undefined;
  return sortProductsByBestScore(matching)[0];
}

export interface HomepageShowcaseCard {
  category: ProductCategory;
  title: string;
  bestProduct: Product;
  image: string;
}

export function getHomepageShowcaseCategories(
  categories: ProductCategory[],
  products: Product[],
  maxCards = 4
): HomepageShowcaseCard[] {
  const activeCats = categories.filter((c) => c && c !== 'All');
  const results: HomepageShowcaseCard[] = [];

  for (const cat of activeCats) {
    if (results.length >= maxCards) break;
    const bestProd = findBestProductForCategory(cat, products);
    if (bestProd && bestProd.images?.[0]) {
      results.push({
        category: cat,
        title: cat.toUpperCase(),
        bestProduct: bestProd,
        image: bestProd.images[0]
      });
    }
  }

  return results;
}
