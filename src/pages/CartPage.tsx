import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { BANGLADESH_DIVISIONS, isDhakaSubArea, resolveDeliveryZone } from '../data/bangladeshData';
import { Address } from '../types';
import { getSavedAddresses, saveAddressLocally } from '../utils/addressStorage';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  Truck,
  ShieldCheck,
  Check,
  User as UserIcon,
  Phone,
  MapPin,
  Building,
  CheckCircle2,
  AlertCircle,
  BookmarkCheck
} from 'lucide-react';

export const CartPage: React.FC = () => {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartSubtotal,
    calculateDeliveryFee,
    placeOrder,
    setCurrentPage,
    currentUser,
    addUserAddress,
    showToast
  } = useStore();

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);

  // Mandatory Direct Customer Fields
  const [fullName, setFullName] = useState(
    currentUser?.name && currentUser.name !== 'VANTREL Member' ? currentUser.name : ''
  );
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [district, setDistrict] = useState('Dhaka');
  const [upazila, setUpazila] = useState('Dhanmondi');
  const [streetAddress, setStreetAddress] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Flat list of all 64 districts with their upazilas
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

  const currentDistrictObj = allDistricts.find(
    (d) => d.name.toLowerCase() === district.toLowerCase()
  );
  const availableUpazilas = currentDistrictObj ? currentDistrictObj.upazilas : [];

  // Load saved addresses (from user profile & localStorage)
  useEffect(() => {
    const list = getSavedAddresses(currentUser);
    setSavedAddresses(list);
    if (list.length > 0 && selectedAddressIndex === null && !isAddingNewAddress) {
      setSelectedAddressIndex(0);
      const primary = list[0];
      setFullName(primary.fullName || (currentUser?.name && currentUser.name !== 'VANTREL Member' ? currentUser.name : ''));
      setPhone(primary.phone || currentUser?.phone || '');
      if (primary.district) setDistrict(primary.district);
      if (primary.upazila) setUpazila(primary.upazila);
      if (primary.streetAddress) setStreetAddress(primary.streetAddress);
    } else if (currentUser) {
      if (currentUser.name && currentUser.name !== 'VANTREL Member') setFullName(currentUser.name);
      if (currentUser.phone) setPhone(currentUser.phone);
    }
  }, [currentUser]);

  const handleSelectSavedAddress = (index: number) => {
    setSelectedAddressIndex(index);
    setIsAddingNewAddress(false);
    const addr = savedAddresses[index];
    if (addr) {
      setFullName(addr.fullName);
      setPhone(addr.phone);
      if (addr.district) setDistrict(addr.district);
      if (addr.upazila) setUpazila(addr.upazila);
      if (addr.streetAddress) setStreetAddress(addr.streetAddress);
    }
  };

  const handleStartAddNewAddress = () => {
    setSelectedAddressIndex(null);
    setIsAddingNewAddress(true);
    setStreetAddress('');
  };

  const handleDistrictChange = (newDistName: string) => {
    setDistrict(newDistName);
    const found = allDistricts.find((d) => d.name === newDistName);
    if (found && found.upazilas.length > 0) {
      setUpazila(found.upazilas[0]);
    }
  };

  // Determine delivery zone automatically
  const isDhakaDistrict = district.trim().toLowerCase() === 'dhaka';
  const deliveryZone = resolveDeliveryZone(district, upazila);
  const deliveryFee = calculateDeliveryFee(deliveryZone, cartSubtotal);
  const grandTotal = cartSubtotal + deliveryFee;

  // Direct Order Submission (Zero checkout hassle)
  const handleDirectOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      newErrors.fullName = 'আপনার সম্পূর্ণ নাম লিখুন (নাম আবশ্যক)';
    }

    const cleanPhone = phone.replace(/[\s-+]/g, '');
    const bdPhoneRegex = /^(?:\+?880|880|0)?1[3-9]\d{8}$/;
    if (!cleanPhone) {
      newErrors.phone = 'সঠিক মোবাইল নাম্বার দিন';
    } else if (!bdPhoneRegex.test(cleanPhone)) {
      newErrors.phone = 'আপনার সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন (যেমন: 017XXXXXXXX)';
    }

    if (!district.trim()) {
      newErrors.district = 'জেলা নির্বাচন করা আবশ্যক';
    }

    if (!upazila.trim()) {
      newErrors.upazila = 'উপজেলা বা থানা নির্বাচন করা আবশ্যক';
    }

    if (!streetAddress.trim() || streetAddress.trim().length < 5) {
      newErrors.streetAddress = 'আপনার ডেলিভারির সম্পূর্ণ ঠিকানা লিখুন (রোড, বাড়ি নং, এলাকা)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast('তথ্য অসম্পূর্ণ', 'অনুগ্রহ করে লাল চিহ্নিত ৫টি আবশ্যক তথ্য পূরণ করুন।', 'error');
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const customerAddress: Address = {
      fullName: fullName.trim(),
      phone: cleanPhone,
      division: currentDistrictObj ? currentDistrictObj.division : (isDhakaDistrict ? 'Dhaka' : 'Outside Dhaka'),
      district: district,
      upazila: upazila || 'সদর',
      streetAddress: streetAddress.trim()
    };

    setTimeout(() => {
      const result = placeOrder({
        customer: customerAddress,
        deliveryZone,
        paymentMethod: 'Cash on Delivery (COD)'
      });

      setIsSubmitting(false);

      if (result.success && result.order) {
        // Automatically save address for 1-click re-use in future orders
        saveAddressLocally(customerAddress);
        if (addUserAddress) {
          addUserAddress(customerAddress);
        }

        showToast(
          'অর্ডার সফল হয়েছে!',
          `অর্ডার #${result.order.orderNumber} সফলভাবে গ্রহণ করা হয়েছে।`,
          'success'
        );
        window.scrollTo({ top: 0, behavior: 'instant' });
        setCurrentPage('confirmation');
      } else {
        setErrors({ submit: result.error || 'অর্ডার সম্পন্ন করা যায়নি।' });
      }
    }, 600);
  };

  if (cart.length === 0) {
    return (
      <div className="bg-[#F7F5EF] min-h-[70vh] flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl border border-[#E5E1D5] text-center space-y-6 shadow-xs">
          <div className="w-20 h-20 mx-auto rounded-full bg-[#F7F5EF] flex items-center justify-center text-[#14221C]">
            <ShoppingBag className="w-10 h-10 opacity-30" />
          </div>
          <div className="space-y-2">
            <h2 className="font-heading text-2xl font-bold text-[#14221C]">
              আপনার কার্ট বর্তমানে খালি
            </h2>
            <p className="text-xs text-[#202522]/60 leading-relaxed">
              আপনার কার্টে এখনো কোনো পোশাক যুক্ত করা হয়নি। আমাদের প্রিমিয়াম ক্লাসিক শার্ট ও হেভিওয়েট হুডি কালেকশন দেখুন।
            </p>
          </div>
          <button
            onClick={() => setCurrentPage('shop')}
            className="w-full py-3.5 px-6 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>পোশাক কালেকশন দেখুন</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const totalGarments = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="bg-[#F7F5EF] min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E1D5]">
          <div>
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-6 h-6 text-[#14221C]" />
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#14221C] uppercase tracking-tight">
                আপনার কার্ট ({totalGarments} টি পোশাক)
              </h1>
            </div>
            <p className="text-xs text-[#202522]/70 mt-1">
              সবগুলো নির্বাচিত পোশাক চেক করুন এবং নিচে ঠিকানা দিয়ে সরাসরি ক্যাশ অন ডেলিভারিতে অর্ডার করুন।
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage('shop')}
              className="text-xs font-bold uppercase tracking-wider text-[#14221C] hover:text-[#FF762E] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>আরো পোশাক দেখুন</span>
            </button>
            <button
              onClick={clearCart}
              className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
            >
              সব খালি করুন
            </button>
          </div>
        </div>

        {/* Dynamic Delivery Banner */}
        <div className="p-4 bg-white rounded-2xl border border-[#E5E1D5] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-[#FF762E] shrink-0" />
            <div className="text-xs text-[#202522]">
              <span className="font-medium">
                ডেলিভারি চার্জ: <strong className="text-[#14221C]">ঢাকার ভিতরে ৳১০০</strong> | <strong className="text-[#14221C]">ঢাকার বাইরে ৳১৫০</strong> · পণ্য হাতে পেয়ে মূল্য পরিশোধ (Cash on Delivery)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-700 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>সরাসরি দ্রুত ডেলিভারি</span>
          </div>
        </div>

        {/* 2-Column Layout: Products on Left, Direct Order Form on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: All Products in Cart */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-3xl border border-[#E5E1D5] p-5 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E1D5]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#14221C]">
                  নির্বাচিত পোশাকসমূহ ({totalGarments})
                </span>
                <span className="text-xs text-[#202522]/60">
                  সাবটোটাল: <strong className="text-[#14221C]">৳{cartSubtotal.toLocaleString()}</strong>
                </span>
              </div>

              <div className="divide-y divide-[#E5E1D5]">
                {cart.map((item) => (
                  <div key={item.id} className="py-5 first:pt-4 last:pb-0 flex flex-col sm:flex-row items-start gap-4">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xl bg-stone-100 border border-[#E5E1D5] shrink-0"
                      referrerPolicy="no-referrer"
                    />

                    <div className="flex-1 flex flex-col justify-between w-full h-full min-h-[90px]">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-heading text-sm sm:text-base font-bold text-[#14221C] leading-snug">
                            {item.name}
                          </h3>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-[#202522]/40 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#202522]/70 mt-1">
                          <span className="bg-[#F7F5EF] px-2 py-0.5 rounded border border-[#E5E1D5]">
                            সাইজ: <strong className="text-[#14221C]">{item.size}</strong>
                          </span>
                          <span className="bg-[#F7F5EF] px-2 py-0.5 rounded border border-[#E5E1D5]">
                            কালার: <strong className="text-[#14221C]">{item.color}</strong>
                          </span>
                          <span className="font-mono text-[11px] text-[#202522]/40">
                            SKU: {item.sku}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
                        {/* Quantity stepper */}
                        <div className="flex items-center border border-[#E5E1D5] bg-[#F7F5EF] rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="px-2.5 py-1 text-sm font-bold text-[#202522] hover:bg-stone-200 cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 py-0.5 text-xs font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="px-2.5 py-1 text-sm font-bold text-[#202522] hover:bg-stone-200 cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Price Breakdown */}
                        <div className="text-right">
                          <div className="text-sm sm:text-base font-bold text-[#14221C] tabular-nums">
                            ৳{(item.price * item.quantity).toLocaleString()}
                          </div>
                          {item.regularPrice > item.price && (
                            <div className="text-[11px] text-[#202522]/40 line-through tabular-nums">
                              ৳{(item.regularPrice * item.quantity).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality & Return Guarantee */}
            <div className="p-4 bg-white rounded-2xl border border-[#E5E1D5] flex items-center justify-between gap-4 text-xs text-[#202522]/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>১০০% প্রিমিয়াম ফেব্রিক ও আনবক্সিং সন্তুষ্টি গ্যারান্টি</span>
              </div>
              <span className="font-medium text-[#14221C]">৭ দিনের সহজ এক্সচেঞ্জ</span>
            </div>
          </div>

          {/* Right Column: Direct Delivery Info & Order Confirmation Form */}
          <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-[#14221C] p-6 sm:p-8 shadow-md sticky top-24 space-y-6">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D5]">
                <h2 className="font-heading text-lg font-bold uppercase tracking-wider text-[#14221C]">
                  সরাসরি অর্ডার করুন
                </h2>
                <span className="bg-[#14221C] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                  ক্যাশ অন ডেলিভারি
                </span>
              </div>
              <p className="text-xs text-[#202522]/60 mt-2">
                কোনো জটিল চেকআউট নেই। শুধু নাম ও ঠিকানা লিখুন, পার্সেল পৌঁছালে টাকা দিন।
              </p>
            </div>

            {errors.submit && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors.submit}</span>
              </div>
            )}

            <form onSubmit={handleDirectOrder} className="space-y-4">
              {/* Saved Address Quick Selector */}
              {savedAddresses.length > 0 && (
                <div className="p-3.5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#14221C] flex items-center gap-1.5">
                      <BookmarkCheck className="w-4 h-4 text-[#FF762E]" />
                      <span>সংরক্ষিত ঠিকানা ({savedAddresses.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleStartAddNewAddress}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        isAddingNewAddress
                          ? 'bg-[#14221C] text-white'
                          : 'bg-white border border-[#E5E1D5] text-[#14221C] hover:bg-stone-100'
                      }`}
                    >
                      + নতুন ঠিকানা লিখুন
                    </button>
                  </div>

                  <div className="space-y-2">
                    {savedAddresses.map((addr, idx) => {
                      const isSelected = selectedAddressIndex === idx && !isAddingNewAddress;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelectSavedAddress(idx)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left text-xs ${
                            isSelected
                              ? 'bg-white border-[#14221C] shadow-xs ring-1 ring-[#14221C]'
                              : 'bg-white/70 border-[#E5E1D5] hover:bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-[#14221C] flex items-center gap-1.5">
                              <span
                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-[#14221C] bg-[#14221C]' : 'border-stone-400'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                              <span>{addr.fullName}</span>
                              <span className="text-[11px] font-mono text-[#202522]/60 font-normal">
                                ({addr.phone})
                              </span>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                সিলেক্টেড
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#202522]/80 mt-1 pl-5 line-clamp-1">
                            {addr.streetAddress}, {addr.upazila}, {addr.district}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ১. নাম (Name) */}
              <div>
                <label className="block text-xs font-bold text-[#14221C] mb-1">
                  আপনার নাম <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#202522]/40" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                    }}
                    placeholder="আপনার সম্পূর্ণ নাম লিখুন"
                    className={`w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F5EF] border rounded-xl focus:outline-none focus:border-[#14221C] transition-colors ${
                      errors.fullName ? 'border-rose-500 bg-rose-50/30' : 'border-[#E5E1D5]'
                    }`}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-[11px] text-rose-600 mt-1">{errors.fullName}</p>
                )}
              </div>

              {/* ২. মোবাইল নাম্বার (Phone) */}
              <div>
                <label className="block text-xs font-bold text-[#14221C] mb-1">
                  মোবাইল নাম্বার <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#202522]/40" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    placeholder="আপনার ১১ ডিজিটের মোবাইল নাম্বার লিখুন"
                    className={`w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F5EF] border rounded-xl focus:outline-none focus:border-[#14221C] transition-colors ${
                      errors.phone ? 'border-rose-500 bg-rose-50/30' : 'border-[#E5E1D5]'
                    }`}
                  />
                </div>
                {errors.phone && (
                  <p className="text-[11px] text-rose-600 mt-1">{errors.phone}</p>
                )}
              </div>

              {/* ৩. জেলা ও উপজেলা (District & Upazila) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    জেলা <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#202522]/40 pointer-events-none" />
                    <select
                      value={district}
                      onChange={(e) => handleDistrictChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C] cursor-pointer"
                    >
                      {allDistricts.map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.name} {d.name.toLowerCase() === 'dhaka' ? '(ঢাকা সিটি ফ্রি · সাব-এরিয়া ৳৫০)' : '(৬৩ জেলা - ৳৫০)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    উপজেলা / থানা <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#202522]/40 pointer-events-none" />
                    <select
                      value={upazila}
                      onChange={(e) => {
                        setUpazila(e.target.value);
                        if (errors.upazila) setErrors((prev) => ({ ...prev, upazila: '' }));
                      }}
                      className={`w-full pl-9 pr-3 py-2.5 text-xs bg-[#F7F5EF] border rounded-xl focus:outline-none focus:border-[#14221C] cursor-pointer ${
                        errors.upazila ? 'border-rose-500 bg-rose-50/30' : 'border-[#E5E1D5]'
                      }`}
                    >
                      {availableUpazilas.length > 0 ? (
                        availableUpazilas.map((u) => (
                          <option key={u} value={u}>
                            {u}
                            {isDhakaDistrict ? (isDhakaSubArea(u) ? ' (সাব-এরিয়া - ৳৫০)' : ' (ফ্রি)') : ''}
                          </option>
                        ))
                      ) : (
                        <option value="সদর">সদর / প্রধান থানা</option>
                      )}
                    </select>
                  </div>
                  {errors.upazila && (
                    <p className="text-[11px] text-rose-600 mt-1">{errors.upazila}</p>
                  )}
                </div>
              </div>

              {/* ৪. বিস্তারিত ঠিকানা (Full Address) */}
              <div>
                <label className="block text-xs font-bold text-[#14221C] mb-1">
                  বিস্তারিত ডেলিভারি ঠিকানা <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={streetAddress}
                  onChange={(e) => {
                    setStreetAddress(e.target.value);
                    if (errors.streetAddress) setErrors((prev) => ({ ...prev, streetAddress: '' }));
                  }}
                  placeholder="বাড়ি নং, রোড নং, এলাকা বা চেনার মতো কোনো স্থান"
                  className={`w-full px-3 py-2.5 text-xs bg-[#F7F5EF] border rounded-xl focus:outline-none focus:border-[#14221C] transition-colors resize-none ${
                    errors.streetAddress ? 'border-rose-500 bg-rose-50/30' : 'border-[#E5E1D5]'
                  }`}
                />
                {errors.streetAddress && (
                  <p className="text-[11px] text-rose-600 mt-1">{errors.streetAddress}</p>
                )}
              </div>

              {/* Order Calculations */}
              <div className="p-4 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-2.5 text-xs">
                <div className="flex justify-between text-[#202522]/80">
                  <span>পোশাকের মূল্য ({totalGarments} টি):</span>
                  <span className="font-semibold text-[#14221C] tabular-nums">
                    ৳{cartSubtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[#202522]/80">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      ডেলিভারি চার্জ (
                      {deliveryZone === 'inside_dhaka'
                        ? 'ঢাকা সিটি'
                        : deliveryZone === 'dhaka_sub_area'
                        ? 'ঢাকা সাব-এরিয়া'
                        : `${district} জেলা`}
                      ):
                    </span>
                  </span>
                  <span
                    className={`font-bold tabular-nums ${
                      deliveryFee === 0 ? 'text-emerald-700' : 'text-[#14221C]'
                    }`}
                  >
                    {deliveryFee === 0 ? 'ফ্রি (৳০)' : `৳${deliveryFee}`}
                  </span>
                </div>
                <div className="pt-2.5 border-t border-[#E5E1D5] flex justify-between items-baseline">
                  <span className="text-sm font-extrabold text-[#14221C]">সর্বমোট প্রদেয়:</span>
                  <span className="text-2xl font-black text-[#14221C] tabular-nums">
                    ৳{grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Direct Order Confirmation CTA Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-[#FF762E] hover:bg-[#e8631c] text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>অর্ডার প্রসেস হচ্ছে...</span>
                ) : (
                  <>
                    <span>সরাসরি অর্ডার নিশ্চিত করুন (ক্যাশ অন ডেলিভারি)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-[#202522]/60 pt-1 text-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>পার্সেল হাতে পেয়ে চেক করে সম্পূর্ণ ক্যাশ অন ডেলিভারিতে টাকা পরিশোধ করুন</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
