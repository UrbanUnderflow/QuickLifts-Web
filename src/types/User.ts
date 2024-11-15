import { BodyWeight } from './BodyWeight';

export interface User {
    id: string;
    displayName: string;
    username: string;
    bio?: string;
    profileImage?: {
      profileImageURL?: string;
    };
    followerCount: number;
    followingCount: number;
    bodyWeight: BodyWeight[];
    workoutCount: number;
    creator?: {
      type?: string[];
      instagramHandle?: string;
      twitterHandle?: string;
      youtubeUrl?: string;
    };
  }