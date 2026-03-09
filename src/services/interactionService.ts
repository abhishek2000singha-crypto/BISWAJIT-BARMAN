import { db } from './firebase';
import { doc, collection, addDoc, serverTimestamp, increment, updateDoc, setDoc } from 'firebase/firestore';

export type InteractionType = 'view' | 'like' | 'share' | 'comment' | 'watch_time' | 'complete_watch';

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

    // 2. Update user's interest profile (aggregate by creator and potentially hashtags if we had them easily)
    // We'll store a score for each creator the user interacts with
    const interestRef = doc(db, 'user_interests', `${userId}_${creatorId}`);
    await setDoc(interestRef, {
      userId,
      creatorId,
      score: increment(type === 'like' ? 5 : type === 'share' ? 10 : type === 'comment' ? 8 : type === 'complete_watch' ? 15 : 1),
      lastInteraction: Date.now()
    }, { merge: true });

  } catch (error) {
    console.error("Error tracking interaction:", error);
  }
}
