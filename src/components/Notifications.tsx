import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, UserPlus, DollarSign, Bell, X, Trash2, CheckCircle2 } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../utils';

interface NotificationsProps {
  userId: string;
  onUserClick?: (uid: string) => void;
  onVideoClick?: (videoId: string) => void;
}

export const Notifications: React.FC<NotificationsProps> = ({ userId, onUserClick, onVideoClick }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      setNotifications(fetched);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like': return <Heart className="text-rose-500" size={16} />;
      case 'comment': return <MessageCircle className="text-blue-500" size={16} />;
      case 'follow': return <UserPlus className="text-emerald-500" size={16} />;
      case 'monetization': return <DollarSign className="text-amber-500" size={16} />;
      default: return <Bell className="text-zinc-400" size={16} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="px-6 py-6 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Notifications</h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
            {notifications.filter(n => !n.read).length} Unread Updates
          </p>
        </div>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllAsRead}
            className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 group"
          >
            <CheckCircle2 size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white">Mark all read</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full"
            />
          </div>
        ) : notifications.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
            <div className="w-20 h-20 bg-zinc-900 rounded-[32px] flex items-center justify-center border border-white/5">
              <Bell size={40} className="opacity-20" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest">No notifications yet</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((notification) => (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "group relative p-4 rounded-[24px] border transition-all duration-300",
                  notification.read 
                    ? "bg-zinc-900/30 border-white/5 opacity-60" 
                    : "bg-zinc-900 border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.05)]"
                )}
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <div className="flex items-start space-x-4">
                  {/* Sender Avatar */}
                  <div className="relative shrink-0">
                    <img 
                      src={notification.senderProfileImage} 
                      alt={notification.senderName}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUserClick?.(notification.senderId);
                      }}
                      className="w-12 h-12 rounded-2xl object-cover border border-white/10 cursor-pointer hover:scale-105 transition-transform"
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-zinc-950 rounded-lg flex items-center justify-center border border-white/10 shadow-lg">
                      {getIcon(notification.type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span 
                        className="text-xs font-black text-white hover:text-rose-500 cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUserClick?.(notification.senderId);
                        }}
                      >
                        @{notification.senderName}
                      </span>
                      <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                        {formatDistanceToNow(notification.createdAt)} ago
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 leading-tight mb-2">
                      {notification.message}
                    </p>
                  </div>

                  {/* Video Thumbnail if applicable */}
                  {notification.videoId && notification.videoThumbnail && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onVideoClick?.(notification.videoId!);
                      }}
                      className="w-14 h-20 rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:scale-105 transition-transform shrink-0"
                    >
                      <img src={notification.videoThumbnail} className="w-full h-full object-cover" alt="Post" />
                    </div>
                  )}

                  {/* Delete Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    className="absolute top-4 right-4 p-2 text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
