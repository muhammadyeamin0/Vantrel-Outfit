import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';
import { DarazBottomNav } from './components/DarazBottomNav';
import { DynamicMetaTags } from './components/DynamicMetaTags';
import { isSearchCrawler } from './utils/crawlerDetect';

const TopCategoryStrip = lazy(() => import('./components/TopCategoryStrip').then(m => ({ default: m.TopCategoryStrip })));

import { HomePage } from './pages/HomePage';

// Lazy-load secondary pages & modals to achieve sub-second 4G initial mobile load
const ShopPage = lazy(() => import('./pages/ShopPage').then(m => ({ default: m.ShopPage })));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })));
const CartPage = lazy(() => import('./pages/CartPage').then(m => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const CustomerAccountPage = lazy(() => import('./pages/CustomerAccountPage').then(m => ({ default: m.CustomerAccountPage })));
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage').then(m => ({ default: m.OrderTrackingPage })));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage').then(m => ({ default: m.OrderConfirmationPage })));
const AboutPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.ContactPage })));
const FaqPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.FaqPage })));
const PolicyPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.PolicyPage })));

const CartDrawer = lazy(() => import('./components/CartDrawer').then(m => ({ default: m.CartDrawer })));
const SizeGuideModal = lazy(() => import('./components/SizeGuideModal').then(m => ({ default: m.SizeGuideModal })));
const ProductComparisonModal = lazy(() => import('./components/ProductComparisonModal').then(m => ({ default: m.ProductComparisonModal })));
const FloatingComparisonDock = lazy(() => import('./components/ProductComparisonModal').then(m => ({ default: m.FloatingComparisonDock })));
const AuthModal = lazy(() => import('./components/AuthModal').then(m => ({ default: m.AuthModal })));
const FloatingChatWidget = lazy(() => import('./components/FloatingChatWidget').then(m => ({ default: m.FloatingChatWidget })));

const MainContent: React.FC = () => {
  const {
    currentPage,
    isCartDrawerOpen,
    isSizeGuideOpen,
    isComparisonModalOpen,
    isAuthModalOpen,
    comparisonList
  } = useStore();
  const [mountChatWidget, setMountChatWidget] = useState(false);

  // Prefetch secondary routes & mount non-critical chat widget on user interaction or post-load idle
  useEffect(() => {
    if (isSearchCrawler()) return;
    let triggered = false;
    const triggerPreload = () => {
      if (triggered) return;
      triggered = true;
      import('./pages/ShopPage').catch(() => {});
      import('./pages/ProductDetailPage').catch(() => {});
      import('./components/CartDrawer').catch(() => {});
      setMountChatWidget(true);
    };

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, triggerPreload, { once: true, passive: true }));
    const timer = window.setTimeout(triggerPreload, 6000);

    return () => {
      window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, triggerPreload));
    };
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'shop':
        return <ShopPage />;
      case 'product-detail':
        return <ProductDetailPage />;
      case 'cart':
        return <CartPage />;
      case 'checkout':
        return <CheckoutPage />;
      case 'confirmation':
        return <OrderConfirmationPage />;
      case 'tracking':
        return <OrderTrackingPage />;
      case 'account':
        return <CustomerAccountPage />;
      case 'compare':
        return <ShopPage />;
      case 'admin':
        return <AdminDashboard />;
      case 'about':
        return <AboutPage />;
      case 'contact':
        return <ContactPage />;
      case 'faqs':
        return <FaqPage />;
      case 'shipping-policy':
        return <PolicyPage type="shipping" />;
      case 'return-policy':
        return <PolicyPage type="return" />;
      case 'privacy-policy':
        return <PolicyPage type="privacy" />;
      case 'terms':
        return <PolicyPage type="terms" />;
      case 'size-guide':
        return <FaqPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0A] text-white">
      <DynamicMetaTags />
      <Header />
      {currentPage !== 'home' && (
        <Suspense fallback={<div className="h-10 sm:h-11 bg-[#14221C] border-b border-[#2A3B32]" />}>
          <TopCategoryStrip />
        </Suspense>
      )}
      <main className="flex-1 pb-16 md:pb-20">
        <Suspense fallback={
          <div className="min-h-[40vh] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#FF762E] rounded-full animate-spin" />
          </div>
        }>
          {renderPage()}
        </Suspense>
      </main>
      <Footer />
      <Suspense fallback={null}>
        {isCartDrawerOpen && <CartDrawer />}
        {isSizeGuideOpen && <SizeGuideModal />}
        {isComparisonModalOpen && <ProductComparisonModal />}
        {comparisonList.length > 0 && <FloatingComparisonDock />}
        {isAuthModalOpen && <AuthModal />}
        {mountChatWidget && <FloatingChatWidget />}
      </Suspense>
      <ToastContainer />
      <DarazBottomNav />
    </div>
  );
};

export default function App() {
  const [mountAnalytics, setMountAnalytics] = useState(false);

  useEffect(() => {
    if (isSearchCrawler()) return;
    let mounted = true;
    const enable = () => {
      if (mounted) setMountAnalytics(true);
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, enable, { once: true, passive: true }));
    const timer = window.setTimeout(enable, 5500);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, enable));
    };
  }, []);

  return (
    <StoreProvider>
      <MainContent />
      {mountAnalytics && <Analytics />}
    </StoreProvider>
  );
}
