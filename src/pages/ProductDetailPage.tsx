import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { BANGLADESH_DIVISIONS } from '../data/bangladeshData';
import { toDisplayImageUrl, handleProxyImageError, preloadProductImage } from '../utils/imageProxy';
import { ProductImage } from '../components/ProductImage';
import { trackMetaViewContent } from '../utils/metaPixel';
import { isProductOutOfStock, shouldHideProductFromPublic } from '../utils/stockVisibility';
import { resolveProductGsmLabel, resolveProductFabricLabel } from '../utils/productGsm';
import {
  Heart,
  ShoppingBag,
  Zap,
  Ruler,
  Truck,
  RotateCcw,
  ShieldCheck,
  Star,
  ChevronLeft,
  Check,
  Share2,
  Clock,
  Video,
  Camera,
  Play,
  Image as ImageIcon,
  Ban
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const {
    selectedProductId,
    getProductById,
    addProductReview,
    setCurrentPage,
    addToCart,
    isInWishlist,
    toggleWishlist,
    setIsSizeGuideOpen,
    settings,
    products,
    isProductsLoading,
    showToast
  } = useStore();

  const hasDeepLinkProductUrl =
    typeof window !== 'undefined' &&
    (window.location.pathname.toLowerCase().startsWith('/product/') ||
      new URLSearchParams(window.location.search).has('product') ||
      new URLSearchParams(window.location.search).has('productId'));

  const targetProductId = selectedProductId || (!hasDeepLinkProductUrl ? products[0]?.id || '' : '');
  const product = targetProductId ? getProductById(targetProductId) : undefined;

  const isSingleImageProduct = (product?.images?.length || 0) <= 1 || (product?.colors?.length || 0) <= 1;
  const defaultInitialColor = product?.colors?.[0]?.name || 'Standard';

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [sizeError, setSizeError] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<string>(defaultInitialColor);
  const [quantity, setQuantity] = useState<number>(1);
  const [isZoomed, setIsZoomed] = useState(false);
  const [measurementUnit, setMeasurementUnit] = useState<'in' | 'cm'>('in');

  // Delivery Estimator state
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Dhaka');

  // Review Form state
  const [newReviewAuthor, setNewReviewAuthor] = useState('');
  const [newReviewComment, setNewReviewComment] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewPhoto, setNewReviewPhoto] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Structured Data (JSON-LD Product Schema), title, and OpenGraph tags are managed centrally by DynamicMetaTags.tsx
  useEffect(() => {
    setActiveImageIndex(0);
    setSelectedSize('');
    setSizeError(false);
    setSelectedColor(product?.colors?.[0]?.name || 'Standard');
    if (product?.images && product.images.length > 1) {
      product.images.slice(1, 5).forEach((img) => {
        preloadProductImage(img, 900);
      });
    }
  }, [product?.id]);

  // Fire Meta Pixel ViewContent for Ad attribution & dynamic product remarketing
  useEffect(() => {
    if (!product?.id) return;
    trackMetaViewContent(
      product,
      settings.metaPixelId,
      settings.isMetaPixelEnabled ?? true
    );
  }, [product?.id, settings.metaPixelId, settings.isMetaPixelEnabled]);

  // Show fast dark skeleton while deep-linked /product/:slug resolves instead of flashing "Product not found"
  if (!product && (isProductsLoading || (hasDeepLinkProductUrl && !selectedProductId))) {
    return (
      <div className="bg-[#0A0A0A] text-white min-h-[75vh] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-pulse">
          <div className="h-4 w-32 bg-white/10 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-7">
              <div className="aspect-[4/5] bg-white/5 rounded-3xl border border-white/10" />
            </div>
            <div className="lg:col-span-5 space-y-5 bg-[#141414] p-6 sm:p-8 rounded-3xl border border-white/10">
              <div className="h-3 w-40 bg-white/10 rounded" />
              <div className="h-8 w-3/4 bg-white/15 rounded" />
              <div className="h-10 w-36 bg-white/10 rounded" />
              <div className="grid grid-cols-5 gap-2 pt-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="h-10 bg-white/10 rounded-xl" />
                ))}
              </div>
              <div className="h-12 bg-white/10 rounded-xl mt-4" />
              <div className="h-12 bg-[#FF762E]/30 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback if product does not exist or is hidden from public store
  if (!product || shouldHideProductFromPublic(product, settings.outOfStockDefaultBehavior)) {
    return (
      <div className="bg-[#0A0A0A] text-white min-h-[60vh] max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">Product not found</h1>
        <p className="text-xs text-neutral-400 mt-2">
          এই পণ্যটি বর্তমানে স্টোরে প্রদর্শনের জন্য উপলব্ধ নয়।
        </p>
        <button
          onClick={() => setCurrentPage('shop')}
          className="mt-4 px-6 py-2.5 bg-[#FF762E] text-white rounded-lg font-semibold cursor-pointer"
        >
          Return to Shop
        </button>
      </div>
    );
  }

  // Effective color: auto-fallback to default so customers can order without choosing color
  const effectiveColor = selectedColor || defaultInitialColor;
  const productOutOfStock = isProductOutOfStock(product);

  // Variant matching
  const matchedVariant = selectedSize
    ? product.variants.find(
        (v) => v.size === selectedSize && (v.color === effectiveColor || v.color === selectedColor)
      )
    : undefined;
  const currentStock = productOutOfStock
    ? 0
    : matchedVariant
    ? matchedVariant.stock
    : product.totalStock;

  const price = product.discountPrice ?? product.regularPrice;
  const hasDiscount = product.discountPrice && product.discountPrice < product.regularPrice;
  const inWishlist = isInWishlist(product.id);
  const resolvedGsm = resolveProductGsmLabel(product);
  const resolvedFabric = resolveProductFabricLabel(product);

  const handleAddToCart = () => {
    if (productOutOfStock || currentStock <= 0) {
      showToast(
        'Out of Stock (স্টক শেষ)',
        'দুঃখিত, এই প্রোডাক্টটির স্টক বর্তমানে শেষ। অর্ডার করা যাবে না।',
        'error'
      );
      return;
    }
    if (!selectedSize) {
      setSizeError(true);
      showToast('সাইজ নির্বাচন করুন', 'কার্টে যোগ করতে অনুগ্রহ করে আপনার সাইজ নির্বাচন করুন।', 'error');
      return;
    }
    setSizeError(false);
    addToCart(product, selectedSize, effectiveColor, quantity);
  };

  const handleBuyNow = () => {
    if (productOutOfStock || currentStock <= 0) {
      showToast(
        'Out of Stock (স্টক শেষ)',
        'দুঃখিত, এই প্রোডাক্টটির স্টক বর্তমানে শেষ। অর্ডার করা যাবে না।',
        'error'
      );
      return;
    }
    if (!selectedSize) {
      setSizeError(true);
      showToast('সাইজ নির্বাচন করুন', 'অর্ডার করতে অনুগ্রহ করে আগে আপনার সাইজ নির্বাচন করুন।', 'error');
      return;
    }
    setSizeError(false);
    const success = addToCart(product, selectedSize, effectiveColor, quantity);
    if (success) {
      setCurrentPage('checkout');
    }
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewAuthor.trim() || !newReviewComment.trim()) {
      showToast('Incomplete Review', 'Please provide your name and review remarks.', 'error');
      return;
    }

    const review = {
      id: `rev-${Date.now()}`,
      author: newReviewAuthor.trim(),
      rating: newReviewRating,
      date: new Date().toISOString().split('T')[0],
      comment: newReviewComment.trim(),
      verifiedPurchase: true,
      location: selectedDistrict,
      photos: newReviewPhoto.trim() ? [newReviewPhoto.trim()] : undefined
    };

    addProductReview(product.id, review);

    setReviewSubmitted(true);
    setNewReviewAuthor('');
    setNewReviewComment('');
    setNewReviewPhoto('');
    showToast('Review Submitted', 'Thank you for your authentic customer feedback!', 'success');
  };

  // Delivery estimate calculation
  const isDhaka = selectedDistrict.toLowerCase() === 'dhaka';
  const deliveryDays = isDhaka ? '1–2 Working Days' : '2–4 Working Days';
  const deliveryCost = isDhaka
    ? (settings.deliveryFeeInsideDhaka ?? 0)
    : (settings.deliveryFeeOutsideDhaka ?? 50);

  // Related products
  const relatedProducts = products
    .filter(
      (p) =>
        p.id !== product.id &&
        !shouldHideProductFromPublic(p, settings.outOfStockDefaultBehavior) &&
        (p.category === product.category || p.isFeatured)
    )
    .slice(0, 4);

  return (
    <div
      className="bg-[#0A0A0A] text-white min-h-screen py-8"
      itemScope
      itemType="https://schema.org/Product"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <button
            onClick={() => setCurrentPage('shop')}
            className="flex items-center gap-1 hover:text-[#FF762E] font-semibold transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Catalog</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 text-neutral-500">
            <span>Home</span>
            <span>/</span>
            <span>{product.category}</span>
            <span>/</span>
            <span className="text-white font-semibold truncate max-w-xs">{product.name}</span>
          </div>
        </div>

        {/* Product Details Hero Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left: Sticky Image & Video Gallery */}
          <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-24">
            {/* Media Header & GSM Badge */}
            <div className="flex items-center justify-between pb-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-[#E5E1D5] shadow-xs text-xs font-bold uppercase tracking-wider text-[#14221C]">
                <ImageIcon className="w-3.5 h-3.5 text-[#FF762E]" />
                <span>High-Res Editorial Photography ({product.images.length})</span>
              </div>

              {resolvedGsm && (
                <span className="px-2.5 py-1 bg-[#14221C] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider">
                  {resolvedGsm} Weight
                </span>
              )}
            </div>

            {/* Main Stage Display (Photo with Zoom) */}
            <div
              className="relative aspect-[4/5] bg-white rounded-3xl overflow-hidden border border-[#E5E1D5] shadow-sm cursor-crosshair group"
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
            >
              <ProductImage
                itemProp="image"
                rawSrc={product.images[activeImageIndex] || product.images[0]}
                alt={`${product.name} - ${product.category}${resolvedFabric ? ` (${resolvedFabric})` : ''} | ${product.brand || 'VANTREL OUTFIT'}`}
                widths={[560, 900]}
                defaultWidth={900}
                sizes="(max-width: 1024px) 94vw, 660px"
                width={800}
                height={1000}
                priority={true}
                skeletonTone="light"
                className={`w-full h-full object-cover object-center transition-transform duration-300 ${
                  isZoomed ? 'scale-125' : 'scale-100'
                } ${productOutOfStock ? 'opacity-60 grayscale-[35%]' : ''}`}
              />

              {/* Tag / Badge */}
              <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
                {productOutOfStock && (
                  <span className="px-3.5 py-1.5 bg-rose-600 text-white text-xs font-black uppercase tracking-wider rounded-md shadow-lg">
                    OUT OF STOCK · স্টক শেষ
                  </span>
                )}
                {product.isNewArrival && (
                  <span className="px-3 py-1 bg-[#14221C] text-white text-xs font-bold uppercase tracking-wider rounded-md">
                    New Arrival
                  </span>
                )}
              </div>

              {/* Wishlist Button */}
              <button
                onClick={() => toggleWishlist(product.id)}
                className={`absolute top-4 right-4 p-3 rounded-full backdrop-blur-md shadow-md transition-all cursor-pointer ${
                  inWishlist
                    ? 'bg-rose-50 text-rose-500'
                    : 'bg-white/80 text-[#202522] hover:bg-white hover:text-rose-500'
                }`}
                aria-label="Wishlist"
              >
                <Heart className={`w-5 h-5 ${inWishlist ? 'fill-rose-500 scale-110' : ''}`} />
              </button>
            </div>

            {/* Photo Thumbnails */}
            <div className="flex gap-3 overflow-x-auto pb-2 items-center">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveImageIndex(idx);
                  }}
                  className={`relative w-20 h-24 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    activeImageIndex === idx
                      ? 'border-[#14221C] ring-2 ring-[#14221C]/20 scale-102'
                      : 'border-[#E5E1D5] opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={toDisplayImageUrl(img, 140)}
                    alt={`${product.name} - ${product.category} View ${idx + 1} | ${product.brand || 'VANTREL OUTFIT'}`}
                    width={80}
                    height={96}
                    loading="eager"
                    decoding="async"
                    onError={handleProxyImageError}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="lg:col-span-5 space-y-6 bg-[#141414] text-white p-6 sm:p-8 rounded-3xl border border-white/10 shadow-xl">
            {/* Header info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-300">
                <span className="uppercase tracking-widest font-bold text-[#FF762E]">
                  <span itemProp="brand" itemScope itemType="https://schema.org/Brand">
                    <span itemProp="name">{product.brand || 'VANTREL OUTFIT'}</span>
                  </span>{' '}
                  · <span itemProp="category">{product.category}</span>
                </span>
                <span className="font-mono text-[11px] text-neutral-300">
                  SKU: <span itemProp="sku">{matchedVariant ? matchedVariant.sku : product.sku}</span>
                </span>
              </div>

              <h1 itemProp="name" className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {product.name}
              </h1>

              {/* Rating */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(product.rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-neutral-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-white tabular-nums">
                  {product.rating}
                </span>
                <span className="text-xs text-neutral-400">
                  ({product.reviewCount} customer reviews)
                </span>
              </div>
            </div>

            {/* Price Row */}
            <div
              itemProp="offers"
              itemScope
              itemType="https://schema.org/Offer"
              className="flex items-baseline gap-3 py-3 border-y border-white/10"
            >
              <meta itemProp="priceCurrency" content="BDT" />
              <link
                itemProp="availability"
                href={currentStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'}
              />
              <span itemProp="price" content={String(price)} className="text-3xl font-extrabold text-white tabular-nums">
                ৳ {price.toLocaleString()}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-neutral-400 line-through tabular-nums">
                    ৳ {product.regularPrice.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-[#FF762E] uppercase tracking-wider">
                    ({product.discountPercent}% OFF)
                  </span>
                </>
              )}
            </div>

            {/* Stock indicator & Out of Stock Alert */}
            {productOutOfStock || currentStock <= 0 ? (
              <div className="p-3.5 bg-rose-950/60 border border-rose-500/50 rounded-2xl flex items-center gap-3 text-xs text-rose-200">
                <Ban className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <div className="font-black uppercase tracking-wider text-rose-300">
                    Out of Stock · স্টক শেষ
                  </div>
                  <p className="text-[11px] text-rose-200/80 mt-0.5">
                    এই পণ্যটি বর্তমানে স্টক শেষ হয়ে গেছে, তাই এখন অর্ডার করা যাবে না।
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <div
                  className={`w-2 h-2 rounded-full ${
                    currentStock > 5 ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="font-medium text-neutral-300">
                  {currentStock > 5
                    ? `In Stock (${currentStock} units ready for immediate dispatch)`
                    : `Low Stock — Only ${currentStock} left in warehouse`}
                </span>
              </div>
            )}

            {/* Color Selector / Single-Image Auto Badge */}
            {isSingleImageProduct ? (
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                    style={{ backgroundColor: product.colors?.[0]?.hex || '#14221C' }}
                  />
                  <span className="text-xs font-bold text-white">
                    কালার: <span className="font-normal text-neutral-300">{product.colors?.[0]?.name || 'ছবির অনুরূপ (Standard)'}</span>
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                  সিলেক্ট করার প্রয়োজন নেই
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-300 uppercase tracking-wider">
                    Color: <span className="font-normal text-white">{selectedColor}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColor(c.name)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        selectedColor === c.name
                          ? 'border-[#FF762E] bg-[#FF762E]/20 text-white shadow-xs'
                          : 'border-white/15 bg-white/5 text-neutral-300 hover:border-white/30'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selector + Size Guide Button */}
            <div
              className={`space-y-2 rounded-2xl transition-all ${
                sizeError && !selectedSize
                  ? 'p-3 border border-rose-500/80 bg-rose-500/10'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-300 uppercase tracking-wider">
                  Size:{' '}
                  {selectedSize ? (
                    <span className="font-semibold text-white">{selectedSize}</span>
                  ) : (
                    <span className={`font-semibold normal-case ${sizeError ? 'text-rose-400' : 'text-[#FF762E]'}`}>
                      * সাইজ সিলেক্ট করুন
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSizeGuideOpen(true)}
                  className="flex items-center gap-1 text-[#FF762E] hover:underline font-bold text-xs cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Size Guide</span>
                </button>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {product.sizes.map((sz) => {
                  const variant = product.variants.find(
                    (v) => v.size === sz && v.color === selectedColor
                  );
                  const isSizeOos = productOutOfStock || (variant ? variant.stock <= 0 : false);

                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={isSizeOos}
                      onClick={() => {
                        setSelectedSize(sz);
                        setSizeError(false);
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all relative ${
                        isSizeOos
                          ? 'opacity-30 line-through cursor-not-allowed bg-neutral-900 border-white/5'
                          : selectedSize === sz
                          ? 'border-[#FF762E] bg-[#FF762E] text-white shadow-sm cursor-pointer'
                          : 'border-white/15 bg-white/5 text-white hover:border-[#FF762E] cursor-pointer'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>

              {sizeError && !selectedSize && !productOutOfStock && (
                <p className="text-[11px] font-semibold text-rose-400 pt-1">
                  অর্ডার বা কার্টে যোগ করার আগে অনুগ্রহ করে উপরে থেকে আপনার সাইজ নির্বাচন করুন।
                </p>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center gap-4 pt-2">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Quantity:
              </span>
              <div className="flex items-center border border-white/15 bg-white/5 rounded-xl overflow-hidden">
                <button
                  type="button"
                  disabled={productOutOfStock || currentStock <= 0}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3.5 py-2 text-sm font-bold text-white hover:bg-white/10 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <span className="px-4 py-1 text-sm font-bold tabular-nums text-white">
                  {quantity}
                </span>
                <button
                  type="button"
                  disabled={productOutOfStock || currentStock <= 0}
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, currentStock), q + 1))}
                  className="px-3.5 py-2 text-sm font-bold text-white hover:bg-white/10 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            {/* Primary Action Buttons: ADD TO CART & BUY NOW (or Disabled Out-Of-Stock State) */}
            {productOutOfStock || currentStock <= 0 ? (
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  disabled
                  className="w-full py-4 px-6 bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Ban className="w-4 h-4 text-rose-400" />
                  <span>OUT OF STOCK · বর্তমানে অর্ডার করা যাবে না</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full py-3.5 px-6 bg-black hover:bg-neutral-900 border border-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-[#FF762E] group-hover:scale-110 transition-transform" />
                  <span>অ্যাড টু কার্ট / Add To Bag (৳ {(price * quantity).toLocaleString()})</span>
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full py-3.5 px-6 bg-[#FF762E] hover:bg-[#e8631c] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>বাই নাউ / Buy Now (Instant Checkout)</span>
                </button>
              </div>
            )}

            {/* Seamless Order Assurance */}
            <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 flex items-center justify-between gap-2 text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-semibold">
                  ঢাকায় ফ্রি ডেলিভারি (৳০) · সাব-এরিয়া ও ৬৩ জেলায় মাত্র ৳৫০
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                ক্যাশ অন ডেলিভারি
              </span>
            </div>

            {/* Trust Markers */}
            <div className="grid grid-cols-2 gap-3 pt-3 text-[11px] text-neutral-300 border-t border-white/10">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#FF762E] shrink-0" />
                <span>7-Day Hassle-Free Size Exchange</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#FF762E] shrink-0" />
                <span>100% Authentic Fabric Guarantee</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Specification Details Tabs */}
        <div className="bg-[#141414] text-white rounded-3xl border border-white/10 p-6 sm:p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Description */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Product Story & Details
              </h2>
              <p itemProp="description" className="text-xs leading-relaxed text-neutral-300">
                {product.description}
              </p>
              <div className="text-xs space-y-1.5 pt-2 text-neutral-300">
                <p>• <strong className="text-white">Silhouette:</strong> {product.fit}</p>
                <p>• <strong className="text-white">Category:</strong> {product.category} ({product.subCategory})</p>
                <p>• <strong className="text-white">Country of Origin:</strong> Bangladesh (Dhaka Atelier)</p>
              </div>
            </div>

            {/* Fabric & Material */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Fabric & Composition
              </h2>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">
                    {resolvedFabric}
                  </span>
                  {resolvedGsm && (
                    <span className="px-2 py-0.5 bg-[#FF762E] text-white text-[10px] font-bold rounded shrink-0">
                      {resolvedGsm}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Carefully engineered for maximum durability, breathability in humid Dhaka summers, and tactile luxury against the skin.
                </p>
              </div>
            </div>

            {/* Garment Care */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Wash & Care Instructions
              </h2>
              <ul className="text-xs space-y-1.5 text-neutral-300">
                {product.care.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#FF762E] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Interactive Garment Measurement Chart */}
          <div className="pt-6 border-t border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-[#FF762E]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Garment Exact Measurements Chart
                </h3>
              </div>

              {/* Unit Switcher */}
              <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMeasurementUnit('in')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    measurementUnit === 'in' ? 'bg-[#FF762E] text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Inches (in)
                </button>
                <button
                  type="button"
                  onClick={() => setMeasurementUnit('cm')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    measurementUnit === 'cm' ? 'bg-[#FF762E] text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Centimeters (cm)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0D0D0D] text-neutral-300 text-[11px] uppercase tracking-wider font-semibold border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Chest Width</th>
                    <th className="px-4 py-3">Body Length</th>
                    <th className="px-4 py-3">Sleeve Length</th>
                    <th className="px-4 py-3">Shoulder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 tabular-nums bg-[#111111] text-neutral-300">
                  {product.sizes.map((sz) => {
                    const m = product.measurements?.[sz] || {
                      chest: sz === 'M' ? 42 : sz === 'L' ? 44 : sz === 'XL' ? 46 : 48,
                      length: sz === 'M' ? 29 : sz === 'L' ? 30 : sz === 'XL' ? 31 : 32,
                      sleeve: sz === 'M' ? 24.5 : sz === 'L' ? 25 : sz === 'XL' ? 25.5 : 26,
                      shoulder: sz === 'M' ? 20 : sz === 'L' ? 21 : sz === 'XL' ? 22 : 23
                    };
                    const factor = measurementUnit === 'in' ? 1 : 2.54;
                    const fmt = (v?: number) => (v ? (measurementUnit === 'in' ? `${v}"` : `${Math.round(v * factor)} cm`) : '—');

                    return (
                      <tr
                        key={sz}
                        className={`hover:bg-white/5 transition-colors ${
                          selectedSize === sz ? 'bg-[#FF762E]/15 font-semibold text-white' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-bold text-white">{sz}</td>
                        <td className="px-4 py-3">{fmt(m.chest)}</td>
                        <td className="px-4 py-3">{fmt(m.length)}</td>
                        <td className="px-4 py-3">{fmt(m.sleeve)}</td>
                        <td className="px-4 py-3">{fmt(m.shoulder)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Reviews Section with Photo Review Support */}
          <div className="pt-8 border-t border-white/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Verified Customer Reviews & Photos
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Real experiences and outfit photos from customers across Bangladesh.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                <div className="flex items-center text-amber-400">
                  <Star className="w-5 h-5 fill-amber-400" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-white tabular-nums">
                    {product.rating} out of 5
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    Based on {product.reviewCount} customer ratings
                  </div>
                </div>
              </div>
            </div>

            {/* List of Reviews with Photos */}
            <div className="space-y-4">
              {product.reviews && product.reviews.length > 0 ? (
                product.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{rev.author}</span>
                        {rev.verifiedPurchase && (
                          <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded">
                            Verified Buyer
                          </span>
                        )}
                        {rev.location && (
                          <span className="text-[11px] text-neutral-400">· {rev.location}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-400 tabular-nums">
                        {rev.date}
                      </span>
                    </div>

                    <div className="flex items-center text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < rev.rating ? 'fill-amber-400' : 'text-neutral-700'
                          }`}
                        />
                      ))}
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                      "{rev.comment}"
                    </p>

                    {/* Customer Review Photos */}
                    {rev.photos && rev.photos.length > 0 && (
                      <div className="flex gap-2 pt-1">
                        {rev.photos.map((photo, pIdx) => (
                          <div
                            key={pIdx}
                            className="relative w-16 h-20 rounded-xl overflow-hidden border border-white/15 shadow-xs cursor-pointer group"
                            onClick={() => {
                              showToast('Customer Photo', 'Authentic verified customer wearing this piece.', 'info');
                            }}
                          >
                            <img
                              src={photo}
                              alt={`${product.name} verified customer review outfit photo`}
                              width={64}
                              height={80}
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-108 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-300 italic">
                  Be the first to leave an honest review for this piece!
                </p>
              )}
            </div>

            {/* Write a Review Form with Photo Upload Option */}
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Leave Your Rating, Review & Outfit Photo
                </h3>
                <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-[#FF762E]" />
                  <span>Photo Reviews Welcome</span>
                </span>
              </div>

              <form onSubmit={handleReviewSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Your Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Tanvir Ahmed"
                      value={newReviewAuthor}
                      onChange={(e) => setNewReviewAuthor(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#0D0D0D] text-white placeholder:text-neutral-500 border border-white/15 rounded-lg focus:outline-none focus:border-[#FF762E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Rating
                    </label>
                    <select
                      value={newReviewRating}
                      onChange={(e) => setNewReviewRating(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-[#0D0D0D] text-white border border-white/15 rounded-lg focus:outline-none focus:border-[#FF762E]"
                    >
                      <option value={5}>5 Stars - Outstanding Fabric & Drape</option>
                      <option value={4}>4 Stars - Very Good Quality</option>
                      <option value={3}>3 Stars - Average Sizing</option>
                      <option value={2}>2 Stars - Below Expectation</option>
                      <option value={1}>1 Star - Poor Fit</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Your Review & Fit Experience <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Share details about the GSM fabric feel, stitching accuracy, and styling..."
                    value={newReviewComment}
                    onChange={(e) => setNewReviewComment(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0D0D0D] text-white placeholder:text-neutral-500 border border-white/15 rounded-lg focus:outline-none focus:border-[#FF762E]"
                  />
                </div>

                {/* Photo attachment helper */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Attach Customer Outfit Photo (Optional)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      placeholder="Paste image URL (e.g. /assets/images/... or web URL)"
                      value={newReviewPhoto}
                      onChange={(e) => setNewReviewPhoto(e.target.value)}
                      className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-[#0D0D0D] text-white placeholder:text-neutral-500 border border-white/15 rounded-lg focus:outline-none focus:border-[#FF762E]"
                    />
                    <button
                      type="button"
                      onClick={() => setNewReviewPhoto(product.images[0])}
                      className="px-3 py-2 bg-white/10 border border-white/15 text-[11px] font-semibold text-white rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      Use Product Fit Photo
                    </button>
                  </div>
                  {newReviewPhoto && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={newReviewPhoto}
                        alt="Preview"
                        width={40}
                        height={48}
                        loading="lazy"
                        decoding="async"
                        className="w-10 h-12 object-cover rounded-md border border-white/15"
                      />
                      <span className="text-[11px] text-emerald-400 font-semibold">Photo attached!</span>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="min-h-[44px] px-6 py-2.5 bg-[#FF762E] hover:bg-[#e8631c] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-sm"
                  >
                    Submit Review & Photos
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Related Products Showcase */}
        {relatedProducts.length > 0 && (
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl font-extrabold text-white tracking-tight">
                  You May Also Like
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Pairs seamlessly with your selected aesthetic.
                </p>
              </div>
              <button
                onClick={() => setCurrentPage('shop')}
                className="text-xs font-bold uppercase tracking-wider text-[#FF762E] hover:underline"
              >
                View Catalog
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
