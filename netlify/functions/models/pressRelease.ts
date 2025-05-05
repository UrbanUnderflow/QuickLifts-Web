// Model for Press Releases in Firestore

export interface PressRelease {
  id: string;
  title: string;
  summary: string;
  content: string;
  generatedAt: number; // timestamp
  publishedAt?: number; // timestamp, optional if not yet published
  status: PressReleaseStatus;
  kpiSnapshotId?: string; // Reference to KPI snapshot used
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