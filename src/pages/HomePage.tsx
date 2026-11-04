import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCategory, Product } from '../types';
import {
  Truck,
  ShieldCheck,
  Headphones,
  ArrowRight,
  Check,
  Zap,
  ShoppingBag
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
      bgImage: '/src/assets/images/editorial_cream_hoodie_1793118980188.jpg'
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

  // Category Banner items matching mockup
  const categoryBanners: {
    title: string;
    category: ProductCategory;
    image: string;
  }[] = [
    {
      title: 'T-SHIRTS',
      category: 'T-Shirts',
      image: '/assets/aistudio/bbbdd9b6c4ab32413590d25052fec04a0c0a000330301ac6c4dc3a486d928cd5_d56a8fd1.png'
    },
    {
      title: 'PANTS',
      category: 'Pants',
      image: '/src/assets/images/product_denim_cargo_1792588592254.jpg'
    },
    {
      title: 'HOODIES',
      category: 'Hoodies',
      image: '/src/assets/images/product_premium_hoodie_1792588590406.jpg'
    },
    {
      title: 'PANJABI',
      category: 'Traditional Wear',
      image: '/src/assets/images/product_panjabi_casual_1792588592268.jpg'
    }
  ];

  // Exactly matching the 5 Popular Products from the reference mockup
  const popularItems = [
    {
      id: 'prod-001',
      name: 'Essential Oversized T-Shirt',
      price: 1250,
      image: '/assets/aistudio/bbbdd9b6c4ab32413590d25052fec04a0c0a000330301ac6c4dc3a486d928cd5_d56a8fd1.png',
      category: 'T-Shirts' as ProductCategory,
      swatches: ['#1C1C1E', '#D9D4C7', '#4D5154']
    },
    {
      id: 'prod-002',
      name: 'Minimal Logo T-Shirt',
      price: 1150,
      image: '/src/assets/images/product_minimal_white_tee_1793118980970.jpg',
      category: 'T-Shirts' as ProductCategory,
      swatches: ['#FAF8F5', '#37383B', '#161618']
    },
    {
      id: 'prod-003',
      name: 'Cargo Pants',
      price: 2350,
      image: '/src/assets/images/product_denim_cargo_1792588592254.jpg',
      category: 'Pants' as ProductCategory,
      swatches: ['#1E1F22', '#3B4134', '#565759']
    },
    {
      id: 'prod-004',
      name: 'Signature Hoodie',
      price: 2850,
      image: '/src/assets/images/product_premium_hoodie_1792588590406.jpg',
      category: 'Hoodies' as ProductCategory,
      swatches: ['#111111', '#3E4044', '#1F2E26']
    },
    {
      id: 'prod-005',
      name: 'Classic Panjabi',
      price: 1950,
      image: '/src/assets/images/product_panjabi_casual_1792588592268.jpg',
      category: 'Traditional Wear' as ProductCategory,
      swatches: ['#EAE6DD', '#141416', '#444C3D']
    }
  ];

  const handleCategoryNav = (cat: ProductCategory) => {
    setSelectedCategory(cat);
    setCurrentPage('shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProductClick = (item: typeof popularItems[0]) => {
    openProductDetail(item.id);
  };

  const handleQuickBuyNow = (e: React.MouseEvent, item: typeof popularItems[0]) => {
    e.stopPropagation();
    const realProduct =
      products.find((p) => p.id === item.id) ||
      products.find((p) => p.name.toLowerCase().includes(item.name.toLowerCase())) ||
      ({
        ...products[0],
        id: item.id,
        name: item.name,
        discountPrice: item.price,
        regularPrice: Math.round(item.price * 1.25),
        images: [item.image],
        category: item.category,
        sizes: ['M', 'L', 'XL', 'XXL'],
        colors: item.swatches.map((hex, i) => ({ name: `Color ${i + 1}`, hex }))
      } as Product);

    const swatchIdx = selectedSwatches[item.id] || 0;
    const selectedColorName = realProduct.colors[swatchIdx]?.name || realProduct.colors[0]?.name || 'Standard';

    buyNow(realProduct, 'L', selectedColorName, 1);
  };

  const handleQuickAddToCart = (e: React.MouseEvent, item: typeof popularItems[0]) => {
    e.stopPropagation();
    setAddingId(item.id);

    // Find actual product in state or construct safe cart item
    const realProduct =
      products.find((p) => p.id === item.id) ||
      products.find((p) => p.name.toLowerCase().includes(item.name.toLowerCase())) ||
      ({
        ...products[0],
        id: item.id,
        name: item.name,
        discountPrice: item.price,
        regularPrice: Math.round(item.price * 1.25),
        images: [item.image],
        category: item.category,
        sizes: ['M', 'L', 'XL', 'XXL'],
        colors: item.swatches.map((hex, i) => ({ name: `Color ${i + 1}`, hex }))
      } as Product);

    const swatchIdx = selectedSwatches[item.id] || 0;
    const selectedColorName = realProduct.colors[swatchIdx]?.name || realProduct.colors[0]?.name || 'Standard';

    addToCart(realProduct, 'L', selectedColorName, 1, false);
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
              <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-black">
                Popular Products
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 mt-1 font-medium">
                Best selling items from our collection
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
              const regularPrice = Math.round(item.price * 1.25);

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
                    <div className="absolute top-2 left-2 bg-black text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5">
                      New
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
                      <span className="text-[11px] text-neutral-400 line-through tabular-nums">
                        ৳ {regularPrice.toLocaleString('en-IN')}
                      </span>
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
              src="/src/assets/images/editorial_cream_hoodie_1793118980188.jpg"
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
                src="/src/assets/images/editorial_story_backshot_1793118981432.jpg"
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
