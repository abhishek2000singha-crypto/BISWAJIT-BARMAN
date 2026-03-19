import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Music2, UserPlus, CheckCircle2, Check, Eye, X, Sparkles, Play, Pause, Volume2, VolumeX, Loader2, Rocket, Flag, XCircle, Edit3, Settings, ChevronRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment, writeBatch, query, collection, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Video, User, TextOverlay } from '../types';
import { cn, formatNumber, formatDuration } from '../utils';
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [videoCreator, setVideoCreator] = useState<User | null>(null);
  const [recentSuperChat, setRecentSuperChat] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [editCaption, setEditCaption] = useState(video.caption || '');
  const [editHashtags, setEditHashtags] = useState(video.hashtags?.map(t => `#${t}`).join(' ') || '');
  const [editBoostPrice, setEditBoostPrice] = useState(video.customBoostPrice?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);
  const [currentResolution, setCurrentResolution] = useState<string>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);

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
    if (videoRef.current && shouldLoad && currentResolution) {
      // Save current time before switching to new resolution
      if (videoRef.current.currentTime > 0) {
        lastTimeRef.current = videoRef.current.currentTime;
      }
      
      // The src will change because getVideoUrl() is called in the render
      // We call load() to ensure the video element picks up the new source
      videoRef.current.load();
      
      // If it was playing, try to resume
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [currentResolution]);

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

    if (isActive) {
      startTimeRef.current = Date.now();
    } else {
      // If video was active and now is not, check if it was a "skip"
      const timeSpent = (Date.now() - startTimeRef.current) / 1000;
      if (timeSpent > 0.5 && timeSpent < 3 && auth.currentUser) {
        trackInteraction(auth.currentUser.uid, video.id, video.userId, 'skip');
      }
    }
  }, [isActive, video.id, video.userId]);

  useEffect(() => {
    if (video.audioTrack && isActive && shouldLoad) {
      if (!backgroundAudioRef.current) {
        backgroundAudioRef.current = new Audio(video.audioTrack.url);
        backgroundAudioRef.current.loop = true;
      } else if (backgroundAudioRef.current.src !== video.audioTrack.url) {
        backgroundAudioRef.current.src = video.audioTrack.url;
      }
      
      backgroundAudioRef.current.muted = isMuted;
      
      if (isPlaying) {
        backgroundAudioRef.current.play().catch(err => {
          if (err.name !== 'AbortError') console.error("Background audio failed", err);
        });
      } else {
        backgroundAudioRef.current.pause();
      }
    } else if (backgroundAudioRef.current) {
      backgroundAudioRef.current.pause();
      backgroundAudioRef.current.currentTime = 0;
    }

    return () => {
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.pause();
        backgroundAudioRef.current = null;
      }
    };
  }, [video.audioTrack, isActive, isPlaying, isMuted, shouldLoad]);

  useEffect(() => {
    if (videoRef.current && video.type === 'video' && video.videoUrl && shouldLoad) {
      // If there's background music, we might want to mute the original video
      // or at least respect the global mute
      videoRef.current.muted = isMuted || !!video.audioTrack;
      videoRef.current.volume = 1.0;
      if (!isMuted && isActive && isPlaying) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (error.name !== 'AbortError') {
              console.error("Audio play failed", error.message);
            }
          });
        }
      }
    }
  }, [isMuted, isActive, isPlaying, video.type, video.videoUrl, shouldLoad]);

  useEffect(() => {
    if (video.type === 'video' && videoRef.current && video.videoUrl && shouldLoad) {
      if (isActive) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (error.name !== 'AbortError') {
              console.error("Audio play failed", error.message);
            }
          });
        }
        setIsPlaying(true);

        // Restore playback position
        const savedTime = localStorage.getItem(`video_playback_pos_${video.id}`);
        if (savedTime && videoRef.current) {
          const time = parseFloat(savedTime);
          if (!isNaN(time) && time > (video.trimStart || 0)) {
            videoRef.current.currentTime = time;
          }
        }

        // Increment view count
        const incrementView = async () => {
          try {
            const videoDocRef = doc(db, 'videos', video.id);
            const userDocRef = doc(db, 'users', video.userId);
            const batch = writeBatch(db);
            batch.update(videoDocRef, { viewsCount: increment(1) });
            batch.update(userDocRef, { totalViews: increment(1) });
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
        if (videoRef.current && videoRef.current.currentTime > 0) {
          localStorage.setItem(`video_playback_pos_${video.id}`, videoRef.current.currentTime.toString());
        }
        videoRef.current.pause();
        videoRef.current.currentTime = video.trimStart || 0;
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
        
        // Save playback position every 2 seconds
        if (secondsWatched % 2 === 0 && videoRef.current) {
          localStorage.setItem(`video_playback_pos_${video.id}`, videoRef.current.currentTime.toString());
        }

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
      if (watchInterval) {
        clearInterval(watchInterval);
        // Save playback position on unmount or deactivation
        if (videoRef.current && videoRef.current.currentTime > 0) {
          localStorage.setItem(`video_playback_pos_${video.id}`, videoRef.current.currentTime.toString());
        }
      }
    };
  }, [isActive, isPlaying, video.id, video.type]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!videoRef.current || video.type !== 'video') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    
    const duration = video.trimEnd && video.trimStart 
      ? video.trimEnd - video.trimStart 
      : videoRef.current.duration;
    
    const newTime = (percentage * duration) + (video.trimStart || 0);
    videoRef.current.currentTime = newTime;
    setProgress(percentage * 100);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume > 0 && isMuted) {
        onMuteToggle?.();
      } else if (newVolume === 0 && !isMuted) {
        onMuteToggle?.();
      }
    }
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.volume = newVolume;
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If muted, first tap should unmute
    if (isMuted) {
      onMuteToggle?.();
      return;
    }

    if (videoRef.current && video.videoUrl && shouldLoad) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (error.name !== 'AbortError') {
              console.error("Audio play failed", error.message);
            }
          });
        }
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
        
        // Send notification to creator
        if (currentUser && currentUser.uid !== video.userId) {
          sendNotification({
            userId: video.userId,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            senderProfileImage: currentUser.profileImage,
            type: 'share',
            videoId: video.id,
            videoThumbnail: video.thumbnailUrl || video.videoUrl,
            message: 'shared your post'
          });
        }
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleNotInterested = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) {
      showError("Please login to provide feedback");
      return;
    }
    try {
      setIsHidden(true);
      await trackInteraction(auth.currentUser.uid, video.id, video.userId, 'skip');
      showSuccess("We'll show you less content like this");
    } catch (error) {
      console.error("Error tracking not interested:", error);
    }
  };

  const handleReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) {
      showError("Please login to report content");
      return;
    }
    try {
      setIsHidden(true);
      await trackInteraction(auth.currentUser.uid, video.id, video.userId, 'report');
      showSuccess("Thank you for reporting. Our team will review it.");
      setShowReportMenu(false);
    } catch (error) {
      console.error("Error reporting video:", error);
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      lastTimeRef.current = videoRef.current.currentTime;
    }
  }, [currentResolution]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMuteToggle?.();
  };

  const getVideoUrl = () => {
    if (!video.resolutions || Object.keys(video.resolutions).length === 0) {
      return video.videoUrl;
    }

    if (currentResolution === 'auto') {
      const connection = (navigator as any).connection;
      const type = connection?.effectiveType || '4g';
      
      // Simple heuristic for auto selection
      if (type.includes('4g')) {
        return video.resolutions['1080p'] || video.resolutions['720p'] || video.videoUrl;
      } else if (type.includes('3g')) {
        return video.resolutions['480p'] || video.resolutions['360p'] || video.videoUrl;
      } else {
        return video.resolutions['360p'] || video.resolutions['240p'] || video.videoUrl;
      }
    }
    
    return video.resolutions[currentResolution] || video.videoUrl;
  };

  const handleUpdateVideo = async () => {
    setIsSaving(true);
    try {
      const videoRef = doc(db, 'videos', video.id);
      const updatedHashtags = editHashtags.split(' ').filter(t => t.startsWith('#')).map(t => t.slice(1));
      
      await updateDoc(videoRef, {
        caption: editCaption,
        hashtags: updatedHashtags,
        customBoostPrice: editBoostPrice ? parseFloat(editBoostPrice) : null,
        updatedAt: Date.now()
      });
      
      showSuccess("Video updated successfully!");
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating video:", error);
      showError("Failed to update video");
    } finally {
      setIsSaving(false);
    }
  };

  if (isHidden) {
    return (
      <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500">
          <XCircle size={32} />
        </div>
        <div>
          <p className="text-white font-bold text-sm">Content Hidden</p>
          <p className="text-zinc-500 text-xs mt-1">We've updated your preferences.</p>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsHidden(false); }}
          className="text-rose-500 text-[10px] font-bold uppercase tracking-widest hover:underline"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      animate={{ 
        scale: isActive ? 1 : 0.96,
        opacity: isActive ? 1 : 0.6,
        filter: isActive ? 'blur(0px)' : 'blur(4px)',
        boxShadow: isActive ? 'inset 0 0 120px rgba(0,0,0,0.9), 0 0 60px rgba(244,63,94,0.15)' : 'inset 0 0 0px rgba(0,0,0,0), 0 0 0px rgba(0,0,0,0)'
      }}
      transition={{ 
        duration: 0.7, 
        ease: [0.23, 1, 0.32, 1] 
      }}
      className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden cursor-pointer"
      onDoubleClick={handleDoubleClick}
      onClick={togglePlay}
    >
      {video.type === 'video' ? (
        <div className="relative h-full w-full flex items-center justify-center">
          {/* Blurred Thumbnail Loading State */}
          <AnimatePresence>
            {isBuffering && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10"
              >
                <img
                  src={video.thumbnailUrl}
                  className="h-full w-full object-cover blur-2xl scale-110 opacity-50"
                  alt=""
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.video
            ref={videoRef}
            src={shouldLoad ? getVideoUrl() : ''}
            poster={video.thumbnailUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: isBuffering ? 0 : 1 }}
            transition={{ duration: 0.5 }}
            className={cn("h-full w-full object-contain relative z-0", video.filter && !video.filter.includes('(') && video.filter)}
            style={{ filter: video.filter?.includes('(') ? video.filter : undefined }}
            loop
            playsInline
            muted={isMuted}
            preload="auto"
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
            onCanPlay={() => setIsBuffering(false)}
            onLoadedMetadata={() => {
            if (videoRef.current && lastTimeRef.current > 0) {
              videoRef.current.currentTime = lastTimeRef.current;
              if (isPlaying) videoRef.current.play().catch(() => {});
              lastTimeRef.current = 0;
            }
          }}
          onTimeUpdate={() => {
            if (videoRef.current) {
              const time = videoRef.current.currentTime;
              
              // Respect trim
              if (video.trimStart !== undefined && video.trimEnd !== undefined) {
                if (time >= video.trimEnd) {
                  videoRef.current.currentTime = video.trimStart;
                }
                if (time < video.trimStart) {
                  videoRef.current.currentTime = video.trimStart;
                }
              }

              // Update progress bar (if any)
              const duration = video.trimEnd && video.trimStart 
                ? video.trimEnd - video.trimStart 
                : videoRef.current.duration;
              const current = video.trimStart 
                ? time - video.trimStart 
                : time;
              
              setCurrentTime(current);
              setDuration(duration);
              setProgress((current / duration) * 100);
            }
          }}
        />
        </div>
      ) : (
        <img
          src={shouldLoad ? video.videoUrl : video.thumbnailUrl}
          className="h-full w-full object-contain"
          alt={video.caption || 'Photo Post'}
          referrerPolicy="no-referrer"
        />
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />

      {/* Safety Warning Overlay */}
      {video.moderation && !video.moderation.isSafe && (
        <div className="absolute inset-0 z-30 bg-zinc-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={40} className="text-rose-500" />
          </div>
          <h3 className="text-xl font-black mb-2 uppercase tracking-tighter italic">Content Warning</h3>
          <p className="text-zinc-400 text-sm mb-8 max-w-[280px]">
            This content has been flagged by our AI moderation system:
            <span className="block mt-2 text-rose-400 font-bold">
              {video.moderation.safetyReason || "Violates community guidelines"}
            </span>
          </p>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsHidden(true); }}
            className="px-8 py-3 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-colors"
          >
            Hide Content
          </button>
        </div>
      )}

      {/* Text Overlays */}
      {video.textOverlays?.map((overlay: TextOverlay) => (
        <div
          key={overlay.id}
          style={{ 
            left: `${overlay.x}%`, 
            top: `${overlay.y}%`, 
            color: overlay.color,
            fontSize: `${overlay.fontSize}px`,
            fontFamily: overlay.fontFamily || 'var(--font-sans)',
            transform: 'translate(-50%, -50%)',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}
          className="absolute pointer-events-none select-none whitespace-nowrap font-bold z-10"
        >
          {overlay.text}
        </div>
      ))}

      {/* Muted Overlay */}
      {isMuted && isActive && video.type === 'video' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
        >
          <div className="glass-dark px-6 py-3 rounded-full flex items-center space-x-3 border border-white/20 shadow-2xl">
            <VolumeX size={20} className="text-white animate-pulse" />
            <span className="text-xs font-black text-white uppercase tracking-widest">Tap to Unmute</span>
          </div>
        </motion.div>
      )}

      {/* Double Tap Hint */}
      {!isLiked && isActive && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: [0, 1, 0], y: [20, 0, -20] }}
          transition={{ delay: 5, duration: 2, repeat: Infinity, repeatDelay: 10 }}
          className="absolute bottom-40 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        >
          <div className="glass-dark px-4 py-2 rounded-full flex items-center space-x-2 border border-white/10">
            <Heart size={12} className="text-rose-500" />
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Double tap to like</span>
          </div>
        </motion.div>
      )}

        <motion.div 
          animate={{ 
            x: isActive ? 0 : 20, 
            opacity: isActive ? 1 : 0 
          }}
          className="absolute top-24 right-4 z-10 flex flex-col items-end space-y-3"
        >
          {/* Play/Pause Button */}
          <motion.button 
            animate={{ 
              x: isActive ? 0 : 20, 
              opacity: isActive ? 1 : 0 
            }}
            transition={{ delay: 0.05 }}
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause video" : "Play video"}
            className="glass-dark p-3 rounded-full text-white hover:bg-white/20 transition-all shadow-2xl active:scale-90"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </motion.button>

          {video.resolutions && Object.keys(video.resolutions).length > 0 && (
            <div className="relative">
              <motion.button 
                animate={{ 
                  x: isActive ? 0 : 20, 
                  opacity: isActive ? 1 : 0 
                }}
                onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); }}
                className="glass-dark px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-2xl hover:bg-white/10 transition-colors"
              >
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  currentResolution === 'auto' ? "bg-emerald-500" : "bg-rose-500"
                )} />
                <span className="text-[10px] font-black text-white tracking-widest font-display uppercase">
                  {currentResolution === 'auto' ? 'Auto' : currentResolution}
                </span>
                <Settings size={10} className="text-white/50" />
              </motion.button>

              <AnimatePresence>
                {showQualityMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 10 }}
                    className="absolute right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 w-36 shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-bottom border-white/5 mb-1">
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Video Quality</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentResolution('auto'); setShowQualityMenu(false); }}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all",
                        currentResolution === 'auto' ? "bg-rose-500/20 text-rose-500" : "hover:bg-white/5 text-zinc-400"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Auto</span>
                        <span className="text-[8px] text-zinc-500 font-medium">Best for network</span>
                      </div>
                      {currentResolution === 'auto' && <Check size={12} />}
                    </button>
                    
                    {video.resolutions && Object.keys(video.resolutions)
                      .sort((a, b) => parseInt(b) - parseInt(a))
                      .map((res) => (
                        <button
                          key={res}
                          onClick={(e) => { e.stopPropagation(); setCurrentResolution(res); setShowQualityMenu(false); }}
                          className={cn(
                            "w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all",
                            currentResolution === res ? "bg-rose-500/20 text-rose-500" : "hover:bg-white/5 text-zinc-400"
                          )}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider">{res}</span>
                          {currentResolution === res && <Check size={12} />}
                        </button>
                      ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
          <div className="relative group/volume">
            <motion.button 
              animate={{ 
                x: isActive ? 0 : 20, 
                opacity: isActive ? 1 : 0 
              }}
              transition={{ delay: 0.1 }}
              onClick={toggleMute}
              onMouseEnter={() => setShowVolumeSlider(true)}
              aria-label={isMuted ? "Unmute video" : "Mute video"}
              className="glass-dark p-3 rounded-full text-white hover:bg-white/20 transition-all shadow-2xl active:scale-90"
            >
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </motion.button>

            <AnimatePresence>
              {showVolumeSlider && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 10 }}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                  className="absolute right-full mr-4 top-1/2 -translate-y-1/2 glass-dark p-4 rounded-2xl shadow-2xl z-50 flex items-center space-x-3 w-40"
                >
                  <VolumeX size={14} className="text-white/50" />
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <Volume2 size={14} className="text-white/50" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

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
      <motion.div 
        animate={{ 
          x: isActive ? 0 : 40,
          opacity: isActive ? 1 : 0
        }}
        transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
        className="absolute right-4 bottom-24 flex flex-col items-center space-y-6 z-10"
      >
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
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleLike}
          aria-label={isLiked ? `Unlike ${video.type}` : `Like ${video.type}`}
          className="flex flex-col items-center group"
        >
          <div className={cn(
            "glass-dark p-3.5 rounded-full mb-1.5 group-hover:bg-white/20 transition-all border border-white/5 shadow-2xl backdrop-blur-xl",
            isLiked && "bg-rose-500/10 border-rose-500/20"
          )}>
            <Heart 
              size={28} 
              className={cn("transition-all duration-300", isLiked ? "fill-rose-500 text-rose-500 scale-110 drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]" : "text-white")} 
            />
          </div>
          <span className="text-white text-[11px] font-black font-display tracking-widest drop-shadow-md">{formatNumber(video.likesCount)}</span>
        </motion.button>

        <motion.button 
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
          aria-label="View comments"
          className="flex flex-col items-center group"
        >
          <div className="glass-dark p-3.5 rounded-full mb-1.5 group-hover:bg-white/20 transition-all border border-white/5 shadow-2xl backdrop-blur-xl">
            <MessageCircle size={28} className="text-white" />
          </div>
          <span className="text-white text-[11px] font-black font-display tracking-widest drop-shadow-md">{formatNumber(video.commentsCount)}</span>
        </motion.button>

        {currentUser && currentUser.uid !== video.userId && (
          <div className="flex flex-col items-center space-y-6">
            <motion.button 
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); setShowSuperChat(true); }}
              aria-label="Send Super Chat"
              className="flex flex-col items-center group"
            >
              <div className="w-13 h-13 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(245,158,11,0.4)] animate-float border-2 border-white/20">
                <Sparkles size={26} className="text-white drop-shadow-md" />
              </div>
              <span className="text-amber-500 text-[9px] font-black mt-1.5 uppercase tracking-widest font-display drop-shadow-md">Super Chat</span>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); setShowBoostModal(true); }}
              aria-label="Boost Reel"
              className="flex flex-col items-center group"
            >
              <div className="w-13 h-13 bg-gradient-to-tr from-rose-600 to-orange-500 rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(244,63,94,0.4)] border-2 border-white/20">
                <Rocket size={26} className="text-white drop-shadow-md" />
              </div>
              <span className="text-rose-400 text-[9px] font-black mt-1.5 uppercase tracking-widest font-display drop-shadow-md">Boost</span>
            </motion.button>
          </div>
        )}

        {currentUser && currentUser.uid === video.userId && (
          <motion.button 
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); setShowEditModal(true); }}
            aria-label="Edit Video"
            className="flex flex-col items-center group"
          >
            <div className="glass-dark p-3.5 rounded-full mb-1.5 group-hover:bg-white/20 transition-all border border-white/5 shadow-2xl backdrop-blur-xl">
              <Edit3 size={28} className="text-white" />
            </div>
            <span className="text-white text-[11px] font-black font-display tracking-widest drop-shadow-md">Edit</span>
          </motion.button>
        )}

        <motion.button 
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleShare}
          aria-label={`Share ${video.type}`}
          className="flex flex-col items-center group"
        >
          <div className="glass-dark p-3.5 rounded-full mb-1.5 group-hover:bg-white/20 transition-all border border-white/5 shadow-2xl backdrop-blur-xl">
            <Share2 size={28} className="text-white" />
          </div>
          <span className="text-white text-[11px] font-black font-display tracking-widest drop-shadow-md">{formatNumber(video.sharesCount)}</span>
        </motion.button>

        <div className="flex flex-col items-center group">
          <div className="glass-dark p-3.5 rounded-full mb-1.5 border border-white/5 shadow-2xl backdrop-blur-xl">
            <Eye size={28} className="text-white" />
          </div>
          <span className="text-white text-[11px] font-black font-display tracking-widest drop-shadow-md">{formatNumber(video.viewsCount)}</span>
        </div>

        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.8 }}
          onClick={(e) => { e.stopPropagation(); setShowReportMenu(!showReportMenu); }}
          className="flex flex-col items-center group relative"
        >
          <div className="glass-dark p-3 rounded-full mb-1 group-hover:bg-white/10 transition-colors">
            <Flag size={28} className="text-white" />
          </div>
          <span className="text-white text-[9px] font-black uppercase tracking-widest">Report</span>
          
          <AnimatePresence>
            {showReportMenu && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: -10 }}
                exit={{ opacity: 0, x: -20 }}
                className="absolute right-full mr-4 bottom-0 bg-zinc-900 border border-white/10 rounded-2xl p-2 w-40 shadow-2xl z-50 pointer-events-auto"
              >
                <button 
                  onClick={handleNotInterested}
                  className="w-full flex items-center space-x-2 p-3 hover:bg-white/5 rounded-xl text-left transition-colors"
                >
                  <XCircle size={16} className="text-zinc-400" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Not Interested</span>
                </button>
                <button 
                  onClick={handleReport}
                  className="w-full flex items-center space-x-2 p-3 hover:bg-rose-500/10 rounded-xl text-left transition-colors"
                >
                  <Flag size={16} className="text-rose-500" />
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Report Video</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* Bottom Info */}
      <motion.div 
        animate={{ 
          x: isActive ? 0 : -40,
          opacity: isActive ? 1 : 0
        }}
        transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
        className="absolute bottom-8 left-6 right-20 z-10 pointer-events-none"
      >
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
            <div className="glass-dark px-4 py-2.5 rounded-2xl flex items-center space-x-3 max-w-[220px] border border-white/10 shadow-xl backdrop-blur-2xl">
              <div className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center shrink-0 border border-white/5">
                <Music2 size={14} className="text-white animate-spin-slow" />
              </div>
              <span className="text-[11px] font-black text-white/90 truncate font-display tracking-tight">
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
              <div className="glass-dark px-4 py-2.5 rounded-2xl border border-white/10 shadow-xl backdrop-blur-2xl">
                <span className="text-[11px] font-black text-white/90 font-display tracking-tight">
                  {formatDuration(video.duration)}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Time Display */}
      {video.type === 'video' && isActive && (
        <div className="absolute bottom-4 left-4 z-40 pointer-events-none">
          <div className="glass-dark px-2 py-1 rounded-lg text-[10px] font-mono text-white/90 shadow-xl border border-white/10">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </div>
        </div>
      )}

      {/* Seek Bar */}
      {video.type === 'video' && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-3 bg-transparent z-30 cursor-pointer group/seek"
          onClick={handleSeek}
        >
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/5 group-hover/seek:h-full transition-all duration-200">
            <motion.div 
              className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.5)] relative"
              style={{ width: `${progress}%` }}
              transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover/seek:scale-100 transition-transform duration-200" />
            </motion.div>
          </div>
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

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-950 border border-white/10 rounded-[40px] overflow-hidden shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black uppercase tracking-widest">Edit Reel</h3>
                <button onClick={() => setShowEditModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Caption</label>
                  <textarea 
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-4 px-5 mt-2 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-all min-h-[100px] resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Hashtags</label>
                  <input 
                    type="text"
                    value={editHashtags}
                    onChange={(e) => setEditHashtags(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-4 px-5 mt-2 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-all"
                  />
                </div>

                <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                        <Rocket size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-white">Boost Price</p>
                        <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Set price for others to boost</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-white/5">
                      <span className="text-rose-500 font-black">₹</span>
                      <input 
                        type="number"
                        value={editBoostPrice}
                        onChange={(e) => setEditBoostPrice(e.target.value)}
                        placeholder="0"
                        className="bg-transparent w-16 text-sm font-black text-white focus:outline-none text-right"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleUpdateVideo}
                  disabled={isSaving}
                  className="w-full bg-rose-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20 flex items-center justify-center space-x-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <span>Save Changes</span>}
                </button>
              </div>
            </motion.div>
          </div>
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
    </motion.div>
  );
};

