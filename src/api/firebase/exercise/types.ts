import { BodyPart } from "../../../types/BodyPart";
import { RepsAndWeightLog } from "../workout/types";
import { ProfileImage } from '../user/types';


export interface ExerciseService {
    fetchExercises: () => Promise<void>;
}

export interface ExerciseComment {
  id: string;
  username: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

// Interfaces
export interface ExerciseReference {
    exercise: Exercise;
    groupId: number;
}

export type ExerciseVisibility = 'open' | 'private' | 'followers';


export interface ExerciseReference {
  exercise: Exercise;
  groupId: number;
}


export class ExerciseLog {
  id: string;
  workoutId: string;
  userId: string;
  exercise: Exercise;
  logs: RepsAndWeightLog[];
  feedback: string;
  note: string;
  recommendedWeight?: string;
  isSplit: boolean;
  isBodyWeight: boolean;
  logSubmitted: boolean;
  logIsEditing: boolean;
  isCompleted: boolean;
  order?: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.workoutId = data.workoutId || '';
    this.userId = data.userId || '';
    this.exercise = Exercise.fromFirebase(data.exercise || {});
    this.logs = (data.logs || []).map((log: any) => RepsAndWeightLog.fromFirebase(log));
    this.feedback = data.feedback || '';
    this.note = data.note || '';
    this.recommendedWeight = data.recommendedWeight;
    this.isSplit = data.isSplit || false;
    this.isBodyWeight = data.isBodyWeight || false;
    this.logSubmitted = data.logSubmitted || false;
    this.logIsEditing = data.logIsEditing || false;
    this.isCompleted = data.isCompleted || false;
    this.order = data.order;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  static fromFirebase(data: any): ExerciseLog {
    return new ExerciseLog({
      id: data.id || '',
      workoutId: data.workoutId || '',
      userId: data.userId || '',
      exercise: data.exercise || {},
      logs: data.logs || [],
      feedback: data.feedback || '',
      note: data.note || '',
      recommendedWeight: data.recommendedWeight,
      isSplit: data.isSplit || false,
      isBodyWeight: data.isBodyWeight || false,
      logSubmitted: data.logSubmitted || false,
      logIsEditing: data.logIsEditing || false,
      isCompleted: data.isCompleted || false,
      order: data.order,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }
}

export interface WeightTrainingExercise {
  reps: string;
  sets: number;
  weight: number;
  screenTime: number;
  selectedVideo?: ExerciseVideo;
}

export interface CardioExercise {
  duration: number;
  bpm: number;
  calories: number;
  screenTime: number;
  selectedVideo?: ExerciseVideo;
}

export type ExerciseCategory = 
  | { type: 'weightTraining', details?: WeightTrainingExercise }
  | { type: 'cardio', details?: CardioExercise };

// Helper functions to mimic Swift enum behavior
export const ExerciseCategory = {
  weightTraining: (details?: WeightTrainingExercise): ExerciseCategory => ({
    type: 'weightTraining',
    details
  }),
  cardio: (details?: CardioExercise): ExerciseCategory => ({
    type: 'cardio',
    details
  }),

  fromIdentifier: (identifier: string): ExerciseCategory | null => {
    switch (identifier) {
      case 'weight-training':
        return ExerciseCategory.weightTraining({
          reps: '12',
          sets: 3,
          weight: 0.0, 
          screenTime: 0,
          selectedVideo: undefined
        });
      case 'cardio':
        return ExerciseCategory.cardio({
          duration: 20,
          bpm: 125,
          calories: 0,
          screenTime: 0,
          selectedVideo: undefined
        });
      default:
        return null;
    }
  },

  identifier: (category: ExerciseCategory): string => {
    switch (category.type) {
      case 'weightTraining':
        return 'weight-training';
      case 'cardio':
        return 'cardio';
    }
  }
};

// Usage examples:
// const weightTraining = ExerciseCategory.weightTraining({ reps: '10', sets: 3, weight: 50 });
// const cardio = ExerciseCategory.cardio({ duration: 30, bpm: 140, calories: 300 });
// const fromId = ExerciseCategory.fromIdentifier('weight-training');
// const id = ExerciseCategory.identifier(weightTraining);

export class Exercise {
  id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  primaryBodyParts: BodyPart[];
  secondaryBodyParts: BodyPart[];
  tags: string[];
  videos: ExerciseVideo[];
  steps: string[];
  visibility: ExerciseVisibility;
  currentVideoPosition: number;
  sets: number;
  reps: string;
  weight: number;
  author: ExerciseAuthor;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.description = data.description || '';
    this.category = data.category as ExerciseCategory;
    this.primaryBodyParts = (data.primaryBodyParts || []) as BodyPart[];
    this.secondaryBodyParts = (data.secondaryBodyParts || []) as BodyPart[];
    this.tags = data.tags || [];
    this.videos = (data.videos || []).map((video: any) => ExerciseVideo.fromFirebase(video));
    this.steps = data.steps || [];
    this.visibility = data.visibility || [];
    this.currentVideoPosition = data.currentVideoPosition || 0;
    this.sets = data.sets || 0;
    this.reps = data.reps || '';
    this.weight = data.weight || 0;
    this.author = ExerciseAuthor.fromFirebase(data.author || {});
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  static fromFirebase(data: any): Exercise {
    return new Exercise({
      id: data.id || '',
      name: data.name || '',
      description: data.description || '',
      category: data.category || {},
      primaryBodyParts: data.primaryBodyParts || [],
      secondaryBodyParts: data.secondaryBodyParts || [],
      tags: data.tags || [],
      videos: data.videos || [],
      steps: data.steps || [],
      visibility: data.visibility || [],
      currentVideoPosition: data.currentVideoPosition || 0,
      sets: data.sets || 0,
      reps: data.reps || '',
      weight: data.weight || 0,
      author: data.author || {},
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }
}


// types/ExerciseVideo.ts
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

// types/ExerciseAuthor.ts
export interface ExerciseAuthor {
  userId: string;
  username: string;
 }
 
 export function fromFirebase(data: any): ExerciseAuthor {
  return {
    userId: data.userId || '',
    username: data.username || ''
  };
 }
 
 export class ExerciseAuthor {
  static fromFirebase(data: any): ExerciseAuthor {
    return fromFirebase(data);
  }
 }