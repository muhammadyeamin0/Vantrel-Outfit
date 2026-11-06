import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCategory, Product } from '../types';
import {
  Truck,
  ShieldCheck,
  Headphones,
  ArrowRight,
  Check,
  Zap,
  ShoppingBag,
  Star
} from 'lucide-react';

interface HeroSlide {
  id: string;
  badge: string;
  title: string;
  tagline1: string;
  tagline2: string;
  categoryList: string;
  ctaText: string;
  category: ProductCategory;
  bgImage: string;
}

export const HomePage: React.FC = () => {
  const {
    products,
    categories,
    setCurrentPage,
    setSelectedCategory,
    openProductDetail,
    addToCart,
    buyNow,
    showToast,
    setIsCartDrawerOpen
  } = useStore();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedSwatches, setSelectedSwatches] = useState<Record<string, number>>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  // Hero Slides matching the reference aesthetic
  const heroSlides: HeroSlide[] = [
    {
      id: 'slide-01',
      badge: '01',
      title: 'VANTREL',
      tagline1: 'WEAR THE DIFFERENCE',
      tagline2: 'CLOTHING BEYOND TRENDS',
      categoryList: 'T-SHIRT / PANT / HOODIE / PANJABI',
      ctaText: 'SHOP NOW',
      category: 'All',
      bgImage: '/assets/aistudio/bbbdd9b6c4ab32413590d25052fec04a0c0a000330301ac6c4dc3a486d928cd5_d56a8fd1.png'
    },
    {
      id: 'slide-02',
      badge: '02',
      title: 'VANTREL',
      tagline1: 'CRAFTED WITH PRECISION',
      tagline2: 'TIMELESS URBAN WEAR',
      categoryList: 'HEAVYWEIGHT HOODIES & KNITS',
      ctaText: 'DISCOVER DROPS',
      category: 'Hoodies',
      bgImage: '/assets/images/editorial_cream_hoodie_1793118980188.jpg'
    },
    {
      id: 'slide-03',
      badge: '03',
      title: 'VANTREL',
      tagline1: 'WEAR YOUR STORY',
      tagline2: 'DEFINING URBAN STREETWEAR',
      categoryList: 'OVERSIZED TEES & HOODIES',
      ctaText: 'EXPLORE DROP',
      category: 'All',
      bgImage: '/assets/aistudio/0314d58d47918962a62f13129092baf2e608ec2d15252eacec2e182cae74309c_32b14310.png'
    }
  ];

  // Auto slide interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const activeSlide = heroSlides[currentSlide];

  // Category Banner items dynamically driven by Admin Panel category order
  const categoryBanners = useMemo(() => {
    const categoryImageMap: Record<string, string> = {
      't-shirts': '/assets/aistudio/bbbdd9b6c4ab32413590d25052fec04a0c0a000330301ac6c4dc3a486d928cd5_d56a8fd1.png',
      'pants': '/assets/images/product_denim_cargo_1792588592254.jpg',
      'pant': '/assets/images/product_denim_cargo_1792588592254.jpg',
      'hoodies': '/assets/images/product_premium_hoodie_1792588590406.jpg',
      'traditional wear': '/assets/images/product_panjabi_casual_1792588592268.jpg',
      'panjabi': '/assets/images/product_panjabi_casual_1792588592268.jpg',
      'jackets': '/assets/images/hero_fashion_yeamin_1792588589630.jpg',
      'shirts': '/assets/images/bangladeshi_classic_shirt_1793107155017.jpg',
      'polo shirts': 'https://images.unsplash.com/photo-1625910513413-562a1fc8f813?auto=format&fit=crop&w=500&q=80',
      'sweater': 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=500&q=80',
      'winter collection': '/assets/images/bangladeshi_hoodie_look_1793107183737.jpg'
    };

    const activeCats = categories.filter((c) => c !== 'All');

    // Display the first 4 active categories according to admin defined order
    return activeCats.slice(0, 4).map((cat) => {
      const catKey = cat.toLowerCase();
      const prodInCat = products.find(
        (p) => (p.category.toLowerCase() === catKey || p.category.toLowerCase().includes(catKey)) && p.images && p.images.length > 0
      );
      const img = categoryImageMap[catKey] || prodInCat?.images[0] || '/assets/images/product_premium_hoodie_1792588590406.jpg';
      return {
        title: cat.toUpperCase(),
        category: cat,
        image: img
      };
    });
  }, [categories, products]);

  // Dynamic Popular / Top Products managed directly by Admin & Store database
  const popularItems = useMemo(() => {
    // Only visible/active products (exclude archived)
    const activeProducts = products.filter((p) => p.status !== 'archived' && !p.isArchived);

    // Products explicitly marked as Top Product in Admin Panel
    const topProducts = activeProducts.filter((p) => p.isTopProduct);

    let chosen: Product[] = [...topProducts];

    // If fewer than 5 top products are marked, complement with other active products
    if (chosen.length < 5) {
      const remaining = activeProducts.filter((p) => !chosen.some((c) => c.id === p.id));
      const sortedRemaining = remaining.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        if (a.isBestSeller && !b.isBestSeller) return -1;
        if (!a.isBestSeller && b.isBestSeller) return 1;
        return 0;
      });
      chosen = [...chosen, ...sortedRemaining.slice(0, 5 - chosen.length)];
    }

    return chosen.slice(0, 10).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.discountPrice || p.regularPrice,
      regularPrice: p.regularPrice,
      image: p.images?.[0] || '/assets/aistudio/bbbdd9b6c4ab32413590d25052fec04a0c0a000330301ac6c4dc3a486d928cd5_d56a8fd1.png',
      category: p.category,
      swatches: (p.colors && p.colors.length > 0)
        ? p.colors.map((c) => c.hex)
        : ['#1C1C1E', '#D9D4C7'],
      isNew: Boolean(p.isNewArrival),
      isTop: Boolean(p.isTopProduct),
      rawProduct: p
    }));
  }, [products]);

  const handleCategoryNav = (cat: ProductCategory) => {
    setSelectedCategory(cat);
    setCurrentPage('shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProductClick = (item: { id: string }) => {
    openProductDetail(item.id);
  };

  const handleQuickBuyNow = (e: React.MouseEvent, item: (typeof popularItems)[0]) => {
    e.stopPropagation();
    const realProduct = item.rawProduct || products.find((p) => p.id === item.id) || products[0];
    const swatchIdx = selectedSwatches[item.id] || 0;
    const selectedColorName = realProduct.colors[swatchIdx]?.name || realProduct.colors[0]?.name || 'Standard';
    const defaultSize = realProduct.sizes?.includes('M') ? 'M' : realProduct.sizes?.[0] || 'M';

    buyNow(realProduct, defaultSize, selectedColorName, 1);
  };

  const handleQuickAddToCart = (e: React.MouseEvent, item: (typeof popularItems)[0]) => {
    e.stopPropagation();
    setAddingId(item.id);
    const realProduct = item.rawProduct || products.find((p) => p.id === item.id) || products[0];
    const swatchIdx = selectedSwatches[item.id] || 0;
    const selectedColorName = realProduct.colors[swatchIdx]?.name || realProduct.colors[0]?.name || 'Standard';
    const defaultSize = realProduct.sizes?.includes('M') ? 'M' : realProduct.sizes?.[0] || 'M';

    addToCart(realProduct, defaultSize, selectedColorName, 1, false);
    showToast('Added to Cart', `${item.name} added to your shopping bag.`, 'success');

    setTimeout(() => {
      setAddingId(null);
      setIsCartDrawerOpen(true);
    }, 400);
  };

  return (
    <div className="bg-[#0A0A0A] text-white min-h-screen selection:bg-white selection:text-black">
      {/* 1. HERO SECTION */}
      <section className="relative w-full h-[75vh] sm:h-[82vh] md:h-[88vh] bg-[#0E0E0E] overflow-hidden flex items-center">
        {/* Background Image with Cinematic Darkness & Subtle Contrast Scrim */}
        <div className="absolute inset-0 z-0">
          <img
            src={activeSlide.bgImage}
            alt={activeSlide.title}
            className="w-full h-full object-cover object-center transition-all duration-1000 ease-in-out scale-105"
            referrerPolicy="no-referrer"
          />
          {/* Subtle gradient overlays for flawless legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-black/40" />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 w-full flex flex-col justify-between h-full pt-16 pb-12">
          {/* Top Spacing */}
          <div />

          {/* Central Main Headline & CTA */}
          <div className="max-w-2xl space-y-4 sm:space-y-6">
            <h1 className="font-heading text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-[0.08em] text-white uppercase drop-shadow-md">
              {activeSlide.title}
            </h1>

            <div className="space-y-1 sm:space-y-1.5 text-white/90 font-medium tracking-[0.22em] text-xs sm:text-sm md:text-base uppercase">
              <p>{activeSlide.tagline1}</p>
              <p>{activeSlide.tagline2}</p>
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                onClick={() => handleCategoryNav(activeSlide.category)}
                className="inline-flex items-center gap-3 px-8 sm:px-10 py-3.5 sm:py-4 bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-black tracking-[0.2em] uppercase transition-all duration-200 shadow-xl cursor-pointer group"
              >
                <span>{activeSlide.ctaText}</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>

          {/* Bottom Bar: Slide Indicator on Left & New Arrivals on Right */}
          <div className="flex items-end justify-between pt-8 border-t border-white/10">
            {/* Slide Indicator: 01 —— 02 03 */}
            <div className="flex items-center gap-3 sm:gap-4 text-xs font-bold tracking-widest text-neutral-400 select-none">
              {heroSlides.map((slide, idx) => {
                const isActive = currentSlide === idx;
                return (
                  <button
                    key={slide.id}
                    onClick={() => setCurrentSlide(idx)}
                    className="flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <span className={isActive ? 'text-white font-extrabold' : 'text-neutral-500 hover:text-neutral-300'}>
                      {slide.badge}
                    </span>
                    {isActive && (
                      <span className="w-8 sm:w-12 h-[2px] bg-white inline-block" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Tagline & Category Hints */}
            <div className="text-right space-y-1 hidden sm:block">
              <p className="text-[11px] font-bold tracking-[0.25em] text-white uppercase">
                NEW ARRIVALS
              </p>
              <p className="text-[11px] font-medium tracking-[0.18em] text-neutral-400 uppercase">
                {activeSlide.categoryList}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATEGORY ROW (4 CARDS: T-SHIRTS, PANTS, HOODIES, PANJABI) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {categoryBanners.map((cat) => (
            <div
              key={cat.title}
              onClick={() => handleCategoryNav(cat.category)}
              className="group relative h-64 sm:h-72 md:h-80 lg:h-96 rounded-none overflow-hidden bg-neutral-900 cursor-pointer border border-white/5 shadow-lg"
            >
              {/* Image */}
              <img
                src={cat.image}
                alt={cat.title}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 brightness-75 group-hover:brightness-90"
                referrerPolicy="no-referrer"
              />

              {/* Dark Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

              {/* Text Overlay */}
              <div className="absolute bottom-5 left-5 right-5 space-y-1.5">
                <h3 className="font-heading text-lg sm:text-xl md:text-2xl font-black tracking-wider text-white uppercase">
                  {cat.title}
                </h3>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-300 group-hover:text-white transition-colors">
                  <span>Shop Now</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. POPULAR PRODUCTS SECTION */}
      {/* Off-white / light stone backdrop with high-contrast typography exactly as in mockup */}
      <section className="bg-[#EBE9E2] text-neutral-900 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="flex items-end justify-between mb-8 sm:mb-10 pb-4 border-b border-neutral-300/60">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold uppercase tracking-wider">
                  Curated Collection
                </span>
                <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-600" />
                  <span>Top Selected</span>
                </span>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-black">
                Top & Popular Products
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 mt-0.5 font-medium">
                Best selling and top-curated garments from our store collection
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedCategory('All');
                setCurrentPage('shop');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-black hover:text-neutral-700 transition-colors uppercase tracking-wider"
            >
              <span>View All</span>
              <span>→</span>
            </button>
          </div>

          {/* 5-Column Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5">
            {popularItems.map((item) => {
              const activeSwatch = selectedSwatches[item.id] || 0;
              const isAdding = addingId === item.id;
              const regularPrice = item.regularPrice || Math.round(item.price * 1.25);
              const hasDiscount = regularPrice > item.price;

              return (
                <div
                  key={item.id}
                  onClick={() => handleProductClick(item)}
                  className="group flex flex-col justify-between bg-white hover:bg-neutral-50 p-3 rounded-none transition-all duration-200 cursor-pointer border border-neutral-300 shadow-xs hover:border-black hover:shadow-md"
                >
                  {/* Product Image */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      openProductDetail(item.id);
                    }}
                    className="relative aspect-[4/5] bg-neutral-200 overflow-hidden mb-3 cursor-pointer"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                      {item.isTop && (
                        <div className="flex items-center gap-1 bg-amber-400 text-neutral-950 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 shadow-xs">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          <span>TOP</span>
                        </div>
                      )}
                      {item.isNew && !item.isTop && (
                        <div className="bg-black text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5">
                          New
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 mb-2.5 flex-1 flex flex-col justify-start">
                    <h3
                      onClick={(e) => {
                        e.stopPropagation();
                        openProductDetail(item.id);
                      }}
                      className="text-xs sm:text-sm font-bold text-black line-clamp-1 leading-snug hover:underline cursor-pointer"
                    >
                      {item.name}
                    </h3>

                    {/* Price with Discount */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm sm:text-base font-black text-black tabular-nums">
                        ৳ {item.price.toLocaleString('en-IN')}
                      </span>
                      {hasDiscount && (
                        <span className="text-[11px] text-neutral-400 line-through tabular-nums">
                          ৳ {regularPrice.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Color Swatch Dots */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {item.swatches.map((colorHex, idx) => (
                        <button
                          key={colorHex}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSwatches((prev) => ({ ...prev, [item.id]: idx }));
                          }}
                          style={{ backgroundColor: colorHex }}
                          className={`w-3.5 h-3.5 rounded-full border transition-all ${
                            activeSwatch === idx
                              ? 'ring-1.5 ring-black ring-offset-1 border-white scale-110'
                              : 'border-black/20 hover:scale-110'
                          }`}
                          title={`Color variant ${idx + 1}`}
                          aria-label={`Select color ${idx + 1}`}
                        />
                      ))}
                    </div>

                    {/* View Details Link */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProductDetail(item.id);
                      }}
                      className="text-[11px] font-bold text-neutral-600 hover:text-black py-0.5 flex items-center justify-between group/link cursor-pointer text-left w-full"
                    >
                      <span>বিস্তারিত দেখুন / View Details</span>
                      <span className="group-hover/link:translate-x-1 transition-transform">→</span>
                    </button>
                  </div>

                  {/* Dual Action Buttons: অ্যাড টু কার্ট & বাই নাউ */}
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-neutral-200">
                    <button
                      type="button"
                      onClick={(e) => handleQuickAddToCart(e, item)}
                      disabled={isAdding}
                      className="w-full py-2 px-1.5 bg-neutral-900 text-white hover:bg-black text-[10px] sm:text-[11px] font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs disabled:opacity-75"
                      title="Add to Shopping Cart"
                    >
                      {isAdding ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3 h-3 text-[#FF762E]" />
                          <span>অ্যাড টু কার্ট</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleQuickBuyNow(e, item)}
                      className="w-full py-2 px-1.5 bg-[#FF762E] text-white hover:bg-[#e8631c] text-[10px] sm:text-[11px] font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                      title="Direct Buy Now"
                    >
                      <Zap className="w-3 h-3 fill-white" />
                      <span>বাই নাউ</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. EDITORIAL SPLIT SHOWCASE (COMFORT MEETS STYLE & CRAFTED FOR MODERN MEN) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          {/* Left Panel: COMFORT MEETS STYLE (Model sitting on steps in cream hoodie) */}
          <div className="relative min-h-[460px] sm:min-h-[540px] lg:min-h-[600px] overflow-hidden bg-neutral-900 border border-white/10 group">
            <img
              src="/assets/images/editorial_cream_hoodie_1793118980188.jpg"
              alt="Comfort Meets Style"
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

            {/* Top Right Typography Lockup */}
            <div className="absolute top-8 right-8 text-right space-y-1">
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-[0.12em] text-white uppercase leading-tight">
                COMFORT<br />
                MEETS<br />
                STYLE
              </h2>
              <div className="w-16 h-[2px] bg-white ml-auto mt-2" />
            </div>

            {/* Bottom Caption / Button */}
            <div className="absolute bottom-8 left-8">
              <button
                onClick={() => handleCategoryNav('Hoodies')}
                className="px-6 py-3 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>Explore Hoodies</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* Right Panel: CRAFTED FOR MODERN MEN & BRAND STORY */}
          <div className="flex flex-col justify-between bg-[#111111] border border-white/10 p-8 sm:p-12 relative overflow-hidden">
            {/* Model back shot image in lower-right corner matching mockup */}
            <div className="absolute bottom-0 right-0 w-3/5 h-3/5 sm:w-1/2 sm:h-1/2 opacity-35 pointer-events-none overflow-hidden">
              <img
                src="/assets/images/editorial_story_backshot_1793118981432.jpg"
                alt="Vantrel Streetwear Back Detail"
                className="w-full h-full object-cover object-left-top"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="relative z-10 space-y-6 max-w-md">
              <span className="font-heading text-3xl sm:text-4xl font-black tracking-[0.2em] text-white uppercase">
                VANTREL
              </span>

              <h3 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-wider text-white uppercase leading-tight">
                CRAFTED FOR<br />
                MODERN MEN
              </h3>

              <p className="text-sm sm:text-base text-neutral-400 font-normal leading-relaxed">
                Vantrel is a men's clothing brand built for those who value simplicity, quality and timeless style.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setCurrentPage('about');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-3 px-6 py-3 border border-white text-white hover:bg-white hover:text-black text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  <span>OUR STORY</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* 3 Feature / Trust Badges directly inside the brand narrative area as shown in mockup */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 mt-12 border-t border-white/15">
              {/* Badge 1: Fast Delivery */}
              <div className="space-y-1.5">
                <Truck className="w-6 h-6 text-white stroke-[1.5]" />
                <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Fast Delivery
                </h4>
                <p className="text-[11px] text-neutral-400">
                  All Over Bangladesh
                </p>
              </div>

              {/* Badge 2: Secure Payment */}
              <div className="space-y-1.5">
                <ShieldCheck className="w-6 h-6 text-white stroke-[1.5]" />
                <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Secure Payment
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Cash on Delivery
                </p>
              </div>

              {/* Badge 3: 24/7 Support */}
              <div className="space-y-1.5">
                <Headphones className="w-6 h-6 text-white stroke-[1.5]" />
                <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  24/7 Support
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Always Here for You
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BRAND STATEMENT DIVIDER */}
      <section className="py-12 border-t border-white/10 text-center">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-center gap-4 text-neutral-500">
          <div className="flex-1 h-[1px] bg-white/15" />
          <p className="text-xs sm:text-sm font-bold tracking-[0.3em] text-neutral-300 uppercase select-none">
            WEAR YOUR STORY — VANTREL
          </p>
          <div className="flex-1 h-[1px] bg-white/15" />
        </div>
      </section>
    </div>
  );
};
