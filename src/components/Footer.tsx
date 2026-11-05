import React, { useState } from 'react';
import { useStore, PageRoute } from '../context/StoreContext';
import { ProductCategory } from '../types';
import { Mail, Phone, MapPin, Send, ShieldCheck, ArrowUpRight, MessageCircle } from 'lucide-react';

export const Footer: React.FC = () => {
  const { settings, setCurrentPage, setSelectedCategory, showToast } = useStore();
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      showToast('Invalid Email', 'Please enter a valid email address.', 'error');
      return;
    }
    showToast('Subscribed!', 'Welcome to VANTREL. Use code VANTREL10 on your next order.', 'success');
    setEmail('');
  };

  const navigateTo = (route: PageRoute, category?: ProductCategory) => {
    if (category) setSelectedCategory(category);
    setCurrentPage(route);
  };

  return (
    <footer className="bg-[#0A0A0A] text-white pt-16 pb-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-white/10">
          {/* Brand Info & Newsletter */}
          <div className="lg:col-span-2 space-y-4">
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('home');
              }}
              className="inline-flex items-center gap-3 group select-none"
            >
              <img
                src="/assets/images/vantrel-logo.png"
                alt="VANTREL OUTFIT"
                className="w-10 h-10 object-contain rounded-lg bg-black border border-white/15 p-0.5 group-hover:border-white/40 transition-colors"
              />
              <span className="font-heading text-xl sm:text-2xl font-black tracking-[0.12em] text-white uppercase whitespace-nowrap">
                VANTREL OUTFIT
              </span>
            </a>
            <p className="text-xs text-white/70 max-w-sm leading-relaxed">
              Define Your Narrative. Architectural, contemporary streetwear engineered for modern tastemakers in Bangladesh and beyond.
            </p>

            {/* Newsletter */}
            <div className="pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                Join The Collective
              </h4>
              <p className="text-[11px] text-white/60 mb-3">
                Receive secret drop previews, editorial releases, and an instant 10% coupon.
              </p>
              <form onSubmit={handleSubscribe} className="flex max-w-sm gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white/5 border border-white/15 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-[#FF762E]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF762E] hover:bg-[#e8631c] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <span>Join</span>
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          </div>

          {/* Quick Categories */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Collections
            </h4>
            <ul className="space-y-2 text-xs text-white/70">
              <li>
                <button onClick={() => navigateTo('shop', 'Hoodies')} className="hover:text-white transition-colors">
                  Heavyweight Hoodies
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('shop', 'T-Shirts')} className="hover:text-white transition-colors">
                  Artisan Oversized Tees
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('shop', 'Jeans')} className="hover:text-white transition-colors">
                  Raw Selvedge Denim
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('shop', 'Traditional Wear')} className="hover:text-white transition-colors">
                  Linen Panjabi & Ethnic
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('shop', 'Pants')} className="hover:text-white transition-colors">
                  Utility Cargo Pants
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('shop', 'Accessories')} className="hover:text-white transition-colors">
                  Canvas Bags & Accessories
                </button>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Customer Care
            </h4>
            <ul className="space-y-2 text-xs text-white/70">
              <li>
                <button onClick={() => navigateTo('size-guide')} className="hover:text-white transition-colors">
                  Size Guide & Measurements
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('shipping-policy')} className="hover:text-white transition-colors">
                  Shipping & Delivery
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('return-policy')} className="hover:text-white transition-colors">
                  7-Day Returns & Exchanges
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('faqs')} className="hover:text-white transition-colors">
                  Frequently Asked Questions
                </button>
              </li>
              <li>
                <button onClick={() => navigateTo('contact')} className="hover:text-white transition-colors">
                  Contact Support
                </button>
              </li>
            </ul>
          </div>

          {/* Store & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Flagship Studio
            </h4>
            <div className="space-y-2 text-xs text-white/70">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#FF762E] shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </div>
              <a
                href="https://wa.me/message/E6PISGJZC63TA1"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-[#25D366] text-white/90 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                <span>হোয়াটসঅ্যাপ হেল্পলাইন (WhatsApp Business)</span>
              </a>
              <a
                href="https://www.facebook.com/share/18qNnMStUm/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-[#1877F2] text-white/90 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#1877F2] shrink-0" />
                <span>ফেসবুক সাপোর্ট (Facebook Support)</span>
              </a>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#FF762E] shrink-0" />
                <span>{settings.email}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-1 text-[11px] text-white/50">
              <div>
                <button onClick={() => navigateTo('privacy-policy')} className="hover:text-white transition-colors">
                  Privacy Policy
                </button>
                <span className="mx-1.5">·</span>
                <button onClick={() => navigateTo('terms')} className="hover:text-white transition-colors">
                  Terms of Service
                </button>
              </div>
              <div>
                <button
                  onClick={() => navigateTo('admin')}
                  className="hover:text-[#FF762E] transition-colors inline-flex items-center gap-1 font-semibold"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>Admin Portal</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar & Trust Indicators */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <div>
            © {new Date().getFullYear()} VANTREL OUTFIT. All rights reserved. Registered fashion trademark in Bangladesh.
          </div>

          {/* Payment Badges Supported in Bangladesh */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-white/40 mr-1">Secured Payments:</span>
            <span className="px-2 py-0.5 bg-white/10 rounded text-pink-300 font-bold">bKash</span>
            <span className="px-2 py-0.5 bg-white/10 rounded text-orange-300 font-bold">Nagad</span>
            <span className="px-2 py-0.5 bg-white/10 rounded text-purple-300 font-bold">Rocket</span>
            <span className="px-2 py-0.5 bg-white/10 rounded text-emerald-300 font-medium">Cash on Delivery</span>
            <span className="px-2 py-0.5 bg-white/10 rounded text-sky-300 font-medium">Cards & Net Banking</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
