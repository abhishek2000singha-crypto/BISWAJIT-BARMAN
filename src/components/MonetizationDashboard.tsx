import React from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, Users, Eye, ShieldAlert, CheckCircle2, ArrowRight, Trophy, AlertTriangle, Building, CreditCard, Landmark, Loader2, Grid } from 'lucide-react';
import { User } from '../types';
import { doc, updateDoc, collection, addDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../services/firebase';

interface MonetizationDashboardProps {
  user: User;
  videosCount: number;
  onApply: () => void;
  onClose: () => void;
}

export const MonetizationDashboard: React.FC<MonetizationDashboardProps> = ({ user, videosCount, onApply, onClose }) => {
  const [showWithdrawForm, setShowWithdrawForm] = React.useState(false);
  const [withdrawAmount, setWithdrawAmount] = React.useState('');
  const [bankDetails, setBankDetails] = React.useState({
    bankName: user.bankName || '',
    accountNumber: user.bankAccountNumber || '',
    ifsc: user.ifscCode || '',
    accountHolderName: user.accountHolderName || '',
    payoutType: user.payoutType || 'domestic',
    swiftCode: user.swiftCode || '',
    iban: user.iban || '',
    paypalEmail: user.paypalEmail || '',
    country: user.country || ''
  });
  const [isWithdrawing, setIsWithdrawing] = React.useState(false);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0 || amount > (user.walletBalance || 0)) {
      alert("Invalid withdrawal amount");
      return;
    }
    if (bankDetails.payoutType === 'domestic') {
      if (!bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.ifsc || !bankDetails.accountHolderName) {
        alert("Please fill all bank details");
        return;
      }
    } else {
      if (!bankDetails.iban || !bankDetails.swiftCode || !bankDetails.country) {
        alert("Please fill IBAN, SWIFT and Country");
        return;
      }
    }

    setIsWithdrawing(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Create withdrawal request
      const requestRef = doc(collection(db, 'withdrawal_requests'));
      batch.set(requestRef, {
        userId: user.uid,
        userName: user.name,
        amount: amount,
        bankDetails: bankDetails,
        status: 'pending',
        createdAt: Date.now()
      });

      // 2. Deduct from wallet balance
      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, {
        walletBalance: increment(-amount)
      });

      // 3. Record transaction
      const txRef = doc(collection(db, 'transactions'));
      batch.set(txRef, {
        userId: user.uid,
        type: 'withdrawal',
        amount: amount,
        description: `Withdrawal Request (${bankDetails.payoutType})`,
        status: 'pending',
        source: 'wallet_topup',
        createdAt: Date.now()
      });

      await batch.commit();

      alert(`Withdrawal request of ₹${amount} submitted successfully!`);
      setShowWithdrawForm(false);
      setWithdrawAmount('');
    } catch (error) {
      console.error(error);
      alert("Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const criteria = [
    {
      label: 'Followers',
      current: user.followersCount || 0,
      target: 300,
      icon: <Users size={20} />,
      isMet: (user.followersCount || 0) >= 300
    },
    {
      label: 'Total Views',
      current: user.totalViews || 0,
      target: 10000,
      icon: <Eye size={20} />,
      isMet: (user.totalViews || 0) >= 10000
    },
    {
      label: 'Posts Uploaded',
      current: videosCount,
      target: 50,
      icon: <Grid size={20} />,
      isMet: videosCount >= 50
    },
    {
      label: 'Policy Violations',
      current: user.policyViolations || 0,
      target: 0,
      icon: <ShieldAlert size={20} />,
      isMet: (user.policyViolations || 0) === 0,
      isReverse: true
    }
  ];

  const isEligible = criteria.every(c => c.isMet);

  const revenueBreakdown = [
    { views: '1,000', amount: '0.50' },
    { views: '10,000', amount: '10' },
    { views: '50,000', amount: '50' },
    { views: '100,000', amount: '100' },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center">
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
        
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
            <IndianRupee size={28} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Creator Fund</h3>
            <p className="text-zinc-500 text-sm">Monetize your creativity</p>
          </div>
        </div>

        {user.monetizationStatus === 'approved' ? (
          <div className="space-y-6 mb-8">
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-3xl text-center">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <h4 className="text-xl font-bold text-white mb-1">You're a Partner!</h4>
              <p className="text-emerald-200/70 text-xs mb-6">Revenue Share: 70% Creator / 30% Platform</p>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Your Share</p>
                  <p className="text-xl font-black text-emerald-500">70%</p>
                </div>
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Platform</p>
                  <p className="text-xl font-black text-zinc-400">30%</p>
                </div>
              </div>

              <div className="bg-black/40 rounded-2xl p-4 text-center border border-emerald-500/10 mb-4">
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Available Balance</p>
                <p className="text-3xl font-black text-white">₹{(user.walletBalance || 0).toLocaleString()}</p>
              </div>

              {/* Revenue Breakdown */}
              <div className="mb-6 text-left">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Earnings Guide</p>
                <div className="grid grid-cols-2 gap-2">
                  {revenueBreakdown.map((item, idx) => (
                    <div key={idx} className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Eye size={12} className="text-zinc-500" />
                        <span className="text-xs text-zinc-300 font-bold">{item.views}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-emerald-500 font-black text-xs">
                        <IndianRupee size={10} />
                        <span>{item.amount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!showWithdrawForm ? (
                <button 
                  onClick={() => setShowWithdrawForm(true)}
                  disabled={(user.walletBalance || 0) < 100}
                  className="w-full bg-white text-black py-3 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {(user.walletBalance || 0) < 100 ? 'Min. ₹100 required' : 'Withdraw to Bank'}
                </button>
              ) : (
                <div className="space-y-3 text-left animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 mb-2">
                      <button 
                        onClick={() => setBankDetails({...bankDetails, payoutType: 'domestic'})}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          bankDetails.payoutType === 'domestic' ? 'bg-emerald-500 text-white' : 'text-zinc-500'
                        }`}
                      >
                        Domestic
                      </button>
                      <button 
                        onClick={() => setBankDetails({...bankDetails, payoutType: 'international'})}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          bankDetails.payoutType === 'international' ? 'bg-emerald-500 text-white' : 'text-zinc-500'
                        }`}
                      >
                        International
                      </button>
                    </div>

                    <input 
                      type="number"
                      placeholder="Amount to Withdraw"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                    />

                    {bankDetails.payoutType === 'domestic' ? (
                      <>
                        <input 
                          type="text"
                          placeholder="Account Holder Name"
                          value={bankDetails.accountHolderName}
                          onChange={(e) => setBankDetails({...bankDetails, accountHolderName: e.target.value})}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <input 
                          type="text"
                          placeholder="Bank Name"
                          value={bankDetails.bankName}
                          onChange={(e) => setBankDetails({...bankDetails, bankName: e.target.value})}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <input 
                          type="text"
                          placeholder="Account Number"
                          value={bankDetails.accountNumber}
                          onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <input 
                          type="text"
                          placeholder="IFSC Code"
                          value={bankDetails.ifsc}
                          onChange={(e) => setBankDetails({...bankDetails, ifsc: e.target.value.toUpperCase()})}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      </>
                    ) : (
                      <>
                        <input 
                          type="email"
                          placeholder="PayPal Email (Optional)"
                          value={bankDetails.paypalEmail}
                          onChange={(e) => setBankDetails({...bankDetails, paypalEmail: e.target.value})}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <input 
                          type="text"
                          placeholder="IBAN / International A/C"
                          value={bankDetails.iban}
                          onChange={(e) => setBankDetails({...bankDetails, iban: e.target.value})}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="text"
                            placeholder="SWIFT / BIC"
                            value={bankDetails.swiftCode}
                            onChange={(e) => setBankDetails({...bankDetails, swiftCode: e.target.value.toUpperCase()})}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                          />
                          <input 
                            type="text"
                            placeholder="Country"
                            value={bankDetails.country}
                            onChange={(e) => setBankDetails({...bankDetails, country: e.target.value})}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button 
                      onClick={handleWithdraw}
                      disabled={isWithdrawing || !withdrawAmount}
                      className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2"
                    >
                      {isWithdrawing ? <Loader2 className="animate-spin" size={16} /> : <span>Confirm</span>}
                    </button>
                    <button 
                      onClick={() => setShowWithdrawForm(false)}
                      className="flex-1 bg-zinc-800 text-white py-3 rounded-xl font-bold text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : user.monetizationStatus === 'pending' ? (
          <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-3xl text-center mb-8">
            <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
              <Trophy size={32} className="text-white" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Application Pending</h4>
            <p className="text-amber-200/70 text-sm">We're reviewing your profile. This usually takes 2-3 business days.</p>
          </div>
        ) : (
          <div className="space-y-4 mb-8">
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Eligibility Criteria</h4>
            {criteria.map((item, idx) => (
              <div key={idx} className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-2.5 rounded-xl ${item.isMet ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="text-xs text-zinc-500">
                      {item.isReverse ? (item.isMet ? 'No violations' : `${item.current} violations`) : `${item.current.toLocaleString()} / ${item.target.toLocaleString()}`}
                    </p>
                  </div>
                </div>
                {item.isMet ? (
                  <CheckCircle2 size={20} className="text-emerald-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-zinc-800" />
                )}
              </div>
            ))}

            {/* Revenue Breakdown for non-partners too */}
            <div className="mt-6">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Potential Earnings</p>
              <div className="grid grid-cols-2 gap-2">
                {revenueBreakdown.map((item, idx) => (
                  <div key={idx} className="bg-zinc-900/50 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Eye size={12} className="text-zinc-500" />
                      <span className="text-xs text-zinc-300 font-bold">{item.views}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-emerald-500 font-black text-xs">
                      <IndianRupee size={10} />
                      <span>{item.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {user.monetizationStatus === 'none' && (
          <button 
            disabled={!isEligible}
            onClick={onApply}
            className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center space-x-3 transition-all ${
              isEligible 
                ? 'bg-white text-black hover:scale-[1.02] active:scale-[0.98]' 
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <span>{isEligible ? 'Apply for Monetization' : 'Not Yet Eligible'}</span>
            <ArrowRight size={20} />
          </button>
        )}

        {!isEligible && user.monetizationStatus === 'none' && (
          <div className="mt-6 flex items-start space-x-3 p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
            <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-200/60 leading-relaxed">
              You need to meet all requirements above to join the REELS KING Creator Fund and start earning from your videos.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
