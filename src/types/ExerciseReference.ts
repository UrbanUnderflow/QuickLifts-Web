// types/Workout.ts
import { Exercise } from '../api/firebase/exercise/types';

export interface ExerciseReference {
  exercise: Exercise;
  groupId: number;
}
