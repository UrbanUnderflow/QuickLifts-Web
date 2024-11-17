// types/ExerciseVideo.ts
import { ProfileImage } from './ProfileImage';
export type ExerciseVideoVisibility = 'open' | 'private' | 'followers';

export class ExerciseVideo {
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
  isApproved: boolean;
  liked?: boolean;
  bookmarked?: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.exerciseId = data.exerciseId || '';
    this.username = data.username || '';
    this.userId = data.userId || '';
    this.videoURL = data.videoURL || '';
    this.fileName = data.fileName || '';
    this.exercise = data.exercise || '';
    this.profileImage = ProfileImage.fromFirebase(data.profileImage || {});
    this.caption = data.caption;
    this.gifURL = data.gifURL;
    this.thumbnail = data.thumbnail;
    this.visibility = data.visibility as ExerciseVideoVisibility || 'private';
    this.totalAccountsReached = data.totalAccountsReached || 0;
    this.totalAccountLikes = data.totalAccountLikes || 0;
    this.totalAccountBookmarked = data.totalAccountBookmarked || 0;
    this.totalAccountUsage = data.totalAccountUsage || 0;
    this.isApproved = data.isApproved || false;
    this.liked = data.liked || false;
    this.bookmarked = data.bookmarked || false;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  static fromFirebase(data: any): ExerciseVideo {
    return new ExerciseVideo({
      id: data.id || '',
      exerciseId: data.exerciseId || '',
      username: data.username || '',
      userId: data.userId || '',
      videoURL: data.videoURL || '',
      fileName: data.fileName || '',
      exercise: data.exercise || '',
      profileImage: data.profileImage || {},
      caption: data.caption,
      gifURL: data.gifURL,
      thumbnail: data.thumbnail,
      visibility: data.visibility || 'private',
      totalAccountsReached: data.totalAccountsReached || 0,
      totalAccountLikes: data.totalAccountLikes || 0,
      totalAccountBookmarked: data.totalAccountBookmarked || 0,
      totalAccountUsage: data.totalAccountUsage || 0,
      isApproved: data.isApproved || false,
      liked: data.liked || false,
      bookmarked: data.bookmarked || false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }
}