import { SweatlistCollection } from '../api/firebase/workout/types';

export interface UserTogetherRoundCollection {
  id: string;
  collection: SweatlistCollection;
  userId: string;
  isCompleted: boolean;
  progress: number;
  pulsePoints?: {
    totalPoints: number;
  };
} 