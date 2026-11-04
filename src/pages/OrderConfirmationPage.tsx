import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import {
  CheckCircle2,
  Printer,
  Package,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Clock,
  AlertTriangle,
  Award,
  MessageSquare
} from 'lucide-react';

export const OrderConfirmationPage: React.FC = () => {
  const { lastPlacedOrder, setCurrentPage, cancelOrder } = useStore();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isWithinWindow, setIsWithinWindow] = useState<boolean>(true);
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('Ordered by mistake');

  const order = lastPlacedOrder;

  // Countdown timer calculation
  useEffect(() => {
    if (!order) return;

    const deadline = new Date(order.canCancelUntil || order.customerConfirmationDeadline || order.createdAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft('00:00');
        setIsWithinWindow(false);
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
  }, [order]);

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

  const handleCancelClick = () => {
    cancelOrder(order.id, cancelReason);
    setShowCancelPrompt(false);
  };

  const earnedPoints = Math.floor(order.total / 50);

  return (
    <div className="bg-[#F7F5EF] min-h-screen py-10 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Banner */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-[#E5E1D5] shadow-sm text-center space-y-5 print:shadow-none print:border-none">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF762E]">
              Order Successfully Received
            </span>
            <h1 className="font-heading text-3xl font-extrabold text-[#14221C] tracking-tight">
              Thank You, {order.customer.fullName}!
            </h1>
            <p className="text-xs text-[#202522]/70 max-w-md mx-auto">
              Your garments have been reserved in our Banani inventory. We have initiated automated confirmation & order verification.
            </p>
          </div>

          {/* Order ID & Points Badge */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F7F5EF] rounded-xl border border-[#E5E1D5] text-xs">
              <span className="text-[#202522]/60">Order Number:</span>
              <strong className="text-base font-extrabold text-[#14221C] tracking-wider font-mono">
                {order.orderNumber}
              </strong>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800">
              <Award className="w-4 h-4 text-[#FF762E]" />
              <span>+{earnedPoints} VANTREL Points Earned</span>
            </div>
          </div>

          {/* 15-Minute Cancellation Grace Window */}
          {order.orderStatus === 'Cancelled' ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl max-w-md mx-auto text-xs text-rose-800 font-semibold">
              This order has been cancelled and stock has been restored to inventory.
            </div>
          ) : (
            <div className="p-4 bg-[#F7F5EF] border border-[#E5E1D5] rounded-2xl max-w-lg mx-auto space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#14221C]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FF762E]" />
                  <span className="font-bold">Cancellation Grace Window:</span>
                </div>
                <span className="font-mono font-bold text-sm text-[#FF762E] tabular-nums">
                  {timeLeft || '15:00'} remaining
                </span>
              </div>
              <p className="text-[11px] text-[#202522]/70 text-left">
                {isWithinWindow
                  ? 'You have 15 minutes to cancel or modify this order directly with immediate stock restoration. Afterwards, it will transition to confirmed status for fulfillment.'
                  : 'The cancellation window has closed. Your parcel has been queued for warehouse dispatch.'}
              </p>
              {isWithinWindow && (
                <div className="pt-2 text-right">
                  <button
                    onClick={() => setShowCancelPrompt(true)}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                  >
                    Cancel Order Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SMS Notification Preview Card */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl max-w-lg mx-auto text-left space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>SMS Notification Dispatched (+880 Gateway)</span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-mono font-bold rounded">
                Delivered
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-emerald-100 text-[11px] font-mono text-[#14221C] leading-relaxed shadow-xs">
              💬 <strong>VANTREL:</strong> Your order #{order.orderNumber} has been received. Total: ৳{order.total.toLocaleString()}. Confirmation window: 15 mins. Track live at /tracking?order={order.orderNumber}
            </div>
            <div className="text-[10px] text-emerald-700/80 flex items-center justify-between">
              <span>Recipient: {order.customer.phone}</span>
              <span>Provider: Greenweb SMS Gateway BD</span>
            </div>
          </div>

          {/* Cancel Confirmation Prompt */}
          {showCancelPrompt && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl max-w-md mx-auto text-left text-xs space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Confirm Order Cancellation</span>
              </div>
              <p className="text-[11px] text-[#202522]/70">
                Are you sure you want to cancel order #{order.orderNumber}? The reserved garments will immediately be returned to store stock.
              </p>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-rose-200 rounded-xl"
              >
                <option value="Ordered by mistake">Ordered by mistake</option>
                <option value="Need to change sizing or color">Need to change sizing or color</option>
                <option value="Need to update delivery address">Need to update delivery address</option>
                <option value="Found alternative item">Found alternative item</option>
              </select>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCancelPrompt(false)}
                  className="px-3 py-1.5 bg-white border border-stone-300 text-xs font-semibold rounded-lg"
                >
                  Keep Order
                </button>
                <button
                  onClick={handleCancelClick}
                  className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700"
                >
                  Yes, Cancel Order
                </button>
              </div>
            </div>
          )}

          {/* Action links */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 print:hidden">
            <button
              onClick={() => setCurrentPage('account')}
              className="px-5 py-2.5 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Package className="w-4 h-4 text-[#FF762E]" />
              <span>আমার অর্ডারসমূহ দেখুন</span>
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

        {/* Official Printable Invoice Sheet */}
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-[#E5E1D5] shadow-sm space-y-8 print:p-0 print:border-none print:shadow-none">
          {/* Invoice Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-[#E5E1D5]">
            <div>
              <span className="font-heading text-2xl font-black text-[#14221C] uppercase tracking-tight">
                VANTREL
              </span>
              <p className="text-xs text-[#202522]/60 mt-1">
                Level 4, Road 11, Block D, Banani, Dhaka-1213, Bangladesh<br />
                WhatsApp: https://wa.me/message/E6PISGJZC63TA1 · Facebook: https://www.facebook.com/share/18qNnMStUm/
              </p>
            </div>

            <div className="text-left sm:text-right space-y-1 text-xs">
              <div className="text-sm font-bold text-[#14221C]">OFFICIAL ORDER INVOICE</div>
              <div className="font-mono text-[#202522]">Invoice No: {order.orderNumber}</div>
              <div className="text-[#202522]/60">Date: {new Date(order.createdAt).toLocaleDateString('en-GB')}</div>
              <div className="text-[#202522]/60">Payment: <strong className="text-[#14221C]">{order.paymentMethod}</strong></div>
              <div className="text-[#202522]/60">Status: <span className="font-semibold text-emerald-700">{order.orderStatus}</span></div>
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
