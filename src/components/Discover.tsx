import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Users, Sparkles, Play, Heart, ChevronRight, Loader2 } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Video, User } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber, cn } from '../utils';

interface DiscoverProps {
  onUserClick: (uid: string) => void;
  onVideoClick: (video: Video) => void;
}

export const Discover: React.FC<DiscoverProps> = ({ onUserClick, onVideoClick }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [popularCreators, setPopularCreators] = useState<User[]>([]);
  const [newVideos, setNewVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<{ videos: Video[], users: User[] }>({ videos: [], users: [] });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ videos: [], users: [] });
      setIsSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const q = searchQuery.toLowerCase();
        
        // Search Users
        const usersQuery = query(
          collection(db, 'users'),
          orderBy('name'),
          limit(20)
        );
        const usersSnap = await getDocs(usersQuery);
        const filteredUsers = usersSnap.docs
          .map(doc => ({ ...doc.data(), uid: doc.id } as User))
          .filter(u => u.name.toLowerCase().includes(q));

        // Search Videos (by caption)
        const vidsQuery = query(
          collection(db, 'videos'),
          where('status', '==', 'ready'),
          limit(50)
        );
        const vidsSnap = await getDocs(vidsQuery);
        const filteredVids = vidsSnap.docs
          .map(doc => ({ ...doc.data(), id: doc.id } as Video))
          .filter(v => v.caption.toLowerCase().includes(q));

        setSearchResults({ videos: filteredVids, users: filteredUsers });
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    const fetchDiscoverData = async () => {
      setIsLoading(true);
      try {
        // Trending Videos (by views)
        const trendingQuery = query(
          collection(db, 'videos'),
          where('status', '==', 'ready'),
          orderBy('boosted', 'desc'),
          orderBy('viewsCount', 'desc'),
          limit(6)
        );
        const unsubTrending = onSnapshot(trendingQuery, (snapshot) => {
          setTrendingVideos(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Video)));
        });

        // Popular Creators (by followers)
        const creatorsQuery = query(
          collection(db, 'users'),
          orderBy('followersCount', 'desc'),
          limit(10)
        );
        const unsubCreators = onSnapshot(creatorsQuery, (snapshot) => {
          setPopularCreators(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User)));
        });

        // New Content
        const newQuery = query(
          collection(db, 'videos'),
          where('status', '==', 'ready'),
          orderBy('createdAt', 'desc'),
          limit(12)
        );
        const unsubNew = onSnapshot(newQuery, (snapshot) => {
          setNewVideos(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Video)));
        });

        setIsLoading(false);
        return () => {
          unsubTrending();
          unsubCreators();
          unsubNew();
        };
      } catch (error) {
        console.error("Error fetching discover data:", error);
        setIsLoading(false);
      }
    };

    fetchDiscoverData();
  }, []);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-black">
        <Loader2 className="animate-spin text-rose-500" size={40} />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black overflow-y-auto custom-scrollbar pb-24">
      {/* Search Header */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl p-6 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
          <input 
            type="text"
            placeholder="Search creators, sounds, hashtags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-rose-500/50 transition-all font-medium"
          />
        </div>
      </div>

      <div className="p-6 space-y-10">
        {searchQuery.trim() ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <Loader2 className="animate-spin mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">Searching...</p>
              </div>
            ) : (
              <>
                {/* Search Results - Users */}
                {searchResults.users.length > 0 && (
                  <section>
                    <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Users</h2>
                    <div className="space-y-4">
                      {searchResults.users.map(user => (
                        <div 
                          key={user.uid}
                          onClick={() => onUserClick(user.uid)}
                          className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <img src={user.profileImage} className="w-12 h-12 rounded-full object-cover border border-white/10" alt="" />
                            <div>
                              <p className="font-black text-sm">@{user.name}</p>
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{formatNumber(user.followersCount)} Followers</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-zinc-500" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Search Results - Videos */}
                {searchResults.videos.length > 0 && (
                  <section>
                    <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Videos</h2>
                    <div className="grid grid-cols-3 gap-1">
                      {searchResults.videos.map(video => (
                        <div 
                          key={video.id}
                          onClick={() => onVideoClick(video)}
                          className="aspect-[9/16] bg-zinc-900 relative cursor-pointer group overflow-hidden"
                        >
                          <img src={video.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />
                          <div className="absolute bottom-2 left-2 flex items-center space-x-1 text-white text-[9px] font-black drop-shadow-lg">
                            <Play size={10} className="fill-white" />
                            <span>{formatNumber(video.viewsCount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {searchResults.users.length === 0 && searchResults.videos.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                    <Search size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-bold uppercase tracking-widest">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Popular Creators Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-500/10 p-2 rounded-xl">
                <Users className="text-blue-500" size={20} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight italic">Popular Creators</h2>
            </div>
            <button className="text-zinc-500 hover:text-white transition-colors">
              <ChevronRight size={24} />
            </button>
          </div>
          
          <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
            {popularCreators.map((creator) => (
              <motion.div 
                key={creator.uid}
                whileHover={{ y: -5 }}
                onClick={() => onUserClick(creator.uid)}
                className="flex flex-col items-center space-y-3 min-w-[100px] cursor-pointer group"
              >
                <div className="relative">
                  <div className="w-20 h-20 rounded-[28px] overflow-hidden border-2 border-zinc-800 group-hover:border-rose-500 transition-colors">
                    <img src={creator.profileImage} alt={creator.name} className="w-full h-full object-cover" />
                  </div>
                  {creator.monetizationStatus === 'approved' && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-500 p-1 rounded-full border-2 border-black">
                      <Sparkles size={10} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-white truncate max-w-[80px]">@{creator.name}</p>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                    {formatNumber(creator.followersCount)} Fans
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Trending Videos Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <div className="bg-rose-500/10 p-2 rounded-xl">
                <TrendingUp className="text-rose-500" size={20} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight italic">Trending Now</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {trendingVideos.map((video) => (
              <motion.div 
                key={video.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => onVideoClick(video)}
                className="relative aspect-[9/16] rounded-[32px] overflow-hidden bg-zinc-900 cursor-pointer group shadow-2xl"
              >
                <img src={video.thumbnailUrl} alt={video.caption} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                
                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg flex items-center space-x-1 border border-white/10">
                  <Play size={10} className="text-white fill-white" />
                  <span className="text-[10px] font-black text-white">{formatNumber(video.viewsCount)}</span>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight mb-2">{video.caption}</p>
                  <div className="flex items-center space-x-2">
                    <img src={video.userProfileImage} className="w-5 h-5 rounded-full border border-white/20" alt="" />
                    <span className="text-[9px] font-black text-white/80 uppercase tracking-widest truncate">@{video.userName}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* New Discoveries Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <div className="bg-emerald-500/10 p-2 rounded-xl">
                <Sparkles className="text-emerald-500" size={20} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight italic">Fresh Content</h2>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {newVideos.map((video) => (
              <motion.div 
                key={video.id}
                whileHover={{ opacity: 0.8 }}
                onClick={() => onVideoClick(video)}
                className="aspect-[9/16] bg-zinc-900 relative cursor-pointer"
              >
                <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 flex items-center space-x-1 text-white text-[9px] font-black drop-shadow-lg">
                  <Heart size={10} className="fill-rose-500 text-rose-500" />
                  <span>{formatNumber(video.likesCount)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
          </>
        )}
      </div>
    </div>
  );
};
