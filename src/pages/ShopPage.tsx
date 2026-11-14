import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { ProductCategory } from '../types';
import { Search, SlidersHorizontal, X, RotateCcw, Check, Sparkles } from 'lucide-react';

export const ShopPage: React.FC = () => {
  const {
    products,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    categories
  } = useStore();

  const [sortBy, setSortBy] = useState<
    'featured' | 'newest' | 'price-asc' | 'price-desc' | 'best-selling' | 'rating'
  >('featured');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Filters state
  const [selectedSize, setSelectedSize] = useState<string>('All');
  const [selectedColor, setSelectedColor] = useState<string>('All');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [discountOnly, setDiscountOnly] = useState<boolean>(false);
  const [maxPrice, setMaxPrice] = useState<number>(8000);
  const [visibleCount, setVisibleCount] = useState<number>(24);

  // Reset pagination batch whenever active filters/search/sort change
  useEffect(() => {
    setVisibleCount(24);
  }, [selectedCategory, searchQuery, maxPrice, selectedSize, selectedColor, inStockOnly, discountOnly, sortBy]);

  const availableSizes = ['All', 'M', 'L', 'XL', 'XXL'];
  const availableColors = [
    'All',
    'Forest Pine',
    'Charcoal Black',
    'Raw Ivory Cream',
    'Sage Olive Linen',
    'Indigo / Charcoal Duo',
    'Chalk White'
  ];

  // Filtering and sorting logic
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Hide Deleted / Archived products from public customers
        if (product.isArchived || product.status === 'archived') {
          return false;
        }

        // Category matching with subcategory & screenshot category alias awareness
        if (selectedCategory !== 'All') {
          const sel = selectedCategory.toLowerCase();
          const pCat = product.category.toLowerCase();
          const pSub = (product.subCategory || '').toLowerCase();
          const pName = product.name.toLowerCase();
          const pTags = product.tags.map((t) => t.toLowerCase());

          const directMatch = pCat === sel;
          const poloMatch = sel.includes('polo') && (pCat.includes('polo') || pName.includes('polo') || pTags.includes('polo'));
          const dropShoulderMatch = sel.includes('drop shoulder') && (pName.includes('drop') || pName.includes('oversized') || pTags.includes('oversized'));
          const basicTeeMatch = sel.includes('basic') && (pCat.includes('t-shirt') || pName.includes('tee') || pName.includes('t-shirt'));
          const printShirtMatch = sel.includes('print shirt') && (pCat.includes('shirt') || pName.includes('print') || pTags.includes('print'));
          const solidShirtMatch = sel.includes('solid shirt') && (pCat.includes('shirt') || pName.includes('shirt') || pName.includes('oxford'));
          const checkShirtMatch = sel.includes('check shirt') && (pCat.includes('shirt') || pName.includes('check') || pName.includes('flannel'));
          const hoodieMatch = sel.includes('hoodie') && (pCat.includes('hoodie') || pName.includes('hoodie'));
          const sweaterMatch = (sel.includes('sweeter') || sel.includes('sweater')) && (pCat.includes('sweater') || pName.includes('sweater') || pName.includes('knit'));
          const sweatshirtMatch = sel.includes('sweatshirt') && (pCat.includes('sweatshirt') || pName.includes('sweatshirt') || pName.includes('fleece'));
          const jacketMatch = sel.includes('jacket') && (pCat.includes('jacket') || pName.includes('jacket') || pName.includes('overcoat'));
          const pantMatch = (sel === 'pant' || sel === 'pants') && (pCat.includes('pant') || pCat.includes('jean') || pName.includes('pant') || pName.includes('denim'));
          const joggerMatch = sel.includes('jogger') && (pCat.includes('jogger') || pName.includes('jogger') || pName.includes('trouser'));
          const longSleeveMatch = sel.includes('long sleeve') && (pCat.includes('long sleeve') || pName.includes('long sleeve'));
          const winterMatch = (sel === 'winter collection' || sel.includes('winter')) && (pCat.includes('winter') || pCat.includes('hoodie') || pCat.includes('sweater') || pCat.includes('jacket'));

          const isMatched =
            directMatch ||
            poloMatch ||
            dropShoulderMatch ||
            basicTeeMatch ||
            printShirtMatch ||
            solidShirtMatch ||
            checkShirtMatch ||
            hoodieMatch ||
            sweaterMatch ||
            sweatshirtMatch ||
            jacketMatch ||
            pantMatch ||
            joggerMatch ||
            longSleeveMatch ||
            winterMatch;

          if (!isMatched) {
            return false;
          }
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (product.name || '').toLowerCase().includes(q);
          const matchDesc = (product.description || '').toLowerCase().includes(q);
          const matchSku = (product.sku || '').toLowerCase().includes(q);
          const matchCategory = (product.category || '').toLowerCase().includes(q);
          const matchTags = (product.tags || []).some((t) => t.toLowerCase().includes(q));
          if (!matchName && !matchDesc && !matchSku && !matchCategory && !matchTags) {
            return false;
          }
        }

        // Price
        const effectivePrice = product.discountPrice ?? product.regularPrice;
        if (effectivePrice > maxPrice) {
          return false;
        }

        // Size
        if (selectedSize !== 'All') {
          if (!product.sizes.includes(selectedSize)) {
            return false;
          }
        }

        // Color
        if (selectedColor !== 'All') {
          if (!(product.colors || []).some((c) => c.name.toLowerCase() === selectedColor.toLowerCase())) {
            return false;
          }
        }

        // In Stock Only
        if (inStockOnly && product.totalStock <= 0) {
          return false;
        }

        // Discount Only
        if (discountOnly && (!product.discountPrice || product.discountPrice >= product.regularPrice)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const priceA = a.discountPrice ?? a.regularPrice;
        const priceB = b.discountPrice ?? b.regularPrice;

        switch (sortBy) {
          case 'price-asc':
            return priceA - priceB;
          case 'price-desc':
            return priceB - priceA;
          case 'newest':
            return new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime();
          case 'best-selling':
            return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0);
          case 'rating':
            return b.rating - a.rating;
          case 'featured':
          default:
            if (a.isPinned !== b.isPinned) {
              return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
            }
            const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 9999;
            const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 9999;
            if (orderA !== orderB) {
              return orderA - orderB;
            }
            return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        }
      });
  }, [
    products,
    selectedCategory,
    searchQuery,
    maxPrice,
    selectedSize,
    selectedColor,
    inStockOnly,
    discountOnly,
    sortBy
  ]);

  const resetAllFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
    setSelectedSize('All');
    setSelectedColor('All');
    setInStockOnly(false);
    setDiscountOnly(false);
    setMaxPrice(8000);
    setSortBy('featured');
  };

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    searchQuery.trim() !== '' ||
    selectedSize !== 'All' ||
    selectedColor !== 'All' ||
    inStockOnly ||
    discountOnly ||
    maxPrice < 8000;

  return (
    <div className="bg-[#0A0A0A] text-white min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="font-heading text-3xl font-extrabold text-white tracking-tight uppercase">
              {selectedCategory === 'All' ? 'Complete Collection' : selectedCategory}
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Showing {filteredProducts.length} curated pieces engineered for Bangladeshi climate and modern living.
            </p>
          </div>

          {/* Sort & Mobile Filter Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-2 px-3.5 py-2 bg-[#141414] rounded-xl border border-white/15 text-xs font-semibold text-white"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#FF762E]" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-[#FF762E]" />
              )}
            </button>

            <div className="flex items-center gap-2 bg-[#141414] px-3 py-2 rounded-xl border border-white/15 text-xs">
              <span className="text-neutral-400 font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent font-semibold text-white focus:outline-none cursor-pointer"
              >
                <option value="featured" className="bg-[#141414] text-white">Featured Drops</option>
                <option value="newest" className="bg-[#141414] text-white">Newest Arrivals</option>
                <option value="best-selling" className="bg-[#141414] text-white">Best Sellers</option>
                <option value="price-asc" className="bg-[#141414] text-white">Price: Low to High</option>
                <option value="price-desc" className="bg-[#141414] text-white">Price: High to Low</option>
                <option value="rating" className="bg-[#141414] text-white">Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search Bar & Active Filters Bar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by product name, fabric (e.g. French Terry, Linen), or style..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-xs bg-[#141414] border border-white/15 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#FF762E]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="px-4 py-2.5 bg-[#141414] border border-white/15 hover:border-rose-400 text-xs font-semibold text-white hover:text-rose-400 rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Category Title Badges / Pills (Dynamic from Admin Panel, No Image Clutter) */}
          <div className="flex items-center gap-2 p-2 bg-[#141414] rounded-2xl border border-white/10 overflow-x-auto text-xs font-semibold scrollbar-none shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF762E] px-2 whitespace-nowrap shrink-0 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ক্যাটাগরি:</span>
            </span>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = cat === 'All'
                ? products.length
                : products.filter(p => p.category.toLowerCase() === cat.toLowerCase()).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer font-bold ${
                    isSelected
                      ? 'bg-[#FF762E] text-white shadow-sm'
                      : 'bg-white/5 text-neutral-300 hover:bg-white/15 hover:text-white border border-white/5'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full tabular-nums ${
                    isSelected ? 'bg-black/30 text-white' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Catalog Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Desktop Left Filter Sidebar */}
          <aside className="hidden lg:block bg-[#141414] p-6 rounded-2xl border border-white/10 space-y-6 shadow-xs sticky top-24 text-white">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#FF762E]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Refine By
                </h3>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="text-[11px] text-[#FF762E] hover:underline font-semibold"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Price Range Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-white">
                <span>Max Price:</span>
                <span className="tabular-nums">৳{maxPrice.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="8000"
                step="200"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#FF762E] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 tabular-nums">
                <span>৳1,000</span>
                <span>৳8,000</span>
              </div>
            </div>

            {/* Size Filter */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs font-bold uppercase tracking-wider text-white block">
                Size
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableSizes.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                      selectedSize === sz
                        ? 'bg-[#FF762E] text-white border-[#FF762E]'
                        : 'bg-white/5 text-neutral-300 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Filter */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs font-bold uppercase tracking-wider text-white block">
                Color Palette
              </label>
              <div className="space-y-1">
                {availableColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      selectedColor === color
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-neutral-400 hover:bg-white/5'
                    }`}
                  >
                    <span>{color}</span>
                    {selectedColor === color && <Check className="w-3.5 h-3.5 text-[#FF762E]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle checkboxes */}
            <div className="space-y-2.5 pt-2 border-t border-white/10 text-xs text-neutral-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded text-[#FF762E] focus:ring-[#FF762E] bg-neutral-900 border-white/20"
                />
                <span className="font-medium text-neutral-300">In Stock Only</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={discountOnly}
                  onChange={(e) => setDiscountOnly(e.target.checked)}
                  className="rounded text-[#FF762E] focus:ring-[#FF762E] bg-neutral-900 border-white/20"
                />
                <span className="font-medium text-neutral-300">On Sale / Discounted</span>
              </label>
            </div>
          </aside>

          {/* Right Product Grid */}
          <div className="lg:col-span-3">
            {filteredProducts.length === 0 ? (
              <div className="bg-[#141414] p-12 rounded-3xl border border-white/10 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center text-[#FF762E]">
                  <Search className="w-8 h-8 opacity-60" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading text-lg font-bold text-white">
                    No garments match your filters
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    Try adjusting your price range, clearing specific sizes, or searching with broader keywords.
                  </p>
                </div>
                <button
                  onClick={resetAllFilters}
                  className="px-6 py-2.5 bg-[#FF762E] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#e8631c] transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                  {filteredProducts.slice(0, visibleCount).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {visibleCount < filteredProducts.length && (
                  <div className="flex flex-col items-center justify-center pt-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 24)}
                      className="px-7 py-3 bg-[#141414] hover:bg-[#FF762E] text-white border border-white/15 hover:border-[#FF762E] text-xs font-extrabold uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg"
                    >
                      আরো প্রোডাক্ট দেখুন ({filteredProducts.length - visibleCount} বাকি)
                    </button>
                    <span className="text-[11px] text-neutral-400">
                      Showing {Math.min(visibleCount, filteredProducts.length)} of {filteredProducts.length} items
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            onClick={() => setIsMobileFilterOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          <div className="relative ml-auto w-full max-w-xs bg-white text-[#202522] h-full shadow-2xl flex flex-col p-6 space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E1D5]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#14221C]">
                Filter Catalog
              </h3>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-1 text-[#202522]/60 hover:text-[#14221C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#14221C]">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCategory(c)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                      selectedCategory === c
                        ? 'bg-[#14221C] text-white'
                        : 'bg-[#F7F5EF] text-[#202522]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>Max Price:</span>
                <span className="tabular-nums">৳{maxPrice.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="8000"
                step="200"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#14221C]"
              />
            </div>

            {/* Size */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#14221C]">
                Size
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableSizes.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${
                      selectedSize === sz
                        ? 'bg-[#14221C] text-white'
                        : 'bg-[#F7F5EF] text-[#202522]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock & sale toggles */}
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                />
                <span>In Stock Only</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={discountOnly}
                  onChange={(e) => setDiscountOnly(e.target.checked)}
                />
                <span>Sale Items Only</span>
              </label>
            </div>

            <div className="pt-4 border-t border-[#E5E1D5] flex gap-2">
              <button
                onClick={resetAllFilters}
                className="flex-1 py-2.5 bg-[#F7F5EF] text-xs font-bold uppercase rounded-lg border border-[#E5E1D5]"
              >
                Reset
              </button>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 py-2.5 bg-[#14221C] text-white text-xs font-bold uppercase rounded-lg"
              >
                Apply ({filteredProducts.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
