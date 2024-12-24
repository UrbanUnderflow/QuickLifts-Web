import { ExerciseLog } from '../../../types/ExerciseLog';
import { BodyZone } from '../../../types/BodyZone';
import { ExerciseReference } from '../exercise/types';


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
  
  
  
  export interface Workout {
    id: string;
    exercises: ExerciseReference[];
    logs?: ExerciseLog[];
    title: string;
    duration: number;
    workoutRating?: WorkoutRating;
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