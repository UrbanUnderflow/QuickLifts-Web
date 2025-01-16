// types/Challenge.ts
export interface Challenge {
  id: string;
  title: string;
  subtitle: string;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'published' | 'archived';
  durationInDays: number;
  participants: string[];
}
  
export interface UserChallenge {
    id: string;
    challenge: Challenge;
    challengeId: string;
    userId: string;
    progress: number;
    completedWorkouts: string[];
    isCompleted: boolean;
    createdAt: Date;
    updatedAt: Date;
  }