import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { MessageCircle, X, Ruler } from 'lucide-react';

export const FloatingChatWidget: React.FC = () => {
  const { setCurrentPage } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  const whatsappUrl = 'https://wa.me/message/E6PISGJZC63TA1';
  const facebookUrl = 'https://www.facebook.com/share/18qNnMStUm/';

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-20 sm:right-6 z-40 select-none">
      {/* Expanded Quick Chat Window */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-[#E5E1D5] overflow-hidden animate-fadeIn flex flex-col">
          {/* Header */}
          <div className="bg-[#14221C] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-heading font-black text-[#FF762E] text-sm border border-white/20">
                  VT
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[#14221C]" />
              </div>
              <div>
                <h4 className="text-sm font-bold tracking-tight">VANTREL OUTFIT Support</h4>
                <p className="text-[10px] text-white/70">Online · WhatsApp & Facebook</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick FAQ / Topics */}
          <div className="p-4 bg-[#F7F5EF] space-y-3">
            <div className="text-[11px] text-[#202522]/80 leading-relaxed bg-white p-3 rounded-2xl border border-[#E5E1D5] shadow-xs">
              👋 স্বাগতম <strong>VANTREL OUTFIT</strong>-এ। সাইজ নির্বাচন, অর্ডার সংক্রান্ত প্রশ্ন বা যেকোনো সহায়তায় আমাদের অফিশিয়াল <strong>হোয়াটসঅ্যাপ বিজনেস</strong> অথবা <strong>ফেসবুকে</strong> মেসেজ দিন।
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#202522]/50 block">
                সহায়তা অপশন:
              </span>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setCurrentPage('size-guide');
                }}
                className="w-full text-left p-2.5 bg-white hover:bg-stone-50 rounded-xl border border-[#E5E1D5] text-xs font-semibold text-[#14221C] flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5 text-[#FF762E]" />
                  <span>Interactive Size & Fit Guide</span>
                </span>
                <span className="text-[10px] text-stone-400">Inches/CM</span>
              </button>
            </div>
          </div>

          {/* Direct WhatsApp Business & Facebook Message Action Buttons */}
          <div className="p-4 bg-white border-t border-[#E5E1D5] space-y-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>হোয়াটসঅ্যাপ বিজনেসে মেসেজ (WhatsApp)</span>
            </a>

            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>ফেসবুকে মেসেজ করুন (Facebook)</span>
            </a>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2.5 px-4 py-3 bg-[#14221C] hover:bg-[#202522] text-white rounded-full shadow-2xl border border-white/20 transition-all hover:scale-105 cursor-pointer"
        aria-label="Open live customer chat"
      >
        <div className="relative">
          <MessageCircle className="w-5 h-5 text-[#25D366]" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#25D366] rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#25D366] rounded-full" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider">
          {isOpen ? 'Close' : 'WhatsApp / Support'}
        </span>
      </button>
    </div>
  );
};
