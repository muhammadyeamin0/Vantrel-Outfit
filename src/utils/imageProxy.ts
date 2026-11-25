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
 * - Always prefers same-origin relative /api/image-proxy, /api/product-image, and /assets/...
 *   in the browser so HTTP/2 multiplexing reuses the active connection with zero extra DNS/TLS latency.
 * - Outside browser (SSR), resolves with VANTREL_CANONICAL_ORIGIN.
 */
export function toDisplayImageUrl(rawUrl: string, targetWidth?: number): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return FALLBACK_PRODUCT_IMAGE;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const isBrowser = typeof window !== 'undefined' && Boolean(window.location?.hostname);

  const appendWidth = (url: string): string => {
    if (!targetWidth || targetWidth <= 0) return url;
    if (
      (url.includes(IMAGE_PROXY_ROUTE) || url.includes('/api/product-image')) &&
      !/[?&]w=\d+/.test(url)
    ) {
      return `${url}${url.includes('?') ? '&' : '?'}w=${Math.round(targetWidth)}`;
    }
    return url;
  };

  const unwrapped = unwrapProxyImageUrl(trimmed);
  if (unwrapped) {
    const cleanInner = normalizeThirdPartyImageUrl(unwrapped);
    const encoded = encodeURIComponent(cleanInner);
    return appendWidth(
      isBrowser
        ? `${IMAGE_PROXY_ROUTE}?url=${encoded}`
        : `${VANTREL_CANONICAL_ORIGIN}${IMAGE_PROXY_ROUTE}?url=${encoded}`
    );
  }

  const normalized = normalizeThirdPartyImageUrl(trimmed);

  // Rewrite own domain /assets/... & /api/... paths to relative paths in the browser for instant HTTP/2 reuse
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const parsed = new URL(normalized);
      if (isVantrelDomainHostname(parsed.hostname)) {
        const baseResolved = isBrowser
          ? `${parsed.pathname}${parsed.search}`
          : `${VANTREL_CANONICAL_ORIGIN}${parsed.pathname}${parsed.search}`;
        return appendWidth(baseResolved);
      }
    } catch {
      // fall through
    }
  }

  if (normalized.startsWith('/')) {
    return appendWidth(isBrowser ? normalized : `${VANTREL_CANONICAL_ORIGIN}${normalized}`);
  }

  if (isExternalThirdPartyImage(normalized, isBrowser ? window.location.host : undefined)) {
    const encoded = encodeURIComponent(normalized);
    return appendWidth(
      isBrowser
        ? `${IMAGE_PROXY_ROUTE}?url=${encoded}`
        : `${VANTREL_CANONICAL_ORIGIN}${IMAGE_PROXY_ROUTE}?url=${encoded}`
    );
  }

  return appendWidth(normalized);
}

/**
 * Generates responsive srcset entries (e.g. 320w, 480w, 900w) for proxied or server-resized images
 * so mobile cards download compact WebPs (~10-18KB) instead of oversized desktop images.
 */
export function buildResponsiveImageSrcSet(rawUrl: string, widths: number[]): string | undefined {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || widths.length === 0) {
    return undefined;
  }
  const baseUrl = toDisplayImageUrl(trimmed);
  if (!baseUrl.includes(IMAGE_PROXY_ROUTE) && !baseUrl.includes('/api/product-image')) {
    return undefined;
  }
  return widths
    .map((w) => `${toDisplayImageUrl(trimmed, w)} ${Math.round(w)}w`)
    .join(', ');
}

const preloadedImageSet = new Set<string>();

/**
 * Silently warms the browser cache for high-res product detail photos on card hover/touch
 * or secondary gallery angles so opening ProductDetailPage feels instantaneous.
 */
export function preloadProductImage(rawUrl?: string, targetWidth: number = 900): void {
  if (typeof window === 'undefined' || !rawUrl) return;
  const resolved = toDisplayImageUrl(rawUrl, targetWidth);
  if (!resolved || resolved.startsWith('data:') || resolved.startsWith('blob:')) return;
  if (preloadedImageSet.has(resolved)) return;
  if (preloadedImageSet.size >= 80) {
    const first = preloadedImageSet.values().next().value;
    if (first) preloadedImageSet.delete(first);
  }
  preloadedImageSet.add(resolved);
  const img = new window.Image();
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.src = resolved;
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
      img.removeAttribute('srcset');
      img.referrerPolicy = 'no-referrer';
      img.src = directUpstream;
      return;
    }
  }

  if (stage !== '2') {
    img.dataset.proxyFallbackStage = '2';
    img.removeAttribute('srcset');
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
