import React, { createContext, useContext, useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, uploadBytes, UploadTask } from 'firebase/storage';
import { collection, addDoc, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { User, AudioTrack, TextOverlay } from '../types';

interface UploadJob {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  stage: 'preparing' | 'transmitting' | 'processing' | 'transcoding' | 'saving' | 'done';
  type: 'video' | 'photo';
  error?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  resolutions?: { [key: string]: string };
  task?: UploadTask;
  metadata?: { 
    caption: string; 
    hashtags: string; 
    duration?: number; 
    audioTrack?: AudioTrack; 
    customBoostPrice?: number;
    trimStart?: number;
    trimEnd?: number;
    filter?: string;
    textOverlays?: TextOverlay[];
    moderation?: {
      isSafe: boolean;
      safetyReason?: string;
      analyzedAt: number;
      caption?: string;
      hashtags?: string[];
      seoTitle?: string;
    };
  };
  isFinalized?: boolean;
}

interface UploadContextType {
  uploads: UploadJob[];
  startUpload: (file: File, thumbnailBlob: Blob, user: User, type: 'video' | 'photo') => Promise<string>;
  finalizeUpload: (id: string, user: User, metadata: { 
    caption: string; 
    hashtags: string; 
    duration?: number; 
    audioTrack?: AudioTrack; 
    customBoostPrice?: number;
    trimStart?: number;
    trimEnd?: number;
    filter?: string;
    textOverlays?: TextOverlay[];
    moderation?: {
      isSafe: boolean;
      safetyReason?: string;
      analyzedAt: number;
      caption?: string;
      hashtags?: string[];
      seoTitle?: string;
    };
  }) => Promise<void>;
  updateThumbnail: (id: string, thumbnailBlob: Blob, userId: string) => Promise<void>;
  removeUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<UploadJob[]>([]);

  const saveToFirestore = useCallback(async (id: string, user: User, job: UploadJob, metadata: { 
    caption: string; 
    hashtags: string; 
    duration?: number; 
    audioTrack?: AudioTrack; 
    customBoostPrice?: number;
    trimStart?: number;
    trimEnd?: number;
    filter?: string;
    textOverlays?: TextOverlay[];
    moderation?: {
      isSafe: boolean;
      safetyReason?: string;
      analyzedAt: number;
      caption?: string;
      hashtags?: string[];
      seoTitle?: string;
    };
  }) => {
    if (!job.videoUrl || !job.thumbnailUrl) return;

    setUploads(prev => prev.map(u => u.id === id ? { ...u, stage: 'saving' } : u));
    
    const videoData = {
      videoUrl: job.videoUrl,
      thumbnailUrl: job.thumbnailUrl,
      resolutions: job.resolutions || null,
      caption: metadata.caption || (job.type === 'video' ? 'New Reel' : 'New Post'),
      hashtags: (metadata.hashtags || '').split(' ').filter(t => t.startsWith('#')).map(t => t.slice(1)),
      duration: metadata.duration || 0,
      trimStart: metadata.trimStart || 0,
      trimEnd: metadata.trimEnd || metadata.duration || 0,
      filter: metadata.filter || '',
      textOverlays: metadata.textOverlays || [],
      audioTrack: metadata.audioTrack || null,
      customBoostPrice: metadata.customBoostPrice || null,
      moderation: metadata.moderation || null,
      status: job.type === 'photo' ? 'ready' as const : 'processing' as const,
      updatedAt: Date.now()
    };

    // Retry Firestore update with exponential backoff
    let saveSuccess = false;
    let saveAttempts = 0;
    const videoRef_fs = doc(db, 'videos', id);
    
    while (!saveSuccess && saveAttempts < 5) {
      try {
        await updateDoc(videoRef_fs, videoData);
        saveSuccess = true;
      } catch (e) {
        saveAttempts++;
        console.warn(`Firestore update attempt ${saveAttempts} failed, retrying...`, e);
        await new Promise(r => setTimeout(r, Math.pow(2, saveAttempts) * 500));
      }
    }

    if (!saveSuccess) throw new Error("Could not save video to your profile. Please check your connection.");

    // Trigger Transcoding - Only for Videos
    if (job.type === 'video') {
      try {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, stage: 'transcoding' } : u));
        const apiBase = import.meta.env.VITE_API_BASE_URL || '';
        
        const response = await fetch(`${apiBase}/api/videos/transcode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: id, videoUrl: job.videoUrl })
        }).catch(() => null);
        
        if (!response || !response.ok) {
          console.warn("Transcoding trigger failed or backend unavailable. Setting status to ready with mock resolutions for adaptive streaming demo.");
          
          // Mock resolutions for demonstration of adaptive streaming
          const mockResolutions = {
            '1080p': job.videoUrl,
            '720p': job.videoUrl,
            '480p': job.videoUrl,
            '360p': job.videoUrl
          };

          await updateDoc(videoRef_fs, { 
            status: 'ready',
            resolutions: mockResolutions,
            adaptiveStreaming: true,
            updatedAt: Date.now()
          });
        }
      } catch (e) {
        console.warn("Transcoding trigger failed, attempting fallback to ready status.", e);
        try {
          await updateDoc(videoRef_fs, { 
            status: 'ready',
            updatedAt: Date.now()
          });
        } catch (fallbackErr) {
          console.error("Fallback to ready status failed:", fallbackErr);
        }
      }
    }

    setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'completed', progress: 100, stage: 'done' } : u));
    
    // Keep the success state visible for a bit then remove
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.id !== id));
    }, 8000);
  }, []);

  const startUpload = useCallback(async (
    file: File, 
    thumbnailBlob: Blob,
    user: User,
    type: 'video' | 'photo'
  ) => {
    const videoId = Math.random().toString(36).substring(7);
    const id = videoId;
    const videoRef = ref(storage, `${type === 'video' ? 'videos' : 'photos'}/${user.uid}/${videoId}_${file.name}`);
    const videoUploadTask = uploadBytesResumable(videoRef, file);

    const newUpload: UploadJob = {
      id,
      fileName: file.name,
      progress: 1, // Start at 1% to show activity
      status: 'uploading',
      stage: 'preparing',
      type,
      task: videoUploadTask
    };

    setUploads(prev => [...prev, newUpload]);

    try {
      // Create initial Firestore document with processing status - don't let it block the upload start
      const videoRef_fs = doc(db, 'videos', videoId);
      setDoc(videoRef_fs, {
        userId: user.uid,
        userName: user.name,
        userProfileImage: user.profileImage,
        type,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        viewsCount: 0,
        boosted: false,
        boostExpiry: null,
        status: 'processing',
        createdAt: Date.now()
      }).catch(err => console.error("Initial Firestore doc creation failed:", err));

      const thumbRef = ref(storage, `thumbnails/${user.uid}/${videoId}_thumb.jpg`);
      const thumbUploadPromise = uploadBytes(thumbRef, thumbnailBlob);

      // Watchdog to prevent "stuck at 1%" visual
      let lastProgress = 1;
      let lastUpdate = Date.now();
      const watchdog = setInterval(() => {
        setUploads(prev => {
          const job = prev.find(u => u.id === id);
          if (!job || job.status !== 'uploading' || job.progress >= 100) {
            clearInterval(watchdog);
            return prev;
          }

          // If progress hasn't moved for 2 seconds, start slow simulation
          if (Date.now() - lastUpdate > 2000 && job.progress < 99.5) {
            const simulatedProgress = Math.min(job.progress + 0.5, 99.5);
            return prev.map(u => u.id === id ? { ...u, progress: simulatedProgress } : u);
          }
          return prev;
        });
      }, 1000);

      videoUploadTask.on('state_changed', 
        (snapshot) => {
          const rawProgress = snapshot.totalBytes > 0 
            ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 
            : 0;
          
          const progress = Math.max(rawProgress, 1);
          
          if (progress > lastProgress) {
            lastProgress = progress;
            lastUpdate = Date.now();
          }

          setUploads(prev => prev.map(u => u.id === id ? { ...u, progress, stage: 'transmitting' } : u));
        }, 
        (error) => {
          clearInterval(watchdog);
          console.error("Upload failed details:", error);
          let userMessage = "Upload failed: " + (error.message || "Unknown error");
          if (error.code === 'storage/unauthorized') userMessage = "Permission denied. Please check Firebase rules.";
          if (error.code === 'storage/canceled') userMessage = "Upload canceled.";
          
          setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error', error: userMessage } : u));
        }, 
        async () => {
          clearInterval(watchdog);
          try {
            // Set to 100 immediately on completion
            setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: 100, stage: 'processing' } : u));
            
            // Don't let thumbnail block video completion
            await thumbUploadPromise.catch(e => console.warn("Thumb upload failed", e));
            
            const [videoUrl, thumbnailUrl] = await Promise.all([
              getDownloadURL(videoUploadTask.snapshot.ref),
              getDownloadURL(thumbRef).catch(() => "https://picsum.photos/seed/fallback/300/533")
            ]);
            
            setUploads(prev => {
              const job = prev.find(u => u.id === id);
              const updated: UploadJob[] = prev.map(u => u.id === id ? { ...u, videoUrl, thumbnailUrl, progress: 100, stage: 'processing' as const } : u);
              
              if (job?.isFinalized && job.metadata) {
                // If user already clicked publish, save to firestore now
                saveToFirestore(id, user, { ...job, videoUrl, thumbnailUrl, stage: 'processing' as const }, job.metadata);
              }
              
              return updated;
            });
          } catch (error: any) {
            console.error("Post-upload processing failed:", error);
            setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error', error: "Finalizing failed: " + error.message } : u));
          }
        }
      );
    } catch (error: any) {
      setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error', error: error.message } : u));
    }

    return videoId;
  }, []);

  const finalizeUpload = useCallback(async (id: string, user: User, metadata: { 
    caption: string; 
    hashtags: string; 
    duration?: number; 
    audioTrack?: AudioTrack; 
    customBoostPrice?: number;
    trimStart?: number;
    trimEnd?: number;
    filter?: string;
    textOverlays?: TextOverlay[];
    moderation?: {
      isSafe: boolean;
      safetyReason?: string;
      analyzedAt: number;
      caption?: string;
      hashtags?: string[];
      seoTitle?: string;
    };
  }) => {
    const currentJob = await new Promise<UploadJob | undefined>(resolve => {
      setUploads(prev => {
        const job = prev.find(u => u.id === id);
        resolve(job);
        return prev;
      });
    });

    if (!currentJob) throw new Error("Upload job not found");

    // Update job with metadata and mark as finalized
    setUploads(prev => prev.map(u => u.id === id ? { ...u, metadata, isFinalized: true } : u));

    // If URLs are already present, save immediately
    if (currentJob.videoUrl && currentJob.thumbnailUrl) {
      await saveToFirestore(id, user, currentJob, metadata);
    }
    // If not, the onComplete handler in startUpload will take care of it
  }, [saveToFirestore]);

  const updateThumbnail = useCallback(async (id: string, thumbnailBlob: Blob, userId: string) => {
    try {
      const thumbRef = ref(storage, `thumbnails/${userId}/${id}_thumb.jpg`);
      await uploadBytes(thumbRef, thumbnailBlob);
      const thumbnailUrl = await getDownloadURL(thumbRef);
      setUploads(prev => prev.map(u => u.id === id ? { ...u, thumbnailUrl } : u));
    } catch (error) {
      console.error("Update thumbnail failed:", error);
      throw error;
    }
  }, []);

  const removeUpload = useCallback(async (id: string) => {
    const upload = uploads.find(u => u.id === id);
    if (upload) {
      if (upload.status === 'uploading' && upload.task) {
        upload.task.cancel();
      }
      
      // Also clean up the Firestore document if it was created
      try {
        await deleteDoc(doc(db, 'videos', id));
      } catch (e) {
        console.warn("Failed to cleanup Firestore doc on cancel", e);
      }
    }
    setUploads(prev => prev.filter(u => u.id !== id));
  }, [uploads]);

  return (
    <UploadContext.Provider value={{ uploads, startUpload, finalizeUpload, updateThumbnail, removeUpload }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};
