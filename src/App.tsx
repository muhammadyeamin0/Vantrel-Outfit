import React, { Suspense, lazy } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { SizeGuideModal } from './components/SizeGuideModal';
import { ProductComparisonModal, FloatingComparisonDock } from './components/ProductComparisonModal';
import { AuthModal } from './components/AuthModal';
import { ToastContainer } from './components/Toast';
import { FloatingChatWidget } from './components/FloatingChatWidget';
import { DarazBottomNav } from './components/DarazBottomNav';
import { TopCategoryStrip } from './components/TopCategoryStrip';
import { DynamicMetaTags } from './components/DynamicMetaTags';

import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';

// Lazy-load non-critical & heavy routes to achieve sub-second initial mobile load
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const CustomerAccountPage = lazy(() => import('./pages/CustomerAccountPage').then(m => ({ default: m.CustomerAccountPage })));
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage').then(m => ({ default: m.OrderTrackingPage })));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage').then(m => ({ default: m.OrderConfirmationPage })));
const AboutPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.ContactPage })));
const FaqPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.FaqPage })));
const PolicyPage = lazy(() => import('./pages/StaticPages').then(m => ({ default: m.PolicyPage })));

const MainContent: React.FC = () => {
  const { currentPage } = useStore();

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
      {currentPage !== 'home' && <TopCategoryStrip />}
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
      <CartDrawer />
      <SizeGuideModal />
      <ProductComparisonModal />
      <FloatingComparisonDock />
      <AuthModal />
      <FloatingChatWidget />
      <ToastContainer />
      <DarazBottomNav />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainContent />
      <Analytics />
    </StoreProvider>
  );
}
