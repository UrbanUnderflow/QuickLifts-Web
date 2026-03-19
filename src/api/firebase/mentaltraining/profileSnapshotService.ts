import {
  collection,
  doc,
  getDoc,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config';
import type { AssessmentContextFlag } from './correlationEngineTypes';
import {
  ATHLETE_MENTAL_PROGRESS_COLLECTION,
  PROFILE_SNAPSHOTS_SUBCOLLECTION,
  RESEARCH_EXPORT_JOBS_COLLECTION,
} from './collections';
const profileSnapshotRuntime = require('./profileSnapshotRuntime');

export type ProfileSnapshotMilestoneType =
  | 'onboarding'
  | 'baseline'
  | 'midpoint'
  | 'endpoint'
  | 'retention'
  | 'manual_staff_checkpoint';

export interface ProfileSnapshotNarrative {
  templateId: ProfileExplanationTemplateId;
  templateVersion: string;
  slots: Record<string, string>;
  renderedText: string;
}

export interface ProfileSnapshotPayload {
  pillarScores: Record<string, number | null>;
  skillSummaries: string[];
  modifierScores: Record<string, number | string | null>;
  trendSummary: string;
  currentEmphasis: string;
  nextMilestone: string;
  pressurePattern?: string;
  consistencyState?: string;
  stateContextAtCapture?: {
    assessmentContextFlag?: AssessmentContextFlag;
    [key: string]: unknown;
  };
}

export interface ProfileSnapshotSourceRefs {
  progressUpdatedAt?: number | null;
  trialCompletedAt?: number | null;
  sourceEventId?: string | null;
}

export interface ProfileSnapshotWriteInput {
  athleteId: string;
  milestoneType: ProfileSnapshotMilestoneType;
  pilotEnrollmentId?: string | null;
  manualCheckpointId?: string | null;
  capturedAt?: number;
  profileVersion: string;
  writerVersion: string;
  writeReason: 'initial_capture' | 'retry' | 'correction' | 'backfill';
  profilePayload: ProfileSnapshotPayload;
  noraExplanation: ProfileSnapshotNarrative;
  sourceRefs?: ProfileSnapshotSourceRefs;
}

export interface CanonicalProfileSnapshot {
  snapshotKey: string;
  athleteId: string;
  milestoneType: ProfileSnapshotMilestoneType;
  pilotEnrollmentId: string | null;
  canonicalScopeKey: string;
  canonical: true;
  status: 'canonical';
  revision: number;
  idempotencyKey: string;
  payloadFingerprint: string;
  profileVersion: string;
  writerVersion: string;
  writeReason: ProfileSnapshotWriteInput['writeReason'];
  capturedAt: number;
  updatedAt: number;
  supersededAt: null;
  profilePayload: ProfileSnapshotPayload;
  noraExplanation: ProfileSnapshotNarrative & { validated: true };
  sourceRefs: ProfileSnapshotSourceRefs;
}

export interface ProfileSnapshotRevision extends Omit<CanonicalProfileSnapshot, 'supersededAt'> {
  supersededAt: number;
  supersededByRevision: number;
  archivedAt: number;
}

export interface ProfileSnapshotWriteResult {
  mode: 'created' | 'updated' | 'noop';
  snapshot: CanonicalProfileSnapshot;
}

export interface ProfileSnapshotExportJobInput {
  requestedBy: string;
  milestones?: ProfileSnapshotMilestoneType[];
  canonicalOnly?: boolean;
  athleteIds?: string[];
  pilotEnrollmentIds?: string[];
  dataset?: 'profile_snapshot_export_v1' | 'profile_snapshot_audit_v1';
}

export interface ProfileSnapshotExportJob {
  id: string;
  dataset: 'profile_snapshot_export_v1' | 'profile_snapshot_audit_v1';
  canonicalOnly: boolean;
  milestones: ProfileSnapshotMilestoneType[];
  athleteIds: string[];
  pilotEnrollmentIds: string[];
  requestedBy: string;
  status: 'queued';
  createdAt: number;
  outputUri: string | null;
}

export type ProfileExplanationTemplateId =
  | 'emphasis_growth_v1'
  | 'emphasis_milestone_v1'
  | 'emphasis_dual_v1';

export function buildProfileSnapshotKey(input: Pick<ProfileSnapshotWriteInput, 'milestoneType' | 'pilotEnrollmentId' | 'manualCheckpointId'>): string {
  return profileSnapshotRuntime.buildProfileSnapshotKey(input);
}

export function buildProfileSnapshotCanonicalScopeKey(
  input: Pick<ProfileSnapshotWriteInput, 'athleteId' | 'milestoneType' | 'pilotEnrollmentId' | 'manualCheckpointId'>
): string {
  return profileSnapshotRuntime.buildProfileSnapshotCanonicalScopeKey(input);
}

export function renderProfileExplanation(templateId: ProfileExplanationTemplateId, slots: Record<string, string>): string {
  return profileSnapshotRuntime.renderProfileExplanation(templateId, slots);
}

export function validateProfileExplanation(narrative: ProfileSnapshotNarrative): { valid: true } | { valid: false; reason: string } {
  return profileSnapshotRuntime.validateProfileExplanation(narrative);
}

function parseCanonicalSnapshot(data: Record<string, unknown>): CanonicalProfileSnapshot {
  return data as unknown as CanonicalProfileSnapshot;
}

export const profileSnapshotService = {
  buildSnapshotKey: buildProfileSnapshotKey,
  buildCanonicalScopeKey: buildProfileSnapshotCanonicalScopeKey,
  renderExplanation: renderProfileExplanation,
  validateExplanation: validateProfileExplanation,

  async getCanonical(
    athleteId: string,
    milestoneType: ProfileSnapshotMilestoneType,
    options?: { pilotEnrollmentId?: string | null; manualCheckpointId?: string | null }
  ): Promise<CanonicalProfileSnapshot | null> {
    const snapshotKey = buildProfileSnapshotKey({
      milestoneType,
      pilotEnrollmentId: options?.pilotEnrollmentId,
      manualCheckpointId: options?.manualCheckpointId,
    });

    const snapshotRef = doc(
      collection(doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, athleteId), PROFILE_SNAPSHOTS_SUBCOLLECTION),
      snapshotKey
    );
    const snapshotDoc = await getDoc(snapshotRef);

    if (!snapshotDoc.exists()) {
      return null;
    }

    return parseCanonicalSnapshot(snapshotDoc.data());
  },

  async writeCanonicalSnapshot(input: ProfileSnapshotWriteInput): Promise<ProfileSnapshotWriteResult> {
    const validation = validateProfileExplanation(input.noraExplanation);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const progressRef = doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, input.athleteId);
    const snapshotKey = buildProfileSnapshotKey(input);
    const snapshotRef = doc(collection(progressRef, PROFILE_SNAPSHOTS_SUBCOLLECTION), snapshotKey);
    const now = Date.now();
    const incomingFingerprint = profileSnapshotRuntime.buildSnapshotFingerprint(input, input.noraExplanation);

    return runTransaction(db, async (transaction) => {
      const progressSnap = await transaction.get(progressRef);
      const existingSnap = await transaction.get(snapshotRef);
      const existingData = existingSnap.exists() ? parseCanonicalSnapshot(existingSnap.data() as Record<string, unknown>) : null;
      const existingProgressData = progressSnap.exists() ? progressSnap.data() as Record<string, unknown> : null;
      const existingSnapshotIds =
        existingProgressData?.currentCanonicalSnapshotIds &&
        typeof existingProgressData.currentCanonicalSnapshotIds === 'object' &&
        !Array.isArray(existingProgressData.currentCanonicalSnapshotIds)
          ? existingProgressData.currentCanonicalSnapshotIds as Record<string, string>
          : {};

      if (existingData && existingData.payloadFingerprint === incomingFingerprint) {
        return { mode: 'noop' as const, snapshot: existingData };
      }

      const nextRevision = (existingData?.revision ?? 0) + 1;
      const nextSnapshot = profileSnapshotRuntime.buildCanonicalSnapshot(input, now, nextRevision);

      if (existingData) {
        const revisionRef = doc(collection(snapshotRef, 'revisions'), `r${String(existingData.revision).padStart(4, '0')}`);
        transaction.set(revisionRef, {
          ...existingData,
          supersededAt: now,
          supersededByRevision: nextRevision,
          archivedAt: now,
        } as ProfileSnapshotRevision);
      }

      transaction.set(snapshotRef, nextSnapshot);
      transaction.set(
        progressRef,
        {
          lastProfileSnapshotAt: now,
          lastCanonicalSnapshotKey: snapshotKey,
          lastCanonicalSnapshotMilestone: input.milestoneType,
          profileVersion: input.profileVersion,
          currentCanonicalSnapshotIds: {
            ...existingSnapshotIds,
            [snapshotKey]: snapshotKey,
          },
        },
        { merge: true }
      );

      return {
        mode: existingData ? ('updated' as const) : ('created' as const),
        snapshot: nextSnapshot,
      };
    });
  },

  buildExportJob(input: ProfileSnapshotExportJobInput): Omit<ProfileSnapshotExportJob, 'id'> {
    const dataset = input.dataset ?? 'profile_snapshot_export_v1';
    const canonicalOnly = input.canonicalOnly ?? dataset !== 'profile_snapshot_audit_v1';

    return {
      dataset,
      canonicalOnly,
      milestones: input.milestones ?? ['baseline', 'midpoint', 'endpoint', 'retention'],
      athleteIds: input.athleteIds ?? [],
      pilotEnrollmentIds: input.pilotEnrollmentIds ?? [],
      requestedBy: input.requestedBy,
      status: 'queued',
      createdAt: Date.now(),
      outputUri: null,
    };
  },

  async queueExportJob(input: ProfileSnapshotExportJobInput): Promise<ProfileSnapshotExportJob> {
    const job = this.buildExportJob(input);
    const jobRef = doc(collection(db, RESEARCH_EXPORT_JOBS_COLLECTION));
    const fullJob: ProfileSnapshotExportJob = {
      id: jobRef.id,
      ...job,
    };

    await setDoc(jobRef, fullJob);
    return fullJob;
  },
};
