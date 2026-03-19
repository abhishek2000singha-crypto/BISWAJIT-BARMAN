import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, Music } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';
import { cn } from '../utils';

export const GlobalAudioPlayer: React.FC = () => {
  const { playingTrack, isPlaying, togglePlay, stopTrack, isLoading } = useAudio();

  if (!playingTrack) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 z-[70] pointer-events-auto"
      >
        <div className="bg-zinc-900/95 backdrop-blur-2xl border border-white/10 p-3 rounded-[24px] shadow-2xl flex items-center justify-between ring-1 ring-white/5">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 group">
              {playingTrack.thumbnailUrl ? (
                <img 
                  src={playingTrack.thumbnailUrl} 
                  alt={playingTrack.title}
                  className={cn(
                    "w-full h-full object-cover transition-transform duration-500",
                    isPlaying && "scale-110"
                  )}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  <Music size={20} />
                </div>
              )}
              {isPlaying && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="flex items-end space-x-0.5 h-4">
                    {[0.6, 0.4, 0.8, 0.5].map((h, i) => (
                      <motion.div
                        key={i}
                        animate={{ height: ["20%", "100%", "20%"] }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.1,
                          ease: "easeInOut"
                        }}
                        className="w-1 bg-rose-500 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-black text-white truncate uppercase tracking-tight leading-tight">
                {playingTrack.title}
              </h4>
              <p className="text-[10px] font-bold text-zinc-500 truncate uppercase tracking-widest mt-0.5">
                {playingTrack.artist}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => playingTrack && togglePlay(playingTrack)}
              disabled={isLoading}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90",
                isPlaying 
                  ? "bg-white text-black hover:bg-zinc-200" 
                  : "bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20"
              )}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            
            <button
              onClick={stopTrack}
              className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
