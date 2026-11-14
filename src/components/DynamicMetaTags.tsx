import React, { useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { PageRoute } from '../context/StoreContext';

/**
 * Dynamically updates document <title>, Open Graph, Twitter Card meta tags,
 * canonical link, and Schema.org JSON-LD structured data based on the current page & active product.
 * Also keeps URL search parameters in sync for direct link social sharing (?product=id or ?page=name).
 */
export const DynamicMetaTags: React.FC = () => {
  const { currentPage, setCurrentPage, selectedProductId, openProductDetail, products } = useStore();

  // On first mount, parse incoming URL parameters (/product/:slug or ?product= or ?page=) for shared link resolution
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const pathProdParam = pathParts[0] === 'product' && pathParts[1] ? decodeURIComponent(pathParts[1]) : null;
      const prodParam = params.get('product') || params.get('productId') || pathProdParam;
      const pageParam = params.get('page') as PageRoute | null;

      if (prodParam) {
        const found = products.find((p) => p.id === prodParam || p.slug === prodParam);
        if (found) {
          openProductDetail(found.id);
          return;
        }
      }
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
          setCurrentPage(pageParam);
        }
      }
    } catch (e) {
      console.warn('URL param parse note:', e);
    }
  }, [products]);

  // Synchronize URL search params with active navigation without reload
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (currentPage === 'product-detail' && selectedProductId) {
        url.searchParams.set('product', selectedProductId);
        url.searchParams.delete('page');
      } else if (currentPage !== 'home') {
        url.searchParams.set('page', currentPage);
        url.searchParams.delete('product');
      } else {
        url.searchParams.delete('product');
        url.searchParams.delete('page');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.warn('URL sync note:', e);
    }
  }, [currentPage, selectedProductId]);

  // Dynamically update document title, Open Graph, Twitter tags & Schema JSON-LD
  useEffect(() => {
    const activeProduct = selectedProductId
      ? products.find((p) => p.id === selectedProductId)
      : null;

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vantrel.com';
    const defaultImage = `${origin}/assets/images/hero_fashion_yeamin_1792588589630.jpg`;

    let title = 'VANTREL — Premium Bangladeshi Fashion & Streetwear';
    let description =
      'Define Your Narrative. Discover premium streetwear, 420 GSM hoodies, luxury tees, royal jacquard Panjabi, and tailored denim across Bangladesh with nationwide Cash on Delivery.';
    let imageUrl = defaultImage;
    let imageAlt = 'VANTREL Premium Bangladeshi Streetwear';
    let ogType = 'website';
    let canonicalUrl = `${origin}/`;
    let productPrice: number | null = null;
    let productInStock = true;

    if (currentPage === 'product-detail' && activeProduct) {
      const effectivePrice = activeProduct.discountPrice ?? activeProduct.regularPrice;
      const priceText = `৳${effectivePrice.toLocaleString()}`;
      const fabricSnippet = activeProduct.fabric ? ` | ${activeProduct.fabric}` : '';
      title = `${activeProduct.name} - ${priceText} | VANTREL OUTFIT`;
      description =
        activeProduct.description ||
        activeProduct.tagline ||
        `Buy ${activeProduct.name} at ${priceText}${fabricSnippet}. Official VANTREL OUTFIT apparel with Cash on Delivery across Bangladesh.`;

      if (activeProduct.images && activeProduct.images.length > 0) {
        const rawImg = activeProduct.images[0];
        imageUrl = rawImg.startsWith('http') ? rawImg : `${origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
      }
      imageAlt = `${activeProduct.name} - VANTREL OUTFIT`;
      ogType = 'product';
      canonicalUrl = `${origin}/product/${encodeURIComponent(activeProduct.slug || activeProduct.id)}`;
      productPrice = effectivePrice;
      productInStock = (activeProduct.totalStock ?? 1) > 0;
    } else {
      switch (currentPage) {
        case 'shop':
          title = 'Shop Premium Streetwear & Modern Fashion | VANTREL';
          description =
            'Browse heavy GSM hoodies, drop-shoulder luxury tees, artisan panjabis, and selvedge denim. Premium fabric weights crafted in Bangladesh.';
          canonicalUrl = `${origin}/?page=shop`;
          break;
        case 'cart':
          title = 'Your Shopping Bag | VANTREL Online Store';
          description =
            'Review your selected items. Free delivery inside Dhaka City (৳0), and only ৳50 in Dhaka Sub-Area & all 63 districts with Cash on Delivery.';
          canonicalUrl = `${origin}/?page=cart`;
          break;
        case 'checkout':
          title = 'Secure Checkout | VANTREL Bangladesh';
          description =
            'Complete your order securely with Cash on Delivery (COD) or bKash / Nagad mobile banking. Fast dispatch across 64 districts.';
          canonicalUrl = `${origin}/?page=checkout`;
          break;
        case 'confirmation':
          title = 'Order Confirmed | VANTREL OUTFIT';
          description =
            'Thank you for shopping with VANTREL OUTFIT. We are carefully packaging your order with custom branded box packaging.';
          canonicalUrl = `${origin}/?page=confirmation`;
          break;
        case 'tracking':
          title = 'Live Order Tracking | VANTREL OUTFIT';
          description =
            'Track your parcel dispatch and courier status live with Steadfast, Pathao, or RedX logistics tracking.';
          canonicalUrl = `${origin}/?page=tracking`;
          break;
        case 'account':
          title = 'Customer Account & Rewards | VANTREL OUTFIT';
          description =
            'Manage your saved delivery addresses, past orders, and redeem loyalty points on your favorite streetwear.';
          canonicalUrl = `${origin}/?page=account`;
          break;
        case 'admin':
          title = 'VANTREL OUTFIT Operations Dashboard | Admin Panel';
          description =
            'Administrative portal for live orders, customer addresses, inventory, courier dispatch, and finance management.';
          canonicalUrl = `${origin}/?page=admin`;
          break;
        case 'about':
          title = 'About VANTREL OUTFIT — The Narrative & Craftsmanship';
          description =
            'Discover VANTREL OUTFIT’s dedication to uncompromising GSM weights, architectural streetwear silhouettes, and ethical local production.';
          canonicalUrl = `${origin}/?page=about`;
          break;
        case 'contact':
          title = 'Contact VANTREL OUTFIT Support';
          description =
            'Get in touch with the VANTREL OUTFIT team on our official Facebook page for sizing help, custom orders, or customer support.';
          canonicalUrl = `${origin}/?page=contact`;
          break;
        case 'faqs':
        case 'size-guide':
          title = 'Size Guide & FAQs | VANTREL OUTFIT';
          description =
            'Explore our detailed chest & length measurements for oversized t-shirts, drop-shoulder hoodies, and fabric care instructions.';
          canonicalUrl = `${origin}/?page=faqs`;
          break;
        case 'shipping-policy':
          title = 'Shipping & Delivery Policy | VANTREL OUTFIT';
          description =
            'Free delivery inside Dhaka City (৳0, 24-48 hrs). Dhaka Sub-Area & all 63 districts: ৳50 flat rate (48-72 hrs). Cash on Delivery nationwide.';
          canonicalUrl = `${origin}/?page=shipping-policy`;
          break;
        case 'return-policy':
          title = '7-Day Easy Exchange Policy | VANTREL OUTFIT';
          description =
            'Hassle-free 7-day exchange for any size or fit issues. We ensure full customer satisfaction on every garment.';
          canonicalUrl = `${origin}/?page=return-policy`;
          break;
        case 'privacy-policy':
        case 'terms':
          title = 'Privacy & Terms of Service | VANTREL OUTFIT';
          description =
            'Read our customer privacy commitments, data security, and terms of service for purchases made on VANTREL OUTFIT.';
          canonicalUrl = `${origin}/?page=privacy-policy`;
          break;
        default:
          title = 'VANTREL OUTFIT — Premium Quality & Trendsetting Fashion';
          description =
            'এক ছাদের নিচে আপনার পছন্দের স্টাইলিশ ও প্রিমিয়াম ফ্যাশন কালেকশন। Discover premium streetwear, 420 GSM hoodies, luxury tees, royal jacquard Panjabi, and tailored denim across Bangladesh with nationwide Cash on Delivery.';
          canonicalUrl = `${origin}/`;
          break;
      }
    }

    // 1. Update Document Title
    document.title = title;

    // 2. Helper to set or create <meta> tags in <head>
    const setMetaTag = (attrName: 'name' | 'property', attrValue: string, content: string) => {
      let meta = document.head.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attrName, attrValue);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // 3. Inject standard SEO meta
    setMetaTag('name', 'description', description);

    // 4. Inject Open Graph tags
    setMetaTag('property', 'og:site_name', 'VANTREL OUTFIT');
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:image', imageUrl);
    setMetaTag('property', 'og:image:alt', imageAlt);
    setMetaTag('property', 'og:url', canonicalUrl);

    // Product-specific OG tags
    if (ogType === 'product' && productPrice !== null) {
      setMetaTag('property', 'product:price:amount', productPrice.toString());
      setMetaTag('property', 'product:price:currency', 'BDT');
      setMetaTag('property', 'product:availability', productInStock ? 'in stock' : 'out of stock');
    } else {
      const priceMeta = document.head.querySelector('meta[property="product:price:amount"]');
      if (priceMeta) priceMeta.remove();
      const currMeta = document.head.querySelector('meta[property="product:price:currency"]');
      if (currMeta) currMeta.remove();
      const availMeta = document.head.querySelector('meta[property="product:availability"]');
      if (availMeta) availMeta.remove();
    }

    // 5. Inject Twitter / X Card tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', imageUrl);
    setMetaTag('name', 'twitter:image:alt', imageAlt);

    // 6. Update Canonical link
    let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // 7. Inject Schema.org JSON-LD Structured Data
    let schemaScript = document.head.querySelector('#vantrel-jsonld') as HTMLScriptElement | null;
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.setAttribute('type', 'application/ld+json');
      schemaScript.setAttribute('id', 'vantrel-jsonld');
      document.head.appendChild(schemaScript);
    }

    if (ogType === 'product' && activeProduct) {
      const resolvedImages = (activeProduct.images || [])
        .filter((img) => Boolean(img && typeof img === 'string'))
        .map((img) => (img.startsWith('http') ? img : `${origin}${img.startsWith('/') ? '' : '/'}${img}`));

      const effectivePrice = activeProduct.discountPrice ?? activeProduct.regularPrice;
      const productSchema: Record<string, unknown> = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        '@id': `${canonicalUrl}#product`,
        name: activeProduct.name,
        url: canonicalUrl,
        image: resolvedImages.length > 0 ? resolvedImages : [imageUrl],
        description: (activeProduct.description || activeProduct.tagline || activeProduct.name || '').trim(),
        sku: activeProduct.sku || activeProduct.id,
        mpn: activeProduct.sku || activeProduct.id,
        category: activeProduct.category,
        brand: {
          '@type': 'Brand',
          name: 'VANTREL OUTFIT'
        },
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'BDT',
          price: String(effectivePrice),
          priceValidUntil: '2027-12-31',
          itemCondition: 'https://schema.org/NewCondition',
          availability: productInStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: 'VANTREL OUTFIT'
          }
        }
      };

      if (activeProduct.reviewCount > 0 && activeProduct.rating > 0) {
        productSchema.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: String(activeProduct.rating),
          reviewCount: String(activeProduct.reviewCount)
        };
      }

      schemaScript.textContent = JSON.stringify(productSchema);
    } else {
      const storeSchema = {
        '@context': 'https://schema.org',
        '@type': 'ClothingStore',
        name: 'VANTREL OUTFIT',
        url: origin,
        logo: `${origin}/assets/images/vantrel-logo.png`,
        description:
          'এক ছাদের নিচে আপনার পছন্দের স্টাইলিশ ও প্রিমিয়াম ফ্যাশন কালেকশন। Premium streetwear, 420 GSM hoodies, luxury tees, royal jacquard Panjabi, and tailored denim across Bangladesh with nationwide Cash on Delivery.',
        priceRange: '৳৳',
        sameAs: [
          'https://www.facebook.com/vantreloutfit',
          'https://www.instagram.com/vantreloutfit'
        ],
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Banani / Gulshan Hub',
          addressLocality: 'Dhaka',
          addressCountry: 'BD'
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: '23.7937',
          longitude: '90.4066'
        },
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '09:00',
            closes: '22:00'
          }
        ]
      };
      schemaScript.textContent = JSON.stringify(storeSchema);
    }
  }, [currentPage, selectedProductId, products]);

  return null;
};
