import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  X,
  Phone,
  Mail,
  Lock,
  User as UserIcon,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalTab,
    setAuthModalTab,
    sendOtp,
    verifyOtp,
    socialLogin,
    registerCustomer,
    loginAsCustomer,
    showToast
  } = useStore();

  // Form states
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [demoOtpCode, setDemoOtpCode] = useState('');

  // Email form
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [referralInput, setReferralInput] = useState('');

  // Forgot password
  const [forgotInput, setForgotInput] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  if (!isAuthModalOpen) return null;

  // Phone OTP Flow
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) {
      showToast('Validation Error', 'Please enter your mobile number.', 'error');
      return;
    }
    const res = sendOtp(phoneInput.trim());
    if (res.success) {
      setIsOtpSent(true);
      if (res.code) setDemoOtpCode(res.code);
    } else {
      showToast('Failed to Send OTP', res.message, 'error');
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const res = verifyOtp(phoneInput.trim(), otpInput.trim());
    if (res.success) {
      setIsOtpSent(false);
      setOtpInput('');
      setPhoneInput('');
    }
  };

  // Email & Password Sign In
  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      showToast('Validation Error', 'Please enter your email or phone.', 'error');
      return;
    }
    loginAsCustomer(emailInput.trim());
  };

  // Register Customer
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !phoneInput.trim() || !emailInput.trim()) {
      showToast('Validation Error', 'Please fill in all required fields.', 'error');
      return;
    }
    const res = registerCustomer({
      name: nameInput.trim(),
      email: emailInput.trim(),
      phone: phoneInput.trim(),
      password: passwordInput,
      referralCode: referralInput.trim() || undefined
    });
    if (res.success) {
      setNameInput('');
      setEmailInput('');
      setPhoneInput('');
      setPasswordInput('');
      setReferralInput('');
    }
  };

  // Forgot Password
  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput.trim()) {
      showToast('Validation Error', 'Please enter your registered phone or email.', 'error');
      return;
    }
    setForgotSubmitted(true);
    showToast('Reset Link Sent', 'Password reset instructions sent via SMS & Email.', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl border border-[#E5E1D5] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E1D5] flex items-center justify-between bg-[#F7F5EF]">
          <div className="flex items-center gap-3">
            <img
              src="/assets/images/vantrel-logo.png"
              alt="VANTREL"
              className="w-10 h-10 object-contain rounded-xl bg-black p-1 shadow-xs border border-stone-300 shrink-0"
            />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF762E]">
                VANTREL ID
              </span>
              <h3 className="font-heading text-lg font-bold text-[#14221C] uppercase tracking-tight">
                Customer Portal
              </h3>
            </div>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="p-2 text-[#202522]/60 hover:text-[#14221C] rounded-xl hover:bg-stone-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#E5E1D5] text-xs font-bold bg-stone-50">
          <button
            onClick={() => {
              setAuthModalTab('otp');
              setIsOtpSent(false);
            }}
            className={`flex-1 py-3 transition-colors ${
              authModalTab === 'otp'
                ? 'border-b-2 border-[#14221C] text-[#14221C] bg-white'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            Phone OTP
          </button>
          <button
            onClick={() => setAuthModalTab('login')}
            className={`flex-1 py-3 transition-colors ${
              authModalTab === 'login'
                ? 'border-b-2 border-[#14221C] text-[#14221C] bg-white'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setAuthModalTab('register')}
            className={`flex-1 py-3 transition-colors ${
              authModalTab === 'register'
                ? 'border-b-2 border-[#14221C] text-[#14221C] bg-white'
                : 'text-[#202522]/60 hover:text-[#14221C]'
            }`}
          >
            Register (+100 Pts)
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* TAB 1: PHONE OTP */}
          {authModalTab === 'otp' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[11px] uppercase tracking-wide">১০০% ভেরিফাইড গ্রাহক অ্যাকাউন্ট</p>
                  <p className="text-[11px] text-[#202522]/80 mt-0.5">
                    আপনার ১১ ডিজিটের বাংলাদেশী মোবাইল নাম্বার দিন। আমরা তাৎক্ষণিক ৬ ডিজিটের সিকিউরিটি কোড পাঠিয়ে সম্পূর্ণ ভেরিফাই করে দেব।
                  </p>
                </div>
              </div>

              {!isOtpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                      আপনার মোবাইল নাম্বার <span className="text-[#FF762E]">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        placeholder="017XXXXXXXX"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                      আপনার সম্পূর্ণ নাম <span className="text-stone-400 font-normal">(ঐচ্ছিক)</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="যেমন: তানভীর আহমেদ"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <span>ওটিপি কোড পাঠান (Send OTP)</span>
                    <ArrowRight className="w-4 h-4 text-[#FF762E]" />
                  </button>
                </form>
              ) : (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const res = verifyOtp(phoneInput.trim(), otpInput.trim(), nameInput.trim() || undefined);
                  if (res.success) {
                    setIsOtpSent(false);
                    setOtpInput('');
                    setPhoneInput('');
                    setNameInput('');
                  }
                }} className="space-y-3 animate-fadeIn">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span>৬ ডিজিটের ওটিপি পাঠানো হয়েছে: <strong>{phoneInput}</strong></span>
                      {demoOtpCode && (
                        <div className="mt-1 font-mono font-bold text-xs">
                          সিমুলেশন ওটিপি কোড: <span className="bg-emerald-200 px-2 py-0.5 rounded text-emerald-950 font-mono tracking-widest">{demoOtpCode}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-[#14221C]">
                        ৬ ডিজিটের সিকিউরিটি কোড দিন
                      </label>
                      {demoOtpCode && (
                        <button
                          type="button"
                          onClick={() => setOtpInput(demoOtpCode)}
                          className="text-[10px] text-[#FF762E] font-bold hover:underline"
                        >
                          কোডটি অটো-ফিল করুন
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 849201"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      className="w-full px-4 py-2.5 text-center tracking-widest text-lg font-mono font-bold bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#FF762E]" />
                    <span>ভেরিফাই ও সাইন ইন সম্পন্ন করুন</span>
                  </button>

                  <div className="flex items-center justify-between text-[11px] text-[#202522]/60 px-1 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsOtpSent(false)}
                      className="hover:text-[#14221C] underline cursor-pointer"
                    >
                      নাম্বার পরিবর্তন করুন
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const res = sendOtp(phoneInput.trim());
                        if (res.code) setDemoOtpCode(res.code);
                      }}
                      className="hover:text-[#14221C] text-[#FF762E] font-semibold cursor-pointer"
                    >
                      পুনরায় কোড পাঠান (Resend)
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: EMAIL LOGIN */}
          {authModalTab === 'login' && (
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                  Email or Mobile Number
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="user@example.com or 017XXXXXXXX"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-[#14221C]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setAuthModalTab('forgot')}
                    className="text-[10px] text-[#FF762E] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm"
              >
                Sign In
              </button>
            </form>
          )}

          {/* TAB 3: REGISTER */}
          {authModalTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="e.g. Tanvir Ahmed"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="017XXXXXXXX"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@domain.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                  Create Password
                </label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#14221C] mb-1">
                  Referral Code <span className="text-[#202522]/50 font-normal">(Optional bonus)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. VT-REF-YEAMIN"
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl uppercase font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm"
              >
                Create VANTREL Account
              </button>
            </form>
          )}

          {/* TAB 4: FORGOT PASSWORD */}
          {authModalTab === 'forgot' && (
            <div className="space-y-4">
              <div className="text-xs text-[#202522]/70 leading-relaxed">
                Provide your registered mobile number or email. We will dispatch an OTP reset link.
              </div>

              {!forgotSubmitted ? (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#14221C] mb-1">
                      Registered Phone or Email
                    </label>
                    <input
                      type="text"
                      placeholder="017XXXXXXXX or you@example.com"
                      value={forgotInput}
                      onChange={(e) => setForgotInput(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs bg-[#F7F5EF] border border-[#E5E1D5] rounded-xl focus:outline-none focus:border-[#14221C]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#14221C] hover:bg-[#202522] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors"
                  >
                    Send Recovery Code
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setAuthModalTab('login')}
                      className="text-[11px] text-[#202522]/60 hover:text-[#14221C] underline"
                    >
                      Back to sign in
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-800">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Instructions Dispatched</span>
                  </div>
                  <p className="text-[11px] text-[#202522]/70">
                    A secure reset link has been dispatched to <strong>{forgotInput}</strong>. Please check your SMS and email inbox.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotSubmitted(false);
                      setAuthModalTab('login');
                    }}
                    className="mt-2 w-full py-2 bg-white border border-[#E5E1D5] text-xs font-bold text-[#14221C] rounded-lg"
                  >
                    Return to Login
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Social Logins Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E1D5]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold text-[#202522]/50 tracking-wider">
              <span className="bg-white px-3">Or Connect With</span>
            </div>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => socialLogin('google')}
              className="py-2.5 px-3 border border-[#E5E1D5] hover:border-stone-400 bg-white rounded-xl font-semibold text-[#14221C] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <span>Google</span>
            </button>

            <button
              onClick={() => socialLogin('facebook')}
              className="py-2.5 px-3 border border-[#E5E1D5] hover:border-stone-400 bg-white rounded-xl font-semibold text-[#14221C] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Facebook</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
