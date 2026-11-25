import type { IncomingMessage, ServerResponse } from 'http';
import { getLiveProducts, applyLiveProductsCache, type ProductRecord } from './_lib/storeCatalog.js';
import { rewriteProductImagesToProxy, slimProductForCatalog, findProductByUrlParam } from './_lib/seoUtils.js';
import { getRequestUrl, readJsonBody, sendJson, verifyAdminRequest } from './_lib/httpUtils.js';

let runtimeProductsOverlay: ProductRecord[] | null = null;
let overlayExpiresAt = 0;

async function loadProductsSnapshot(forceRefresh = false): Promise<ProductRecord[]> {
  const now = Date.now();
  if (!forceRefresh && runtimeProductsOverlay && now < overlayExpiresAt) {
    return runtimeProductsOverlay;
  }
  const base = await getLiveProducts(forceRefresh);
  runtimeProductsOverlay = [...base];
  overlayExpiresAt = now + 20 * 1000;
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
      const allProducts = await loadProductsSnapshot(forceFresh);

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
        forceFresh ? 'no-cache' : 'public, max-age=15, s-maxage=30, stale-while-revalidate=60'
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
      sendJson(res, 410, {
        success: false,
        error: 'Automatic cost-based price recalculation is disabled to preserve custom product prices.'
      });
      return;
    }

    const applyApiCostMarkup = <T extends Record<string, unknown>>(item: T): T => {
      const rawCost = typeof item.costPrice === 'number' ? item.costPrice : Number(item.costPrice);
      if (Number.isFinite(rawCost) && rawCost > 0) {
        const cleanCost = Math.round(rawCost);
        const sellingPrice = cleanCost + 220;
        const regularPrice = sellingPrice + 200;
        const discountPercent =
          regularPrice > 0 ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100) : 0;
        return {
          ...item,
          costPrice: cleanCost,
          discountPrice: sellingPrice,
          regularPrice,
          discountPercent
        };
      }
      return item;
    };

    if (req.method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(req);
      if (!body.name || body.regularPrice === undefined || !body.sku) {
        sendJson(res, 400, { success: false, error: 'Name, regularPrice, and SKU are required' });
        return;
      }

      const newProd: ProductRecord = applyApiCostMarkup({
        ...(body as unknown as ProductRecord),
        id: String(body.id || `prod-vt-${Date.now()}`),
        name: String(body.name),
        sku: String(body.sku),
        regularPrice: Number(body.regularPrice),
        totalStock: body.totalStock !== undefined && body.totalStock !== null ? Math.max(0, Number(body.totalStock)) : 50,
        outOfStockBehavior:
          body.outOfStockBehavior === 'hide' || body.outOfStockBehavior === 'show'
            ? body.outOfStockBehavior
            : 'default',
        images: rewriteProductImagesToProxy(Array.isArray(body.images) ? (body.images as string[]) : [])
      });

      const existingIdx = current.findIndex((p) => p.id === newProd.id);
      if (existingIdx >= 0) {
        current[existingIdx] = applyApiCostMarkup({ ...current[existingIdx], ...newProd });
      } else {
        current.unshift(newProd);
      }
      runtimeProductsOverlay = current;
      overlayExpiresAt = Date.now() + 20 * 1000;
      applyLiveProductsCache(current);
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
      if (nextBody.totalStock !== undefined && nextBody.totalStock !== null) {
        nextBody.totalStock = Math.max(0, Number(nextBody.totalStock));
      }
      if (Array.isArray(nextBody.images)) {
        nextBody.images = rewriteProductImagesToProxy(nextBody.images as string[]);
      }

      if (idx >= 0) {
        const merged = { ...current[idx], ...(nextBody as Partial<ProductRecord>) } as ProductRecord & Record<string, unknown>;
        if (nextBody.discountPrice === null) delete merged.discountPrice;
        if (nextBody.discountPercent === null) delete merged.discountPercent;
        current[idx] = applyApiCostMarkup(merged);
        runtimeProductsOverlay = current;
        overlayExpiresAt = Date.now() + 20 * 1000;
        applyLiveProductsCache(current);
        sendJson(res, 200, { success: true, data: current[idx] });
      } else {
        const upserted = { id: targetId, ...(nextBody as Partial<ProductRecord>) } as ProductRecord & Record<string, unknown>;
        if (nextBody.discountPrice === null) delete upserted.discountPrice;
        if (nextBody.discountPercent === null) delete upserted.discountPercent;
        const normalizedUpserted = applyApiCostMarkup(upserted);
        current.unshift(normalizedUpserted);
        runtimeProductsOverlay = current;
        overlayExpiresAt = Date.now() + 20 * 1000;
        applyLiveProductsCache(current);
        sendJson(res, 200, { success: true, data: normalizedUpserted });
      }
      return;
    }

    if (req.method === 'DELETE') {
      const targetId = idParam || (pathname !== '/api/products' && pathname !== '/api/product' ? pathname.split('/').pop() || '' : '');
      if (targetId) {
        const nextList = current.filter((p) => p.id !== targetId);
        runtimeProductsOverlay = nextList;
        overlayExpiresAt = Date.now() + 20 * 1000;
        applyLiveProductsCache(nextList);
        sendJson(res, 200, { success: true, message: 'Product deleted' });
      } else {
        const count = current.length;
        runtimeProductsOverlay = [];
        overlayExpiresAt = Date.now() + 20 * 1000;
        applyLiveProductsCache([]);
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
