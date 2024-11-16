// types/ExerciseVideo.ts
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
 isApproved: boolean;
 liked?: boolean;
 bookmarked?: boolean;
 createdAt: Date;
 updatedAt: Date;
}

export function fromFirebase(data: any): ExerciseVideo {
 return {
   id: data.id || '',
   exerciseId: data.exerciseId || '',
   username: data.username || '',
   userId: data.userId || '',
   videoURL: data.videoURL || '',
   fileName: data.fileName || '',
   exercise: data.exercise || '',
   profileImage: ProfileImage.fromFirebase(data.profileImage || {}),
   caption: data.caption,
   gifURL: data.gifURL,
   thumbnail: data.thumbnail,
   visibility: (data.visibility as ExerciseVideoVisibility) || 'private',
   totalAccountsReached: data.totalAccountsReached || 0,
   totalAccountLikes: data.totalAccountLikes || 0,
   totalAccountBookmarked: data.totalAccountBookmarked || 0,
   totalAccountUsage: data.totalAccountUsage || 0,
   isApproved: data.isApproved || false,
   liked: data.liked || false,
   bookmarked: data.bookmarked || false,
   createdAt: data.createdAt?.toDate() || new Date(),
   updatedAt: data.updatedAt?.toDate() || new Date()
 };
}

export class ExerciseVideo {
 static fromFirebase(data: any): ExerciseVideo {
   return fromFirebase(data);
 }
}