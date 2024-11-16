import { RepsAndWeightLog } from './RepsAndWeightLog';
import { Exercise } from './Exercise';

export interface ExerciseLog {
    id: string;
    workoutId: string;
    userId: string;
    exercise: Exercise;
    logs: RepsAndWeightLog[];
    feedback: string;
    note: string;
    recommendedWeight?: string;
    isSplit?: boolean;
    isBodyWeight?: boolean;
    logSubmitted: boolean;
    logIsEditing: boolean;
    order?: number;
    createdAt: Date;
    updatedAt: Date;
  }


export function fromFirebase(data: any): ExerciseLog {
  return {
    id: data.id || '',
    workoutId: data.workoutId || '',
    userId: data.userId || '',
    exercise: Exercise.fromFirebase(data.exercise || {}),
    logs: (data.logs || []).map((log: any) => RepsAndWeightLog.fromFirebase(log)),
    feedback: data.feedback || '',
    note: data.note || '',
    recommendedWeight: data.recommendedWeight,
    isSplit: data.isSplit || false,
    isBodyWeight: data.isBodyWeight || false,
    logSubmitted: data.logSubmitted || false,
    logIsEditing: data.logIsEditing || false,
    order: data.order,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date()
  };
}

export class ExerciseLog {
  static fromFirebase(data: any): ExerciseLog {
    return fromFirebase(data);
  }
}