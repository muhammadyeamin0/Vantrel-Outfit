import type { IncomingMessage, ServerResponse } from 'http';
import { getLiveProducts, type ProductRecord } from './_lib/storeCatalog.js';
import { rewriteProductImagesToProxy, slimProductForCatalog, findProductByUrlParam } from './_lib/seoUtils.js';
import { getRequestUrl, readJsonBody, sendJson, verifyAdminRequest } from './_lib/httpUtils.js';

let runtimeProductsOverlay: ProductRecord[] | null = null;

async function loadProductsSnapshot(): Promise<ProductRecord[]> {
  if (runtimeProductsOverlay) return runtimeProductsOverlay;
  const base = await getLiveProducts();
  runtimeProductsOverlay = [...base];
  return runtimeProductsOverlay;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const url = getRequestUrl(req);
  const idParam = (url.searchParams.get('id') || '').trim();
  const actionParam = (url.searchParams.get('action') || '').trim();
  const forceFresh = url.searchParams.get('fresh') === '1' || url.searchParams.get('refresh') === '1';
  const includeInline = url.searchParams.get('inline') === '1' || forceFresh;
  const pathname = url.pathname.replace(/\/+$/, '');

  // Handle single GET or list GET/HEAD (preserving crawler & public storefront contract)
  if (req.method === 'GET' || req.method === 'HEAD') {
    try {
      if (forceFresh) {
        runtimeProductsOverlay = await getLiveProducts(true);
      }
      const allProducts = await loadProductsSnapshot();

      if (idParam) {
        const found = findProductByUrlParam(idParam, allProducts);
        if (!found) {
          sendJson(res, 404, { success: false, error: 'Product not found' });
          return;
        }
        const payload = includeInline ? found : slimProductForCatalog(found);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
          'Cache-Control',
          forceFresh ? 'no-cache' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
        );
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ success: true, data: payload }));
        return;
      }

      const category = (url.searchParams.get('category') || '').trim();
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      let result = [...allProducts];

      if (category && category !== 'All') {
        result = result.filter((p) => (p.category || '').toLowerCase() === category.toLowerCase());
      }
      if (search) {
        result = result.filter(
          (p) =>
            (p.name || '').toLowerCase().includes(search) ||
            (p.sku || '').toLowerCase().includes(search) ||
            (p.description || '').toLowerCase().includes(search)
        );
      }

      const finalResult = includeInline ? result : result.map((p) => slimProductForCatalog(p));

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Cache-Control',
        forceFresh ? 'no-cache' : 'public, max-age=60, s-maxage=180, stale-while-revalidate=600'
      );
      res.setHeader('X-Robots-Tag', 'all');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(
        req.method === 'HEAD'
          ? undefined
          : JSON.stringify({ success: true, count: finalResult.length, data: finalResult })
      );
      return;
    } catch (err) {
      sendJson(res, 500, {
        success: false,
        error: err instanceof Error ? err.message : 'Unable to load products'
      });
      return;
    }
  }

  // Write operations (POST, PUT, DELETE) require verified Admin authentication in production
  const adminCheck = await verifyAdminRequest(req);
  if (!adminCheck.authorized) {
    sendJson(res, 401, {
      success: false,
      error: 'Unauthorized: Verified Google Admin session required'
    });
    return;
  }

  try {
    const current = await loadProductsSnapshot();

    if (req.method === 'POST' && (actionParam === 'recalculate-prices' || pathname.endsWith('/recalculate-prices'))) {
      runtimeProductsOverlay = current.map((p) => {
        const currentCost =
          typeof (p as Record<string, unknown>).costPrice === 'number' &&
          Number((p as Record<string, unknown>).costPrice) > 0
            ? Math.round(Number((p as Record<string, unknown>).costPrice))
            : Math.max(0, Math.round((p.discountPrice ?? p.regularPrice ?? 0) - 220));
        const sellingPrice = currentCost + 220;
        const regularPrice = sellingPrice + 200;
        const discountPercent =
          regularPrice > 0 ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100) : 0;
        return {
          ...p,
          costPrice: currentCost,
          discountPrice: sellingPrice,
          regularPrice,
          discountPercent
        } as ProductRecord;
      });
      sendJson(res, 200, {
        success: true,
        count: runtimeProductsOverlay.length,
        data: runtimeProductsOverlay
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(req);
      if (!body.name || body.regularPrice === undefined || !body.sku) {
        sendJson(res, 400, { success: false, error: 'Name, regularPrice, and SKU are required' });
        return;
      }

      const newProd: ProductRecord = {
        ...(body as unknown as ProductRecord),
        id: String(body.id || `prod-vt-${Date.now()}`),
        name: String(body.name),
        sku: String(body.sku),
        regularPrice: Number(body.regularPrice),
        totalStock: Number(body.totalStock ?? 50),
        images: rewriteProductImagesToProxy(Array.isArray(body.images) ? (body.images as string[]) : [])
      };

      const existingIdx = current.findIndex((p) => p.id === newProd.id);
      if (existingIdx >= 0) {
        current[existingIdx] = { ...current[existingIdx], ...newProd };
      } else {
        current.unshift(newProd);
      }
      runtimeProductsOverlay = current;
      sendJson(res, 201, { success: true, message: 'Product synced', data: newProd });
      return;
    }

    if (req.method === 'PUT') {
      const targetId = idParam || pathname.split('/').pop() || '';
      const body = await readJsonBody<Record<string, unknown>>(req);
      if (!targetId) {
        sendJson(res, 400, { success: false, error: 'Product ID required' });
        return;
      }

      const idx = current.findIndex((p) => p.id === targetId);
      const nextBody = { ...body };
      if (Array.isArray(nextBody.images)) {
        nextBody.images = rewriteProductImagesToProxy(nextBody.images as string[]);
      }

      if (idx >= 0) {
        current[idx] = { ...current[idx], ...(nextBody as Partial<ProductRecord>) };
        runtimeProductsOverlay = current;
        sendJson(res, 200, { success: true, data: current[idx] });
      } else {
        const upserted = { id: targetId, ...(nextBody as Partial<ProductRecord>) } as ProductRecord;
        current.unshift(upserted);
        runtimeProductsOverlay = current;
        sendJson(res, 200, { success: true, data: upserted });
      }
      return;
    }

    if (req.method === 'DELETE') {
      const targetId = idParam || (pathname !== '/api/products' && pathname !== '/api/product' ? pathname.split('/').pop() || '' : '');
      if (targetId) {
        const nextList = current.filter((p) => p.id !== targetId);
        runtimeProductsOverlay = nextList;
        sendJson(res, 200, { success: true, message: 'Product deleted' });
      } else {
        const count = current.length;
        runtimeProductsOverlay = [];
        sendJson(res, 200, { success: true, deletedCount: count });
      }
      return;
    }

    sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  } catch (err) {
    sendJson(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : 'Server error'
    });
  }
}
