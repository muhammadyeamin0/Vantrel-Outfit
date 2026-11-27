import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { toDisplayImageUrl, handleProxyImageError } from '../utils/imageProxy';
import { buildSeoImageAlt } from '../utils/imageSeoAndDownload';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShoppingBag,
  Check,
  Truck,
  Phone,
  User as UserIcon,
  MapPin,
  Lock,
  AlertCircle,
  BookmarkCheck,
  Building2
} from 'lucide-react';
import { Address } from '../types';
import { getSavedAddresses, saveAddressLocally } from '../utils/addressStorage';
import { BANGLADESH_DIVISIONS, isDhakaSubArea, resolveDeliveryZone } from '../data/bangladeshData';
import { isProductOutOfStock } from '../utils/stockVisibility';
import { applyMetaAdvancedMatching, trackMetaInitiateCheckout } from '../utils/metaPixel';

export const CartDrawer: React.FC = () => {
  const {
    products,
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartSubtotal,
    settings,
    calculateDeliveryFee,
    placeOrder,
    setCurrentPage,
    currentUser,
    addUserAddress,
    showToast
  } = useStore();

  // Fast direct order from Cart form states
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);

  // Flat list of all 64 districts for lookup
  const allDistricts = useMemo(() => {
    const list: { name: string; division: string; isDhakaCity?: boolean; upazilas: string[] }[] = [];
    BANGLADESH_DIVISIONS.forEach((div) => {
      div.districts.forEach((dist) => {
        list.push({
          name: dist.name,
          division: div.name,
          isDhakaCity: dist.isDhakaCity,
          upazilas: dist.upazilas
        });
      });
    });
    return list;
  }, []);

  const [name, setName] = useState(
    currentUser?.name && currentUser.name !== 'VANTREL Member' ? currentUser.name : ''
  );
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [district, setDistrict] = useState('Dhaka');
  const [upazila, setUpazila] = useState('Dhanmondi');
  const [customUpazila, setCustomUpazila] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const initiatedDrawerCheckoutRef = React.useRef(false);

  useEffect(() => {
    if (!isCartDrawerOpen) {
      initiatedDrawerCheckoutRef.current = false;
    }
  }, [isCartDrawerOpen]);

  // Fire Meta Pixel InitiateCheckout once when customer starts checkout inside CartDrawer
  const triggerDrawerInitiateCheckout = () => {
    if (initiatedDrawerCheckoutRef.current || cart.length === 0) return;
    initiatedDrawerCheckoutRef.current = true;
    trackMetaInitiateCheckout(
      cart,
      cartSubtotal,
      settings.metaPixelId,
      settings.isMetaPixelEnabled ?? true
    );
  };

  const currentDistrictObj = allDistricts.find(
    (d) => d.name.toLowerCase() === district.toLowerCase()
  );
  const availableUpazilas = currentDistrictObj ? currentDistrictObj.upazilas : [];

  const handleDistrictChange = (newDistName: string) => {
    setDistrict(newDistName);
    const found = allDistricts.find((d) => d.name === newDistName);
    if (found && found.upazilas.length > 0) {
      setUpazila(found.upazilas[0]);
    } else {
      setUpazila('');
    }
    setCustomUpazila('');
  };

  // Load saved addresses
  useEffect(() => {
    const list = getSavedAddresses(currentUser);
    setSavedAddresses(list);
    if (list.length > 0 && selectedAddressIndex === null && !isAddingNewAddress) {
      setSelectedAddressIndex(0);
      const primary = list[0];
      setName(primary.fullName || (currentUser?.name && currentUser.name !== 'VANTREL Member' ? currentUser.name : ''));
      setPhone(primary.phone || currentUser?.phone || '');
      if (primary.district) setDistrict(primary.district);
      if (primary.upazila) {
        setUpazila(primary.upazila);
      }
      setAddress(primary.streetAddress || '');
    }
  }, [currentUser]);

  const handleSelectSavedAddress = (index: number) => {
    setSelectedAddressIndex(index);
    setIsAddingNewAddress(false);
    const addr = savedAddresses[index];
    if (addr) {
      setName(addr.fullName);
      setPhone(addr.phone);
      if (addr.district) setDistrict(addr.district);
      if (addr.upazila) setUpazila(addr.upazila);
      setAddress(addr.streetAddress);
    }
  };

  const handleStartAddNewAddress = () => {
    setSelectedAddressIndex(null);
    setIsAddingNewAddress(true);
    setAddress('');
  };

  if (!isCartDrawerOpen) return null;

  const isDhaka = district.trim().toLowerCase() === 'dhaka';
  const activeUpazilaForZone = upazila === 'other' ? customUpazila : upazila;
  const deliveryZone = resolveDeliveryZone(district, activeUpazilaForZone);
  const deliveryFee = calculateDeliveryFee(deliveryZone, cartSubtotal);
  const grandTotal = cartSubtotal + deliveryFee;

  const getDrawerItemAvailability = (item: (typeof cart)[number]) => {
    const liveProd = products.find((p) => p.id === item.productId);
    if (!liveProd || liveProd.isArchived || liveProd.status === 'archived' || isProductOutOfStock(liveProd)) {
      return { isUnavailable: true, reason: 'Out of Stock · স্টক শেষ', availableStock: 0 };
    }
    const variant = liveProd.variants?.find((v) => v.size === item.size && v.color === item.color);
    const availableStock = variant ? variant.stock : liveProd.totalStock;
    if (availableStock <= 0) {
      return { isUnavailable: true, reason: 'এই সাইজটি Out of Stock', availableStock: 0 };
    }
    if (item.quantity > availableStock) {
      return { isUnavailable: true, reason: `সর্বোচ্চ ${availableStock} টি স্টকে আছে`, availableStock };
    }
    return { isUnavailable: false, reason: '', availableStock };
  };

  const hasUnavailableItems = cart.some((item) => getDrawerItemAvailability(item).isUnavailable);

  // Direct 1-Click Order from Cart (No separate checkout page)
  const handleDirectCartOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (hasUnavailableItems) {
      setFormError('কার্টে থাকা Out of Stock পণ্যটি সরিয়ে তারপর অর্ডার করুন।');
      return;
    }

    // 1. নাম (Full Name) - Mandatory
    if (!name.trim() || name.trim().length < 2) {
      setFormError('আপনার সম্পূর্ণ নাম লিখুন (নাম প্রদান করা আবশ্যক)');
      return;
    }

    // 2. নাম্বার (Phone Number) - Mandatory
    const cleanPhone = phone.replace(/[-+\s]/g, '');
    const bdPhoneRegex = /^(?:\+?880|880|0)?1[3-9]\d{8}$/;
    if (!cleanPhone || !bdPhoneRegex.test(cleanPhone)) {
      setFormError('সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন (যেমন: 017XXXXXXXX)');
      return;
    }

    // 3. জেলা (District) - Mandatory
    if (!district.trim()) {
      setFormError('ডেলিভারির জেলা নির্বাচন করুন (আবশ্যক)');
      return;
    }

    // 4. উপজেলা / থানা (Upazila) - Mandatory
    const finalUpazila = upazila === 'other' ? customUpazila.trim() : upazila.trim();
    if (!finalUpazila || finalUpazila.length < 2) {
      setFormError('উপজেলা বা থানার নাম নির্বাচন বা লিখুন (আবশ্যক)');
      return;
    }

    // 5. বিস্তারিত ঠিকানা (Address) - Mandatory
    if (!address.trim() || address.trim().length < 5) {
      setFormError('বিস্তারিত ডেলিভারি ঠিকানা লিখুন (বাড়ি/রোড নং, এলাকা - আবশ্যক)');
      return;
    }

    setIsSubmitting(true);

    const customerAddress: Address = {
      fullName: name.trim(),
      phone: cleanPhone,
      division: currentDistrictObj ? currentDistrictObj.division : (isDhaka ? 'Dhaka' : 'Outside Dhaka'),
      district: district.trim(),
      upazila: finalUpazila,
      streetAddress: address.trim()
    };

    // Ensure InitiateCheckout and Advanced Matching are recorded on direct drawer order submit
    triggerDrawerInitiateCheckout();
    applyMetaAdvancedMatching(
      {
        email: currentUser?.email,
        phone: customerAddress.phone,
        fullName: customerAddress.fullName,
        city: customerAddress.district,
        country: 'bd'
      },
      settings.metaPixelId,
      settings.isMetaPixelEnabled ?? true
    );

    setTimeout(() => {
      const result = placeOrder({
        customer: customerAddress,
        deliveryZone,
        paymentMethod: 'Cash on Delivery (COD)'
      });

      setIsSubmitting(false);

      if (result.success && result.order) {
        // Automatically save address for future 1-click re-use
        saveAddressLocally(customerAddress);
        if (addUserAddress) {
          addUserAddress(customerAddress);
        }

        setIsCartDrawerOpen(false);
        showToast(
          'অর্ডার সফল হয়েছে!',
          `অর্ডার #${result.order.orderNumber} সফলভাবে গ্রহণ করা হয়েছে।`,
          'success'
        );
        window.scrollTo({ top: 0, behavior: 'instant' });
        setCurrentPage('confirmation');
      } else {
        setFormError(result.error || 'অর্ডার সম্পন্ন করা যায়নি।');
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartDrawerOpen(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-full max-w-md bg-[#F7F5EF] text-[#202522] shadow-2xl flex flex-col border-l border-[#E5E1D5]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-[#E5E1D5]">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#14221C]" />
              <h2 className="text-sm sm:text-base font-bold text-[#14221C] uppercase tracking-wider">
                আপনার কার্ট ({cart.reduce((s, i) => s + i.quantity, 0)} টি পোশাক)
              </h2>
            </div>
            <button
              onClick={() => setIsCartDrawerOpen(false)}
              className="p-1 rounded-lg text-[#202522]/60 hover:text-[#14221C] transition-colors cursor-pointer"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Delivery Note */}
          <div className="px-5 py-2.5 bg-emerald-50/80 border-b border-emerald-100 text-xs text-emerald-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>ঢাকায় ফ্রি ডেলিভারি (৳০) · সাব-এরিয়া ও ৬৩ জেলায় ৳৫০</span>
            </span>
          </div>

          {/* Items List */}
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#EAE5D8] flex items-center justify-center text-[#14221C]">
                <ShoppingBag className="w-8 h-8 opacity-40" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#14221C]">আপনার কার্ট বর্তমানে খালি</h3>
                <p className="text-xs text-[#202522]/60 max-w-xs">
                  আমাদের সিগনেচার ক্লাসিক শার্ট, প্রিমিয়াম হুডি ও সোয়েটার কালেকশন থেকে পোশাক যুক্ত করুন।
                </p>
              </div>
              <button
                onClick={() => {
                  setIsCartDrawerOpen(false);
                  setCurrentPage('shop');
                }}
                className="px-6 py-2.5 bg-[#14221C] text-white text-xs font-semibold uppercase tracking-wider rounded-xl hover:bg-[#202522] transition-colors cursor-pointer shadow-sm"
              >
                কালেকশন দেখুন
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-4 divide-y divide-[#E5E1D5]">
              {/* Cart Products List */}
              <div className="space-y-3.5">
                {cart.map((item) => {
                  const avail = getDrawerItemAvailability(item);
                  return (
                  <div key={item.id} className={`pt-3.5 first:pt-0 flex gap-3 bg-white p-3 rounded-2xl border shadow-2xs ${avail.isUnavailable ? 'border-rose-300 bg-rose-50/40' : 'border-[#E5E1D5]/80'}`}>
                    <img
                      src={toDisplayImageUrl(item.image, 180)}
                      alt={buildSeoImageAlt({
                        name: item.name,
                        context: [item.size, item.color].filter(Boolean).join(' ')
                      })}
                      width={64}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      onError={handleProxyImageError}
                      className={`w-16 h-20 object-cover rounded-xl bg-stone-100 border shrink-0 ${avail.isUnavailable ? 'border-rose-300 grayscale-[35%]' : 'border-[#E5E1D5]'}`}
                      referrerPolicy="no-referrer"
                    />

                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-xs font-bold text-[#14221C] leading-snug line-clamp-1">
                            {item.name}
                          </h4>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-[#202522]/40 hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {avail.isUnavailable && (
                          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{avail.reason}</span>
                          </div>
                        )}

                        <div className="text-[11px] text-[#202522]/70 mt-1 flex items-center gap-2">
                          <span>সাইজ: <strong className="text-[#14221C]">{item.size}</strong></span>
                          <span>·</span>
                          <span>কালার: <strong className="text-[#14221C]">{item.color}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100">
                        {/* Quantity Stepper */}
                        <div className="flex items-center border border-[#E5E1D5] bg-[#F7F5EF] rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="px-2 py-0.5 text-xs text-[#202522]/70 hover:bg-stone-200 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2.5 py-0.5 text-xs font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            disabled={avail.isUnavailable || item.quantity >= avail.availableStock}
                            className="px-2 py-0.5 text-xs text-[#202522]/70 hover:bg-stone-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <div className="text-xs font-extrabold text-[#14221C] tabular-nums">
                            ৳{(item.price * item.quantity).toLocaleString()}
                          </div>
                          {item.regularPrice > item.price && (
                            <div className="text-[10px] text-stone-400 line-through tabular-nums">
                              ৳{(item.regularPrice * item.quantity).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* DIRECT ORDER FROM CART (No separate checkout needed) */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#14221C]">
                    ডেলিভারি ঠিকানা দিন (সরাসরি অর্ডার)
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    ক্যাশ অন ডেলিভারি
                  </span>
                </div>

                <form onSubmit={handleDirectCartOrder} onFocus={triggerDrawerInitiateCheckout} className="space-y-2.5 text-xs">
                  {/* Saved Address Selector */}
                  {savedAddresses.length > 0 && (
                    <div className="p-2.5 bg-white rounded-xl border border-[#E5E1D5] space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[#14221C] flex items-center gap-1">
                          <BookmarkCheck className="w-3.5 h-3.5 text-[#FF762E]" />
                          <span>সংরক্ষিত ঠিকানা ({savedAddresses.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleStartAddNewAddress}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors cursor-pointer ${
                            isAddingNewAddress
                              ? 'bg-[#14221C] text-white'
                              : 'bg-[#F7F5EF] text-[#14221C] hover:bg-stone-200'
                          }`}
                        >
                          + নতুন ঠিকানা
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {savedAddresses.map((addr, idx) => {
                          const isSelected = selectedAddressIndex === idx && !isAddingNewAddress;
                          return (
                            <div
                              key={idx}
                              onClick={() => handleSelectSavedAddress(idx)}
                              className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#F7F5EF] border-[#14221C] ring-1 ring-[#14221C]'
                                  : 'bg-white border-[#E5E1D5] hover:bg-stone-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-[#14221C]">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span
                                    className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                                      isSelected ? 'border-[#14221C] bg-[#14221C]' : 'border-stone-400'
                                    }`}
                                  >
                                    {isSelected && <Check className="w-2 h-2 text-white" />}
                                  </span>
                                  <span className="truncate">{addr.fullName}</span>
                                </div>
                                <span className="font-mono text-[10px] text-[#202522]/60 shrink-0">
                                  {addr.phone}
                                </span>
                              </div>
                              <p className="text-[10px] text-[#202522]/70 mt-0.5 pl-4 line-clamp-1">
                                {addr.streetAddress}, {addr.district}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 1. নাম (Full Name) - Mandatory */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                      ১. আপনার নাম <span className="text-rose-600 font-black">* (আবশ্যক)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="আপনার সম্পূর্ণ নাম লিখুন *"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C] text-[#14221C] placeholder:text-stone-400 font-medium"
                        required
                      />
                      <UserIcon className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* 2. মোবাইল নাম্বার (Phone) - Mandatory */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                      ২. মোবাইল নাম্বার <span className="text-rose-600 font-black">* (আবশ্যক)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        placeholder="১১ ডিজিটের সচল মোবাইল নাম্বার (যেমন: 017XXXXXXXX) *"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C] text-[#14221C] placeholder:text-stone-400 font-mono font-medium"
                        required
                      />
                      <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* 3. জেলা (District) & 4. উপজেলা / থানা (Upazila) - Mandatory */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                        ৩. জেলা <span className="text-rose-600 font-black">* (আবশ্যক)</span>
                      </label>
                      <select
                        value={district}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C] font-semibold text-[#14221C]"
                        required
                      >
                        <option value="" disabled>জেলা নির্বাচন করুন</option>
                        {allDistricts.map((d) => (
                          <option key={d.name} value={d.name}>
                            {d.name} {d.name.toLowerCase() === 'dhaka' ? '(সিটি ফ্রি · সাব-এরিয়া ৳৫০)' : '(৳৫০)'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                        ৪. উপজেলা / থানা <span className="text-rose-600 font-black">* (আবশ্যক)</span>
                      </label>
                      {availableUpazilas.length > 0 ? (
                        <select
                          value={upazila}
                          onChange={(e) => {
                            setUpazila(e.target.value);
                            if (e.target.value !== 'other') setCustomUpazila('');
                          }}
                          className="w-full px-2.5 py-2 text-xs bg-white border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C] font-semibold text-[#14221C]"
                          required
                        >
                          <option value="" disabled>উপজেলা বাছুন</option>
                          {availableUpazilas.map((u) => (
                            <option key={u} value={u}>
                              {u}
                              {isDhaka ? (isDhakaSubArea(u) ? ' (সাব-এরিয়া - ৳৫০)' : ' (ফ্রি)') : ''}
                            </option>
                          ))}
                          <option value="other">অন্যান্য / লিখুন...</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="উপজেলা বা থানা লিখুন *"
                          value={upazila}
                          onChange={(e) => setUpazila(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs bg-white border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C] text-[#14221C] font-medium"
                          required
                        />
                      )}
                    </div>
                  </div>

                  {upazila === 'other' && (
                    <div>
                      <input
                        type="text"
                        placeholder="আপনার নির্দিষ্ট উপজেলা বা থানার নাম লিখুন *"
                        value={customUpazila}
                        onChange={(e) => setCustomUpazila(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-[#FF762E] rounded-xl focus:outline-none focus:border-[#14221C] text-[#14221C] font-medium"
                        required
                        autoFocus
                      />
                    </div>
                  )}

                  {/* 5. ঠিকানা (Address) - Mandatory */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                      ৫. বিস্তারিত ডেলিভারি ঠিকানা <span className="text-rose-600 font-black">* (আবশ্যক)</span>
                    </label>
                    <div className="relative">
                      <textarea
                        rows={2}
                        placeholder="বাসা/ফ্ল্যাট নং, রোড নং, এলাকা/গ্রাম বা ল্যান্ডমার্ক *"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C] text-[#14221C] placeholder:text-stone-400 font-medium"
                        required
                      />
                      <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {formError && (
                    <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3" /> {formError}
                    </p>
                  )}

                  {/* Price Summary inside Cart */}
                  <div className="p-3 bg-white rounded-xl border border-[#E5E1D5] space-y-1 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>পণ্যের মোট মূল্য:</span>
                      <span className="font-semibold text-[#14221C] tabular-nums">৳{cartSubtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>
                        ডেলিভারি চার্জ (
                        {deliveryZone === 'inside_dhaka'
                          ? 'ঢাকা সিটি'
                          : deliveryZone === 'dhaka_sub_area'
                          ? 'ঢাকা সাব-এরিয়া'
                          : `${district} জেলা`}
                        ):
                      </span>
                      <span
                        className={`font-semibold tabular-nums ${
                          deliveryFee === 0 ? 'text-emerald-700 font-bold' : 'text-[#14221C]'
                        }`}
                      >
                        {deliveryFee === 0 ? 'ফ্রি (৳০)' : `+৳${deliveryFee}`}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-stone-200 flex justify-between font-bold text-sm text-[#14221C]">
                      <span>সর্বমোট প্রদেয় বিল:</span>
                      <span className="text-[#FF762E] text-base tabular-nums">৳{grandTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  {hasUnavailableItems && (
                    <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-[11px] text-rose-800 font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Out of Stock পণ্য রয়েছে — অর্ডার করতে উপরের ডিলিট আইকনে ক্লিক করে সরান।</span>
                    </div>
                  )}

                  {/* Direct 1-Click Order Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || hasUnavailableItems}
                    className="w-full py-3.5 px-4 bg-[#FF762E] hover:bg-[#e8631c] disabled:bg-stone-400 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Lock className="w-4 h-4 fill-white" />
                    <span>
                      {hasUnavailableItems
                        ? 'Out of Stock পণ্য সরিয়ে অর্ডার করুন'
                        : isSubmitting
                        ? 'অর্ডার নেওয়া হচ্ছে...'
                        : `সরাসরি অর্ডার নিশ্চিত করুন — ৳${grandTotal.toLocaleString()}`}
                    </span>
                  </button>
                  <p className="text-center text-[10px] text-stone-500">
                    ✓ কোনো আলাদা চেকআউটের ঝামেলা নেই, পার্সেল হাতে পেয়ে মূল্য পরিশোধ করুন
                  </p>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
