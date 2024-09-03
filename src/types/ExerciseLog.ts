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