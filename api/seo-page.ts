import type { IncomingMessage, ServerResponse } from 'http';
import {
  VANTREL_CANONICAL_ORIGIN,
  toCanonicalSeoImageUrl,
  resolveSeoProductImages,
  findProductByUrlParam,
  findCategoryBySlug,
  getProductSeoSlug,
  getCategorySlug,
  slimProductForCatalog
} from './_lib/seoUtils.js';
import {
  getLiveProducts,
  getPublishedProducts,
  getActiveCategories,
  escapeHtmlAttr,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
  buildCategoryUrl,
  readRepoTextFile
} from './_lib/storeCatalog.js';

type VercelReq = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

let cachedShellHtml: string | null = null;
let cachedShellAt = 0;
const SHELL_CACHE_MS = 5 * 60 * 1000;

const SOCIAL_PREVIEW_BOT_REGEX =
  /facebookexternalhit|Facebot|meta-externalagent|meta-externalfetcher|WhatsApp|TelegramBot|Discordbot|Slackbot|Twitterbot|LinkedInBot|Pinterest|Viber|Line|Snapchat|redditbot|SkypeUriPreview|vkShare|Embedly/i;

const SEARCH_CRAWLER_BOT_REGEX =
  /bot|crawler|spider|crawling|googlebot|google-inspectiontool|googleother|google-read-aloud|duplexweb-google|adsbot-google|storebot-google|mediapartners-google|bingbot|slurp|duckduckbot|baiduspider|yandex|applebot|gptbot|chatgpt-user|oai-searchbot|claudebot|anthropic-ai|perplexitybot|chrome-lighthouse|lighthouse|pagespeed|gtmetrix|headlesschrome/i;

async function getAppShellHtml(req: VercelReq): Promise<string | null> {
  const now = Date.now();
  if (cachedShellHtml && now - cachedShellAt < SHELL_CACHE_MS) {
    return cachedShellHtml;
  }

  // 1. Prefer reading built dist/index.html directly from bundle (zero network latency)
  const localDistHtml = readRepoTextFile('dist/index.html');
  if (localDistHtml && localDistHtml.includes('<div id="root">')) {
    cachedShellHtml = localDistHtml;
    cachedShellAt = now;
    return localDistHtml;
  }

  // 2. Fallback to fetching static /index.html from host / canonical origin
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'www.vantreloutfit.shop';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const candidates = [`${proto}://${host}/index.html`, `${VANTREL_CANONICAL_ORIGIN}/index.html`];

  for (const url of candidates) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const text = await resp.text();
        if (text.includes('<div id="root">')) {
          cachedShellHtml = text;
          cachedShellAt = now;
          return text;
        }
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
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

function truncateSeoText(text: string, maxLen: number): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 3).trim()}...`;
}

function inferImageMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
  return '';
}

export default async function handler(req: VercelReq, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const defaultOgImage = `${VANTREL_CANONICAL_ORIGIN}/assets/images/vantrel-og-image.jpg`;
  const userAgent = String(req.headers['user-agent'] || '');
  const isSocialLinkPreviewBot = SOCIAL_PREVIEW_BOT_REGEX.test(userAgent);

  try {
    const routeParam = getQueryParam(req, 'route').toLowerCase();
    const slugParam = getQueryParam(req, 'slug');
    const legacyProductParam =
      getQueryParam(req, 'product') || getQueryParam(req, 'productId') || getQueryParam(req, 'id');
    const categoryQueryParam = getQueryParam(req, 'category');

    const allProducts = await getLiveProducts();
    const published = getPublishedProducts(allProducts);
    const categories = getActiveCategories(published);

    let statusCode = 200;
    let title = 'VANTREL OUTFIT — Premium Streetwear & Fashion Bangladesh';
    let description =
      'Shop heavyweight 420 GSM hoodies, oversized luxury tees, Panjabis, shirts, and denim at VANTREL OUTFIT. Free delivery in Dhaka & Cash on Delivery nationwide.';
    let canonicalUrl = `${VANTREL_CANONICAL_ORIGIN}/`;
    let ogType = 'website';
    let ogImage = defaultOgImage;
    let ogImageAlt = 'VANTREL OUTFIT Official Storefront';
    let robotsContent = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
    const isCrawlerAgent = isSocialLinkPreviewBot || SEARCH_CRAWLER_BOT_REGEX.test(userAgent);
    let extraHeadMeta = '';
    let jsonLdPayloads: Record<string, unknown>[] = [];
    let ssrRootHtml = '';
    let focusedSsrProducts = published.slice(0, 16);

    const productLookupParam = routeParam === 'product' ? slugParam : legacyProductParam;

    if (routeParam === 'product' || productLookupParam) {
      const matchedProduct = findProductByUrlParam(productLookupParam, published);

      if (!matchedProduct) {
        statusCode = 404;
        title = 'Product Not Found | VANTREL OUTFIT';
        description =
          'The requested product could not be found. Browse our latest apparel collection at VANTREL OUTFIT.';
        canonicalUrl = `${VANTREL_CANONICAL_ORIGIN}/shop`;
        robotsContent = 'noindex, follow';
        ssrRootHtml = `<main style="max-width:960px;margin:40px auto;padding:24px;font-family:sans-serif;">
  <h1>Product Not Found</h1>
  <p>The requested garment is no longer available in our catalog.</p>
  <a href="/shop">Browse All Products at VANTREL OUTFIT</a>
</main>`;
      } else {
        const seoSlug = getProductSeoSlug(matchedProduct, published);
        const effectivePrice = matchedProduct.discountPrice ?? matchedProduct.regularPrice;
        const hasDiscount =
          typeof matchedProduct.discountPrice === 'number' &&
          matchedProduct.discountPrice < matchedProduct.regularPrice;
        const inStock = (matchedProduct.totalStock ?? 0) > 0;
        const brandName = (matchedProduct.brand || 'VANTREL OUTFIT').trim();
        const catUrl = buildCategoryUrl(matchedProduct.category);
        const prodUrl = `${VANTREL_CANONICAL_ORIGIN}/product/${encodeURIComponent(seoSlug)}`;
        const images = resolveSeoProductImages(matchedProduct, VANTREL_CANONICAL_ORIGIN);

        const primaryImg = images[0] || defaultOgImage;
        const rawDesc =
          matchedProduct.description ||
          matchedProduct.tagline ||
          `Buy ${matchedProduct.name} by ${brandName} for ৳${effectivePrice} BDT. ${matchedProduct.fabric ? `${matchedProduct.fabric}. ` : ''}Free delivery in Dhaka & Cash on Delivery across Bangladesh.`;

        title = `${matchedProduct.name} — ৳${effectivePrice} | ${brandName}`;
        description = truncateSeoText(rawDesc, 158);
        canonicalUrl = prodUrl;
        ogType = 'product';
        ogImage = primaryImg;
        ogImageAlt = `${matchedProduct.name} - ${matchedProduct.category} by ${brandName}`;

        extraHeadMeta = `
  <meta property="product:brand" content="${escapeHtmlAttr(brandName)}" />
  <meta property="product:price:amount" content="${effectivePrice}" />
  <meta property="product:price:currency" content="BDT" />
  <meta property="product:availability" content="${inStock ? 'in stock' : 'out of stock'}" />
  <meta property="product:condition" content="new" />`;

        jsonLdPayloads = [
          buildProductJsonLd(matchedProduct, published, VANTREL_CANONICAL_ORIGIN),
          buildBreadcrumbJsonLd([
            { name: 'Home', url: `${VANTREL_CANONICAL_ORIGIN}/` },
            { name: matchedProduct.category, url: catUrl },
            { name: matchedProduct.name, url: prodUrl }
          ])
        ];

        const related = published
          .filter((p) => p.id !== matchedProduct.id && p.category === matchedProduct.category)
          .slice(0, 8);
        focusedSsrProducts = [matchedProduct, ...related];

        ssrRootHtml = `<main style="max-width:1100px;margin:0 auto;padding:24px;font-family:sans-serif;color:#f5f5f5;background:#0a0a0a;">
  <nav aria-label="Breadcrumb">
    <a href="/">Home</a> / <a href="${escapeHtmlAttr(catUrl)}">${escapeHtmlAttr(matchedProduct.category)}</a> / <span>${escapeHtmlAttr(matchedProduct.name)}</span>
  </nav>
  <h1>${escapeHtmlAttr(matchedProduct.name)}</h1>
  <p>Brand: <strong>${escapeHtmlAttr(brandName)}</strong> | Category: <a href="${escapeHtmlAttr(catUrl)}">${escapeHtmlAttr(matchedProduct.category)}</a> | SKU: <span>${escapeHtmlAttr(matchedProduct.sku || matchedProduct.id)}</span></p>
  <div>
    <p>Price: <strong>৳<span>${effectivePrice.toLocaleString()}</span> BDT</strong>${hasDiscount ? ` <del>৳${matchedProduct.regularPrice.toLocaleString()} BDT</del>` : ''}</p>
    <p>Availability: <strong>${inStock ? `In Stock (${matchedProduct.totalStock} available)` : 'Out of Stock'}</strong></p>
  </div>
  <div>
    ${(images.length > 0 ? images : [primaryImg])
      .map((imgUrl, idx) => {
        const cleanName = matchedProduct.name.replace(/https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/gi, '').trim() || 'Apparel Item';
        const cleanCat = matchedProduct.category.replace(/https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/gi, '').trim();
        const altStr = `Vantrel Outfit ${cleanName}${cleanCat ? ` - ${cleanCat}` : ''}${idx > 0 ? ` View ${idx + 1}` : ''}`;
        return `<img src="${escapeHtmlAttr(imgUrl)}" alt="${escapeHtmlAttr(altStr)}" />`;
      })
      .join('\n    ')}
  </div>
  <section>
    <h2>Product Description</h2>
    <p>${escapeHtmlAttr(rawDesc)}</p>
    ${matchedProduct.fabric ? `<p>Fabric: ${escapeHtmlAttr(matchedProduct.fabric)}${matchedProduct.gsm ? ` (${matchedProduct.gsm} GSM)` : ''}</p>` : ''}
    ${matchedProduct.sizes?.length ? `<p>Available Sizes: ${escapeHtmlAttr(matchedProduct.sizes.join(', '))}</p>` : ''}
    <p>Delivery: Free delivery inside Dhaka City (৳0). All 63 districts: ৳50 Cash on Delivery.</p>
  </section>
  ${
    related.length > 0
      ? `<section>
    <h2>Related ${escapeHtmlAttr(matchedProduct.category)}</h2>
    <ul>
      ${related
        .map((r) => {
          const rSlug = getProductSeoSlug(r, published);
          const rPrice = r.discountPrice ?? r.regularPrice;
          return `<li><a href="/product/${encodeURIComponent(rSlug)}">${escapeHtmlAttr(r.name)} — ৳${rPrice} BDT</a></li>`;
        })
        .join('\n      ')}
    </ul>
  </section>`
      : ''
  }
</main>`;
      }
    } else if (routeParam === 'category' || routeParam === 'shop' || routeParam === 'products' || categoryQueryParam) {
      const matchedCategory = slugParam
        ? findCategoryBySlug(slugParam, categories) || slugParam
        : categoryQueryParam || 'All';
      const isAll = !matchedCategory || matchedCategory.toLowerCase() === 'all';
      const catProducts = isAll
        ? published
        : published.filter(
            (p) =>
              p.category.toLowerCase() === matchedCategory.toLowerCase() ||
              getCategorySlug(p.category) === getCategorySlug(matchedCategory)
          );

      const displayCat = isAll ? 'All Collections' : matchedCategory;
      canonicalUrl = isAll ? `${VANTREL_CANONICAL_ORIGIN}/shop` : buildCategoryUrl(matchedCategory);
      title = isAll
        ? 'Shop All Streetwear, Hoodies, Tees & Panjabis | VANTREL OUTFIT'
        : `${displayCat} Collection in Bangladesh (${catProducts.length} Items) | VANTREL OUTFIT`;
      description = isAll
        ? `Explore ${published.length}+ genuine VANTREL OUTFIT garments including hoodies, oversized t-shirts, panjabis, shirts & pants. Free Dhaka delivery.`
        : `Shop authentic ${displayCat} online in Bangladesh at VANTREL OUTFIT. ${catProducts.length} live styles in stock with Free Dhaka delivery & ৳50 nationwide COD.`;

      const leadImage = catProducts[0]?.images?.[0]
        ? toCanonicalSeoImageUrl(catProducts[0].images[0], VANTREL_CANONICAL_ORIGIN)
        : ogImage;
      ogImage = leadImage;
      ogImageAlt = `${displayCat} - VANTREL OUTFIT`;
      focusedSsrProducts = catProducts.slice(0, 20);

      jsonLdPayloads = [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title,
          url: canonicalUrl,
          description,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: catProducts.length,
            itemListElement: catProducts.slice(0, 24).map((p, idx) => ({
              '@type': 'ListItem',
              position: idx + 1,
              url: `${VANTREL_CANONICAL_ORIGIN}/product/${encodeURIComponent(getProductSeoSlug(p, published))}`,
              name: p.name
            }))
          }
        },
        buildBreadcrumbJsonLd([
          { name: 'Home', url: `${VANTREL_CANONICAL_ORIGIN}/` },
          ...(isAll
            ? [{ name: 'Shop', url: `${VANTREL_CANONICAL_ORIGIN}/shop` }]
            : [
                { name: 'Shop', url: `${VANTREL_CANONICAL_ORIGIN}/shop` },
                { name: displayCat, url: canonicalUrl }
              ])
        ])
      ];

      ssrRootHtml = `<main style="max-width:1100px;margin:0 auto;padding:24px;font-family:sans-serif;color:#f5f5f5;background:#0a0a0a;">
  <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a>${isAll ? '' : ` / <span>${escapeHtmlAttr(displayCat)}</span>`}</nav>
  <h1>${escapeHtmlAttr(displayCat)} — VANTREL OUTFIT</h1>
  <p>${escapeHtmlAttr(description)}</p>
  <ul>
    ${catProducts
      .slice(0, 60)
      .map((p) => {
        const pSlug = getProductSeoSlug(p, published);
        const pPrice = p.discountPrice ?? p.regularPrice;
        const pImg = p.images?.[0] ? toCanonicalSeoImageUrl(p.images[0], VANTREL_CANONICAL_ORIGIN) : '';
        const pAlt = `Vantrel Outfit ${p.name.replace(/https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/gi, '').trim() || 'Apparel Item'}${p.category ? ` - ${p.category.replace(/https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/gi, '').trim()}` : ''}`;
        return `<li>
      <a href="/product/${encodeURIComponent(pSlug)}">
        ${pImg ? `<img src="${escapeHtmlAttr(pImg)}" alt="${escapeHtmlAttr(pAlt)}" />` : ''}
        <span>${escapeHtmlAttr(p.name)}</span> — <strong>৳${pPrice} BDT</strong> (${(p.totalStock ?? 0) > 0 ? 'In Stock' : 'Out of Stock'})
      </a>
    </li>`;
      })
      .join('\n    ')}
  </ul>
</main>`;
    } else if (routeParam && routeParam !== 'home') {
      const infoMap: Record<string, { title: string; desc: string; path: string }> = {
        about: {
          title: 'About VANTREL OUTFIT — Craftsmanship & Narrative',
          desc: 'Born in Bangladesh, VANTREL bridges architectural tailoring with contemporary street culture. Heavyweight 260–420 GSM fabrics and direct pricing.',
          path: '/about'
        },
        contact: {
          title: 'Contact Us | VANTREL OUTFIT Support',
          desc: 'Reach VANTREL OUTFIT customer support for sizing advice, order updates, and wholesale inquiries in Bangladesh.',
          path: '/contact'
        },
        faqs: {
          title: 'FAQs & Size Guide | VANTREL OUTFIT',
          desc: 'Find exact chest, length, and sleeve sizing measurements plus answers on Cash on Delivery and exchanges at VANTREL OUTFIT.',
          path: '/faqs'
        },
        'size-guide': {
          title: 'Garment Size Guide | VANTREL OUTFIT',
          desc: 'Check exact garment measurements in inches and centimeters for oversized t-shirts, hoodies, panjabis, and pants at VANTREL OUTFIT.',
          path: '/size-guide'
        },
        'shipping-policy': {
          title: 'Shipping & Delivery Policy | VANTREL OUTFIT',
          desc: 'Free delivery inside Dhaka City (৳0). All 63 districts flat ৳50 Cash on Delivery across Bangladesh.',
          path: '/shipping-policy'
        },
        'return-policy': {
          title: '7-Day Exchange & Return Policy | VANTREL OUTFIT',
          desc: 'Enjoy a hassle-free 7-day size replacement and exchange policy on every garment ordered from VANTREL OUTFIT.',
          path: '/return-policy'
        },
        'privacy-policy': {
          title: 'Privacy Policy | VANTREL OUTFIT',
          desc: 'Read how VANTREL OUTFIT protects your personal delivery information and order security.',
          path: '/privacy-policy'
        },
        terms: {
          title: 'Terms & Conditions | VANTREL OUTFIT',
          desc: 'Review the official terms of service, pricing, and delivery policies for VANTREL OUTFIT Bangladesh.',
          path: '/terms'
        },
        track: {
          title: 'Live Order Tracking | VANTREL OUTFIT',
          desc: 'Track your VANTREL OUTFIT parcel status live across Dhaka and all 64 districts of Bangladesh.',
          path: '/track'
        }
      };
      const info = infoMap[routeParam];
      if (info) {
        title = info.title;
        description = info.desc;
        canonicalUrl = `${VANTREL_CANONICAL_ORIGIN}${info.path}`;
        ssrRootHtml = `<main style="max-width:960px;margin:0 auto;padding:24px;font-family:sans-serif;color:#f5f5f5;background:#0a0a0a;">
  <h1>${escapeHtmlAttr(info.title)}</h1>
  <p>${escapeHtmlAttr(info.desc)}</p>
  <nav><a href="/">Home</a> | <a href="/shop">Shop All Products</a></nav>
</main>`;
      }
    } else {
      canonicalUrl = `${VANTREL_CANONICAL_ORIGIN}/`;
      jsonLdPayloads = [
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'VANTREL OUTFIT Featured Catalog',
          numberOfItems: published.length,
          itemListElement: published.slice(0, 30).map((p, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            item: buildProductJsonLd(p, published, VANTREL_CANONICAL_ORIGIN)
          }))
        }
      ];
      ssrRootHtml = `<main style="max-width:1100px;margin:0 auto;padding:24px;font-family:sans-serif;color:#f5f5f5;background:#0a0a0a;">
  <h1>VANTREL OUTFIT — Premium Streetwear &amp; Fashion Bangladesh</h1>
  <p>${escapeHtmlAttr(description)}</p>
  <section>
    <h2>Shop by Category</h2>
    <ul>
      ${categories.map((c) => `<li><a href="/category/${encodeURIComponent(getCategorySlug(c))}">${escapeHtmlAttr(c)}</a></li>`).join('\n      ')}
    </ul>
  </section>
  <section>
    <h2>Popular Products</h2>
    <ul>
      ${published
        .slice(0, 40)
        .map((p) => {
          const pSlug = getProductSeoSlug(p, published);
          const pPrice = p.discountPrice ?? p.regularPrice;
          const pImg = p.images?.[0] ? toCanonicalSeoImageUrl(p.images[0], VANTREL_CANONICAL_ORIGIN) : '';
          const pAlt = `Vantrel Outfit ${p.name.replace(/https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/gi, '').trim() || 'Apparel Item'}${p.category ? ` - ${p.category.replace(/https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/gi, '').trim()}` : ''}`;
          return `<li><a href="/product/${encodeURIComponent(pSlug)}">${pImg ? `<img src="${escapeHtmlAttr(pImg)}" alt="${escapeHtmlAttr(pAlt)}" />` : ''}${escapeHtmlAttr(p.name)} — ৳${pPrice} BDT</a></li>`;
        })
        .join('\n      ')}
    </ul>
  </section>
</main>`;
    }

    const jsonLdScript =
      jsonLdPayloads.length > 0 && !isSocialLinkPreviewBot
        ? `<script type="application/ld+json" id="vantrel-ssr-jsonld">${JSON.stringify(
            jsonLdPayloads.length === 1 ? jsonLdPayloads[0] : jsonLdPayloads
          ).replace(/</g, '\\u003c')}</script>`
        : '';

    // Embed focused, slimmed catalog JSON (no inline base64 blobs) so product/category deep links paint immediately
    const slimmedFocusedProducts = focusedSsrProducts.map((p) => slimProductForCatalog(p));
    const ssrProductsScript =
      slimmedFocusedProducts.length > 0 && !isSocialLinkPreviewBot
        ? `<script type="application/json" id="vantrel-ssr-products" data-partial="true">${JSON.stringify(
            slimmedFocusedProducts
          ).replace(/</g, '\\u003c')}</script>`
        : '';

    const isDefaultBanner = ogImage === defaultOgImage;
    const inferredMime = isDefaultBanner ? 'image/jpeg' : inferImageMimeType(ogImage);

    const shellHtml = await getAppShellHtml(req);
    let finalHtml = '';

    if (shellHtml) {
      finalHtml = shellHtml
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(title)}</title>`)
        .replace(/<meta\s+name="title"\s+content="[^"]*"\s*\/?>/i, `<meta name="title" content="${escapeHtmlAttr(title)}" />`)
        .replace(
          /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
          `<meta name="description" content="${escapeHtmlAttr(description)}" />`
        )
        .replace(
          /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
          `<meta name="robots" content="${escapeHtmlAttr(robotsContent)}" />`
        )
        .replace(
          /<meta\s+name="googlebot"\s+content="[^"]*"\s*\/?>/i,
          `<meta name="googlebot" content="${escapeHtmlAttr(robotsContent)}" />`
        )
        .replace(
          /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
          `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`
        )
        .replace(/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:type" content="${escapeHtmlAttr(ogType)}" />`)
        .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`)
        .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`)
        .replace(
          /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
          `<meta property="og:description" content="${escapeHtmlAttr(description)}" />`
        )
        .replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${escapeHtmlAttr(ogImage)}" />`)
        .replace(
          /<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*\/?>/i,
          `<meta property="og:image:secure_url" content="${escapeHtmlAttr(ogImage)}" />`
        )
        .replace(
          /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/i,
          `<meta property="og:image:alt" content="${escapeHtmlAttr(ogImageAlt)}" />`
        )
        .replace(/<meta\s+name="twitter:url"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:url" content="${escapeHtmlAttr(canonicalUrl)}" />`)
        .replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`)
        .replace(
          /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
          `<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`
        )
        .replace(/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${escapeHtmlAttr(ogImage)}" />`)
        .replace(
          /<meta\s+name="twitter:image:alt"\s+content="[^"]*"\s*\/?>/i,
          `<meta name="twitter:image:alt" content="${escapeHtmlAttr(ogImageAlt)}" />`
        );

      if (!isDefaultBanner) {
        finalHtml = finalHtml
          .replace(
            /<meta\s+property="og:image:type"\s+content="[^"]*"\s*\/?>/i,
            inferredMime ? `<meta property="og:image:type" content="${inferredMime}" />` : ''
          )
          .replace(/<meta\s+property="og:image:width"\s+content="[^"]*"\s*\/?>/i, '')
          .replace(/<meta\s+property="og:image:height"\s+content="[^"]*"\s*\/?>/i, '');
      }

      finalHtml = finalHtml
        .replace('</head>', `${extraHeadMeta}\n  ${jsonLdScript}\n  </head>`)
        .replace(
          '<div id="root"></div>',
          isCrawlerAgent ? `<div id="root">${ssrRootHtml}</div>` : '<div id="root"></div>'
        )
        .replace('</body>', `${ssrProductsScript ? `\n  ${ssrProductsScript}\n  ` : ''}</body>`);
    } else {
      finalHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtmlAttr(title)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}" />
  <meta name="robots" content="${escapeHtmlAttr(robotsContent)}" />
  <meta name="googlebot" content="${escapeHtmlAttr(robotsContent)}" />
  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />
  <meta property="og:site_name" content="VANTREL OUTFIT" />
  <meta property="og:type" content="${escapeHtmlAttr(ogType)}" />
  <meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtmlAttr(title)}" />
  <meta property="og:description" content="${escapeHtmlAttr(description)}" />
  <meta property="og:image" content="${escapeHtmlAttr(ogImage)}" />
  <meta property="og:image:secure_url" content="${escapeHtmlAttr(ogImage)}" />
  ${inferredMime ? `<meta property="og:image:type" content="${inferredMime}" />` : ''}
  ${isDefaultBanner ? '<meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />' : ''}
  <meta property="og:image:alt" content="${escapeHtmlAttr(ogImageAlt)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtmlAttr(title)}" />
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}" />
  <meta name="twitter:image" content="${escapeHtmlAttr(ogImage)}" />
  <meta name="twitter:image:alt" content="${escapeHtmlAttr(ogImageAlt)}" />${extraHeadMeta}
  ${jsonLdScript}
</head>
<body>
  <div id="root">${ssrRootHtml}</div>
  ${ssrProductsScript}
</body>
</html>`;
    }

    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-Robots-Tag', robotsContent.startsWith('noindex') ? 'noindex, follow' : 'all');
    res.end(req.method === 'HEAD' ? undefined : finalHtml);
  } catch (err) {
    console.error('[VANTREL SEO] Fallback recovery triggered:', err);
    const localShell = readRepoTextFile('dist/index.html');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    if (localShell) {
      res.end(req.method === 'HEAD' ? undefined : localShell);
      return;
    }
    const fallbackTitle = 'VANTREL OUTFIT — Premium Streetwear & Fashion Bangladesh';
    const fallbackDesc =
      'Shop heavyweight 420 GSM hoodies, oversized luxury tees, Panjabis, shirts, and denim at VANTREL OUTFIT. Free delivery in Dhaka & Cash on Delivery nationwide.';
    res.end(
      req.method === 'HEAD'
        ? undefined
        : `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>${fallbackTitle}</title><meta name="description" content="${fallbackDesc}" /><meta property="og:type" content="website" /><meta property="og:url" content="${VANTREL_CANONICAL_ORIGIN}/" /><meta property="og:title" content="${fallbackTitle}" /><meta property="og:description" content="${fallbackDesc}" /><meta property="og:image" content="${defaultOgImage}" /><meta property="og:image:type" content="image/jpeg" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:image" content="${defaultOgImage}" /></head><body><div id="root"></div></body></html>`
    );
  }
}
