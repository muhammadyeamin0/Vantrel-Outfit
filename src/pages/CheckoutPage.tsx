import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { BANGLADESH_DIVISIONS } from '../data/bangladeshData';
import { PaymentMethod, Address, User } from '../types';
import { getSavedAddresses, saveAddressLocally, removeAddressLocally } from '../utils/addressStorage';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  CreditCard,
  Lock,
  ArrowRight,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Building,
  Navigation,
  FileText,
  BadgeCheck,
  ShoppingBag,
  Clock,
  Check,
  BookmarkCheck,
  AlertTriangle,
  Plus,
  Minus,
  Trash2
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    cartSubtotal,
    removeFromCart,
    updateCartQuantity,
    settings,
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

  // If cart is empty, redirect to shop
  useEffect(() => {
    if (cart.length === 0) {
      setCurrentPage('shop');
    }
  }, [cart, setCurrentPage]);

  // Mandatory Customer Information (Only 5 essential fields)
  const [fullName, setFullName] = useState(currentUser?.name && currentUser.name !== 'VANTREL Member' ? currentUser.name : '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [email, setEmail] = useState(currentUser?.email && !currentUser.email.includes('@vantrel.com') ? currentUser.email : '');

  // Cascading Bangladesh District & Upazila
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('Dhaka');
  const [upazila, setUpazila] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Delivery zone: Auto-calculated based on selected district
  // Inside Dhaka = ৳70, Outside Dhaka = ৳120
  const isDhakaDistrict = useMemo(() => {
    return district.trim().toLowerCase() === 'dhaka';
  }, [district]);

  const deliveryZone = isDhakaDistrict ? 'inside_dhaka' : 'outside_dhaka';

  // Payment method: Cash on Delivery default
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash on Delivery (COD)');
  const [transactionId, setTransactionId] = useState('');

  // Check if bKash merchant is active or pending
  const isBkashOnline = Boolean(settings.isBkashActive);

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const currentDistrictObj = allDistricts.find((d) => d.name.toLowerCase() === district.toLowerCase());
  const availableUpazilas = currentDistrictObj ? currentDistrictObj.upazilas : [];

  // Auto-fill and track saved addresses
  useEffect(() => {
    const list = getSavedAddresses(currentUser);
    setSavedAddresses(list);
    if (list.length > 0) {
      if (selectedAddressIndex === null && !isAddingNewAddress) {
        setSelectedAddressIndex(0);
        const primary = list[0];
        setFullName(primary.fullName || '');
        setPhone(primary.phone || '');
        if (primary.division) setDivision(primary.division);
        if (primary.district) setDistrict(primary.district);
        if (primary.upazila) setUpazila(primary.upazila);
        if (primary.streetAddress) setStreetAddress(primary.streetAddress);
      }
    } else {
      setIsAddingNewAddress(true);
      setSelectedAddressIndex(null);
    }
  }, [currentUser]);

  const handleSelectSavedAddress = (index: number) => {
    setSelectedAddressIndex(index);
    setIsAddingNewAddress(false);
    const addr = savedAddresses[index];
    if (addr) {
      setFullName(addr.fullName);
      setPhone(addr.phone);
      if (addr.division) setDivision(addr.division);
      if (addr.district) setDistrict(addr.district);
      if (addr.upazila) setUpazila(addr.upazila);
      if (addr.streetAddress) setStreetAddress(addr.streetAddress);
    }
  };

  const handleStartAddNewAddress = () => {
    setSelectedAddressIndex(null);
    setIsAddingNewAddress(true);
    setFullName('');
    setPhone('');
    setStreetAddress('');
    setUpazila('');
    setNotes('');
  };

  // Explicitly save the newly entered address to saved list
  const handleSaveNewAddress = () => {
    const newErrors: { [key: string]: string } = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      newErrors.fullName = 'আপনার সম্পূর্ণ নাম লিখুন';
    }
    if (!phone.trim()) {
      newErrors.phone = 'আপনার মোবাইল নাম্বার দিন';
    } else if (!validateBdPhone(phone)) {
      newErrors.phone = 'সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন';
    }
    if (!district.trim()) {
      newErrors.district = 'জেলা নির্বাচন করুন';
    }
    if (!upazila.trim()) {
      newErrors.upazila = 'উপজেলা বা থানা লিখুন';
    }
    if (!streetAddress.trim() || streetAddress.trim().length < 5) {
      newErrors.streetAddress = 'আপনার বিস্তারিত ডেলিভারি ঠিকানা লিখুন';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast('তথ্য অসম্পূর্ণ', 'অনুগ্রহ করে লাল চিহ্নিত তথ্যগুলো পূরণ করুন।', 'error');
      return;
    }

    setErrors({});

    const newAddr: Address = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      division,
      district,
      upazila: upazila.trim() || district,
      streetAddress: streetAddress.trim(),
      notes: notes.trim() || undefined
    };

    const updatedList = saveAddressLocally(newAddr);
    setSavedAddresses(updatedList);
    setSelectedAddressIndex(0);
    setIsAddingNewAddress(false);
    showToast('নতুন ঠিকানা সংরক্ষিত!', 'ঠিকানাটি সফলভাবে সংরক্ষণ করা হয়েছে এবং সিলেক্ট হয়েছে।', 'success');
  };

  // Delete an address from local storage
  const handleDeleteAddress = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = savedAddresses[index];
    if (!target) return;
    const updated = removeAddressLocally(target);
    setSavedAddresses(updated);
    if (selectedAddressIndex === index) {
      if (updated.length > 0) {
        handleSelectSavedAddress(0);
      } else {
        handleStartAddNewAddress();
      }
    } else if (selectedAddressIndex !== null && selectedAddressIndex > index) {
      setSelectedAddressIndex(selectedAddressIndex - 1);
    }
    showToast('ঠিকানা সরানো হয়েছে', 'সংরক্ষিত ঠিকানা মুছে ফেলা হয়েছে।', 'info');
  };

  const handleDistrictChange = (newDistName: string) => {
    setDistrict(newDistName);
    const found = allDistricts.find((d) => d.name === newDistName);
    if (found) {
      setDivision(found.division);
      setUpazila(found.upazilas[0] || '');
    }
  };

  // BD Phone validation: 11 digits starting with 01
  const validateBdPhone = (num: string) => {
    const clean = num.replace(/[\s-+]/g, '');
    const regex = /^(?:\+?880|880|0)?1[3-9]\d{8}$/;
    return regex.test(clean);
  };

  // Calculate live delivery fee: ৳100 inside Dhaka, ৳150 outside Dhaka
  const deliveryFee = calculateDeliveryFee(deliveryZone, cartSubtotal);
  const finalTotal = cartSubtotal + deliveryFee;

  // Live Validation checks for strict order fulfillment (All 5 fields mandatory)
  const isNameValid = fullName.trim().length >= 2;
  const isPhoneValid = Boolean(phone.trim()) && validateBdPhone(phone);
  const isDistrictValid = Boolean(district.trim());
  const isUpazilaValid = Boolean(upazila.trim());
  const isAddressValid = Boolean(streetAddress.trim()) && streetAddress.trim().length >= 5;

  const getValidationFeedback = () => {
    if (!isNameValid) return 'নাম প্রদান করা আবশ্যক! (অসম্পূর্ণ অর্ডার)';
    if (!phone.trim()) return 'মোবাইল নাম্বার প্রদান করুন';
    if (!validateBdPhone(phone)) return 'সঠিক ১১ ডিজিট মোবাইল নাম্বার দিন';
    if (!isDistrictValid) return 'ডেলিভারি জেলা নির্বাচন করুন';
    if (!isUpazilaValid) return 'উপজেলা বা থানা নির্বাচন বা লিখুন';
    if (!isAddressValid) return 'আশেপাশের বিস্তারিত ঠিকানা লিখুন';
    return null;
  };

  const currentValidationError = getValidationFeedback();

  // Form submit handler with direct order placement
  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    // 1. নাম (Full Name) - Mandatory
    if (!fullName.trim() || fullName.trim().length < 2) {
      newErrors.fullName = 'আপনার সম্পূর্ণ নাম প্রদান করা আবশ্যক (নাম ছাড়া অর্ডার অপূর্ণ)';
    }

    // 2. নাম্বার (Mobile Number) - Mandatory
    if (!phone.trim()) {
      newErrors.phone = 'আপনার মোবাইল নাম্বার দিন';
    } else if (!validateBdPhone(phone)) {
      newErrors.phone = 'সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন (যেমন: 017XXXXXXXX)';
    }

    // 3. জেলা (District) - Mandatory
    if (!district.trim()) {
      newErrors.district = 'জেলা নির্বাচন করুন';
    }

    // 4. উপজেলা (Upazila) - Mandatory
    if (!upazila.trim()) {
      newErrors.upazila = 'উপজেলা বা থানা লিখুন';
    }

    // 5. আশেপাশের বিস্তারিত ঠিকানা - Mandatory
    if (!streetAddress.trim() || streetAddress.trim().length < 5) {
      newErrors.streetAddress = 'আপনার আশেপাশের বিস্তারিত ঠিকানা (বাড়ি/রোড নং, এলাকা) লিখুন';
    }

    // Payment validation if bKash is active & selected
    if (paymentMethod === 'bKash' && isBkashOnline) {
      if (!transactionId.trim() || transactionId.trim().length < 6) {
        newErrors.transactionId = 'বিকাশ TrxID প্রদান করুন';
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      showToast(
        'প্রয়োজনীয় তথ্য বাকি আছে',
        'অনুগ্রহ করে লাল চিহ্নিত তথ্যগুলো পূরণ করুন।',
        'error'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    const customerAddress: Address = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      division,
      district,
      upazila,
      streetAddress: streetAddress.trim(),
      notes: notes.trim() || undefined
    };

    // Auto-save address locally so customer has it ready for future orders
    saveAddressLocally(customerAddress);

    setTimeout(() => {
      const result = placeOrder({
        customer: customerAddress,
        deliveryZone,
        paymentMethod: paymentMethod === 'bKash' && !isBkashOnline ? 'Cash on Delivery (COD)' : paymentMethod,
        transactionId: transactionId.trim() || undefined
      });

      setIsSubmitting(false);

      if (result.success && result.order) {
        showToast(
          'অর্ডার সফল হয়েছে!',
          `অর্ডার #${result.order.orderNumber} সফলভাবে গ্রহণ করা হয়েছে।`,
          'success'
        );
        setCurrentPage('confirmation');
      } else {
        showToast('অর্ডারে ত্রুটি', result.error || 'অর্ডার সম্পন্ন করা যায়নি।', 'error');
      }
    }, 500);
  };

  return (
    <div className="bg-[#F7F5EF] min-h-screen py-6 sm:py-10 pb-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Streamlined Header */}
        <div className="text-center sm:text-left pb-2 border-b border-[#E5E1D5]">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF762E]">
            VANTREL DIRECT FAST ORDER
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#14221C] tracking-tight uppercase mt-0.5">
            অর্ডার নিশ্চিত করতে আপনার তথ্য দিন
          </h1>
          <p className="text-xs text-[#202522]/70 mt-1">
            সহজ ও ঝামেলামুক্ত দ্রুত চেকআউট। নিচের তথ্যগুলো দিলেই ক্যাশ অন ডেলিভারিতে আপনার অর্ডার সম্পন্ন হয়ে যাবে।
          </p>
        </div>

        {/* Combined Fast Checkout Form */}
        <form onSubmit={handleSubmitOrder} className="space-y-6">
          
          {/* Card 1: নাম, মোবাইল ও ডেলিভারি ঠিকানা */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#14221C] flex items-center gap-2 pb-2 border-b border-[#E5E1D5]">
              <span className="w-6 h-6 rounded-full bg-[#14221C] text-white flex items-center justify-center text-xs">
                ১
              </span>
              <span>আপনার নাম ও ডেলিভারি ঠিকানা</span>
            </h2>

            {/* Saved Address Quick Selector */}
            {savedAddresses.length > 0 && (
              <div className="p-4 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#14221C] flex items-center gap-1.5">
                    <BookmarkCheck className="w-4 h-4 text-[#FF762E]" />
                    <span>সংরক্ষিত ঠিকানা ({savedAddresses.length} টি)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleStartAddNewAddress}
                    className={`text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                      isAddingNewAddress
                        ? 'bg-[#14221C] text-white ring-2 ring-[#14221C]/30'
                        : 'bg-white border border-[#E5E1D5] text-[#14221C] hover:bg-stone-100 hover:border-[#14221C]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FF762E]" />
                    <span>+ নতুন ঠিকানা যোগ করুন</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {savedAddresses.map((addr, idx) => {
                    const isSelected = selectedAddressIndex === idx && !isAddingNewAddress;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleSelectSavedAddress(idx)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left text-xs relative group ${
                          isSelected
                            ? 'bg-white border-[#14221C] shadow-xs ring-2 ring-[#14221C]'
                            : 'bg-white/80 border-[#E5E1D5] hover:bg-white hover:border-stone-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-[#14221C] flex items-center gap-1.5">
                            <span
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-[#14221C] bg-[#14221C]' : 'border-stone-400'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                            </span>
                            <span className="truncate">{addr.fullName}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {isSelected && (
                              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                                নির্বাচিত
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteAddress(idx, e)}
                              className="p-1 text-stone-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                              title="ঠিকানা মুছুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1.5 pl-5 space-y-0.5 text-[11px] text-[#202522]/80">
                          <p className="font-mono text-[#202522]/70 font-semibold">{addr.phone}</p>
                          <p className="line-clamp-2">{addr.streetAddress}, {addr.upazila}, {addr.district}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Input Form Fields */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#14221C] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#FF762E]" />
                  <span>
                    {isAddingNewAddress
                      ? 'নতুন ঠিকানা পূরণ করুন'
                      : 'ডেলিভারি গ্রহীতার তথ্য (পরিবর্তন করতে পারেন)'}
                  </span>
                </span>
                {isAddingNewAddress && savedAddresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewAddress(false);
                      handleSelectSavedAddress(0);
                    }}
                    className="text-[11px] font-bold text-[#14221C] hover:underline"
                  >
                    আগের সংরক্ষিত ঠিকানায় ফিরুন ↵
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* ১. নাম (Full Name) */}
                <div>
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    আপনার সম্পূর্ণ নাম <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="আপনার সম্পূর্ণ নাম লিখুন"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border rounded-xl focus:outline-none ${
                      errors.fullName ? 'border-rose-500 bg-rose-50/50' : 'border-[#E5E1D5] focus:border-[#14221C]'
                    }`}
                  />
                  {errors.fullName && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.fullName}
                    </p>
                  )}
                </div>

                {/* ২. মোবাইল নাম্বার */}
                <div>
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    আপনার মোবাইল নাম্বার <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="tel"
                      placeholder="আপনার ১১ ডিজিটের মোবাইল নাম্বার লিখুন"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 text-xs bg-[#F7F5EF] border rounded-xl focus:outline-none ${
                        errors.phone ? 'border-rose-500 bg-rose-50/50' : 'border-[#E5E1D5] focus:border-[#14221C]'
                      }`}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.phone}
                    </p>
                  )}
                </div>

                {/* ৩. জেলা (District) */}
                <div>
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    আপনার জেলা নির্বাচন করুন <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className={`w-full px-3 py-2.5 text-xs bg-[#F7F5EF] border rounded-xl focus:outline-none font-semibold text-[#14221C] ${
                      errors.district ? 'border-rose-500 bg-rose-50/50' : 'border-[#E5E1D5] focus:border-[#14221C]'
                    }`}
                  >
                    {allDistricts.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name} {d.name.toLowerCase() === 'dhaka' ? '(ঢাকার ভিতরে - ৳৭০)' : '(ঢাকার বাইরে - ৳১২০)'}
                      </option>
                    ))}
                  </select>
                  {errors.district && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.district}</p>
                  )}
                </div>

                {/* ৪. উপজেলা / থানা (Upazila) */}
                <div>
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    উপজেলা / থানা <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="checkout-upazilas-list"
                    placeholder="উপজেলা বা থানার নাম লিখুন"
                    value={upazila}
                    onChange={(e) => setUpazila(e.target.value)}
                    className={`w-full px-3 py-2.5 text-xs bg-[#F7F5EF] border rounded-xl focus:outline-none ${
                      errors.upazila ? 'border-rose-500 bg-rose-50/50' : 'border-[#E5E1D5] focus:border-[#14221C]'
                    }`}
                  />
                  <datalist id="checkout-upazilas-list">
                    {availableUpazilas.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                  {errors.upazila && (
                    <p className="text-[11px] text-rose-500 mt-1">{errors.upazila}</p>
                  )}
                </div>

                {/* ৫. আশেপাশের বিস্তারিত ঠিকানা */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    আশেপাশের বিস্তারিত ঠিকানা (বাড়ি/ফ্ল্যাট নং, রোড, এলাকা) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="বাড়ি নং, রোড নং, এলাকা বিস্তারিত লিখুন"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    className={`w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border rounded-xl focus:outline-none ${
                      errors.streetAddress ? 'border-rose-500 bg-rose-50/50' : 'border-[#E5E1D5] focus:border-[#14221C]'
                    }`}
                  />
                  {errors.streetAddress && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.streetAddress}
                    </p>
                  )}
                </div>

                {/* ঐচ্ছিক নোট */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#14221C] mb-1">
                    বিশেষ ডেলিভারি নির্দেশনা <span className="text-stone-400 font-normal">(ঐচ্ছিক)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ডেলিভারির বিশেষ নির্দেশনা থাকলে লিখুন (ঐচ্ছিক)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                  />
                </div>

                {/* Save New Address Action Button */}
                <div className="sm:col-span-2 pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D5]">
                  <button
                    type="button"
                    onClick={handleSaveNewAddress}
                    className="px-4 py-2.5 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <BookmarkCheck className="w-4 h-4 text-[#FF762E]" />
                    <span>এই নতুন ঠিকানা সংরক্ষণ করুন</span>
                  </button>
                  <span className="text-[11px] text-stone-500">
                    * ঠিকানা সংরক্ষণ করলে পরবর্তীতে সহজেই সরাসরি ব্যবহার করতে পারবেন।
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: পণ্য ও ডেলিভারি চার্জ যোগ + পেমেন্ট ও বাই নাও */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#14221C] flex items-center gap-2 pb-2 border-b border-[#E5E1D5]">
              <span className="w-6 h-6 rounded-full bg-[#14221C] text-white flex items-center justify-center text-xs">
                ২
              </span>
              <span>অর্ডারের বিবরণ ও মোট মূল্য (ডেলিভারি চার্জসহ)</span>
            </h2>

            {/* Ordered Items Preview */}
            <div className="space-y-3 divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#202522]/60 space-y-2">
                  <ShoppingBag className="w-8 h-8 text-stone-400 mx-auto" />
                  <p>আপনার কার্টে কোনো প্রোডাক্ট নেই।</p>
                  <button
                    type="button"
                    onClick={() => setCurrentPage('shop')}
                    className="px-4 py-1.5 bg-[#14221C] text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-[#202522] transition-colors"
                  >
                    শপে প্রোডাক্ট দেখুন
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0 flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-14 h-16 object-cover rounded-lg bg-stone-100 border border-[#E5E1D5] shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5">
                        <h4 className="text-xs font-bold text-[#14221C] truncate leading-tight">
                          {item.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-stone-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
                          title="কার্ট থেকে ডিলিট করুন (Delete item)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-[11px] text-[#202522]/60 mt-0.5">
                        সাইজ: <strong className="text-[#14221C]">{item.size}</strong> · কালার: {item.color}
                      </p>

                      {/* Quantity Selector & Item Total */}
                      <div className="flex items-center justify-between mt-2 pt-1">
                        <div className="flex items-center border border-[#E5E1D5] rounded-lg bg-[#F7F5EF] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.id, Math.max(1, item.quantity - 1))}
                            disabled={item.quantity <= 1}
                            className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-200 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                            title="পরিমাণ কমান"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center font-bold text-xs text-[#14221C] tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer"
                            title="পরিমাণ বাড়ান"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-xs font-bold text-[#14221C] tabular-nums">
                          ৳{(item.price * item.quantity).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Calculation Section */}
            <div className="bg-[#F7F5EF] p-4 rounded-2xl border border-[#E5E1D5] space-y-2 text-xs">
              <div className="flex justify-between text-[#202522]/80">
                <span>পণ্যের মূল্য (Subtotal):</span>
                <span className="font-semibold text-[#14221C] tabular-nums">
                  ৳{cartSubtotal.toLocaleString()}
                </span>
              </div>

              {/* Delivery Fee Added Here at the End */}
              <div className="flex justify-between text-[#202522]/80 font-medium">
                <span>
                  ডেলিভারি চার্জ ({isDhakaDistrict ? 'ঢাকা জেলা (৳৭০)' : `${district} জেলা (৳১২০)`}):
                </span>
                <span className="font-bold text-[#14221C] tabular-nums">
                  +৳{deliveryFee}
                </span>
              </div>

              <div className="pt-2 border-t border-[#E5E1D5] flex justify-between items-baseline">
                <span className="text-sm font-bold text-[#14221C]">সর্বমোট প্রদেয় বিল (Total Payable):</span>
                <span className="text-2xl font-extrabold text-[#14221C] tabular-nums">
                  ৳{finalTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Options */}
            <div className="space-y-3 pt-1">
              <span className="text-xs font-bold text-[#14221C] block">পেমেন্ট মেথড:</span>
              <div className="space-y-2.5 text-xs">
                {/* 1. Cash On Delivery (Active by default) */}
                <label className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                  paymentMethod === 'Cash on Delivery (COD)'
                    ? 'border-[#14221C] bg-[#F7F5EF] ring-2 ring-[#14221C]/20 shadow-2xs'
                    : 'border-[#E5E1D5] hover:border-stone-400'
                }`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'Cash on Delivery (COD)'}
                    onChange={() => setPaymentMethod('Cash on Delivery (COD)')}
                    className="accent-[#14221C] w-4 h-4"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#14221C] text-sm">ক্যাশ অন ডেলিভারি (Cash on Delivery)</div>
                      <div className="text-[11px] text-stone-500">পণ্য হাতে পেয়ে চেক করে মূল্য পরিশোধ করুন</div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                      সক্রিয়
                    </span>
                  </div>
                </label>

                {/* 2. bKash Merchant (Currently Pending / Admin configurable) */}
                {isBkashOnline ? (
                  <label className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                    paymentMethod === 'bKash'
                      ? 'border-[#14221C] bg-[#F7F5EF] ring-2 ring-[#14221C]/20'
                      : 'border-[#E5E1D5] hover:border-stone-400'
                  }`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'bKash'}
                      onChange={() => setPaymentMethod('bKash')}
                      className="accent-[#14221C] w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-[#14221C]">বিকাশ মার্চেন্ট পেমেন্ট (bKash)</div>
                      <div className="text-[11px] text-stone-500">মার্চেন্ট বিকাশ নম্বরে পেমেন্ট করুন</div>
                      {paymentMethod === 'bKash' && (
                        <div className="mt-2 p-3 bg-white border border-[#E5E1D5] rounded-xl space-y-2">
                          <div className="text-[11px] text-[#14221C]">
                            বিকাশ মার্চেন্ট নাম্বার: <strong>{settings.bKashMerchantNumber}</strong>
                          </div>
                          <input
                            type="text"
                            placeholder="বিকাশ TrxID দিন"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-lg uppercase font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </label>
                ) : (
                  <div className="p-3.5 rounded-2xl border border-dashed border-[#E5E1D5] bg-stone-50/70 opacity-80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full border border-stone-300 bg-stone-200" />
                      <div>
                        <div className="font-bold text-stone-700 text-xs flex items-center gap-2">
                          <span>বিকাশ মার্চেন্ট পেমেন্ট</span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                            পেন্ডিং (অনবোর্ডিং চলছে)
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500 mt-0.5">
                          বিকাশ মার্চেন্ট অ্যাকাউন্ট অনুমোদন প্রক্রিয়াধীন। খুব শীঘ্রই চালু হবে।
                        </p>
                      </div>
                    </div>
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  </div>
                )}
              </div>
            </div>

            {/* Direct 1-Click Buy Now Button with dynamic error state */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-4 px-6 text-white text-sm font-extrabold uppercase tracking-wider rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer hover:shadow-xl active:scale-[0.99] ${
                  currentValidationError
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/30'
                    : 'bg-[#FF762E] hover:bg-[#e8631c]'
                }`}
              >
                {currentValidationError ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
                    <span>{currentValidationError}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 fill-white" />
                    <span>
                      {isSubmitting
                        ? 'অর্ডার প্রসেস হচ্ছে...'
                        : `অর্ডার নিশ্চিত করুন (৳${finalTotal.toLocaleString()})`}
                    </span>
                  </>
                )}
              </button>
              <div className="flex items-center justify-center gap-4 text-[11px] text-stone-500 mt-2">
                <span className="flex items-center gap-1 text-emerald-800 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  ১০০% জেনুইন কোয়ালিটি গ্যারান্টি
                </span>
                <span>•</span>
                <span>ক্যাশ অন ডেলিভারি</span>
                <span>•</span>
                <span>৭ দিনে ফ্রি সাইজ এক্সচেঞ্জ</span>
              </div>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
