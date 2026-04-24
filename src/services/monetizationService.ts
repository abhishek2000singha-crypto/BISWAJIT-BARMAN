import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

export const MONETIZATION_LIMITS = {
  FOLLOWERS: 300,
  VIEWS: 10000,
  VIDEOS: 50
};

export const EARNING_RATES = {
  LIKES_PER_100: 20,
  COMMENTS_PER_100: 25,
  WATCH_TIME_PER_HOUR: 60,
  PHOTO_POST: 5,
  VIDEO_POST: 10,
  FOLLOW: 2
};

export const checkMonetizationEligibility = (user: User): boolean => {
  return (
    user.followersCount >= MONETIZATION_LIMITS.FOLLOWERS ||
    user.totalViews >= MONETIZATION_LIMITS.VIEWS ||
    user.videosCount >= MONETIZATION_LIMITS.VIDEOS
  );
};

export const applyForMonetization = async (userId: string) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    monetizationStatus: 'pending'
  });
};

export const rewardForAction = async (userId: string, action: 'like' | 'comment' | 'watch' | 'post_photo' | 'post_video' | 'follow', amount: number = 1) => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;
  const userData = userSnap.data() as User;
  
  if (userData.monetizationStatus !== 'approved') return;

  let earningIncrement = 0;
  let field = '';

  switch (action) {
    case 'like':
      earningIncrement = (amount / 100) * EARNING_RATES.LIKES_PER_100;
      field = 'earnings.likes';
      break;
    case 'comment':
      earningIncrement = (amount / 100) * EARNING_RATES.COMMENTS_PER_100;
      field = 'earnings.comments';
      break;
    case 'watch':
      // amount is in seconds
      earningIncrement = (amount / 3600) * EARNING_RATES.WATCH_TIME_PER_HOUR;
      field = 'earnings.watchTime';
      break;
    case 'post_photo':
      earningIncrement = EARNING_RATES.PHOTO_POST;
      field = 'earnings.posts';
      break;
    case 'post_video':
      earningIncrement = EARNING_RATES.VIDEO_POST;
      field = 'earnings.posts';
      break;
    case 'follow':
      earningIncrement = EARNING_RATES.FOLLOW;
      field = 'earnings.follows';
      break;
  }

  if (earningIncrement > 0) {
    await updateDoc(userRef, {
      [field]: increment(earningIncrement),
      walletBalance: increment(earningIncrement)
    });
  }
};
