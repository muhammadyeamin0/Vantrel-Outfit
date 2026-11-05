import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  MessageCircle,
  HelpCircle,
  Truck,
  RotateCcw,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const { setCurrentPage } = useStore();

  return (
    <div className="bg-[#F7F5EF] min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <img
            src="/assets/images/vantrel-logo.png"
            alt="VANTREL"
            className="w-16 h-16 object-contain rounded-2xl bg-black p-2 shadow-md mx-auto border border-stone-200"
          />
          <span className="text-xs font-bold uppercase tracking-widest text-[#FF762E]">
            Our Manifesto
          </span>
          <h1 className="font-heading text-4xl sm:text-5xl font-black text-[#14221C] tracking-tight uppercase">
            Define Your Narrative.
          </h1>
          <p className="text-xs sm:text-sm text-[#202522]/70 max-w-xl mx-auto leading-relaxed">
            VANTREL was established in Dhaka to redefine contemporary South Asian apparel through heavyweight textiles, understated silhouettes, and structural architectural integrity.
          </p>
        </div>

        {/* Hero image banner */}
        <div className="rounded-3xl overflow-hidden border border-[#E5E1D5] shadow-md aspect-[16/9]">
          <img
            src="/src/assets/images/hero_fashion_yeamin_1792588589630.jpg"
            alt="YEAMIN WEAR Atelier"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-[#E5E1D5] space-y-2">
            <h3 className="font-heading font-bold text-base text-[#14221C]">
              01. Substance Over Noise
            </h3>
            <p className="text-xs text-[#202522]/70 leading-relaxed font-sans">
              We reject thin, disposable fast-fashion cotton. Our t-shirts start at 260 GSM and our hoodies at 420 GSM—built for lifetime wear.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E5E1D5] space-y-2">
            <h3 className="font-heading font-bold text-base text-[#14221C]">
              02. Rooted in Bangladesh
            </h3>
            <p className="text-xs text-[#202522]/70 leading-relaxed font-sans">
              Bangladesh is the world's premier knitwear hub. We partner directly with master knitters and stitchers in Narayanganj and Gazipur.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E5E1D5] space-y-2">
            <h3 className="font-heading font-bold text-base text-[#14221C]">
              03. Transparent Pricing
            </h3>
            <p className="text-xs text-[#202522]/70 leading-relaxed font-sans">
              No middleman markups. Every piece is priced fairly in Bangladeshi Taka, accessible to youth, creators, and discerning tastemakers.
            </p>
          </div>
        </div>

        <div className="text-center pt-4">
          <button
            onClick={() => setCurrentPage('shop')}
            className="px-8 py-3.5 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md"
          >
            Explore The Drop
          </button>
        </div>
      </div>
    </div>
  );
};

export const ContactPage: React.FC = () => {
  const { settings, showToast } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      showToast('Validation Error', 'Please enter your name and message.', 'error');
      return;
    }
    setSubmitted(true);
    showToast('Inquiry Received', 'Our Dhaka concierge will contact you within 4 business hours.', 'success');
  };

  return (
    <div className="bg-[#F7F5EF] min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#FF762E]">
            Get In Touch
          </span>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#14221C] tracking-tight uppercase">
            Contact & Flagship Studio
          </h1>
          <p className="text-xs text-[#202522]/60 max-w-md mx-auto">
            Have questions regarding sizing, custom bulk orders, or your current delivery? Reach out to our team in Banani.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Info Card */}
          <div className="md:col-span-5 bg-[#14221C] text-[#F7F5EF] p-8 rounded-3xl space-y-6">
            <h3 className="font-heading text-xl font-bold uppercase tracking-tight text-white">
              Studio Details
            </h3>

            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#FF762E] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Banani Flagship Studio</p>
                  <p className="text-white/70 mt-0.5">{settings.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">WhatsApp Business Helpline</p>
                  <a
                    href="https://wa.me/message/E6PISGJZC63TA1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#25D366] hover:underline font-semibold block mt-0.5"
                  >
                    হোয়াটসঅ্যাপ বিজনেসে মেসেজ করুন
                  </a>
                  <p className="text-white/50 text-[10px]">Open Daily: 24/7 Live Support</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 text-[#1877F2] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Facebook Support & Messaging</p>
                  <a
                    href="https://www.facebook.com/share/18qNnMStUm/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1877F2] hover:underline font-semibold block mt-0.5"
                  >
                    ফেসবুকে মেসেজ করুন
                  </a>
                  <p className="text-white/50 text-[10px]">Open Daily: 24/7 Response</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#FF762E] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Official Correspondence</p>
                  <p className="text-white/70 mt-0.5">{settings.email}</p>
                </div>
              </div>
            </div>

            {/* Direct WhatsApp & Facebook Actions */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <a
                href="https://wa.me/message/E6PISGJZC63TA1"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat on WhatsApp Business (হোয়াটসঅ্যাপ)</span>
              </a>
              <a
                href="https://www.facebook.com/share/18qNnMStUm/"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Message on Facebook (ফেসবুকে মেসেজ করুন)</span>
              </a>
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-7 bg-white p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
            <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
              Send Us a Message
            </h3>

            {submitted ? (
              <div className="p-8 text-center space-y-3 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5]">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
                <h4 className="font-bold text-[#14221C]">Message Sent!</h4>
                <p className="text-xs text-[#202522]/70">
                  Thank you for reaching out. We will get back to your mobile or email shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    Your Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mahfuzur Rahman"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#14221C] mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#14221C] mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      placeholder="017XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    Message or Question <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="How can we assist you today?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5 text-[#FF762E]" />
                  <span>Transmit Inquiry</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const FaqPage: React.FC = () => {
  const faqs = [
    {
      q: 'How does Cash on Delivery (COD) work?',
      a: 'Cash on Delivery is available across all 64 districts in Bangladesh. You simply place your order on our website without pre-paying. Our courier partner (Pathao / Steadfast) will deliver the parcel to your doorstep, where you pay the courier agent in cash upon receiving the package.'
    },
    {
      q: 'What are the delivery charges and timelines?',
      a: 'Inside Dhaka delivery is ৳70 and arrives within 24–48 hours. Outside Dhaka delivery is ৳130 and arrives within 2–4 business days. Orders with a subtotal of ৳3,000 or more enjoy 100% Free Nationwide Delivery.'
    },
    {
      q: 'Can I exchange the size if the garment does not fit me?',
      a: 'Yes, absolutely. We offer a 7-day hassle-free size replacement policy. Simply message our WhatsApp Business (https://wa.me/message/E6PISGJZC63TA1) or Facebook page (https://www.facebook.com/share/18qNnMStUm/) with your Order ID, and our courier will deliver the replacement size right to your door.'
    },
    {
      q: 'How do I pay using bKash or Nagad?',
      a: 'At checkout, select bKash or Nagad. Make payment using the merchant option to our official verified number (01711234567) using the exact order total and reference YEAMIN, then input your TrxID in the checkout field.'
    },
    {
      q: 'What makes YEAMIN WEAR fabrics different?',
      a: 'All our cotton is 100% combed ringspun cotton milled in Bangladesh. Our heavyweight hoodies are made of 420 GSM custom loopback French terry, and our tees use 260 GSM high-density cotton that prevents neck-rib stretching and fading.'
    }
  ];

  return (
    <div className="bg-[#F7F5EF] min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#FF762E]">
            Common Queries
          </span>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#14221C] tracking-tight uppercase">
            Frequently Asked Questions
          </h1>
          <p className="text-xs text-[#202522]/60">
            Everything you need to know regarding delivery, payments, and our 7-day size guarantee.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-[#E5E1D5] shadow-2xs space-y-2">
              <h3 className="font-heading text-base font-bold text-[#14221C]">
                {faq.q}
              </h3>
              <p className="text-xs text-[#202522]/70 leading-relaxed font-sans">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PolicyPage: React.FC<{ type: 'shipping' | 'return' | 'privacy' | 'terms' }> = ({ type }) => {
  return (
    <div className="bg-[#F7F5EF] min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 bg-white p-8 sm:p-12 rounded-3xl border border-[#E5E1D5] shadow-xs text-xs text-[#202522]/80 leading-relaxed font-sans">
        {type === 'shipping' && (
          <>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#14221C] uppercase tracking-tight">
              Shipping & Courier Delivery Policy
            </h1>
            <p className="text-[#202522]/60">Last updated: October 2026</p>

            <h3 className="text-sm font-bold text-[#14221C] uppercase pt-4">1. Delivery Zones & Charges</h3>
            <p>
              • <strong>Inside Dhaka Metro:</strong> ৳70 flat rate. Delivery timeframe: 24 to 48 business hours.<br />
              • <strong>Outside Dhaka Metro (All 63 Districts):</strong> ৳130 flat rate. Delivery timeframe: 48 to 72 business hours.<br />
              • <strong>Free Nationwide Delivery:</strong> All orders with a subtotal equal to or exceeding ৳3,000 qualify for free courier delivery anywhere in Bangladesh.
            </p>

            <h3 className="text-sm font-bold text-[#14221C] uppercase pt-4">2. Courier Partners</h3>
            <p>
              We partner with licensed, reputable courier logistics providers including Pathao Courier, Steadfast Courier, and eCourier. Every parcel receives a unique trackable shipment ID.
            </p>

            <h3 className="text-sm font-bold text-[#14221C] uppercase pt-4">3. Verification Before Dispatch</h3>
            <p>
              To eliminate duplicate or fraudulent bookings, our customer concierge may call your registered mobile number to confirm address details prior to courier pickup.
            </p>
          </>
        )}

        {type === 'return' && (
          <>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#14221C] uppercase tracking-tight">
              7-Day Returns & Size Exchange Policy
            </h1>
            <p className="text-[#202522]/60">Last updated: October 2026</p>

            <h3 className="text-sm font-bold text-[#14221C] uppercase pt-4">1. Easy Size Replacement</h3>
            <p>
              If a garment does not fit as desired, you can request an exchange within 7 calendar days of delivery. The garment must be unworn, unwashed, and retained in its original condition with labels intact.
            </p>

            <h3 className="text-sm font-bold text-[#14221C] uppercase pt-4">2. Defective or Damaged Pieces</h3>
            <p>
              In the rare event of a manufacturing defect or wrong item dispatched, VANTREL bears 100% of the courier costs to replace the item immediately.
            </p>

            <h3 className="text-sm font-bold text-[#14221C] uppercase pt-4">3. Refund Processing</h3>
            <p>
              Refunds for eligible cancellations or pre-paid returned orders are reimbursed via original payment channel (bKash, Nagad, or Bank transfer) within 3–5 working days.
            </p>
          </>
        )}

        {type === 'privacy' && (
          <>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#14221C] uppercase tracking-tight">
              Privacy Policy & Customer Security
            </h1>
            <p className="text-[#202522]/60">Last updated: October 2026</p>

            <h3 className="text-sm font-bold text-[#14221C] uppercase pt-4">1. Data Collected</h3>
            <p>
              We only collect information strictly required to fulfill your garment deliveries: Full Name, Delivery Address, Bangladesh Mobile Number, and optional Email for invoice copies.
            </p>

            <h3 className="text-sm font-bold text-[#14221C] uppercase pt-4">2. Payment Security</h3>
            <p>
              VANTREL NEVER asks for or stores your mobile banking PINs, OTP codes, or card CVVs. All mobile transactions occur directly within official bKash/Nagad USSD or secure SSL gateways.
            </p>
          </>
        )}

        {type === 'terms' && (
          <>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#14221C] uppercase tracking-tight">
              Terms & Conditions of Service
            </h1>
            <p className="text-[#202522]/60">Last updated: October 2026</p>

            <h3 className="text-sm font-bold text-[#14221C] uppercase pt-4">1. Pricing in BDT</h3>
            <p>
              All prices displayed on VANTREL are denominated in Bangladeshi Taka (৳) and include all applicable local manufacturing costs.
            </p>

            <h3 className="text-sm font-bold text-[#14221C] uppercase pt-4">2. Order Integrity</h3>
            <p>
              We reserve the right to cancel suspicious bookings or orders placed with unreachable telephone numbers to prevent courier returns.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
