import React, { useState, useEffect } from 'react';
import { Search, Music, Play, Pause, Check, X, Loader2, Volume2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioTrack } from '../types';
import { cn } from '../utils';

const MOCK_AUDIO_TRACKS: AudioTrack[] = [
  {
    id: 'h1',
    title: 'Kesariya',
    artist: 'Arijit Singh',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/hindi1/100/100',
    duration: 180,
    language: 'Hindi',
    genre: 'Romantic',
    isTrending: true
  },
  {
    id: 'h2',
    title: 'Apna Bana Le',
    artist: 'Arijit Singh',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/hindi2/100/100',
    duration: 210,
    language: 'Hindi',
    genre: 'Romantic',
    isTrending: true
  },
  {
    id: 'h3',
    title: 'Kala Chashma',
    artist: 'Badshah',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/hindi3/100/100',
    duration: 190,
    language: 'Hindi',
    genre: 'Party',
    isTrending: true
  },
  {
    id: 'b1',
    title: 'Tumi Jake Bhalobaso',
    artist: 'Iman Chakraborty',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/bengali1/100/100',
    duration: 195,
    language: 'Bengali',
    genre: 'Folk'
  },
  {
    id: 'b2',
    title: 'Bhalobashar Morshum',
    artist: 'Shreya Ghoshal',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/bengali2/100/100',
    duration: 240,
    language: 'Bengali',
    genre: 'Romantic',
    isTrending: true
  },
  {
    id: 'b3',
    title: 'Ami Banglay Gaan Gai',
    artist: 'Pratul Mukhopadhyay',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/bengali3/100/100',
    duration: 215,
    language: 'Bengali',
    genre: 'Patriotic'
  },
  {
    id: 'n1',
    title: 'Phool Butte Sari',
    artist: 'Milan Newar',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/nepali1/100/100',
    duration: 220,
    language: 'Nepali',
    genre: 'Pop',
    isTrending: true
  },
  {
    id: 'n2',
    title: 'Kutu Ma Kutu',
    artist: 'Rajan Raj Shiwakoti',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/nepali2/100/100',
    duration: 185,
    language: 'Nepali',
    genre: 'Dance'
  },
  {
    id: 'a1',
    title: 'O Mur Apunar Desh',
    artist: 'Zubeen Garg',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/assamese1/100/100',
    duration: 200,
    language: 'Assamese',
    genre: 'Patriotic'
  },
  {
    id: 'a2',
    title: 'Buku Hom Hom Kore',
    artist: 'Bhupen Hazarika',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/assamese2/100/100',
    duration: 250,
    language: 'Assamese',
    genre: 'Folk'
  },
  {
    id: 'e1',
    title: 'Summer Vibes',
    artist: 'Lofi Girl',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/lofi/100/100',
    duration: 150,
    language: 'English',
    genre: 'Lofi',
    isTrending: true
  },
  {
    id: 'e2',
    title: 'Midnight City',
    artist: 'M83',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/synth/100/100',
    duration: 243,
    language: 'English',
    genre: 'Electronic',
    isTrending: true
  },
  {
    id: 'e3',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
    thumbnailUrl: 'https://picsum.photos/seed/weeknd/100/100',
    duration: 200,
    language: 'English',
    genre: 'Pop',
    isTrending: true
  }
];

interface AudioLibraryProps {
  onSelect: (track: AudioTrack) => void;
  onClose: () => void;
  selectedTrackId?: string;
}

const LANGUAGES = ['All', 'Hindi', 'Bengali', 'Nepali', 'Assamese', 'English'];
const GENRES = ['All', 'Trending', 'Romantic', 'Party', 'Folk', 'Pop', 'Dance', 'Patriotic', 'Lofi', 'Electronic'];

export const AudioLibrary: React.FC<AudioLibraryProps> = ({ onSelect, onClose, selectedTrackId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audio] = useState(new Audio());
  const [isLoading, setIsLoading] = useState(false);

  const filteredTracks = MOCK_AUDIO_TRACKS.filter(track => {
    const matchesSearch = 
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLanguage = selectedLanguage === 'All' || track.language === selectedLanguage;
    const matchesGenre = 
      selectedGenre === 'All' || 
      (selectedGenre === 'Trending' ? track.isTrending : track.genre === selectedGenre);
    
    return matchesSearch && matchesLanguage && matchesGenre;
  });

  useEffect(() => {
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audio]);

  const togglePlay = (track: AudioTrack) => {
    if (playingTrackId === track.id) {
      audio.pause();
      setPlayingTrackId(null);
    } else {
      setIsLoading(true);
      audio.src = track.url;
      audio.play().then(() => {
        setIsLoading(false);
        setPlayingTrackId(track.id);
      }).catch(err => {
        console.error("Audio play failed", err);
        setIsLoading(false);
      });
    }
  };

  audio.onended = () => {
    setPlayingTrackId(null);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500">
              <Music size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest">Audio Library</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Choose background music</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="relative group mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-rose-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search songs or artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-rose-500/50 transition-all placeholder:text-zinc-600"
          />
        </div>

        <div className="flex flex-col space-y-3">
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest shrink-0">Language:</span>
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all shrink-0",
                  selectedLanguage === lang
                    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                    : "bg-zinc-900 text-zinc-500 border border-white/5 hover:border-white/10"
                )}
              >
                {lang}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest shrink-0">Genre:</span>
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all shrink-0",
                  selectedGenre === genre
                    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                    : "bg-zinc-900 text-zinc-500 border border-white/5 hover:border-white/10"
                )}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {searchQuery === '' && selectedLanguage === 'All' && selectedGenre === 'All' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Recommended for you</h4>
              <Sparkles size={12} className="text-rose-500" />
            </div>
            <div className="flex space-x-3 overflow-x-auto pb-2 no-scrollbar">
              {MOCK_AUDIO_TRACKS.filter(t => t.isTrending).slice(0, 5).map((track) => (
                <motion.div 
                  key={`rec-${track.id}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelect(track)}
                  className="relative w-32 h-32 rounded-2xl overflow-hidden shrink-0 cursor-pointer group border border-white/5"
                >
                  <img src={track.thumbnailUrl} alt={track.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <button 
                      onClick={(e) => { e.stopPropagation(); togglePlay(track); }}
                      className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-xl"
                    >
                      {playingTrackId === track.id ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[10px] font-black text-white truncate leading-tight">{track.title}</p>
                    <p className="text-[8px] text-zinc-400 font-bold truncate uppercase tracking-widest">{track.artist}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              {searchQuery || selectedLanguage !== 'All' || selectedGenre !== 'All' ? 'Search Results' : 'All Tracks'}
            </h4>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{filteredTracks.length} Tracks</span>
          </div>
          
          <div className="space-y-2">
            {filteredTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                <Music size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">No tracks found</p>
              </div>
            ) : (
              filteredTracks.map((track) => (
                <motion.div 
                  layout
                  key={track.id}
                  className={cn(
                    "p-3 rounded-2xl border transition-all flex items-center justify-between group",
                    selectedTrackId === track.id 
                      ? "bg-rose-500/10 border-rose-500/30" 
                      : "bg-zinc-900/30 border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center space-x-4">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                      <img src={track.thumbnailUrl} alt={track.title} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => togglePlay(track)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {playingTrackId === track.id ? (
                          isLoading ? <Loader2 className="animate-spin" size={16} /> : <Pause size={16} />
                        ) : (
                          <Play size={16} />
                        )}
                      </button>
                      {playingTrackId === track.id && !isLoading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                          <div className="flex items-end space-x-0.5 h-4">
                            <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-rose-500" />
                            <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-rose-500" />
                            <motion.div animate={{ height: [6, 14, 6] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-0.5 bg-rose-500" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-black text-white leading-tight">{track.title}</p>
                        {track.isTrending && (
                          <span className="flex items-center space-x-0.5 bg-rose-500/20 text-rose-500 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter">
                            <Sparkles size={8} />
                            <span>Trending</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{track.artist}</p>
                        <span className="text-[8px] text-zinc-700 font-black uppercase tracking-widest px-1.5 py-0.5 bg-zinc-800 rounded-md">{track.genre}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black text-zinc-600 tabular-nums">
                      {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                    </span>
                    <button 
                      onClick={() => onSelect(track)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        selectedTrackId === track.id 
                          ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" 
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                      )}
                    >
                      {selectedTrackId === track.id ? <Check size={20} /> : <Music size={18} />}
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>

      {playingTrackId && (
        <div className="p-4 bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Volume2 size={16} className="text-rose-500 animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Previewing: <span className="text-white">{MOCK_AUDIO_TRACKS.find(t => t.id === playingTrackId)?.title}</span>
            </p>
          </div>
          <button 
            onClick={() => { audio.pause(); setPlayingTrackId(null); }}
            className="text-[10px] font-black text-rose-500 uppercase tracking-widest"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
};
