import { toDisplayImageUrl, unwrapProxyImageUrl, isVantrelDomainHostname, VANTREL_CANONICAL_ORIGIN } from './imageProxy';

export const PRODUCT_WEBP_MAX_WIDTH = 1000;
export const BANNER_WEBP_MAX_WIDTH = 1400;
export const DEFAULT_WEBP_QUALITY = 0.8;
export const DEFAULT_MAX_DATA_URL_LENGTH = 240_000;

export interface WebpConvertOptions {
  maxWidth?: number;
  quality?: number;
  maxDataUrlLength?: number;
  timeoutMs?: number;
}

/**
 * Checks whether an image URL or Data URI is already in WebP (or vector/animated GIF that should not be rasterized).
 */
export function isWebpImageSource(rawSrc: string): boolean {
  const trimmed = String(rawSrc || '').trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('data:image/webp') ||
    lower.startsWith('data:image/svg+xml') ||
    lower.startsWith('data:image/gif')
  ) {
    return true;
  }

  if (lower.startsWith('data:image/')) {
    return false;
  }

  const candidate = unwrapProxyImageUrl(trimmed) || trimmed;
  try {
    const parsed = new URL(candidate, 'https://www.vantreloutfit.shop');
    const pathLower = parsed.pathname.toLowerCase();
    if (pathLower.endsWith('.webp') || pathLower.endsWith('.svg') || pathLower.endsWith('.gif')) {
      return true;
    }
    const stp = (parsed.searchParams.get('stp') || '').toLowerCase();
    const fm = (parsed.searchParams.get('fm') || parsed.searchParams.get('format') || '').toLowerCase();
    if (stp.includes('dst-webp') || fm === 'webp') {
      return true;
    }
  } catch {
    const cleanPath = candidate.split(/[?#]/)[0].toLowerCase();
    if (cleanPath.endsWith('.webp') || cleanPath.endsWith('.svg') || cleanPath.endsWith('.gif')) {
      return true;
    }
  }

  return false;
}

/**
 * Renders an already-loaded HTMLImageElement onto an offscreen Canvas,
 * proportionally capping width at `maxWidth`, and exports as `image/webp`.
 */
export function convertImageElementToWebpDataUrl(
  img: HTMLImageElement,
  options?: WebpConvertOptions
): string | null {
  const maxWidth = options?.maxWidth ?? PRODUCT_WEBP_MAX_WIDTH;
  const quality = options?.quality ?? DEFAULT_WEBP_QUALITY;
  const maxDataUrlLength = options?.maxDataUrlLength ?? DEFAULT_MAX_DATA_URL_LENGTH;

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  if (!naturalWidth || !naturalHeight) return null;

  const renderPass = (passMaxWidth: number, passQuality: number): string | null => {
    let width = naturalWidth;
    let height = naturalHeight;
    if (width > passMaxWidth) {
      const ratio = passMaxWidth / width;
      width = passMaxWidth;
      height = Math.max(1, Math.round(naturalHeight * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, width, height);
    const out = canvas.toDataURL('image/webp', passQuality);
    if (!out || !out.startsWith('data:image/webp')) {
      return null;
    }
    return out;
  };

  try {
    let webp = renderPass(maxWidth, quality);
    if (!webp) return null;

    if (maxDataUrlLength > 0 && webp.length > maxDataUrlLength) {
      const step1 = renderPass(maxWidth, Math.min(quality, 0.68));
      if (step1) webp = step1;
    }
    if (maxDataUrlLength > 0 && webp.length > maxDataUrlLength) {
      const step2 = renderPass(Math.min(maxWidth, 820), 0.6);
      if (step2) webp = step2;
    }
    if (maxDataUrlLength > 0 && webp.length > maxDataUrlLength) {
      const step3 = renderPass(Math.min(maxWidth, 680), 0.5);
      if (step3) webp = step3;
    }
    return webp;
  } catch {
    // Handles SecurityError from tainted canvases cleanly
    return null;
  }
}

/**
 * Converts a browser File (from file picker, drag & drop, or paste) into a resized WebP Data URL.
 */
export function convertFileToWebpDataUrl(file: File, options?: WebpConvertOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const isImageMime = file.type.startsWith('image/');
    const isImageExt = /\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(file.name);
    if (!isImageMime && !isImageExt) {
      reject(new Error(`Unsupported file type: ${file.name}`));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result;
      if (typeof rawDataUrl !== 'string' || !rawDataUrl) {
        reject(new Error(`Empty image data: ${file.name}`));
        return;
      }

      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        resolve(rawDataUrl);
        return;
      }

      const img = new Image();
      img.onerror = () => {
        resolve(rawDataUrl);
      };
      img.onload = () => {
        const converted = convertImageElementToWebpDataUrl(img, {
          maxWidth: options?.maxWidth ?? PRODUCT_WEBP_MAX_WIDTH,
          quality: options?.quality ?? DEFAULT_WEBP_QUALITY,
          maxDataUrlLength: options?.maxDataUrlLength ?? DEFAULT_MAX_DATA_URL_LENGTH
        });
        if (!converted) {
          resolve(rawDataUrl);
          return;
        }
        // If already WebP and original is smaller & already within width limit, keep the smaller payload
        const alreadyWebp = file.type === 'image/webp' && (img.naturalWidth || img.width) <= (options?.maxWidth ?? PRODUCT_WEBP_MAX_WIDTH);
        if (alreadyWebp && rawDataUrl.length < converted.length) {
          resolve(rawDataUrl);
          return;
        }
        resolve(converted);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Checks if a local `/assets/...` non-WebP file already has a pre-generated `.webp` sibling on the server.
 */
export async function tryResolveLocalWebpSibling(rawSrc: string): Promise<string | null> {
  const trimmed = String(rawSrc || '').trim();
  if (!trimmed || typeof window === 'undefined') return null;

  let pathname = '';
  let hadCanonicalOrigin = false;

  if (trimmed.startsWith('/assets/')) {
    pathname = trimmed.split(/[?#]/)[0];
  } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (isVantrelDomainHostname(parsed.hostname) && parsed.pathname.startsWith('/assets/')) {
        pathname = parsed.pathname;
        hadCanonicalOrigin = true;
      }
    } catch {
      return null;
    }
  }

  if (!pathname || !/\.(png|jpe?g|bmp)$/i.test(pathname)) {
    return null;
  }

  const webpPath = pathname.replace(/\.(png|jpe?g|bmp)$/i, '.webp');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(webpPath, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('image/webp') || (!ct.includes('text/html') && ct.startsWith('image/'))) {
      return hadCanonicalOrigin ? `${VANTREL_CANONICAL_ORIGIN}${webpPath}` : webpPath;
    }
  } catch {
    return null;
  }
  return null;
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

/**
 * Attempts to convert any non-WebP image URL or Data URL to a resized `.webp` link or WebP Data URL
 * using Browser Canvas. Returns `null` if already WebP or if CORS / network / decode fails (safe skip).
 */
export async function convertImageSourceToWebp(
  rawSrc: string,
  options?: WebpConvertOptions
): Promise<string | null> {
  const trimmed = String(rawSrc || '').trim();
  if (!trimmed || trimmed.startsWith('blob:') || isWebpImageSource(trimmed)) {
    return null;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  // 1. Fast path: local `/assets/...` `.webp` sibling
  const localSibling = await tryResolveLocalWebpSibling(trimmed);
  if (localSibling) {
    return localSibling;
  }

  const maxWidth = options?.maxWidth ?? PRODUCT_WEBP_MAX_WIDTH;
  const quality = options?.quality ?? DEFAULT_WEBP_QUALITY;
  const maxDataUrlLength = options?.maxDataUrlLength ?? DEFAULT_MAX_DATA_URL_LENGTH;
  const timeoutMs = options?.timeoutMs ?? 7000;

  // 2. Inline base64 / Data URL conversion
  if (trimmed.startsWith('data:image/')) {
    try {
      const img = await loadImageFromSrc(trimmed);
      return convertImageElementToWebpDataUrl(img, { maxWidth, quality, maxDataUrlLength });
    } catch {
      return null;
    }
  }

  // 3. Remote / proxied URL fetch + CORS-safe ObjectURL -> Canvas conversion
  const displayUrl = toDisplayImageUrl(trimmed);
  if (!displayUrl || displayUrl.startsWith('blob:')) return null;

  let objectUrl = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(displayUrl, {
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal
    });
    if (!res.ok) return null;

    const blob = await res.blob();
    if (!blob || blob.size === 0 || blob.size > 12 * 1024 * 1024) {
      return null;
    }
    if (blob.type === 'image/svg+xml' || blob.type === 'image/gif') {
      return null;
    }

    objectUrl = URL.createObjectURL(blob);
    const img = await loadImageFromSrc(objectUrl);
    return convertImageElementToWebpDataUrl(img, { maxWidth, quality, maxDataUrlLength });
  } catch {
    // Silently skip CORS / network / abort errors as requested
    return null;
  } finally {
    clearTimeout(timer);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
