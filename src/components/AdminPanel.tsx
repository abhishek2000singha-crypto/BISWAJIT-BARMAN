import React, { useState, useEffect } from 'react';
import { Users, Video, TrendingUp, DollarSign, ShieldCheck, Ban, Trash2, CheckCircle, XCircle, Loader2, CreditCard, AlertTriangle, LogOut, Search, Landmark, ChevronDown, ChevronUp, Sparkles, Gift, IndianRupee, Wallet, Plus, ClipboardList, Clock, CheckCircle2, X, Calendar, CloudUpload, Rocket } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, getDocs, writeBatch, getDoc, increment, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User as UserType, Video as VideoType, BoostTransaction, AdminTask } from '../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useUpload } from '../contexts/UploadContext';
import { cn } from '../utils';
import { sendNotification } from '../services/notificationService';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export const AdminPanel: React.FC<{ currentUser: UserType, onLogout?: () => void }> = ({ currentUser, onLogout }) => {
  const { uploads, removeUpload } = useUpload();
  const [activeTab, setActiveTab] = useState('stats');
  const [pendingUsers, setPendingUsers] = useState<UserType[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [allVideos, setAllVideos] = useState<VideoType[]>([]);
  const [transactions, setTransactions] = useState<BoostTransaction[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [superChats, setSuperChats] = useState<any[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
  const [showSendMoneyModal, setShowSendMoneyModal] = useState<UserType | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'moderation' as const,
    priority: 'medium' as const,
    assignedToId: '',
  });
  const [sendAmount, setSendAmount] = useState('');
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [walletSearchQuery, setWalletSearchQuery] = useState('');
  const [expandedWithdrawalId, setExpandedWithdrawalId] = useState<string | null>(null);
  const [showRejectionModal, setShowRejectionModal] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [videoDateFilter, setVideoDateFilter] = useState<'all' | '7d' | '30d' | 'custom'>('all');
  const [videoSortField, setVideoSortField] = useState<'createdAt' | 'viewsCount' | 'likesCount' | 'commentsCount'>('createdAt');
  const [videoSortOrder, setVideoSortOrder] = useState<'asc' | 'desc'>('desc');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [platformRevenue, setPlatformRevenue] = useState(0);

  const [stats, setStats] = useState([
    { label: 'Total Users', value: '0', icon: <Users className="text-blue-500" />, trend: 'Live', color: 'blue' },
    { label: 'Total Videos', value: '0', icon: <Video className="text-rose-500" />, trend: 'Live', color: 'rose' },
    { label: 'Total Boosted', value: '0', icon: <TrendingUp className="text-amber-500" />, trend: 'Live', color: 'amber' },
    { label: 'Platform Comm.', value: '₹0', icon: <DollarSign className="text-emerald-500" />, trend: 'Live', color: 'emerald' },
    { label: 'Admin Wallet', value: '₹0', icon: <Wallet className="text-purple-500" />, trend: 'Live', color: 'purple' },
  ]);

  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    // Pending Monetization
    const qPending = query(collection(db, 'users'), where('monetizationStatus', '==', 'pending'));
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      setPendingUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserType)));
    });

    // All Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserType));
      setAllUsers(users);
      
      // Update stats
      setStats(prev => prev.map(s => 
        s.label === 'Total Users' ? { ...s, value: users.length.toLocaleString() } : s
      ));
    });

    // All Videos
    const unsubVideos = onSnapshot(collection(db, 'videos'), (snapshot) => {
      const videos = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as VideoType));
      setAllVideos(videos);
      
      setStats(prev => prev.map(s => 
        s.label === 'Total Videos' ? { ...s, value: videos.length.toLocaleString() } : s
      ));
    });

    // Transactions
    const qTxs = query(collection(db, 'boost_transactions'), orderBy('createdAt', 'asc'));
    const unsubTxs = onSnapshot(qTxs, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BoostTransaction));
      setTransactions([...txs].reverse()); // Keep latest first for list
      
      const totalBoosted = txs.length;
      setStats(prev => prev.map(s => 
        s.label === 'Total Boosted' ? { ...s, value: totalBoosted.toLocaleString() } : s
      ));
    });

    // Super Chats
    const qSuperChats = query(collection(db, 'super_chats'), orderBy('createdAt', 'asc'));
    const unsubSuperChats = onSnapshot(qSuperChats, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setSuperChats([...chats].reverse());
    });

    // Withdrawal Requests
    const qWithdrawals = query(collection(db, 'withdrawal_requests'), orderBy('createdAt', 'desc'));
    const unsubWithdrawals = onSnapshot(qWithdrawals, (snapshot) => {
      setWithdrawalRequests(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    // Tasks
    const qTasks = query(collection(db, 'admin_tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AdminTask)));
    });

    setIsLoading(false);

    return () => {
      unsubPending();
      unsubUsers();
      unsubVideos();
      unsubTxs();
      unsubSuperChats();
      unsubWithdrawals();
      unsubTasks();
    };
  }, []);

  // Combined Revenue Calculation Effect
  useEffect(() => {
    if (transactions.length === 0 && superChats.length === 0) return;

    const boostRev = transactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const chatRev = superChats.reduce((acc, curr) => acc + ((curr.amount || 0) * 0.3), 0);
    const totalRev = boostRev + chatRev;

    setPlatformRevenue(totalRev);
    setStats(prev => prev.map(s => 
      (s.label === 'Platform Comm.' || s.label === 'Total Revenue') 
        ? { ...s, label: 'Total Revenue', value: `₹${totalRev.toLocaleString()}` } 
        : s
    ));

    // Process chart data (grouped by date)
    const dailyData: Record<string, number> = {};
    
    transactions.forEach(tx => {
      const date = format(tx.createdAt, 'MMM dd');
      dailyData[date] = (dailyData[date] || 0) + (tx.amount || 0);
    });

    superChats.forEach(tx => {
      const date = format(tx.createdAt, 'MMM dd');
      dailyData[date] = (dailyData[date] || 0) + ((tx.amount || 0) * 0.3);
    });

    const formattedData = Object.entries(dailyData)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime())
      .slice(-7);
    
    setChartData(formattedData);
  }, [transactions, superChats]);

  useEffect(() => {
    setStats(prev => prev.map(s => 
      s.label === 'Admin Wallet' ? { ...s, value: `₹${(currentUser.walletBalance || 0).toLocaleString()}` } : s
    ));
  }, [currentUser.walletBalance]);

  const handleMonetizationAction = async (userId: string, status: 'approved' | 'rejected') => {
    setActionLoading(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { monetizationStatus: status });

      // Send notification
      sendNotification({
        userId: userId,
        senderId: currentUser.uid,
        senderName: 'System',
        senderProfileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        type: 'monetization',
        message: status === 'approved' 
          ? 'Congratulations! Your monetization request has been approved. You can now earn from your content.' 
          : 'Your monetization request has been rejected. Please review our policies and try again.'
      });
    } catch (error) {
      console.error(error);
      alert("Failed to update status.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    if (pendingUsers.length === 0) return;
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      pendingUsers.forEach(user => {
        const userRef = doc(db, 'users', user.uid);
        batch.update(userRef, { monetizationStatus: 'approved' });

        // Send notification
        sendNotification({
          userId: user.uid,
          senderId: currentUser.uid,
          senderName: 'System',
          senderProfileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
          type: 'monetization',
          message: 'Congratulations! Your monetization request has been approved. You can now earn from your content.'
        });
      });
      await batch.commit();
      alert(`Successfully approved ${pendingUsers.length} users!`);
    } catch (error) {
      console.error(error);
      alert("Failed to bulk approve users.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserAction = async (userId: string, isBanned: boolean) => {
    setActionLoading(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: isBanned ? 'user' : 'banned' as any }); // Simple ban logic
    } catch (error) {
      console.error(error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    setVideoToDelete(videoId);
  };

  const handleSendMoney = async () => {
    if (!showSendMoneyModal || !sendAmount) return;
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) return;

    if ((currentUser.walletBalance || 0) < amount) {
      alert("Insufficient balance in your admin wallet!");
      return;
    }

    setActionLoading(showSendMoneyModal.uid);
    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', showSendMoneyModal.uid);
      const adminRef = doc(db, 'users', currentUser.uid);

      // Add to user
      batch.update(userRef, {
        walletBalance: increment(amount)
      });

      // Deduct from admin
      batch.update(adminRef, {
        walletBalance: increment(-amount)
      });

      await batch.commit();

      setShowSendMoneyModal(null);
      setShowTransferConfirm(false);
      setSendAmount('');
      alert(`Successfully transferred ₹${amount} to ${showSendMoneyModal.name}`);
    } catch (error) {
      console.error(error);
      alert("Failed to transfer money");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.assignedToId) return;
    
    const assignedUser = allUsers.find(u => u.uid === newTask.assignedToId);
    if (!assignedUser) return;

    setActionLoading('create_task');
    try {
      const taskData: Omit<AdminTask, 'id'> = {
        ...newTask,
        status: 'pending',
        assignedToName: assignedUser.name,
        createdById: currentUser.uid,
        createdByName: currentUser.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      await addDoc(collection(db, 'admin_tasks'), taskData);
      setShowCreateTaskModal(false);
      setNewTask({
        title: '',
        description: '',
        category: 'moderation',
        priority: 'medium',
        assignedToId: '',
      });
    } catch (error) {
      console.error(error);
      alert("Failed to create task");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: AdminTask['status']) => {
    setActionLoading(taskId);
    try {
      await updateDoc(doc(db, 'admin_tasks', taskId), {
        status,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error(error);
      alert("Failed to update task");
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdrawalAction = async (requestId: string, status: 'approved' | 'rejected', reason?: string) => {
    setActionLoading(requestId);
    try {
      const requestRef = doc(db, 'withdrawal_requests', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) {
        alert("Request not found");
        return;
      }

      const requestData = requestSnap.data();
      const { userId, amount } = requestData;

      if (status === 'approved') {
        await updateDoc(requestRef, { 
          status: 'approved',
          processedAt: Date.now()
        });

        // Update transaction status
        const txQuery = query(
          collection(db, 'transactions'),
          where('userId', '==', userId),
          where('type', '==', 'withdrawal'),
          where('amount', '==', amount),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc')
        );
        const txSnap = await getDocs(txQuery);
        if (!txSnap.empty) {
          await updateDoc(doc(db, 'transactions', txSnap.docs[0].id), {
            status: 'completed'
          });
        }

        // Send notification
        sendNotification({
          userId: userId,
          senderId: 'system',
          senderName: 'System',
          senderProfileImage: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
          type: 'monetization',
          message: `Your withdrawal request for ₹${amount} has been approved and processed.`
        });

        alert(`Withdrawal of ₹${amount} approved.`);
      } else {
        // Refund the user if rejected
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          walletBalance: increment(amount)
        });

        await updateDoc(requestRef, { 
          status: 'rejected',
          rejectionReason: reason || 'No reason provided',
          processedAt: Date.now()
        });

        // Update transaction status
        const txQuery = query(
          collection(db, 'transactions'),
          where('userId', '==', userId),
          where('type', '==', 'withdrawal'),
          where('amount', '==', amount),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc')
        );
        const txSnap = await getDocs(txQuery);
        if (!txSnap.empty) {
          await updateDoc(doc(db, 'transactions', txSnap.docs[0].id), {
            status: 'failed',
            description: `Withdrawal Rejected: ${reason || 'No reason provided'}`
          });
        }

        // Send notification
        sendNotification({
          userId: userId,
          senderId: 'system',
          senderName: 'System',
          senderProfileImage: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
          type: 'monetization',
          message: `Your withdrawal request for ₹${amount} was rejected. Reason: ${reason || 'No reason provided'}. The amount has been refunded to your wallet.`
        });

        alert(`Withdrawal request rejected and refunded.`);
      }
      
      setShowRejectionModal(null);
      setRejectionReason('');
    } catch (error) {
      console.error(error);
      alert("Failed to update withdrawal status");
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = async () => {
    if (!videoToDelete) return;
    const videoId = videoToDelete;
    setVideoToDelete(null);
    setActionLoading(videoId);
    try {
      await deleteDoc(doc(db, 'videos', videoId));
    } catch (error) {
      console.error(error);
      alert("Failed to delete video.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="h-full w-full bg-zinc-950 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="bg-rose-500 p-2 rounded-xl">
            <ShieldCheck className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Admin Console</h2>
            <p className="text-zinc-500 text-xs">REELS KING Management</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-zinc-900 px-4 py-2 rounded-xl border border-white/5 flex flex-col items-end">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Your Wallet</span>
            <div className="flex items-center space-x-1 text-emerald-500 font-black">
              <IndianRupee size={12} />
              <span>{(currentUser.walletBalance || 0).toLocaleString()}</span>
            </div>
          </div>
          {onLogout && (
            <button 
              onClick={onLogout}
              className="flex items-center space-x-2 text-zinc-500 hover:text-rose-500 transition-colors bg-zinc-900 px-4 py-2 rounded-xl border border-white/5"
            >
              <LogOut size={18} />
              <span className="text-sm font-bold">Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl hover:border-zinc-700 transition-colors"
          >
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2 rounded-xl bg-${stat.color}-500/10`}>
                {stat.icon}
              </div>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full uppercase tracking-wider">{stat.trend}</span>
            </div>
            <p className="text-3xl font-black tracking-tight">{stat.value}</p>
            <p className="text-zinc-500 text-xs font-medium mt-1 uppercase tracking-widest">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-white/10">
        <button 
          onClick={() => setActiveTab('stats')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'stats' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('monetization')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'monetization' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Requests
          {pendingUsers.length > 0 && (
            <span className="ml-2 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('monitoring')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'monitoring' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Monitoring
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'users' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Users
        </button>
        <button 
          onClick={() => setActiveTab('videos')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'videos' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Videos
        </button>
        <button 
          onClick={() => setActiveTab('payments')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'payments' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Payments
        </button>
        <button 
          onClick={() => setActiveTab('withdrawals')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'withdrawals' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Withdrawals
          {withdrawalRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="ml-2 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {withdrawalRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('superchats')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'superchats' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Super Chats
        </button>
        <button 
          onClick={() => setActiveTab('wallet')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'wallet' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Wallet
        </button>
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'tasks' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Tasks
          {tasks.filter(t => t.status === 'pending').length > 0 && (
            <span className="ml-2 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {tasks.filter(t => t.status === 'pending').length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('uploads')}
          className={`pb-2 text-sm font-bold transition-colors ${activeTab === 'uploads' ? 'text-white border-b-2 border-rose-500' : 'text-zinc-500'}`}
        >
          Uploads
          {uploads.length > 0 && (
            <span className="ml-2 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {uploads.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'wallet' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[32px]">
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                <Wallet size={24} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Wallet Transfer</h3>
                <p className="text-zinc-500 text-xs">Send money from admin wallet to any user</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Recipient User</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="text"
                    placeholder="Search by name or username..."
                    value={walletSearchQuery}
                    onChange={(e) => setWalletSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  {walletSearchQuery && (
                    <button 
                      onClick={() => setWalletSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {walletSearchQuery && (
                <div className="max-h-60 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-2 space-y-1">
                  {allUsers
                    .filter(u => u.name.toLowerCase().includes(walletSearchQuery.toLowerCase()))
                    .slice(0, 5)
                    .map(u => (
                      <button 
                        key={u.uid}
                        onClick={() => {
                          setShowSendMoneyModal(u);
                          setWalletSearchQuery('');
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-zinc-900 rounded-xl transition-colors text-left"
                      >
                        <div className="flex items-center space-x-3">
                          <img src={u.profileImage} className="w-8 h-8 rounded-full object-cover" />
                          <div>
                            <p className="text-sm font-bold">@{u.name}</p>
                            <p className="text-[10px] text-zinc-500">Balance: ₹{(u.walletBalance || 0).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Select</div>
                      </button>
                    ))
                  }
                  {allUsers.filter(u => u.name.toLowerCase().includes(walletSearchQuery.toLowerCase())).length === 0 && (
                    <p className="text-center py-4 text-zinc-500 text-xs">No users found</p>
                  )}
                </div>
              )}

              <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Admin Wallet Balance</p>
                  <Sparkles size={14} className="text-emerald-500" />
                </div>
                <p className="text-3xl font-black text-white flex items-center space-x-2">
                  <IndianRupee size={24} className="text-emerald-500" />
                  <span>{(currentUser.walletBalance || 0).toLocaleString()}</span>
                </p>
              </div>

              <div className="bg-purple-500/5 border border-purple-500/10 p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Platform Commission Earned</p>
                  <TrendingUp size={14} className="text-purple-500" />
                </div>
                <p className="text-3xl font-black text-white flex items-center space-x-2">
                  <IndianRupee size={24} className="text-purple-500" />
                  <span>{platformRevenue.toLocaleString()}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px]">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Quick Help</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5" />
                <p className="text-xs text-zinc-500">Transfers are instant and deducted from your admin wallet balance.</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5" />
                <p className="text-xs text-zinc-500">Recipients will see the added funds in their wallet immediately.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Task Management</h3>
              <p className="text-[10px] text-zinc-500 mt-1">Moderation and support queue</p>
            </div>
            <button 
              onClick={() => setShowCreateTaskModal(true)}
              className="bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-500/90 transition-colors flex items-center space-x-2 shadow-lg shadow-rose-500/20"
            >
              <Plus size={14} />
              <span>Create Task</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {tasks.length === 0 ? (
              <div className="bg-zinc-900/50 border border-dashed border-zinc-800 p-10 rounded-[32px] text-center">
                <ClipboardList className="mx-auto text-zinc-700 mb-3" size={40} />
                <p className="text-zinc-500 text-sm">No tasks found. Create one to get started.</p>
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] flex flex-col space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`mt-1 p-2 rounded-xl ${
                        task.category === 'moderation' ? 'bg-rose-500/10 text-rose-500' : 
                        task.category === 'support' ? 'bg-blue-500/10 text-blue-500' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {task.category === 'moderation' ? <ShieldCheck size={20} /> : <Users size={20} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{task.title}</h4>
                        <p className="text-xs text-zinc-500 mt-1">{task.description}</p>
                        <div className="flex items-center space-x-3 mt-3">
                          <div className="flex items-center space-x-1 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                            <Clock size={10} />
                            <span>{format(task.createdAt, 'MMM dd, HH:mm')}</span>
                          </div>
                          <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            task.priority === 'high' ? 'bg-rose-500/20 text-rose-500' :
                            task.priority === 'medium' ? 'bg-amber-500/20 text-amber-500' : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {task.priority}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2 inline-block ${
                        task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                        task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold">Assigned to: <span className="text-white">@{task.assignedToName}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center space-x-2">
                      <p className="text-[10px] text-zinc-500 font-bold">Created by: @{task.createdByName}</p>
                    </div>
                    <div className="flex space-x-2">
                      {task.status !== 'completed' && (
                        <>
                          {task.status === 'pending' && (
                            <button 
                              onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                              disabled={actionLoading === task.id}
                              className="bg-blue-500/10 text-blue-500 px-4 py-1.5 rounded-xl text-[10px] font-bold hover:bg-blue-500/20 transition-colors"
                            >
                              Start Task
                            </button>
                          )}
                          {task.status === 'in_progress' && (
                            <button 
                              onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                              disabled={actionLoading === task.id}
                              className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-xl text-[10px] font-bold hover:bg-emerald-500/20 transition-colors"
                            >
                              Complete
                            </button>
                          )}
                        </>
                      )}
                      {task.status === 'completed' && (
                        <div className="flex items-center space-x-1 text-emerald-500 text-[10px] font-bold">
                          <CheckCircle2 size={12} />
                          <span>Finished</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'uploads' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Active Upload Status</h3>
              <p className="text-[10px] text-zinc-500 mt-1">Real-time monitoring of video processing</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-zinc-500 font-bold">{uploads.length} active</span>
            </div>
          </div>
          
          {uploads.length === 0 ? (
            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 p-20 rounded-[40px] text-center">
              <CloudUpload className="mx-auto text-zinc-800 mb-4 opacity-20" size={64} />
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No active uploads in queue</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {uploads.map(upload => (
                <motion.div 
                  key={upload.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] flex flex-col space-y-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-2xl",
                        upload.status === 'uploading' ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" :
                        upload.status === 'completed' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                        "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      )}>
                        {upload.status === 'uploading' && <CloudUpload size={28} className="animate-bounce" />}
                        {upload.status === 'completed' && <CheckCircle2 size={28} />}
                        {upload.status === 'error' && <AlertTriangle size={28} />}
                      </div>
                      <div>
                        <h4 className="font-black text-white uppercase tracking-tight text-lg">{upload.fileName}</h4>
                        <div className="flex items-center space-x-3 mt-1">
                          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">
                            ID: <span className="text-zinc-400">{upload.id}</span>
                          </p>
                          <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">
                            Type: <span className="text-zinc-400">{upload.type}</span>
                          </p>
                          <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">
                            Stage: <span className={cn(
                              "text-zinc-400",
                              upload.stage === 'processing' && "text-amber-500",
                              upload.stage === 'transmitting' && "text-blue-500",
                              upload.stage === 'done' && "text-emerald-500"
                            )}>{upload.stage}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {upload.status === 'uploading' && (
                        <div className="flex items-center space-x-4">
                          <div className="flex flex-col items-end">
                            <span className="text-2xl font-black text-rose-500 tabular-nums">
                              {Math.round(upload.progress)}%
                            </span>
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Transmitting</span>
                          </div>
                          <button 
                            onClick={() => removeUpload(upload.id)}
                            className="bg-rose-500/10 text-rose-500 p-2 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                            title="Cancel upload"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      {upload.status === 'completed' && (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">
                            Success
                          </span>
                          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1">Ready for Feed</span>
                        </div>
                      )}
                      {upload.status === 'error' && (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-4 py-1.5 rounded-full border border-rose-500/20">
                            Failed
                          </span>
                          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1">Check Logs</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {upload.status === 'uploading' && (
                    <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-600 to-rose-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${upload.progress}%` }}
                        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                      />
                    </div>
                  )}

                  {upload.status === 'error' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10 flex items-start space-x-3"
                    >
                      <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-200 font-bold leading-relaxed">{upload.error}</p>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'monetization' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Pending Requests</h3>
            <div className="flex items-center space-x-3">
              {pendingUsers.length > 0 && (
                <button 
                  onClick={handleBulkApprove}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center space-x-2"
                >
                  <CheckCircle size={14} />
                  <span>Approve All ({pendingUsers.length})</span>
                </button>
              )}
              <span className="text-xs text-zinc-500">{pendingUsers.length} total</span>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-rose-500" />
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 p-10 rounded-2xl text-center">
              <CheckCircle className="mx-auto text-zinc-700 mb-3" size={40} />
              <p className="text-zinc-500 text-sm">No pending requests at the moment.</p>
            </div>
          ) : (
            pendingUsers.map(user => (
              <div key={user.uid} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center space-x-3">
                  <img src={user.profileImage} className="w-10 h-10 rounded-full object-cover border border-zinc-800" alt="" />
                  <div>
                    <p className="font-bold text-sm">@{user.name}</p>
                    <p className="text-[10px] text-zinc-500">
                      {(user.followersCount || 0).toLocaleString()} followers • {(user.totalViews || 0).toLocaleString()} views
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {actionLoading === user.uid ? (
                    <div className="p-2">
                      <Loader2 size={20} className="animate-spin text-zinc-500" />
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleMonetizationAction(user.uid, 'approved')}
                        className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
                        title="Approve"
                      >
                        <CheckCircle size={20} />
                      </button>
                      <button 
                        onClick={() => handleMonetizationAction(user.uid, 'rejected')}
                        className="p-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500/20 transition-colors"
                        title="Reject"
                      >
                        <XCircle size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Profile Monitoring Tool</h3>
            <div className="flex space-x-2">
              <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full uppercase">
                <CheckCircle size={10} />
                <span>Approved: {allUsers.filter(u => u.monetizationStatus === 'approved').length}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {allUsers.map(user => (
              <div key={user.uid} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img src={user.profileImage} className="w-14 h-14 rounded-2xl object-cover border border-white/5" alt="" />
                    <div>
                      <h4 className="font-bold text-lg">@{user.name}</h4>
                      <p className="text-xs text-zinc-500">{user.mobile}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Status</p>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                      user.monetizationStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 
                      user.monetizationStatus === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {user.monetizationStatus}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 py-4 border-y border-white/5">
                  <div className="text-center">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Reach</p>
                    <p className="font-black">{(user.totalViews || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center border-x border-white/5">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Wallet</p>
                    <p className="font-black text-emerald-500">₹{(user.walletBalance || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Violations</p>
                    <p className={`font-black ${user.policyViolations > 0 ? 'text-rose-500' : 'text-zinc-500'}`}>{user.policyViolations}</p>
                  </div>
                </div>

                <div className="flex space-x-3">
                  {user.monetizationStatus !== 'approved' ? (
                    <button 
                      onClick={() => handleMonetizationAction(user.uid, 'approved')}
                      className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-bold text-xs hover:bg-emerald-600 transition-colors"
                    >
                      Approve Monitoring
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleMonetizationAction(user.uid, 'rejected')}
                      className="flex-1 bg-rose-500/10 text-rose-500 py-3 rounded-2xl font-bold text-xs hover:bg-rose-500/20 transition-colors"
                    >
                      Revoke Monitoring
                    </button>
                  )}
                  <button 
                    onClick={() => setShowSendMoneyModal(user)}
                    disabled={user.monetizationStatus !== 'approved'}
                    className="flex-1 bg-zinc-800 text-white py-3 rounded-2xl font-bold text-xs hover:bg-zinc-700 transition-colors disabled:opacity-50"
                  >
                    Send Money
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">User Management</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input 
                type="text"
                placeholder="Search users..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-9 pr-8 text-xs focus:outline-none focus:border-rose-500 transition-colors w-48"
              />
              {userSearchQuery && (
                <button 
                  onClick={() => setUserSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {allUsers
              .filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()))
              .map(user => (
              <div key={user.uid} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img src={user.profileImage} className="w-10 h-10 rounded-full object-cover" alt="" />
                  <div>
                    <p className="font-bold text-sm">{user.name}</p>
                    <p className="text-[10px] text-zinc-500">{user.role.toUpperCase()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleUserAction(user.uid, user.role === 'user')}
                  className={`p-2 rounded-lg transition-colors ${user.role === 'user' ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}
                >
                  {user.role === 'user' ? <Ban size={18} /> : <CheckCircle size={18} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'videos' && (
        <div className="space-y-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Manage Videos</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                <input 
                  type="text"
                  placeholder="Search caption or username..."
                  value={videoSearchQuery}
                  onChange={(e) => setVideoSearchQuery(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-9 pr-8 text-xs focus:outline-none focus:border-rose-500 transition-colors w-56"
                />
                {videoSearchQuery && (
                  <button 
                    onClick={() => setVideoSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center space-x-2 text-zinc-500 mr-2">
                <Calendar size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Filter by Date</span>
              </div>
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-white/5">
                {[
                  { id: 'all', label: 'All Time' },
                  { id: '7d', label: 'Last 7 Days' },
                  { id: '30d', label: 'Last 30 Days' },
                  { id: 'custom', label: 'Custom Range' }
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setVideoDateFilter(filter.id as any)}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                      videoDateFilter === filter.id 
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {videoDateFilter === 'custom' && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center space-x-2"
                >
                  <input 
                    type="date" 
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="bg-zinc-950 border border-white/5 rounded-lg px-2 py-1 text-[10px] font-bold text-zinc-300 focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-zinc-600 text-[10px] font-bold">to</span>
                  <input 
                    type="date" 
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="bg-zinc-950 border border-white/5 rounded-lg px-2 py-1 text-[10px] font-bold text-zinc-300 focus:outline-none focus:border-rose-500"
                  />
                </motion.div>
              )}

              <div className="flex items-center space-x-2 text-zinc-500 ml-4 mr-2">
                <TrendingUp size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Sort By</span>
              </div>
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-white/5">
                {[
                  { id: 'createdAt', label: 'Date' },
                  { id: 'viewsCount', label: 'Views' },
                  { id: 'likesCount', label: 'Likes' },
                  { id: 'commentsCount', label: 'Comments' }
                ].map((sort) => (
                  <button
                    key={sort.id}
                    onClick={() => {
                      if (videoSortField === sort.id) {
                        setVideoSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      } else {
                        setVideoSortField(sort.id as any);
                        setVideoSortOrder('desc');
                      }
                    }}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center space-x-1 ${
                      videoSortField === sort.id 
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span>{sort.label}</span>
                    {videoSortField === sort.id && (
                      videoSortOrder === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {allVideos
              .filter(v => {
                const caption = v.caption || '';
                const userName = v.userName || '';
                const matchesSearch = caption.toLowerCase().includes(videoSearchQuery.toLowerCase()) || 
                                    userName.toLowerCase().includes(videoSearchQuery.toLowerCase());
                
                if (!matchesSearch) return false;

                const videoDate = v.createdAt || 0;
                const now = Date.now();

                if (videoDateFilter === '7d') {
                  return videoDate >= now - 7 * 24 * 60 * 60 * 1000;
                }
                if (videoDateFilter === '30d') {
                  return videoDate >= now - 30 * 24 * 60 * 60 * 1000;
                }
                if (videoDateFilter === 'custom') {
                  const start = customDateRange.start ? new Date(customDateRange.start).getTime() : 0;
                  const end = customDateRange.end ? new Date(customDateRange.end).getTime() + 86400000 : Infinity;
                  
                  // If custom is selected but no dates picked yet, don't filter by date
                  if (!customDateRange.start && !customDateRange.end) return true;
                  
                  return videoDate >= (isNaN(start) ? 0 : start) && videoDate <= (isNaN(end) ? Infinity : end);
                }
                return true;
              })
              .sort((a, b) => {
                const fieldA = a[videoSortField] || 0;
                const fieldB = b[videoSortField] || 0;
                if (videoSortOrder === 'desc') {
                  return (fieldB as number) - (fieldA as number);
                }
                return (fieldA as number) - (fieldB as number);
              })
              .map(video => (
              <div key={video.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden group hover:border-zinc-700 transition-all">
                <div className="aspect-[9/16] relative">
                  <img src={video.thumbnailUrl || `https://picsum.photos/seed/${video.id}/300/533`} className="w-full h-full object-cover" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button 
                    onClick={() => handleDeleteVideo(video.id)}
                    className="absolute top-3 right-3 p-2.5 bg-black/50 backdrop-blur-md text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:scale-110"
                  >
                    <Trash2 size={18} />
                  </button>

                  {/* Status Indicator */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {video.status === 'processing' ? (
                      <div className="bg-amber-500/20 backdrop-blur-md border border-amber-500/30 text-amber-500 px-2 py-1 rounded-lg flex items-center space-x-1.5 shadow-lg">
                        <Loader2 size={10} className="animate-spin" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Processing</span>
                      </div>
                    ) : video.status === 'failed' ? (
                      <div className="bg-rose-500/20 backdrop-blur-md border border-rose-500/30 text-rose-500 px-2 py-1 rounded-lg flex items-center space-x-1.5 shadow-lg">
                        <AlertTriangle size={10} />
                        <span className="text-[8px] font-black uppercase tracking-widest">Failed</span>
                      </div>
                    ) : (
                      <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-500 px-2 py-1 rounded-lg flex items-center space-x-1.5 shadow-lg">
                        <CheckCircle2 size={10} />
                        <span className="text-[8px] font-black uppercase tracking-widest">Ready</span>
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    <p className="text-[10px] font-black text-white truncate">@{video.userName}</p>
                    <p className="text-[9px] text-zinc-300 font-bold mt-0.5">{video.createdAt ? format(video.createdAt, 'MMM dd, yyyy') : 'Unknown'}</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs text-zinc-400 line-clamp-2 font-medium leading-relaxed">{video.caption}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center space-x-1 text-[10px] text-zinc-500 font-bold">
                      <TrendingUp size={10} className="text-emerald-500" />
                      <span>{(video.viewsCount || 0).toLocaleString()}</span>
                    </div>
                    <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                      {video.boosted ? 'Boosted' : 'Organic'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {allVideos.filter(v => {
            const matchesSearch = v.caption.toLowerCase().includes(videoSearchQuery.toLowerCase()) || 
                                v.userName.toLowerCase().includes(videoSearchQuery.toLowerCase());
            if (!matchesSearch) return false;
            const videoDate = v.createdAt || 0;
            const now = Date.now();
            if (videoDateFilter === '7d') return videoDate >= now - 7 * 24 * 60 * 60 * 1000;
            if (videoDateFilter === '30d') return videoDate >= now - 30 * 24 * 60 * 60 * 1000;
            if (videoDateFilter === 'custom') {
              const start = customDateRange.start ? new Date(customDateRange.start).getTime() : 0;
              const end = customDateRange.end ? new Date(customDateRange.end).getTime() + 86400000 : Infinity;
              if (!customDateRange.start && !customDateRange.end) return true;
              return videoDate >= (isNaN(start) ? 0 : start) && videoDate <= (isNaN(end) ? Infinity : end);
            }
            return true;
          }).length === 0 && (
            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 p-20 rounded-[40px] text-center">
              <Video className="mx-auto text-zinc-800 mb-4" size={48} />
              <p className="text-zinc-500 font-bold">No videos found for the selected criteria.</p>
              <button 
                onClick={() => {setVideoDateFilter('all'); setVideoSearchQuery('');}}
                className="mt-4 text-rose-500 text-xs font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px]">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center">
                <Rocket size={16} className="mr-2 text-amber-500" /> Boost Revenue (100%)
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {transactions.map(tx => (
                  <div key={tx.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{tx.planName}</p>
                      <p className="text-[10px] text-zinc-500">@{tx.userId.slice(0, 8)} • {format(tx.createdAt, 'dd MMM yyyy')}</p>
                    </div>
                    <p className="font-black text-emerald-500">₹{tx.amount}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px]">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center">
                <Sparkles size={16} className="mr-2 text-rose-500" /> Super Chat Comm. (30%)
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {superChats.map(chat => (
                  <div key={chat.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">Gift from @{chat.senderName}</p>
                      <p className="text-[10px] text-zinc-500">to @{chat.receiverName} • {format(chat.createdAt, 'dd MMM yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-500">₹{(chat.amount * 0.3).toFixed(2)}</p>
                      <p className="text-[8px] text-zinc-500 uppercase font-bold">Total: ₹{chat.amount}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'withdrawals' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Withdrawal Requests</h3>
          {withdrawalRequests.length === 0 ? (
            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 p-10 rounded-[32px] text-center">
              <Landmark className="mx-auto text-zinc-700 mb-3" size={40} />
              <p className="text-zinc-500 text-sm">No withdrawal requests found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawalRequests.map(request => (
                <div key={request.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] flex flex-col space-y-4">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedWithdrawalId(expandedWithdrawalId === request.id ? null : request.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center">
                        <DollarSign className="text-emerald-500" size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-sm">@{request.userName}</p>
                        <p className="text-[10px] text-zinc-500">{format(request.createdAt, 'dd MMM yyyy, HH:mm')}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-xl font-black text-white">₹{request.amount}</p>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          request.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 
                          request.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="text-zinc-500">
                        {expandedWithdrawalId === request.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedWithdrawalId === request.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-black/40 p-4 rounded-2xl border border-white/5 grid grid-cols-2 gap-4 mt-2">
                          <div className="col-span-2 flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                            <p className="text-[10px] text-rose-500 uppercase font-black tracking-widest">
                              {request.bankDetails?.payoutType === 'international' ? 'International Payout' : 'Domestic Payout'}
                            </p>
                            {request.bankDetails?.payoutType === 'international' && request.bankDetails?.country && (
                              <span className="text-[10px] font-bold text-zinc-400">{request.bankDetails.country}</span>
                            )}
                          </div>

                          {request.bankDetails?.payoutType === 'international' ? (
                            <>
                              <div className="col-span-2">
                                <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">PayPal Email</p>
                                <p className="text-xs font-bold">{request.bankDetails?.paypalEmail || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">SWIFT / BIC</p>
                                <p className="text-xs font-bold">{request.bankDetails?.swiftCode || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Country</p>
                                <p className="text-xs font-bold">{request.bankDetails?.country || 'N/A'}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">IBAN / International A/C</p>
                                <p className="text-xs font-bold tracking-wider">{request.bankDetails?.iban || 'N/A'}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="col-span-2">
                                <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Account Holder Name</p>
                                <p className="text-xs font-bold">{request.bankDetails?.accountHolderName || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Bank Name</p>
                                <p className="text-xs font-bold">{request.bankDetails?.bankName || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">IFSC Code</p>
                                <p className="text-xs font-bold">{request.bankDetails?.ifsc || 'N/A'}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[8px] text-zinc-500 uppercase font-bold mb-1">Account Number</p>
                                <p className="text-xs font-bold tracking-wider">{request.bankDetails?.accountNumber || 'N/A'}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {request.status === 'pending' && (
                    <div className="flex space-x-3">
                      <button 
                        onClick={() => handleWithdrawalAction(request.id, 'approved')}
                        disabled={actionLoading === request.id}
                        className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-bold text-xs hover:bg-emerald-600 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === request.id ? <Loader2 className="animate-spin" size={16} /> : 'Approve & Pay'}
                      </button>
                      <button 
                        onClick={() => setShowRejectionModal(request.id)}
                        disabled={actionLoading === request.id}
                        className="flex-1 bg-rose-500/10 text-rose-500 py-3 rounded-2xl font-bold text-xs hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {request.status === 'rejected' && request.rejectionReason && (
                    <div className="mt-2 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                      <p className="text-[8px] text-rose-500 uppercase font-bold mb-1">Rejection Reason</p>
                      <p className="text-xs text-rose-200/60">{request.rejectionReason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'superchats' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Super Chat Transactions</h3>
          {superChats.length === 0 ? (
            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 p-10 rounded-[32px] text-center">
              <Sparkles className="mx-auto text-zinc-700 mb-3" size={40} />
              <p className="text-zinc-500 text-sm">No Super Chat transactions found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {superChats.map(chat => (
                <div key={chat.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center">
                        <Gift className="text-amber-500" size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          <span className="text-zinc-500">From</span> @{chat.senderName} 
                          <span className="text-zinc-500 mx-1">to</span> @{chat.receiverName}
                        </p>
                        <p className="text-[10px] text-zinc-500">{format(chat.createdAt, 'dd MMM yyyy, HH:mm')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-amber-500">₹{chat.amount}</p>
                    </div>
                  </div>
                  {chat.message && (
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Message</p>
                      <p className="text-xs text-zinc-300 italic">"{chat.message}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold">Revenue Analytics</h3>
                <p className="text-zinc-500 text-xs">Platform commission from video boosts</p>
              </div>
              <div className="flex items-center space-x-2 bg-zinc-950 p-1 rounded-lg border border-white/5">
                <button className="px-3 py-1 text-[10px] font-bold bg-rose-500 text-white rounded-md">7D</button>
                <button className="px-3 py-1 text-[10px] font-bold text-zinc-500">30D</button>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#71717a" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#71717a" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                    itemStyle={{ color: '#F43F5E', fontWeight: 'bold' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#F43F5E" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px]">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">User Distribution</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Creators', value: allUsers.filter(u => u.monetizationStatus === 'approved').length },
                    { name: 'Regular', value: allUsers.filter(u => u.monetizationStatus !== 'approved').length },
                    { name: 'Pending', value: pendingUsers.length }
                  ]}>
                    <XAxis dataKey="name" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      <Cell fill="#10b981" />
                      <Cell fill="#3b82f6" />
                      <Cell fill="#f59e0b" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px]">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Recent Actions</h3>
              <div className="space-y-3">
                <ActionItem user="amit_99" action="Banned for policy violation" time="2m ago" type="ban" />
                <ActionItem user="neha_dance" action="Video deleted (Copyright)" time="15m ago" type="delete" />
                <ActionItem user="vicky_vlogs" action="Monetization approved" time="1h ago" type="approve" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateTaskModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateTaskModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Create New Task</h3>
                <button onClick={() => setShowCreateTaskModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Task Title</label>
                  <input 
                    type="text"
                    placeholder="e.g., Review reported video #123"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Description</label>
                  <textarea 
                    placeholder="Details about the task..."
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-rose-500 transition-colors h-24 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Category</label>
                    <select 
                      value={newTask.category}
                      onChange={(e) => setNewTask(prev => ({ ...prev, category: e.target.value as any }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-rose-500 transition-colors"
                    >
                      <option value="moderation">Moderation</option>
                      <option value="support">Support</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Priority</label>
                    <select 
                      value={newTask.priority}
                      onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-rose-500 transition-colors"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Assign To</label>
                  <select 
                    value={newTask.assignedToId}
                    onChange={(e) => setNewTask(prev => ({ ...prev, assignedToId: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-rose-500 transition-colors"
                  >
                    <option value="">Select Admin</option>
                    {allUsers.filter(u => u.role === 'admin').map(admin => (
                      <option key={admin.uid} value={admin.uid}>@{admin.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-8">
                <button 
                  onClick={handleCreateTask}
                  disabled={!newTask.title || !newTask.assignedToId || actionLoading === 'create_task'}
                  className="w-full bg-rose-500 text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {actionLoading === 'create_task' ? <Loader2 className="animate-spin" /> : <span>Create Task</span>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Send Money Modal */}
      <AnimatePresence>
        {showSendMoneyModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSendMoneyModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-2xl"
            >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <DollarSign className="text-emerald-500" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-1">Send Money</h3>
              <div className="flex flex-col items-center mb-6">
                <p className="text-zinc-500 text-sm mb-4">Transfer to @{showSendMoneyModal.name}</p>
                
                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                    <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mb-1">Admin Balance</p>
                    <div className="flex items-center justify-center space-x-1 text-white font-black">
                      <IndianRupee size={12} />
                      <span>{(currentUser.walletBalance || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10 text-center">
                    <p className="text-[8px] text-emerald-500 uppercase font-black tracking-widest mb-1">User Balance</p>
                    <div className="flex items-center justify-center space-x-1 text-emerald-500 font-black">
                      <IndianRupee size={12} />
                      <span>{(showSendMoneyModal.walletBalance || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">₹</span>
                  <input 
                    type="number"
                    placeholder="Amount"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-10 pr-4 focus:outline-none focus:border-emerald-500 transition-colors font-bold text-xl"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-3">
                <button 
                  onClick={() => setShowTransferConfirm(true)}
                  disabled={!sendAmount || actionLoading === showSendMoneyModal.uid}
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <span>Continue</span>
                </button>
                <button 
                  onClick={() => setShowSendMoneyModal(null)}
                  className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-bold hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transfer Confirmation Modal */}
      <AnimatePresence>
        {showTransferConfirm && showSendMoneyModal && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTransferConfirm(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="text-amber-500" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Confirm Transfer?</h3>
              <p className="text-zinc-400 text-sm mb-6">
                Are you sure you want to transfer <span className="text-white font-bold">₹{parseFloat(sendAmount).toLocaleString()}</span> to <span className="text-white font-bold">@{showSendMoneyModal.name}</span>? This action cannot be undone.
              </p>
              
              <div className="flex flex-col space-y-3">
                <button 
                  onClick={handleSendMoney}
                  disabled={actionLoading === showSendMoneyModal.uid}
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {actionLoading === showSendMoneyModal.uid ? <Loader2 className="animate-spin" /> : <span>Yes, Transfer Now</span>}
                </button>
                <button 
                  onClick={() => setShowTransferConfirm(false)}
                  className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-bold hover:bg-zinc-700 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {videoToDelete && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVideoToDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="text-rose-500" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Video?</h3>
              <p className="text-zinc-500 text-sm mb-8">This action cannot be undone. The video will be permanently removed from the platform.</p>
              
              <div className="flex flex-col space-y-3">
                <button 
                  onClick={confirmDelete}
                  disabled={actionLoading === videoToDelete}
                  className="w-full bg-rose-500 text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {actionLoading === videoToDelete ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Yes, Delete Video</span>
                  )}
                </button>
                <button 
                  onClick={() => setVideoToDelete(null)}
                  className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-bold hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Reason Modal */}
      <AnimatePresence>
        {showRejectionModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRejectionModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="text-rose-500" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-1">Reject Request</h3>
              <p className="text-zinc-500 text-sm mb-6">Please provide a reason for rejection.</p>
              
              <div className="space-y-4 mb-8">
                <textarea 
                  placeholder="Rejection reason..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 focus:outline-none focus:border-rose-500 transition-colors text-sm min-h-[100px] resize-none"
                />
              </div>

              <div className="flex flex-col space-y-3">
                <button 
                  onClick={() => handleWithdrawalAction(showRejectionModal, 'rejected', rejectionReason)}
                  disabled={!rejectionReason || actionLoading === showRejectionModal}
                  className="w-full bg-rose-500 text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {actionLoading === showRejectionModal ? <Loader2 className="animate-spin" /> : <span>Confirm Rejection</span>}
                </button>
                <button 
                  onClick={() => setShowRejectionModal(null)}
                  className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-bold hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function ActionItem({ user, action, time, type }: { user: string, action: string, time: string, type: 'ban' | 'delete' | 'approve' }) {
  const icons = {
    ban: <Ban size={14} className="text-rose-500" />,
    delete: <Trash2 size={14} className="text-amber-500" />,
    approve: <CheckCircle size={14} className="text-emerald-500" />
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
          {icons[type]}
        </div>
        <div>
          <p className="text-xs font-bold">@{user}</p>
          <p className="text-[10px] text-zinc-500">{action}</p>
        </div>
      </div>
      <span className="text-[10px] text-zinc-600 font-medium">{time}</span>
    </div>
  );
}
