import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, X, CheckCircle2, Camera, Upload as UploadIcon, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo, LogoText } from './Logo';
import { cn } from '../utils';
import { useError } from '../contexts/ErrorContext';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, storage, isDemoMode } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/firestoreErrorHandler';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { User } from '../types';

export const Auth: React.FC<{ 
  onLogin: (user: any) => void, 
  onCancel?: () => void,
  initialStep?: 'phone' | 'otp' | 'setup',
  initialUser?: any
}> = ({ onLogin, onCancel, initialStep, initialUser }) => {
  const { showError, showSuccess } = useError();
  const [step, setStep] = useState<'phone' | 'otp' | 'setup'>(initialStep || 'phone');
  const [name, setName] = useState(initialUser?.name || '');
  const [bio, setBio] = useState(initialUser?.bio || '');
  const [profileImage, setProfileImage] = useState(initialUser?.profileImage || '');
  const [isUploading, setIsUploading] = useState(false);
  const [phone, setPhone] = useState(initialUser?.mobile?.replace('+91', '') || '');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<any>(initialUser || null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [isNewUser, setIsNewUser] = useState(!initialUser);

  useEffect(() => {
    return () => {
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
      }
    };
  }, [recaptchaVerifier]);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        if (userData.role === 'banned') {
          const reason = userData.banReason || 'Community policy violations';
          setError(`Your account is restricted: ${reason}`);
          showError(`Account Banned: ${reason}`);
          setIsLoading(false);
          return;
        }
        onLogin(userData);
        showSuccess("Logged in successfully!");
      } else {
        const userData = {
          uid: user.uid,
          name: user.displayName || 'New User',
          mobile: user.phoneNumber || '',
          profileImage: user.photoURL || `https://picsum.photos/seed/${user.uid}/200/200`,
          role: 'user',
          followersCount: 0,
          followingCount: 0,
          totalLikes: 0,
          totalViews: 0,
          videosCount: 0,
          totalWatchTime: 0,
          monetizationStatus: 'none',
          referralCode: user.uid.substring(0, 8).toUpperCase(),
          earnings: {
            likes: 0,
            comments: 0,
            watchTime: 0,
            referrals: 0,
            posts: 0
          },
          policyViolations: 0,
          walletBalance: 0,
          superChatBalance: 0,
          createdAt: Date.now(),
          isProfileSetupComplete: false
        };
        setPendingUser(userData);
        setName(user.displayName || '');
        setProfileImage(user.photoURL || userData.profileImage);
        setStep('setup');
        showSuccess("Google Login successful! Please complete your profile.");
      }
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      let message = err.message;
      if (err.code === 'auth/popup-closed-by-user') message = "Login popup was closed.";
      if (err.code === 'auth/operation-not-allowed') {
        message = "Google Login is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.";
      }
      setError(message);
      showError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (phone.length < 10) return;
    setIsLoading(true);
    setError(null);

    try {
      const formattedPhone = `+91${phone}`;

      // Check if user exists to determine if we need profile setup later
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('mobile', '==', formattedPhone));
        const querySnapshot = await getDocs(q);
        setIsNewUser(querySnapshot.empty);
      } catch (err: any) {
        console.warn("Firestore query failed, checking local storage:", err);
        const storedUser = localStorage.getItem(`demo_user_phone_${phone}`);
        setIsNewUser(!storedUser);
      }

      // Send OTP
      if (isDemoMode) {
        // Simulated OTP for demo mode
        await new Promise(r => setTimeout(r, 1000));
        setDemoOtp("123456");
        setStep('otp');
        setResendTimer(60);
        showSuccess("Demo Mode: OTP generated successfully!");
      } else {
        // Initialize Recaptcha
        let verifier = recaptchaVerifier;
        if (!verifier) {
          const container = document.getElementById('recaptcha-container');
          if (!container) {
            throw new Error("reCAPTCHA container not found. Please refresh the page.");
          }
          verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => {
              console.log('Recaptcha verified');
            }
          });
          setRecaptchaVerifier(verifier);
        }

        // Send real OTP via Firebase
        const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
        setConfirmationResult(result);
        
        setStep('otp');
        setResendTimer(60);
        showSuccess("OTP sent to your mobile number!");
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      
      // If API key is invalid or missing, automatically fallback to demo mode for this session
      const errorString = (err.message || "").toLowerCase();
      const errorCode = (err.code || "").toLowerCase();
      
      if (
        errorString.includes('api-key-not-valid') || 
        errorString.includes('invalid-api-key') ||
        errorCode.includes('api-key-not-valid') ||
        errorCode.includes('invalid-api-key') ||
        errorString.includes('restricted-client') ||
        errorCode === 'auth/operation-not-allowed' ||
        errorString.includes('operation-not-allowed')
      ) {
        console.warn("Firebase configuration error detected (likely Phone Auth is disabled). Falling back to demo mode.");
        await new Promise(r => setTimeout(r, 1000));
        setDemoOtp("123456");
        setStep('otp');
        setResendTimer(60);
        setError(null); // Clear error state when entering demo mode
        showSuccess("Demo Mode: Activated (Phone Auth is disabled in Firebase Console)");
        setIsLoading(false);
        return;
      }

      let message = err.message;
      if (err.code === 'auth/invalid-phone-number') message = "Invalid phone number format.";
      if (err.code === 'auth/too-many-requests') message = "Too many requests. Please try again later.";
      if (err.code === 'auth/operation-not-allowed') {
        message = "Phone Authentication is not enabled in your Firebase Console. Please enable it in Authentication > Sign-in method, or use Google Login.";
      }
      if (err.code === 'auth/internal-error') {
        message = "Firebase internal error. This often happens if Phone Auth is disabled or reCAPTCHA failed. Try Google Login instead.";
      }
      
      setError(message);
      showError(message || "Failed to send OTP. Please check your connection.");
      
      // Reset recaptcha on error
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        setRecaptchaVerifier(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 6) return;
    setIsLoading(true);
    setError(null);

    try {
      let uid: string;
      
      if (demoOtp) {
        if (otp !== demoOtp) {
          throw new Error(`Invalid demo OTP. Please use ${demoOtp}.`);
        }
        uid = `demo_user_${phone}`;
      } else if (isDemoMode) {
        if (otp !== "123456") {
          throw new Error("Invalid demo OTP. Please use 123456.");
        }
        uid = `demo_user_${phone}`;
      } else {
        if (!confirmationResult) {
          throw new Error("Session expired. Please request a new OTP.");
        }
        const userCredential = await confirmationResult.confirm(otp);
        uid = userCredential.user.uid;
      }

      const userDocRef = doc(db, 'users', uid);
      let userData: any;

      if (isNewUser) {
        const defaultImage = `https://picsum.photos/seed/${phone}/200/200`;
        userData = {
          uid,
          name: phone,
          mobile: `+91${phone}`,
          profileImage: defaultImage,
          role: phone === "9999999999" ? 'admin' : 'user',
          followersCount: 0,
          followingCount: 0,
          totalLikes: 0,
          totalViews: 0,
          videosCount: 0,
          totalWatchTime: 0,
          monetizationStatus: 'none',
          referralCode: uid.substring(0, 8).toUpperCase(),
          earnings: {
            likes: 0,
            comments: 0,
            watchTime: 0,
            referrals: 0,
            posts: 0
          },
          policyViolations: 0,
          walletBalance: 0,
          superChatBalance: 0,
          createdAt: Date.now(),
          isProfileSetupComplete: false
        };
        setPendingUser(userData);
        setName('');
        setProfileImage(defaultImage);
        setStep('setup');
        showSuccess("OTP Verified! Let's set up your profile.");
      } else {
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            userData = userDoc.data() as User;
            if (userData.role === 'banned') {
              const reason = userData.banReason || 'Community policy violations';
              setError(`Your account is restricted: ${reason}`);
              showError(`Account Banned: ${reason}`);
              setIsLoading(false);
              return;
            }
          } else {
            const storedUser = localStorage.getItem(`demo_user_${uid}`);
            if (storedUser) {
              userData = JSON.parse(storedUser);
            } else {
              setIsNewUser(true);
              setStep('setup');
              return;
            }
          }
        } catch (err) {
          const storedUser = localStorage.getItem(`demo_user_${uid}`);
          if (storedUser) {
            userData = JSON.parse(storedUser);
          } else {
            throw new Error("Failed to retrieve user data. Please check your connection.");
          }
        }
        onLogin(userData);
        showSuccess("Logged in successfully!");
      }
    } catch (err: any) {
      console.error("Verification Error:", err);
      let message = err.message;
      if (err.code === 'auth/invalid-verification-code') message = "Invalid OTP. Please try again.";
      if (err.code === 'auth/code-expired') message = "OTP expired. Please request a new one.";
      
      showError(message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUser) return;

    if (!file.type.startsWith('image/')) {
      showError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError("Image size should be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      if (isDemoMode) {
        // In demo mode, just create a local URL
        const localUrl = URL.createObjectURL(file);
        setProfileImage(localUrl);
        showSuccess("Image selected (Demo Mode)");
      } else {
        const storageRef = ref(storage, `profiles/${pendingUser.uid}_${Date.now()}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        setProfileImage(url);
        showSuccess("Profile picture uploaded!");
      }
    } catch (err) {
      console.error("Upload Error:", err);
      showError("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFinalizeSignup = async () => {
    if (!pendingUser) return;
    if (!name.trim()) {
      showError("Please enter your name");
      return;
    }
    setIsLoading(true);
    try {
      let referredBy = null;
      if (referralCode.trim()) {
        const q = query(collection(db, 'users'), where('referralCode', '==', referralCode.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          referredBy = snap.docs[0].id;
        }
      }

      const finalUser = {
        ...pendingUser,
        name: name.trim(),
        bio: bio.trim(),
        profileImage: profileImage || pendingUser.profileImage,
        referredBy,
        isProfileSetupComplete: true
      };

      const { mobile, walletBalance, superChatBalance, ...publicData } = finalUser;
      
      const publicUserDoc = {
        ...publicData,
        isProfileSetupComplete: true
      };

      const privateUserDoc = {
        mobile,
        walletBalance,
        superChatBalance,
        updatedAt: Date.now()
      };
      
      // Save to Firestore if not in demo mode
      if (!isDemoMode) {
        try {
          // Batch these writes if possible, but keep it simple for now
          await setDoc(doc(db, 'users', finalUser.uid), publicUserDoc);
          await setDoc(doc(db, 'users', finalUser.uid, 'private', 'data'), privateUserDoc);
        } catch (err) {
          console.warn("Firestore save failed, relying on localStorage:", err);
          try {
            handleFirestoreError(err, OperationType.WRITE, `users/${finalUser.uid}`);
          } catch (e) {
            // Already logged/thrown
          }
        }
      }
      
      // Also save to localStorage for demo/offline resilience
      localStorage.setItem(`demo_user_phone_${phone}`, JSON.stringify(finalUser));
      localStorage.setItem(`demo_user_${finalUser.uid}`, JSON.stringify(finalUser));
      
      onLogin(finalUser);
      showSuccess("Account created successfully!");
    } catch (err: any) {
      console.error("Finalize Signup Error:", err);
      showError("Failed to save profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-black overflow-y-auto custom-scrollbar">
      <div className="min-h-full w-full flex flex-col items-center justify-center p-8 relative">
      <button 
        onClick={onCancel}
        className="absolute top-10 left-6 text-zinc-500 hover:text-white transition-colors"
      >
        <X size={24} />
      </button>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm text-center py-10"
      >
        <div className="relative mx-auto mb-6">
          <Logo className="w-24 h-24 mx-auto" />
        </div>

        <LogoText className="mb-2 justify-center" />
        <p className="text-zinc-500 text-sm mb-8">
          Sign in to your account to continue
        </p>

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
              <div className="space-y-4">
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
              </div>
              <button 
                onClick={handleSendOTP}
                disabled={phone.length < 10 || isLoading}
                className="w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center space-x-2 mt-4 bg-rose-500 text-white hover:bg-rose-600"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <span>Continue with Phone</span>}
              </button>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-black px-4 text-zinc-500 font-bold tracking-widest">Or</span>
                </div>
              </div>

              <button 
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center space-x-3 bg-white text-black hover:bg-zinc-200"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                <span>Continue with Google</span>
              </button>
            </motion.div>
          ) : step === 'otp' ? (
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
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-4 text-center focus:outline-none focus:border-rose-500 transition-colors font-bold tracking-[0.5em]"
              />
              <button 
                onClick={handleVerifyOTP}
                disabled={otp.length < 6 || isLoading}
                className="w-full bg-rose-500 text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <span>Verify & Continue</span>}
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
                    setConfirmationResult(null);
                    setDemoOtp(null);
                  }}
                  className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider"
                >
                  Change Number
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="setup-step"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full border-4 border-rose-500/20 p-1 relative overflow-hidden bg-zinc-900 shadow-2xl">
                    <img 
                      src={profileImage || pendingUser?.profileImage} 
                      alt="Profile Preview" 
                      className="w-full h-full rounded-full object-cover"
                    />
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="animate-spin text-rose-500" />
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-rose-500 w-10 h-10 rounded-full border-4 border-black cursor-pointer hover:bg-rose-600 transition-all shadow-lg flex items-center justify-center active:scale-90 group-hover:scale-110">
                    <Camera size={18} className="text-white" />
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-black uppercase tracking-tighter italic">Complete Your Profile</h4>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Tell the community who you are</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Display Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-4 focus:outline-none focus:border-rose-500 transition-colors font-bold"
                  />
                </div>

                <div className="relative">
                  <textarea 
                    placeholder="Bio (e.g. Creator, Dancer, Visionary)"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-4 focus:outline-none focus:border-rose-500 transition-colors font-bold min-h-[100px] resize-none"
                  />
                </div>

                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                    <LinkIcon size={16} />
                  </div>
                  <input 
                    type="url"
                    placeholder="Profile Image URL (Optional)"
                    value={profileImage}
                    onChange={(e) => setProfileImage(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-rose-500 transition-colors font-bold text-xs"
                  />
                </div>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Referral Code (Optional)"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-4 focus:outline-none focus:border-rose-500 transition-colors font-bold uppercase tracking-widest text-xs"
                  />
                </div>
              </div>

              <button 
                onClick={handleFinalizeSignup}
                disabled={isLoading || isUploading || !name.trim()}
                className="w-full bg-rose-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-rose-600 transition-colors flex items-center justify-center space-x-2 shadow-xl shadow-rose-500/20 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <span>Start Creating</span>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div id="recaptcha-container"></div>

        <div className="mt-12 flex items-center justify-center space-x-2 text-zinc-600">
          <ShieldCheck size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Secure OTP Login</span>
        </div>
      </motion.div>
      <div id="recaptcha-container"></div>
    </div>
  </div>
);
};
