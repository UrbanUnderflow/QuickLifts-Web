import { RepsAndWeightLog } from "../workout/types";
import { ProfileImage } from '../user/types';
import { DocumentSnapshot } from 'firebase/firestore';
import { convertFirestoreTimestamp } from '../../../utils/formatDate';

export interface ExerciseService {
  fetchExercises: () => Promise<void>;
  fetchPaginatedExercises: (
      lastDoc: DocumentSnapshot | null,
      pageSize?: number
  ) => Promise<{ exercises: Exercise[]; lastVisible: DocumentSnapshot | null }>;
  fetchFeaturedExercisesWithVideos: (limit?: number) => Promise<Exercise[]>;
  allExercises: Exercise[];
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

export enum BodyPart {
    Biceps = 'biceps',
    Triceps = 'triceps',
    Chest = 'chest',
    Calves = 'calves',
    Abs = 'abs',
    Hamstrings = 'hamstrings',
    Back = 'back',
    Glutes = 'glutes',
    Quadriceps = 'quadriceps',
    Forearms = 'forearms',
    Shoulders = 'shoulders',
    Lowerback = 'lowerback',
    // advanced
    Lats = 'lats',
    Traps = 'traps',
    Rhomboids = 'rhomboids',
    Deltoids = 'deltoids',
    Fullbody = 'fullbody'
}
  
// Function to check if a body part is advanced
export function isAdvancedBodyPart(bodyPart: BodyPart): boolean {
  return [BodyPart.Traps, BodyPart.Lats, BodyPart.Rhomboids, BodyPart.Deltoids].includes(bodyPart);
}

type ExerciseVisibility = 'limited' | 'secret' | 'live';


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
  completedAt: Date;
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
    this.completedAt = convertFirestoreTimestamp(data.completedAt);
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
  }

  static fromFirebase(data: any): ExerciseLog {
    if (!data) {
      // Return a default ExerciseLog instead of null
      return new ExerciseLog({});
    }
    
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
      completedAt: data.completedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  toDictionary(): { [key: string]: any } {
    const data: { [key: string]: any } = {
      id: this.id,
      workoutId: this.workoutId,
      userId: this.userId,
      exercise: this.exercise.toDictionary(),
      logs: this.logs.map(log => log.toDictionary()),
      feedback: this.feedback,
      note: this.note,
      isSplit: this.isSplit,
      isBodyWeight: this.isBodyWeight,
      logSubmitted: this.logSubmitted,
      logIsEditing: this.logIsEditing,
      isCompleted: this.isCompleted,
      createdAt: this.createdAt.getTime(),
      updatedAt: this.updatedAt.getTime(),
      completedAt: this.completedAt.getTime()
    };

    if (this.recommendedWeight !== undefined) {
      data.recommendedWeight = this.recommendedWeight;
    }

    if (this.order !== undefined) {
      data.order = this.order;
    }

    return data;
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
    this.primaryBodyParts = (data.primaryBodyParts || []) as BodyPart[];
    this.secondaryBodyParts = (data.secondaryBodyParts || []) as BodyPart[];
    this.tags = data.tags || [];
    this.videos = (data.videos || []).map((video: any) => ExerciseVideo.fromFirebase(video));
    this.steps = data.steps || [];
    this.visibility = data.visibility || 'live';
    this.currentVideoPosition = data.currentVideoPosition || 0;
    this.sets = data.sets || 0;
    this.reps = data.reps || '';
    this.weight = data.weight || 0;
    this.author = ExerciseAuthor.fromFirebase(data.author || {});
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);

    // Handle category parsing
    const categoryData = data.category || {};
    const categoryId = categoryData.id;

    switch (categoryId) {
      case 'weight-training':
        this.category = ExerciseCategory.weightTraining({
          reps: categoryData.reps || '12',
          sets: categoryData.sets || 3,
          weight: categoryData.weight || 0,
          screenTime: categoryData.screenTime || 0,
          selectedVideo: categoryData.selectedVideo 
            ? ExerciseVideo.fromFirebase(categoryData.selectedVideo)
            : undefined
        });
        break;

      case 'cardio':
        this.category = ExerciseCategory.cardio({
          duration: categoryData.duration || 0,
          bpm: categoryData.bpm || 0,
          calories: categoryData.calories || 0,
          screenTime: categoryData.screenTime || 0,
          selectedVideo: categoryData.selectedVideo 
            ? ExerciseVideo.fromFirebase(categoryData.selectedVideo)
            : undefined
        });
        break;

      default:
        this.category = ExerciseCategory.weightTraining({
          reps: '12',
          sets: 3,
          weight: 0,
          screenTime: 0
        });
    }
  }

  static fromFirebase(data: any): Exercise {
    if (!data) {
      return new Exercise({});
    }

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

  toDictionary(): { [key: string]: any } {
    const data: { [key: string]: any } = {
      id: this.id,
      name: this.name,
      description: this.description,
      category: {
        id: this.category.type,
        ...this.category.details,
        selectedVideo: this.category.details?.selectedVideo?.toDictionary()
      },
      primaryBodyParts: this.primaryBodyParts,
      secondaryBodyParts: this.secondaryBodyParts,
      tags: this.tags,
      videos: this.videos.map(video => video.toDictionary()),
      steps: this.steps,
      visibility: this.visibility,
      currentVideoPosition: this.currentVideoPosition,
      sets: this.sets,
      reps: this.reps,
      weight: this.weight,
      author: this.author.toDictionary(),
      createdAt: this.createdAt.getTime(),
      updatedAt: this.updatedAt.getTime()
    };

    return data;
  }
}

// types/ExerciseVideo.ts
export type ExerciseVideoVisibility = 'open' | 'private' | 'followers';

// ExerciseVideo.ts
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
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
  }

  static fromFirebase(data: any): ExerciseVideo {
    if (!data) {
      return new ExerciseVideo({});
    }

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

  toDictionary(): { [key: string]: any } {
    const data: { [key: string]: any } = {
      id: this.id,
      exerciseId: this.exerciseId,
      username: this.username,
      userId: this.userId,
      videoURL: this.videoURL,
      fileName: this.fileName,
      exercise: this.exercise,
      profileImage: this.profileImage.toDictionary(),
      visibility: this.visibility,
      totalAccountsReached: this.totalAccountsReached,
      totalAccountLikes: this.totalAccountLikes,
      totalAccountBookmarked: this.totalAccountBookmarked,
      totalAccountUsage: this.totalAccountUsage,
      isApproved: this.isApproved,
      createdAt: this.createdAt.getTime(),
      updatedAt: this.updatedAt.getTime()
    };

    if (this.caption) data.caption = this.caption;
    if (this.gifURL) data.gifURL = this.gifURL;
    if (this.thumbnail) data.thumbnail = this.thumbnail;
    if (this.liked !== undefined) data.liked = this.liked;
    if (this.bookmarked !== undefined) data.bookmarked = this.bookmarked;

    return data;
  }
}

// ExerciseAuthor.ts
export class ExerciseAuthor {
  userId: string;
  username: string;

  constructor(data: any) {
    this.userId = data.userId || '';
    this.username = data.username || '';
  }

  static fromFirebase(data: any): ExerciseAuthor {
    if (!data) {
      return new ExerciseAuthor({});
    }

    return new ExerciseAuthor({
      userId: data.userId || '',
      username: data.username || ''
    });
  }

  toDictionary(): { [key: string]: any } {
    return {
      userId: this.userId,
      username: this.username
    };
  }
}