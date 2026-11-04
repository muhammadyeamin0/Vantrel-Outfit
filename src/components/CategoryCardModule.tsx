import React from 'react';
import { useStore } from '../context/StoreContext';
import {
  CategoryShowcaseItem,
  CASUAL_CATEGORIES,
  GENTS_WINTER_CATEGORIES
} from '../data/categoryShowcaseData';
import { ArrowRight, Sparkles, Snowflake, Shirt } from 'lucide-react';

interface CategoryCardProps {
  item: CategoryShowcaseItem;
  onClick: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ item, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white border border-[#E5E1D5] hover:border-[#FF762E] rounded-2xl p-3 sm:p-4 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col items-center text-center cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#FF762E]/50 shrink-0 w-[140px] sm:w-[160px] md:w-auto"
    >
      {/* Top-Right Orange Pill Badge */}
      <div className="absolute top-2.5 right-2.5 z-20">
        <span className="bg-[#FF762E] text-white text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full shadow-xs tabular-nums">
          {item.count}
        </span>
      </div>

      {/* Product Image on Sunburst Circular Glow */}
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto flex items-center justify-center my-1.5">
        {/* Warm Orange Sunburst Glow Backdrop (Matching User Screenshots) */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#FF762E]/25 via-amber-400/35 to-orange-300/40 blur-xs group-hover:scale-110 transition-transform duration-300" />
        <div className="absolute inset-1.5 rounded-full border border-[#FF762E]/30 bg-radial from-amber-100/40 to-orange-200/20" />

        <img
          src={item.image}
          alt={item.title}
          className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-sm"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </div>

      {/* Category Title */}
      <div className="mt-1 w-full px-1">
        <h4 className="font-heading text-xs sm:text-sm font-bold text-[#14221C] group-hover:text-[#FF762E] transition-colors truncate">
          {item.title}
        </h4>
        <span className="text-[10px] text-[#202522]/50 block truncate">
          {item.banglaTitle}
        </span>
      </div>
    </button>
  );
};

interface CategorySectionModuleProps {
  sectionType?: 'all' | 'winter' | 'casual';
  className?: string;
}

export const CategorySectionModule: React.FC<CategorySectionModuleProps> = ({
  sectionType = 'all',
  className = ''
}) => {
  const { setSelectedCategory, setCurrentPage, setSearchQuery } = useStore();

  const handleCategorySelect = (item: CategoryShowcaseItem) => {
    setSelectedCategory(item.categoryKey);
    // Also set keyword search if specific filter
    if (item.filterKeywords.length > 0 && item.categoryKey !== 'All') {
      setSearchQuery('');
    }
    setCurrentPage('shop');
  };

  const handleViewAllWinter = () => {
    setSelectedCategory('Winter Collection');
    setSearchQuery('');
    setCurrentPage('shop');
  };

  const handleViewAllCasual = () => {
    setSelectedCategory('Shirts');
    setSearchQuery('');
    setCurrentPage('shop');
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* SECTION 1: Gent's Casual & Shirts (Screenshot 1) */}
      {(sectionType === 'all' || sectionType === 'casual') && (
        <div className="bg-[#FAF8F3] rounded-3xl p-5 sm:p-7 border border-[#E5E1D5] shadow-xs space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-[#E5E1D5]/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-[#FF762E] shadow-2xs">
                <Shirt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading text-base sm:text-lg font-extrabold text-[#FF762E] tracking-tight">
                  Gent's Casual & Shirts (1,174)
                </h3>
                <p className="text-[11px] text-[#202522]/60">
                  ক্লাসিক পোলো, ড্রপ শোল্ডার, ফরমাল ও প্রিন্ট শার্ট কালেকশন
                </p>
              </div>
            </div>

            <button
              onClick={handleViewAllCasual}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-[#E5E1D5] hover:border-[#FF762E] text-xs font-bold text-[#FF762E] hover:text-[#e8631c] transition-all shadow-2xs hover:shadow-xs cursor-pointer shrink-0"
            >
              <span>সব দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cards Grid / Horizontal Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 overflow-x-auto pb-1 scrollbar-thin">
            {CASUAL_CATEGORIES.map((item) => (
              <CategoryCard
                key={item.id}
                item={item}
                onClick={() => handleCategorySelect(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: Gent's Winter (384) (Screenshot 2) */}
      {(sectionType === 'all' || sectionType === 'winter') && (
        <div className="bg-[#FFF8F0] rounded-3xl p-5 sm:p-7 border border-[#F2DECE] shadow-xs space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#F2DECE]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#14221C] border-2 border-[#FF762E] flex items-center justify-center text-white shadow-xs overflow-hidden p-0.5">
                <img
                  src="/src/assets/images/bangladeshi_hoodie_look_1793107183737.jpg"
                  alt="Gent's Winter"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <h3 className="font-heading text-lg sm:text-xl font-extrabold text-[#E85D15] tracking-tight">
                  Gent's Winter (384)
                </h3>
                <p className="text-[11px] text-[#202522]/60">
                  হুডি, সোয়েটার, সোয়েটশার্টস, জ্যাকেট ও কম্বো উইন্টার সেট
                </p>
              </div>
            </div>

            <button
              onClick={handleViewAllWinter}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-[#F2DECE] hover:border-[#FF762E] text-xs font-bold text-[#E85D15] hover:text-[#d34e09] transition-all shadow-2xs hover:shadow-xs cursor-pointer shrink-0"
            >
              <span>সব দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 12 Category Cards in 2 Rows of 6 on Desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {GENTS_WINTER_CATEGORIES.map((item) => (
              <CategoryCard
                key={item.id}
                item={item}
                onClick={() => handleCategorySelect(item)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
