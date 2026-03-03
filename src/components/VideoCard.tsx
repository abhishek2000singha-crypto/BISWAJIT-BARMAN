import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Music2, UserPlus, CheckCircle2, Check, Eye, X, Sparkles, Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment, writeBatch, query, collection, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Video, User } from '../types';
import { formatNumber, formatDuration } from '../utils';
import { Comments } from './Comments';
import { formatDistanceToNow } from 'date-fns';
import { SuperChatModal } from './SuperChatModal';
import confetti from 'canvas-confetti';

interface VideoCardProps {
  video: Video;
  currentUser: User | null;
  isActive: boolean;
  onUserClick?: (uid: string) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video: initialVideo, currentUser, isActive, onUserClick }) => {
  const [video, setVideo] = useState<Video>(initialVideo);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showSuperChat, setShowSuperChat] = useState(false);
  const [videoCreator, setVideoCreator] = useState<User | null>(null);
  const [recentSuperChat, setRecentSuperChat] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false);

  // Real-time listener for the video document to keep counts updated
  useEffect(() => {
    setVideo(initialVideo);
    const unsubscribe = onSnapshot(doc(db, 'videos', initialVideo.id), (doc) => {
      if (doc.exists()) {
        setVideo({ ...doc.data(), id: doc.id } as Video);
      }
    });
    return () => unsubscribe();
  }, [initialVideo.id]);

  useEffect(() => {
    const fetchCreator = async () => {
      const creatorSnap = await getDoc(doc(db, 'users', video.userId));
      if (creatorSnap.exists()) {
        setVideoCreator({ ...creatorSnap.data(), uid: creatorSnap.id } as User);
      }
    };
    fetchCreator();
  }, [video.userId]);

  useEffect(() => {
    const q = query(
      collection(db, 'super_chats'),
      where('videoId', '==', video.id),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const chat = snapshot.docs[0].data();
        // Only show if it's relatively new (within last 30 seconds)
        if (Date.now() - chat.createdAt < 30000) {
          setRecentSuperChat({ ...chat, id: snapshot.docs[0].id });
          
          // Trigger confetti for premium feel
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#F59E0B', '#FCD34D', '#FFFFFF']
          });

          setTimeout(() => setRecentSuperChat(null), 8000);
        }
      }
    });

    return () => unsubscribe();
  }, [video.id]);

  useEffect(() => {
    if (auth.currentUser && video.userId !== auth.currentUser.uid) {
      const followId = `${auth.currentUser.uid}_${video.userId}`;
      const unsubscribe = onSnapshot(doc(db, 'follows', followId), (doc) => {
        setIsFollowing(doc.exists());
      });
      return () => unsubscribe();
    }
  }, [video.userId, auth.currentUser?.uid]);

  useEffect(() => {
    if (auth.currentUser) {
      const likeId = `${auth.currentUser.uid}_${video.id}`;
      const unsubscribe = onSnapshot(doc(db, 'likes', likeId), (doc) => {
        setIsLiked(doc.exists());
      });
      return () => unsubscribe();
    }
  }, [video.id, auth.currentUser?.uid]);

  useEffect(() => {
    if (video.type === 'video' && videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
        // Increment view count
        const incrementView = async () => {
          try {
            const videoRef = doc(db, 'videos', video.id);
            const userRef = doc(db, 'users', video.userId);
            const batch = writeBatch(db);
            batch.update(videoRef, { viewsCount: increment(1) });
            batch.update(userRef, { totalViews: increment(1) });
            await batch.commit();
          } catch (error) {
            console.error("Error incrementing views:", error);
          }
        };
        incrementView();
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    } else if (video.type === 'photo' && isActive) {
      // Increment view count for photos when they become active
      const incrementView = async () => {
        try {
          const videoRef = doc(db, 'videos', video.id);
          const userRef = doc(db, 'users', video.userId);
          const batch = writeBatch(db);
          batch.update(videoRef, { viewsCount: increment(1) });
          batch.update(userRef, { totalViews: increment(1) });
          await batch.commit();
        } catch (error) {
          console.error("Error incrementing views:", error);
        }
      };
      incrementView();
    }
  }, [isActive, video.id, video.userId, video.type]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
      setShowPlayPauseIcon(true);
      setTimeout(() => setShowPlayPauseIcon(false), 500);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLiked) {
      handleLike(e);
    }
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) {
      alert("Please login to follow creators");
      return;
    }
    if (video.userId === auth.currentUser.uid) return;
    
    setIsFollowLoading(true);
    try {
      const followId = `${auth.currentUser.uid}_${video.userId}`;
      const followRef = doc(db, 'follows', followId);
      const creatorRef = doc(db, 'users', video.userId);
      const currentUserRef = doc(db, 'users', auth.currentUser.uid);

      const batch = writeBatch(db);

      if (isFollowing) {
        batch.delete(followRef);
        batch.update(creatorRef, { followersCount: increment(-1) });
        batch.update(currentUserRef, { followingCount: increment(-1) });
        setIsFollowing(false);
      } else {
        batch.set(followRef, {
          followerId: auth.currentUser.uid,
          followingId: video.userId,
          createdAt: Date.now()
        });
        batch.update(creatorRef, { followersCount: increment(1) });
        batch.update(currentUserRef, { followingCount: increment(1) });
        setIsFollowing(true);
      }

      await batch.commit();
    } catch (error) {
      console.error("Error following user:", error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) {
      alert("Please login to like videos");
      return;
    }

    const likeId = `${auth.currentUser.uid}_${video.id}`;
    const likeRef = doc(db, 'likes', likeId);
    const videoRef = doc(db, 'videos', video.id);
    const creatorRef = doc(db, 'users', video.userId);

    try {
      const batch = writeBatch(db);
      if (isLiked) {
        batch.delete(likeRef);
        batch.update(videoRef, { likesCount: increment(-1) });
        batch.update(creatorRef, { totalLikes: increment(-1) });
        setIsLiked(false);
      } else {
        batch.set(likeRef, {
          userId: auth.currentUser.uid,
          videoId: video.id,
          createdAt: Date.now()
        });
        batch.update(videoRef, { likesCount: increment(1) });
        batch.update(creatorRef, { totalLikes: increment(1) });
        setIsLiked(true);
        setShowHeartAnim(true);
        setTimeout(() => setShowHeartAnim(false), 1000);
      }
      await batch.commit();
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = {
      title: 'Check out this reel!',
      text: video.caption,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      }
      
      // Increment share count
      const videoRef = doc(db, 'videos', video.id);
      await updateDoc(videoRef, { sharesCount: increment(1) });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  return (
    <div 
      className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden cursor-pointer"
      onDoubleClick={handleDoubleClick}
      onClick={togglePlay}
    >
      {video.type === 'video' ? (
        <video
          ref={videoRef}
          src={video.videoUrl}
          className="h-full w-full object-contain"
          loop
          playsInline
          muted={isMuted}
        />
      ) : (
        <img
          src={video.videoUrl}
          className="h-full w-full object-contain"
          alt={video.caption || 'Photo Post'}
          referrerPolicy="no-referrer"
        />
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

      {/* Quality Badge - Only for Video */}
      {video.type === 'video' && (
        <div className="absolute top-24 right-4 z-10 flex flex-col items-end space-y-2">
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 px-2 py-1 rounded-md flex items-center space-x-1">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-white tracking-tighter">1080P</span>
          </div>
          
          <button 
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute video" : "Mute video"}
            className="bg-black/40 backdrop-blur-sm border border-white/20 p-2 rounded-full text-white hover:bg-black/60 transition-all"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      )}

      {/* Live Super Chat Notification */}
      <AnimatePresence>
        {recentSuperChat && (
          <motion.div
            initial={{ x: -100, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 100, opacity: 0, scale: 0.8 }}
            className="absolute top-24 left-4 z-20 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 p-[1px] rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.3)]"
          >
            <div className="bg-zinc-950/95 backdrop-blur-xl rounded-[15px] px-5 py-4 flex items-center space-x-4 min-w-[240px]">
              <div className="relative">
                <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/40">
                  <Sparkles size={24} className="text-white" />
                </div>
                <motion.div 
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-amber-500 rounded-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Super Chat</p>
                  <div className="h-1 w-1 bg-amber-500 rounded-full animate-pulse" />
                </div>
                <p className="text-sm font-black text-white truncate">@{recentSuperChat.senderName}</p>
                <p className="text-xs text-zinc-400 line-clamp-2 italic mt-0.5 font-medium">
                  "{recentSuperChat.message || 'Support your content!'}"
                </p>
              </div>
              <div className="text-right pl-4 border-l border-white/10">
                <p className="text-xs font-bold text-amber-500/60 uppercase tracking-tighter">Amount</p>
                <p className="text-xl font-black text-amber-500 tabular-nums">₹{recentSuperChat.amount}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-24 flex flex-col items-center space-y-6 z-10">
        <motion.div 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="relative"
        >
          <div 
            className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-zinc-800 cursor-pointer shadow-xl group"
            onClick={(e) => { 
              e.stopPropagation(); 
              if (onUserClick) onUserClick(video.userId); 
            }}
          >
            <img 
              src={video.userProfileImage} 
              alt={video.userName} 
              className="w-full h-full object-cover transition-transform group-hover:scale-110" 
            />
          </div>
          {auth.currentUser?.uid !== video.userId && (
            <button 
              onClick={handleFollow}
              disabled={isFollowLoading}
              aria-label={isFollowing ? "Following" : "Follow"}
              className={cn(
                "absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full p-0.5 text-white transition-all shadow-lg",
                isFollowing ? "bg-zinc-500" : "bg-rose-500"
              )}
            >
              {isFollowing ? <Check size={14} /> : <UserPlus size={14} />}
            </button>
          )}
        </motion.div>

        <button 
          onClick={handleLike}
          aria-label={isLiked ? `Unlike ${video.type}` : `Like ${video.type}`}
          className="flex flex-col items-center"
        >
          <Heart 
            size={32} 
            className={cn("transition-colors", isLiked ? "fill-rose-500 text-rose-500" : "text-white")} 
          />
          <span className="text-white text-xs font-medium mt-1">{formatNumber(video.likesCount)}</span>
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
          aria-label="View comments"
          className="flex flex-col items-center"
        >
          <MessageCircle size={32} className="text-white" />
          <span className="text-white text-xs font-medium mt-1">{formatNumber(video.commentsCount)}</span>
        </button>

        {currentUser && currentUser.uid !== video.userId && (
          <div className="flex flex-col items-center space-y-6">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowSuperChat(true); }}
              aria-label="Send Super Chat"
              className="flex flex-col items-center"
            >
              <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/40 animate-bounce-slow">
                <Sparkles size={24} className="text-white" />
              </div>
              <span className="text-amber-500 text-[10px] font-black mt-1 uppercase tracking-tighter">Super Chat</span>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); setShowSuperChat(true); }}
              aria-label="Send Gift"
              className="flex flex-col items-center"
            >
              <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/40">
                <Music2 size={20} className="text-white" />
              </div>
              <span className="text-purple-400 text-[10px] font-black mt-1 uppercase tracking-tighter">Gift</span>
            </button>
          </div>
        )}

        <button 
          onClick={handleShare}
          aria-label={`Share ${video.type}`}
          className="flex flex-col items-center"
        >
          <Share2 size={32} className="text-white" />
          <span className="text-white text-xs font-medium mt-1">{formatNumber(video.sharesCount)}</span>
        </button>

        <div className="flex flex-col items-center">
          <Eye size={32} className="text-white" />
          <span className="text-white text-xs font-medium mt-1">{formatNumber(video.viewsCount)}</span>
        </div>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-4 left-4 right-16 z-10">
        <div className="flex items-center space-x-3 mb-2">
          <h3 
            className="text-white font-bold text-base cursor-pointer hover:text-rose-400 transition-colors flex items-center"
            onClick={(e) => { 
              e.stopPropagation(); 
              if (onUserClick) onUserClick(video.userId); 
            }}
          >
            @{video.userName}
          </h3>
          <div className="flex items-center space-x-2 text-white/60 text-[10px] font-bold">
            <span>•</span>
            <span>{formatDistanceToNow(video.createdAt)} ago</span>
            {video.duration && (
              <>
                <span>•</span>
                <span className="bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
                  {formatDuration(video.duration)}
                </span>
              </>
            )}
          </div>
          {auth.currentUser?.uid !== video.userId && (
            <button 
              onClick={handleFollow}
              disabled={isFollowLoading}
              aria-label={isFollowing ? `Unfollow ${video.userName}` : `Follow ${video.userName}`}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                isFollowing 
                  ? "bg-white/10 text-white border border-white/20" 
                  : "bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-600"
              )}
            >
              {isFollowLoading ? (
                <Loader2 className="animate-spin" size={12} />
              ) : (
                isFollowing ? 'Following' : 'Follow'
              )}
            </button>
          )}
          {video.boosted && (
            <span className="bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center">
              <CheckCircle2 size={10} className="mr-0.5" /> BOOSTED
            </span>
          )}
        </div>
        <p className="text-white text-sm line-clamp-2 mb-3">{video.caption}</p>
        <div className="flex items-center text-white text-sm">
          {video.type === 'video' && <Music2 size={14} className="mr-2 animate-spin-slow" />}
          <span className="truncate">
            {video.type === 'video' ? (
              video.audioTrack 
                ? `${video.audioTrack.title} - ${video.audioTrack.artist}` 
                : `Original Audio - ${video.userName}`
            ) : (
              `Photo Post - ${video.userName}`
            )}
          </span>
        </div>
      </div>

      {/* Heart Animation */}
      <AnimatePresence>
        {showHeartAnim && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            className="absolute pointer-events-none z-50"
          >
            <Heart size={100} className="fill-rose-500 text-rose-500" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play/Pause Animation */}
      <AnimatePresence>
        {(showPlayPauseIcon || !isPlaying) && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="absolute pointer-events-none z-50 bg-black/20 p-6 rounded-full backdrop-blur-sm"
          >
            {showPlayPauseIcon ? (
              isPlaying ? <Play size={60} className="text-white fill-white" /> : <Pause size={60} className="text-white fill-white" />
            ) : (
              !isPlaying ? <Play size={60} className="text-white fill-white" /> : null
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <Comments 
            videoId={video.id} 
            onClose={() => setShowComments(false)} 
            onUserClick={(uid) => {
              setShowComments(false);
              onUserClick?.(uid);
            }}
          />
        )}
      </AnimatePresence>

      {/* Super Chat Modal */}
      <AnimatePresence>
        {showSuperChat && currentUser && videoCreator && (
          <SuperChatModal 
            currentUser={currentUser}
            targetUser={videoCreator}
            videoId={video.id}
            onClose={() => setShowSuperChat(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
