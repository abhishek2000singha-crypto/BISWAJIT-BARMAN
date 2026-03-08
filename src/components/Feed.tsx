import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, where, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { VideoCard } from './VideoCard';
import { Video, User } from '../types';
import { LogoText } from './Logo';
import { cn } from '../utils';
import { Loader2, RefreshCcw } from 'lucide-react';
import { useError } from '../contexts/ErrorContext';

export const Feed: React.FC<{ 
  currentUser: User | null, 
  onUserClick?: (uid: string) => void,
  initialVideoId?: string,
  isMuted?: boolean,
  onMuteToggle?: () => void
}> = ({ currentUser, onUserClick, initialVideoId, isMuted = true, onMuteToggle }) => {
  const { showError } = useError();
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedType, setFeedType] = useState<'foryou' | 'following'>('foryou');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser && feedType === 'following') {
      const q = query(
        collection(db, 'follows'),
        where('followerId', '==', currentUser.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ids = snapshot.docs.map(doc => doc.data().followingId);
        setFollowingIds(ids);
      });
      return () => unsubscribe();
    }
  }, [currentUser, feedType]);

  const loadVideos = async (isInitial = false) => {
    if (loading || (!hasMore && !isInitial)) return;
    setLoading(true);

    try {
      let initialVid: Video | null = null;
      
      // If initial load and initialVideoId is provided, fetch it specifically
      if (isInitial && initialVideoId) {
        try {
          const vidDoc = await getDocs(query(collection(db, 'videos'), where('__name__', '==', initialVideoId)));
          if (!vidDoc.empty) {
            initialVid = { ...vidDoc.docs[0].data(), id: vidDoc.docs[0].id } as Video;
          }
        } catch (e) {
          console.warn("Failed to fetch initial video", e);
        }
      }

      const constraints: any[] = [
        orderBy('boosted', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(5)
      ];

      if (feedType === 'following') {
        if (followingIds.length === 0) {
          setVideos([]);
          setHasMore(false);
          setLoading(false);
          return;
        }
        constraints.push(where('userId', 'in', followingIds.slice(0, 10)));
      }

      if (!isInitial && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(collection(db, 'videos'), ...constraints);
      const snapshot = await getDocs(q);

      if (snapshot.empty && !initialVid) {
        setHasMore(false);
        if (isInitial) setVideos([]);
      } else {
        let fetchedVids = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Video));
        fetchedVids = fetchedVids.filter(v => v.status !== 'processing');
        
        if (snapshot.docs.length > 0) {
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        }
        setHasMore(snapshot.docs.length === 5);

        setVideos(prev => {
          let updatedVids = isInitial ? fetchedVids : [...prev, ...fetchedVids];
          
          if (isInitial && initialVid) {
            // Remove if it was already fetched in the batch to avoid duplicates
            updatedVids = [initialVid, ...updatedVids.filter(v => v.id !== initialVideoId)];
          }
          return updatedVids;
        });
      }
    } catch (error: any) {
      console.error("Error loading videos:", error);
      const message = error.code === 'unavailable' 
        ? "Network unavailable. Please check your connection."
        : "Failed to load videos. Please try again.";
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLastDoc(null);
    setHasMore(true);
    loadVideos(true);
  }, [feedType, followingIds, initialVideoId]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, clientHeight, scrollHeight } = containerRef.current;
      const index = Math.round(scrollTop / clientHeight);
      setActiveIndex(index);

      // Load more when reaching the second to last video
      if (index >= videos.length - 2 && hasMore && !loading) {
        loadVideos();
      }
    }
  };

  return (
    <div className="h-full w-full relative">
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-10 pointer-events-none">
        <LogoText className="scale-75 origin-left drop-shadow-lg" />
        <div className="flex space-x-4 pointer-events-auto">
          <button 
            onClick={() => setFeedType('foryou')}
            className={cn(
              "font-bold text-sm transition-all drop-shadow-md",
              feedType === 'foryou' ? "text-white border-b-2 border-white pb-1" : "text-white/60 pb-1"
            )}
          >
            For You
          </button>
          <button 
            onClick={() => {
              if (!currentUser) {
                alert("Please login to see following feed");
                return;
              }
              setFeedType('following');
            }}
            className={cn(
              "font-bold text-sm transition-all drop-shadow-md",
              feedType === 'following' ? "text-white border-b-2 border-white pb-1" : "text-white/60 pb-1"
            )}
          >
            Following
          </button>
        </div>
        <div className="w-10 h-10" /> {/* Spacer */}
      </div>

      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      >
        {videos.length === 0 && !loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-zinc-500 space-y-6 p-8 text-center">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center animate-pulse border border-white/5">
              <LogoText className="opacity-20" />
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-2">No reels found</p>
              <p className="text-xs text-zinc-500">Be the first to upload or check your connection.</p>
            </div>
            <button 
              onClick={() => loadVideos(true)}
              className="bg-zinc-900 border border-white/10 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center space-x-2 hover:bg-zinc-800 transition-all"
            >
              <RefreshCcw size={14} />
              <span>Retry Load</span>
            </button>
          </div>
        ) : (
          <>
            {videos.map((video, index) => (
              <div key={video.id} className="h-full w-full snap-start">
                <VideoCard 
                  video={video} 
                  currentUser={currentUser}
                  isActive={index === activeIndex} 
                  shouldLoad={Math.abs(index - activeIndex) <= 1}
                  isMuted={isMuted}
                  onMuteToggle={onMuteToggle}
                  onUserClick={onUserClick}
                />
              </div>
            ))}
            {loading && (
              <div className="h-full w-full flex items-center justify-center bg-black">
                <Loader2 className="animate-spin text-rose-500" size={40} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
