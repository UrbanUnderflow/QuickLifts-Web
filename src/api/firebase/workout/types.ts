import { BodyZone } from '../../../types/BodyZone';
import { ExerciseReference, ExerciseLog } from '../exercise/types';


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

// import { Workout } from './Workout';
// import { BodyZone } from './BodyZone';
import { Challenge } from '../../../types/Challenge';

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
  // zone: BodyZone;

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
    // this.zone = this.determineWorkoutZone();
  }

  estimatedDuration(): number {
    // Implement your logic to estimate duration
    return this.duration;
  }

  // determineWorkoutZone(): BodyZone {
  //   // Implement your logic to determine the workout zone
  //   if (this.exercises.some(ex => ex.primaryBodyPart === 'Core')) {
  //     return BodyZone.Core;
  //   }
  //   return BodyZone.FullBody;
  // }

  toDictionary(): { [key: string]: any } {
    return {
      id: this.id,
      collectionId: this.collectionId,
      roundWorkoutId: this.roundWorkoutId,
      exercises: this.exercises,
      challenge: this.challenge,
      logs: this.logs,
      title: this.title,
      description: this.description,
      duration: this.duration,
      workoutRating: this.workoutRating,
      useAuthorContent: this.useAuthorContent,
      isCompleted: this.isCompleted,
      workoutStatus: this.workoutStatus,
      startTime: this.startTime,
      order: this.order,
      author: this.author,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // zone: this.zone,
    };
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