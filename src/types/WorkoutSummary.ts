// types/WorkoutSummary.ts

import { ExerciseLog } from './ExerciseLog';
import { BodyPart } from './BodyPart';
import { WorkoutRating } from './Workout';

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
    completedAt?: Date;
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
      this.createdAt = data.createdAt?.toDate();
      this.updatedAt = data.updatedAt?.toDate();
      this.completedAt = data.completedAt?.toDate();
      this.duration = data.duration;
    }
  
    static fromFirestore(data: any): WorkoutSummary {
      return new WorkoutSummary(data);
    }
  }
  