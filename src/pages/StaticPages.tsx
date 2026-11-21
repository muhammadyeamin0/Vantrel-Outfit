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
import aboutHeroBannerImg from '../assets/images/regenerated_image_1795276283085.png';

export const AboutPage: React.FC = () => {
  const { setCurrentPage } = useStore();

  const whyVantrel = [
    {
      index: '01',
      title: 'High-GSM Fabric Standard',
      copy: 'প্রতিটি প্রোডাক্টের ধরন অনুযায়ী আমরা সর্বোচ্চ মানের ও টেকসই GSM ফেব্রিক ব্যবহার করি, যাতে কাপড়ের ওজন, ড্রপ এবং দীর্ঘস্থায়িত্ব আপনাকে দেয় সত্যিকারের প্রিমিয়াম অনুভূতি।'
    },
    {
      index: '02',
      title: 'Seasonal Drops',
      copy: 'আবহাওয়া ও সময়ের ধারায় আমরা নিয়মিত কালেকশন আপডেট করি। গরমে আরামদায়ক ও ব্রিদেবল Summer Collection এবং শীতে উষ্ণ ও স্টাইলিশ Winter Collection—প্রতিটি সিজনেই পাবেন মানানসই আউটফিট।'
    },
    {
      index: '03',
      title: 'Signature Fit & Silhouette',
      copy: 'ক্যাজুয়াল এভরিডে ওয়্যার হোক বা বোল্ড স্ট্রিটওয়্যার—আমাদের প্রতিটি টি-শার্ট, হুডি ও ড্রপশোল্ডার শার্টের ফিট এমনভাবে তৈরি, যা আপনাকে দেয় স্বাচ্ছন্দ্য এবং শার্প লুক।'
    },
    {
      index: '04',
      title: 'Free Delivery in Dhaka',
      copy: 'ঢাকা শহরের ভেতরে সকল অর্ডারে থাকছে ফ্রি ডেলিভারি, যা আপনার শপিংকে করে আরও সহজ ও সাশ্রয়ী।'
    },
    {
      index: '05',
      title: 'Zero Advance Payment (100% COD)',
      copy: 'অর্ডারের সময় কোনো অগ্রিম টাকা দেওয়ার বাধ্যবাধকতা নেই। প্রোডাক্ট হাতে পেয়ে, দেখে-বুঝে তারপর পেমেন্ট করার সুবিধা থাকায় আপনি শপিং করতে পারেন সম্পূর্ণ নিশ্চিন্তে।'
    },
    {
      index: '06',
      title: 'Built on Trust & Transparency',
      copy: 'আমরা অতিরঞ্জিত প্রতিশ্রুতিতে নয়, ধারাবাহিক কোয়ালিটি ও স্বচ্ছতায় বিশ্বাসী। সঠিক প্রোডাক্ট এবং নির্ভরযোগ্য সার্ভিসের মাধ্যমে আমরা গড়ে তুলতে চাই কাস্টমারদের সাথে দীর্ঘমেয়াদী আস্থা।'
    }
  ];

  const standards = [
    { metric: 'High-GSM', label: 'Durable Fabric Standard' },
    { metric: 'Seasonal', label: 'Summer & Winter Drops' },
    { metric: 'Free Delivery', label: 'Inside Dhaka City' },
    { metric: '100% COD', label: 'Zero Advance Payment' }
  ];

  return (
    <div className="bg-[#0A0A0A] text-[#F7F5EF] min-h-screen py-14 sm:py-20 selection:bg-white selection:text-black">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 sm:space-y-24">
        {/* 1. Hero & About VANTREL Intro */}
        <section className="text-center space-y-6 max-w-3xl mx-auto">
          <img
            src="/assets/images/vantrel-logo.webp"
            alt="VANTREL OUTFIT"
            width={56}
            height={56}
            loading="eager"
            decoding="async"
            className="w-14 h-14 object-contain rounded-xl bg-[#141414] p-2 mx-auto border border-white/15"
          />
          <p className="font-heading text-xs sm:text-sm font-bold uppercase tracking-[0.28em] text-[#FF762E]">
            VANTREL — Wear Your Vibe
          </p>
          <h1 className="font-heading text-4xl sm:text-6xl font-black text-white tracking-[0.02em] uppercase leading-[1.02]">
            About VANTREL
          </h1>
          <p className="font-bangla text-base sm:text-lg text-[#F7F5EF]/90 max-w-3xl mx-auto leading-[1.85] font-normal">
            VANTREL একটি আধুনিক স্ট্রিটওয়্যার ও ক্যাজুয়াল অ্যাপারেল ব্র্যান্ড, যেখানে স্টাইল, ফেব্রিকের মান এবং স্বস্তি মিলে তৈরি হয় আপনার প্রতিদিনের সিগনেচার লুক। আমরা বিশ্বাস করি, আপনার পোশাক কেবল শরীর আবৃত করার মাধ্যম নয়—এটি আপনার ব্যক্তিত্ব, মুড এবং আত্মবিশ্বাসের বহিঃপ্রকাশ। Wear Your Vibe—এই দর্শন থেকেই প্রতিটি ডিজাইন ও ফিটের জন্ম।
          </p>
        </section>

        {/* Hero Editorial Campaign Frame */}
        <div className="relative overflow-hidden border border-white/10 bg-[#141414] aspect-[16/9] shadow-2xl">
          <img
            src={aboutHeroBannerImg}
            alt="VANTREL — Wear Your Vibe Streetwear Collection"
            width={1376}
            height={768}
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover object-center contrast-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/80 via-transparent to-black/20" />
          <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-white/85">
            <span>VANTREL — WEAR YOUR VIBE</span>
            <span>DHAKA, BANGLADESH</span>
          </div>
        </div>

        {/* 2. Collection Craftsmanship Split Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center border-t border-white/10 pt-14 sm:pt-16">
          <div className="lg:col-span-6 relative overflow-hidden border border-white/10 bg-[#141414] aspect-[4/5] shadow-xl">
            <img
              src="/assets/images/editorial_story_backshot_1793118981432.webp"
              alt="VANTREL T-Shirts, Hoodies & Dropshoulder Shirts Silhouette"
              width={1024}
              height={1024}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover object-center contrast-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>

          <div className="lg:col-span-6 space-y-6 lg:pl-4">
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.28em] text-[#FF762E]">
              SIGNATURE APPAREL
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-[1.06]">
              Crafted Cut, Fit &amp; Finishing
            </h2>
            <div className="w-14 h-[2px] bg-[#FF762E]" />
            <p className="font-bangla text-base sm:text-lg text-[#F7F5EF]/90 leading-[1.85]">
              আমাদের কালেকশনে রয়েছে প্রিমিয়াম টি-শার্ট, হুডি এবং ড্রপশোল্ডার শার্ট, যেগুলোর প্রতিটি পিসে কাটিং, ফিট এবং ফিনিশিংয়ের ওপর দেওয়া হয় নিখুঁত মনোযোগ।
            </p>
            <div className="grid grid-cols-3 gap-4 pt-5 border-t border-white/10 text-[11px] uppercase tracking-[0.16em] text-neutral-400 font-bold">
              <div>
                <span className="block text-white font-black text-sm tracking-normal mb-1">T-Shirts</span>
                Everyday Essential
              </div>
              <div>
                <span className="block text-white font-black text-sm tracking-normal mb-1">Hoodies</span>
                Heavyweight Warmth
              </div>
              <div>
                <span className="block text-white font-black text-sm tracking-normal mb-1">Dropshoulder</span>
                Sharp Silhouette
              </div>
            </div>
          </div>
        </section>

        {/* 3. Why VANTREL (6 Editorial Pillars) */}
        <section className="space-y-8 border-t border-white/10 pt-14 sm:pt-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#FF762E]">
                THE VANTREL STANDARD
              </p>
              <h2 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mt-1">
                Why VANTREL
              </h2>
            </div>
            <p className="text-xs text-neutral-400 uppercase tracking-[0.22em]">
              WEAR YOUR VIBE
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {whyVantrel.map((item) => (
              <article
                key={item.index}
                className="bg-[#141414] p-7 sm:p-8 border border-white/10 hover:border-white/25 transition-colors flex flex-col justify-start space-y-3.5"
              >
                <span className="font-heading text-xs font-bold tracking-[0.25em] text-[#FF762E]">
                  {item.index}
                </span>
                <h3 className="font-heading font-bold text-lg sm:text-xl text-white tracking-tight leading-snug">
                  {item.title}
                </h3>
                <p className="font-bangla text-sm sm:text-[15px] text-neutral-300 leading-[1.82]">
                  {item.copy}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* 4. Minimalist 4-Column Brand Highlights Strip */}
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

        {/* 5. Our Promise Manifesto & Collection CTA */}
        <section className="bg-[#141414] border border-white/12 p-8 sm:p-14 text-center space-y-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#FF762E]">
            QUALITY &amp; TRUST
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Our Promise
          </h2>
          <p className="font-bangla text-base sm:text-lg text-[#F7F5EF]/90 leading-[1.9] max-w-3xl mx-auto">
            সর্বোচ্চ মানের ফেব্রিক, সময়োপযোগী সিজনাল কালেকশন, ঢাকায় ফ্রি ডেলিভারি এবং ঝামেলামুক্ত Cash on Delivery-র সমন্বয়ে VANTREL আপনাকে দিচ্ছে এমন এক শপিং অভিজ্ঞতা, যেখানে স্টাইল ও বিশ্বাস—দুটোই সমানভাবে গুরুত্ব পায়।
          </p>
          <div className="w-16 h-[1px] bg-white/20 mx-auto" />
          <p className="font-heading text-base sm:text-lg font-bold tracking-[0.14em] text-white uppercase">
            VANTREL — Wear Your Vibe.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setCurrentPage('shop');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="min-h-[48px] px-8 sm:px-10 py-4 bg-white hover:bg-neutral-200 text-black text-xs sm:text-sm font-black uppercase tracking-[0.18em] transition-colors shadow-xl cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <span>Explore the collection at vantreloutfit.shop</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
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
          <p className="text-xs text-[#202522]/75 max-w-md mx-auto">
            Have questions regarding sizing, custom bulk orders, or your current delivery? Reach out to our team in Banani.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Info Card */}
          <div className="md:col-span-5 bg-[#14221C] text-[#F7F5EF] p-8 rounded-3xl space-y-6">
            <h2 className="font-heading text-xl font-bold uppercase tracking-tight text-white">
              Studio Details
            </h2>

            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#FF762E] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Banani Flagship Studio</p>
                  <p className="text-white/80 mt-0.5">{settings.address}</p>
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
                    className="text-[#4ADE80] hover:underline font-semibold block mt-0.5"
                  >
                    হোয়াটসঅ্যাপ বিজনেসে মেসেজ করুন
                  </a>
                  <p className="text-white/75 text-[10px]">Open Daily: 24/7 Live Support</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Facebook Support & Messaging</p>
                  <a
                    href="https://www.facebook.com/vantreloutfit"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#60A5FA] hover:underline font-semibold block mt-0.5"
                  >
                    ফেসবুকে মেসেজ করুন
                  </a>
                  <p className="text-white/75 text-[10px]">Open Daily: 24/7 Response</p>
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
            <h2 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
              Send Us a Message
            </h2>

            {submitted ? (
              <div className="p-8 text-center space-y-3 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5]">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
                <h3 className="font-bold text-[#14221C]">Message Sent!</h3>
                <p className="text-xs text-[#202522]/75">
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
          <p className="text-xs text-[#202522]/75">
            Everything you need to know regarding delivery, payments, and our 7-day size guarantee.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-[#E5E1D5] shadow-2xs space-y-2">
              <h2 className="font-heading text-base font-bold text-[#14221C]">
                {faq.q}
              </h2>
              <p className="text-xs text-[#202522]/80 leading-relaxed font-sans">
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 bg-white p-8 sm:p-12 rounded-3xl border border-[#E5E1D5] shadow-xs text-xs text-[#202522]/85 leading-relaxed font-sans">
        {type === 'shipping' && (
          <>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#14221C] uppercase tracking-tight">
              Shipping & Courier Delivery Policy
            </h1>
            <p className="text-[#202522]/75">Last updated: October 2026</p>

            <h2 className="text-sm font-bold text-[#14221C] uppercase pt-4">1. Delivery Zones & Charges</h2>
            <p>
              • <strong>Inside Dhaka City:</strong> FREE Delivery (৳0). Delivery timeframe: 24 to 48 business hours.<br />
              • <strong>Dhaka Sub-Area (Savar, Ashulia, Keraniganj, Dhamrai, Nawabganj, Dohar):</strong> ৳50 flat rate. Delivery timeframe: 24 to 48 business hours.<br />
              • <strong>Outside Dhaka (All 63 Districts):</strong> ৳50 flat rate. Delivery timeframe: 48 to 72 business hours.
            </p>

            <h2 className="text-sm font-bold text-[#14221C] uppercase pt-4">2. Courier Partners</h2>
            <p>
              We partner with licensed, reputable courier logistics providers including Pathao Courier, Steadfast Courier, and eCourier. Every parcel receives a unique trackable shipment ID.
            </p>

            <h2 className="text-sm font-bold text-[#14221C] uppercase pt-4">3. Verification Before Dispatch</h2>
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
            <p className="text-[#202522]/75">Last updated: October 2026</p>

            <h2 className="text-sm font-bold text-[#14221C] uppercase pt-4">1. Easy Size Replacement</h2>
            <p>
              If a garment does not fit as desired, you can request an exchange within 7 calendar days of delivery. The garment must be unworn, unwashed, and retained in its original condition with labels intact.
            </p>

            <h2 className="text-sm font-bold text-[#14221C] uppercase pt-4">2. Defective or Damaged Pieces</h2>
            <p>
              In the rare event of a manufacturing defect or wrong item dispatched, VANTREL OUTFIT bears 100% of the courier costs to replace the item immediately.
            </p>

            <h2 className="text-sm font-bold text-[#14221C] uppercase pt-4">3. Refund Processing</h2>
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
            <p className="text-[#202522]/75">Last updated: October 2026</p>

            <h2 className="text-sm font-bold text-[#14221C] uppercase pt-4">1. Data Collected</h2>
            <p>
              We only collect information strictly required to fulfill your garment deliveries: Full Name, Delivery Address, Bangladesh Mobile Number, and optional Email for invoice copies.
            </p>

            <h2 className="text-sm font-bold text-[#14221C] uppercase pt-4">2. Payment Security</h2>
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
            <p className="text-[#202522]/75">Last updated: October 2026</p>

            <h2 className="text-sm font-bold text-[#14221C] uppercase pt-4">1. Pricing in BDT</h2>
            <p>
              All prices displayed on VANTREL OUTFIT are denominated in Bangladeshi Taka (৳) and include all applicable local manufacturing costs.
            </p>

            <h2 className="text-sm font-bold text-[#14221C] uppercase pt-4">2. Order Integrity</h2>
            <p>
              We reserve the right to cancel suspicious bookings or orders placed with unreachable telephone numbers to prevent courier returns.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
