import { Timestamp } from 'firebase-admin/firestore';

// Model for Press Releases in Firestore

// Interface for the KPI data structure expected in the metrics field
interface KpiData { // Define a simple interface for the data used here
    date: Timestamp; // Kept as Timestamp here as it's the source
    totalUsers: number;
    newUsersToday: number;
    totalWorkoutsCompleted: number;
    workoutsCompletedToday: number;
    averageWorkoutDuration: number;
}

export interface PressRelease {
  id: string;
  title: string;
  summary: string;
  content: string;
  generatedAt: number; // timestamp (milliseconds)
  publishedAt?: number; // timestamp (milliseconds), optional if not yet published
  snapshotDate?: number; // timestamp (milliseconds), optional reference to the KPI data's date
  status: PressReleaseStatus;
  kpiSnapshotId?: string; // Reference to KPI snapshot used
  metrics?: KpiData; // Add the metrics field
  githubPrUrl?: string; // URL to the GitHub PR
  mdxPath?: string; // Path to the MDX file in the repo
  imageUrl?: string; // Path to cover image if available
  tags: string[]; // e.g., "milestone", "feature", "update"
}

export type PressReleaseStatus = 'draft' | 'published' | 'error';

// Type for the response from the function
export interface PressReleaseGenerationResult {
  success: boolean;
  message: string;
  data?: {
    pressReleaseId?: string;
    title?: string;
    pullRequestUrl?: string;
    branchName?: string;
  };
  error?: string;
} 