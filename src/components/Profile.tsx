import React, { useState, useEffect } from 'react';
import { User, Grid, Heart, Settings, Wallet, Rocket, CheckCircle2, IndianRupee, Eye, MessageCircle, Share2, LayoutDashboard, Camera, Edit3, Loader2, LogOut, ChevronLeft, Sparkles, Gift, Clock, AlertCircle, X, Landmark, Lock, Upload as UploadIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BOOST_PLANS, BoostPlan, User as UserType, BoostTransaction, Video as VideoType, Transaction as WalletTransaction, WithdrawalRequest } from '../types';
import { Logo } from './Logo';
import { VideoCard } from './VideoCard';
import { MonetizationDashboard } from './MonetizationDashboard';
import { SuperChatModal } from './SuperChatModal';
import { BoostModal } from './BoostModal';
import confetti from 'canvas-confetti';
import { doc, updateDoc, collection, addDoc, query, where, orderBy, onSnapshot, getDoc, writeBatch, increment, getDocs } from 'firebase/firestore';
import { db, isDemoMode } from '../services/firebase';
import { format } from 'date-fns';
import { formatNumber, cn } from '../utils';
import { useError } from '../contexts/ErrorContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export const Profile: React.FC<{ 
  user: UserType, 
  onLogout: () => void, 
  viewingUserId?: string, 
  onBack?: () => void,
  onNavigate?: (uid: string) => void,
  onMessageClick?: (uid: string) => void,
  onUploadClick?: () => void
}> = ({ user: currentUser, onLogout, viewingUserId, onBack, onNavigate, onMessageClick, onUploadClick }) => {
  const { showError, showSuccess } = useError();
  const isOwnProfile = !viewingUserId || viewingUserId === currentUser.uid;
  const [user, setUser] = useState<UserType | null>(isOwnProfile ? currentUser : null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  
  const canSeeContent = isOwnProfile || !user?.isPrivate || isFollowing;
  
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showMonetizationModal, setShowMonetizationModal] = useState(false);
  const [showSuperChatModal, setShowSuperChatModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'likes' | 'history' | 'dashboard' | 'wallet'>('videos');
  const [transactions, setTransactions] = useState<BoostTransaction[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [superChats, setSuperChats] = useState<any[]>([]);
  const [followers, setFollowers] = useState<UserType[]>([]);
  const [following, setFollowing] = useState<UserType[]>([]);
  const [isFollowersLoading, setIsFollowersLoading] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [userVideos, setUserVideos] = useState<VideoType[]>([]);
  const [likedVideos, setLikedVideos] = useState<VideoType[]>([]);
  const [isLikedVideosLoading, setIsLikedVideosLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoType | null>(null);
  const [videoToBoost, setVideoToBoost] = useState<VideoType | null>(null);
  
  const totalComments = userVideos.reduce((acc, vid) => acc + (vid.commentsCount || 0), 0);
  const estimatedEarnings = ((user?.totalLikes || 0) / 100 * 20) + (totalComments / 100 * 25);
  
  const [editName, setEditName] = useState(currentUser.name);
  const [editImage, setEditImage] = useState(currentUser.profileImage);
  const [editBankAcc, setEditBankAcc] = useState(currentUser.bankAccountNumber || '');
  const [editIFSC, setEditIFSC] = useState(currentUser.ifscCode || '');
  const [editHolderName, setEditHolderName] = useState(currentUser.accountHolderName || '');
  const [editBankName, setEditBankName] = useState(currentUser.bankName || '');
  const [editPayoutType, setEditPayoutType] = useState<'domestic' | 'international'>(currentUser.payoutType || 'domestic');
  const [editSwift, setEditSwift] = useState(currentUser.swiftCode || '');
  const [editIban, setEditIban] = useState(currentUser.iban || '');
  const [editPaypal, setEditPaypal] = useState(currentUser.paypalEmail || '');
  const [editCountry, setEditCountry] = useState(currentUser.country || '');
  const [editIsPrivate, setEditIsPrivate] = useState(currentUser.isPrivate || false);
  const [editBio, setEditBio] = useState(currentUser.bio || '');
  const [editWebsite, setEditWebsite] = useState(currentUser.website || '');
  const [editInstagram, setEditInstagram] = useState(currentUser.socialLinks?.instagram || '');
  const [editTwitter, setEditTwitter] = useState(currentUser.socialLinks?.twitter || '');
  const [editYoutube, setEditYoutube] = useState(currentUser.socialLinks?.youtube || '');
  const [showSuperChat, setShowSuperChat] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const chartData = [
    { name: 'Mon', views: Math.floor((user?.totalViews || 0) * 0.08) },
    { name: 'Tue', views: Math.floor((user?.totalViews || 0) * 0.12) },
    { name: 'Wed', views: Math.floor((user?.totalViews || 0) * 0.15) },
    { name: 'Thu', views: Math.floor((user?.totalViews || 0) * 0.1) },
    { name: 'Fri', views: Math.floor((user?.totalViews || 0) * 0.18) },
    { name: 'Sat', views: Math.floor((user?.totalViews || 0) * 0.22) },
    { name: 'Sun', views: Math.floor((user?.totalViews || 0) * 0.25) },
  ];

  // Sync user state with currentUser prop if it's our own profile
  useEffect(() => {
    if (isOwnProfile) {
      setUser(currentUser);
    }
  }, [currentUser, isOwnProfile]);

  useEffect(() => {
    if (!isOwnProfile && viewingUserId) {
      const unsub = onSnapshot(doc(db, 'users', viewingUserId), (doc) => {
        if (doc.exists()) {
          setUser({ ...doc.data(), uid: doc.id } as UserType);
        }
      });

      const followId = `${currentUser.uid}_${viewingUserId}`;
      const unsubFollow = onSnapshot(doc(db, 'follows', followId), (doc) => {
        setIsFollowing(doc.exists());
      });

      return () => {
        unsub();
        unsubFollow();
      };
    }
  }, [viewingUserId, currentUser.uid, isOwnProfile]);

  // Only update edit fields when the user UID changes (to avoid resetting while typing)
  const lastUid = React.useRef<string | null>(null);
  useEffect(() => {
    if (user && user.uid !== lastUid.current) {
      setEditName(user.name);
      setEditImage(user.profileImage);
      setEditBankAcc(user.bankAccountNumber || '');
      setEditIFSC(user.ifscCode || '');
      setEditHolderName(user.accountHolderName || '');
      setEditBankName(user.bankName || '');
      setEditPayoutType(user.payoutType || 'domestic');
      setEditSwift(user.swiftCode || '');
      setEditIban(user.iban || '');
      setEditPaypal(user.paypalEmail || '');
      setEditCountry(user.country || '');
      setEditIsPrivate(user.isPrivate || false);
      setEditBio(user.bio || '');
      setEditWebsite(user.website || '');
      setEditInstagram(user.socialLinks?.instagram || '');
      setEditTwitter(user.socialLinks?.twitter || '');
      setEditYoutube(user.socialLinks?.youtube || '');
      lastUid.current = user.uid;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'boost_transactions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BoostTransaction));
      setTransactions(txs);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'super_chats'),
      where('receiverId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setSuperChats(chats);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'videos'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vids = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as VideoType));
      const filteredVids = vids.filter(v => v.status !== 'processing');
      setUserVideos(filteredVids);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (showFollowersModal && user) {
      setIsFollowersLoading(true);
      const q = query(
        collection(db, 'follows'),
        where('followingId', '==', user.uid)
      );
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const followerIds = Array.from(new Set(snapshot.docs.map(doc => doc.data().followerId)));
        if (followerIds.length === 0) {
          setFollowers([]);
          setIsFollowersLoading(false);
          return;
        }

        try {
          const fetchedUsers = await Promise.all(
            followerIds.map(async (id) => {
              const userDoc = await getDoc(doc(db, 'users', id));
              return { ...userDoc.data(), uid: userDoc.id } as UserType;
            })
          );
          setFollowers(fetchedUsers);
        } catch (error) {
          console.error("Error fetching followers:", error);
        } finally {
          setIsFollowersLoading(false);
        }
      });
      return () => unsubscribe();
    } else {
      setFollowers([]);
    }
  }, [showFollowersModal, user?.uid]);

  useEffect(() => {
    if (activeTab === 'wallet' && user) {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as WalletTransaction));
        setWalletTransactions(txs);
      });

      const qWithdraw = query(
        collection(db, 'withdrawal_requests'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubscribeWithdraw = onSnapshot(qWithdraw, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as WithdrawalRequest));
        setWithdrawalRequests(requests);
      });

      return () => {
        unsubscribe();
        unsubscribeWithdraw();
      };
    }
  }, [activeTab, user?.uid]);

  const handleWithdraw = async () => {
    if (!user || !withdrawAmount) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (amount > user.walletBalance) {
      alert("Insufficient balance");
      return;
    }
    if (amount < 100) {
      alert("Minimum withdrawal amount is ₹100");
      return;
    }

    if (!user.bankAccountNumber || !user.ifscCode || !user.accountHolderName) {
      showError("Please complete your bank details in profile settings first");
      setShowEditModal(true);
      return;
    }

    setIsWithdrawing(true);
    try {
      if (!isDemoMode) {
        const batch = writeBatch(db);
        
        // 1. Create withdrawal request
        const requestRef = doc(collection(db, 'withdrawal_requests'));
        batch.set(requestRef, {
          userId: user.uid,
          userName: user.name,
          amount: amount,
          status: 'pending',
          bankDetails: {
            accountNumber: user.bankAccountNumber,
            ifscCode: user.ifscCode,
            accountHolderName: user.accountHolderName,
            bankName: user.bankName || ''
          },
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
          description: 'Withdrawal Request',
          status: 'pending',
          source: 'wallet_topup',
          createdAt: Date.now()
        });

        await batch.commit();
      }

      // Update local state and storage for immediate feedback
      const updatedUser = { ...user, walletBalance: user.walletBalance - amount };
      setUser(updatedUser);
      localStorage.setItem(`demo_user_${user.uid}`, JSON.stringify(updatedUser));
      localStorage.setItem(`demo_user_phone_${user.mobile?.replace('+91', '')}`, JSON.stringify(updatedUser));

      showSuccess("Withdrawal request submitted successfully!");
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    } catch (error: any) {
      console.error("Withdrawal failed:", error);
      showError(error.code === 'permission-denied' ? "Permission denied. Please check your account status." : "Failed to submit withdrawal request.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'likes' && user) {
      setIsLikedVideosLoading(true);
      const q = query(
        collection(db, 'likes'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const videoIds = snapshot.docs.map(doc => doc.data().videoId);
        if (videoIds.length === 0) {
          setLikedVideos([]);
          setIsLikedVideosLoading(false);
          return;
        }

        try {
          // Fetch videos in chunks of 10 due to Firestore 'in' query limit
          const chunks = [];
          for (let i = 0; i < videoIds.length; i += 10) {
            chunks.push(videoIds.slice(i, i + 10));
          }

          const fetchedVideos: VideoType[] = [];
          for (const chunk of chunks) {
            const vidsQuery = query(
              collection(db, 'videos'),
              where('__name__', 'in', chunk)
            );
            const vidsSnap = await getDocs(vidsQuery);
            vidsSnap.docs.forEach(doc => {
              fetchedVideos.push({ ...doc.data(), id: doc.id } as VideoType);
            });
          }
          
          // Sort by the order of likes (which is already descending by createdAt in the likes query)
          const sortedVideos = videoIds
            .map(id => fetchedVideos.find(v => v.id === id))
            .filter((v): v is VideoType => !!v);

          setLikedVideos(sortedVideos);
        } catch (error) {
          console.error("Error fetching liked videos:", error);
        } finally {
          setIsLikedVideosLoading(false);
        }
      });
      return () => unsubscribe();
    }
  }, [activeTab, user?.uid]);

  useEffect(() => {
    if (showFollowingModal && user) {
      setIsFollowingLoading(true);
      const q = query(
        collection(db, 'follows'),
        where('followerId', '==', user.uid)
      );
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const followingIds = Array.from(new Set(snapshot.docs.map(doc => doc.data().followingId)));
        if (followingIds.length === 0) {
          setFollowing([]);
          setIsFollowingLoading(false);
          return;
        }

        try {
          const fetchedUsers = await Promise.all(
            followingIds.map(async (id) => {
              const userDoc = await getDoc(doc(db, 'users', id));
              return { ...userDoc.data(), uid: userDoc.id } as UserType;
            })
          );
          setFollowing(fetchedUsers);
        } catch (error) {
          console.error("Error fetching following:", error);
        } finally {
          setIsFollowingLoading(false);
        }
      });
      return () => unsubscribe();
    } else {
      setFollowing([]);
    }
  }, [showFollowingModal, user?.uid]);

  const handleFollow = async () => {
    if (!user || !viewingUserId) return;
    setIsFollowLoading(true);
    try {
      const followId = `${currentUser.uid}_${viewingUserId}`;
      const followRef = doc(db, 'follows', followId);
      const creatorRef = doc(db, 'users', viewingUserId);
      const currentUserRef = doc(db, 'users', currentUser.uid);

      const batch = writeBatch(db);

      if (isFollowing) {
        batch.delete(followRef);
        batch.update(creatorRef, { followersCount: increment(-1) });
        batch.update(currentUserRef, { followingCount: increment(-1) });
        setIsFollowing(false);
      } else {
        batch.set(followRef, {
          followerId: currentUser.uid,
          followingId: viewingUserId,
          createdAt: Date.now()
        });
        batch.update(creatorRef, { followersCount: increment(1) });
        batch.update(currentUserRef, { followingCount: increment(1) });
        
        // Add notification
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          userId: viewingUserId,
          senderId: currentUser.uid,
          senderName: currentUser.name,
          senderProfileImage: currentUser.profileImage,
          type: 'follow',
          message: `${currentUser.name} started following you`,
          read: false,
          createdAt: Date.now()
        });

        setIsFollowing(true);
      }

      await batch.commit();
    } catch (error) {
      console.error("Error following user:", error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleApplyMonetization = async () => {
    if (!user) return;
    try {
      if (!isDemoMode) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { monetizationStatus: 'pending' });
      }
      
      // Update local state and storage
      const updatedUser = { ...user, monetizationStatus: 'pending' as const };
      setUser(updatedUser);
      localStorage.setItem(`demo_user_${user.uid}`, JSON.stringify(updatedUser));
      localStorage.setItem(`demo_user_phone_${user.mobile?.replace('+91', '')}`, JSON.stringify(updatedUser));

      setShowMonetizationModal(false);
      showSuccess("Application submitted successfully!");
    } catch (error) {
      console.error("Failed to apply", error);
      showError("Failed to submit application. Please try again.");
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !editName.trim()) return;
    setIsSaving(true);
    try {
      const updatedData = {
        name: editName,
        profileImage: editImage,
        bankAccountNumber: editBankAcc,
        ifscCode: editIFSC,
        accountHolderName: editHolderName,
        bankName: editBankName,
        payoutType: editPayoutType,
        swiftCode: editSwift,
        iban: editIban,
        paypalEmail: editPaypal,
        country: editCountry,
        isPrivate: editIsPrivate,
        bio: editBio,
        website: editWebsite,
        socialLinks: {
          instagram: editInstagram,
          twitter: editTwitter,
          youtube: editYoutube
        }
      };

      // Save to Firestore if not in demo mode
      if (!isDemoMode) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Firestore timeout")), 5000)
          );
          
          await Promise.race([
            updateDoc(userRef, updatedData),
            timeoutPromise
          ]);
        } catch (err) {
          console.warn("Firestore update failed or timed out, relying on localStorage:", err);
        }
      }

      // Always update localStorage for resilience
      const finalUser = { ...user, ...updatedData };
      localStorage.setItem(`demo_user_${user.uid}`, JSON.stringify(finalUser));
      localStorage.setItem(`demo_user_phone_${user.mobile?.replace('+91', '')}`, JSON.stringify(finalUser));
      
      showSuccess("Profile updated successfully!");
      setShowEditModal(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      showError("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-rose-500" size={40} />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black overflow-y-auto pb-20">
      {/* Profile Header */}
      <div className="relative overflow-hidden">
        {/* Animated Background Blobs & Grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Subtle Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.03]" 
               style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              x: [0, 50, 0],
              y: [0, 30, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-20 -left-20 w-64 h-64 bg-rose-500/10 blur-[100px] rounded-full"
          />
          <motion.div 
            animate={{ 
              scale: [1.2, 1, 1.2],
              rotate: [90, 0, 90],
              x: [0, -50, 0],
              y: [0, -30, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-20 -right-20 w-80 h-80 bg-amber-500/10 blur-[100px] rounded-full"
          />
          <motion.div 
            animate={{ 
              opacity: [0.1, 0.2, 0.1],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full"
          />
        </div>

        <div className="p-6 pt-10 flex flex-col items-center relative z-10">
          {!isOwnProfile && onBack && (
            <button 
              onClick={onBack}
              className="absolute top-10 left-6 text-white bg-zinc-900/50 p-2 rounded-full border border-white/5 hover:bg-zinc-800 transition-all backdrop-blur-md"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="absolute top-10 left-6 opacity-20">
            {isOwnProfile && <Logo className="w-8 h-8" />}
          </div>
          {isOwnProfile && (
            <div className="absolute top-10 right-6 flex items-center space-x-2">
              <button 
                onClick={() => setShowEditModal(true)}
                className="text-zinc-500 hover:text-white transition-all flex items-center bg-zinc-900/50 p-2 rounded-full border border-white/5 backdrop-blur-md"
                title="Edit Profile"
              >
                <Settings size={18} />
              </button>
              <button 
                onClick={onLogout}
                className="text-zinc-500 hover:text-rose-500 transition-all flex items-center space-x-1 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur-md"
              >
                <LogOut size={18} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Logout</span>
              </button>
            </div>
          )}
          
          <div className="relative group">
            <motion.div 
              animate={{ 
                y: [0, -5, 0],
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className={cn(
                "w-32 h-32 rounded-full border-4 overflow-hidden bg-zinc-900 relative z-10 transition-all duration-500",
                user.monetizationStatus === 'approved' 
                  ? "border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.3)]" 
                  : "border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.8)]"
              )}
            >
              <img src={user?.profileImage || 'https://picsum.photos/seed/me/200/200'} alt="Profile" className="w-full h-full object-cover" />
              {isOwnProfile && (
                <div 
                  onClick={() => setShowEditModal(true)}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera size={24} className="text-white" />
                </div>
              )}
            </motion.div>
            
            {/* Subtle Pulse Ring */}
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className={cn(
                "absolute inset-0 rounded-full border-2 pointer-events-none",
                user.monetizationStatus === 'approved' ? "border-emerald-500/30" : "border-white/10"
              )}
            />

            {user.monetizationStatus === 'approved' && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -bottom-1 -right-1 bg-emerald-500 p-2 rounded-full border-4 border-black z-20 shadow-xl"
              >
                <CheckCircle2 size={18} className="text-white" />
              </motion.div>
            )}
          </div>
          
          <div className="flex flex-col items-center mt-8">
            <div className="flex items-center space-x-3">
              <h2 className="text-3xl font-black tracking-tight font-display">@{user?.name || 'creator'}</h2>
              {user.isPrivate && <Lock size={18} className="text-zinc-500" />}
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  const url = `${window.location.origin}?profile=${user?.uid}`;
                  navigator.clipboard.writeText(url);
                  showSuccess("Profile link copied!");
                }}
                className="p-2 glass-dark rounded-full text-zinc-400 hover:text-white transition-colors"
                title="Copy profile link"
              >
                <Share2 size={18} />
              </motion.button>
            </div>
            {user.bio ? (
              <p className="text-zinc-400 text-sm mt-3 font-medium text-center max-w-[320px] leading-relaxed">
                {user.bio}
              </p>
            ) : (
              <p className="text-zinc-500 text-sm mt-2 font-medium italic">Digital Creator & Visionary</p>
            )}
            {user.website && (
              <a 
                href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-500 text-xs mt-2 font-bold flex items-center space-x-1 hover:underline"
              >
                <Landmark size={12} />
                <span>{user.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
              </a>
            )}
            
            <div className="flex items-center space-x-4 mt-4">
              {user.socialLinks?.instagram && (
                <a 
                  href={`https://instagram.com/${user.socialLinks.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-rose-500 transition-colors"
                >
                  <Camera size={14} />
                </a>
              )}
              {user.socialLinks?.twitter && (
                <a 
                  href={`https://twitter.com/${user.socialLinks.twitter.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-rose-500 transition-colors"
                >
                  <MessageCircle size={14} />
                </a>
              )}
              {user.socialLinks?.youtube && (
                <a 
                  href={user.socialLinks.youtube.startsWith('http') ? user.socialLinks.youtube : `https://youtube.com/@${user.socialLinks.youtube.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-rose-500 transition-colors"
                >
                  <Eye size={14} />
                </a>
              )}
            </div>
          </div>

          <div className="flex space-x-8 mt-10 glass-dark p-6 rounded-[32px] w-full max-w-sm justify-around shadow-2xl">
            <Stat 
              label="Followers" 
              value={formatNumber(user.followersCount)} 
              onClick={() => canSeeContent && setShowFollowersModal(true)}
            />
            <div className="w-px h-10 bg-white/5 self-center" />
            <Stat 
              label="Following" 
              value={formatNumber(user.followingCount)} 
              onClick={() => canSeeContent && setShowFollowingModal(true)}
            />
            <div className="w-px h-10 bg-white/5 self-center" />
            <Stat label="Likes" value={formatNumber(user.totalLikes)} />
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 glass-dark p-4 rounded-2xl w-full max-w-sm flex items-center justify-between border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-500/20 p-2 rounded-xl">
                <IndianRupee size={20} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Estimated Earnings</p>
                <p className="text-xl font-black text-emerald-500">₹{estimatedEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">Rate: 100L=₹20 | 100C=₹25</p>
              <p className="text-[10px] font-black text-white uppercase tracking-widest mt-0.5">{totalComments} Comments</p>
            </div>
          </motion.div>

          <div className="flex flex-wrap gap-3 mt-10 w-full justify-center">
            {isOwnProfile ? (
              <>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onUploadClick}
                  className="flex-1 min-w-[120px] bg-rose-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center space-x-2 shadow-xl shadow-rose-500/20"
                >
                  <UploadIcon size={14} />
                  <span>Upload</span>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEditModal(true)}
                  className="flex-1 min-w-[120px] bg-white text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center space-x-2"
                >
                  <Edit3 size={14} />
                  <span>Edit Profile</span>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSuperChatModal(true)}
                  className="flex-1 min-w-[120px] glass-dark text-amber-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center space-x-2"
                >
                  <Sparkles size={14} />
                  <span>Wallet</span>
                </motion.button>
              </>
            ) : (
              <>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleFollow}
                  disabled={isFollowLoading}
                  className={cn(
                    "flex-[2] min-w-[140px] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl",
                    isFollowing 
                      ? 'glass text-white' 
                      : 'bg-rose-500 text-white shadow-rose-500/30'
                  )}
                >
                  {isFollowLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : (isFollowing ? 'Following' : 'Follow')}
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSuperChat(true)}
                  className="flex-1 min-w-[120px] bg-amber-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/30"
                >
                  <Sparkles size={14} />
                  <span>Super Chat</span>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onMessageClick?.(viewingUserId)}
                  className="flex-1 min-w-[120px] glass-dark text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                >
                  Message
                </motion.button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions - Only for own profile */}
      {isOwnProfile && (
        <div className="px-6 grid grid-cols-2 gap-3 mb-8">
          <button 
            onClick={() => setShowBoostModal(true)}
            className="bg-gradient-to-br from-amber-400 to-orange-500 p-4 rounded-2xl text-black flex flex-col items-center justify-center space-y-2"
          >
            <Rocket size={24} />
            <span className="font-bold text-sm">Boost Posts</span>
          </button>
          <button 
            onClick={() => setShowMonetizationModal(true)}
            className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2"
          >
            <IndianRupee size={24} className={user.monetizationStatus === 'approved' ? 'text-emerald-400' : 'text-zinc-500'} />
            <span className="font-bold text-sm">
              {user.monetizationStatus === 'approved' ? `₹${(user.walletBalance || 0).toLocaleString()}` : 'Monetization'}
            </span>
          </button>
        </div>
      )}   {/* Tabs */}
      <div className="flex border-t border-white/10">
        <button 
          onClick={() => setActiveTab('videos')}
          className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'videos' ? 'border-white text-white' : 'border-transparent text-zinc-500'}`}
        >
          <Grid size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('likes')}
          className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'likes' ? 'border-white text-white' : 'border-transparent text-zinc-500'}`}
        >
          <Heart size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'history' ? 'border-white text-white' : 'border-transparent text-zinc-500'}`}
        >
          <Rocket size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-white text-white' : 'border-transparent text-zinc-500'}`}
        >
          <LayoutDashboard size={20} />
        </button>
        {isOwnProfile && (
          <button 
            onClick={() => setActiveTab('wallet')}
            className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'wallet' ? 'border-white text-white' : 'border-transparent text-zinc-500'}`}
          >
            <Wallet size={20} />
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {!canSeeContent ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-white/5">
              <Lock size={32} className="text-zinc-500" />
            </div>
            <h3 className="text-xl font-black mb-2">This Account is Private</h3>
            <p className="text-zinc-500 text-sm max-w-[240px]">Follow this account to see their reels and likes.</p>
          </div>
        ) : (
          <>
            {activeTab === 'videos' && (
          <div className="grid grid-cols-3 gap-0.5">
            {userVideos.length === 0 ? (
              <div className="col-span-3 flex flex-col items-center justify-center py-20 text-zinc-500">
                <Grid size={48} className="mb-4 opacity-20" />
                <p className="text-sm">No posts uploaded yet</p>
              </div>
            ) : (
              userVideos.map(video => (
                <div 
                  key={video.id} 
                  onClick={() => setSelectedVideo(video)}
                  className="aspect-[9/16] bg-zinc-900 relative group overflow-hidden cursor-pointer"
                >
                  <img src={video.thumbnailUrl || `https://picsum.photos/seed/${video.id}/300/533`} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                   {/* Stats Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-2">
                    <div className="flex items-center space-x-1.5 text-white text-xs font-black drop-shadow-lg">
                      <Eye size={14} />
                      <span>{formatNumber(video.viewsCount)}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-white text-xs font-black drop-shadow-lg">
                      <Heart size={14} className="fill-white" />
                      <span>{formatNumber(video.likesCount)}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-white text-xs font-black drop-shadow-lg">
                      <Share2 size={14} className="fill-white" />
                      <span>{formatNumber(video.sharesCount || 0)}</span>
                    </div>
                    
                    {!isOwnProfile && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSuperChat(true);
                        }}
                        className="mt-2 bg-amber-500 text-white p-2.5 rounded-full shadow-lg shadow-amber-500/40 hover:scale-110 transition-transform active:scale-95"
                      >
                        <Gift size={18} />
                      </button>
                    )}
                  </div>

                  {/* Bottom View Count (Always Visible) */}
                  <div className="absolute bottom-1 left-1 flex items-center space-x-1 text-white text-[10px] font-bold bg-black/20 px-1 rounded">
                    <Eye size={10} />
                    <span>{formatNumber(video.viewsCount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'likes' && (
          <div className="grid grid-cols-3 gap-0.5">
            {isLikedVideosLoading ? (
              <div className="col-span-3 flex justify-center py-20">
                <Loader2 className="animate-spin text-rose-500" />
              </div>
            ) : likedVideos.length === 0 ? (
              <div className="col-span-3 flex flex-col items-center justify-center py-20 text-zinc-500">
                <Heart size={48} className="mb-4 opacity-20" />
                <p className="text-sm">No liked videos yet</p>
              </div>
            ) : (
              likedVideos.map(video => (
                <div 
                  key={video.id} 
                  onClick={() => setSelectedVideo(video)}
                  className="aspect-[9/16] bg-zinc-900 relative group overflow-hidden cursor-pointer"
                >
                  <img src={video.thumbnailUrl || `https://picsum.photos/seed/${video.id}/300/533`} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-2">
                    <div className="flex items-center space-x-1.5 text-white text-xs font-black drop-shadow-lg">
                      <Eye size={14} />
                      <span>{formatNumber(video.viewsCount)}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-white text-xs font-black drop-shadow-lg">
                      <Heart size={14} className="fill-white" />
                      <span>{formatNumber(video.likesCount)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-4 space-y-3">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <Rocket size={48} className="mb-4 opacity-20" />
                <p className="text-sm">No boost history found</p>
              </div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                      <Rocket size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{tx.planName}</p>
                      <p className="text-[10px] text-zinc-500">
                        {format(tx.createdAt, 'dd MMM yyyy, hh:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-emerald-500">₹{tx.amount}</p>
                    <p className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                      tx.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      {tx.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'wallet' && isOwnProfile && (
          <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Wallet Balance Card */}
            <div className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-8 rounded-[40px] relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Wallet size={120} />
              </div>
              <div className="relative z-10">
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Available Balance</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-5xl font-black text-white tracking-tighter">₹{formatNumber(user.walletBalance)}</span>
                  <span className="text-zinc-500 text-sm font-bold">INR</span>
                </div>
                
                <div className="mt-8 flex space-x-3">
                  <button 
                    onClick={() => setShowWithdrawModal(true)}
                    className="flex-1 bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-white/5"
                  >
                    Withdraw Funds
                  </button>
                  <button 
                    onClick={() => setShowSuperChatModal(true)}
                    className="flex-1 bg-zinc-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-all border border-white/5"
                  >
                    Add Credits
                  </button>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Transaction History</h3>
                <button className="text-[10px] font-bold text-rose-500 hover:underline">View All</button>
              </div>

              <div className="space-y-2">
                {walletTransactions.length === 0 ? (
                  <div className="bg-zinc-900/50 border border-dashed border-zinc-800 p-12 rounded-[32px] text-center">
                    <Clock className="mx-auto text-zinc-800 mb-3 opacity-20" size={32} />
                    <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">No transactions yet</p>
                  </div>
                ) : (
                  walletTransactions.map(tx => (
                    <div key={tx.id} className="bg-zinc-900/80 backdrop-blur-md border border-white/5 p-4 rounded-3xl flex items-center justify-between group hover:border-white/10 transition-all">
                      <div className="flex items-center space-x-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                          tx.type === 'earning' ? "bg-emerald-500/10 text-emerald-500" :
                          tx.type === 'withdrawal' ? "bg-rose-500/10 text-rose-500" :
                          "bg-blue-500/10 text-blue-500"
                        )}>
                          {tx.type === 'earning' ? <Sparkles size={20} /> : 
                           tx.type === 'withdrawal' ? <Landmark size={20} /> : 
                           <IndianRupee size={20} />}
                        </div>
                        <div>
                          <p className="font-black text-white text-sm tracking-tight">{tx.description}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                            {format(tx.createdAt, 'MMM dd, yyyy')} • {tx.source.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "font-black text-lg tracking-tighter",
                          tx.type === 'earning' ? "text-emerald-500" : "text-white"
                        )}>
                          {tx.type === 'earning' ? '+' : '-'}₹{tx.amount}
                        </p>
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                          tx.status === 'completed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                          tx.status === 'pending' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                          "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        )}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Withdrawal Requests Status */}
            {withdrawalRequests.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest px-2">Withdrawal Requests</h3>
                <div className="space-y-2">
                  {withdrawalRequests.map(req => (
                    <div key={req.id} className="bg-zinc-900/50 border border-white/5 p-4 rounded-3xl flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500">
                          <Landmark size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs">₹{req.amount} Withdrawal</p>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                            {format(req.createdAt, 'MMM dd')} • {req.bankDetails.bankName}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                        req.status === 'pending' ? "bg-amber-500/10 text-amber-500" :
                        req.status === 'approved' ? "bg-emerald-500/10 text-emerald-500" :
                        "bg-rose-500/10 text-rose-500"
                      )}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <LayoutDashboard size={80} />
              </div>
              <h3 className="text-xl font-black mb-1">Professional Dashboard</h3>
              <p className="text-zinc-500 text-xs mb-6 uppercase tracking-widest font-bold">Insights & Monitoring</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 p-5 rounded-3xl border border-white/5 hover:border-rose-500/30 transition-colors">
                  <div className="flex items-center space-x-2 mb-2">
                    <Eye size={14} className="text-rose-500" />
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Total Reach</p>
                  </div>
                  <p className="text-3xl font-black text-white">{formatNumber(user.totalViews)}</p>
                  <p className="text-[10px] text-emerald-500 font-bold mt-1">+12.5% this week</p>
                </div>
                <div className="bg-black/40 p-5 rounded-3xl border border-white/5 hover:border-rose-500/30 transition-colors">
                  <div className="flex items-center space-x-2 mb-2">
                    <Heart size={14} className="text-rose-500" />
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Total Likes</p>
                  </div>
                  <p className="text-3xl font-black text-white">{formatNumber(user.totalLikes)}</p>
                  <p className="text-[10px] text-emerald-500 font-bold mt-1">+5.2% this week</p>
                </div>
                <div className="bg-black/40 p-5 rounded-3xl border border-white/5 hover:border-rose-500/30 transition-colors">
                  <div className="flex items-center space-x-2 mb-2">
                    <Grid size={14} className="text-rose-500" />
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Content</p>
                  </div>
                  <p className="text-3xl font-black text-white">{userVideos.length}</p>
                  <p className="text-[10px] text-zinc-500 font-bold mt-1">Videos Published</p>
                </div>
                <div className="bg-black/40 p-5 rounded-3xl border border-white/5 hover:border-rose-500/30 transition-colors">
                  <div className="flex items-center space-x-2 mb-2">
                    <Rocket size={14} className="text-rose-500" />
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Engagement</p>
                  </div>
                  <p className="text-3xl font-black text-white">
                    {user.totalViews > 0 ? ((user.totalLikes / user.totalViews) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[10px] text-zinc-500 font-bold mt-1">Avg. Interaction</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/5 p-5 rounded-3xl border border-amber-500/20 hover:border-amber-500/40 transition-colors col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Sparkles size={14} className="text-amber-500" />
                      <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Super Chat Wallet</p>
                    </div>
                    <button 
                      onClick={() => setShowSuperChat(true)}
                      className="text-[10px] font-bold text-amber-500 uppercase tracking-widest hover:underline"
                    >
                      Buy Credits
                    </button>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-black text-white flex items-center space-x-2">
                        <IndianRupee size={24} className="text-amber-500" />
                        <span>{formatNumber(user.superChatBalance || 0)}</span>
                      </p>
                      <p className="text-[10px] text-zinc-500 font-bold mt-1">Available for gifting</p>
                    </div>
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                      <Gift size={20} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Growth Analytics Chart */}
              <div className="mt-8 bg-black/40 border border-white/5 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-rose-500/10 rounded-xl">
                      <Rocket size={18} className="text-rose-500" />
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-widest">Growth Analytics</h4>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-2 h-2 bg-rose-500 rounded-full" />
                      <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">Views</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.1} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }}
                        dy={10}
                      />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#09090b', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '16px',
                          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
                        }}
                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}
                        cursor={{ stroke: '#f43f5e', strokeWidth: 2, strokeDasharray: '5 5' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="views" 
                        stroke="#f43f5e" 
                        fillOpacity={1} 
                        fill="url(#colorViews)" 
                        strokeWidth={3}
                        animationDuration={2000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-zinc-800 overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="User" />
                      </div>
                    ))}
                    <div className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-rose-500 flex items-center justify-center text-[8px] font-black">
                      +12
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">New followers this week</p>
                </div>
              </div>

              {/* Creator Insights */}
              <div className="mt-8 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 px-2">Creator Insights</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 p-5 rounded-[32px] flex items-start space-x-4">
                    <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                      <Sparkles size={24} className="text-white" />
                    </div>
                    <div>
                      <h5 className="text-sm font-black text-white mb-1">Peak Engagement Time</h5>
                      <p className="text-xs text-zinc-400 leading-relaxed">Your audience is most active between <span className="text-indigo-400 font-bold">8 PM - 10 PM</span>. Post during this window for 2x reach.</p>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 p-5 rounded-[32px] flex items-start space-x-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                      <Rocket size={24} className="text-white" />
                    </div>
                    <div>
                      <h5 className="text-sm font-black text-white mb-1">Trending Hashtag Alert</h5>
                      <p className="text-xs text-zinc-400 leading-relaxed">Videos using <span className="text-emerald-400 font-bold">#CreativeVibes</span> are seeing a 40% boost in discoverability today.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Details Section */}
              <div className="mt-6 bg-black/40 border border-white/5 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Landmark size={18} className="text-rose-500" />
                    <h4 className="text-sm font-bold uppercase tracking-widest">Withdrawal Account</h4>
                  </div>
                  <button 
                    onClick={() => setShowEditModal(true)}
                    className="text-[10px] font-bold text-rose-500 uppercase tracking-widest hover:underline"
                  >
                    Update
                  </button>
                </div>

                {user.payoutType === 'international' ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Type</span>
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">International</span>
                    </div>
                    {user.paypalEmail && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold">PayPal</span>
                        <span className="text-xs font-bold text-white">{user.paypalEmail}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">IBAN</span>
                      <span className="text-xs font-bold text-white tracking-widest">
                        {user.iban ? `${user.iban.slice(0, 4)} **** ${user.iban.slice(-4)}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">SWIFT</span>
                      <span className="text-xs font-bold text-white">{user.swiftCode}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Country</span>
                      <span className="text-xs font-bold text-white">{user.country}</span>
                    </div>
                  </div>
                ) : user.bankAccountNumber ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Type</span>
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Domestic</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Holder</span>
                      <span className="text-xs font-bold text-white">{user.accountHolderName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Bank</span>
                      <span className="text-xs font-bold text-white">{user.bankName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">A/C Number</span>
                      <span className="text-xs font-bold text-white tracking-widest">
                        {user.bankAccountNumber.slice(0, 4)} **** {user.bankAccountNumber.slice(-4)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">IFSC</span>
                      <span className="text-xs font-bold text-white">{user.ifscCode}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-zinc-500 mb-3">No payout method linked for withdrawals.</p>
                    <button 
                      onClick={() => setShowEditModal(true)}
                      className="text-[10px] font-black text-white bg-rose-500 px-4 py-2 rounded-xl uppercase tracking-widest"
                    >
                      Setup Payouts
                    </button>
                  </div>
                )}
              </div>

              {/* Revenue Potential Section */}
              <div className="mt-8 bg-black/40 border border-white/5 rounded-3xl p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <IndianRupee size={18} className="text-emerald-500" />
                  <h4 className="text-sm font-bold uppercase tracking-widest">Revenue Potential</h4>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Eye size={14} className="text-zinc-500" />
                      <span className="text-xs text-zinc-400">Current Views</span>
                    </div>
                    <span className="text-sm font-bold text-white">{formatNumber(user.totalViews)}</span>
                  </div>

                  <div className="h-px bg-white/5" />

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { views: 1000, amount: 0.50 },
                      { views: 10000, amount: 10 },
                      { views: 50000, amount: 50 },
                      { views: 100000, amount: 100 },
                    ].map((rate, idx) => {
                      const isReached = user.totalViews >= rate.views;
                      return (
                        <div key={idx} className={`p-3 rounded-2xl border transition-all ${
                          isReached ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900/50 border-white/5 opacity-50'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">{formatNumber(rate.views)} Views</span>
                            {isReached && <CheckCircle2 size={10} className="text-emerald-500" />}
                          </div>
                          <div className="flex items-center space-x-1 text-emerald-500 font-black">
                            <IndianRupee size={12} />
                            <span>{rate.amount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 mt-4">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Estimated Earnings</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-2xl font-black text-white">
                        <IndianRupee size={20} className="text-emerald-500" />
                        <span>
                          {(() => {
                            const views = user.totalViews;
                            if (views >= 100000) return 100;
                            if (views >= 50000) return 50;
                            if (views >= 10000) return 10;
                            if (views >= 1000) return 0.5;
                            return 0;
                          })()}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Status</p>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${
                          user.monetizationStatus === 'approved' ? 'text-emerald-500' : 'text-amber-500'
                        }`}>
                          {user.monetizationStatus === 'approved' ? 'Withdrawable' : 'Pending Partner'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {superChats.length > 0 && (
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Recent Super Chats</h3>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">₹{superChats.reduce((acc, chat) => acc + chat.amount, 0)} Total</span>
                  </div>
                  <div className="space-y-3">
                    {superChats.slice(0, 3).map(chat => (
                      <div key={chat.id} className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20">
                            <Sparkles size={14} className="text-amber-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">From @{chat.senderName}</p>
                            <p className="text-[10px] text-zinc-500 truncate max-w-[150px]">{chat.message || "Sent a Super Chat!"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-amber-500">+₹{chat.amount}</p>
                          <p className="text-[8px] text-zinc-600 font-bold uppercase">{format(chat.createdAt, 'MMM d, HH:mm')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Monetization Progress</h4>
                  <span className="text-[10px] font-bold text-rose-500">
                    {Math.round(
                      ((Math.min(user.followersCount, 300) / 300) * 0.3 +
                      (Math.min(user.totalViews, 10000) / 10000) * 0.4 +
                      (Math.min(userVideos.length, 50) / 50) * 0.3) * 100
                    )}% to Goal
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${Math.round(
                        ((Math.min(user.followersCount, 300) / 300) * 0.3 +
                        (Math.min(user.totalViews, 10000) / 10000) * 0.4 +
                        (Math.min(userVideos.length, 50) / 50) * 0.3) * 100
                      )}%` 
                    }} 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Content Performance</h3>
                <button className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">See All</button>
              </div>
              {userVideos.length === 0 ? (
                <div className="bg-zinc-900/50 border border-dashed border-zinc-800 p-10 rounded-[32px] text-center">
                  <p className="text-zinc-500 text-sm">No videos to analyze yet.</p>
                </div>
              ) : (
                userVideos.map(video => (
                  <div key={video.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-[24px] flex items-center space-x-4 hover:border-zinc-700 transition-colors">
                    <div className="w-16 h-24 bg-zinc-800 rounded-xl overflow-hidden shrink-0 border border-white/5">
                      <img src={video.thumbnailUrl || `https://picsum.photos/seed/${video.id}/200/300`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate mb-3">{video.caption || 'No caption'}</p>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                        <div className="flex items-center space-x-1.5 text-zinc-400 text-[10px] font-bold">
                          <Eye size={12} className="text-rose-500" />
                          <span>{formatNumber(video.viewsCount)}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-zinc-400 text-[10px] font-bold">
                          <Heart size={12} className="text-rose-500" />
                          <span>{formatNumber(video.likesCount)}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-zinc-400 text-[10px] font-bold">
                          <MessageCircle size={12} className="text-rose-500" />
                          <span>{formatNumber(video.commentsCount)}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-zinc-400 text-[10px] font-bold">
                          <Share2 size={12} className="text-rose-500" />
                          <span>{formatNumber(video.sharesCount)}</span>
                        </div>
                      </div>
                    </div>
                    {isOwnProfile && (
                      <button 
                        onClick={() => {
                          setVideoToBoost(video);
                          setShowBoostModal(true);
                        }}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          video.boosted ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white"
                        )}
                      >
                        <Rocket size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <h3 className="text-xl font-bold mb-6 text-center">Edit Profile</h3>
              
              <div className="flex flex-col items-center space-y-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full border-4 border-zinc-800 overflow-hidden bg-zinc-900">
                    <img src={editImage} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <button 
                    onClick={() => setEditImage(`https://picsum.photos/seed/${Math.random()}/200/200`)}
                    className="absolute bottom-0 right-0 bg-rose-500 p-2 rounded-full border-2 border-zinc-900 text-white hover:bg-rose-600 transition-colors"
                  >
                    <Camera size={16} />
                  </button>
                </div>

                <div className="w-full space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Display Name</label>
                    <input 
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Profile Image URL</label>
                    <input 
                      type="text"
                      value={editImage}
                      onChange={(e) => setEditImage(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-medium text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Bio</label>
                    <textarea 
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value.slice(0, 150))}
                      placeholder="Tell the world about yourself..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-medium text-sm resize-none h-24"
                    />
                    <div className="text-[8px] text-right text-zinc-600 font-bold uppercase tracking-widest mt-1">
                      {editBio.length}/150
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Website</label>
                    <input 
                      type="text"
                      value={editWebsite}
                      onChange={(e) => setEditWebsite(e.target.value)}
                      placeholder="e.g. yourwebsite.com"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm"
                    />
                  </div>

                  <div className="pt-2 border-t border-white/5 space-y-4">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Social Links</p>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Instagram</label>
                        <div className="relative mt-1">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs">@</span>
                          <input 
                            type="text"
                            value={editInstagram}
                            onChange={(e) => setEditInstagram(e.target.value)}
                            placeholder="username"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-8 pr-4 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Twitter</label>
                        <div className="relative mt-1">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs">@</span>
                          <input 
                            type="text"
                            value={editTwitter}
                            onChange={(e) => setEditTwitter(e.target.value)}
                            placeholder="username"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-8 pr-4 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">YouTube</label>
                        <input 
                          type="text"
                          value={editYoutube}
                          onChange={(e) => setEditYoutube(e.target.value)}
                          placeholder="Channel name or URL"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-white">Private Account</p>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Only followers can see your reels</p>
                    </div>
                    <button 
                      onClick={() => setEditIsPrivate(!editIsPrivate)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        editIsPrivate ? "bg-rose-500" : "bg-zinc-800"
                      )}
                    >
                      <motion.div 
                        animate={{ x: editIsPrivate ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg"
                      />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Payout Setup</p>
                      <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                        <button 
                          onClick={() => setEditPayoutType('domestic')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            editPayoutType === 'domestic' ? 'bg-rose-500 text-white' : 'text-zinc-500'
                          }`}
                        >
                          Domestic
                        </button>
                        <button 
                          onClick={() => setEditPayoutType('international')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            editPayoutType === 'international' ? 'bg-rose-500 text-white' : 'text-zinc-500'
                          }`}
                        >
                          International
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {editPayoutType === 'domestic' ? (
                        <>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Account Holder Name</label>
                            <input 
                              type="text"
                              value={editHolderName}
                              onChange={(e) => setEditHolderName(e.target.value)}
                              placeholder="As per bank records"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Bank Name</label>
                              <input 
                                type="text"
                                value={editBankName}
                                onChange={(e) => setEditBankName(e.target.value)}
                                placeholder="e.g. SBI, HDFC"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">IFSC Code</label>
                              <input 
                                type="text"
                                value={editIFSC}
                                onChange={(e) => setEditIFSC(e.target.value.toUpperCase())}
                                placeholder="SBIN0001234"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Account Number</label>
                            <input 
                              type="text"
                              value={editBankAcc}
                              onChange={(e) => setEditBankAcc(e.target.value)}
                              placeholder="Your account number"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm tracking-wider"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">PayPal Email (Optional)</label>
                            <input 
                              type="email"
                              value={editPaypal}
                              onChange={(e) => setEditPaypal(e.target.value)}
                              placeholder="paypal@example.com"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">SWIFT / BIC</label>
                              <input 
                                type="text"
                                value={editSwift}
                                onChange={(e) => setEditSwift(e.target.value.toUpperCase())}
                                placeholder="SWIFT CODE"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Country</label>
                              <input 
                                type="text"
                                value={editCountry}
                                onChange={(e) => setEditCountry(e.target.value)}
                                placeholder="e.g. USA, UK"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">IBAN / International A/C</label>
                            <input 
                              type="text"
                              value={editIban}
                              onChange={(e) => setEditIban(e.target.value)}
                              placeholder="International Account Number"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 mt-1 focus:outline-none focus:border-rose-500 transition-colors font-bold text-sm tracking-wider"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Video Quality</label>
                    <div className="mt-1 bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Always 1080p (HD)</span>
                      <div className="bg-emerald-500/20 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        ACTIVE
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1.5 ml-1">Your videos are automatically optimized for high definition.</p>
                  </div>
                </div>

                <div className="w-full flex flex-col space-y-3 pt-4">
                  <button 
                    onClick={handleUpdateProfile}
                    disabled={isSaving}
                    className="w-full bg-rose-500 text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <span>Save Changes</span>}
                  </button>
                  <button 
                    onClick={() => setShowEditModal(false)}
                    className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-bold hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Boost Modal */}
      <AnimatePresence>
        {showBoostModal && videoToBoost && user && (
          <BoostModal 
            currentUser={user}
            video={videoToBoost}
            onClose={() => {
              setShowBoostModal(false);
              setVideoToBoost(null);
            }}
          />
        )}
      </AnimatePresence>
      {/* Monetization Modal */}
      <AnimatePresence>
        {showMonetizationModal && (
          <MonetizationDashboard 
            user={user} 
            videosCount={userVideos.length}
            onApply={handleApplyMonetization}
            onClose={() => setShowMonetizationModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Super Chat Modal */}
      <AnimatePresence>
        {showSuperChatModal && (
          <SuperChatModal 
            currentUser={currentUser}
            targetUser={isOwnProfile ? undefined : (user || undefined)}
            onClose={() => setShowSuperChatModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Followers Modal */}
      <AnimatePresence>
        {showFollowersModal && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFollowersModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md glass-dark rounded-t-[40px] p-8 pb-12 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8 shrink-0" />
              
              <div className="flex items-center justify-between mb-8 shrink-0">
                <h3 className="text-2xl font-black font-display tracking-tight">Followers</h3>
                <button 
                  onClick={() => setShowFollowersModal(false)}
                  className="w-10 h-10 glass rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {isFollowersLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-rose-500 mb-4" size={32} />
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Loading followers...</p>
                  </div>
                ) : followers.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500">
                    <div className="w-20 h-20 glass rounded-full flex items-center justify-center mx-auto mb-6">
                      <User size={40} className="opacity-20" />
                    </div>
                    <p className="font-bold text-sm">No followers yet</p>
                  </div>
                ) : (
                  followers.map(follower => (
                    <div 
                      key={follower.uid} 
                      className="flex items-center justify-between p-4 glass rounded-3xl hover:bg-white/5 transition-all cursor-pointer group"
                      onClick={() => {
                        setShowFollowersModal(false);
                        onNavigate?.(follower.uid);
                      }}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-rose-500 transition-all">
                          <img src={follower.profileImage} alt={follower.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-black text-white font-display">@{follower.name}</p>
                          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">
                            {formatNumber(follower.followersCount)} Followers
                          </p>
                        </div>
                      </div>
                      <button className="glass px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                        View
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Following Modal */}
      <AnimatePresence>
        {showFollowingModal && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFollowingModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md glass-dark rounded-t-[40px] p-8 pb-12 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8 shrink-0" />
              
              <div className="flex items-center justify-between mb-8 shrink-0">
                <h3 className="text-2xl font-black font-display tracking-tight">Following</h3>
                <button 
                  onClick={() => setShowFollowingModal(false)}
                  className="w-10 h-10 glass rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {isFollowingLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-rose-500 mb-4" size={32} />
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Loading following...</p>
                  </div>
                ) : following.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500">
                    <div className="w-20 h-20 glass rounded-full flex items-center justify-center mx-auto mb-6">
                      <User size={40} className="opacity-20" />
                    </div>
                    <p className="font-bold text-sm">Not following anyone yet</p>
                  </div>
                ) : (
                  following.map(followedUser => (
                    <div 
                      key={followedUser.uid} 
                      className="flex items-center justify-between p-4 glass rounded-3xl hover:bg-white/5 transition-all cursor-pointer group"
                      onClick={() => {
                        setShowFollowingModal(false);
                        onNavigate?.(followedUser.uid);
                      }}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-rose-500 transition-all">
                          <img src={followedUser.profileImage} alt={followedUser.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-black text-white font-display">@{followedUser.name}</p>
                          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">
                            {formatNumber(followedUser.followersCount)} Followers
                          </p>
                        </div>
                      </div>
                      <button className="glass px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                        View
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Player Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full h-full max-w-md"
            >
              <button 
                onClick={() => setSelectedVideo(null)}
                className="absolute top-10 left-6 z-[160] text-white bg-black/50 p-2 rounded-full border border-white/10 backdrop-blur-md"
              >
                <ChevronLeft size={24} />
              </button>

              {isOwnProfile && (
                <button 
                  onClick={() => {
                    setVideoToBoost(selectedVideo);
                    setShowBoostModal(true);
                  }}
                  className="absolute top-10 right-6 z-[160] bg-rose-500 text-white px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 flex items-center space-x-2"
                >
                  <Rocket size={14} />
                  <span>Boost Reel</span>
                </button>
              )}
              
              <VideoCard 
                video={selectedVideo} 
                currentUser={currentUser}
                isActive={true}
                shouldLoad={true}
                onUserClick={(uid) => {
                  setSelectedVideo(null);
                  onNavigate?.(uid);
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawModal && user && (
          <div className="fixed inset-0 z-[160] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWithdrawModal(false)}
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
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                    <Landmark size={24} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Withdraw Funds</h3>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Transfer to Bank Account</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowWithdrawModal(false)}
                  className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl">
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-4">Withdrawal Amount</p>
                  <div className="flex items-center space-x-3">
                    <span className="text-4xl font-black text-white">₹</span>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="bg-transparent text-4xl font-black text-white focus:outline-none w-full tracking-tighter"
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Available: ₹{user.walletBalance}</p>
                    <button 
                      onClick={() => setWithdrawAmount(user.walletBalance.toString())}
                      className="text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:underline"
                    >
                      Withdraw All
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800/50 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Bank Account</p>
                    <button 
                      onClick={() => {
                        setShowWithdrawModal(false);
                        setShowEditModal(true);
                      }}
                      className="text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                  {user.bankAccountNumber ? (
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
                        <Landmark size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">{user.bankName || 'Bank Account'}</p>
                        <p className="text-[10px] text-zinc-500 font-bold tracking-widest">
                          •••• {user.bankAccountNumber.slice(-4)} • {user.accountHolderName}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 space-y-2">
                      <AlertCircle className="text-amber-500" size={24} />
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center">
                        Bank details missing. Please update in profile settings.
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start space-x-3">
                  <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-amber-500/80 font-medium leading-relaxed">
                    Withdrawals are processed within 3-5 business days. Minimum withdrawal amount is ₹100.
                  </p>
                </div>

                <button 
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) < 100}
                  className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center space-x-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100"
                >
                  {isWithdrawing ? <Loader2 className="animate-spin" /> : (
                    <>
                      <span>Confirm Withdrawal</span>
                      <Rocket size={20} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Super Chat Modal */}
      <AnimatePresence>
        {showSuperChat && user && (
          <SuperChatModal 
            currentUser={currentUser}
            targetUser={user}
            onClose={() => setShowSuperChat(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

function Stat({ label, value, onClick }: { label: string, value: string | number, onClick?: () => void }) {
  return (
    <div 
      className={cn("flex flex-col items-center", onClick && "cursor-pointer hover:opacity-80 transition-opacity")}
      onClick={onClick}
    >
      <span className="font-black text-xl font-display tracking-tight">{value}</span>
      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

// Share2 is now imported from lucide-react

