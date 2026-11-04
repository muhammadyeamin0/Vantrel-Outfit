import React from 'react';
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
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { CustomerAccountPage } from './pages/CustomerAccountPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AboutPage, ContactPage, FaqPage, PolicyPage } from './pages/StaticPages';

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
        {renderPage()}
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
