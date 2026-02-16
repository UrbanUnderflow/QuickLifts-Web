export type ProgressBeat = 'hypothesis' | 'work-in-flight' | 'result' | 'block' | 'signal-spike';
export type ArtifactType = 'none' | 'text' | 'url';
export type ConfidenceColor = 'blue' | 'green' | 'yellow' | 'red';
export type TimelineStateTag = 'signals' | 'meanings';

export interface ProgressTimelineEntry {
  id?: string;
  agentId: string;
  agentName: string;
  emoji?: string;
  objectiveCode: string;
  beat: ProgressBeat;
  headline: string;
  artifactType?: ArtifactType;
  artifactText?: string;
  artifactUrl?: string;
  lensTag?: string;
  confidenceColor: ConfidenceColor;
  stateTag?: TimelineStateTag;
  createdAt?: Date;
}

export interface HourlySnapshotEntry {
  id?: string;
  hourIso: string; // e.g., 2026-02-16T13:00:00Z
  agentId: string;
  agentName: string;
  objectiveCode: string;
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
