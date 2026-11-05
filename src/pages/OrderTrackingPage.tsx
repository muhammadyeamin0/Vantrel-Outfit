import React, { useState } from 'react';
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
  AlertCircle,
  RotateCcw,
  XCircle,
  ExternalLink,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';

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

  // Cancel & Return modals state
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of mind');
  const [showReturnPrompt, setShowReturnPrompt] = useState(false);
  const [returnReason, setReturnReason] = useState('Fabric/fit adjustment requested');

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
    const res = cancelOrder(searchedOrder.id, cancelReason);
    setShowCancelPrompt(false);
    if (res.success) {
      const refreshed = trackOrderLookup(searchedOrder.orderNumber, searchedOrder.customer.phone);
      if (refreshed) setSearchedOrder(refreshed);
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
            className="w-14 h-14 object-contain rounded-2xl bg-black p-1.5 shadow-sm mx-auto border border-stone-200"
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
                {isEligibleForDirectCancel && (
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

            {/* Cancel Order Modal */}
            {showCancelPrompt && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 text-xs text-rose-900">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Cancel Order #{searchedOrder.orderNumber}</span>
                </div>
                <p className="text-[11px] text-rose-700">
                  Please select your cancellation reason. Once cancelled, reserved garments will be restored.
                </p>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-rose-200 rounded-xl"
                >
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Need to change sizing or color">Need to change sizing or color</option>
                  <option value="Need to update delivery address">Need to update delivery address</option>
                  <option value="Delivery timing conflict">Delivery timing conflict</option>
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCancelPrompt(false)}
                    className="px-3 py-1.5 bg-white border border-rose-200 text-xs font-semibold rounded-lg"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={handleCancelSubmit}
                    className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700"
                  >
                    Confirm Cancellation
                  </button>
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
