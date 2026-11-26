import type { IncomingMessage, ServerResponse } from 'http';
import {
  VANTREL_CANONICAL_ORIGIN,
  resolveSeoProductImages,
  getProductSeoSlug,
  getCategorySlug
} from './_lib/seoUtils.js';
import {
  getLiveProducts,
  getPublishedProducts,
  getActiveCategories,
  escapeXml
} from './_lib/storeCatalog.js';

type VercelReq = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

export default async function handler(req: VercelReq, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  try {
    const allProducts = await getLiveProducts();
    const published = getPublishedProducts(allProducts);
    const categories = getActiveCategories(published);
    const todayIso = new Date().toISOString();

    const staticUrls = [
      { loc: `${VANTREL_CANONICAL_ORIGIN}/`, priority: '1.0', changefreq: 'daily' },
      { loc: `${VANTREL_CANONICAL_ORIGIN}/shop`, priority: '0.9', changefreq: 'daily' },
      { loc: `${VANTREL_CANONICAL_ORIGIN}/about`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${VANTREL_CANONICAL_ORIGIN}/contact`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${VANTREL_CANONICAL_ORIGIN}/faqs`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${VANTREL_CANONICAL_ORIGIN}/size-guide`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${VANTREL_CANONICAL_ORIGIN}/shipping-policy`, priority: '0.6', changefreq: 'monthly' },
      { loc: `${VANTREL_CANONICAL_ORIGIN}/return-policy`, priority: '0.6', changefreq: 'monthly' },
      { loc: `${VANTREL_CANONICAL_ORIGIN}/privacy-policy`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${VANTREL_CANONICAL_ORIGIN}/terms`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${VANTREL_CANONICAL_ORIGIN}/track`, priority: '0.6', changefreq: 'weekly' }
    ];

    const categoryXml = categories
      .map((cat) => {
        const catSlug = getCategorySlug(cat);
        return `  <url>
    <loc>${escapeXml(`${VANTREL_CANONICAL_ORIGIN}/category/${encodeURIComponent(catSlug)}`)}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`;
      })
      .join('\n');

    const productXml = published
      .map((prod) => {
        const seoSlug = getProductSeoSlug(prod, published);
        const prodUrl = `${VANTREL_CANONICAL_ORIGIN}/product/${encodeURIComponent(seoSlug)}`;
        const price = prod.discountPrice ?? prod.regularPrice;
        const lastMod = prod.createdDate ? new Date(prod.createdDate).toISOString() : todayIso;
        const images = resolveSeoProductImages(prod, VANTREL_CANONICAL_ORIGIN);
        const stripUrls = (s: string) => s.replace(/https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/gi, '').trim();
        const safeName = stripUrls(prod.name) || 'Apparel Item';
        const safeCat = stripUrls(prod.category);
        const safeCaption = stripUrls(prod.tagline || prod.description || safeName);

        const imageTags = images
          .slice(0, 5)
          .map(
            (imgUrl, idx) => `    <image:image>
      <image:loc>${escapeXml(imgUrl)}</image:loc>
      <image:title>${escapeXml(`Vantrel Outfit ${safeName}${safeCat ? ` - ${safeCat}` : ''}${idx > 0 ? ` (View ${idx + 1})` : ''}`)}</image:title>
      <image:caption>${escapeXml(`${safeCaption} - ৳${price} BDT`)}</image:caption>
    </image:image>`
          )
          .join('\n');

        return `  <url>
    <loc>${escapeXml(prodUrl)}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
${imageTags}
  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticUrls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
${categoryXml}
${productXml}
</urlset>
`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=180, s-maxage=300, stale-while-revalidate=600');
    res.setHeader('X-Robots-Tag', 'all');
    res.end(req.method === 'HEAD' ? undefined : xml);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(err instanceof Error ? err.message : 'Unable to generate sitemap');
  }
}
