import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import {
  CASUAL_CATEGORIES,
  GENTS_WINTER_CATEGORIES,
  ACTIVE_IN_STOCK_CATEGORIES,
  ALL_SHOWCASE_CATEGORIES,
  CategoryShowcaseItem
} from '../data/categoryShowcaseData';
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  Search,
  X,
  Flame,
  Check,
  Snowflake,
  Shirt,
  Lock,
  Home,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  LayoutGrid
} from 'lucide-react';
import { ProductCategory } from '../types';
import { AdminAuthModal } from './AdminAuthModal';

export const TopCategoryStrip: React.FC = () => {
  const {
    selectedCategory,
    setSelectedCategory,
    setCurrentPage,
    currentPage,
    categories,
    products,
    settings
  } = useStore();

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [moreSearchQuery, setMoreSearchQuery] = useState('');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    if (isMoreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoreOpen]);

  const handleSelectCategory = (categoryKey: ProductCategory) => {
    setSelectedCategory(categoryKey);
    setCurrentPage('shop');
    setIsMoreOpen(false);
  };

  const getCategoryCount = (cat: ProductCategory) => {
    if (cat === 'All') return products.filter((p) => !p.isArchived && p.status !== 'archived').length;
    const catLower = cat.toLowerCase();
    return products.filter((p) => {
      if (p.isArchived || p.status === 'archived') return false;
      const pCat = p.category.toLowerCase();
      const pSub = (p.subCategory || '').toLowerCase();
      const pName = p.name.toLowerCase();
      return (
        pCat === catLower ||
        pSub.includes(catLower) ||
        pName.includes(catLower) ||
        (catLower.includes('t-shirt') && pCat.includes('t-shirt')) ||
        (catLower.includes('hoodie') && pCat.includes('hoodie')) ||
        (catLower.includes('pant') && pCat.includes('pant')) ||
        (catLower.includes('jacket') && pCat.includes('jacket')) ||
        (catLower.includes('panjabi') && pCat.includes('panjabi'))
      );
    }).length;
  };

  // Filter dynamic categories in "More" menu based on search query
  const filteredCategories = categories.filter((c) =>
    c.toLowerCase().includes(moreSearchQuery.toLowerCase())
  );

  return (
    <div className="bg-[#14221C] text-[#F7F5EF] border-b border-[#2A3B32] shadow-sm select-none relative z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 h-11">
          {/* Left badge indicator */}
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#FF762E] pr-3 border-r border-[#2A3B32] shrink-0">
            <Flame className="w-3.5 h-3.5" />
            <span>ক্যাটাগরি:</span>
          </div>

          {/* Horizontal Line with Dynamic Categories */}
          <div
            ref={scrollContainerRef}
            className="flex-1 flex items-center gap-2 overflow-x-auto py-1 scrollbar-none scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* 'All' option */}
            <button
              onClick={() => handleSelectCategory('All')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                selectedCategory === 'All' && currentPage === 'shop'
                  ? 'bg-[#FF762E] text-white shadow-xs font-bold'
                  : 'bg-white/10 text-white/90 hover:bg-white/20'
              }`}
            >
              <span>সকল কালেকশন</span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full tabular-nums bg-black/30 text-white">
                {products.length}
              </span>
            </button>

            {/* Dynamic categories from Admin Panel / StoreContext */}
            {categories.map((cat) => {
              if (cat === 'All') return null;
              const count = getCategoryCount(cat);
              const isSelected = selectedCategory === cat && currentPage === 'shop';
              return (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#FF762E] text-white shadow-xs font-bold'
                      : 'bg-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                  }`}
                  title={cat}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.2 rounded-full tabular-nums ${
                      isSelected ? 'bg-black/30 text-white' : 'bg-[#FF762E] text-white'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: 'মোর / More' Dropdown Trigger (Enlarged & Prominent) */}
          <div className="relative shrink-0 pl-3 border-l-2 border-[#2A3B32]" ref={dropdownRef}>
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md select-none ${
                isMoreOpen
                  ? 'bg-[#FF762E] text-white ring-2 ring-orange-300/40 shadow-lg scale-105'
                  : 'bg-white/20 hover:bg-[#FF762E] text-white border border-white/20 hover:border-transparent hover:shadow-lg hover:scale-105 active:scale-95'
              }`}
              aria-label="Open More Categories and Navigation"
              aria-expanded={isMoreOpen}
            >
              <LayoutGrid className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="font-sans font-black tracking-wider">মোর / MORE</span>
              <ChevronDown
                className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-200 ${
                  isMoreOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Content */}
            {isMoreOpen && (
              <>
                {/* Backdrop on mobile to easily dismiss */}
                <div
                  className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40"
                  onClick={() => setIsMoreOpen(false)}
                />

                <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-12 sm:top-full mt-1.5 sm:w-[620px] md:w-[680px] bg-[#141414] text-white rounded-2xl shadow-2xl border border-white/20 z-50 p-3.5 sm:p-4.5 space-y-3">
                  {/* Compact Header: Title + Search + Close */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Sparkles className="w-4 h-4 text-[#FF762E]" />
                      <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                        সকল অপশন ও ক্যাটাগরি
                      </h4>
                    </div>

                    <div className="relative flex-1 max-w-[240px] sm:max-w-[320px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="ক্যাটাগরি দ্রুত খুঁজুন..."
                        value={moreSearchQuery}
                        onChange={(e) => setMoreSearchQuery(e.target.value)}
                        className="w-full pl-7 pr-2.5 py-1.5 text-xs bg-neutral-900 border border-white/20 rounded-lg text-white font-medium placeholder:text-neutral-400 focus:outline-none focus:border-[#FF762E]"
                      />
                    </div>

                    <button
                      onClick={() => setIsMoreOpen(false)}
                      className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer shrink-0"
                      title="বন্ধ করুন"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 1. Primary Shortcuts: Home, All Clothes, Winter Drop */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => {
                        setCurrentPage('home');
                        setSelectedCategory('All');
                        setIsMoreOpen(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="py-2 px-2.5 bg-gradient-to-r from-[#FF762E] to-[#e65c12] hover:brightness-110 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all border border-orange-400/30"
                    >
                      <Home className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">হোম পেজ</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedCategory('All');
                        setCurrentPage('shop');
                        setIsMoreOpen(false);
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border ${
                        selectedCategory === 'All' && currentPage === 'shop'
                          ? 'bg-[#FF762E]/25 border-[#FF762E] text-white'
                          : 'bg-white/10 border-white/15 hover:bg-white/15 text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#FF762E] shrink-0" />
                      <span className="truncate">সকল পোশাক ({products.length})</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedCategory('Hoodies');
                        setCurrentPage('shop');
                        setIsMoreOpen(false);
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border ${
                        selectedCategory === 'Hoodies' && currentPage === 'shop'
                          ? 'bg-[#FF762E]/25 border-[#FF762E] text-white'
                          : 'bg-white/10 border-white/15 hover:bg-white/15 text-white'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5 text-[#FF762E] shrink-0" />
                      <span className="truncate">উইন্টার ড্রপ</span>
                    </button>
                  </div>

                  {/* 2. All Categories: Displayed completely at once without inner scrolling */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#FF762E] mb-1.5 px-0.5">
                      <span className="flex items-center gap-1">
                        <Shirt className="w-3 h-3" />
                        <span>ক্যাটাগরি সমূহ ({filteredCategories.length})</span>
                      </span>
                      <span className="text-[10px] text-neutral-400 font-normal">
                        এক ক্লিকেই সিলেক্ট করুন
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {filteredCategories.map((cat) => {
                        const count = getCategoryCount(cat);
                        const isSelected = selectedCategory === cat && currentPage === 'shop';
                        return (
                          <button
                            key={cat}
                            onClick={() => handleSelectCategory(cat)}
                            className={`py-1.5 px-2 rounded-lg text-left text-xs transition-colors flex items-center justify-between gap-1 cursor-pointer border ${
                              isSelected
                                ? 'bg-[#FF762E]/30 border-[#FF762E] text-white font-bold ring-1 ring-[#FF762E]'
                                : 'bg-white/5 border-white/10 hover:bg-white/15 text-white/90'
                            }`}
                          >
                            <span className="truncate text-[11px] sm:text-xs font-medium">{cat}</span>
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.2 rounded-full tabular-nums shrink-0 ${
                                count > 0 ? 'bg-[#FF762E] text-white' : 'bg-neutral-800 text-neutral-400'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Bottom Action Row: WhatsApp, Facebook & Admin Portal all together */}
                  <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-1.5">
                    <a
                      href="https://wa.me/message/E6PISGJZC63TA1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-2 bg-[#25D366] hover:bg-[#20ba59] text-white text-[11px] sm:text-xs font-bold rounded-xl text-center flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-white shrink-0" />
                      <span className="truncate">হোয়াটসঅ্যাপ</span>
                    </a>

                    <a
                      href="https://www.facebook.com/vantreloutfit"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-2 bg-[#1877F2] hover:bg-[#166fe5] text-white text-[11px] sm:text-xs font-bold rounded-xl text-center flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-white shrink-0" />
                      <span className="truncate">ফেসবুক পেজ</span>
                    </a>

                    <button
                      onClick={() => {
                        setIsMoreOpen(false);
                        setIsAdminModalOpen(true);
                      }}
                      className="py-2 px-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-bold border border-white/15 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#FF762E] shrink-0" />
                      <span className="truncate">অ্যাডমিন</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Admin Authentication Security Modal */}
      <AdminAuthModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
    </div>
  );
};
