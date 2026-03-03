import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, IndianRupee, Send, Loader2, CreditCard, Wallet, Sparkles, ArrowRight } from 'lucide-react';
import { doc, updateDoc, increment, addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User } from '../types';

interface SuperChatModalProps {
  currentUser: User;
  targetUser?: User; // If provided, we are gifting. If not, we are buying for ourselves.
  videoId?: string; // Optional: link gift to a specific video
  onClose: () => void;
}

const SUPER_CHAT_PACKS = [
  { id: 'pack_1', amount: 100, price: 100, label: 'Starter Pack' },
  { id: 'pack_2', amount: 500, price: 500, label: 'Popular Pack' },
  { id: 'pack_3', amount: 1000, price: 1000, label: 'Pro Pack' },
  { id: 'pack_4', amount: 5000, price: 5000, label: 'Whale Pack' },
];

const GIFT_AMOUNTS = [20, 50, 100, 200, 500, 1000];

export const SuperChatModal: React.FC<SuperChatModalProps> = ({ currentUser, targetUser, videoId, onClose }) => {
  const [mode, setMode] = useState<'buy' | 'gift'>(targetUser ? 'gift' : 'buy');
  const [selectedPack, setSelectedPack] = useState(SUPER_CHAT_PACKS[0]);
  const [giftAmount, setGiftAmount] = useState(GIFT_AMOUNTS[0]);
  const [giftMessage, setGiftMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleBuyCredits = async () => {
    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        superChatBalance: increment(selectedPack.amount)
      });
      alert(`Successfully added ₹${selectedPack.amount} to your Super Chat Wallet!`);
      onClose();
    } catch (error) {
      console.error(error);
      alert("Purchase failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendGift = async () => {
    if (!targetUser) return;
    if (currentUser.superChatBalance < giftAmount) {
      alert("Insufficient Super Chat balance. Please buy more credits.");
      setMode('buy');
      return;
    }

    setIsLoading(true);
    try {
      const senderRef = doc(db, 'users', currentUser.uid);
      const receiverRef = doc(db, 'users', targetUser.uid);

      // 1. Deduct from sender
      await updateDoc(senderRef, {
        superChatBalance: increment(-giftAmount)
      });

      // 2. Add to receiver's wallet (earnings)
      await updateDoc(receiverRef, {
        walletBalance: increment(giftAmount)
      });

      // 3. Record transaction
      await addDoc(collection(db, 'super_chats'), {
        senderId: currentUser.uid,
        senderName: currentUser.name,
        receiverId: targetUser.uid,
        receiverName: targetUser.name,
        videoId: videoId || null,
        amount: giftAmount,
        message: giftMessage,
        createdAt: Date.now()
      });

      alert(`Successfully sent ₹${giftAmount} Super Chat to ${targetUser.name}!`);
      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to send Super Chat");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center">
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
        className="relative w-full max-w-md bg-zinc-950 rounded-t-[32px] p-8 pb-12 border-t border-white/10 shadow-2xl"
      >
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8" />
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center border border-amber-500/30">
              <Sparkles size={24} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Super Chat</h3>
              <p className="text-zinc-500 text-xs">Support your favorite creators</p>
            </div>
          </div>
          <div className="bg-zinc-900 px-4 py-2 rounded-2xl border border-white/5">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Your Wallet</p>
            <div className="flex items-center space-x-1 text-amber-500 font-black">
              <IndianRupee size={12} />
              <span>{currentUser.superChatBalance || 0}</span>
            </div>
          </div>
        </div>

        {targetUser && (
          <div className="flex bg-zinc-900 p-1 rounded-2xl mb-8">
            <button 
              onClick={() => setMode('gift')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${mode === 'gift' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}
            >
              Send Gift
            </button>
            <button 
              onClick={() => setMode('buy')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${mode === 'buy' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}
            >
              Add Credits
            </button>
          </div>
        )}

        {mode === 'buy' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {SUPER_CHAT_PACKS.map(pack => (
                <button 
                  key={pack.id}
                  onClick={() => setSelectedPack(pack)}
                  className={`p-4 rounded-3xl border-2 transition-all text-left relative overflow-hidden group ${
                    selectedPack.id === pack.id 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : 'border-white/5 bg-white/5 hover:border-white/10'
                  }`}
                >
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{pack.label}</p>
                  <div className="flex items-center space-x-1 text-xl font-black text-white">
                    <IndianRupee size={16} className="text-amber-500" />
                    <span>{pack.amount}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-400">₹{pack.price}</span>
                    <CreditCard size={14} className="text-zinc-600 group-hover:text-amber-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>

            <button 
              onClick={handleBuyCredits}
              disabled={isLoading}
              className="w-full bg-white text-black py-5 rounded-2xl font-black text-lg flex items-center justify-center space-x-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : (
                <>
                  <span>Buy Credits</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center space-x-4 p-4 bg-zinc-900 rounded-3xl border border-white/5">
              <img src={targetUser?.profileImage} className="w-12 h-12 rounded-full object-cover border-2 border-amber-500/30" />
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Sending to</p>
                <p className="text-lg font-bold text-white">@{targetUser?.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {GIFT_AMOUNTS.map(amount => (
                <button 
                  key={amount}
                  onClick={() => setGiftAmount(amount)}
                  className={`py-4 rounded-2xl border-2 font-black transition-all flex items-center justify-center space-x-1 ${
                    giftAmount === amount 
                      ? 'border-amber-500 bg-amber-500/10 text-amber-500' 
                      : 'border-white/5 bg-white/5 text-zinc-400 hover:border-white/10'
                  }`}
                >
                  <IndianRupee size={14} />
                  <span>{amount}</span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Message (Optional)</label>
              <textarea 
                placeholder="Write a supportive message..."
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors min-h-[100px] resize-none"
              />
            </div>

            <button 
              onClick={handleSendGift}
              disabled={isLoading || !giftAmount}
              className="w-full bg-amber-500 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center space-x-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : (
                <>
                  <Gift size={20} />
                  <span>Send Super Chat</span>
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
