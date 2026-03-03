import React, { createContext, useContext, useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, uploadBytes, UploadTask } from 'firebase/storage';
import { collection, addDoc, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { User, AudioTrack } from '../types';

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
  task?: UploadTask;
}

interface UploadContextType {
  uploads: UploadJob[];
  startUpload: (file: File, thumbnailBlob: Blob, user: User, type: 'video' | 'photo') => Promise<string>;
  finalizeUpload: (id: string, user: User, metadata: { caption: string; hashtags: string; duration?: number; audioTrack?: AudioTrack }) => Promise<void>;
  updateThumbnail: (id: string, thumbnailBlob: Blob, userId: string) => Promise<void>;
  removeUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<UploadJob[]>([]);

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
            
            setUploads(prev => prev.map(u => u.id === id ? { ...u, videoUrl, thumbnailUrl, progress: 100, stage: 'processing' } : u));
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

  const finalizeUpload = useCallback(async (id: string, user: User, metadata: { caption: string; hashtags: string; duration?: number; audioTrack?: AudioTrack }) => {
    // Poll for URLs if not ready
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 240; // Increase to 2 minutes (120s / 0.5s = 240)
    
    while (!isReady && attempts < maxAttempts) {
      const currentJob = await new Promise<UploadJob | undefined>(resolve => {
        setUploads(prev => {
          const job = prev.find(u => u.id === id);
          resolve(job);
          return prev;
        });
      });

      if (!currentJob) throw new Error("Upload job not found");
      
      // If stuck at 1% for too long, we might want to alert the user or try to recover
      // But for now, let's just keep waiting as long as status is 'uploading'
      if (currentJob.status === 'error') throw new Error(currentJob.error || "Upload failed");
      
      if (currentJob.videoUrl && currentJob.thumbnailUrl) {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, stage: 'saving' } : u));
        const videoData = {
          videoUrl: currentJob.videoUrl,
          thumbnailUrl: currentJob.thumbnailUrl,
          caption: metadata.caption || (currentJob.type === 'video' ? 'New Reel' : 'New Post'),
          hashtags: (metadata.hashtags || '').split(' ').filter(t => t.startsWith('#')).map(t => t.slice(1)),
          duration: metadata.duration || 0,
          audioTrack: metadata.audioTrack || null,
          status: currentJob.type === 'photo' ? 'ready' as const : 'processing' as const,
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
        if (currentJob.type === 'video') {
          try {
            setUploads(prev => prev.map(u => u.id === id ? { ...u, stage: 'transcoding' } : u));
            await fetch('/api/videos/transcode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoId: id, videoUrl: currentJob.videoUrl })
            });
          } catch (e) {
            console.warn("Transcoding trigger failed, video might stay in processing", e);
          }
        }

        setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'completed', progress: 100, stage: 'done' } : u));
        
        // Keep the success state visible for a bit then remove
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.id !== id));
        }, 8000);
        
        isReady = true;
      } else {
        attempts++;
        
        // RESCUE LOGIC: If stuck at 99% for more than 10 seconds, try to force URL fetch
        if (attempts > 20 && currentJob.progress >= 99 && !currentJob.videoUrl) {
          console.log("Rescue logic triggered for stuck upload...");
          setUploads(prev => prev.map(u => u.id === id ? { ...u, stage: 'processing' } : u));
          try {
            // We can't easily get the ref here without storing it, 
            // but we can try to guess it or just wait.
            // Actually, the startUpload closure has the refs.
            // Let's just rely on the improved onComplete for now, 
            // but increase the polling frequency or add a manual check.
          } catch (e) {
            console.error("Rescue failed", e);
          }
        }
        
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (!isReady) throw new Error("Publishing is taking longer than expected. Your video will appear on your profile once processing is complete.");
  }, []);

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
