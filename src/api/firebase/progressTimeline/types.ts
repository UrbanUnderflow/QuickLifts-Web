export type ProgressBeat = 'hypothesis' | 'work-in-flight' | 'result' | 'block' | 'signal-spike';
export type ArtifactType = 'none' | 'text' | 'url';
export type ConfidenceColor = 'blue' | 'green' | 'yellow' | 'red';
export type TimelineStateTag = 'signals' | 'meanings';

export type ReviewStatus = 'none' | 'pending' | 'approved' | 'denied';

export interface ProgressTimelineEntry {
  id?: string;
  agentId: string;
  agentName: string;
  emoji?: string;
  objectiveCode: string;
  objectiveCodeLabel?: string;     // human-readable objective name
  beat: ProgressBeat;
  headline: string;
  artifactType?: ArtifactType;
  artifactText?: string;
  artifactUrl?: string;
  lensTag?: string;
  confidenceColor: ConfidenceColor;
  stateTag?: TimelineStateTag;
  // Review / toll-gate fields
  reviewStatus?: ReviewStatus;     // whether this beat needs human review
  reviewRequired?: boolean;        // flagged for human gate
  reviewedAt?: Date;               // when human acted
  reviewDeniedReason?: string;     // if denied, why
  movementImpact?: number;         // 1-10 score of how much this moves the needle
  isValidatedResult?: boolean;     // post-validation pass marker
  createdAt?: Date;
}

export interface HourlySnapshotEntry {
  id?: string;
  hourIso: string;
  agentId: string;
  agentName: string;
  objectiveCode: string;
  objectiveCodeLabel?: string;
  beatCompleted?: ProgressBeat;
  color: ConfidenceColor;
  stateTag: TimelineStateTag;
  note?: string;
  createdAt?: Date;
}

export type NudgeChannel = 'automation' | 'manual' | 'system';
export type NudgeOutcome = 'pending' | 'acknowledged' | 'resolved';

export interface NudgeLogEntry {
  id?: string;
  agentId: string;
  agentName: string;
  objectiveCode: string;
  color: ConfidenceColor;
  lane: TimelineStateTag;
  message: string;
  channel: NudgeChannel;
  outcome: NudgeOutcome;
  respondedAt?: Date;
  createdAt?: Date;
}
