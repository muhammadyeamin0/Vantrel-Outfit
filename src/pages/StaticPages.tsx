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

  const pillars = [
    {
      number: '01. Substance Over Noise',
      copy: 'We reject disposable, lightweight basics. Every garment is cut from densely milled heavyweight cotton (260 GSM jersey tees, 420 GSM French Terry fleece) and structured twill—engineered to hold architectural form wash after wash.'
    },
    {
      number: '02. Rooted in Craftsmanship',
      copy: 'Born in the knitwear capital of the world, VANTREL works directly with master patternmakers and boutique ateliers in Narayanganj and Gazipur—enforcing export-grade seam density, tonal hardware, and precision washes.'
    },
    {
      number: '03. Honest Luxury, Fair Value',
      copy: 'Zero intermediary retail markups. Every collection is released direct-to-consumer in Bangladeshi Taka (BDT), delivering international luxury streetwear standards with transparent, attainable value.'
    }
  ];

  const standards = [
    { metric: '260–420 GSM', label: 'Heavyweight Fabrics' },
    { metric: '100%', label: 'Batch Quality Control' },
    { metric: 'Nationwide', label: 'Cash on Delivery' },
    { metric: '7-Day', label: 'Easy Size Exchange' }
  ];

  return (
    <div className="bg-[#0A0A0A] text-[#F7F5EF] min-h-screen py-14 sm:py-20 selection:bg-white selection:text-black">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 sm:space-y-24">
        {/* 1. Editorial Hero Section */}
        <section className="text-center space-y-5 max-w-3xl mx-auto">
          <img
            src="/assets/images/vantrel-logo.webp"
            alt="VANTREL OUTFIT"
            width={56}
            height={56}
            className="w-14 h-14 object-contain rounded-xl bg-[#141414] p-2 mx-auto border border-white/15"
          />
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#FF762E]">
            OUR MANIFESTO
          </p>
          <h1 className="font-heading text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-[0.04em] uppercase leading-[0.95]">
            DEFINE YOUR NARRATIVE.
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Born in Bangladesh, VANTREL bridges architectural tailoring with contemporary street culture. We obsess over heavyweight textiles, precision silhouettes, and uncompromising durability—crafted for those who move with intent.
          </p>
        </section>

        {/* Hero Editorial Campaign Frame */}
        <div className="relative overflow-hidden border border-white/10 bg-[#141414] aspect-[16/9] shadow-2xl">
          <img
            src="/assets/images/hero_fashion_yeamin_1792588589630.webp"
            alt="VANTREL OUTFIT Architectural Streetwear Campaign"
            className="w-full h-full object-cover object-center contrast-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/80 via-transparent to-black/20" />
          <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-white/75">
            <span>VANTREL ATELIER — DHAKA</span>
            <span>ARCHIVE EDITION</span>
          </div>
        </div>

        {/* 2. Editorial Split Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center border-t border-white/10 pt-14 sm:pt-16">
          <div className="lg:col-span-6 relative overflow-hidden border border-white/10 bg-[#141414] aspect-[4/5] shadow-xl">
            <img
              src="/assets/images/editorial_story_backshot_1793118981432.webp"
              alt="Structured streetwear silhouette and heavyweight textile drape"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover object-center contrast-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>

          <div className="lg:col-span-6 space-y-6 lg:pl-4">
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.28em] text-[#FF762E]">
              SILHOUETTE &amp; PROPORTION
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-[1.02]">
              ENGINEERED FOR THE MODERN SILHOUETTE
            </h2>
            <div className="w-14 h-[2px] bg-[#FF762E]" />
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              Every pattern is drafted from first principles around intentional proportion. Our structured fits pair dropped shoulders and boxy drapes with clean necklines and heavyweight rib-knit collars that frame the upper body cleanly.
            </p>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Below the waist, relaxed trousers and architectural cargos fall with natural weight—balancing movement, structure, and minimalist restraint for everyday wear in Dhaka and beyond.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10 text-[11px] uppercase tracking-[0.18em] text-neutral-400 font-bold">
              <div>
                <span className="block text-white font-black text-sm tracking-normal mb-0.5">Structured</span>
                Tailored Fits
              </div>
              <div>
                <span className="block text-white font-black text-sm tracking-normal mb-0.5">Relaxed</span>
                Fluid Trousers
              </div>
              <div>
                <span className="block text-white font-black text-sm tracking-normal mb-0.5">Boxy</span>
                Architectural Drapes
              </div>
            </div>
          </div>
        </section>

        {/* 3. Three Core Pillars */}
        <section className="space-y-8 border-t border-white/10 pt-14 sm:pt-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#FF762E]">
                CORE PRINCIPLES
              </p>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mt-1">
                THE VANTREL STANDARD
              </h2>
            </div>
            <p className="text-xs text-neutral-400 uppercase tracking-[0.2em]">
              DHAKA, BANGLADESH
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pillars.map((pillar) => (
              <div
                key={pillar.number}
                className="bg-[#141414] p-7 border border-white/10 hover:border-white/25 transition-colors space-y-3"
              >
                <h3 className="font-heading font-bold text-base sm:text-lg text-white tracking-tight uppercase">
                  {pillar.number}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans">
                  {pillar.copy}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Minimalist 4-Column Brand Standards Strip */}
        <section className="border-y border-white/10 py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {standards.map((item, idx) => (
              <div
                key={item.label}
                className={`space-y-1.5 ${idx > 0 ? 'lg:border-l lg:border-white/10 lg:pl-8' : ''}`}
              >
                <p className="font-heading text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
                  {item.metric}
                </p>
                <p className="text-xs text-neutral-400 font-medium tracking-wider uppercase">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Editorial CTA */}
        <div className="text-center pb-4">
          <button
            onClick={() => {
              setCurrentPage('shop');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-10 py-4 bg-white hover:bg-neutral-200 text-black text-xs font-black uppercase tracking-[0.25em] transition-all shadow-xl cursor-pointer"
          >
            Explore The Drop →
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
                    href="https://www.facebook.com/vantreloutfit"
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
                href="https://www.facebook.com/vantreloutfit"
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
  const { settings } = useStore();
  const merchantLine = settings.bKashMerchantNumber || 'our official merchant number shown at checkout';

  const faqs = [
    {
      q: 'How does Cash on Delivery (COD) work?',
      a: 'Cash on Delivery is available across all 64 districts in Bangladesh. You simply place your order on our website without pre-paying. Our courier partner (Pathao / Steadfast) will deliver the parcel to your doorstep, where you pay the courier agent in cash upon receiving the package.'
    },
    {
      q: 'What are the delivery charges and timelines?',
      a: 'Inside Dhaka City delivery is 100% FREE (৳0) and arrives within 24–48 hours. Dhaka Sub-Area (Savar, Ashulia, Keraniganj, Dhamrai, Nawabganj, Dohar) and all 63 districts outside Dhaka are only ৳50 flat rate (48–72 hours).'
    },
    {
      q: 'Can I exchange the size if the garment does not fit me?',
      a: 'Yes, absolutely. We offer a 7-day hassle-free size replacement policy. Simply message our WhatsApp Business (https://wa.me/message/E6PISGJZC63TA1) or Facebook page (https://www.facebook.com/vantreloutfit) with your Order ID, and our courier will deliver the replacement size right to your door.'
    },
    {
      q: 'How do I pay using bKash or Nagad?',
      a: `At checkout, select bKash or Nagad. Make payment using the merchant option to our verified account (${merchantLine}) using the exact order total and reference VANTREL, then input your TrxID in the checkout field.`
    },
    {
      q: 'What makes VANTREL OUTFIT fabrics different?',
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
              • <strong>Inside Dhaka City:</strong> FREE Delivery (৳0). Delivery timeframe: 24 to 48 business hours.<br />
              • <strong>Dhaka Sub-Area (Savar, Ashulia, Keraniganj, Dhamrai, Nawabganj, Dohar):</strong> ৳50 flat rate. Delivery timeframe: 24 to 48 business hours.<br />
              • <strong>Outside Dhaka (All 63 Districts):</strong> ৳50 flat rate. Delivery timeframe: 48 to 72 business hours.
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
              In the rare event of a manufacturing defect or wrong item dispatched, VANTREL OUTFIT bears 100% of the courier costs to replace the item immediately.
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
              VANTREL OUTFIT NEVER asks for or stores your mobile banking PINs, OTP codes, or card CVVs. All mobile transactions occur directly within official bKash/Nagad USSD or secure SSL gateways.
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
              All prices displayed on VANTREL OUTFIT are denominated in Bangladeshi Taka (৳) and include all applicable local manufacturing costs.
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
