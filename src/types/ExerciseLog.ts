// types/ExerciseLog.ts
import { RepsAndWeightLog } from './RepsAndWeightLog';
import { Exercise } from './Exercise';

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
  order?: number;
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
    this.order = data.order;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  static fromFirebase(data: any): ExerciseLog {
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
      order: data.order,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }
}
