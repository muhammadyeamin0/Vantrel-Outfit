export const VANTREL_CANONICAL_ORIGIN = 'https://www.vantreloutfit.shop';
export const IMAGE_PROXY_ROUTE = '/api/image-proxy';

export interface MinimalProductRecord {
  id: string;
  name: string;
  slug?: string;
  category: string;
  subCategory?: string;
  brand?: string;
  sku?: string;
  tagline?: string;
  description?: string;
  fabric?: string;
  gsm?: number;
  sizes?: string[];
  images?: string[];
  regularPrice: number;
  discountPrice?: number;
  totalStock?: number;
  rating?: number;
  reviewCount?: number;
  status?: string;
  isArchived?: boolean;
  outOfStockBehavior?: 'default' | 'show' | 'hide' | string;
  isPinned?: boolean;
  sortOrder?: number;
  createdDate?: string;
  [key: string]: unknown;
}

export function normalizeThirdPartyImageUrl(rawInput: string): string {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;

  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (driveFileMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}`;
  }
  const driveOpenMatch = trimmed.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([^&#]+)/i);
  if (driveOpenMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${driveOpenMatch[1]}`;
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function isVantrelDomainHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === 'vantreloutfit.shop' || lower === 'www.vantreloutfit.shop' || lower.endsWith('.vantreloutfit.shop');
}

export function unwrapProxyImageUrl(rawUrl: string): string | null {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith(IMAGE_PROXY_ROUTE)) {
      const parsed = new URL(trimmed, VANTREL_CANONICAL_ORIGIN);
      const inner = parsed.searchParams.get('url');
      return inner ? unwrapProxyImageUrl(inner) || inner : null;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsed = new URL(trimmed);
      if (parsed.pathname === IMAGE_PROXY_ROUTE) {
        const inner = parsed.searchParams.get('url');
        return inner ? unwrapProxyImageUrl(inner) || inner : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function isExternalThirdPartyImage(rawUrl: string): boolean {
  const normalized = normalizeThirdPartyImageUrl(rawUrl);
  if (!normalized || normalized.startsWith('data:') || normalized.startsWith('blob:') || normalized.startsWith('/')) {
    return false;
  }
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    return false;
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.pathname === IMAGE_PROXY_ROUTE) return false;
    if (isVantrelDomainHostname(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function toCanonicalSeoImageUrl(
  rawUrl: string,
  canonicalOrigin: string = VANTREL_CANONICAL_ORIGIN
): string {
  const normalized = normalizeThirdPartyImageUrl(rawUrl);
  if (!normalized) return '';
  if (normalized.startsWith('data:') || normalized.startsWith('blob:')) return normalized;

  const unwrapped = unwrapProxyImageUrl(normalized);
  if (unwrapped) {
    const cleanInner = normalizeThirdPartyImageUrl(unwrapped);
    if (isExternalThirdPartyImage(cleanInner)) {
      return `${canonicalOrigin}${IMAGE_PROXY_ROUTE}?url=${encodeURIComponent(cleanInner)}`;
    }
    if (cleanInner.startsWith('/')) {
      return `${canonicalOrigin}${cleanInner}`;
    }
    return cleanInner;
  }

  if (normalized.startsWith('/')) {
    return `${canonicalOrigin}${normalized}`;
  }

  if (isExternalThirdPartyImage(normalized)) {
    return `${canonicalOrigin}${IMAGE_PROXY_ROUTE}?url=${encodeURIComponent(normalized)}`;
  }

  return normalized;
}

export function rewriteProductImagesToProxy(images?: string[]): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const img of images) {
    if (!img || typeof img !== 'string') continue;
    const rewritten = toCanonicalSeoImageUrl(img);
    if (rewritten && !seen.has(rewritten)) {
      seen.add(rewritten);
      result.push(rewritten);
    }
  }
  return result;
}

function fastStringFingerprint(input: string): string {
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(input.length / 64));
  for (let i = 0; i < input.length; i += step) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${input.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

export function slimProductForCatalog<T extends MinimalProductRecord>(prod: T): T {
  if (!prod || !Array.isArray(prod.images) || prod.images.length === 0) return prod;
  let hasDataUri = false;
  const slimImages = prod.images.map((img, idx) => {
    if (typeof img === 'string' && img.startsWith('data:image/')) {
      hasDataUri = true;
      return `/api/product-image?id=${encodeURIComponent(prod.id)}&idx=${idx}&h=${fastStringFingerprint(img)}`;
    }
    return img;
  });
  if (!hasDataUri) return prod;
  return {
    ...prod,
    images: slimImages
  };
}

export function toCleanSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getProductSeoSlug(
  product: Pick<MinimalProductRecord, 'id' | 'name' | 'slug'>,
  allProducts?: Array<Pick<MinimalProductRecord, 'id' | 'name' | 'slug'>>
): string {
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

export function findProductByUrlParam<T extends Pick<MinimalProductRecord, 'id' | 'name' | 'slug'>>(
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
