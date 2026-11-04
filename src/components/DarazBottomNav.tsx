import React from 'react';
import { useStore, PageRoute } from '../context/StoreContext';
import {
  Home,
  ShoppingBag,
  Package,
  User as UserIcon,
  Search,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

export const DarazBottomNav: React.FC = () => {
  const {
    currentPage,
    setCurrentPage,
    cartItemCount,
    setIsCartDrawerOpen,
    currentUser,
    setIsAuthModalOpen
  } = useStore();

  const handleProfileClick = () => {
    if (!currentUser) {
      setCurrentPage('account');
    } else {
      setCurrentPage('account');
    }
  };

  const navItems = [
    {
      id: 'home',
      label: 'হোম',
      icon: Home,
      isActive: currentPage === 'home',
      onClick: () => setCurrentPage('home')
    },
    {
      id: 'shop',
      label: 'শপ',
      icon: ShoppingBag,
      isActive: currentPage === 'shop' || currentPage === 'product-detail',
      onClick: () => setCurrentPage('shop')
    },
    {
      id: 'cart',
      label: 'কার্ট',
      icon: ShoppingBag,
      badge: cartItemCount,
      isActive: currentPage === 'cart' || currentPage === 'checkout',
      onClick: () => setIsCartDrawerOpen(true)
    },
    {
      id: 'account',
      label: currentUser ? (currentUser.name.split(' ')[0].slice(0, 8) || 'প্রোফাইল') : 'প্রোফাইল',
      icon: UserIcon,
      isVerified: Boolean(currentUser?.isVerified),
      isActive: currentPage === 'account',
      onClick: handleProfileClick
    }
  ];

  return (
    <nav
      aria-label="Daraz Style Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-md border-t border-white/10 shadow-2xl transition-transform"
    >
      <div className="max-w-md mx-auto px-3 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`flex-1 py-1 flex flex-col items-center justify-center relative transition-colors cursor-pointer ${
                active ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110 text-white' : ''}`} />
                
                {/* Live Cart Count Badge */}
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-white text-black text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-xs">
                    {item.badge}
                  </span>
                )}

                {/* Verified Customer Dot for Profile */}
                {item.isVerified && (
                  <span
                    className="absolute -top-0.5 -right-1 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-black"
                    title="১০০% ভেরিফাইড অ্যাকাউন্ট"
                  />
                )}
              </div>

              <span className={`text-[10px] font-bold mt-1 tracking-tight ${
                active ? 'text-white font-extrabold' : 'text-neutral-400'
              }`}>
                {item.label}
              </span>

              {/* Active Tab Indicator Bar */}
              {active && (
                <span className="absolute -top-2 w-6 h-0.5 bg-white rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
