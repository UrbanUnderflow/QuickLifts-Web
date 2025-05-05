// Model for KPI Snapshots in Firestore

export interface KpiSnapshot {
  id: string;
  capturedAt: number; // timestamp when the snapshot was taken
  
  // User metrics
  totalUsers: number;
  activeUsers: number; // active in the last 30 days
  workoutCount: number; // total workouts completed
  challengeParticipants: number; // users in active challenges
  
  // Creator metrics
  totalCreators: number;
  payingCreators: number;
  
  // Business metrics
  ARR?: number; // Annual Recurring Revenue (optional, may be sensitive)
  
  // Notable events
  notableEvents: string[]; // e.g., "Launched Morning Mobility Challenge with 1000+ participants"
  
  // Growth metrics (optional)
  weeklyGrowth?: {
    users?: number; // percentage
    workouts?: number; // percentage
    creators?: number; // percentage
  };
} 