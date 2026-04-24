export interface User {
  uid: string;
  name: string;
  mobile: string;
  profileImage: string;
  followersCount: number;
  followingCount: number;
  totalLikes: number;
  totalViews: number;
  role: 'user' | 'admin' | 'banned';
  monetizationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  monetizationDate?: number;
  videosCount: number;
  referralCode?: string;
  referredBy?: string;
  totalWatchTime: number; // in seconds
  earnings: {
    likes: number;
    comments: number;
    watchTime: number;
    referrals: number;
    posts: number;
  };
  policyViolations: number;
  walletBalance: number;
  superChatBalance: number;
  bankAccountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
  bankName?: string;
  payoutType?: 'domestic' | 'international';
  swiftCode?: string;
  iban?: string;
  paypalEmail?: string;
  country?: string;
  isPrivate?: boolean;
  bio?: string;
  website?: string;
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
  lastActive?: number;
  createdAt: number;
  isProfileSetupComplete?: boolean;
}

export interface SuperChat {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  amount: number;
  message: string;
  createdAt: number;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontFamily?: string;
}

export interface Video {
  id: string;
  userId: string;
  userName: string;
  userProfileImage: string;
  type: 'video' | 'photo';
  videoUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  hashtags?: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  skipsCount?: number;
  reportsCount?: number;
  boosted: boolean;
  boostExpiry: number | null;
  customBoostPrice?: number;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  filter?: string;
  textOverlays?: TextOverlay[];
  totalWatchTime?: number;
  audioTrack?: AudioTrack;
  status?: 'processing' | 'ready' | 'failed';
  adaptiveStreaming?: boolean;
  resolutions?: {
    [key: string]: string;
  };
  moderation?: {
    isSafe: boolean;
    safetyReason?: string;
    analyzedAt: number;
    caption?: string;
    hashtags?: string[];
    seoTitle?: string;
  };
  transcodedAt?: number;
  createdAt: number;
}

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnailUrl: string;
  duration: number;
  language?: string;
  genre?: string;
  isTrending?: boolean;
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userProfileImage: string;
  text: string;
  createdAt: number;
}

export interface BoostPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
}

export const BOOST_PLANS: BoostPlan[] = [
  { id: '1_day', name: '24 Hours Boost', price: 49, durationDays: 1 },
  { id: '3_days', name: '3 Days Boost', price: 99, durationDays: 3 },
  { id: '7_days', name: '7 Days Boost', price: 199, durationDays: 7 },
];

export interface BoostTransaction {
  id: string;
  userId: string;
  videoId: string;
  videoCaption: string;
  planId: string;
  planName: string;
  amount: number;
  platformFee?: number;
  creatorShare?: number;
  status: 'success' | 'failed' | 'pending';
  createdAt: number;
  expiryAt: number;
}

export interface AdminTask {
  id: string;
  title: string;
  description: string;
  category: 'moderation' | 'support' | 'other';
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignedToId: string;
  assignedToName: string;
  createdById: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
}

export interface Notification {
  id: string;
  userId: string; // The user who receives the notification
  senderId: string; // The user who triggered the notification
  senderName: string;
  senderProfileImage: string;
  type: 'like' | 'comment' | 'follow' | 'monetization' | 'tip' | 'boost' | 'share' | 'system';
  videoId?: string;
  videoThumbnail?: string;
  message: string;
  read: boolean;
  createdAt: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'earning' | 'withdrawal' | 'purchase' | 'transfer';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  source: 'super_chat' | 'boost_share' | 'wallet_topup' | 'admin_transfer';
  createdAt: number;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  payoutType: 'domestic' | 'international';
  bankDetails: {
    accountNumber: string;
    accountHolderName: string;
    bankName: string;
    ifscCode?: string;
    swiftCode?: string;
    iban?: string;
    country?: string;
    paypalEmail?: string;
  };
  rejectionReason?: string;
  createdAt: number;
  processedAt?: number;
}
