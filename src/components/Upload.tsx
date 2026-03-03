import React, { useState, useEffect, useRef } from 'react';
import { Upload as UploadIcon, X, Sparkles, AlertTriangle, CheckCircle2, Loader2, Eye, Music, Camera } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeVideoContent } from '../services/geminiService';
import { User, AudioTrack } from '../types';
import { useUpload } from '../contexts/UploadContext';
import { cn, formatDuration } from '../utils';
import { AudioLibrary } from './AudioLibrary';
import { compressVideo } from '../utils/videoCompression';
import confetti from 'canvas-confetti';

const generateThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      video.currentTime = 1; // Capture frame at 1 second
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    video.src = URL.createObjectURL(file);
  });
};

export const Upload: React.FC<{ user: User, onComplete: () => void }> = ({ user, onComplete }) => {
  const { startUpload, finalizeUpload, updateThumbnail, uploads, removeUpload } = useUpload();
  const [file, setFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isUpdatingThumb, setIsUpdatingThumb] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedAudio, setSelectedAudio] = useState<AudioTrack | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [showAudioLibrary, setShowAudioLibrary] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [fileType, setFileType] = useState<'video' | 'photo'>('video');

  const currentUpload = uploads.find(u => u.id === currentUploadId);

  useEffect(() => {
    if (currentUpload?.status === 'completed') {
      setIsPublishing(true); // Ensure success screen shows
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F43F5E', '#FB7185', '#FFFFFF']
      });
    }
  }, [currentUpload?.status]);

  const onDrop = (acceptedFiles: File[]) => {
    const droppedFile = acceptedFiles[0];
    if (droppedFile) {
      const isVideo = droppedFile.type.startsWith('video/');
      const type = isVideo ? 'video' : 'photo';
      setFileType(type);
      
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      
      if (isVideo) {
        // Get duration
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          setDuration(video.duration);
          URL.revokeObjectURL(video.src);
        };
        video.src = URL.createObjectURL(droppedFile);
      } else {
        setDuration(0);
      }

      handleAnalyze(droppedFile.name, type);

      const startCompressedUpload = async () => {
        setIsCompressing(isVideo); // Only show compression for video
        setCompressionProgress(0);
        
        try {
          let fileToUpload = droppedFile;
          
          if (isVideo) {
            // Add a timeout to compression - if it takes more than 15 seconds to even start or show progress, fallback
            const compressionPromise = compressVideo(droppedFile, (p) => setCompressionProgress(p));
            const compressionTimeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Compression timeout")), 20000));
            
            const compressedBlob = await Promise.race([compressionPromise, compressionTimeoutPromise]) as Blob;
            fileToUpload = new File([compressedBlob], droppedFile.name, { type: 'video/mp4' });
          }
          
          // Start upload with compressed file (or original if photo)
          const placeholderUrl = 'https://picsum.photos/seed/placeholder/300/533';
          
          const startImmediateUpload = async (thumbBlob: Blob) => {
            const videoId = await startUpload(fileToUpload, thumbBlob, user, type);
            setCurrentUploadId(videoId);
          };

          // Try to get real thumbnail
          let thumbPromise: Promise<Blob | null>;
          if (isVideo) {
            thumbPromise = generateThumbnail(droppedFile).then(async (dataUrl) => {
              const res = await fetch(dataUrl);
              return await res.blob();
            }).catch(() => null);
          } else {
            // For photos, the photo itself is the thumbnail
            thumbPromise = Promise.resolve(droppedFile);
          }

          const thumbTimeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 1500));

          Promise.race([thumbPromise, thumbTimeoutPromise]).then(async (blob) => {
            if (blob) {
              setThumbnailBlob(blob);
              startImmediateUpload(blob);
            } else {
              const res = await fetch(placeholderUrl);
              const placeholderBlob = await res.blob();
              setThumbnailBlob(placeholderBlob);
              startImmediateUpload(placeholderBlob);
            }
          });
        } catch (error) {
          console.error("Upload preparation failed, falling back to original", error);
          // Fallback to original file
          const placeholderUrl = 'https://picsum.photos/seed/placeholder/300/533';
          
          const startImmediateUpload = async (thumbBlob: Blob) => {
            const videoId = await startUpload(droppedFile, thumbBlob, user, type);
            setCurrentUploadId(videoId);
          };

          let fallbackThumbPromise: Promise<Blob | null>;
          if (isVideo) {
            fallbackThumbPromise = generateThumbnail(droppedFile).then(async (dataUrl) => {
              const res = await fetch(dataUrl);
              return await res.blob();
            }).catch(() => null);
          } else {
            fallbackThumbPromise = Promise.resolve(droppedFile);
          }

          const fallbackThumbTimeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 1500));

          Promise.race([fallbackThumbPromise, fallbackThumbTimeoutPromise]).then(async (blob) => {
            if (blob) {
              setThumbnailBlob(blob);
              startImmediateUpload(blob);
            } else {
              const res = await fetch(placeholderUrl);
              const placeholderBlob = await res.blob();
              setThumbnailBlob(placeholderBlob);
              startImmediateUpload(placeholderBlob);
            }
          });
        } finally {
          setIsCompressing(false);
        }
      };

      startCompressedUpload();
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'video/*': [],
      'image/*': []
    },
    maxFiles: 1
  } as any);

  const handleAnalyze = async (fileName: string, type: 'video' | 'photo') => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeVideoContent(`A ${type} named ${fileName}`);
      setAnalysis(result);
      if (result.isSafe) {
        setCaption(prev => prev || result.caption || '');
        setHashtags(prev => prev || result.hashtags?.map((t: string) => `#${t}`).join(' ') || '');
      }
    } catch (error) {
      console.error("Analysis failed", error);
      // Fallback to a default safe state if AI fails
      setAnalysis({
        isSafe: true,
        caption: '',
        hashtags: [],
        seoTitle: fileName
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePublish = () => {
    if (!file) return;
    // If analysis hasn't completed or failed, we default to safe to allow upload
    if (!analysis) {
      setAnalysis({ isSafe: true, caption: '', hashtags: [], seoTitle: file.name });
    }
    setShowConfirmModal(true);
  };

  const executePublish = async () => {
    if (!file || !currentUploadId) return;
    setShowConfirmModal(false);
    setIsPreparing(true);
    setIsPublishing(true);
    try {
      // Finalize the ongoing upload with metadata
      await finalizeUpload(currentUploadId, user, {
        caption: caption || 'New Reel',
        hashtags: hashtags || '',
        duration: duration || 0,
        audioTrack: selectedAudio || undefined
      });
    } catch (error) {
      console.error("Publishing failed", error);
      alert("Failed to publish. Please check your connection.");
      setIsPublishing(false);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = parseFloat(e.target.value);
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      videoRef.current.pause();
    }
  };

  const captureThumbnail = async () => {
    if (!videoRef.current || !currentUploadId) return;
    
    setIsUpdatingThumb(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setThumbnailPreviewUrl(dataUrl);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      setThumbnailBlob(blob);
      
      // Update in cloud
      await updateThumbnail(currentUploadId, blob, user.uid);
    } catch (error) {
      console.error("Failed to update thumbnail", error);
      alert("Failed to update thumbnail. Please try again.");
    } finally {
      setIsUpdatingThumb(false);
    }
  };

  const getStageMessage = (stage: string) => {
    const isVideo = file?.type.startsWith('video/');
    switch (stage) {
      case 'preparing': return isVideo ? 'Preparing video...' : 'Preparing photo...';
      case 'transmitting': return 'Transmitting data...';
      case 'processing': return 'Processing on server...';
      case 'transcoding': return isVideo ? 'Optimizing for all devices...' : 'Finalizing...';
      case 'saving': return 'Saving to your profile...';
      case 'done': return 'Successfully published!';
      default: return 'Uploading...';
    }
  };

  const getErrorMessage = (error: string) => {
    if (error.includes('storage/retry-limit-exceeded')) {
      return 'Network timeout. Your connection might be unstable. We will keep trying in the background.';
    }
    if (error.includes('storage/unauthorized')) {
      return 'Permission denied. Please make sure you are logged in.';
    }
    if (error.includes('quota exceeded')) {
      return 'Server storage quota exceeded. Please try again later.';
    }
    return error;
  };

  if (currentUpload && (isPublishing || currentUpload.status === 'completed' || currentUpload.status === 'error')) {
    return (
      <div className="h-full w-full bg-zinc-950 p-8 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-rose-500/20 rounded-[32px] flex items-center justify-center mb-8 relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-2 border-dashed border-rose-500/30 rounded-[32px]"
          />
          {currentUpload.status === 'uploading' ? (
            <UploadIcon size={40} className="text-rose-500 animate-bounce" />
          ) : currentUpload.status === 'completed' ? (
            <CheckCircle2 size={40} className="text-emerald-500" />
          ) : (
            <AlertTriangle size={40} className="text-rose-500" />
          )}
        </div>

        <h3 className="text-2xl font-black mb-2">
          {currentUpload.status === 'uploading' ? getStageMessage(currentUpload.stage) : 
           currentUpload.status === 'completed' ? 'Upload Complete!' : 'Upload Failed'}
        </h3>
        <p className="text-zinc-500 text-sm mb-12 max-w-[240px]">
          {currentUpload.status === 'uploading' ? `Your ${currentUpload.type === 'video' ? 'video' : 'photo'} is being processed and secured on our global servers.` :
           currentUpload.status === 'completed' ? `Your ${currentUpload.type === 'video' ? 'reel' : 'post'} is now live and visible to everyone!` : 
           getErrorMessage(currentUpload.error || 'Something went wrong during the upload.')}
        </p>

        <div className="w-full max-w-xs bg-zinc-900/50 border border-white/5 rounded-3xl p-6 space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Upload Progress</span>
            <span className="text-sm font-black text-white tabular-nums">{Math.round(currentUpload.progress)}%</span>
          </div>
          <div className="h-2 bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-white/5">
            <motion.div 
              className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${currentUpload.progress}%` }}
              transition={{ type: "spring", bounce: 0, duration: 0.5 }}
            />
          </div>
          <div className="flex items-center space-x-2">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full animate-pulse",
              currentUpload.status === 'uploading' ? "bg-rose-500" :
              currentUpload.status === 'completed' ? "bg-emerald-500" : "bg-rose-500"
            )} />
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
              {currentUpload.status === 'uploading' ? getStageMessage(currentUpload.stage) : 
               currentUpload.status === 'completed' ? 'Successfully published' : 'Error occurred'}
            </p>
          </div>
        </div>

        <div className="w-full max-w-xs space-y-3">
          {currentUpload.status === 'error' && (
            <button 
              onClick={() => {
                removeUpload(currentUpload.id);
                executePublish();
              }}
              className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
            >
              Retry Upload
            </button>
          )}
          <button 
            onClick={onComplete}
            className="w-full py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-200 transition-colors"
          >
            {currentUpload.status === 'completed' ? 'Done' : 'Close & Continue'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-zinc-950 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-bold">Create Post</h2>
        <button onClick={onComplete} className="text-zinc-400 hover:text-white">
          <X size={24} />
        </button>
      </div>

      {!file ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          {...getRootProps()} 
          className={cn(
            "flex-1 border-2 border-dashed rounded-[40px] flex flex-col items-center justify-center p-10 transition-all duration-500 group cursor-pointer relative overflow-hidden",
            isDragActive ? "border-rose-500 bg-rose-500/10 scale-[0.98]" : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700"
          )}
        >
          <input {...getInputProps()} />
          
          {isDragActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-rose-500/5 backdrop-blur-[2px] flex items-center justify-center"
            >
              <div className="absolute inset-0 border-8 border-rose-500/20 rounded-[40px] animate-pulse" />
            </motion.div>
          )}

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 bg-zinc-800 rounded-[32px] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl border border-white/5">
              <UploadIcon className={cn("transition-colors duration-300", isDragActive ? "text-white" : "text-rose-500")} size={40} />
            </div>
            <h3 className="text-2xl font-black mb-3 tracking-tighter uppercase italic">Select Video or Photo</h3>
            <p className="text-center text-zinc-500 text-sm max-w-[240px] font-medium leading-relaxed">
              Drag & drop your masterpiece here or click to browse files.
            </p>
            
            <div className="mt-12 flex items-center space-x-4">
              <div className="flex flex-col items-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500">
                  <span className="text-[10px] font-black">MP4/JPG</span>
                </div>
                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Format</span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div className="flex flex-col items-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500">
                  <span className="text-[10px] font-black">60s</span>
                </div>
                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Limit</span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div className="flex flex-col items-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500">
                  <Sparkles size={14} />
                </div>
                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">AI Scan</span>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto custom-scrollbar pb-24">
            {/* Video Preview Column */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative aspect-[9/16] w-full max-w-[340px] mx-auto rounded-[40px] overflow-hidden bg-black shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] group border border-white/5 flex flex-col"
            >
              <div className="relative flex-1 overflow-hidden">
                {file?.type.startsWith('video/') ? (
                  <video 
                    ref={videoRef}
                    src={preview!} 
                    className="w-full h-full object-cover" 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    onTimeUpdate={() => {
                      if (videoRef.current && !videoRef.current.paused) {
                        setCurrentTime(videoRef.current.currentTime);
                      }
                    }}
                  />
                ) : (
                  <img 
                    src={preview!} 
                    className="w-full h-full object-cover" 
                    alt="Preview"
                  />
                )}

                {/* Upload Progress Overlay on Preview */}
                {currentUpload && currentUpload.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-30">
                    <div className="w-24 h-24 relative flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          className="text-white/10"
                        />
                        <motion.circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray="251.2"
                          initial={{ strokeDashoffset: 251.2 }}
                          animate={{ strokeDashoffset: 251.2 - (251.2 * currentUpload.progress) / 100 }}
                          className="text-rose-500"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-white tabular-nums">
                          {Math.round(currentUpload.progress)}%
                        </span>
                        <span className="text-[8px] font-black text-white/50 uppercase tracking-widest text-center px-2">
                          {getStageMessage(currentUpload.stage)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Safety Badge on Preview */}
                {analysis && !isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "absolute top-6 left-6 px-3 py-1.5 rounded-full backdrop-blur-md border flex items-center space-x-2 z-20 shadow-lg",
                      analysis.isSafe 
                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" 
                        : "bg-rose-500/20 border-rose-500/30 text-rose-400"
                    )}
                  >
                    {analysis.isSafe ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {analysis.isSafe ? 'Safe Content' : 'Flagged'}
                    </span>
                  </motion.div>
                )}
                
                {/* Scanning Overlay */}
                <AnimatePresence>
                  {(isAnalyzing || isCompressing) && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-rose-500/10 backdrop-blur-[2px] flex flex-col items-center justify-center z-40"
                    >
                      <div className="relative">
                        <motion.div 
                          animate={{ 
                            top: ["0%", "100%", "0%"],
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            ease: "linear" 
                          }}
                          className="absolute left-0 right-0 h-1 bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)] z-10"
                        />
                        <div className="w-20 h-20 rounded-full border-2 border-rose-500/30 flex items-center justify-center">
                          {isCompressing ? (
                            <div className="relative flex items-center justify-center">
                              <Loader2 className="text-rose-500 animate-spin" size={32} />
                              <span className="absolute text-[8px] font-black text-rose-500">{Math.round(compressionProgress)}%</span>
                            </div>
                          ) : (
                            <Sparkles className="text-rose-500 animate-pulse" size={32} />
                          )}
                        </div>
                      </div>
                      <p className="mt-4 text-rose-500 font-black text-[10px] uppercase tracking-[0.2em] animate-pulse">
                        {isCompressing ? 'Compressing Video' : `AI Scanning ${fileType === 'video' ? 'Video' : 'Photo'}`}
                      </p>
                      {isCompressing && (
                        <p className="mt-1 text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Saving cloud storage space...</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                
                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden shadow-lg">
                      <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white text-xs font-black tracking-tight">@{user.name}</span>
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                        {fileType === 'video' ? 'Video' : 'Photo'} Post
                      </p>
                    </div>
                  </div>
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black text-white border border-white/10 shadow-xl">
                    {fileType === 'video' ? formatDuration(duration) : 'Photo'}
                  </div>
                </div>

                <button 
                  onClick={() => { setFile(null); setAnalysis(null); setDuration(null); }}
                  className="absolute top-6 right-6 bg-black/50 hover:bg-rose-500 p-2.5 rounded-full text-white backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 border border-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Thumbnail Selector Bar - Only for Video */}
              {file?.type.startsWith('video/') && (
                <div className="bg-zinc-900/90 backdrop-blur-xl p-6 border-t border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-black shrink-0">
                        {thumbnailPreviewUrl ? (
                          <img src={thumbnailPreviewUrl} className="w-full h-full object-cover" alt="Thumbnail Preview" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700">
                            <Camera size={16} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Thumbnail Frame</span>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Scrub to select cover</span>
                      </div>
                    </div>
                    <button 
                      onClick={captureThumbnail}
                      disabled={isUpdatingThumb}
                      className={cn(
                        "flex items-center space-x-2 px-4 py-2 rounded-xl transition-all shadow-lg active:scale-95",
                        isUpdatingThumb ? "bg-zinc-800 text-zinc-500" : "bg-white hover:bg-zinc-200 text-black"
                      )}
                    >
                      {isUpdatingThumb ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                      <span className="text-[10px] font-black uppercase tracking-widest">Set Cover</span>
                    </button>
                  </div>
                  <div className="relative h-12 flex items-center px-2 bg-black/40 rounded-2xl border border-white/5">
                    <div className="absolute inset-x-4 h-1 bg-zinc-800 rounded-full" />
                    <input 
                      type="range"
                      min="0"
                      max={duration || 0}
                      step="0.1"
                      value={currentTime}
                      onChange={handleSeek}
                      className="relative w-full h-8 bg-transparent appearance-none cursor-pointer accent-rose-500 z-10"
                    />
                    <div className="absolute -bottom-1 left-4 right-4 flex justify-between text-[7px] font-black text-zinc-600 uppercase tracking-widest">
                      <span>00:00</span>
                      <span className="text-rose-500/50">{formatDuration(currentTime)}</span>
                      <span>{formatDuration(duration)}</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Editing Column */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Background Upload Status */}
              {currentUpload && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900/50 border border-white/5 rounded-[32px] p-6 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center",
                        currentUpload.status === 'uploading' ? "bg-rose-500/10 text-rose-500" :
                        currentUpload.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" :
                        "bg-rose-500/10 text-rose-500"
                      )}>
                        {currentUpload.status === 'uploading' ? <Loader2 className="animate-spin" size={20} /> :
                         currentUpload.status === 'completed' ? <CheckCircle2 size={20} /> :
                         <AlertTriangle size={20} />}
                      </div>
                      <div>
                        <span className="block font-black text-sm uppercase tracking-widest">
                          {currentUpload.status === 'uploading' ? 'Uploading in Background' : 
                           currentUpload.status === 'completed' ? 'Upload Ready' : 'Upload Error'}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                          {getStageMessage(currentUpload.stage)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-sm font-black text-white tabular-nums">{Math.round(currentUpload.progress)}%</span>
                      <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">{currentUpload.status}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      className={cn(
                        "h-full rounded-full",
                        currentUpload.status === 'completed' ? "bg-emerald-500" : 
                        currentUpload.status === 'error' ? "bg-rose-500" : "bg-rose-500"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${currentUpload.progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </motion.div>
              )}

              {/* AI Status Card */}
              <div className="bg-zinc-900/50 border border-white/5 rounded-[32px] p-8 shadow-xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <span className="block font-black text-sm uppercase tracking-widest">AI Content Guard</span>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Powered by Gemini</span>
                    </div>
                  </div>
                  {isAnalyzing && <Loader2 className="animate-spin text-rose-500" size={20} />}
                </div>

                {isAnalyzing ? (
                  <div className="space-y-4">
                    <div className="h-2 bg-zinc-800 rounded-full w-full animate-pulse overflow-hidden">
                      <motion.div 
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="h-full w-1/3 bg-rose-500/50"
                      />
                    </div>
                    <div className="flex justify-between">
                      <div className="h-2 bg-zinc-800 rounded-full w-1/3 animate-pulse" />
                      <div className="h-2 bg-zinc-800 rounded-full w-1/4 animate-pulse" />
                    </div>
                  </div>
                ) : analysis ? (
                  <div className="space-y-4">
                    {!analysis.isSafe ? (
                      <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl"
                      >
                        <div className="flex items-center space-x-3 text-rose-500 mb-2">
                          <AlertTriangle size={20} />
                          <span className="font-black text-xs uppercase tracking-widest">Safety Status: Flagged</span>
                        </div>
                        <p className="text-xs text-rose-200/70 leading-relaxed font-medium">
                          {analysis.safetyReason || "This video may violate our community guidelines."}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                            <CheckCircle2 size={18} />
                          </div>
                          <div>
                            <span className="block text-emerald-500 font-black text-[10px] uppercase tracking-widest">Safety Status</span>
                            <span className="text-emerald-400/80 font-bold text-xs">Verified & Safe</span>
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-emerald-500/20 rounded-full">
                          <span className="text-[10px] font-black text-emerald-500 uppercase">Passed</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Waiting for analysis...</p>
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Caption</label>
                    <span className="text-[10px] text-zinc-600 font-bold">{caption.length}/200</span>
                  </div>
                  <div className="relative group">
                    <textarea 
                      value={caption}
                      onChange={(e) => setCaption(e.target.value.slice(0, 200))}
                      className="w-full bg-zinc-900/80 border border-white/5 rounded-[24px] p-5 text-sm focus:outline-none focus:border-rose-500/50 transition-all resize-none min-h-[120px] placeholder:text-zinc-700 group-hover:border-white/10"
                      placeholder={`Write a catchy caption for your ${fileType === 'video' ? 'reel' : 'post'}...`}
                    />
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Sparkles size={14} className="text-rose-500/50" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Background Music</label>
                    {selectedAudio && (
                      <button 
                        onClick={() => setSelectedAudio(null)}
                        className="text-[10px] text-rose-500 font-bold uppercase tracking-widest hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => setShowAudioLibrary(true)}
                    className={cn(
                      "w-full p-5 rounded-[24px] border flex items-center justify-between transition-all group",
                      selectedAudio 
                        ? "bg-rose-500/10 border-rose-500/30" 
                        : "bg-zinc-900/80 border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        selectedAudio ? "bg-rose-500 text-white" : "bg-zinc-800 text-zinc-500 group-hover:text-rose-500"
                      )}>
                        <Music size={20} />
                      </div>
                      <div className="text-left">
                        <p className={cn(
                          "text-sm font-black leading-tight",
                          selectedAudio ? "text-white" : "text-zinc-500"
                        )}>
                          {selectedAudio ? selectedAudio.title : "Add Background Music"}
                        </p>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                          {selectedAudio ? selectedAudio.artist : "Search audio library"}
                        </p>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-white transition-colors">
                      <Sparkles size={14} />
                    </div>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Hashtags</label>
                    <span className="text-[10px] text-zinc-600 font-bold">AI Suggested</span>
                  </div>
                  <div className="relative group">
                    <input 
                      type="text"
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      className="w-full bg-zinc-900/80 border border-white/5 rounded-[24px] p-5 text-sm focus:outline-none focus:border-rose-500/50 transition-all placeholder:text-zinc-700 group-hover:border-white/10"
                      placeholder="#trending #viral #reels"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 space-y-3">
                <button 
                  disabled={!analysis?.isSafe || isPreparing || isAnalyzing}
                  onClick={handlePublish}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center space-x-2 shadow-2xl",
                    analysis?.isSafe 
                      ? "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20" 
                      : "bg-zinc-900 text-zinc-600 cursor-not-allowed border border-white/5"
                  )}
                >
                  {isPreparing ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <UploadIcon size={18} />
                      <span>{fileType === 'video' ? 'Publish Reel' : 'Publish Post'}</span>
                    </>
                  )}
                </button>
                
                <p className="text-[10px] text-center text-zinc-500 font-medium">
                  By publishing, you agree to our Content Policy.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black uppercase tracking-widest">Review Reel</h3>
                  <button onClick={() => setShowConfirmModal(false)} className="text-zinc-500 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex space-x-4">
                  <div className="w-24 aspect-[9/16] bg-black rounded-xl overflow-hidden shrink-0 border border-white/5">
                    <video src={preview!} className="w-full h-full object-cover" muted />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="bg-zinc-800/50 p-3 rounded-xl">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Caption</p>
                      <p className="text-xs text-white line-clamp-3 font-medium">
                        {caption || <span className="italic text-zinc-600">No caption</span>}
                      </p>
                    </div>
                    <div className="bg-zinc-800/50 p-3 rounded-xl">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Hashtags</p>
                      <p className="text-xs text-rose-400 font-bold truncate">
                        {hashtags || <span className="italic text-zinc-600">No hashtags</span>}
                      </p>
                    </div>
                    {selectedAudio && (
                      <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Audio</p>
                        <p className="text-xs text-white font-bold truncate">
                          {selectedAudio.title}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start space-x-3">
                  <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                  <p className="text-[10px] text-amber-200/80 font-medium leading-relaxed">
                    Once published, your reel will be visible to everyone on the platform. Make sure your content follows our community guidelines.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setShowConfirmModal(false)}
                    className="py-4 bg-zinc-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-700 transition-colors"
                  >
                    Edit More
                  </button>
                  <button 
                    onClick={executePublish}
                    className="py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors"
                  >
                    Confirm & Post
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audio Library Modal */}
      <AnimatePresence>
        {showAudioLibrary && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowAudioLibrary(false)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg h-[80vh] bg-zinc-950 border border-white/10 rounded-[40px] overflow-hidden shadow-2xl"
            >
              <AudioLibrary 
                onSelect={(track) => {
                  setSelectedAudio(track);
                  setShowAudioLibrary(false);
                }}
                onClose={() => setShowAudioLibrary(false)}
                selectedTrackId={selectedAudio?.id}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Uploads List (Floating at bottom) */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm z-[60] px-4"
          >
            <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-[32px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Active Uploads</span>
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{uploads.length} Item{uploads.length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                {uploads.map((upload) => (
                  <div key={upload.id} className="bg-black/40 rounded-2xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 overflow-hidden">
                        {upload.status === 'uploading' ? (
                          <Loader2 size={12} className="animate-spin text-rose-500 shrink-0" />
                        ) : upload.status === 'completed' ? (
                          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle size={12} className="text-rose-500 shrink-0" />
                        )}
                        <span className="text-[10px] font-bold text-white truncate uppercase tracking-tight">{upload.fileName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-black text-zinc-500 tabular-nums">{Math.round(upload.progress)}%</span>
                        {upload.status === 'uploading' && (
                          <button 
                            onClick={() => removeUpload(upload.id)}
                            className="text-zinc-500 hover:text-rose-500 transition-colors p-1"
                            title="Cancel upload"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        className={cn(
                          "h-full rounded-full",
                          upload.status === 'completed' ? "bg-emerald-500" : "bg-rose-500"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${upload.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    {upload.status === 'completed' && (
                      <button 
                        onClick={() => removeUpload(upload.id)}
                        className="mt-2 text-[8px] font-black text-zinc-500 uppercase tracking-widest hover:text-white transition-colors"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
