import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Lock, ShieldCheck, AlertCircle, X } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AUTHORIZED_ADMIN_EMAIL = 'muhammadeyamin0@gmail.com';

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose }) => {
  const { setCurrentPage, signInAdminWithGoogle } = useStore();
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleGoogleAdminSignIn = async () => {
    setErrorMsg('');
    setIsVerifying(true);
    try {
      const res = await signInAdminWithGoogle();
      if (res.success) {
        onClose();
        setCurrentPage('admin');
      } else {
        setErrorMsg(
          res.message ||
            `অ্যাক্সেস সংরক্ষিত! শুধুমাত্র ভেরিফাইড অ্যাডমিন (${AUTHORIZED_ADMIN_EMAIL}) গুগল অ্যাকাউন্ট দিয়ে প্রবেশ করতে পারবেন।`
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google Admin যাচাই ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity" />
      <div className="relative w-full max-w-md bg-[#111413] text-white rounded-3xl border border-[#223028] shadow-2xl p-6 sm:p-8 space-y-6 animate-fadeIn z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-white rounded-lg cursor-pointer transition-colors"
          aria-label="Close modal"
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
            এই প্যানেলে শুধুমাত্র অনুমোদিত ও ইমেইল-ভেরিফাইড অ্যাডমিন (
            <span className="font-mono text-emerald-400">{AUTHORIZED_ADMIN_EMAIL}</span>) Google
            অ্যাকাউন্টের মাধ্যমে প্রবেশ করতে পারবেন।
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleAdminSignIn}
            disabled={isVerifying}
            className="w-full py-3.5 px-4 bg-white hover:bg-stone-100 text-[#111413] text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isVerifying ? 'যাচাই করা হচ্ছে...' : 'Google Admin দিয়ে সাইন ইন করুন'}</span>
          </button>

          <div className="p-3 bg-[#19221D] border border-[#2B3B32] rounded-xl text-[11px] text-stone-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Firebase Authentication ও Strict Firestore Rules দ্বারা সুরক্ষিত। কোনো পিন বা লোকাল
              পাসওয়ার্ড ব্যবহৃত হয় না।
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
