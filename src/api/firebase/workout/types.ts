import { BodyZone } from '../../../types/BodyZone';
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
    this.zone = this.determineWorkoutZone();
  }

  estimatedDuration(): number {
    // Implement your logic to estimate duration
    return this.duration;
  }

// Then update the determineWorkoutZone function
determineWorkoutZone(): BodyZone {
    // Create a Set of all primary body parts involved in this workout
    const bodyPartsInvolved = new Set<BodyPart>();
    
    for (const exerciseRef of this.exercises) {
        // Assuming exerciseRef.primaryBodyParts is an array of BodyPart
        // If it's a single value, remove the inner loop
        for (const bodyPart of exerciseRef.exercise.primaryBodyParts || [exerciseRef.exercise.primaryBodyParts]) {
            bodyPartsInvolved.add(bodyPart as BodyPart);
        }
    }

    // Define body part groups
    const upperBodyParts = new Set([
        BodyPart.Chest,
        BodyPart.Shoulders,
        BodyPart.Biceps,
        BodyPart.Triceps,
        BodyPart.Traps,
        BodyPart.Lats,
        BodyPart.Forearms
    ]);

    const lowerBodyParts = new Set([
        BodyPart.Hamstrings,
        BodyPart.Glutes,
        BodyPart.Quadriceps,
        BodyPart.Calves
    ]);

    const coreParts = new Set([
        BodyPart.Abs,
        BodyPart.Lowerback
    ]);

    // Helper function to check if sets have common elements
    const hasCommonElements = (set1: Set<BodyPart>, set2: Set<BodyPart>): boolean => {
        return Array.from(set1).some(item => set2.has(item));
    };

    // Check which body zones are involved
    const hasUpperBody = hasCommonElements(bodyPartsInvolved, upperBodyParts);
    const hasLowerBody = hasCommonElements(bodyPartsInvolved, lowerBodyParts);
    const hasCore = hasCommonElements(bodyPartsInvolved, coreParts);

    // Determine the workout zone
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