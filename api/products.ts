import type { IncomingMessage, ServerResponse } from 'http';
import { getLiveProducts } from './_lib/storeCatalog';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
    return;
  }

  try {
    const products = await getLiveProducts();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=300');
    res.setHeader('X-Robots-Tag', 'all');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(
      req.method === 'HEAD'
        ? undefined
        : JSON.stringify({ success: true, count: products.length, data: products })
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unable to load products'
      })
    );
  }
}
