import type { IncomingMessage, ServerResponse } from 'http';
import { getApps, getApp, initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getLiveProducts, readRepoTextFile } from './_lib/storeCatalog.js';
import { toCanonicalSeoImageUrl, VANTREL_CANONICAL_ORIGIN } from './_lib/seoUtils.js';

type VercelReq = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

const decodedCache = new Map<string, { contentType: string; buffer: Buffer; cachedAt: number }>();
const MAX_CACHE_ENTRIES = 120;

let sharpLoader: Promise<((input: Buffer) => any) | null> | null = null;
async function getSharp(): Promise<((input: Buffer) => any) | null> {
  if (!sharpLoader) {
    sharpLoader = import('sharp')
      .then((m) => (m.default || m) as unknown as (input: Buffer) => any)
      .catch(() => null);
  }
  return sharpLoader;
}

async function optimizeProductImageBuffer(
  rawBuffer: Buffer,
  contentType: string,
  targetWidth: number,
  wantsWebp: boolean
): Promise<{ buffer: Buffer; contentType: string }> {
  if (contentType.includes('svg') || contentType.includes('gif')) {
    return { buffer: rawBuffer, contentType };
  }
  if (!wantsWebp && !targetWidth) {
    return { buffer: rawBuffer, contentType };
  }
  try {
    const sharpFn = await getSharp();
    if (!sharpFn) return { buffer: rawBuffer, contentType };
    let pipeline = sharpFn(rawBuffer).rotate();
    if (targetWidth > 0) {
      pipeline = pipeline.resize({ width: targetWidth, withoutEnlargement: true });
    }
    if (wantsWebp) {
      const out = await pipeline.webp({ quality: 80, effort: 3 }).toBuffer();
      return { buffer: out, contentType: 'image/webp' };
    }
    const out = await pipeline.toBuffer();
    return { buffer: out, contentType };
  } catch {
    return { buffer: rawBuffer, contentType };
  }
}

function getQueryParam(req: VercelReq, key: string): string {
  const val = req.query?.[key];
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  if (req.url) {
    try {
      const parsed = new URL(req.url, VANTREL_CANONICAL_ORIGIN);
      return parsed.searchParams.get(key) || '';
    } catch {
      return '';
    }
  }
  return '';
}

function parseDataImageUri(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const contentType = match[1].toLowerCase();
  const base64Body = match[2].replace(/\s+/g, '');
  return {
    contentType,
    buffer: Buffer.from(base64Body, 'base64')
  };
}

function setCachedImage(key: string, value: { contentType: string; buffer: Buffer }) {
  if (decodedCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = decodedCache.keys().next().value;
    if (oldestKey) decodedCache.delete(oldestKey);
  }
  decodedCache.set(key, { ...value, cachedAt: Date.now() });
}

async function fetchProductImagesFallback(productId: string): Promise<string[] | null> {
  try {
    const rawCfg = readRepoTextFile('firebase-applet-config.json');
    if (!rawCfg) return null;
    const firebaseConfig = JSON.parse(rawCfg);
    if (!firebaseConfig?.projectId) return null;
    const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const firestoreDb = firebaseConfig.firestoreDatabaseId
      ? getFirestore(fbApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(fbApp);

    const snap = await Promise.race([
      getDoc(doc(firestoreDb, 'products', productId)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    if (!snap.exists()) return null;
    const data = snap.data() as { images?: unknown };
    return Array.isArray(data.images) ? (data.images as string[]) : null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelReq, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const productId = getQueryParam(req, 'id').trim();
  const idxRaw = parseInt(getQueryParam(req, 'idx') || '0', 10);
  const idx = Number.isFinite(idxRaw) && idxRaw >= 0 ? idxRaw : 0;
  const widthRaw = parseInt(getQueryParam(req, 'w') || '0', 10);
  const targetWidth = Number.isFinite(widthRaw) && widthRaw > 0 ? Math.min(1400, Math.max(120, widthRaw)) : 0;
  const acceptHeader = String(req.headers['accept'] || '').toLowerCase();
  const wantsWebp = acceptHeader.includes('image/webp') || acceptHeader.includes('image/avif') || targetWidth > 0;

  if (!productId) {
    res.statusCode = 400;
    res.end('Missing product id');
    return;
  }

  const cacheKey = `${productId}:${idx}:w=${targetWidth}:webp=${wantsWebp ? 1 : 0}`;
  const cached = decodedCache.get(cacheKey);
  if (cached) {
    res.statusCode = 200;
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Content-Length', String(cached.buffer.length));
    res.setHeader('Vary', 'Accept');
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=31536000, immutable');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(req.method === 'HEAD' ? undefined : cached.buffer);
    return;
  }

  try {
    const allProducts = await getLiveProducts();
    let target = allProducts.find((p) => p.id === productId || p.slug === productId);
    let images = target?.images;

    if (!images || !images[idx]) {
      const fallbackImages = await fetchProductImagesFallback(productId);
      if (fallbackImages) images = fallbackImages;
    }

    const src = images?.[idx] || images?.[0] || '';
    if (!src) {
      res.statusCode = 302;
      res.setHeader('Location', '/assets/images/vantrel-logo.webp');
      res.end();
      return;
    }

    if (src.startsWith('data:image/')) {
      const parsed = parseDataImageUri(src);
      if (parsed) {
        const optimized = await optimizeProductImageBuffer(parsed.buffer, parsed.contentType, targetWidth, wantsWebp);
        setCachedImage(cacheKey, optimized);
        res.statusCode = 200;
        res.setHeader('Content-Type', optimized.contentType);
        res.setHeader('Content-Length', String(optimized.buffer.length));
        res.setHeader('Vary', 'Accept');
        res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
        res.setHeader('CDN-Cache-Control', 'public, s-maxage=31536000, immutable');
        res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=31536000, immutable');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(req.method === 'HEAD' ? undefined : optimized.buffer);
        return;
      }
    }

    const resolvedUrl = src.startsWith('/') ? src : toCanonicalSeoImageUrl(src, VANTREL_CANONICAL_ORIGIN);
    res.statusCode = 302;
    res.setHeader('Location', resolvedUrl);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.end();
  } catch {
    res.statusCode = 302;
    res.setHeader('Location', '/assets/images/vantrel-logo.webp');
    res.end();
  }
}
