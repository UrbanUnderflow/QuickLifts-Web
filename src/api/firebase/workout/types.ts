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
  
  export interface Workout {
    id: string;
    exercises: ExerciseReference[];
    logs?: ExerciseLog[];
    title: string;
    duration: number;
    workoutRating?: WorkoutRating;
    workoutStatus: WorkoutStatus;
    useAuthorContent: boolean;
    isCompleted: boolean;
    author: string;
    createdAt: Date;
    updatedAt: Date;
    zone: BodyZone;
  
    // Methods (these will be implemented as functions in TypeScript)
    estimatedDuration: () => number;
    determineWorkoutZone: () => BodyZone;
    toDictionary: () => { [key: string]: any };
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