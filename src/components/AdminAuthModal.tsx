import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Lock, KeyRound, AlertCircle, X, Eye, EyeOff } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AUTHORIZED_ADMIN_EMAIL = 'muhammadeyamin0@gmail.com';

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose }) => {
  const { setCurrentPage, verifyAdminCredentials, currentUser } = useStore();
  const [emailInput, setEmailInput] = useState(currentUser?.email || '');
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (currentUser?.email && !emailInput) {
      setEmailInput(currentUser.email);
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const handleVerifyAccess = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPin = pinInput.trim();

    if (!cleanEmail || !cleanPin) {
      setErrorMsg('অনুগ্রহ করে অনুমোদিত জিমেইল ও ৪-ডিজিটের পাসওয়ার্ড দিন।');
      return;
    }

    if (cleanEmail !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
      setErrorMsg(`অ্যাক্সেস সংরক্ষিত! '${cleanEmail}' ইমেইলটি অ্যাডমিন হিসেবে অনুমোদিত নয়।`);
      setPinInput('');
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      const res = verifyAdminCredentials(cleanEmail, cleanPin);
      if (res.success) {
        setPinInput('');
        setErrorMsg('');
        onClose();
        setCurrentPage('admin');
      } else {
        setErrorMsg(res.message || 'ভুল জিমেইল অথবা ৪-ডিজিটের পাসওয়ার্ড! সঠিক তথ্য দিন।');
        setPinInput('');
      }
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity" />
      <div className="relative w-full max-w-md bg-[#111413] text-white rounded-3xl border border-[#223028] shadow-2xl p-6 sm:p-8 space-y-6 animate-fadeIn z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-white rounded-lg cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1C2922] text-emerald-400 border border-emerald-500/20 flex items-center justify-center shadow-md">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="font-heading text-xl font-extrabold text-white uppercase tracking-tight">
            অ্যাডমিন পোর্টাল সিকিউরিটি লক
          </h3>
          <p className="text-xs text-stone-300 leading-relaxed max-w-xs mx-auto">
            এই প্যানেলে শুধুমাত্র অনুমোদিত অ্যাডমিন প্রবেশ করতে পারবেন। আপনার অথোরাইজড জিমেইল ও ৪-ডিজিটের পাসওয়ার্ড দিন।
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerifyAccess} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-200 mb-1.5">
              অনুমোদিত জিমেইল (Admin Gmail) <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="আপনার জিমেইল এড্রেস লিখুন"
              className="w-full px-3.5 py-2.5 text-xs bg-[#19221D] border border-[#2B3B32] text-white placeholder-stone-500 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-200 mb-1.5">
              ৪-ডিজিটের পাসওয়ার্ড (4-Digit PIN) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="••••"
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 text-sm tracking-[0.4em] font-mono text-center bg-[#19221D] border border-[#2B3B32] text-white placeholder-stone-600 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white p-1 cursor-pointer"
                title={showPin ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {isVerifying ? (
              <span>যাচাই করা হচ্ছে...</span>
            ) : (
              <>
                <KeyRound className="w-4 h-4 text-emerald-200" />
                <span>লক খুলুন ও প্রবেশ করুন</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
