import { db } from './firebase';
import { doc, collection, addDoc, serverTimestamp, increment, updateDoc, setDoc } from 'firebase/firestore';

export type InteractionType = 'view' | 'like' | 'share' | 'comment' | 'watch_time' | 'complete_watch' | 'skip' | 'report';

export async function trackInteraction(userId: string, videoId: string, creatorId: string, type: InteractionType, value: number = 1) {
  try {
    // 1. Log the individual interaction for historical analysis
    const interactionRef = collection(db, 'user_interactions');
    await addDoc(interactionRef, {
      userId,
      videoId,
      creatorId,
      type,
      value,
      createdAt: Date.now()
    });

    // 2. Update video's negative counts if applicable
    if (type === 'skip' || type === 'report') {
      const videoRef = doc(db, 'videos', videoId);
      await updateDoc(videoRef, {
        [type === 'skip' ? 'skipsCount' : 'reportsCount']: increment(1)
      });
    }

    // 3. Update user's interest profile
    const interestRef = doc(db, 'user_interests', `${userId}_${creatorId}`);
    await setDoc(interestRef, {
      userId,
      creatorId,
      score: increment(
        type === 'like' ? 5 : 
        type === 'share' ? 10 : 
        type === 'comment' ? 8 : 
        type === 'complete_watch' ? 15 : 
        type === 'skip' ? -10 : 
        type === 'report' ? -50 : 1
      ),
      lastInteraction: Date.now()
    }, { merge: true });

  } catch (error) {
    console.error("Error tracking interaction:", error);
  }
}
