export const VANTREL_CANONICAL_ORIGIN = 'https://www.vantreloutfit.shop';
export const IMAGE_PROXY_ROUTE = '/api/image-proxy';

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
 * so we never double-wrap proxy URLs.
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
 * Rewrites any third-party / dropshipping image URL to the canonical VANTREL proxy URL:
 * https://www.vantreloutfit.shop/api/image-proxy?url=<encodedUrl>
 * Keeps local /assets/... paths, data:image/..., and blob:... intact.
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
    return cleanInner;
  }

  if (normalized.startsWith('/')) {
    return normalized;
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
  const proxied = rewriteToCanonicalProxyUrl(rawUrl, canonicalOrigin);
  if (!proxied) return '';
  if (proxied.startsWith('http://') || proxied.startsWith('https://') || proxied.startsWith('data:')) {
    return proxied;
  }
  return `${canonicalOrigin}${proxied.startsWith('/') ? '' : '/'}${proxied}`;
}

/**
 * Returns the runtime browser <img src> URL:
 * - On www.vantreloutfit.shop / vantreloutfit.shop: uses https://www.vantreloutfit.shop/api/image-proxy?url=...
 * - On local dev or AI Studio preview hosts: routes proxy requests via same-origin /api/image-proxy?url=...
 *   so proxied dropshipping images always load cleanly in preview without hitting an un-deployed remote host.
 */
export function toDisplayImageUrl(rawUrl: string): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
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
  if (isExternalThirdPartyImage(normalized, isBrowser ? window.location.host : undefined)) {
    const encoded = encodeURIComponent(normalized);
    return isOnCanonicalDomain || !isBrowser
      ? `${VANTREL_CANONICAL_ORIGIN}${IMAGE_PROXY_ROUTE}?url=${encoded}`
      : `${IMAGE_PROXY_ROUTE}?url=${encoded}`;
  }

  return normalized;
}

/**
 * Rewrites an array of product image URLs so all third-party/dropshipping links
 * are normalized with https://www.vantreloutfit.shop/api/image-proxy?url=
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
