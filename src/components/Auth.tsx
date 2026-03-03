import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo, LogoText } from './Logo';

export const Auth: React.FC<{ onLogin: (user: any) => void, onCancel?: () => void }> = ({ onLogin, onCancel }) => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSendOTP = async () => {
    if (phone.length < 10) return;
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise(r => setTimeout(r, 1000));
      setDemoOtp("1234");
      setStep('otp');
      setResendTimer(60);
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 4) return;
    setIsLoading(true);
    setError(null);

    try {
      // In demo mode, we just check against "1234"
      if (otp === "1234") {
        const isAdmin = phone === "9999999999";
        onLogin({
          uid: `user_${phone}`,
          name: isAdmin ? "Admin" : `User_${phone.slice(-4)}`,
          mobile: `+91${phone}`,
          profileImage: isAdmin ? "https://picsum.photos/seed/admin/200/200" : `https://picsum.photos/seed/${phone}/200/200`,
          role: isAdmin ? 'admin' : 'user',
          walletBalance: 0,
          superChatBalance: 0,
          createdAt: Date.now()
        });
      } else {
        throw new Error("Invalid OTP. Please try again.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-black flex flex-col items-center justify-center p-8 relative">
      <button 
        onClick={onCancel}
        className="absolute top-10 left-6 text-zinc-500 hover:text-white transition-colors"
      >
        <X size={24} />
      </button>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xs text-center"
      >
        <div className="relative mx-auto mb-6">
          <Logo className="w-24 h-24 mx-auto" />
        </div>

        <LogoText className="mb-2 justify-center" />
        <p className="text-zinc-500 text-sm mb-10">India's premier short video platform for creators.</p>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/50 rounded-xl flex items-start space-x-2 text-left">
            <AlertCircle className="text-rose-500 shrink-0" size={16} />
            <p className="text-rose-200 text-xs">{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'phone' ? (
            <motion.div 
              key="phone-step"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="space-y-4"
            >
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">+91</span>
                <input 
                  type="tel"
                  autoFocus
                  placeholder="Mobile Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-14 pr-4 focus:outline-none focus:border-rose-500 transition-colors font-bold tracking-widest"
                />
              </div>
              <button 
                onClick={handleSendOTP}
                disabled={phone.length < 10 || isLoading}
                className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <span>Send OTP</span>}
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="otp-step"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="space-y-4"
            >
              {demoOtp && (
                <div className="bg-emerald-500/10 border border-emerald-500/50 p-3 rounded-xl flex items-center justify-center space-x-2 mb-2">
                  <CheckCircle2 className="text-emerald-500" size={16} />
                  <span className="text-emerald-500 font-bold text-xs uppercase tracking-wider">Demo Mode: Use OTP {demoOtp}</span>
                </div>
              )}

              <input 
                type="text"
                autoFocus
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-4 text-center focus:outline-none focus:border-rose-500 transition-colors font-bold tracking-[1em]"
              />
              <button 
                onClick={handleVerifyOTP}
                disabled={otp.length < 4 || isLoading}
                className="w-full bg-rose-500 text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <span>Verify & Login</span>}
              </button>
              
              <div className="flex flex-col space-y-3">
                {resendTimer > 0 ? (
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                    Resend OTP in {resendTimer}s
                  </p>
                ) : (
                  <button 
                    onClick={handleSendOTP}
                    className="text-rose-500 text-[10px] font-bold uppercase tracking-wider hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
                <button 
                  onClick={() => {
                    setStep('phone');
                    setError(null);
                    setDemoOtp(null);
                  }}
                  className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider"
                >
                  Change Number
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-12 flex items-center justify-center space-x-2 text-zinc-600">
          <ShieldCheck size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Secure OTP Login</span>
        </div>
      </motion.div>
    </div>
  );
};
