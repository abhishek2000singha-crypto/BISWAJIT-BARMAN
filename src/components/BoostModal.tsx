import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, IndianRupee, Loader2, CreditCard, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { doc, updateDoc, increment, addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, Video, BOOST_PLANS, BoostPlan } from '../types';
import confetti from 'canvas-confetti';

interface BoostModalProps {
  currentUser: User;
  video: Video;
  onClose: () => void;
}

export const BoostModal: React.FC<BoostModalProps> = ({ currentUser, video, onClose }) => {
  const [selectedPlan, setSelectedPlan] = useState<BoostPlan>(BOOST_PLANS[0]);
  const [isLoading, setIsLoading] = useState(false);

  const handleBoost = async () => {
    setIsLoading(true);
    try {
      // In a real app, we would call Razorpay here.
      // For this implementation, we'll simulate a successful payment.
      
      const isOwnVideo = currentUser.uid === video.userId;
      const boostAmount = selectedPlan.price;
      const creatorShare = isOwnVideo ? 0 : boostAmount * 0.5; // Creator gets 50% if someone else boosts
      const platformFee = boostAmount - creatorShare;

      // 1. Record boost transaction
      await addDoc(collection(db, 'boost_transactions'), {
        userId: currentUser.uid,
        videoId: video.id,
        videoCaption: video.caption || 'Video',
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: boostAmount,
        creatorShare: creatorShare,
        platformFee: platformFee,
        status: 'success',
        createdAt: Date.now(),
        expiryAt: Date.now() + (selectedPlan.durationDays * 86400000)
      });

      // 2. Update video status
      const videoRef = doc(db, 'videos', video.id);
      await updateDoc(videoRef, {
        boosted: true,
        boostExpiry: Date.now() + (selectedPlan.durationDays * 86400000)
      });

      // 3. If someone else boosted, give share to creator
      if (!isOwnVideo) {
        const creatorRef = doc(db, 'users', video.userId);
        await updateDoc(creatorRef, {
          walletBalance: increment(creatorShare)
        });

        // Record earning transaction for creator
        await addDoc(collection(db, 'transactions'), {
          userId: video.userId,
          type: 'earning',
          amount: creatorShare,
          description: `Boost Share from ${currentUser.name}'s boost on your video`,
          status: 'completed',
          source: 'boost_share',
          createdAt: Date.now()
        });
      }

      // Record spending transaction for booster (if we want to track all wallet movements)
      // But boosts are usually paid via external gateway, not wallet balance here.
      // If we want to allow boosting from wallet, we'd check balance.
      // For now, assume external payment.

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });

      alert(`Video Boosted Successfully! ${!isOwnVideo ? `The creator has earned ₹${creatorShare} as a boost share.` : ''}`);
      onClose();
    } catch (error) {
      console.error("Boost failed:", error);
      alert("Failed to boost video");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
      />
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative w-full max-w-md bg-zinc-950 rounded-t-[40px] p-8 pb-12 border-t border-white/10 shadow-2xl"
      >
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8" />
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center border border-rose-500/30">
              <Rocket size={24} className="text-rose-500" />
            </div>
            <div>
              <h3 className="text-xl font-black">Boost Reel</h3>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Get more views & engagement</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3">
            {BOOST_PLANS.map(plan => (
              <button 
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className={`p-5 rounded-3xl border-2 transition-all text-left relative overflow-hidden group flex items-center justify-between ${
                  selectedPlan.id === plan.id 
                    ? 'border-rose-500 bg-rose-500/10' 
                    : 'border-white/5 bg-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedPlan.id === plan.id ? 'bg-rose-500 text-white' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    <Rocket size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">{plan.name}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{plan.durationDays} Days Duration</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-white">₹{plan.price}</p>
                  {selectedPlan.id === plan.id && (
                    <div className="flex items-center justify-end text-rose-500">
                      <CheckCircle2 size={14} />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl flex items-start space-x-3">
            <Sparkles size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
              Boosting increases video visibility in the main feed and discovery sections. {currentUser.uid !== video.userId && "As a supporter, 50% of your boost amount will be shared with the creator."}
            </p>
          </div>

          <button 
            onClick={handleBoost}
            disabled={isLoading}
            className="w-full bg-white text-black py-5 rounded-2xl font-black text-lg flex items-center justify-center space-x-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-white/5"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : (
              <>
                <span>Pay ₹{selectedPlan.price} to Boost</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
