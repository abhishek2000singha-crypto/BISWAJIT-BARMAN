import React, { useState, useEffect } from 'react';
import { Home, Search, PlusSquare, Heart, User as UserIcon, LayoutDashboard, Loader2, CloudUpload, CheckCircle2, AlertCircle, X, MessageSquare, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './services/firebase';
import { onSnapshot, doc, getDoc, setDoc, collection, query, where } from 'firebase/firestore';
import { Feed } from './components/Feed';
import { Profile } from './components/Profile';
import { Upload } from './components/Upload';
import { AdminPanel } from './components/AdminPanel';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';
import { Discover } from './components/Discover';
import { Notifications } from './components/Notifications';
import { useUpload } from './contexts/UploadContext';
import { cn } from './utils';

export default function App() {
  const { uploads, removeUpload } = useUpload();
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'upload' | 'profile' | 'admin' | 'messages' | 'notifications'>('home');
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);
  const [preSelectedChatUserId, setPreSelectedChatUserId] = useState<string | null>(null);
  const [initialVideoId, setInitialVideoId] = useState<string | null>(null);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (user && activeTab !== 'upload') {
        setIsDraggingGlobal(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Only hide if we're leaving the window or the overlay
      if (e.relatedTarget === null) {
        setIsDraggingGlobal(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingGlobal(false);
      
      if (user && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/')) {
          setActiveTab('upload');
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [user, activeTab]);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;
    let unsubscribeNotifications: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Initial check/creation
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          const newUser = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || `User_${firebaseUser.uid.slice(0, 5)}`,
            mobile: firebaseUser.phoneNumber || '',
            profileImage: firebaseUser.photoURL || 'https://picsum.photos/seed/me/200/200',
            followersCount: 0,
            followingCount: 0,
            totalLikes: 0,
            totalViews: 0,
            role: 'user',
            monetizationStatus: 'none',
            policyViolations: 0,
            walletBalance: 0,
            superChatBalance: 0,
            bio: '',
            website: '',
            socialLinks: {
              instagram: '',
              twitter: '',
              youtube: ''
            },
            createdAt: Date.now()
          };
          await setDoc(userRef, newUser);
          setUser(newUser);
        }

        // Real-time listener
        unsubscribeSnapshot = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            setUser(doc.data());
          }
        });

        // Notifications listener
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', firebaseUser.uid),
          where('read', '==', false)
        );
        unsubscribeNotifications = onSnapshot(q, (snapshot) => {
          setUnreadNotificationsCount(snapshot.size);
        });
      } else {
        setUser(null);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        if (unsubscribeNotifications) unsubscribeNotifications();
      }
      setInitializing(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'profile') {
      setViewingProfileId(null);
    }
  }, [activeTab]);

  const handleLogout = async () => {
    await signOut(auth);
    setActiveTab('home');
  };

  if (initializing) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-rose-500" size={40} />
      </div>
    );
  }

  const renderContent = () => {
    if (!user && activeTab !== 'home') return <Auth onLogin={setUser} onCancel={() => setActiveTab('home')} />;
    
    switch (activeTab) {
      case 'home': return (
        <Feed 
          currentUser={user} 
          initialVideoId={initialVideoId || undefined}
          onUserClick={(uid) => {
            setViewingProfileId(uid);
            setActiveTab('profile');
          }} 
        />
      );
      case 'discover': return (
        <Discover 
          onUserClick={(uid) => {
            setViewingProfileId(uid);
            setActiveTab('profile');
          }}
          onVideoClick={(video) => {
            setInitialVideoId(video.id);
            setActiveTab('home');
          }}
        />
      );
      case 'upload': return <Upload user={user} onComplete={() => setActiveTab('home')} />;
      case 'profile': return (
        <Profile 
          user={user} 
          onLogout={handleLogout} 
          viewingUserId={viewingProfileId || undefined} 
          onBack={() => {
            setViewingProfileId(null);
            setActiveTab('home');
          }}
          onNavigate={(uid) => setViewingProfileId(uid)}
          onMessageClick={(uid) => {
            setPreSelectedChatUserId(uid);
            setActiveTab('messages');
            setViewingProfileId(null);
          }}
        />
      );
      case 'admin': return <AdminPanel currentUser={user} onLogout={handleLogout} />;
      case 'messages': return <Chat currentUser={user} preSelectedUserId={preSelectedChatUserId || undefined} />;
      case 'notifications': return (
        <Notifications 
          userId={user.uid} 
          onUserClick={(uid) => {
            setViewingProfileId(uid);
            setActiveTab('profile');
          }}
          onVideoClick={(videoId) => {
            setInitialVideoId(videoId);
            setActiveTab('home');
          }}
        />
      );
      default: return <Feed onUserClick={(uid) => {
        setViewingProfileId(uid);
        setActiveTab('profile');
      }} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white max-w-md mx-auto relative overflow-hidden shadow-2xl border-x border-white/10">
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {renderContent()}
      </main>

      {/* Global Drag Overlay */}
      <AnimatePresence>
        {isDraggingGlobal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-rose-500/20 backdrop-blur-xl flex items-center justify-center p-8 pointer-events-none"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full aspect-[9/16] border-4 border-dashed border-white/40 rounded-[40px] flex flex-col items-center justify-center text-center space-y-6"
            >
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-2xl">
                <CloudUpload size={48} className="animate-bounce" />
              </div>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter italic">Drop to Upload</h2>
                <p className="text-white/60 font-bold uppercase tracking-widest text-xs mt-2">Release video to start creating</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && viewingProfileId && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowProfileModal(false);
                setViewingProfileId(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full h-[90vh] bg-black rounded-t-[40px] overflow-hidden border-t border-white/10 shadow-2xl"
            >
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-zinc-800 rounded-full z-[110]" />
              <Profile 
                user={user} 
                onLogout={handleLogout} 
                viewingUserId={viewingProfileId} 
                onBack={() => {
                  setShowProfileModal(false);
                  setViewingProfileId(null);
                }}
                onNavigate={(uid) => setViewingProfileId(uid)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Background Uploads Status */}
      <div className="absolute bottom-20 left-4 right-4 z-[60] pointer-events-none">
        <AnimatePresence>
          {uploads.map((upload) => (
            <motion.div
              key={upload.id}
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              className="bg-zinc-900/95 backdrop-blur-2xl border border-white/10 p-4 rounded-[24px] shadow-2xl mb-3 pointer-events-auto ring-1 ring-white/5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                    upload.status === 'uploading' ? "bg-rose-500/20 text-rose-500" :
                    upload.status === 'completed' ? "bg-emerald-500/20 text-emerald-500" :
                    "bg-rose-500/20 text-rose-500"
                  )}>
                    {upload.status === 'uploading' && <CloudUpload size={18} className="animate-bounce" />}
                    {upload.status === 'completed' && <CheckCircle2 size={18} />}
                    {upload.status === 'error' && <AlertCircle size={18} />}
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-white truncate max-w-[140px] uppercase tracking-wider">{upload.fileName}</p>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      {upload.status === 'uploading' ? 'Uploading to Cloud' : upload.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {upload.status === 'uploading' && (
                    <span className="text-[11px] font-black text-rose-500 tabular-nums">
                      {Math.round(upload.progress)}%
                    </span>
                  )}
                  {upload.status !== 'uploading' && (
                    <button 
                      onClick={() => removeUpload(upload.id)} 
                      className="w-6 h-6 bg-white/5 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
              
              {upload.status === 'uploading' && (
                <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-600 to-rose-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${upload.progress}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  />
                </div>
              )}
              
              {upload.status === 'error' && (
                <div className="mt-2 p-2 bg-rose-500/10 rounded-lg border border-rose-500/20">
                  <p className="text-[9px] text-rose-200 font-bold leading-tight">{upload.error}</p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <nav className="h-16 bg-black border-t border-white/10 flex items-center justify-around px-2 z-50">
        <NavButton 
          icon={<Home size={24} />} 
          label="Home" 
          active={activeTab === 'home'} 
          onClick={() => {
            setInitialVideoId(null);
            setActiveTab('home');
          }} 
        />
        <NavButton 
          icon={<Search size={24} />} 
          label="Discover" 
          active={activeTab === 'discover'} 
          onClick={() => setActiveTab('discover')} 
        />
        <NavButton 
          icon={<MessageSquare size={24} />} 
          label="Messages" 
          active={activeTab === 'messages'} 
          onClick={() => setActiveTab('messages')} 
        />
        <NavButton 
          icon={<Bell size={24} />} 
          label="Inbox" 
          active={activeTab === 'notifications'} 
          onClick={() => setActiveTab('notifications')} 
          badge={unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined}
        />
        <button 
          onClick={() => setActiveTab('upload')}
          className="flex flex-col items-center justify-center -mt-4"
        >
          <div className="bg-white text-black p-2 rounded-lg shadow-lg hover:scale-110 transition-transform">
            <PlusSquare size={28} />
          </div>
        </button>
        {user?.role === 'admin' && (
          <NavButton 
            icon={<LayoutDashboard size={24} />} 
            label="Admin" 
            active={activeTab === 'admin'} 
            onClick={() => setActiveTab('admin')} 
          />
        )}
        <NavButton 
          icon={<UserIcon size={24} />} 
          label="Profile" 
          active={activeTab === 'profile'} 
          onClick={() => setActiveTab('profile')} 
        />
      </nav>
    </div>
  );
}

function NavButton({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center space-y-1 transition-colors relative ${active ? 'text-white' : 'text-zinc-500'}`}
    >
      {icon}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-black">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <span className="text-[10px] font-medium">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-indicator" 
          className="w-1 h-1 bg-white rounded-full"
        />
      )}
    </button>
  );
}
