import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus } from '../types';
import {
  Package,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  Phone,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  RotateCcw,
  XCircle,
  ExternalLink,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';

const CANCELLATION_REASONS = [
  'ভুলবশত অর্ডার করা হয়েছে (Ordered by mistake)',
  'সাইজ বা কালার পরিবর্তন করতে চাই (Need to change size or color)',
  'ডেলিভারি ঠিকানা বা মোবাইল নম্বর পরিবর্তন প্রয়োজন (Need to update address/phone)',
  'অন্য কোনো পণ্য পছন্দ হয়েছে (Found another product)',
  'ব্যক্তিগত জরুরি কারণ (Personal emergency)'
];

export const OrderTrackingPage: React.FC = () => {
  const {
    trackOrderLookup,
    lastPlacedOrder,
    settings,
    cancelOrder,
    requestOrderReturn,
    smsLogs,
    showToast
  } = useStore();

  const [orderNumber, setOrderNumber] = useState(lastPlacedOrder ? lastPlacedOrder.orderNumber : 'VT-89241');
  const [phone, setPhone] = useState(lastPlacedOrder ? lastPlacedOrder.customer.phone : '01711234567');
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(lastPlacedOrder || null);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 15-min countdown timer state
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isWithinWindow, setIsWithinWindow] = useState<boolean>(true);

  // Cancel & Return modals state
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCELLATION_REASONS[0]);
  const [cancelCustomNote, setCancelCustomNote] = useState('');
  const [showReturnPrompt, setShowReturnPrompt] = useState(false);
  const [returnReason, setReturnReason] = useState('Fabric/fit adjustment requested');

  // Track 15-minute deadline for searched order
  useEffect(() => {
    if (!searchedOrder) return;
    const deadlineStr =
      searchedOrder.confirmationDeadline ||
      searchedOrder.canCancelUntil ||
      searchedOrder.customerConfirmationDeadline;
    const orderTime = new Date(searchedOrder.createdAt || Date.now()).getTime();
    const deadline =
      deadlineStr && !isNaN(new Date(deadlineStr).getTime())
        ? new Date(deadlineStr).getTime()
        : orderTime + 15 * 60 * 1000;

    let hasAutoConfirmed = false;

    const updateTimer = () => {
      const now = Date.now();
      const diff = deadline - now;
      if (diff <= 0 || searchedOrder.orderStatus === 'Cancelled') {
        setTimeLeft('00:00');
        setIsWithinWindow(false);

        // If 15 minutes elapsed without cancellation, trigger auto-confirm API
        const isPending =
          searchedOrder.orderStatus === 'Pending Customer Confirmation' ||
          searchedOrder.orderStatus === 'Customer Confirmed';
        if (diff <= 0 && isPending && !hasAutoConfirmed) {
          hasAutoConfirmed = true;
          fetch(`/api/orders/${searchedOrder.id}/auto-confirm`, { method: 'POST' })
            .then((r) => r.json())
            .then((data) => {
              if (data?.success && data?.data) {
                setSearchedOrder(data.data);
              }
            })
            .catch(() => {});
        }
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        setIsWithinWindow(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [searchedOrder]);

  const mainStatusPipeline: OrderStatus[] = [
    'Pending Customer Confirmation',
    'Customer Confirmed',
    'Order Confirmed',
    'Processing',
    'Packed',
    'Shipped',
    'Out for Delivery',
    'Delivered'
  ];

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setHasSearched(true);

    if (!orderNumber.trim() && !phone.trim()) {
      setErrorMessage('Please enter either your Order Number (e.g. VT-89241) or your Mobile Number.');
      return;
    }

    const order = trackOrderLookup(orderNumber.trim(), phone.trim());
    if (order) {
      setSearchedOrder(order);
      showToast('Order Located', `Current Status: ${order.orderStatus}`, 'info');
    } else {
      setSearchedOrder(null);
      setErrorMessage('No order found matching this inquiry. Please verify your Order Number or Mobile Number.');
    }
  };

  const getStepStatus = (step: OrderStatus, currentStatus: OrderStatus) => {
    if (currentStatus === 'Cancelled') return 'cancelled';
    const currentIndex = mainStatusPipeline.indexOf(currentStatus);
    const stepIndex = mainStatusPipeline.indexOf(step);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const handleCancelSubmit = () => {
    if (!searchedOrder) return;
    if (!cancelReason) {
      showToast('কারণ নির্বাচন করুন', 'অনুগ্রহ করে অর্ডার বাতিলের কারণ নির্বাচন করুন।', 'error');
      return;
    }
    const finalReason = cancelCustomNote.trim()
      ? `${cancelReason} - ${cancelCustomNote.trim()}`
      : cancelReason;
    const res = cancelOrder(searchedOrder.id, finalReason);
    setShowCancelPrompt(false);
    if (res.success) {
      const refreshed = trackOrderLookup(searchedOrder.orderNumber, searchedOrder.customer.phone);
      if (refreshed) {
        setSearchedOrder(refreshed);
      } else {
        setSearchedOrder({ ...searchedOrder, orderStatus: 'Cancelled', cancellationReason: finalReason });
      }
      showToast('অর্ডার বাতিল সম্পন্ন', 'অর্ডারটি সফলভাবে বাতিল করা হয়েছে।', 'success');
    }
  };

  const handleReturnSubmit = () => {
    if (!searchedOrder) return;
    const res = requestOrderReturn(searchedOrder.id, returnReason);
    setShowReturnPrompt(false);
    if (res.success) {
      const refreshed = trackOrderLookup(searchedOrder.orderNumber, searchedOrder.customer.phone);
      if (refreshed) setSearchedOrder(refreshed);
    }
  };

  // Associated SMS logs for this order
  const orderSmsLogs = searchedOrder
    ? smsLogs.filter(
        (l) =>
          l.orderNumber === searchedOrder.orderNumber ||
          (l.phone || l.recipientPhone || '').endsWith(searchedOrder.customer.phone.slice(-10))
      )
    : [];

  const isEligibleForDirectCancel =
    searchedOrder &&
    (searchedOrder.orderStatus === 'Pending Customer Confirmation' ||
      (searchedOrder.canCancelUntil
        ? new Date().getTime() <= new Date(searchedOrder.canCancelUntil).getTime()
        : false));

  const isEligibleForReturn =
    searchedOrder &&
    searchedOrder.orderStatus === 'Delivered';

  return (
    <div className="bg-[#F7F5EF] min-h-screen py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Title */}
        <div className="text-center max-w-xl mx-auto space-y-2.5">
          <img
            src="/assets/images/vantrel-logo.png"
            alt="VANTREL OUTFIT"
            className="w-14 h-14 object-contain rounded-2xl bg-[#14221C] p-2 shadow-sm mx-auto border border-stone-800"
          />
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF762E]">
              Bangladesh Logistics Tracking
            </span>
            <h1 className="font-heading text-3xl font-extrabold text-[#14221C] tracking-tight uppercase">
              Track Your Order
            </h1>
          </div>
          <p className="text-xs text-[#202522]/60">
            Enter your unique VANTREL OUTFIT order identifier and verified phone number to inspect delivery progress.
          </p>
        </div>

        {/* Lookup Card */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-4">
          <form onSubmit={handleTrackSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-[#14221C] mb-1">
                Order Number
              </label>
              <input
                type="text"
                placeholder="e.g. VT-89241"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C] uppercase font-mono"
              />
            </div>

            <div className="sm:col-span-5">
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

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Search className="w-4 h-4 text-[#FF762E]" />
                <span>Track</span>
              </button>
            </div>
          </form>

          {/* Demo helper */}
          <div className="flex items-center justify-between text-[11px] text-[#202522]/60 pt-2 border-t border-slate-100">
            <span>Demo Test Orders:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOrderNumber('VT-89241');
                  setPhone('01711234567');
                }}
                className="text-[#14221C] font-semibold hover:text-[#FF762E] underline cursor-pointer"
              >
                VT-89241 (Shipped)
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => {
                  setOrderNumber('VT-89190');
                  setPhone('01819998877');
                }}
                className="text-[#14221C] font-semibold hover:text-[#FF762E] underline cursor-pointer"
              >
                VT-89190 (Awaiting Staff Approval)
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-700">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to find order</p>
                <p className="mt-0.5 text-[11px]">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Found Order Timeline & Info */}
        {searchedOrder && (
          <div className="bg-white p-6 sm:p-10 rounded-3xl border border-[#E5E1D5] shadow-xs space-y-8 animate-fadeIn">
            {/* Top Status Banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-[#E5E1D5]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#FF762E]">
                    Order #{searchedOrder.orderNumber}
                  </span>
                  <span className="px-2.5 py-0.5 bg-[#14221C] text-white text-[10px] font-bold rounded-full uppercase">
                    {searchedOrder.orderStatus}
                  </span>
                </div>
                <h2 className="font-heading text-2xl font-black text-[#14221C] mt-1">
                  Status: <span className="text-[#FF762E]">{searchedOrder.orderStatus}</span>
                </h2>
                <p className="text-xs text-[#202522]/60 mt-1">
                  Placed on {new Date(searchedOrder.createdAt).toLocaleDateString('en-GB')} at {new Date(searchedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Courier consignment info */}
              {searchedOrder.trackingNumber && (
                <div className="p-3 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] text-xs space-y-1">
                  <div className="text-[10px] text-[#202522]/60 font-semibold uppercase tracking-wider">
                    Courier: {searchedOrder.courierName || 'Steadfast Courier'}
                  </div>
                  <div className="font-mono font-bold text-sm text-[#14221C]">
                    {searchedOrder.trackingNumber}
                  </div>
                  {searchedOrder.trackingUrl && (
                    <a
                      href={searchedOrder.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#FF762E] font-bold hover:underline"
                    >
                      <span>Live Courier Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* PROMINENT "SHE KI ORDER KORESE" (WHAT YOU ORDERED) SECTION */}
            <div className="p-5 sm:p-6 bg-[#FAF9F5] rounded-2xl border border-[#E5E1D5] text-left space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E1D5] pb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#FF762E]" />
                  <h3 className="font-heading font-extrabold text-base text-[#14221C]">
                    আপনার অর্ডারকৃত পণ্যসমূহ (Ordered Items)
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#14221C] bg-white px-2.5 py-1 rounded-lg border border-[#E5E1D5]">
                  {searchedOrder.items.reduce((sum, item) => sum + item.quantity, 0)} টি পণ্য
                </span>
              </div>

              {/* Garment List */}
              <div className="space-y-3">
                {searchedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3.5 p-3 bg-white rounded-xl border border-[#E5E1D5] shadow-xs"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-14 h-18 sm:w-16 sm:h-20 object-cover rounded-lg bg-stone-100 border border-stone-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <h4 className="font-bold text-xs sm:text-sm text-[#14221C] truncate">
                        {item.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#202522]/80">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-stone-100 font-semibold text-stone-800 border border-stone-200">
                          সাইজ: {item.size}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-stone-100 font-semibold text-stone-800 border border-stone-200">
                          কালার: {item.color}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-stone-100 font-semibold text-stone-800 border border-stone-200">
                          পরিমাণ: {item.quantity} টি
                        </span>
                      </div>
                      <div className="text-xs text-[#202522]/70 pt-0.5">
                        ৳{item.price.toLocaleString()} × {item.quantity} = <strong className="text-[#14221C] font-bold">৳{(item.price * item.quantity).toLocaleString()} BDT</strong>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-sm text-[#14221C]">
                        ৳{(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery destination & total */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#E5E1D5] text-xs">
                <div className="p-3 bg-white rounded-xl border border-[#E5E1D5] space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#FF762E] block">
                    প্রাপকের ঠিকানা
                  </span>
                  <p className="font-bold text-[#14221C]">{searchedOrder.customer.fullName} ({searchedOrder.customer.phone})</p>
                  <p className="text-[11px] text-[#202522]/80 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#FF762E] shrink-0 mt-0.5" />
                    <span>
                      {searchedOrder.customer.streetAddress}, {searchedOrder.customer.unionOrWard ? `${searchedOrder.customer.unionOrWard}, ` : ''}{searchedOrder.customer.upazila}, {searchedOrder.customer.district}
                    </span>
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#E5E1D5] space-y-1.5">
                  <div className="flex justify-between text-[#202522]/80">
                    <span>সাবটোটাল:</span>
                    <span className="font-semibold text-[#14221C]">৳{searchedOrder.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#202522]/80">
                    <span>ডেলিভারি চার্জ:</span>
                    <span className="font-semibold text-[#14221C]">
                      {searchedOrder.deliveryFee === 0 ? 'ফ্রি' : `৳${searchedOrder.deliveryFee}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-[#14221C] pt-1 border-t border-stone-200">
                    <span>সর্বমোট বিল (ক্যাশ অন ডেলিভারি):</span>
                    <span className="text-[#FF762E] font-mono text-base">৳{searchedOrder.total.toLocaleString()} BDT</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Progress Timeline (16-Stage Mapping) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#14221C] mb-6">
                Fulfillment Stepper
              </h3>

              <div className="overflow-x-auto pb-2">
                <div className="flex sm:grid sm:grid-cols-8 gap-4 min-w-[600px]">
                  {mainStatusPipeline.map((step, idx) => {
                    const state = getStepStatus(step, searchedOrder.orderStatus);
                    return (
                      <div key={step} className="flex flex-col items-center text-center relative group">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                            state === 'completed'
                              ? 'bg-[#14221C] text-white'
                              : state === 'current'
                              ? 'bg-[#FF762E] text-white ring-4 ring-[#FF762E]/20 scale-110'
                              : 'bg-[#F7F5EF] text-[#202522]/40 border border-[#E5E1D5]'
                          }`}
                        >
                          {state === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>

                        <span
                          className={`text-[10px] font-bold mt-2 uppercase tracking-tight max-w-[80px] leading-tight ${
                            state === 'current'
                              ? 'text-[#FF762E]'
                              : state === 'completed'
                              ? 'text-[#14221C]'
                              : 'text-[#202522]/40'
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 15-Minute Grace Window or Cancellation Status Banner */}
            {searchedOrder.orderStatus === 'Cancelled' ? (
              <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl text-left space-y-1">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>এই অর্ডারটি বাতিল করা হয়েছে (Cancelled)</span>
                </div>
                <p className="text-[11px] text-rose-700">
                  {searchedOrder.cancellationReason
                    ? `কারণ: ${searchedOrder.cancellationReason}`
                    : 'গ্রাহকের অনুরোধে অর্ডারটি বাতিল করা হয়েছে।'}
                </p>
              </div>
            ) : isWithinWindow ? (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl space-y-2 text-xs text-left shadow-xs">
                <div className="flex items-center justify-between text-[#14221C]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#FF762E]" />
                    <div>
                      <span className="font-bold text-stone-900 block">১৫ মিনিটের মধ্যে অর্ডার বাতিলের সুযোগ সক্রিয়</span>
                      <span className="text-[10px] text-stone-500">Grace Cancellation Window</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-[#FF762E] tabular-nums bg-white px-2 py-0.5 rounded border border-amber-200 shadow-xs inline-block">
                      {timeLeft || '15:00'}
                    </span>
                    <span className="block text-[9px] text-stone-500 text-right">বাকি আছে</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                  <p className="text-[11px] text-[#202522]/80">
                    কোনো ভুল তথ্য বা পরিবর্তন প্রয়োজন হলে নির্ধারিত সময়ের মধ্যে বাতিল করুন।
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCancelPrompt(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>অর্ডার বাতিল করুন</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Estimated Delivery Window */}
            <div className="p-4 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-[#FF762E]" />
                <div>
                  <div className="font-bold text-[#14221C]">Estimated Delivery Window</div>
                  <div className="text-[11px] text-[#202522]/70">
                    {searchedOrder.deliveryZone === 'inside_dhaka'
                      ? 'Inside Dhaka: 24 to 48 Hours via Pathao/Steadfast Express'
                      : searchedOrder.deliveryZone === 'express_dhaka'
                      ? 'Express Dhaka: Same Day Delivery within 8 Hours'
                      : 'Outside Dhaka: 48 to 72 Hours via Steadfast Hubs'}
                  </div>
                </div>
              </div>

              {/* Actions: Cancellation & Return */}
              <div className="flex items-center gap-2">
                {isEligibleForDirectCancel && !isWithinWindow && (
                  <button
                    onClick={() => setShowCancelPrompt(true)}
                    className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl hover:bg-rose-100 transition-colors"
                  >
                    Cancel Order
                  </button>
                )}

                {isEligibleForReturn && (
                  <button
                    onClick={() => setShowReturnPrompt(true)}
                    className="px-3 py-1.5 bg-stone-100 border border-stone-300 text-[#14221C] text-xs font-bold rounded-xl hover:bg-stone-200 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Request Return</span>
                  </button>
                )}
              </div>
            </div>

            {/* EXACT Delivery & Return Policy Notice as requested by User */}
            <div className="p-5 sm:p-6 bg-gradient-to-br from-amber-50 via-orange-50/50 to-amber-100/40 rounded-2xl border-2 border-amber-300 shadow-xs space-y-3.5 text-left">
              <div className="flex items-center gap-2.5 text-[#14221C]">
                <div className="w-8 h-8 rounded-xl bg-[#FF762E] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#14221C]">
                    ডেলিভারি ও পণ্য পরীক্ষা সংক্রান্ত জরুরি শর্তাবলী
                  </h3>
                  <p className="text-[11px] text-[#202522]/70">
                    পণ্য গ্রহণের সময় অনুগ্রহ করে নিচের নিয়মগুলো সতর্কতার সাথে লক্ষ্য রাখুন
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-[#14221C] leading-relaxed">
                <div className="p-3 bg-white/90 rounded-xl border border-amber-200/80 flex items-start gap-2.5 shadow-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    ১
                  </span>
                  <p className="font-semibold text-stone-900 leading-normal">
                    ডেলিভারি ম্যান উপস্থিত থাকাকালীন আপনাকে অবশ্যই পণ্যটি পরীক্ষা করতে হবে; কোনো ত্রুটি পাওয়া গেলে, অবিলম্বে ফেরতের জন্য বলুন।
                  </p>
                </div>

                <div className="p-3 bg-white/90 rounded-xl border border-amber-200/80 flex items-start gap-2.5 shadow-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    ২
                  </span>
                  <p className="font-semibold text-stone-900 leading-normal">
                    ডেলিভারি ম্যান চলে যাওয়ার পর আপনি যদি পণ্যটি ফেরত বা বিনিময় করতে চান, তাহলে আপনাকে অতিরিক্ত ডেলিভারি চার্জ দিতে হবে।
                  </p>
                </div>

                <div className="p-3 bg-amber-100/90 rounded-xl border border-amber-300/80 text-[11px] text-amber-950 font-medium leading-relaxed">
                  <strong className="font-bold text-amber-900">কারণ:</strong> এই পণ্যগুলো ফেরত দিলে এর কভার ক্ষতিগ্রস্ত হয় এবং সেগুলো পুনরায় বিক্রয়ের অযোগ্য হয়ে পড়ে। তাই পণ্য ফেরত দেওয়া এড়িয়ে চলুন।
                </div>
              </div>
            </div>

            {/* Cancel Order Modal with Mandatory Reason Selection */}
            {showCancelPrompt && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span>অর্ডার বাতিল নিশ্চিতকরণ</span>
                    </div>
                    <button
                      onClick={() => setShowCancelPrompt(false)}
                      className="text-stone-400 hover:text-stone-700 text-lg leading-none p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed">
                    অর্ডার <strong>#{searchedOrder.orderNumber}</strong> বাতিল করার জন্য অনুগ্রহ করে কারণ নির্বাচন করুন:
                  </p>

                  {/* Mandatory Reason Radio Options */}
                  <div className="space-y-2">
                    {CANCELLATION_REASONS.map((reason) => (
                      <label
                        key={reason}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          cancelReason === reason
                            ? 'bg-rose-50/70 border-rose-300 text-rose-900 font-semibold shadow-2xs'
                            : 'bg-[#F7F5EF] border-[#E5E1D5] text-[#202522] hover:bg-stone-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name="tracking_cancel_reason"
                          checked={cancelReason === reason}
                          onChange={() => setCancelReason(reason)}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500"
                        />
                        <span>{reason}</span>
                      </label>
                    ))}
                  </div>

                  {/* Optional Note */}
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      অতিরিক্ত কোনো মন্তব্য থাকলে লিখুন (ঐচ্ছিক):
                    </label>
                    <textarea
                      value={cancelCustomNote}
                      onChange={(e) => setCancelCustomNote(e.target.value)}
                      placeholder="অতিরিক্ত বিস্তারিত..."
                      rows={2}
                      className="w-full p-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => setShowCancelPrompt(false)}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl cursor-pointer"
                    >
                      অর্ডার রাখুন
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelSubmit}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
                    >
                      হ্যাঁ, অর্ডার বাতিল করুন
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Return Order Modal */}
            {showReturnPrompt && (
              <div className="p-4 bg-stone-50 border border-[#E5E1D5] rounded-2xl space-y-3 text-xs text-[#14221C]">
                <div className="font-bold flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-[#FF762E]" />
                  <span>Request Return / Exchange</span>
                </div>
                <p className="text-[11px] text-[#202522]/70">
                  VANTREL OUTFIT offers 7-day hassle-free returns on unworn pieces with tags attached.
                </p>
                <textarea
                  rows={2}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Explain why you wish to exchange or return this garment..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5E1D5] rounded-xl"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowReturnPrompt(false)}
                    className="px-3 py-1.5 bg-white border border-stone-300 text-xs font-semibold rounded-lg"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={handleReturnSubmit}
                    className="px-3 py-1.5 bg-[#14221C] text-white text-xs font-bold rounded-lg"
                  >
                    Submit Return Request
                  </button>
                </div>
              </div>
            )}

            {/* Status History Logs */}
            <div className="p-5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] space-y-3 text-xs">
              <h4 className="font-bold uppercase tracking-wider text-[#14221C]">
                Detailed Fulfillment Audit Trail
              </h4>
              <div className="space-y-2">
                {searchedOrder.statusHistory.map((hist, i) => (
                  <div key={i} className="flex items-start justify-between text-xs pb-2 border-b border-[#E5E1D5] last:border-none last:pb-0">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-[#14221C]">{hist.status}</strong>
                        {hist.actor && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-white text-[#202522]/60 rounded border border-[#E5E1D5]">
                            {hist.actor}
                          </span>
                        )}
                      </div>
                      {hist.note && (
                        <p className="text-[11px] text-[#202522]/70">{hist.note}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-[#202522]/50 shrink-0 tabular-nums">
                      {new Date(hist.timestamp).toLocaleDateString('en-GB')} {new Date(hist.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Associated Transactional SMS Logs */}
            {orderSmsLogs.length > 0 && (
              <div className="p-5 bg-white rounded-2xl border border-[#E5E1D5] space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#FF762E]" />
                  <h4 className="font-bold uppercase tracking-wider text-[#14221C]">
                    SMS Gateway Transactional Logs
                  </h4>
                </div>
                <div className="space-y-2">
                  {orderSmsLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-[#F7F5EF] rounded-xl border border-[#E5E1D5] text-[11px] space-y-1">
                      <div className="flex justify-between items-center text-[#202522]/60">
                        <span>Recipient: {log.phone || log.recipientPhone} ({log.provider})</span>
                        <span className="font-mono text-[10px]">{new Date(log.timestamp || log.dispatchedAt || Date.now()).toLocaleTimeString()}</span>
                      </div>
                      <p className="font-medium text-[#14221C]">"{log.message}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Support Assistance */}
            <div className="p-4 bg-[#14221C] text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="space-y-0.5 text-center sm:text-left">
                <div className="font-bold">Need assistance with your consignment?</div>
                <div className="text-white/70 text-[11px]">Connect with VANTREL OUTFIT Support via WhatsApp Business or Facebook.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href="https://wa.me/message/E6PISGJZC63TA1"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <span>হোয়াটসঅ্যাপ (WhatsApp)</span>
                </a>
                <a
                  href="https://www.facebook.com/vantreloutfit"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <span>ফেসবুক (Facebook)</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
