import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { OrderStatus } from '../types';
import {
  CheckCircle2,
  Printer,
  Package,
  MapPin,
  Phone,
  Mail,
  Clock,
  AlertTriangle,
  Award,
  MessageSquare,
  ShieldAlert,
  XCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

const CANCELLATION_REASONS = [
  'ভুলবশত অর্ডার করা হয়েছে (Ordered by mistake)',
  'সাইজ বা কালার পরিবর্তন করতে চাই (Need to change size or color)',
  'ডেলিভারি ঠিকানা বা মোবাইল নম্বর পরিবর্তন প্রয়োজন (Need to update address/phone)',
  'অন্য কোনো পণ্য পছন্দ হয়েছে (Found another product)',
  'ব্যক্তিগত জরুরি কারণ (Personal emergency)'
];

export const OrderConfirmationPage: React.FC = () => {
  const {
    lastPlacedOrder,
    setCurrentPage,
    cancelOrder,
    updateOrderStatus,
    showToast,
    generateWhatsAppOrderUrl
  } = useStore();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isWithinWindow, setIsWithinWindow] = useState<boolean>(true);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [selectedReason, setSelectedReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [customNote, setCustomNote] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

  const order = lastPlacedOrder;
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(
    order?.orderStatus || 'Pending Customer Confirmation'
  );

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Synchronize status if store updates
  useEffect(() => {
    if (order?.orderStatus) {
      setOrderStatus(order.orderStatus);
    }
  }, [order?.orderStatus]);

  // 15-Minute Countdown timer calculation with auto-confirm trigger on expiry
  useEffect(() => {
    if (!order) return;

    // Use confirmationDeadline, canCancelUntil, customerConfirmationDeadline, or 15 mins from createdAt
    const deadlineStr =
      order.confirmationDeadline ||
      order.canCancelUntil ||
      order.customerConfirmationDeadline;
    const orderTime = new Date(order.createdAt || Date.now()).getTime();
    const deadline =
      deadlineStr && !isNaN(new Date(deadlineStr).getTime())
        ? new Date(deadlineStr).getTime()
        : orderTime + 15 * 60 * 1000;

    let hasAutoConfirmed = false;

    const updateTimer = () => {
      const now = Date.now();
      const diff = deadline - now;

      if (diff <= 0 || orderStatus === 'Cancelled') {
        setTimeLeft('00:00');
        setIsWithinWindow(false);

        // If 15 minutes elapsed without cancellation, auto-confirm and send email to muhammadeyamin0@gmail.com
        if (
          diff <= 0 &&
          orderStatus !== 'Cancelled' &&
          orderStatus !== 'Order Confirmed' &&
          !hasAutoConfirmed
        ) {
          hasAutoConfirmed = true;
          setOrderStatus('Order Confirmed');
          updateOrderStatus(
            order.id,
            'Order Confirmed',
            '15-minute customer cancellation window elapsed. Order automatically confirmed by system.'
          );
          fetch(`/api/orders/${order.id}/auto-confirm`, { method: 'POST' })
            .then((r) => r.json())
            .then((data) => {
              if (data?.success && data?.data) {
                setOrderStatus('Order Confirmed');
              }
            })
            .catch((err) => {
              console.warn('Auto-confirm API trigger notice:', err);
            });
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
  }, [order, orderStatus, updateOrderStatus]);

  if (!order) {
    return (
      <div className="bg-[#F7F5EF] min-h-[60vh] flex items-center justify-center py-20 px-4">
        <div className="bg-white p-8 rounded-3xl border border-[#E5E1D5] text-center max-w-md w-full space-y-4">
          <h2 className="font-heading text-xl font-bold text-[#14221C]">No Recent Order Found</h2>
          <p className="text-xs text-[#202522]/60">
            Check your order history in your account or enter an order number on our tracking portal.
          </p>
          <button
            onClick={() => setCurrentPage('tracking')}
            className="w-full py-3 bg-[#14221C] text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
          >
            Go to Order Tracking
          </button>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmCancellation = async () => {
    if (!selectedReason) {
      showToast('কারণ নির্বাচন করুন', 'অনুগ্রহ করে অর্ডার বাতিলের কারণ নির্বাচন করুন।', 'error');
      return;
    }

    setIsSubmittingCancel(true);
    const finalReason = customNote.trim()
      ? `${selectedReason} - ${customNote.trim()}`
      : selectedReason;

    try {
      const res = cancelOrder(order.id, finalReason);
      setIsSubmittingCancel(false);
      setShowCancelModal(false);
      if (res.success) {
        setOrderStatus('Cancelled');
        showToast('অর্ডার বাতিল সম্পন্ন', 'আপনার অর্ডারটি বাতিল করা হয়েছে এবং স্টক পুনরুদ্ধার করা হয়েছে।', 'success');
      }
    } catch {
      setIsSubmittingCancel(false);
      setShowCancelModal(false);
    }
  };

  const isCancelled = orderStatus === 'Cancelled';
  const isAutoConfirmed = orderStatus === 'Order Confirmed' || (!isWithinWindow && !isCancelled);
  const earnedPoints = Math.floor(order.total / 50);

  return (
    <div className="bg-[#F7F5EF] min-h-screen py-10 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Main Status Banner */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-[#E5E1D5] shadow-sm text-center space-y-6 print:shadow-none print:border-none">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF762E]">
              Order Successfully Received
            </span>
            <h1 className="font-heading text-3xl font-extrabold text-[#14221C] tracking-tight">
              ধন্যবাদ, {order.customer.fullName}!
            </h1>
            <p className="text-xs text-[#202522]/70 max-w-md mx-auto">
              আপনার পছন্দের পণ্যগুলো সফলভাবে বুকিং হয়েছে। নিচে আপনার অর্ডারকৃত পণ্যের বিস্তারিত তথ্য দেখুন।
            </p>
          </div>

          {/* Order ID & Status Badge */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F7F5EF] rounded-xl border border-[#E5E1D5] text-xs">
              <span className="text-[#202522]/60">Order Number:</span>
              <strong className="text-base font-extrabold text-[#14221C] tracking-wider font-mono">
                {order.orderNumber}
              </strong>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800">
              <Award className="w-4 h-4 text-[#FF762E]" />
              <span>+{earnedPoints} VANTREL Points Earned</span>
            </div>

            <div className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold ${
              isCancelled
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : isAutoConfirmed
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>
                {isCancelled
                  ? 'বাতিলকৃত (Cancelled)'
                  : isAutoConfirmed
                  ? 'কনফার্মড (Order Confirmed)'
                  : 'যাচাইকরণ চলছে (15-Min Grace)'}
              </span>
            </div>
          </div>

          {/* 15-Minute Cancellation Grace Window - PROMINENTLY AT TOP */}
          {isCancelled ? (
            <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl max-w-2xl mx-auto text-left space-y-1 shadow-xs">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>অর্ডারটি বাতিল করা হয়েছে (Cancelled)</span>
              </div>
              <p className="text-[11px] text-rose-700">
                {order.cancellationReason ? `কারণ: ${order.cancellationReason}` : 'গ্রাহকের অনুরোধে অর্ডারটি বাতিল করা হয়েছে।'} পণ্যের স্টক ইনভেন্টরিতে ফিরিয়ে নেওয়া হয়েছে।
              </p>
            </div>
          ) : isWithinWindow ? (
            <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl max-w-2xl mx-auto space-y-3 text-xs text-left shadow-sm">
              <div className="flex items-center justify-between text-[#14221C]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-700">
                    <Clock className="w-4 h-4 text-[#FF762E]" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block text-sm">১৫ মিনিটের মধ্যে অর্ডার বাতিলের সুযোগ</span>
                    <span className="text-[10px] text-stone-500">Grace Cancellation Window</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-lg text-[#FF762E] tabular-nums bg-white px-3 py-1 rounded-xl border border-amber-300 shadow-xs inline-block">
                    {timeLeft || '15:00'}
                  </span>
                  <span className="block text-[9px] text-stone-500 text-right mt-0.5">বাকি আছে</span>
                </div>
              </div>

              <p className="text-[11px] text-[#202522]/80 leading-relaxed">
                অর্ডার নিশ্চিতকরণের জন্য ১৫ মিনিট সময় দেওয়া হয়েছে। আপনি চাইলে এই ১৫ মিনিটের মধ্যে সরাসরি অর্ডার বাতিল করতে পারবেন। ১৫ মিনিট শেষ হলে অর্ডারটি স্বয়ংক্রিয়ভাবে কনফার্ম হয়ে যাবে এবং নোটিফিকেশন <strong>muhammadeyamin0@gmail.com</strong> এ চলে যাবে।
              </p>

              <div className="pt-2 flex items-center justify-between border-t border-amber-200/80">
                <span className="text-[10px] text-stone-600">কোনো তথ্য ভুল থাকলে এখনই বাতিল করুন:</span>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>অর্ডার বাতিল করুন</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl max-w-2xl mx-auto space-y-2 text-xs text-left shadow-xs">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>✓ অর্ডার সফলভাবে কনফার্ম করা হয়েছে (Order Confirmed)</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                ১৫ মিনিটের সময় অতিক্রান্ত হওয়ায় আপনার অর্ডারটি স্বয়ংক্রিয়ভাবে নিশ্চিত হয়েছে এবং ওয়্যারহাউসে প্যাকিং শুরু হয়েছে। স্বয়ংক্রিয় কনফার্মেশন ইমেইল <strong>muhammadeyamin0@gmail.com</strong> এ সফলভাবে পাঠানো হয়েছে।
              </p>
            </div>
          )}

          {/* EXACT Delivery & Return Policy Notice as requested by User - PROMINENTLY AT TOP */}
          <div className="p-5 sm:p-6 bg-gradient-to-br from-amber-50 via-orange-50/50 to-amber-100/40 rounded-2xl border-2 border-amber-300 shadow-xs space-y-3.5 text-left max-w-2xl mx-auto">
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

          {/* PROMINENT "SHE KI ORDER KORESE" (WHAT YOU ORDERED) SECTION */}
          <div className="p-5 sm:p-6 bg-[#FAF9F5] rounded-2xl border-2 border-[#E5E1D5] text-left space-y-4 shadow-2xs max-w-2xl mx-auto">
            <div className="flex items-center justify-between border-b border-[#E5E1D5] pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#FF762E]" />
                <h3 className="font-heading font-extrabold text-base text-[#14221C]">
                  আপনার অর্ডারকৃত পণ্যের বিবরণ (Ordered Items)
                </h3>
              </div>
              <span className="text-xs font-bold text-[#14221C] bg-white px-2.5 py-1 rounded-lg border border-[#E5E1D5]">
                মোট আইটেম: {order.items.reduce((sum, item) => sum + item.quantity, 0)} টি
              </span>
            </div>

            {/* Item List with Image, Size, Color, Qty, Price */}
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 p-3 bg-white rounded-xl border border-[#E5E1D5] shadow-xs hover:border-[#14221C]/30 transition-colors"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-lg bg-stone-100 border border-stone-200 shrink-0"
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
                      প্রতি পিস: ৳{item.price.toLocaleString()} × {item.quantity} = <strong className="text-[#14221C] font-bold">৳{(item.price * item.quantity).toLocaleString()} BDT</strong>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-black text-sm sm:text-base text-[#14221C]">
                      ৳{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Delivery Destination & Payment Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#E5E1D5] text-xs">
              <div className="p-3 bg-white rounded-xl border border-[#E5E1D5] space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#FF762E] block">
                  ডেলিভারি ঠিকানা
                </span>
                <p className="font-bold text-[#14221C]">{order.customer.fullName} ({order.customer.phone})</p>
                <p className="text-[11px] text-[#202522]/80 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#FF762E] shrink-0 mt-0.5" />
                  <span>
                    {order.customer.streetAddress}, {order.customer.unionOrWard ? `${order.customer.unionOrWard}, ` : ''}{order.customer.upazila}, {order.customer.district}
                  </span>
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#E5E1D5] space-y-1.5">
                <div className="flex justify-between text-[#202522]/80">
                  <span>পণ্য সাবটোটাল:</span>
                  <span className="font-semibold text-[#14221C]">৳{order.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[#202522]/80">
                  <span>ডেলিভারি চার্জ:</span>
                  <span className="font-semibold text-[#14221C]">
                    {order.deliveryFee === 0 ? 'ফ্রি' : `৳${order.deliveryFee}`}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-black text-[#14221C] pt-1 border-t border-stone-200">
                  <span>সর্বমোট প্রদেয় টাকা (ক্যাশ অন ডেলিভারি):</span>
                  <span className="text-[#FF762E] font-mono text-base">৳{order.total.toLocaleString()} BDT</span>
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp & SMS Notification Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
            {/* Automated WhatsApp Confirmation Card */}
            <div className="p-4 bg-emerald-50/90 border-2 border-emerald-400/80 rounded-2xl space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-900 text-xs font-bold">
                  <span className="w-5 h-5 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[10px] font-black">
                    WA
                  </span>
                  <span>স্বয়ংক্রিয় হোয়াটসঅ্যাপ নোটিফিকেশন</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-mono font-bold rounded">
                  Active
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-emerald-200 text-[11px] font-mono text-[#14221C] leading-relaxed shadow-2xs">
                📲 <strong>গ্রাহকের হোয়াটসঅ্যাপ নম্বর:</strong> {order.customer.phone}
                <div className="mt-1 text-[10px] text-stone-600 line-clamp-2">
                  "🎉 VANTREL OUTFIT - অর্ডার #{order.orderNumber} গ্রহণ করা হয়েছে। মোট বিল: ৳{order.total.toLocaleString()} BDT..."
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                <span className="text-[10px] text-emerald-800">
                  আইডি: https://wa.me/message/E6PISGJZC63TA1
                </span>
                <a
                  href={generateWhatsAppOrderUrl(order)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <span>হোয়াটসঅ্যাপে মেসেজ দেখুন</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* SMS Gateway Transactional Card */}
            <div className="p-4 bg-stone-50 border border-[#E5E1D5] rounded-2xl space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-stone-800 text-xs font-bold">
                  <MessageSquare className="w-4 h-4 text-[#FF762E]" />
                  <span>SMS Gateway Dispatched</span>
                </div>
                <span className="px-2 py-0.5 bg-stone-200 text-stone-800 text-[10px] font-mono font-bold rounded">
                  Delivered
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-stone-200 text-[11px] font-mono text-[#14221C] leading-relaxed shadow-2xs">
                💬 <strong>VANTREL:</strong> Order #{order.orderNumber} received. ৳{order.total.toLocaleString()} (15m window).
              </div>
              <div className="text-[10px] text-stone-600 flex items-center justify-between pt-1">
                <span>প্রাপক: {order.customer.phone}</span>
                <span>Steadfast / Greenweb</span>
              </div>
            </div>
          </div>

          {/* Action links */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 print:hidden">
            <button
              onClick={() => setCurrentPage('tracking')}
              className="px-5 py-2.5 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Package className="w-4 h-4 text-[#FF762E]" />
              <span>লাইভ অর্ডার ট্র্যাকিং দেখুন</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-white border border-[#E5E1D5] hover:border-stone-400 text-[#14221C] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice Receipt</span>
            </button>

            <button
              onClick={() => setCurrentPage('shop')}
              className="px-5 py-2.5 bg-[#F7F5EF] text-[#202522] text-xs font-semibold uppercase tracking-wider rounded-xl hover:bg-stone-200 transition-colors cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </div>

        {/* Cancellation Reason Modal (Mandatory Reason Selection) */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>অর্ডার বাতিলের কারণ নিশ্চিতকরণ</span>
                </div>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="text-stone-400 hover:text-stone-700 text-lg leading-none p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                অর্ডার <strong>#{order.orderNumber}</strong> বাতিল করার জন্য অনুগ্রহ করে একটি সুনির্দিষ্ট কারণ নির্বাচন করুন। পণ্যটির স্টক তাৎক্ষণিকভাবে ইনভেন্টরিতে ফিরিয়ে নেওয়া হবে।
              </p>

              {/* Mandatory Reason Radio Options */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#14221C]">
                  বাতিলের কারণ নির্বাচন করুন (বাধ্যতামূলক):
                </label>
                {CANCELLATION_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedReason === reason
                        ? 'bg-rose-50/70 border-rose-300 text-rose-900 font-semibold shadow-2xs'
                        : 'bg-[#F7F5EF] border-[#E5E1D5] text-[#202522] hover:bg-stone-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel_reason"
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
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
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="যেমন: অন্য সাইজ অর্ডার করবো..."
                  rows={2}
                  className="w-full p-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  অর্ডার রাখুন
                </button>
                <button
                  type="button"
                  disabled={isSubmittingCancel}
                  onClick={handleConfirmCancellation}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCancel ? 'বাতিল হচ্ছে...' : 'হ্যাঁ, অর্ডার বাতিল করুন'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Official Printable Invoice Sheet */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-[#E5E1D5] shadow-sm space-y-8 print:p-0 print:border-none print:shadow-none">
          {/* Invoice Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-[#E5E1D5]">
            <div className="flex items-center gap-3.5">
              <img
                src="/assets/images/vantrel-logo.png"
                alt="VANTREL OUTFIT"
                className="w-14 h-14 object-contain rounded-xl bg-[#14221C] p-2 shadow-xs border border-stone-800 shrink-0"
              />
              <div>
                <span className="font-heading text-2xl font-black text-[#14221C] uppercase tracking-tight">
                  VANTREL OUTFIT
                </span>
                <p className="text-xs text-[#202522]/60 mt-1">
                  Level 4, Road 11, Block D, Banani, Dhaka-1213, Bangladesh<br />
                  WhatsApp: https://wa.me/message/E6PISGJZC63TA1 · Facebook: https://www.facebook.com/vantreloutfit · Instagram: https://www.instagram.com/vantreloutfit
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1 text-xs">
              <div className="text-sm font-bold text-[#14221C]">OFFICIAL ORDER INVOICE</div>
              <div className="font-mono text-[#202522]">Invoice No: {order.orderNumber}</div>
              <div className="text-[#202522]/60">Date: {new Date(order.createdAt).toLocaleDateString('en-GB')}</div>
              <div className="text-[#202522]/60">Payment: <strong className="text-[#14221C]">{order.paymentMethod}</strong></div>
              <div className="text-[#202522]/60">
                Status:{' '}
                <span className={`font-semibold ${isCancelled ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {order.orderStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery & Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 bg-[#F7F5EF] rounded-2xl border border-[#E5E1D5] text-xs">
            <div className="space-y-1.5">
              <h4 className="font-bold uppercase tracking-wider text-[#14221C]">
                Customer Information
              </h4>
              <p className="font-semibold text-[#14221C]">{order.customer.fullName}</p>
              <p className="flex items-center gap-1.5 text-[#202522]/80">
                <Phone className="w-3.5 h-3.5 text-[#FF762E]" />
                <span>{order.customer.phone}</span>
                {order.customer.altPhone && <span> / {order.customer.altPhone}</span>}
              </p>
              {order.customer.email && (
                <p className="flex items-center gap-1.5 text-[#202522]/80">
                  <Mail className="w-3.5 h-3.5 text-[#FF762E]" />
                  <span>{order.customer.email}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold uppercase tracking-wider text-[#14221C]">
                Delivery Destination
              </h4>
              <p className="flex items-start gap-1.5 text-[#202522]/80">
                <MapPin className="w-3.5 h-3.5 text-[#FF762E] shrink-0 mt-0.5" />
                <span>
                  {order.customer.streetAddress}, {order.customer.unionOrWard ? `${order.customer.unionOrWard}, ` : ''}{order.customer.upazila}, {order.customer.district}, {order.customer.division}
                </span>
              </p>
              {order.customer.notes && (
                <p className="text-[11px] text-[#202522]/60 italic">
                  Note: "{order.customer.notes}"
                </p>
              )}
            </div>
          </div>

          {/* Purchased Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#14221C] text-white uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Garment Details</th>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1D5]">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-[#14221C] flex items-center gap-3">
                      <img
                        src={item.image}
                        alt=""
                        className="w-10 h-12 object-cover rounded bg-stone-100 shrink-0"
                      />
                      <span>{item.name}</span>
                    </td>
                    <td className="px-4 py-3 text-[#202522]/70">
                      {item.size} / {item.color}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      ৳{item.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-[#14221C]">
                      ৳{(item.price * item.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Invoice Totals */}
          <div className="flex justify-end pt-4 border-t border-[#E5E1D5]">
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-[#202522]/80">
                <span>Subtotal:</span>
                <span className="font-semibold tabular-nums text-[#14221C]">
                  ৳{order.subtotal.toLocaleString()}
                </span>
              </div>

              {(order.discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discounts Applied:</span>
                  <span className="font-semibold tabular-nums">
                    -৳{(order.discount || 0).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-[#202522]/80">
                <span>Courier Delivery:</span>
                <span className="font-semibold tabular-nums text-[#14221C]">
                  {order.deliveryFee === 0 ? 'FREE' : `৳${order.deliveryFee}`}
                </span>
              </div>

              <div className="pt-2 border-t border-[#14221C] flex justify-between items-baseline font-bold text-sm text-[#14221C]">
                <span>Total Amount:</span>
                <span className="text-xl tabular-nums">
                  ৳{order.total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
