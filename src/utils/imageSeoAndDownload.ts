import { toDisplayImageUrl } from './imageProxy';

export const SEO_BRAND_NAME = 'Vantrel Outfit';

/**
 * Removes any URLs (http://, https://, www., data:, blob:) so URLs never leak
 * into image alt attributes or downloaded filenames.
 */
export function stripUrlsFromText(input?: string | null): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  return raw
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, '')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '')
    .replace(/\bwww\.[^\s"'<>]+/gi, '')
    .replace(/\bblob:[^\s"'<>]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SeoImageAltOptions {
  name?: string;
  category?: string;
  brand?: string;
  context?: string;
  viewIndex?: number;
  fallback?: string;
}

/**
 * Generates descriptive, SEO-friendly alt text that always includes "Vantrel Outfit",
 * never contains URLs, and is guaranteed non-empty.
 */
export function buildSeoImageAlt(options: SeoImageAltOptions = {}): string {
  const cleanName = stripUrlsFromText(options.name);
  const cleanCategory = stripUrlsFromText(options.category);
  const cleanBrand = stripUrlsFromText(options.brand);
  const cleanContext = stripUrlsFromText(options.context);
  const cleanFallback = stripUrlsFromText(options.fallback);

  const normalizedBrand =
    !cleanBrand || /^vantrel(\s+outfit)?$/i.test(cleanBrand)
      ? SEO_BRAND_NAME
      : cleanBrand.toLowerCase().includes('vantrel')
      ? cleanBrand
      : `${SEO_BRAND_NAME} ${cleanBrand}`;

  const parts: string[] = [normalizedBrand];

  if (cleanName) {
    parts.push(cleanName);
  } else if (cleanContext) {
    parts.push(cleanContext);
  } else if (cleanFallback) {
    parts.push(cleanFallback);
  } else {
    parts.push('Apparel & Streetwear Collection');
  }

  let base = parts.join(' ').replace(/\s+/g, ' ').trim();

  if (cleanCategory && !base.toLowerCase().includes(cleanCategory.toLowerCase())) {
    base = `${base} - ${cleanCategory}`;
  }

  if (cleanName && cleanContext && !base.toLowerCase().includes(cleanContext.toLowerCase())) {
    base = `${base} (${cleanContext})`;
  }

  if (typeof options.viewIndex === 'number' && options.viewIndex > 0) {
    base = `${base} - View ${options.viewIndex + 1}`;
  }

  return base;
}

/**
 * Sanitizes an existing alt string so it never contains URLs, is never empty,
 * and always carries the "Vantrel Outfit" brand signal.
 */
export function sanitizeAltText(rawAlt?: string | null, fallbackContext?: string): string {
  const cleaned = stripUrlsFromText(rawAlt);
  const cleanedFallback = stripUrlsFromText(fallbackContext);

  if (!cleaned) {
    return buildSeoImageAlt({ context: cleanedFallback || 'Apparel & Fashion' });
  }

  if (cleaned.toLowerCase().includes('vantrel outfit')) {
    return cleaned;
  }

  if (/\bvantrel\b/i.test(cleaned)) {
    return cleaned.replace(/\bvantrel\b/i, SEO_BRAND_NAME);
  }

  return `${SEO_BRAND_NAME} ${cleaned}`.replace(/\s+/g, ' ').trim();
}

function getExtensionFromMime(mime: string): string {
  const lower = String(mime || '').toLowerCase().split(';')[0].trim();
  if (lower === 'image/webp') return 'webp';
  if (lower === 'image/png') return 'png';
  if (lower === 'image/gif') return 'gif';
  if (lower === 'image/avif') return 'avif';
  if (lower === 'image/svg+xml') return 'svg';
  if (lower === 'image/jpeg' || lower === 'image/jpg') return 'jpg';
  return '';
}

function getExtensionFromUrl(url: string): string {
  const clean = String(url || '').split('?')[0].split('#')[0].toLowerCase();
  const match = clean.match(/\.(webp|png|jpe?g|gif|avif|svg)$/i);
  if (!match?.[1]) return '';
  return match[1] === 'jpeg' ? 'jpg' : match[1];
}

async function fetchImageAsBlob(rawSrc: string): Promise<{ blob: Blob; ext: string }> {
  const trimmed = String(rawSrc || '').trim();
  if (!trimmed) {
    throw new Error('Empty image source');
  }

  const candidates: string[] = [];
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    candidates.push(trimmed);
  } else if (trimmed.startsWith('/')) {
    candidates.push(trimmed);
  } else {
    // Prefer same-origin proxy first for cross-origin URLs so CORS never blocks blob conversion,
    // with direct CORS fetch as fallback.
    const proxied = toDisplayImageUrl(trimmed, 1400);
    if (proxied && proxied !== trimmed) {
      candidates.push(proxied);
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      candidates.push(`/api/image-proxy?url=${encodeURIComponent(trimmed)}`);
      candidates.push(trimmed);
    }
  }

  let lastError: unknown = null;
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        mode: url.startsWith('http') ? 'cors' : 'same-origin',
        credentials: 'omit'
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Empty image payload');
      }
      const ext =
        getExtensionFromMime(blob.type) ||
        getExtensionFromUrl(trimmed) ||
        getExtensionFromUrl(url) ||
        'jpg';
      return { blob, ext };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to fetch image');
}

// ==========================================
// ZERO-DEPENDENCY ZIP ARCHIVE BUILDER (PKZIP Store)
// ==========================================
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntryInput {
  filename: string;
  data: Uint8Array;
}

export function createZipBlob(entries: ZipEntryInput[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.filename);
    const data = entry.data;
    const fileCrc = crc32(data);

    // Local File Header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local header signature
    lv.setUint16(4, 20, true); // Version needed (2.0)
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Compression method: 0 (Store)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, fileCrc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central header signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // Compression: Store
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, fileCrc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra length
    cv.setUint16(32, 0, true); // Comment length
    cv.setUint16(34, 0, true); // Disk number
    cv.setUint16(36, 0, true); // Internal attrs
    cv.setUint32(38, 0, true); // External attrs
    cv.setUint32(42, offset, true); // Relative offset of local header
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  let centralSize = 0;
  for (const part of centralParts) {
    centralSize += part.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const blobParts: BlobPart[] = [
    ...localParts.map((u) => new Uint8Array(u)),
    ...centralParts.map((u) => new Uint8Array(u)),
    new Uint8Array(eocd)
  ];

  return new Blob(blobParts, { type: 'application/zip' });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
}

export interface BatchDownloadResult {
  total: number;
  downloaded: number;
  failed: number;
  mode: 'zip' | 'sequential' | 'single';
  archiveName?: string;
}

/**
 * Downloads one or more images safely via fetch -> Blob -> download link,
 * renaming all files consistently to `vantrel-outfit-1.<ext>`, `vantrel-outfit-2.<ext>`, etc.
 * Multi-image batches default to `vantrel-outfit-images.zip` (or sequential individual downloads).
 */
export async function downloadBatchImages(
  imageSources: string[],
  options: {
    mode?: 'zip' | 'sequential';
    prefix?: string;
    zipFilename?: string;
  } = {}
): Promise<BatchDownloadResult> {
  const cleanSources = Array.from(
    new Set((imageSources || []).map((s) => String(s || '').trim()).filter(Boolean))
  );

  if (cleanSources.length === 0) {
    return { total: 0, downloaded: 0, failed: 0, mode: options.mode || 'zip' };
  }

  const rawPrefix = stripUrlsFromText(options.prefix || 'vantrel-outfit')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefix = rawPrefix || 'vantrel-outfit';

  const zipNameRaw = stripUrlsFromText(options.zipFilename || 'vantrel-outfit-images.zip')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-');
  const zipFilename = zipNameRaw.endsWith('.zip') ? zipNameRaw : `${zipNameRaw || 'vantrel-outfit-images'}.zip`;

  const resolvedBlobs: Array<{ filename: string; blob: Blob }> = [];
  let failed = 0;

  for (let i = 0; i < cleanSources.length; i++) {
    try {
      const { blob, ext } = await fetchImageAsBlob(cleanSources[i]);
      const seqNum = resolvedBlobs.length + 1;
      resolvedBlobs.push({
        filename: `${prefix}-${seqNum}.${ext}`,
        blob
      });
    } catch (err) {
      failed++;
      console.warn(`Image fetch failed for batch slot #${i + 1}:`, err);
    }
  }

  if (resolvedBlobs.length === 0) {
    throw new Error('Could not download any images. Please check network/image sources.');
  }

  // Single image -> download directly with consistent filename vantrel-outfit-1.<ext>
  if (resolvedBlobs.length === 1) {
    triggerBlobDownload(resolvedBlobs[0].blob, resolvedBlobs[0].filename);
    return {
      total: cleanSources.length,
      downloaded: 1,
      failed,
      mode: 'single',
      archiveName: resolvedBlobs[0].filename
    };
  }

  const requestedMode = options.mode || 'zip';

  if (requestedMode === 'sequential') {
    for (let i = 0; i < resolvedBlobs.length; i++) {
      const item = resolvedBlobs[i];
      triggerBlobDownload(item.blob, item.filename);
      if (i < resolvedBlobs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 220));
      }
    }
    return {
      total: cleanSources.length,
      downloaded: resolvedBlobs.length,
      failed,
      mode: 'sequential'
    };
  }

  const zipEntries: ZipEntryInput[] = await Promise.all(
    resolvedBlobs.map(async (item) => ({
      filename: item.filename,
      data: new Uint8Array(await item.blob.arrayBuffer())
    }))
  );

  const zipBlob = createZipBlob(zipEntries);
  triggerBlobDownload(zipBlob, zipFilename);

  return {
    total: cleanSources.length,
    downloaded: resolvedBlobs.length,
    failed,
    mode: 'zip',
    archiveName: zipFilename
  };
}
