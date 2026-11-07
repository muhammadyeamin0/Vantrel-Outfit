import React, { useState } from 'react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { Heart, ShoppingBag, Eye, Star, Zap } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const {
    openProductDetail,
    addToCart,
    buyNow,
    isInWishlist,
    toggleWishlist,
    addToComparison,
    removeFromComparison,
    isInComparison
  } = useStore();
  const [isHovered, setIsHovered] = useState(false);
  const defaultCardColor = product.colors?.[0]?.name || 'Standard';
  const [selectedSize, setSelectedSize] = useState<string>(
    product.sizes?.includes('M') ? 'M' : product.sizes?.[0] || 'M'
  );
  const [selectedColor, setSelectedColor] = useState<string>(defaultCardColor);

  const inWishlist = isInWishlist(product.id);
  const price = product.discountPrice ?? product.regularPrice;
  const hasDiscount = product.discountPrice && product.discountPrice < product.regularPrice;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, selectedSize, selectedColor || defaultCardColor, 1);
  };

  const handleQuickBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    buyNow(product, selectedSize, selectedColor || defaultCardColor, 1);
  };

  const handleCardClick = () => {
    openProductDetail(product.id);
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col bg-[#141414] rounded-xl border border-white/10 overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-[#FF762E]/60 hover:-translate-y-1 cursor-pointer"
    >
      {/* Boxy Square Image Container (Daraz Style) */}
      <div className="relative aspect-square w-full overflow-hidden bg-neutral-900 border-b border-white/5">
        <img
          src={product.images[0]}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/* Subtle Tag Overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
          {product.isNewArrival && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#14221C] text-[#F7F5EF] rounded">
              New Drop
            </span>
          )}
          {product.isBestSeller && !product.isNewArrival && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#202522] text-[#F7F5EF] rounded">
              Best Seller
            </span>
          )}
        </div>

        {/* Action Buttons: Wishlist & Compare */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            className={`p-2 rounded-full backdrop-blur-md transition-all shadow-sm ${
              inWishlist
                ? 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                : 'bg-white/80 text-[#202522] hover:bg-white hover:text-rose-500'
            }`}
            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart
              className={`w-4 h-4 transition-transform ${inWishlist ? 'fill-rose-500 scale-110' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isInComparison(product.id)) {
                removeFromComparison(product.id);
              } else {
                addToComparison(product.id);
              }
            }}
            className={`p-2 rounded-full backdrop-blur-md transition-all shadow-sm ${
              isInComparison(product.id)
                ? 'bg-[#14221C] text-[#FF762E]'
                : 'bg-white/80 text-[#202522] hover:bg-white hover:text-[#14221C]'
            }`}
            title={isInComparison(product.id) ? 'Remove from comparison' : 'Compare garment specs'}
            aria-label="Compare"
          >
            <span className="text-[11px] font-bold">⇄</span>
          </button>
        </div>

        {/* Quick Add Overlay on Desktop Hover */}
        <div
          className={`absolute inset-x-3 bottom-3 flex flex-col gap-2 p-2 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-100 transition-all duration-200 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick size selection */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#202522]/60 font-medium">Select Size:</span>
            <div className="flex gap-1">
              {product.sizes.slice(0, 4).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                    selectedSize === sz
                      ? 'bg-[#14221C] text-white'
                      : 'bg-stone-100 text-[#202522] hover:bg-stone-200'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Bag & Buy Now buttons */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleQuickAdd}
              className="py-1.5 px-2 bg-[#14221C] hover:bg-[#202522] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs"
              title="Add to Shopping Bag"
            >
              <ShoppingBag className="w-3 h-3 text-[#FF762E]" />
              <span>Bag</span>
            </button>
            <button
              type="button"
              onClick={handleQuickBuy}
              className="py-1.5 px-2 bg-[#FF762E] hover:bg-[#e8631c] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs"
              title="Direct Instant Checkout"
            >
              <Zap className="w-3 h-3 fill-white" />
              <span>Buy Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* Product Content Details */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between bg-[#141414]">
        <div>
          {/* Category & Rating */}
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
            <span className="uppercase tracking-wider font-semibold text-[11px] text-neutral-400">
              {product.category}
            </span>
            <div className="flex items-center gap-1 text-[11px]">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-white tabular-nums">
                {product.rating}
              </span>
              <span className="text-neutral-500 tabular-nums">
                ({product.reviewCount})
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-heading text-sm sm:text-base font-bold text-white line-clamp-1 group-hover:text-[#FF762E] transition-colors">
            {product.name}
          </h3>

          {/* Tagline / Subtitle */}
          <p className="text-xs text-neutral-400 line-clamp-2 mt-1 font-sans">
            {product.tagline || product.description}
          </p>

          {/* Quick Size Selector */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-neutral-400 font-medium">সাইজ:</span>
              {product.sizes.slice(0, 5).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSize(sz);
                  }}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                    selectedSize === sz
                      ? 'bg-[#FF762E] text-white'
                      : 'bg-white/10 text-neutral-300 hover:bg-white/20'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price & Colors Available */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-black text-white tabular-nums">
              ৳ {price.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="text-xs text-neutral-400 line-through tabular-nums">
                ৳ {product.regularPrice.toLocaleString()}
              </span>
            )}
          </div>

          {/* Color preview dots */}
          <div className="flex items-center -space-x-1">
            {product.colors.map((c) => (
              <span
                key={c.name}
                className="w-3.5 h-3.5 rounded-full border border-black/50 shadow-xs"
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* View Details Link */}
        <div className="pt-2 flex items-center justify-between text-[11px] text-[#FF762E] font-bold">
          <span className="hover:underline flex items-center gap-1">
            বিস্তারিত দেখুন / View Details →
          </span>
          {hasDiscount && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#FF762E]/15 text-[#FF762E] rounded font-bold">
              {product.discountPercent}% ছাড়
            </span>
          )}
        </div>

        {/* Permanent Dual Action Buttons: অ্যাড টু কার্ট & বাই নাউ */}
        <div className="grid grid-cols-2 gap-2 pt-3">
          <button
            type="button"
            onClick={handleQuickAdd}
            className="w-full py-2 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border border-white/10"
            title="Add to Shopping Cart"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#FF762E]" />
            <span>অ্যাড টু কার্ট</span>
          </button>
          <button
            type="button"
            onClick={handleQuickBuy}
            className="w-full py-2 px-2.5 bg-[#FF762E] hover:bg-[#e8631c] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            title="Direct Buy Now"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>বাই নাউ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
