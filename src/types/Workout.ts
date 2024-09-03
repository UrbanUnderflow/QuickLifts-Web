// types.ts
import { Exercise } from './Exercise';
import { ExerciseLog } from './ExerciseLog';
import { BodyPart } from './BodyPart';
import { BodyZone } from './BodyZone';

// Enums
  export enum WorkoutRating {
    TooHard = "Too Hard",
    TooEasy = "Too Easy",
    JustRight = "Just Right"
  }
  
  // Interfaces
  export interface ExerciseReference {
    exercise: Exercise;
    groupId: number;
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
  