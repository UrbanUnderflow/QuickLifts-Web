// types/User.ts
import { BodyWeight } from './BodyWeight';
import { ProfileImage } from './ProfileImage';

export class User {
  id: string;
  displayName: string;
  username: string;
  bio?: string;
  profileImage: ProfileImage;
  followerCount: number;
  followingCount: number;
  bodyWeight: BodyWeight[];
  workoutCount: number;
  creator?: {
    type?: string[];
    instagramHandle?: string;
    twitterHandle?: string;
    youtubeUrl?: string;
    acceptCodeOfConduct?: boolean;
    acceptExecutiveTerms?: boolean;
    acceptGeneralTerms?: boolean;
    acceptSweatEquityPartnership?: boolean;
    onboardingStatus?: string;
    onboardingLink?: string;
    onboardingExpirationDate?: number;
  };
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.displayName = data.displayName || '';
    this.username = data.username || '';
    this.bio = data.bio || '';
    this.profileImage = ProfileImage.fromFirebase(data.profileImage || {});
    this.followerCount = data.followerCount || 0;
    this.followingCount = data.followingCount || 0;
    this.bodyWeight = Array.isArray(data.bodyWeight)
      ? data.bodyWeight.map((weight: any) => User.fromFirebase(weight))
      : [];
    this.workoutCount = data.workoutCount || 0;
    this.creator = {
      type: data.creator?.type || [],
      instagramHandle: data.creator?.instagramHandle || '',
      twitterHandle: data.creator?.twitterHandle || '',
      youtubeUrl: data.creator?.youtubeUrl || '',
      acceptCodeOfConduct: data.creator?.acceptCodeOfConduct || false,
      acceptExecutiveTerms: data.creator?.acceptExecutiveTerms || false,
      acceptGeneralTerms: data.creator?.acceptGeneralTerms || false,
      acceptSweatEquityPartnership: data.creator?.acceptSweatEquityPartnership || false,
      onboardingStatus: data.creator?.onboardingStatus || '',
      onboardingLink: data.creator?.onboardingLink || '',
      onboardingExpirationDate: data.creator?.onboardingExpirationDate || 0
    };
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  static fromFirebase(data: any): User {
    return new User({
      id: data.id || '',
      displayName: data.displayName || '',
      username: data.username || '',
      bio: data.bio || '',
      profileImage: data.profileImage || {},
      followerCount: data.followerCount || 0,
      followingCount: data.followingCount || 0,
      bodyWeight: data.bodyWeight || [],
      workoutCount: data.workoutCount || 0,
      creator: data.creator || {},
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  toFirestore(): Record<string, any> {
    return {
      id: this.id,
      displayName: this.displayName,
      username: this.username,
      bio: this.bio,
      profileImage: this.profileImage,
      followerCount: this.followerCount,
      followingCount: this.followingCount,
      bodyWeight: this.bodyWeight,
      workoutCount: this.workoutCount,
      creator: this.creator,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}