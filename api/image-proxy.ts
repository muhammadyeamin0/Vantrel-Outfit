import type { IncomingMessage, ServerResponse } from 'http';
import dns from 'dns/promises';
import net from 'net';

type VercelReq = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

type VercelRes = ServerResponse & {
  status?: (code: number) => VercelRes;
  json?: (body: unknown) => void;
  send?: (body: unknown) => void;
};

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ITEMS = 60;
const CACHE_MAX_ITEM_BYTES = 1.5 * 1024 * 1024;

interface CacheEntry {
  buffer: Buffer;
  contentType: string;
  etag: string;
  cachedAt: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry>();

function normalizeInputUrl(rawInput: string): string {
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
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function unwrapNestedProxyUrl(rawUrl: string): string | null {
  try {
    if (rawUrl.startsWith('/api/image-proxy')) {
      const parsed = new URL(rawUrl, 'https://www.vantreloutfit.shop');
      const inner = parsed.searchParams.get('url');
      return inner ? unwrapNestedProxyUrl(inner) || inner : null;
    }
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      const parsed = new URL(rawUrl);
      if (parsed.pathname === '/api/image-proxy') {
        const inner = parsed.searchParams.get('url');
        return inner ? unwrapNestedProxyUrl(inner) || inner : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isDisallowedIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip === '0.0.0.0') return true;
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd');
}

async function assertSafeUrl(targetUrl: string): Promise<URL> {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS image URLs are allowed');
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Internal hostnames are not allowed');
  }
  if (net.isIP(host)) {
    if (isDisallowedIp(host)) throw new Error('Private IPs are not allowed');
    return parsed;
  }
  const resolved = await dns.lookup(host, { all: true });
  if (!resolved || resolved.length === 0 || resolved.some((r) => isDisallowedIp(r.address))) {
    throw new Error('Resolved host points to a restricted address');
  }
  return parsed;
}

function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  if (buf.slice(4, 8).toString('ascii') === 'ftyp') return 'image/avif';
  const head = buf.slice(0, 200).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  return null;
}

async function fetchWithRetry(urlObj: URL): Promise<globalThis.Response> {
  const baseHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let resp = await fetch(urlObj.toString(), {
        method: 'GET',
        headers: baseHeaders,
        redirect: 'follow',
        signal: AbortSignal.timeout(14000)
      });

      if (resp.status === 401 || resp.status === 403) {
        resp = await fetch(urlObj.toString(), {
          method: 'GET',
          headers: {
            ...baseHeaders,
            Referer: `${urlObj.protocol}//${urlObj.host}/`
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(14000)
        });
      }

      if (resp.ok || (resp.status >= 400 && resp.status < 429 && resp.status !== 408)) {
        return resp;
      }
      lastErr = new Error(`Upstream returned ${resp.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upstream fetch failed');
}

function sendJsonError(res: VercelRes, statusCode: number, payload: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function writeProxyHeaders(res: VercelRes, contentType: string, contentLength: number, etag: string) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(contentLength));
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
  res.setHeader('CDN-Cache-Control', 'public, s-maxage=604800');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Robots-Tag', 'all');
  res.setHeader('X-Proxy-Host', 'www.vantreloutfit.shop');
}

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJsonError(res, 405, { success: false, error: 'Method not allowed' });
    return;
  }

  let rawUrlParam = '';
  const queryUrl = req.query?.url;
  if (typeof queryUrl === 'string') {
    rawUrlParam = queryUrl;
  } else if (Array.isArray(queryUrl) && typeof queryUrl[0] === 'string') {
    rawUrlParam = queryUrl[0];
  } else if (req.url) {
    try {
      const parsedReq = new URL(req.url, 'https://www.vantreloutfit.shop');
      rawUrlParam = parsedReq.searchParams.get('url') || '';
    } catch {
      rawUrlParam = '';
    }
  }

  rawUrlParam = rawUrlParam.trim();
  if (!rawUrlParam) {
    sendJsonError(res, 400, { success: false, error: 'Missing url query parameter' });
    return;
  }

  const unwrapped = unwrapNestedProxyUrl(rawUrlParam) || rawUrlParam;
  const targetUrl = normalizeInputUrl(unwrapped);

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    sendJsonError(res, 400, { success: false, error: 'Invalid image URL protocol' });
    return;
  }

  const now = Date.now();
  const cached = MEMORY_CACHE.get(targetUrl);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    MEMORY_CACHE.delete(targetUrl);
    MEMORY_CACHE.set(targetUrl, cached);
    writeProxyHeaders(res, cached.contentType, cached.buffer.length, cached.etag);
    if (req.headers['if-none-match'] === cached.etag) {
      res.statusCode = 304;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.end(req.method === 'HEAD' ? undefined : cached.buffer);
    return;
  }

  try {
    const safeUrl = await assertSafeUrl(targetUrl);
    const upstream = await fetchWithRetry(safeUrl);
    if (!upstream.ok) {
      sendJsonError(res, 502, {
        success: false,
        error: 'Unable to fetch upstream image',
        detail: `Upstream responded with status ${upstream.status}`
      });
      return;
    }

    const declaredLength = Number(upstream.headers.get('content-length') || '0');
    if (declaredLength > MAX_IMAGE_BYTES) {
      sendJsonError(res, 413, { success: false, error: 'Image too large' });
      return;
    }

    const arrayBuf = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      sendJsonError(res, 502, { success: false, error: 'Invalid or oversized image payload' });
      return;
    }

    let contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) {
      const sniffed = sniffImageMime(buffer);
      if (!sniffed) {
        sendJsonError(res, 502, {
          success: false,
          error: 'Upstream did not return a valid image',
          detail: contentType || 'unknown'
        });
        return;
      }
      contentType = sniffed;
    }

    const etag = `"vt-${Buffer.from(targetUrl).toString('base64url').slice(0, 16)}-${buffer.length}"`;
    if (buffer.length <= CACHE_MAX_ITEM_BYTES) {
      if (MEMORY_CACHE.size >= CACHE_MAX_ITEMS) {
        const oldestKey = MEMORY_CACHE.keys().next().value;
        if (oldestKey) MEMORY_CACHE.delete(oldestKey);
      }
      MEMORY_CACHE.set(targetUrl, { buffer, contentType, etag, cachedAt: now });
    }

    writeProxyHeaders(res, contentType, buffer.length, etag);
    res.statusCode = 200;
    res.end(req.method === 'HEAD' ? undefined : buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy fetch error';
    sendJsonError(res, 502, { success: false, error: 'Unable to proxy image', detail: message });
  }
}
