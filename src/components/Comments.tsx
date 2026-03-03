import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, MessageCircle } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Comment, User } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface CommentsProps {
  videoId: string;
  onClose: () => void;
  onUserClick?: (uid: string) => void;
}

export const Comments: React.FC<CommentsProps> = ({ videoId, onClose, onUserClick }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('videoId', '==', videoId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Comment));
      setComments(fetchedComments);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [videoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !auth.currentUser || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        throw new Error("User profile not found");
      }

      const userData = userSnap.data() as User;
      
      const commentData = {
        videoId,
        userId: auth.currentUser.uid,
        userName: userData.name || 'User',
        userProfileImage: userData.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser.uid}`,
        text: newComment.trim(),
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'comments'), commentData);
      
      // Update comment count on video
      const videoRef = doc(db, 'videos', videoId);
      await updateDoc(videoRef, {
        commentsCount: increment(1)
      });

      setNewComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-x-0 bottom-0 h-[70%] bg-zinc-900 rounded-t-[32px] z-[60] flex flex-col shadow-2xl border-t border-white/10"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-bold text-white">{comments.length} Comments</span>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <X size={20} className="text-zinc-400" />
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-rose-500" />
          </div>
        ) : comments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
            <MessageCircle size={48} className="opacity-20" />
            <p className="text-sm">No comments yet. Be the first to say something!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex space-x-3">
              <img 
                src={comment.userProfileImage} 
                alt={comment.userName}
                onClick={() => onUserClick?.(comment.userId)}
                className="w-10 h-10 rounded-full object-cover border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span 
                    className="text-xs font-bold text-zinc-400 cursor-pointer hover:text-rose-400 transition-colors"
                    onClick={() => onUserClick?.(comment.userId)}
                  >
                    @{comment.userName}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {formatDistanceToNow(comment.createdAt)} ago
                  </span>
                </div>
                <p className="text-sm text-white leading-relaxed">{comment.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-6 border-t border-white/5 bg-zinc-900/50 backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full bg-zinc-800 border border-white/5 rounded-2xl py-4 pl-6 pr-14 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-rose-500 disabled:text-zinc-600 transition-colors"
          >
            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </motion.div>
  );
};
