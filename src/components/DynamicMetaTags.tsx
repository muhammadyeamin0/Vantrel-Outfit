import React, { useEffect, useRef } from 'react';
import { useStore, PageRoute } from '../context/StoreContext';
import { VANTREL_CANONICAL_ORIGIN, toCanonicalSeoImageUrl } from '../utils/imageProxy';
import {
  getProductSeoSlug,
  findProductByUrlParam,
  getCategorySlug,
  findCategoryBySlug
} from '../utils/seoSlug';
import { ensureMetaPixelLoaded, trackMetaPageView } from '../utils/metaPixel';
import { shouldHideProductFromPublic } from '../utils/stockVisibility';
import { resolveProductGsmLabel, resolveProductFabricLabel } from '../utils/productGsm';

function truncateSeoDescription(text: string, maxLen: number = 158): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 3).trim()}...`;
}

function resolveClientSeoProductImages(
  productId: string,
  images: string[] | undefined,
  canonicalOrigin: string
): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  images.forEach((img, idx) => {
    if (!img || typeof img !== 'string') return;
    const trimmed = img.trim();
    if (!trimmed || trimmed.startsWith('blob:')) return;
    const resolved = trimmed.startsWith('data:image/')
      ? `${canonicalOrigin}/api/product-image?id=${encodeURIComponent(productId)}&idx=${idx}`
      : toCanonicalSeoImageUrl(trimmed, canonicalOrigin);
    if (resolved && !resolved.startsWith('data:') && !resolved.startsWith('blob:') && !seen.has(resolved)) {
      seen.add(resolved);
      result.push(resolved);
    }
  });
  return result;
}

/**
 * Centrally manages SEO-friendly URLs (/product/:slug, /category/:slug, /shop, etc.),
 * unique Page Titles & Meta Descriptions, Robots indexing directives, Canonical URLs,
 * Open Graph, Twitter Card meta tags, and Schema.org JSON-LD (Product, Offer, BreadcrumbList, CollectionPage).
 */
export const DynamicMetaTags: React.FC = () => {
  const {
    currentPage,
    setCurrentPage,
    selectedProductId,
    openProductDetail,
    selectedCategory,
    setSelectedCategory,
    categories,
    products,
    settings
  } = useStore();

  const hasParsedInitialUrlRef = useRef(false);
  const pendingInitialProductParamRef = useRef<string | null>(null);
  const suppressSyncOnceRef = useRef(false);

  // 1. Parse incoming URL (/product/:slug, /category/:slug, /shop, or ?product= / ?page= / ?category=) once on initial load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!hasParsedInitialUrlRef.current) {
        hasParsedInitialUrlRef.current = true;
        const params = new URLSearchParams(window.location.search);
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const firstSeg = (pathParts[0] || '').toLowerCase();
        const secondSeg = pathParts[1] ? decodeURIComponent(pathParts[1]) : null;

        const prodParam =
          (firstSeg === 'product' && secondSeg) ||
          params.get('product') ||
          params.get('productId') ||
          (params.get('page') === 'product' ? params.get('id') : null);

        if (prodParam) {
          if (products.length > 0) {
            const found = findProductByUrlParam(prodParam, products);
            if (found) {
              suppressSyncOnceRef.current = true;
              openProductDetail(found.id);
              return;
            }
          } else {
            pendingInitialProductParamRef.current = prodParam;
            suppressSyncOnceRef.current = true;
            return;
          }
        }

        if (firstSeg === 'category' && secondSeg) {
          const matchedCat = findCategoryBySlug(secondSeg, categories) || secondSeg;
          suppressSyncOnceRef.current = true;
          setSelectedCategory(matchedCat);
          setCurrentPage('shop');
          return;
        }

        const categoryQuery = params.get('category');
        if (categoryQuery) {
          suppressSyncOnceRef.current = true;
          setSelectedCategory(categoryQuery);
          setCurrentPage('shop');
          return;
        }

        const pathRouteMap: Record<string, PageRoute> = {
          shop: 'shop',
          products: 'shop',
          cart: 'cart',
          checkout: 'checkout',
          confirmation: 'confirmation',
          track: 'tracking',
          tracking: 'tracking',
          account: 'account',
          compare: 'compare',
          admin: 'admin',
          about: 'about',
          contact: 'contact',
          faqs: 'faqs',
          'size-guide': 'size-guide',
          'shipping-policy': 'shipping-policy',
          'return-policy': 'return-policy',
          'privacy-policy': 'privacy-policy',
          terms: 'terms'
        };

        const routeFromPath = pathRouteMap[firstSeg];
        const pageParam = (routeFromPath || params.get('page')) as PageRoute | null;

        if (pageParam && pageParam !== 'home') {
          const validPages: PageRoute[] = [
            'shop',
            'cart',
            'checkout',
            'confirmation',
            'tracking',
            'account',
            'compare',
            'admin',
            'about',
            'contact',
            'faqs',
            'size-guide',
            'shipping-policy',
            'return-policy',
            'privacy-policy',
            'terms'
          ];
          if (validPages.includes(pageParam)) {
            suppressSyncOnceRef.current = true;
            setCurrentPage(pageParam);
          }
        }
        return;
      }

      // Resolve deferred /product/:slug only if still waiting for initial catalog hydration on initial home state
      if (pendingInitialProductParamRef.current && products.length > 0) {
        const pendingParam = pendingInitialProductParamRef.current;
        pendingInitialProductParamRef.current = null;
        if (currentPage === 'home') {
          const found = findProductByUrlParam(pendingParam, products);
          if (found) {
            suppressSyncOnceRef.current = true;
            openProductDetail(found.id);
          }
        }
      }
    } catch (e) {
      console.warn('URL param parse note:', e);
    }
  }, [products]);

  // 2. Synchronize clean SEO-friendly path URLs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (suppressSyncOnceRef.current) {
      suppressSyncOnceRef.current = false;
      return;
    }

    try {
      const url = new URL(window.location.href);
      let nextPath = '/';

      if (currentPage === 'product-detail' && selectedProductId) {
        const activeProd = products.find((p) => p.id === selectedProductId);
        const seoSlug = activeProd ? getProductSeoSlug(activeProd, products) : selectedProductId;
        nextPath = `/product/${encodeURIComponent(seoSlug)}`;
      } else if (currentPage === 'shop') {
        if (selectedCategory && selectedCategory !== 'All') {
          nextPath = `/category/${encodeURIComponent(getCategorySlug(selectedCategory))}`;
        } else {
          nextPath = '/shop';
        }
      } else if (currentPage === 'tracking') {
        nextPath = '/track';
      } else if (currentPage !== 'home') {
        nextPath = `/${currentPage}`;
      }

      // Remove legacy SPA query params cleanly while preserving order tracking / payment params if present
      url.searchParams.delete('product');
      url.searchParams.delete('productId');
      url.searchParams.delete('page');
      url.searchParams.delete('category');
      if (currentPage === 'product-detail') {
        url.searchParams.delete('id');
      }

      const nextUrl = `${nextPath}${url.search}${url.hash}`;
      const currentFull = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentFull !== nextUrl) {
        window.history.replaceState({}, '', nextUrl);
      }
    } catch (e) {
      console.warn('URL sync note:', e);
    }
  }, [currentPage, selectedProductId, selectedCategory, products]);

  // 2b. Fire Meta Pixel SPA PageView once per unique route change (never on component re-renders)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pixelEnabled = settings.isMetaPixelEnabled ?? true;
    ensureMetaPixelLoaded(settings.metaPixelId, pixelEnabled);
    const pixelRouteKey =
      currentPage === 'product-detail'
        ? `product-detail:${selectedProductId || ''}`
        : currentPage === 'shop'
          ? `shop:${selectedCategory || 'All'}`
          : currentPage;
    trackMetaPageView(pixelRouteKey, settings.metaPixelId, pixelEnabled);
  }, [
    currentPage,
    selectedProductId,
    selectedCategory,
    settings.metaPixelId,
    settings.isMetaPixelEnabled
  ]);

  // 3. Dynamically update <title>, description, robots, canonical, OG, Twitter & Schema JSON-LD
  useEffect(() => {
    const activeProduct = selectedProductId
      ? products.find((p) => p.id === selectedProductId)
      : null;

    const canonicalOrigin = VANTREL_CANONICAL_ORIGIN;
    const defaultImage = `${canonicalOrigin}/assets/images/vantrel-og-image.jpg`;

    let title = 'VANTREL OUTFIT — Premium Streetwear & Fashion Bangladesh';
    let description =
      'Shop 420 GSM hoodies, oversized luxury tees, Panjabis, shirts, and denim at VANTREL OUTFIT. Free delivery in Dhaka & Cash on Delivery across Bangladesh.';
    let imageUrl = defaultImage;
    let imageAlt = 'VANTREL OUTFIT Official Storefront Banner';
    let ogType = 'website';
    let canonicalUrl = `${canonicalOrigin}/`;
    let robotsDirective = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
    let productPrice: number | null = null;
    let productInStock = true;
    let productBrand = 'VANTREL OUTFIT';

    const publishedProducts = products.filter(
      (p) => !shouldHideProductFromPublic(p, settings.outOfStockDefaultBehavior)
    );

    if (currentPage === 'product-detail' && activeProduct && !shouldHideProductFromPublic(activeProduct, settings.outOfStockDefaultBehavior)) {
      const seoSlug = getProductSeoSlug(activeProduct, products);
      const effectivePrice = activeProduct.discountPrice ?? activeProduct.regularPrice;
      const priceText = `৳${effectivePrice.toLocaleString()}`;
      productBrand = (activeProduct.brand || 'VANTREL OUTFIT').trim();
      const fabricSnippet = activeProduct.fabric ? ` (${activeProduct.fabric})` : '';

      title = `${activeProduct.name} — ${priceText} | ${productBrand}`;
      description = truncateSeoDescription(
        activeProduct.description ||
          activeProduct.tagline ||
          `Buy ${activeProduct.name} for ${priceText}${fabricSnippet} from ${productBrand}. Free delivery inside Dhaka & nationwide Cash on Delivery.`
      );

      const resolvedProductImages = resolveClientSeoProductImages(
        activeProduct.id,
        activeProduct.images,
        canonicalOrigin
      );
      if (resolvedProductImages.length > 0) {
        imageUrl = resolvedProductImages[0];
      }
      imageAlt = `${activeProduct.name} - ${activeProduct.category} by ${productBrand}`;
      ogType = 'product';
      canonicalUrl = `${canonicalOrigin}/product/${encodeURIComponent(seoSlug)}`;
      productPrice = effectivePrice;
      productInStock = Number(activeProduct.totalStock ?? 0) > 0;
    } else if (currentPage === 'shop') {
      const isSpecificCat = Boolean(selectedCategory && selectedCategory !== 'All');
      const catProducts = isSpecificCat
        ? publishedProducts.filter(
            (p) =>
              p.category.toLowerCase() === selectedCategory.toLowerCase() ||
              getCategorySlug(p.category) === getCategorySlug(selectedCategory)
          )
        : publishedProducts;

      if (isSpecificCat) {
        const catSlug = getCategorySlug(selectedCategory);
        title = `${selectedCategory} Collection (${catProducts.length} Items) | VANTREL OUTFIT`;
        description = truncateSeoDescription(
          `Shop ${catProducts.length} authentic ${selectedCategory} styles online in Bangladesh at VANTREL OUTFIT. Free delivery in Dhaka & ৳50 nationwide COD.`
        );
        canonicalUrl = `${canonicalOrigin}/category/${encodeURIComponent(catSlug)}`;
        if (catProducts[0]?.images?.[0]) {
          imageUrl = toCanonicalSeoImageUrl(catProducts[0].images[0], canonicalOrigin);
        }
        imageAlt = `${selectedCategory} Collection - VANTREL OUTFIT`;
      } else {
        title = 'Shop All Streetwear, Hoodies, Tees & Panjabis | VANTREL OUTFIT';
        description = truncateSeoDescription(
          `Explore ${publishedProducts.length} genuine VANTREL OUTFIT garments: hoodies, oversized t-shirts, panjabis, shirts & pants with Free Dhaka delivery.`
        );
        canonicalUrl = `${canonicalOrigin}/shop`;
      }
    } else {
      switch (currentPage) {
        case 'cart':
          title = 'Your Shopping Bag | VANTREL OUTFIT';
          description =
            'Review your selected VANTREL OUTFIT items. Free delivery inside Dhaka City (৳0), and ৳50 flat delivery across Dhaka Sub-Area & 63 districts.';
          canonicalUrl = `${canonicalOrigin}/cart`;
          robotsDirective = 'noindex, nofollow';
          break;
        case 'checkout':
          title = 'Secure Checkout | VANTREL OUTFIT Bangladesh';
          description =
            'Complete your order securely with Cash on Delivery (COD) or bKash / Nagad. Fast nationwide dispatch across 64 districts.';
          canonicalUrl = `${canonicalOrigin}/checkout`;
          robotsDirective = 'noindex, nofollow';
          break;
        case 'confirmation':
          title = 'Order Confirmed | VANTREL OUTFIT';
          description =
            'Thank you for ordering from VANTREL OUTFIT. Track your order status live until doorstep delivery.';
          canonicalUrl = `${canonicalOrigin}/confirmation`;
          robotsDirective = 'noindex, nofollow';
          break;
        case 'tracking':
          title = 'Live Order Tracking | VANTREL OUTFIT';
          description =
            'Track your VANTREL OUTFIT parcel dispatch and courier status live across Dhaka and all 64 districts of Bangladesh.';
          canonicalUrl = `${canonicalOrigin}/track`;
          break;
        case 'account':
          title = 'Customer Account & Orders | VANTREL OUTFIT';
          description =
            'Manage your saved delivery addresses and order history on VANTREL OUTFIT.';
          canonicalUrl = `${canonicalOrigin}/account`;
          robotsDirective = 'noindex, nofollow';
          break;
        case 'admin':
          title = 'VANTREL OUTFIT Admin Operations';
          description =
            'Administrative portal for live orders, inventory, and store configuration.';
          canonicalUrl = `${canonicalOrigin}/admin`;
          robotsDirective = 'noindex, nofollow';
          break;
        case 'about':
          title = 'About VANTREL — Wear Your Vibe | VANTREL OUTFIT';
          description =
            'VANTREL একটি আধুনিক স্ট্রিটওয়্যার ও ক্যাজুয়াল অ্যাপারেল ব্র্যান্ড — হাই-GSM ফেব্রিক, সিগনেচার ফিট, ঢাকায় ফ্রি ডেলিভারি এবং ১০০% Cash on Delivery।';
          canonicalUrl = `${canonicalOrigin}/about`;
          break;
        case 'contact':
          title = 'Contact VANTREL OUTFIT Support';
          description =
            'Reach the VANTREL OUTFIT team on WhatsApp or Facebook for sizing guidance, order assistance, and customer care in Bangladesh.';
          canonicalUrl = `${canonicalOrigin}/contact`;
          break;
        case 'faqs':
          title = 'FAQs & Garment Care | VANTREL OUTFIT';
          description =
            'Answers to frequently asked questions about VANTREL OUTFIT sizing, 420 GSM fabric care, Free Dhaka delivery, and 7-day exchanges.';
          canonicalUrl = `${canonicalOrigin}/faqs`;
          break;
        case 'size-guide':
          title = 'Exact Garment Size Guide | VANTREL OUTFIT';
          description =
            'Check detailed chest, length, and sleeve measurements in inches and cm for hoodies, oversized t-shirts, shirts, and pants.';
          canonicalUrl = `${canonicalOrigin}/size-guide`;
          break;
        case 'shipping-policy':
          title = 'Shipping & Delivery Policy | VANTREL OUTFIT';
          description =
            'Free delivery inside Dhaka City (৳0, 24–48 hrs). Dhaka Sub-Area & 63 districts flat ৳50 Cash on Delivery across Bangladesh.';
          canonicalUrl = `${canonicalOrigin}/shipping-policy`;
          break;
        case 'return-policy':
          title = '7-Day Easy Exchange Policy | VANTREL OUTFIT';
          description =
            'Hassle-free 7-day size replacement and exchange guarantee on every garment ordered from VANTREL OUTFIT.';
          canonicalUrl = `${canonicalOrigin}/return-policy`;
          break;
        case 'privacy-policy':
          title = 'Privacy Policy | VANTREL OUTFIT';
          description =
            'Read how VANTREL OUTFIT safeguards your delivery address, contact details, and order information.';
          canonicalUrl = `${canonicalOrigin}/privacy-policy`;
          break;
        case 'terms':
          title = 'Terms of Service | VANTREL OUTFIT';
          description =
            'Review the official terms of service, pricing, and delivery conditions for VANTREL OUTFIT Bangladesh.';
          canonicalUrl = `${canonicalOrigin}/terms`;
          break;
        default:
          title = 'VANTREL OUTFIT — Premium Streetwear & Fashion Bangladesh';
          description =
            'Shop 420 GSM hoodies, oversized luxury tees, Panjabis, shirts, and denim at VANTREL OUTFIT. Free delivery in Dhaka & Cash on Delivery across Bangladesh.';
          canonicalUrl = `${canonicalOrigin}/`;
          break;
      }
    }

    // Update Document Title
    document.title = title;

    const setMetaTag = (attrName: 'name' | 'property', attrValue: string, content: string) => {
      let meta = document.head.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attrName, attrValue);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    const removeMetaTag = (attrName: 'name' | 'property', attrValue: string) => {
      const existing = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (existing) existing.remove();
    };

    // Standard SEO & Robots Meta (Ensure NO product/category/home page ever gets noindex)
    setMetaTag('name', 'title', title);
    setMetaTag('name', 'description', description);
    setMetaTag('name', 'robots', robotsDirective);
    setMetaTag('name', 'googlebot', robotsDirective);

    // Open Graph Meta
    setMetaTag('property', 'og:site_name', 'VANTREL OUTFIT');
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:image', imageUrl);
    setMetaTag('property', 'og:image:secure_url', imageUrl);
    setMetaTag('property', 'og:image:alt', imageAlt);
    setMetaTag('property', 'og:url', canonicalUrl);

    if (ogType === 'product' && productPrice !== null) {
      setMetaTag('property', 'product:brand', productBrand);
      setMetaTag('property', 'product:price:amount', String(productPrice));
      setMetaTag('property', 'product:price:currency', 'BDT');
      setMetaTag('property', 'product:availability', productInStock ? 'in stock' : 'out of stock');
    } else {
      removeMetaTag('property', 'product:brand');
      removeMetaTag('property', 'product:price:amount');
      removeMetaTag('property', 'product:price:currency');
      removeMetaTag('property', 'product:availability');
    }

    // Twitter / X Card Meta
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:url', canonicalUrl);
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', imageUrl);
    setMetaTag('name', 'twitter:image:alt', imageAlt);

    // Canonical URL
    let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // Schema.org JSON-LD Structured Data (remove any SSR-injected Product JSON-LD so Googlebot never sees duplicate entities)
    document.head
      .querySelectorAll('#vantrel-ssr-jsonld, #vantrel-product-jsonld')
      .forEach((node) => node.remove());

    let schemaScript = document.head.querySelector('#vantrel-jsonld') as HTMLScriptElement | null;
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.setAttribute('type', 'application/ld+json');
      schemaScript.setAttribute('id', 'vantrel-jsonld');
      document.head.appendChild(schemaScript);
    }

    if (ogType === 'product' && activeProduct) {
      const resolvedImages = resolveClientSeoProductImages(
        activeProduct.id,
        activeProduct.images,
        canonicalOrigin
      );
      const effectivePrice = Number(activeProduct.discountPrice ?? activeProduct.regularPrice ?? 0);
      const regularPrice = Number(activeProduct.regularPrice ?? effectivePrice);
      const catSlug = getCategorySlug(activeProduct.category);
      const catUrl = `${canonicalOrigin}/category/${encodeURIComponent(catSlug)}`;
      const priceValidUntil = `${new Date().getFullYear() + 1}-12-31`;
      const insideDhakaFee = Number(settings.deliveryFeeInsideDhaka ?? 0);
      const outsideDhakaFee = Number(settings.deliveryFeeOutsideDhaka ?? 50);

      const offerSchema: Record<string, unknown> = {
        '@type': 'Offer',
        url: canonicalUrl,
        priceCurrency: 'BDT',
        price: effectivePrice,
        priceValidUntil,
        itemCondition: 'https://schema.org/NewCondition',
        availability: productInStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: 'VANTREL OUTFIT',
          url: `${canonicalOrigin}/`
        },
        shippingDetails: [
          {
            '@type': 'OfferShippingDetails',
            shippingRate: {
              '@type': 'MonetaryAmount',
              value: insideDhakaFee,
              currency: 'BDT'
            },
            shippingDestination: {
              '@type': 'DefinedRegion',
              addressCountry: 'BD',
              addressRegion: 'Dhaka'
            },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 1,
                unitCode: 'DAY'
              },
              transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 1,
                maxValue: 2,
                unitCode: 'DAY'
              }
            }
          },
          {
            '@type': 'OfferShippingDetails',
            shippingRate: {
              '@type': 'MonetaryAmount',
              value: outsideDhakaFee,
              currency: 'BDT'
            },
            shippingDestination: {
              '@type': 'DefinedRegion',
              addressCountry: 'BD'
            },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 1,
                unitCode: 'DAY'
              },
              transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 2,
                maxValue: 4,
                unitCode: 'DAY'
              }
            }
          }
        ],
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'BD',
          returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
          merchantReturnDays: 7,
          returnMethod: 'https://schema.org/ReturnByMail',
          returnFees: 'https://schema.org/FreeReturn'
        }
      };

      if (regularPrice > effectivePrice && effectivePrice > 0) {
        offerSchema.priceSpecification = {
          '@type': 'UnitPriceSpecification',
          priceType: 'https://schema.org/StrikethroughPrice',
          priceCurrency: 'BDT',
          price: regularPrice
        };
      }

      const resolvedFabric = resolveProductFabricLabel(activeProduct);
      const resolvedGsm = resolveProductGsmLabel(activeProduct);

      const productSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': `${canonicalUrl}#product`,
        name: activeProduct.name,
        url: canonicalUrl,
        image: resolvedImages.length > 0 ? resolvedImages : [imageUrl],
        description: (activeProduct.description || activeProduct.tagline || activeProduct.name || '')
          .replace(/\s+/g, ' ')
          .trim(),
        sku: activeProduct.sku || activeProduct.id,
        mpn: activeProduct.sku || activeProduct.id,
        category: activeProduct.category,
        brand: {
          '@type': 'Brand',
          name: productBrand
        },
        offers: offerSchema
      };

      if (resolvedFabric) {
        productSchema.material = resolvedGsm ? `${resolvedFabric} (${resolvedGsm})` : resolvedFabric;
      }
      if (Array.isArray(activeProduct.sizes) && activeProduct.sizes.length > 0) {
        productSchema.size = activeProduct.sizes.join(', ');
      }
      if (Array.isArray(activeProduct.colors) && activeProduct.colors.length > 0) {
        const colorNames = activeProduct.colors.map((c) => c?.name).filter(Boolean);
        if (colorNames.length > 0) {
          productSchema.color = colorNames.join(', ');
        }
      }

      if (activeProduct.reviewCount > 0 && activeProduct.rating > 0) {
        const clampedRating = Number(Math.min(5, Math.max(1, Number(activeProduct.rating))).toFixed(1));
        productSchema.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: clampedRating,
          reviewCount: Math.max(1, Math.round(Number(activeProduct.reviewCount))),
          bestRating: 5,
          worstRating: 1
        };
      }

      if (Array.isArray(activeProduct.reviews) && activeProduct.reviews.length > 0) {
        const validReviews = activeProduct.reviews
          .filter((r) => r && r.author && r.comment)
          .slice(0, 5)
          .map((r) => ({
            '@type': 'Review',
            author: {
              '@type': 'Person',
              name: String(r.author).trim()
            },
            ...(r.date ? { datePublished: String(r.date).trim() } : {}),
            reviewBody: String(r.comment).trim(),
            reviewRating: {
              '@type': 'Rating',
              ratingValue: Number(Math.min(5, Math.max(1, Number(r.rating || 5))).toFixed(1)),
              bestRating: 5,
              worstRating: 1
            }
          }));
        if (validReviews.length > 0) {
          productSchema.review = validReviews;
        }
      }

      const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${canonicalOrigin}/` },
          { '@type': 'ListItem', position: 2, name: activeProduct.category, item: catUrl },
          { '@type': 'ListItem', position: 3, name: activeProduct.name, item: canonicalUrl }
        ]
      };

      schemaScript.textContent = JSON.stringify([productSchema, breadcrumbSchema]);
    } else if (currentPage === 'shop') {
      const isSpecificCat = Boolean(selectedCategory && selectedCategory !== 'All');
      const listProducts = isSpecificCat
        ? publishedProducts.filter(
            (p) =>
              p.category.toLowerCase() === selectedCategory.toLowerCase() ||
              getCategorySlug(p.category) === getCategorySlug(selectedCategory)
          )
        : publishedProducts;

      const collectionSchema = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        url: canonicalUrl,
        description,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: listProducts.length,
          itemListElement: listProducts.slice(0, 20).map((p, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: `${canonicalOrigin}/product/${encodeURIComponent(getProductSeoSlug(p, products))}`,
            name: p.name
          }))
        }
      };
      schemaScript.textContent = JSON.stringify(collectionSchema);
    } else {
      const storeSchema = {
        '@context': 'https://schema.org',
        '@type': 'ClothingStore',
        name: 'VANTREL OUTFIT',
        url: canonicalOrigin,
        logo: `${canonicalOrigin}/assets/images/vantrel-logo.png`,
        description:
          'Shop 420 GSM hoodies, oversized luxury tees, Panjabis, shirts, and denim at VANTREL OUTFIT. Free delivery in Dhaka & Cash on Delivery across Bangladesh.',
        priceRange: '৳৳',
        sameAs: [
          'https://www.facebook.com/vantreloutfit',
          'https://www.instagram.com/vantreloutfit'
        ],
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Dhaka',
          addressCountry: 'BD'
        }
      };
      schemaScript.textContent = JSON.stringify(storeSchema);
    }
  }, [
    currentPage,
    selectedProductId,
    selectedCategory,
    products,
    settings.outOfStockDefaultBehavior,
    settings.deliveryFeeInsideDhaka,
    settings.deliveryFeeOutsideDhaka
  ]);

  return null;
};
