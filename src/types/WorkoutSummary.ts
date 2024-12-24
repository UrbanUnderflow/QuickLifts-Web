// types/WorkoutSummary.ts
import { ExerciseLog } from './ExerciseLog';
import { BodyPart } from './BodyPart';
import { WorkoutRating } from '../api/firebase/workout/types';

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