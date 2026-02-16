export type PredictionStatus = 'pending' | 'hit' | 'miss';

export interface PredictionScoreEntry {
  id?: string;
  agentId: string;
  agentName: string;
  objectiveCode: string;
  headline: string;
  confidencePercent: number;
  expectedTrigger: string;
  observedDelta?: string;
  feltSenseNote?: string;
  status: PredictionStatus;
  createdAt?: Date;
  resolvedAt?: Date;
}
