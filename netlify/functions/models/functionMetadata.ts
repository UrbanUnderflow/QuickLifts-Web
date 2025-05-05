// Model for Function Execution Metadata in Firestore

export interface FunctionMetadata {
  id: string; // Typically the function name, e.g., "draftPress"
  lastRunAt: number; // Timestamp of last execution
  lastRunStatus: 'success' | 'error' | 'in_progress';
  lastRunError?: string; // Error message if status is 'error'
  lastResultId?: string; // ID of the last result (e.g., press release ID)
  runCount: number; // Total number of times the function has been run
  
  // Optional scheduling information
  nextScheduledRun?: number; // Timestamp of next scheduled run
  schedule?: string; // Human-readable schedule (e.g., "Weekly on Mondays")
} 