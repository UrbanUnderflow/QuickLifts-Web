import { ProfileImage } from './ProfileImage';
export type ExerciseVideoVisibility = 'open' | 'private' | 'followers';

export interface ExerciseVideo {
  id: string;
  exerciseId: string;
  username: string;
  userId: string;
  videoURL: string;
  fileName: string;
  exercise: string;
  profileImage: ProfileImage;
  caption?: string;
  gifURL?: string;
  thumbnail?: string;
  visibility: ExerciseVideoVisibility;
  totalAccountsReached: number;
  totalAccountLikes: number;
  totalAccountBookmarked: number;
  totalAccountUsage: number;
  comments: Comment[];
  isApproved: boolean;
  liked?: boolean;
  bookmarked?: boolean;
  createdAt: Date;
  updatedAt: Date;
}