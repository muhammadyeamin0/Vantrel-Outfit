import React, { useState } from 'react';
import { useStore, PageRoute } from '../context/StoreContext';
import { ProductCategory } from '../types';
import {
  ShoppingBag,
  Heart,
  User as UserIcon,
  Search,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
  Package,
  Palette,
  Lock,
  MessageCircle
} from 'lucide-react';
import { AdminAuthModal } from './AdminAuthModal';

export const Header: React.FC = () => {
  const {
    settings,
    currentPage,
    setCurrentPage,
    setSelectedCategory,
    cartItemCount,
    wishlist,
    setIsCartDrawerOpen,
    searchQuery,
    setSearchQuery,
    currentUser,
    isAdmin,
    currentStaffRole,
    comparisonList,
    setIsComparisonModalOpen,
    setIsAuthModalOpen,
    themeConfig,
    setThemePreset
  } = useStore();

  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);

  const navItems: { label: string; route: PageRoute; cat?: ProductCategory }[] = [
    { label: 'Home', route: 'home' },
    { label: 'Shop', route: 'shop', cat: 'All' },
    { label: 'Collections', route: 'shop', cat: 'Winter Collection' },
    { label: 'About', route: 'about' },
    { label: 'Contact', route: 'contact' }
  ];

  const handleNavClick = (route: PageRoute, category?: ProductCategory) => {
    if (category) {
      setSelectedCategory(category);
    }
    setCurrentPage(route);
    setIsMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchQuery(searchInput.trim());
      setSelectedCategory('All');
      setCurrentPage('shop');
      setIsSearchOpen(false);
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-white/10 transition-all text-white">
      {/* Top Announcement Bar */}
      {settings.announcementText && (
        <div className="bg-[#050505] text-neutral-300 text-[11px] font-medium tracking-wide py-1.5 px-4 text-center border-b border-white/5">
          <div className="max-w-7xl mx-auto flex items-center justify-center">
            <span className="truncate">
              {settings.announcementText}
            </span>
          </div>
        </div>
      )}

      {/* Main Navigation Bar - Follows strict 3-zone contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-18">
          {/* Mobile menu trigger */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-neutral-300 hover:text-white"
              aria-label="Open mobile menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Zone 1: Single brand cluster with official logo & wordmark */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('home');
            }}
            className="flex items-center gap-2.5 sm:gap-3 tracking-wider shrink-0 select-none group"
          >
            <img
              src="/assets/images/vantrel-logo.png"
              alt="VANTREL"
              className="h-8 w-8 sm:h-9 sm:w-9 object-contain rounded-md bg-black border border-white/10 group-hover:border-[#FF762E]/60 transition-colors"
            />
            <span className="font-heading text-2xl sm:text-3xl font-black tracking-[0.15em] text-white uppercase">
              VANTREL
            </span>
          </a>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-neutral-300">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.route, item.cat)}
                className={`transition-colors py-1 hover:text-white whitespace-nowrap shrink-0 relative ${
                  currentPage === item.route ? 'text-white font-bold underline underline-offset-8 decoration-1 decoration-white' : 'text-neutral-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Functional action cluster (Search, Account, Cart) */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Search Button */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 text-neutral-300 hover:text-white transition-colors"
              aria-label="Search products"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Customer Account / Auth Modal Trigger */}
            <button
              onClick={() => {
                if (!currentUser) {
                  setIsAuthModalOpen(true);
                } else {
                  handleNavClick('account');
                }
              }}
              className="p-2 text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5"
              aria-label="Account"
            >
              <div className="relative">
                <UserIcon className="w-5 h-5" />
                {currentUser?.isVerified && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full" title="Verified Account" />
                )}
              </div>
            </button>

            {/* Cart Trigger with live count matching mockup */}
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="relative p-2 text-neutral-300 hover:text-white transition-colors group"
              aria-label="View shopping bag"
            >
              <ShoppingBag className="w-5 h-5 group-hover:scale-105 transition-transform" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-white text-black text-[10px] font-black rounded-full flex items-center justify-center tabular-nums">
                {cartItemCount}
              </span>
            </button>
          </div>
        </div>

        {/* Expandable Search Input Bar */}
        {isSearchOpen && (
          <div className="py-3 px-2 border-t border-[#E5E1D5] bg-white rounded-b-xl shadow-lg animate-fadeIn mb-2">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#202522]/50 ml-2" />
              <input
                type="text"
                placeholder="Search heavyweight hoodie, raw tee, selvedge denim, panjabi..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-2 text-xs sm:text-sm text-neutral-900 font-semibold bg-stone-50 border border-stone-200 rounded-lg placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-[#14221C]"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="text-xs text-[#202522]/40 hover:text-[#202522]"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#14221C] text-white text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-[#202522] transition-colors"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-1.5 text-[#202522]/60 hover:text-[#14221C]"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
            {/* Quick search suggestions */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px] text-[#202522]/60 px-2 overflow-x-auto">
              <span className="font-semibold text-[#14221C] shrink-0">Popular:</span>
              {['Pine Hoodie', 'Artisan Tee', 'Selvedge Denim', 'Linen Panjabi', 'Cargo'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSearchInput(tag);
                    setSearchQuery(tag);
                    setSelectedCategory('All');
                    setCurrentPage('shop');
                    setIsSearchOpen(false);
                  }}
                  className="hover:text-[#FF762E] underline underline-offset-2 shrink-0"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          <div className="fixed inset-y-0 left-0 w-4/5 max-w-sm bg-[#F7F5EF] text-[#202522] shadow-2xl flex flex-col border-r border-[#E5E1D5]">
            {/* Mobile Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E5E1D5]">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/images/vantrel-logo.png"
                  alt="VANTREL"
                  className="w-8 h-8 object-contain rounded-md bg-black p-0.5 border border-stone-200"
                />
                <span className="font-heading text-xl font-extrabold tracking-tight text-[#14221C] uppercase">
                  VAN<span className="text-[#FF762E]">TREL</span>
                </span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-[#202522]/60 hover:text-[#14221C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Nav Links */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#202522]/40 mb-3">
                  Shop Collections
                </h4>
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleNavClick(item.route || 'shop', item.cat)}
                      className="w-full flex items-center justify-between py-2.5 text-sm font-semibold text-[#14221C] hover:text-[#FF762E] transition-colors"
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-[#202522]/30" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E5E1D5]">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#202522]/40 mb-3">
                  Quick Actions
                </h4>
                <div className="space-y-2 text-sm font-medium">
                  <button
                    onClick={() => handleNavClick('account')}
                    className="w-full flex items-center gap-2.5 py-2 text-[#202522] hover:text-[#FF762E]"
                  >
                    <UserIcon className="w-4 h-4 text-[#FF762E]" />
                    <span>Customer Profile & History</span>
                  </button>
                  <button
                    onClick={() => handleNavClick('size-guide')}
                    className="w-full flex items-center gap-2.5 py-2 text-[#202522] hover:text-[#FF762E]"
                  >
                    <span>Size Guide & Fit Chart</span>
                  </button>
                  <button
                    onClick={() => handleNavClick('about')}
                    className="w-full flex items-center gap-2.5 py-2 text-[#202522] hover:text-[#FF762E]"
                  >
                    <span>Brand Philosophy</span>
                  </button>
                  <button
                    onClick={() => handleNavClick('contact')}
                    className="w-full flex items-center gap-2.5 py-2 text-[#202522] hover:text-[#FF762E]"
                  >
                    <span>Contact & Banani Store</span>
                  </button>
                </div>
              </div>

              {/* Locked Admin Portal (More Option - End) */}
              <div className="pt-4 border-t border-[#E5E1D5]">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    const isSuperAdminVerified =
                      Boolean(currentUser) &&
                      currentUser?.email?.toLowerCase() === 'muhammadeyamin0@gmail.com' &&
                      (currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin');

                    if (isSuperAdminVerified) {
                      setCurrentPage('admin');
                    } else {
                      setIsAdminAuthModalOpen(true);
                    }
                  }}
                  className="w-full py-2.5 px-4 bg-[#14221C] text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 hover:bg-[#202522] transition-colors cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-[#FF762E]" />
                  <span>অ্যাডমিন প্যানেল (লক করা)</span>
                </button>
              </div>
            </div>

            {/* Mobile Footer */}
            <div className="p-6 bg-white border-t border-[#E5E1D5] text-xs text-[#202522]/60 space-y-2">
              <a
                href="https://wa.me/message/E6PISGJZC63TA1"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#25D366] hover:underline flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                <span>হোয়াটসঅ্যাপ হেল্পলাইন (WhatsApp Business)</span>
              </a>
              <a
                href="https://www.facebook.com/share/18qNnMStUm/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#1877F2] hover:underline flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#1877F2]" />
                <span>ফেসবুক সাপোর্ট (Facebook Support)</span>
              </a>
              <p className="mt-0.5 text-[11px]">Support: {settings.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Security Verification Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
      />
    </header>
  );
};
