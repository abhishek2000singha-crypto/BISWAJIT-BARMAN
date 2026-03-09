import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, where, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { VideoCard } from './VideoCard';
import { Video, User } from '../types';
import { LogoText } from './Logo';
import { cn } from '../utils';
import { Loader2, RefreshCcw, Search } from 'lucide-react';
import { useError } from '../contexts/ErrorContext';

export const Feed: React.FC<{ 
  currentUser: User | null, 
  onUserClick?: (uid: string) => void,
  onNavigateToDiscover?: () => void,
  initialVideoId?: string,
  isMuted?: boolean,
  onMuteToggle?: () => void
}> = ({ currentUser, onUserClick, onNavigateToDiscover, initialVideoId, isMuted = true, onMuteToggle }) => {
  const { showError } = useError();
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedType, setFeedType] = useState<'foryou' | 'following'>('foryou');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isRestored, setIsRestored] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Save active index to localStorage
  useEffect(() => {
    if (videos.length > 0 && !initialVideoId) {
      localStorage.setItem(`reel_last_index_${feedType}`, activeIndex.toString());
    }
  }, [activeIndex, videos.length, initialVideoId, feedType]);

  // Restore active index on initial load
  useEffect(() => {
    if (!isRestored && videos.length > 0 && !initialVideoId && containerRef.current) {
      const savedIndex = localStorage.getItem(`reel_last_index_${feedType}`);
      if (savedIndex) {
        const index = parseInt(savedIndex);
        if (index > 0 && index < videos.length) {
          setActiveIndex(index);
          containerRef.current.scrollTo({
            top: index * containerRef.current.clientHeight,
            behavior: 'auto'
          });
        }
      }
      setIsRestored(true);
    } else if (initialVideoId && videos.length > 0) {
      setIsRestored(true);
    }
  }, [videos, isRestored, initialVideoId, feedType]);

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

  const [userInterests, setUserInterests] = useState<Record<string, number>>({});
  const [hashtagInterests, setHashtagInterests] = useState<Record<string, number>>({});

  useEffect(() => {
    if (currentUser) {
      const q = query(collection(db, 'user_interests'), where('userId', '==', currentUser.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const interests: Record<string, number> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          interests[data.creatorId] = data.score;
        });
        setUserInterests(interests);
      });

      // Also fetch hashtag interests if they exist (hypothetically)
      // For now, we'll derive some from recently liked videos
      const likesQuery = query(
        collection(db, 'likes'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const unsubLikes = onSnapshot(likesQuery, async (snapshot) => {
        const videoIds = snapshot.docs.map(doc => doc.data().videoId);
        if (videoIds.length > 0) {
          const hashtagCounts: Record<string, number> = {};
          // We can't easily fetch all videos at once due to 'in' limits, 
          // but we can approximate or just use the ones we have in state
          videos.forEach(v => {
            if (videoIds.includes(v.id) && v.hashtags) {
              v.hashtags.forEach(tag => {
                hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
              });
            }
          });
          setHashtagInterests(hashtagCounts);
        }
      });

      return () => {
        unsubscribe();
        unsubLikes();
      };
    }
  }, [currentUser, videos.length]);

  const rankVideos = (videoList: Video[]) => {
    const now = Date.now();
    return videoList.map(v => {
      const ageInHours = (now - v.createdAt) / (1000 * 60 * 60);
      
      // 1. Recency Score (Exponential decay)
      const recencyScore = 200 / Math.pow(ageInHours + 1, 1.2);
      
      // 2. Engagement Velocity (Trending)
      // We weight different interactions differently
      const engagementScore = (
        (v.likesCount || 0) * 10 + 
        (v.commentsCount || 0) * 15 +
        (v.sharesCount || 0) * 20 +
        (v.viewsCount || 0) * 1 +
        ((v.totalWatchTime || 0) / 60) * 5 // 5 points per minute watched
      ) / Math.pow(ageInHours + 2, 1.1);

      // 2.1 Negative Feedback Penalty
      // We penalize videos with high skip or report rates
      const negativeScore = (
        (v.skipsCount || 0) * 15 +
        (v.reportsCount || 0) * 100
      );

      // 3. Personalization: Creator Affinity
      const creatorScore = (userInterests[v.userId] || 0) * 12;
      
      // 4. Personalization: Hashtag Affinity
      let hashtagScore = 0;
      if (v.hashtags) {
        v.hashtags.forEach(tag => {
          hashtagScore += (hashtagInterests[tag] || 0) * 25;
        });
      }

      // 5. Relationship Bonus
      const followScore = followingIds.includes(v.userId) ? 150 : 0;
      
      // 6. Commercial/Platform Priority
      const boostScore = v.boosted ? 2000 : 0;
      
      // 7. Serendipity & Exploration (The "Discovery" factor)
      // We add a random component that is higher for newer videos to give them a chance
      const serendipity = Math.random() * (50 / (ageInHours + 1));

      // 8. Diversity Penalty (Avoid showing too many from same creator in a row)
      // This is harder to do in a simple map, but we can add a small random jitter
      const jitter = Math.random() * 10;

      const totalScore = 
        recencyScore + 
        engagementScore - 
        negativeScore +
        creatorScore + 
        hashtagScore + 
        followScore + 
        boostScore + 
        serendipity + 
        jitter;
      
      return { ...v, _score: totalScore };
    }).sort((a, b) => (b as any)._score - (a as any)._score);
  };

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
        orderBy('createdAt', 'desc'),
        limit(20) // Fetch a larger pool for ranking
      ];

      if (feedType === 'following') {
        if (followingIds.length === 0) {
          setVideos([]);
          setHasMore(false);
          setLoading(false);
          return;
        }
        // Firestore 'in' query limit is 30
        constraints.push(where('userId', 'in', followingIds.slice(0, 30)));
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
        setHasMore(snapshot.docs.length === 20);

        setVideos(prev => {
          // Ensure unique videos by ID
          const existingIds = new Set(isInitial ? [] : prev.map(v => v.id));
          const uniqueFetched = fetchedVids.filter(v => !existingIds.has(v.id));
          
          let updatedVids = isInitial ? fetchedVids : [...prev, ...uniqueFetched];
          
          if (isInitial && initialVid) {
            updatedVids = [initialVid, ...updatedVids.filter(v => v.id !== initialVideoId)];
          }

          // Apply ranking for 'For You' feed
          if (feedType === 'foryou') {
            return rankVideos(updatedVids);
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
    setIsRestored(false);
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
        {videos.length === 0 && loading ? (
          <div className="h-full w-full bg-black flex flex-col items-center justify-center">
            <div className="w-full h-full bg-zinc-900/10 animate-pulse relative">
              <div className="absolute bottom-24 left-6 space-y-4 w-2/3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-zinc-800 rounded-full" />
                  <div className="h-4 bg-zinc-800 rounded-full w-32" />
                </div>
                <div className="h-3 bg-zinc-800 rounded-full w-full" />
                <div className="h-3 bg-zinc-800 rounded-full w-3/4" />
                <div className="h-8 bg-zinc-800 rounded-2xl w-40" />
              </div>
              <div className="absolute right-4 bottom-24 space-y-8">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex flex-col items-center space-y-2">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full" />
                    <div className="h-2 bg-zinc-800 rounded-full w-6" />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="animate-spin text-zinc-800" size={48} />
              </div>
            </div>
          </div>
        ) : videos.length === 0 && !loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-zinc-500 space-y-6 p-8 text-center">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center animate-pulse border border-white/5">
              <LogoText className="opacity-20" />
            </div>
            {feedType === 'following' ? (
              <div>
                <p className="text-sm font-bold text-white mb-2">Not following anyone yet</p>
                <p className="text-xs text-zinc-500">Follow your favorite creators to see their latest reels here.</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-white mb-2">No reels found</p>
                <p className="text-xs text-zinc-500">Be the first to upload or check your connection.</p>
              </div>
            )}
            <button 
              onClick={() => feedType === 'following' ? onNavigateToDiscover?.() : loadVideos(true)}
              className="bg-zinc-900 border border-white/10 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center space-x-2 hover:bg-zinc-800 transition-all"
            >
              {feedType === 'following' ? (
                <>
                  <Search size={14} />
                  <span>Discover Creators</span>
                </>
              ) : (
                <>
                  <RefreshCcw size={14} />
                  <span>Retry Load</span>
                </>
              )}
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
