import { auth } from '../config';
import { SIM_ASSIGNMENTS_COLLECTION, SIM_CURRICULUM_ASSIGNMENTS_COLLECTION } from './collections';
import type { ProfileSnapshotMilestone, TrialType } from './taxonomy';

export const VISION_PRO_SIM_ASSIGNMENTS_COLLECTION = SIM_ASSIGNMENTS_COLLECTION;
export const VISION_PRO_CURRICULUM_ASSIGNMENTS_COLLECTION = SIM_CURRICULUM_ASSIGNMENTS_COLLECTION;
export const VISION_PRO_LEGACY_ASSIGNMENTS_COLLECTION = VISION_PRO_SIM_ASSIGNMENTS_COLLECTION;

export type VisionProAssignmentCollection =
  | typeof VISION_PRO_SIM_ASSIGNMENTS_COLLECTION
  | typeof VISION_PRO_CURRICULUM_ASSIGNMENTS_COLLECTION;

export interface VisionProTrialSession {
  id: string;
  assignmentId: string;
  assignmentCollection: VisionProAssignmentCollection;
  athleteUserId: string;
  athleteDisplayName?: string | null;
  athleteEmail?: string | null;
  simId: string;
  simName: string;
  organizationId?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  pilotId?: string | null;
  pilotName?: string | null;
  cohortId?: string | null;
  cohortName?: string | null;
  status: 'queued' | 'claimed' | 'running' | 'completed' | 'abandoned' | 'expired' | 'failed';
  reservedDeviceId?: string | null;
  claimedDeviceId?: string | null;
  claimedDeviceName?: string | null;
  tokenExpiresAt?: number | null;
  claimedAt?: number | null;
  startedAt?: number | null;
  completedAt?: number | null;
  abandonedAt?: number | null;
  trialType?: TrialType | null;
  profileSnapshotMilestone?: Extract<ProfileSnapshotMilestone, 'midpoint' | 'endpoint' | 'retention'> | null;
  createdByUserId?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  resultSummary?: {
    normalizedScore?: number | null;
    coreMetricName?: string | null;
    coreMetricValue?: number | null;
    durationSeconds?: number | null;
    completedAt?: number | null;
    simSessionId?: string | null;
  } | null;
  versionMetadata?: {
    environmentVersion?: string | null;
    trialPackageVersion?: string | null;
    resetTrialVersion?: string | null;
    noiseGateTrialVersion?: string | null;
    signalWindowTrialVersion?: string | null;
    eventScriptVersion?: string | null;
    metricMappingVersion?: string | null;
    seedOrScriptId?: string | null;
  } | null;
  calibrationSummary?: {
    status?: 'pass' | 'pass_with_warning' | 'fail' | null;
    reasonCode?: string | null;
    warnings?: string[];
    checkedAt?: number | null;
    headsetTrackingStable?: boolean | null;
    responseTimingUsable?: boolean | null;
    audioRouteStable?: boolean | null;
    comfortCleared?: boolean | null;
  } | null;
  baselineReferences?: Array<{
    family?: string | null;
    surface?: string | null;
    referenceId?: string | null;
    simSessionId?: string | null;
    assignmentId?: string | null;
    capturedAt?: number | null;
    isRequired?: boolean | null;
    isImmersiveBaseline?: boolean | null;
    withinRecencyWindow?: boolean | null;
  }>;
  validitySummary?: {
    status?: string | null;
    flags?: string[];
    pauseCount?: number | null;
    abortClassification?: string | null;
    eventLogComplete?: boolean | null;
  } | null;
  eventLog?: {
    rawEventLogUri?: string | null;
    schemaVersion?: string | null;
    eventCount?: number | null;
    capturedAt?: number | null;
    requiredEventTypes?: string[];
  } | null;
  reportSummary?: {
    athleteHeadline?: string | null;
    athleteBody?: string | null;
    coachHeadline?: string | null;
    coachBody?: string | null;
    transferReadiness?: string | null;
    immersiveBaselineMode?: string | null;
    familyCards?: Array<{
      family?: string | null;
      label?: string | null;
      trialName?: string | null;
      metricName?: string | null;
      comparisonSurface?: string | null;
      currentValue?: number | null;
      baselineValue?: number | null;
      transferGap?: number | null;
      interpretation?: string | null;
    }>;
  } | null;
  protocolContext?: {
    baselineWindowDays?: number | null;
    requiredFamilies?: string[];
    enrollmentMode?: string | null;
    comfortScreenRequired?: boolean | null;
    activeEscalationTier?: number | null;
    activeEscalationRecordId?: string | null;
    queueValidatedAt?: number | null;
    startValidatedAt?: number | null;
  } | null;
  operatorReconciliation?: {
    status?: 'pending' | 'reviewed' | 'needs_follow_up' | null;
    reviewedAt?: number | null;
    reviewedByUserId?: string | null;
    reviewedByName?: string | null;
    note?: string | null;
    checklist?: {
      versionTrailVerified?: boolean | null;
      calibrationVerified?: boolean | null;
      baselineLinkageVerified?: boolean | null;
      validityVerified?: boolean | null;
      eventLogVerified?: boolean | null;
      incidentDispositionVerified?: boolean | null;
    } | null;
  } | null;
  abandonReason?: string | null;
  sessionOutcome?: string | null;
  isImmersiveBaseline?: boolean | null;
  immersiveBaselineReferenceId?: string | null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to manage Vision Pro trials.');
  }

  const idToken = await user.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

async function post<TResponse>(path: string, payload: Record<string, unknown>): Promise<TResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data as TResponse;
}

export const visionProTrialService = {
  async createSession(input: {
    assignmentId: string;
    assignmentCollection: VisionProAssignmentCollection;
    athleteUserId: string;
    simId?: string;
    simName?: string;
    reservedDeviceId?: string;
    reservedDeviceName?: string;
    createdByName?: string;
    trialType?: TrialType;
    profileSnapshotMilestone?: Extract<ProfileSnapshotMilestone, 'midpoint' | 'endpoint' | 'retention'>;
  }): Promise<VisionProTrialSession> {
    const data = await post<{ session: VisionProTrialSession }>(
      '/.netlify/functions/create-vision-pro-trial-session',
      input
    );
    return data.session;
  },
};
