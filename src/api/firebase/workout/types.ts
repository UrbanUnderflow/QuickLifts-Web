import { ExerciseReference, ExerciseLog } from '../exercise/types';
import { BodyPart } from '../exercise/types';

// src/types/WorkoutTypes.ts
export enum WorkoutStatus {
  QueuedUp = 'queuedUp',
  InProgress = 'inProgress',
  Complete = 'complete',
  Archived = 'archived'
}

// src/types/WorkoutTypes.ts
export enum WorkoutRating {
  TooHard = 'Too Hard',
  TooEasy = 'Too Easy',
  JustRight = 'Just Right'
}


export enum BodyZone {
  LowerBody = "Lower Body",
  UpperBody = "Upper Body",
  FullBody = "Full Body",
  Core = "Core"

}
  
// types/RepsAndWeightLog.ts
export interface RepsAndWeightLog {
  reps: number;
  weight: number;
  leftReps: number;
  leftWeight: number;
  isSplit: boolean;
  isBodyWeight: boolean;
  duration: number;
  calories: number;
  bpm: number;
 }
 
 export function fromFirebase(data: any): RepsAndWeightLog {
  return {
    reps: data.reps || 0,
    weight: data.weight || 0,
    leftReps: data.leftReps || 0,
    leftWeight: data.leftWeight || 0,
    isSplit: data.isSplit || false,
    isBodyWeight: data.isBodyWeight || false,
    duration: data.duration || 0,
    calories: data.calories || 0,
    bpm: data.bpm || 0
  };
 }
 
 export class RepsAndWeightLog {
  static fromFirebase(data: any): RepsAndWeightLog {
    return fromFirebase(data);
  }
 }
  
// WorkoutClass.ts

import {  
  Challenge
 } from '../../../types/ChallengeTypes';

 export class Workout {
  id: string;
  collectionId?: string[];
  roundWorkoutId: string;
  exercises: ExerciseReference[];
  challenge?: Challenge;
  logs?: ExerciseLog[];
  title: string;
  description: string;
  duration: number;
  workoutRating?: WorkoutRating;
  useAuthorContent: boolean;
  isCompleted: boolean;
  workoutStatus: WorkoutStatus;
  startTime?: Date;
  order?: number;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  zone: BodyZone;

  constructor(data: Workout) {
    this.id = data.id;
    this.collectionId = data.collectionId;
    this.roundWorkoutId = data.roundWorkoutId;
    this.exercises = data.exercises;
    this.challenge = data.challenge;
    this.logs = data.logs;
    this.title = data.title;
    this.description = data.description;
    this.duration = data.duration;
    this.workoutRating = data.workoutRating;
    this.useAuthorContent = data.useAuthorContent;
    this.isCompleted = data.isCompleted;
    this.workoutStatus = data.workoutStatus;
    this.startTime = data.startTime;
    this.order = data.order;
    this.author = data.author;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.zone = Workout.determineWorkoutZone(data.exercises);
  }

  static estimatedDuration(exercises: ExerciseReference[]): number {
    const averageExerciseTime = 8; // Average time per exercise in minutes
    const averageRestTime = 1; // Average rest time between exercises in minutes
    const warmupTime = 5; // Warm-up time in minutes
    const cooldownTime = 5; // Cool-down time in minutes
  
    // Calculate total exercise time based on number of exercises
    const totalExerciseTime = exercises.length * averageExerciseTime;
  
    // Calculate rest time between exercises (no rest after last exercise)
    const totalRestTime = Math.max(0, exercises.length - 1) * averageRestTime;
  
    // Total estimated workout time
    const estimatedTotalTime = warmupTime + totalExerciseTime + totalRestTime + cooldownTime;
  
    // Round to the nearest multiple of 5 for a cleaner presentation
    const roundedTime = Math.round(estimatedTotalTime / 5) * 5;
  
    return Math.max(roundedTime, 10); // Ensure minimum workout time is 10 minutes
  }

  static determineWorkoutZone(exercises: ExerciseReference[]): BodyZone {
    const bodyPartsInvolved = new Set<BodyPart>();

    for (const exerciseRef of exercises) {
      for (const bodyPart of exerciseRef.exercise.primaryBodyParts || [exerciseRef.exercise.primaryBodyParts]) {
        bodyPartsInvolved.add(bodyPart as BodyPart);
      }
    }

    const upperBodyParts = new Set([
      BodyPart.Chest,
      BodyPart.Shoulders,
      BodyPart.Biceps,
      BodyPart.Triceps,
      BodyPart.Traps,
      BodyPart.Lats,
      BodyPart.Forearms,
    ]);

    const lowerBodyParts = new Set([
      BodyPart.Hamstrings,
      BodyPart.Glutes,
      BodyPart.Quadriceps,
      BodyPart.Calves,
    ]);

    const coreParts = new Set([BodyPart.Abs, BodyPart.Lowerback]);

    const hasCommonElements = (set1: Set<BodyPart>, set2: Set<BodyPart>): boolean => {
      return Array.from(set1).some((item) => set2.has(item));
    };

    const hasUpperBody = hasCommonElements(bodyPartsInvolved, upperBodyParts);
    const hasLowerBody = hasCommonElements(bodyPartsInvolved, lowerBodyParts);
    const hasCore = hasCommonElements(bodyPartsInvolved, coreParts);

    if ((hasUpperBody && hasLowerBody && hasCore) || (hasUpperBody && hasLowerBody)) {
      return BodyZone.FullBody;
    } else if (hasUpperBody && hasCore || hasUpperBody) {
      return BodyZone.UpperBody;
    } else if (hasLowerBody && hasCore || hasLowerBody) {
      return BodyZone.LowerBody;
    } else if (hasCore) {
      return BodyZone.Core;
    } else {
      return BodyZone.FullBody; // Default case
    }
  }

  static toDictionary(workout: Workout): { [key: string]: any } {
    return {
      id: workout.id,
      collectionId: workout.collectionId,
      roundWorkoutId: workout.roundWorkoutId,
      exercises: workout.exercises,
      challenge: workout.challenge,
      logs: workout.logs,
      title: workout.title,
      description: workout.description,
      duration: workout.duration,
      workoutRating: workout.workoutRating,
      useAuthorContent: workout.useAuthorContent,
      isCompleted: workout.isCompleted,
      workoutStatus: workout.workoutStatus,
      startTime: workout.startTime,
      order: workout.order,
      author: workout.author,
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
      zone: workout.zone,
    };
  }
}

export class WorkoutSummary {
    id: string;
    workoutId: string;
    exercises: ExerciseLog[];
    bodyParts: BodyPart[];
    secondaryBodyParts: BodyPart[];
    workoutTitle: string;
    caloriesBurned: number;
    workoutRating?: WorkoutRating;
    exercisesCompleted: ExerciseLog[];
    aiInsight: string;
    recommendations: string[];
    gifURLs?: string[];
    recommendedWork?: number;
    isCompleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date | null;
    duration: string;
  
    constructor(data: any) {
      this.id = data.id;
      this.workoutId = data.workoutId;
      this.exercises = data.exercises.map((ex: any) => ExerciseLog.fromFirebase(ex));
      this.bodyParts = data.bodyParts;
      this.secondaryBodyParts = data.secondaryBodyParts;
      this.workoutTitle = data.workoutTitle;
      this.caloriesBurned = data.caloriesBurned;
      this.workoutRating = data.workoutRating;
      this.exercisesCompleted = data.exercisesCompleted.map((ex: any) => ExerciseLog.fromFirebase(ex));
      this.aiInsight = data.aiInsight;
      this.recommendations = data.recommendations;
      this.gifURLs = data.gifURLs;
      this.recommendedWork = data.recommendedWork;
      this.isCompleted = data.isCompleted;
      this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
      this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
      this.completedAt = data.completedAt ? new Date(data.completedAt) : null;
      this.duration = data.duration;
    }
  
    static fromFirebase(data: any): WorkoutSummary {
      return new WorkoutSummary({
        id: data.id || '',
        workoutId: data.workoutId || '',
        exercises: data.exercises || [],
        bodyParts: data.bodyParts || [],
        secondaryBodyParts: data.secondaryBodyParts || [],
        workoutTitle: data.workoutTitle || '',
        caloriesBurned: data.caloriesBurned || 0,
        workoutRating: data.workoutRating,
        exercisesCompleted: data.exercisesCompleted || [],
        aiInsight: data.aiInsight || '',
        recommendations: data.recommendations || [],
        gifURLs: data.gifURLs || [],
        recommendedWork: data.recommendedWork,
        isCompleted: data.isCompleted || false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        completedAt: data.completedAt,
        duration: data.duration || ''
      });
    }
}

export interface WorkoutService {
  fetchCurrentWorkout: () => Promise<Workout | null>;
  generateWorkout: (bodyParts: BodyZone[]) => Promise<Workout>;
  startWorkout: (workoutId: string) => Promise<void>;
  cancelWorkout: (workoutId: string) => Promise<void>;
  completeWorkout: (workoutId: string, rating?: WorkoutRating) => Promise<void>;
  fetchCurrentWorkoutSession: () => Promise<{
    workout: Workout | null;
    logs: ExerciseLog[] | null;
  }>;
  swapWorkout: (oldWorkoutId: string, newBodyParts: BodyZone[]) => Promise<Workout>;
  updateWorkoutStatus: (workoutId: string, status: WorkoutStatus) => Promise<void>;
  logExercise: (workoutId: string, exerciseLog: ExerciseLog) => Promise<void>;
  getWorkoutLogs: (workoutId: string) => Promise<ExerciseLog[]>;
  cancelCurrentWorkout: () => Promise<void>;
  getCurrentWorkoutStatus: () => Promise<WorkoutStatus>;
  saveWorkout: (workout: Workout) => Promise<void>;
}