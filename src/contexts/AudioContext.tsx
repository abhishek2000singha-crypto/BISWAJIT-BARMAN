import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AudioTrack } from '../types';

interface AudioContextType {
  playingTrack: AudioTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  playTrack: (track: AudioTrack) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  togglePlay: (track: AudioTrack) => void;
  stopTrack: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playingTrack, setPlayingTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    
    const audio = audioRef.current;

    const handleEnded = () => {
      setIsPlaying(false);
      setPlayingTrack(null);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handleError = (e: any) => {
      console.error("Audio error:", e);
      setIsLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  }, []);

  const playTrack = (track: AudioTrack) => {
    if (!audioRef.current) return;

    if (playingTrack?.id === track.id) {
      resumeTrack();
      return;
    }

    setIsLoading(true);
    setPlayingTrack(track);
    audioRef.current.src = track.url;
    audioRef.current.play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(err => {
        console.error("Playback failed:", err);
        setIsLoading(false);
        setIsPlaying(false);
      });
  };

  const pauseTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resumeTrack = () => {
    if (audioRef.current && playingTrack) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(err => {
          console.error("Resume failed:", err);
          setIsPlaying(false);
        });
    }
  };

  const togglePlay = (track: AudioTrack) => {
    if (playingTrack?.id === track.id) {
      if (isPlaying) {
        pauseTrack();
      } else {
        resumeTrack();
      }
    } else {
      playTrack(track);
    }
  };

  const stopTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setPlayingTrack(null);
      setIsPlaying(false);
      setIsLoading(false);
    }
  };

  return (
    <AudioContext.Provider value={{
      playingTrack,
      isPlaying,
      isLoading,
      playTrack,
      pauseTrack,
      resumeTrack,
      togglePlay,
      stopTrack
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
