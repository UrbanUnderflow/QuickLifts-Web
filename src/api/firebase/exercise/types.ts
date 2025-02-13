import { RepsAndWeightLog, WorkoutSummary, Workout } from "../workout/types";
import { ProfileImage, User } from '../user/types';
import { DocumentSnapshot } from 'firebase/firestore';
import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';
import { exerciseLogService } from '../exerciseLog/service';

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
  order?: number | null;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
      this.id = data.id || '';
      this.workoutId = data.workoutId || '';
      this.userId = data.userId || '';
      this.exercise = new Exercise(data.exercise);
      this.logs = (data.logs || []).map((log: any) => new RepsAndWeightLog(log));
      this.feedback = data.feedback || '';
      this.note = data.note || '';
      this.recommendedWeight = data.recommendedWeight || 'calculating...';
      this.isSplit = data.isSplit || false;
      this.isBodyWeight = data.isBodyWeight || false;
      this.logSubmitted = data.logSubmitted || false;
      this.logIsEditing = data.logIsEditing || false;
      this.isCompleted = data.isCompleted || false;
      this.order = data.order || null;
      this.completedAt = convertFirestoreTimestamp(data.completedAt);
      this.createdAt = convertFirestoreTimestamp(data.createdAt);
      this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
  }

  setIsSubmitted(isSubmitted: boolean): void {
      this.logSubmitted = isSubmitted;
  }

  fetchTotalWeightLifted(user: User): number {
      const bodyWeight = Math.max(user?.bodyWeight?.at(-1)?.newWeight || 150, 1);

      let totalWeightLifted = 0;

      for (const log of this.logs) {
          totalWeightLifted += ((log.weight + (log.isBodyWeight ? bodyWeight : 0)) * log.reps);
          
          if (log.isSplit) {
              totalWeightLifted += (log.leftWeight * log.leftReps);
          }
      }
      
      return totalWeightLifted;
  }

  calculateWorkScore(user: User, workoutId: string | null, workoutSummaries: WorkoutSummary[]): number {
      const bodyWeight = Math.max(user?.bodyWeight?.at(-1)?.newWeight || 150, 1);
      const intensityWeight = 0.4;
      const volumeWeight = 0.4;

      const allLogs = this.getLogsForExercise(workoutSummaries, this.exercise.name);
      const averageTotalWeight = allLogs.length === 0 ? 
          0 : allLogs.reduce((sum, log) => sum + log.weight, 0) / allLogs.length;

      let workScore = 0;

      for (const logItem of this.logs) {
          const totalWeight = logItem.weight + bodyWeight;
          const intensityFactor = totalWeight / bodyWeight;
          const volumeFactor = logItem.reps;

          const percentageOfAverage = totalWeight / Math.max(averageTotalWeight, 1) * 100;
          let progressiveScore = 0;

          if (percentageOfAverage >= 90) progressiveScore = 40;
          else if (percentageOfAverage >= 80) progressiveScore = 35;
          else if (percentageOfAverage >= 70) progressiveScore = 30;

          workScore += (intensityFactor * volumeFactor * intensityWeight) + (progressiveScore * volumeWeight);
      }

      return Math.round(workScore);
  }

  getLogsForExercise(workoutSummaries: WorkoutSummary[], exerciseName: string): RepsAndWeightLog[] {
      return workoutSummaries
          ?.flatMap(summary => summary.exercisesCompleted)
          .filter(log => log.exercise.name === exerciseName)
          .flatMap(log => log.logs) || [];
  }

  checkIfAnyPastLogsWereBodyWeight(workoutSummaries: WorkoutSummary[]): { 
      hasBodyWeightLogs: boolean, 
      averageWeight: number 
  } {
      const allLogItems = workoutSummaries
          .flatMap(summary => summary.exercisesCompleted)
          .filter(log => log.exercise.name === this.exercise.name)
          .flatMap(log => log.logs);

      const nonBodyWeightLogs = allLogItems.filter(log => !log.isBodyWeight);
      const hasBodyWeightLogs = allLogItems.some(log => log.isBodyWeight);

      if (nonBodyWeightLogs.length === 0) {
          return { hasBodyWeightLogs, averageWeight: 0 };
      }

      const totalWeight = nonBodyWeightLogs.reduce((sum, log) => sum + log.weight, 0);
      const averageWeight = totalWeight / nonBodyWeightLogs.length;

      return { hasBodyWeightLogs, averageWeight };
  }

  fetchHighestTWL(workoutSummaries: WorkoutSummary[], user: User): number | null {
      const exerciseWorkouts = workoutSummaries
          ?.filter(summary => 
              summary.exercisesCompleted.some(log => 
                  log.exercise.name === this.exercise.name
              )
          );

      if (!exerciseWorkouts?.length) return null;

      const twls = exerciseWorkouts.map(summary =>
          summary.exercisesCompleted.reduce((total, log) =>
              log.exercise.name === this.exercise.name
                  ? total + log.fetchTotalWeightLifted(user)
                  : total
          , 0)
      );

      return Math.max(...twls);
  }

  static fetchHighestWeightLiftedForExercise(exerciseName: string, workoutSummaries: WorkoutSummary[]): number | null {
      const exerciseWorkouts = workoutSummaries
          ?.filter(summary =>
              summary.exercisesCompleted.some(log =>
                  log.exercise.name === exerciseName
              )
          );

      if (!exerciseWorkouts?.length) return null;

      const weights = exerciseWorkouts.flatMap(summary =>
          summary.exercisesCompleted.flatMap(log => {
              if (log.exercise.name !== exerciseName) return [];
              return log.logs.map(logItem =>
                  logItem.isSplit
                      ? Math.max(logItem.weight, logItem.leftWeight)
                      : logItem.weight
              );
          })
      );

      return weights.length ? Math.max(...weights) : null;
  }

  fetchHighestWeightInSet(workoutSummaries: WorkoutSummary[]): { weight: number | null, reps: number | null } {
      const exerciseWorkouts = workoutSummaries
          ?.filter(summary =>
              summary.exercisesCompleted.some(log =>
                  log.exercise.name === this.exercise.name
              )
          );

      if (!exerciseWorkouts?.length) return { weight: null, reps: null };

      const weightAndReps = exerciseWorkouts.flatMap(summary =>
          summary.exercisesCompleted.flatMap(log =>
              log.exercise.name === this.exercise.name
                  ? log.logs.map(logItem => ({ weight: logItem.weight, reps: logItem.reps }))
                  : []
          )
      );

      if (!weightAndReps.length) return { weight: null, reps: null };

      const maxWeightEntry = weightAndReps.reduce((max, current) =>
          current.weight > max.weight ? current : max
      );

      return { weight: maxWeightEntry.weight, reps: maxWeightEntry.reps };
  }

  fetchTotalReps(): number {
      return this.logs.reduce((total, log) => total + log.reps, 0);
  }

  fetchTotalSessions(allLogs: ExerciseLog[]): number {
      return allLogs
          .filter(log => log.exercise.name === this.exercise.name)
          .length;
  }

  fetchTotalCompletedSets(): number {
      return this.logs.filter(log => log.reps > 0).length;
  }

  isLogComplete(): boolean {
      return this.logs.some(log => log.reps > 0);
  }

  updateLog(workout: Workout): void {
      exerciseLogService.updateExerciseLog(this, workout);
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
          createdAt: dateToUnixTimestamp(this.createdAt),
          updatedAt: dateToUnixTimestamp(this.updatedAt),
          completedAt: dateToUnixTimestamp(this.completedAt),
          recommendedWeight: this.recommendedWeight,
      };

      if (this.order != null) {
          data["order"] = this.order;
      }

      return data;
  }
}

export interface WeightTrainingExercise {
  reps: string[];
  sets: number;
  weight: number;
  screenTime: number;
  selectedVideo?: ExerciseVideo | null;
}

export interface CardioExercise {
  duration: number;
  bpm: number;
  calories: number;
  screenTime: number;
  selectedVideo?: ExerciseVideo | null;
}

export type ExerciseCategory = 
  | { type: 'weight-training', details?: WeightTrainingExercise }
  | { type: 'cardio', details?: CardioExercise };

// Helper functions to mimic Swift enum behavior
export const ExerciseCategory = {
  weightTraining: (details?: WeightTrainingExercise): ExerciseCategory => ({
    type: 'weight-training',
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
          reps: ['12'],
          sets: 3,
          weight: 0.0, 
          screenTime: 0,
          selectedVideo: null
        });
      case 'cardio':
        return ExerciseCategory.cardio({
          duration: 20,
          bpm: 125,
          calories: 0,
          screenTime: 0,
          selectedVideo: null
        });
      default:
        return null;
    }
  },

  identifier: (category: ExerciseCategory): string => {
    switch (category.type) {
      case 'weight-training':
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
    this.videos = (data.videos || []).map((video: any) => new ExerciseVideo(video));
    this.steps = data.steps || [];
    this.visibility = data.visibility || 'live';
    this.currentVideoPosition = data.currentVideoPosition || 0;
    this.sets = data.sets || 0;
    this.reps = data.reps || '';
    this.weight = data.weight || 0;
    this.author = new ExerciseAuthor(data.author || {});
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);

    // Preserve the exact category structure
    if (data.category) {
      this.category = data.category.type === 'weight-training' 
        ? {
            type: 'weight-training',
            details: {
              sets: data.category.details?.sets ?? 3,
              reps: Array.isArray(data.category.details?.reps) 
                ? data.category.details.reps 
                : [data.category.details?.reps || '12'],
              weight: data.category.details?.weight ?? 0,
              screenTime: data.category.details?.screenTime ?? 0,
              selectedVideo: data.category.details?.selectedVideo ?? null
            }
          }
        : {
            type: 'cardio',
            details: {
              duration: data.category.details?.duration ?? 60,
              bpm: data.category.details?.bpm ?? 140,
              calories: data.category.details?.calories ?? 0,
              screenTime: data.category.details?.screenTime ?? 0,
              selectedVideo: data.category.details?.selectedVideo ?? null
            }
          };
    } else {
      this.category = {
        type: 'weight-training',
        details: {
          sets: 3,
          reps: ['12'],
          weight: 0,
          screenTime: 0,
          selectedVideo: null
        }
      };
    }
  }

  toDictionary(): { [key: string]: any } {
    // Create the category object:
    const categoryData = {
      id: this.category.type,
      ...this.category.details,
      // Only include selectedVideo if it is defined.
      ...(this.category.details?.selectedVideo
        ? { selectedVideo: this.category.details.selectedVideo.toDictionary() }
        : {})
    };

    const data: { [key: string]: any } = {
      id: this.id,
      name: this.name,
      description: this.description,
      category: categoryData,
      primaryBodyParts: this.primaryBodyParts,
      secondaryBodyParts: this.secondaryBodyParts,
      tags: this.tags,
      videos: this.videos.map((video) => video.toDictionary()),
      steps: this.steps,
      visibility: this.visibility,
      currentVideoPosition: this.currentVideoPosition,
      sets: this.sets,
      reps: this.reps,
      weight: this.weight,
      author: this.author.toDictionary(),
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
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
    this.profileImage = new ProfileImage(data.profileImage || {});
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
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
    };

    if (this.caption) data.caption = this.caption;
    if (this.gifURL) data.gifURL = this.gifURL;
    if (this.thumbnail) data.thumbnail = this.thumbnail;
    if (this.liked !== null) data.liked = this.liked;
    if (this.bookmarked !== null) data.bookmarked = this.bookmarked;

    return data;
  }
}

export class ExerciseDetail {
  id: string;
  exerciseName: string;
  exercise: Exercise;
  exerciseLogId?: string;
  category: ExerciseCategory;
  notes: string;
  isSplit: boolean;
  isMissing: boolean;
  groupId: number;
  closestMatch: Exercise[];

  constructor(data: any) {
    this.id = data.id || '';
    this.exerciseName = data.exerciseName || '';
    this.exercise = data.exercise;
    this.exerciseLogId = data.exerciseLogId;
    this.category = data.category;
    this.notes = data.notes || '';
    this.isSplit = data.isSplit || false;
    this.isMissing = data.isMissing || false;
    this.groupId = data.groupId || 0;
    this.closestMatch = data.closestMatch || [];
  }

  toDictionary(): { [key: string]: any } {
    return {
      id: this.id,
      exerciseName: this.exerciseName,
      exercise: this.exercise.toDictionary(),
      exerciseLogId: this.exerciseLogId,
      category: {
        id: this.category.type,
        ...this.category.details,
        ...(this.category.details?.selectedVideo
          ? { selectedVideo: this.category.details.selectedVideo.toDictionary() }
          : {})
      },
      notes: this.notes,
      isSplit: this.isSplit,
      isMissing: this.isMissing,
      groupId: this.groupId,
      closestMatch: this.closestMatch.map(ex => ex.toDictionary())
    };
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

  toDictionary(): { [key: string]: any } {
    return {
      userId: this.userId,
      username: this.username
    };
  }
}