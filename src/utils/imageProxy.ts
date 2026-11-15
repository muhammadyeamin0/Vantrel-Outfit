import type React from 'react';

export const VANTREL_CANONICAL_ORIGIN = 'https://www.vantreloutfit.shop';
export const IMAGE_PROXY_ROUTE = '/api/image-proxy';
export const FALLBACK_PRODUCT_IMAGE = '/assets/images/product_premium_hoodie_1792588590406.webp';

/**
 * Normalizes raw third-party / dropshipping / Google Drive URLs before wrapping in the VANTREL image proxy.
 */
export function normalizeThirdPartyImageUrl(rawInput: string): string {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return '';

  // Support protocol-relative URLs (e.g. //ae01.alicdn.com/...)
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  // Convert Google Drive share links into direct lh3 image links first
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

  // Bare domain like cdn.example.com/path/img.jpg
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function isVantrelDomainHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === 'vantreloutfit.shop' || lower === 'www.vantreloutfit.shop' || lower.endsWith('.vantreloutfit.shop');
}

/**
 * If the given URL is already a VANTREL /api/image-proxy URL, extracts the inner upstream target URL
 * so we never double-proxy URLs.
 */
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

/**
 * Returns true if the URL points to an external third-party / dropshipping server
 * that should be proxied through vantreloutfit.shop/api/image-proxy.
 */
export function isExternalThirdPartyImage(rawUrl: string, currentHost?: string): boolean {
  const normalized = normalizeThirdPartyImageUrl(rawUrl);
  if (!normalized || normalized.startsWith('data:') || normalized.startsWith('blob:') || normalized.startsWith('/')) {
    return false;
  }
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.pathname === IMAGE_PROXY_ROUTE) {
      return false;
    }
    if (isVantrelDomainHostname(parsed.hostname)) {
      return false;
    }
    if (currentHost && parsed.host.toLowerCase() === currentHost.toLowerCase() && parsed.pathname.startsWith('/assets/')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Rewrites ANY product image URL (both third-party/dropshipping links AND local /assets/... paths)
 * so it carries the full canonical domain https://www.vantreloutfit.shop/... for Googlebot & Meta crawlers:
 * - Third-party URLs -> https://www.vantreloutfit.shop/api/image-proxy?url=<encodedUrl>
 * - Local /assets/... paths -> https://www.vantreloutfit.shop/assets/...
 */
export function rewriteToCanonicalProxyUrl(
  rawUrl: string,
  canonicalOrigin: string = VANTREL_CANONICAL_ORIGIN
): string {
  const normalized = normalizeThirdPartyImageUrl(rawUrl);
  if (!normalized) return '';

  if (normalized.startsWith('data:') || normalized.startsWith('blob:')) {
    return normalized;
  }

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

/**
 * Resolves any image URL (local or third-party) into a full canonical URL with domain vantreloutfit.shop
 * for Googlebot, Sitemap XML, Schema.org JSON-LD, Open Graph, and Merchant feeds.
 */
export function toCanonicalSeoImageUrl(
  rawUrl: string,
  canonicalOrigin: string = VANTREL_CANONICAL_ORIGIN
): string {
  return rewriteToCanonicalProxyUrl(rawUrl, canonicalOrigin);
}

/**
 * Returns the runtime browser <img src> URL:
 * - On www.vantreloutfit.shop / vantreloutfit.shop: uses full https://www.vantreloutfit.shop/api/image-proxy?url=...
 *   and https://www.vantreloutfit.shop/assets/...
 * - On local dev or AI Studio preview hosts: routes /api/image-proxy?url=... and /assets/... via the active preview server
 *   so every image loads smoothly with 200 OK during preview before/between Vercel deployments.
 */
export function toDisplayImageUrl(rawUrl: string): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return FALLBACK_PRODUCT_IMAGE;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const isBrowser = typeof window !== 'undefined' && Boolean(window.location?.hostname);
  const currentHost = isBrowser ? window.location.hostname.toLowerCase() : '';
  const isOnCanonicalDomain = isBrowser && isVantrelDomainHostname(currentHost);

  const unwrapped = unwrapProxyImageUrl(trimmed);
  if (unwrapped) {
    const cleanInner = normalizeThirdPartyImageUrl(unwrapped);
    const encoded = encodeURIComponent(cleanInner);
    return isOnCanonicalDomain || !isBrowser
      ? `${VANTREL_CANONICAL_ORIGIN}${IMAGE_PROXY_ROUTE}?url=${encoded}`
      : `${IMAGE_PROXY_ROUTE}?url=${encoded}`;
  }

  const normalized = normalizeThirdPartyImageUrl(trimmed);

  // Rewrite own domain /assets/... paths to relative /assets/... on preview hosts so local files load instantly
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const parsed = new URL(normalized);
      if (isVantrelDomainHostname(parsed.hostname)) {
        if (!isOnCanonicalDomain && isBrowser) {
          return `${parsed.pathname}${parsed.search}`;
        }
        return `${VANTREL_CANONICAL_ORIGIN}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      // fall through
    }
  }

  if (normalized.startsWith('/')) {
    return isOnCanonicalDomain ? `${VANTREL_CANONICAL_ORIGIN}${normalized}` : normalized;
  }

  if (isExternalThirdPartyImage(normalized, isBrowser ? window.location.host : undefined)) {
    const encoded = encodeURIComponent(normalized);
    return isOnCanonicalDomain || !isBrowser
      ? `${VANTREL_CANONICAL_ORIGIN}${IMAGE_PROXY_ROUTE}?url=${encoded}`
      : `${IMAGE_PROXY_ROUTE}?url=${encoded}`;
  }

  return normalized;
}

/**
 * Multi-stage image error fallback handler so slow/blocked dropshipping CDNs or proxy glitches
 * never leave broken image icons on the storefront:
 *  Stage 1: Unwrap proxy URL and retry direct upstream image once.
 *  Stage 2: Fall back to guaranteed local WebP product placeholder.
 */
export function handleProxyImageError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  const stage = img.dataset.proxyFallbackStage || '0';
  const currentSrc = img.getAttribute('src') || '';

  if (stage === '0') {
    const directUpstream = unwrapProxyImageUrl(currentSrc);
    if (directUpstream && directUpstream !== currentSrc) {
      img.dataset.proxyFallbackStage = '1';
      img.referrerPolicy = 'no-referrer';
      img.src = directUpstream;
      return;
    }
  }

  if (stage !== '2') {
    img.dataset.proxyFallbackStage = '2';
    img.src = FALLBACK_PRODUCT_IMAGE;
  }
}

/**
 * Rewrites an array of product image URLs so ALL product images (third-party & local assets)
 * are prefixed with https://www.vantreloutfit.shop/...
 */
export function rewriteProductImagesToProxy(images?: string[]): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const img of images) {
    if (!img || typeof img !== 'string') continue;
    const rewritten = rewriteToCanonicalProxyUrl(img);
    if (rewritten && !seen.has(rewritten)) {
      seen.add(rewritten);
      result.push(rewritten);
    }
  }
  return result;
}
