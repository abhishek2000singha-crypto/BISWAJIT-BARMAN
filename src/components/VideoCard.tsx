import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Music2, UserPlus, CheckCircle2, Check, Eye, X, Sparkles, Play, Pause, Volume2, VolumeX, Loader2, Rocket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment, writeBatch, query, collection, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Video, User } from '../types';
import { formatNumber, formatDuration } from '../utils';
import { Comments } from './Comments';
import { formatDistanceToNow } from 'date-fns';
import { SuperChatModal } from './SuperChatModal';
import { BoostModal } from './BoostModal';
import confetti from 'canvas-confetti';
import { sendNotification } from '../services/notificationService';
import { useError } from '../contexts/ErrorContext';
import { trackInteraction } from '../services/interactionService';

interface VideoCardProps {
  video: Video;
  currentUser: User | null;
  isActive: boolean;
  shouldLoad: boolean;
  isMuted?: boolean;
  onMuteToggle?: () => void;
  onUserClick?: (uid: string) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video: initialVideo, currentUser, isActive, shouldLoad, isMuted = true, onMuteToggle, onUserClick }) => {
  const { showError, showSuccess } = useError();
  const [video, setVideo] = useState<Video>(initialVideo);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showSuperChat, setShowSuperChat] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [videoCreator, setVideoCreator] = useState<User | null>(null);
  const [recentSuperChat, setRecentSuperChat] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false);
  const [progress, setProgress] = useState(0);

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
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      const p = (videoElement.currentTime / videoElement.duration) * 100;
      setProgress(p);
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    return () => videoElement.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

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

            if (auth.currentUser) {
              trackInteraction(auth.currentUser.uid, video.id, video.userId, 'view');
            }
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

  useEffect(() => {
    let watchInterval: any;
    let secondsWatched = 0;
    if (isActive && isPlaying && video.type === 'video') {
      watchInterval = setInterval(async () => {
        secondsWatched++;
        try {
          const videoRef = doc(db, 'videos', video.id);
          await updateDoc(videoRef, { totalWatchTime: increment(1) });
          
          if (auth.currentUser) {
            trackInteraction(auth.currentUser.uid, video.id, video.userId, 'watch_time', 1);
            
            // If watched more than 80% of video, track as complete watch
            if (video.duration && secondsWatched >= video.duration * 0.8 && secondsWatched < video.duration * 0.8 + 1) {
              trackInteraction(auth.currentUser.uid, video.id, video.userId, 'complete_watch');
            }
          }
        } catch (error) {
          console.error("Error updating watch time:", error);
        }
      }, 1000);
    }
    return () => {
      if (watchInterval) clearInterval(watchInterval);
    };
  }, [isActive, isPlaying, video.id, video.type]);

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
      showError("Please login to follow creators");
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

        // Send notification
        if (currentUser) {
          sendNotification({
            userId: video.userId,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            senderProfileImage: currentUser.profileImage,
            type: 'follow',
            message: 'started following you'
          });
        }
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
      showError("Please login to like videos");
      return;
    }

    const likeId = `${auth.currentUser.uid}_${video.id}`;
    const likeDocRef = doc(db, 'likes', likeId);
    const videoDocRef = doc(db, 'videos', video.id);
    const creatorDocRef = doc(db, 'users', video.userId);

    // Optimistic update
    const newIsLiked = !isLiked;
    const likeDelta = newIsLiked ? 1 : -1;
    
    setIsLiked(newIsLiked);
    setVideo(prev => ({
      ...prev,
      likesCount: (prev.likesCount || 0) + likeDelta
    }));

    try {
      const batch = writeBatch(db);
      if (!newIsLiked) {
        batch.delete(likeDocRef);
        batch.update(videoDocRef, { likesCount: increment(-1) });
        batch.update(creatorDocRef, { totalLikes: increment(-1) });
      } else {
        batch.set(likeDocRef, {
          userId: auth.currentUser.uid,
          videoId: video.id,
          createdAt: Date.now()
        });
        batch.update(videoDocRef, { likesCount: increment(1) });
        batch.update(creatorDocRef, { totalLikes: increment(1) });
        
        setShowHeartAnim(true);
        setTimeout(() => setShowHeartAnim(false), 1000);

        trackInteraction(auth.currentUser.uid, video.id, video.userId, 'like');

        // Send notification
        if (currentUser && currentUser.uid !== video.userId) {
          sendNotification({
            userId: video.userId,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            senderProfileImage: currentUser.profileImage,
            type: 'like',
            videoId: video.id,
            videoThumbnail: video.thumbnailUrl || video.videoUrl,
            message: 'liked your post'
          });
        }
      }
      await batch.commit();
    } catch (error) {
      console.error("Error toggling like:", error);
      // Rollback on error
      setIsLiked(!newIsLiked);
      setVideo(prev => ({
        ...prev,
        likesCount: (prev.likesCount || 0) - likeDelta
      }));
      showError("Failed to update like. Please try again.");
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const videoUrl = `${window.location.origin}?video=${video.id}`;
    const shareData = {
      title: 'Check out this reel!',
      text: video.caption,
      url: videoUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(videoUrl);
        showSuccess("Link copied to clipboard!");
      }
      
      // Increment share count
      const videoRef = doc(db, 'videos', video.id);
      await updateDoc(videoRef, { sharesCount: increment(1) });

      if (auth.currentUser) {
        trackInteraction(auth.currentUser.uid, video.id, video.userId, 'share');
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMuteToggle?.();
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
          src={shouldLoad ? video.videoUrl : undefined}
          poster={video.thumbnailUrl}
          className="h-full w-full object-contain"
          loop
          playsInline
          muted={isMuted}
        />
      ) : (
        <img
          src={shouldLoad ? video.videoUrl : video.thumbnailUrl}
          className="h-full w-full object-contain"
          alt={video.caption || 'Photo Post'}
          referrerPolicy="no-referrer"
        />
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

      {/* Quality Badge - Only for Video */}
      {video.type === 'video' && (
        <div className="absolute top-24 right-4 z-10 flex flex-col items-end space-y-3">
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="glass-dark px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-2xl"
          >
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-white tracking-widest font-display">4K ULTRA HD</span>
          </motion.div>
          
          <motion.button 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute video" : "Mute video"}
            className="glass-dark p-3 rounded-full text-white hover:bg-white/20 transition-all shadow-2xl active:scale-90"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </motion.button>
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
            className="w-14 h-14 rounded-full border-2 border-white overflow-hidden bg-zinc-800 cursor-pointer shadow-2xl group ring-4 ring-white/10"
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
                "absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full p-1 text-white transition-all shadow-xl ring-2 ring-black",
                isFollowing ? "bg-zinc-500" : "bg-rose-500"
              )}
            >
              {isFollowing ? <Check size={14} /> : <UserPlus size={14} />}
            </button>
          )}
        </motion.div>

        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.8 }}
          onClick={handleLike}
          aria-label={isLiked ? `Unlike ${video.type}` : `Like ${video.type}`}
          className="flex flex-col items-center group"
        >
          <div className="glass-dark p-3 rounded-full mb-1 group-hover:bg-white/10 transition-colors">
            <Heart 
              size={28} 
              className={cn("transition-all", isLiked ? "fill-rose-500 text-rose-500 scale-110" : "text-white")} 
            />
          </div>
          <span className="text-white text-[11px] font-black font-display tracking-widest">{formatNumber(video.likesCount)}</span>
        </motion.button>

        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.8 }}
          onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
          aria-label="View comments"
          className="flex flex-col items-center group"
        >
          <div className="glass-dark p-3 rounded-full mb-1 group-hover:bg-white/10 transition-colors">
            <MessageCircle size={28} className="text-white" />
          </div>
          <span className="text-white text-[11px] font-black font-display tracking-widest">{formatNumber(video.commentsCount)}</span>
        </motion.button>

        {currentUser && currentUser.uid !== video.userId && (
          <div className="flex flex-col items-center space-y-6">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.8 }}
              onClick={(e) => { e.stopPropagation(); setShowSuperChat(true); }}
              aria-label="Send Super Chat"
              className="flex flex-col items-center group"
            >
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/40 animate-float">
                <Sparkles size={24} className="text-white" />
              </div>
              <span className="text-amber-500 text-[9px] font-black mt-1 uppercase tracking-widest font-display">Super Chat</span>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.8 }}
              onClick={(e) => { e.stopPropagation(); setShowBoostModal(true); }}
              aria-label="Boost Reel"
              className="flex flex-col items-center group"
            >
              <div className="w-12 h-12 bg-gradient-to-tr from-rose-600 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/40">
                <Rocket size={24} className="text-white" />
              </div>
              <span className="text-rose-400 text-[9px] font-black mt-1 uppercase tracking-widest font-display">Boost</span>
            </motion.button>
          </div>
        )}

        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.8 }}
          onClick={handleShare}
          aria-label={`Share ${video.type}`}
          className="flex flex-col items-center group"
        >
          <div className="glass-dark p-3 rounded-full mb-1 group-hover:bg-white/10 transition-colors">
            <Share2 size={28} className="text-white" />
          </div>
          <span className="text-white text-[11px] font-black font-display tracking-widest">{formatNumber(video.sharesCount)}</span>
        </motion.button>

        <div className="flex flex-col items-center">
          <div className="glass-dark p-3 rounded-full mb-1">
            <Eye size={28} className="text-white" />
          </div>
          <span className="text-white text-[11px] font-black font-display tracking-widest">{formatNumber(video.viewsCount)}</span>
        </div>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-8 left-6 right-20 z-10 pointer-events-none">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="space-y-4"
        >
          <div className="flex items-center space-x-3 pointer-events-auto">
            <div 
              className="flex items-center space-x-3 cursor-pointer group"
              onClick={(e) => { 
                e.stopPropagation(); 
                if (onUserClick) onUserClick(video.userId); 
              }}
            >
              <div className="relative">
                <img 
                  src={video.userProfileImage} 
                  alt={video.userName} 
                  className="w-11 h-11 rounded-full object-cover border-2 border-white/40 group-hover:border-rose-500 transition-all shadow-2xl" 
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-black flex items-center justify-center">
                  <Check size={8} className="text-white" />
                </div>
              </div>
              <div className="flex flex-col">
                <h3 className="text-white font-black text-lg group-hover:text-rose-400 transition-colors font-display tracking-tight">
                  @{video.userName}
                </h3>
                <div className="flex items-center space-x-2 text-white/50 text-[10px] font-black uppercase tracking-widest">
                  <span>{formatDistanceToNow(video.createdAt)} ago</span>
                  {video.boosted && (
                    <span className="text-amber-400 flex items-center">
                      <Sparkles size={10} className="mr-1" /> PROMOTED
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {auth.currentUser?.uid !== video.userId && (
              <button 
                onClick={handleFollow}
                disabled={isFollowLoading}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all pointer-events-auto",
                  isFollowing 
                    ? "glass text-white" 
                    : "bg-white text-black hover:bg-zinc-200 shadow-xl"
                )}
              >
                {isFollowLoading ? <Loader2 className="animate-spin" size={12} /> : (isFollowing ? 'Following' : 'Follow')}
              </button>
            )}
          </div>

          <p className="text-white text-sm font-medium leading-relaxed drop-shadow-md max-w-md pointer-events-auto">
            {video.caption}
          </p>
          
          <div className="flex items-center space-x-4 pointer-events-auto">
            <div className="glass-dark px-3 py-2 rounded-2xl flex items-center space-x-3 max-w-[200px]">
              <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                <Music2 size={12} className="text-white animate-spin-slow" />
              </div>
              <span className="text-[11px] font-bold text-white/90 truncate font-display">
                {video.type === 'video' ? (
                  video.audioTrack 
                    ? `${video.audioTrack.title} - ${video.audioTrack.artist}` 
                    : `Original Audio - ${video.userName}`
                ) : (
                  `Photo Post - ${video.userName}`
                )}
              </span>
            </div>
            
            {video.duration && (
              <div className="glass-dark px-3 py-2 rounded-2xl">
                <span className="text-[11px] font-black text-white/90 font-display">
                  {formatDuration(video.duration)}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Progress Bar */}
      {video.type === 'video' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
          <motion.div 
            className="h-full bg-rose-500"
            style={{ width: `${progress}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
          />
        </div>
      )}

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

      {/* Boost Modal */}
      <AnimatePresence>
        {showBoostModal && currentUser && (
          <BoostModal 
            currentUser={currentUser}
            video={video}
            onClose={() => setShowBoostModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
