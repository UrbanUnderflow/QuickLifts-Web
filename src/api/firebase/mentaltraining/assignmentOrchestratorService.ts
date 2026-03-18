import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config';
import { pulseCheckProvisioningService } from '../pulsecheckProvisioning/service';
import type { PulseCheckTeamMembership } from '../pulsecheckProvisioning/types';
import { athleteProgressService } from './athleteProgressService';
import { PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION } from './collections';
import { simModuleLibraryService } from './exerciseLibraryService';
import { resolvePulseCheckFunctionUrl } from './pulseCheckFunctionsUrl';
import { stateSnapshotService } from './stateSnapshotService';
import {
  PulseCheckDailyAssignment,
  PulseCheckDailyAssignmentActionType,
  PulseCheckAssignmentEventRecordResult,
  PulseCheckDailyAssignmentStatus,
  RecordPulseCheckAssignmentEventInput,
  PulseCheckStateSnapshot,
  pulseCheckDailyAssignmentFromFirestore,
  pulseCheckDailyAssignmentToFirestore,
} from './types';

const DAILY_ASSIGNMENTS_COLLECTION = PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION;
const ATHLETE_PROGRESS_COLLECTION = 'athlete-mental-progress';

const buildDailyAssignmentId = (athleteId: string, sourceDate: string) => `${athleteId}_${sourceDate}`;

const rolePriority = (membership: PulseCheckTeamMembership) => {
  switch (membership.role) {
    case 'coach':
      return 0;
    case 'team-admin':
      return 1;
    case 'performance-staff':
      return 2;
    case 'support-staff':
      return 3;
    default:
      return 9;
  }
};

const toTimestampMillis = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'seconds' in value) {
    return Number((value as { seconds?: number }).seconds || 0) * 1000;
  }
  return 0;
};

const membershipTimestamp = (membership: PulseCheckTeamMembership) => {
  const grantedAt = toTimestampMillis(membership.grantedAt);
  const createdAt = toTimestampMillis(membership.createdAt);
  return Math.max(grantedAt, createdAt);
};

const isMutableStatus = (status: PulseCheckDailyAssignmentStatus) =>
  status === PulseCheckDailyAssignmentStatus.Assigned || status === PulseCheckDailyAssignmentStatus.Viewed;

const toReadinessBand = (readinessScore?: number): PulseCheckDailyAssignment['readinessBand'] => {
  if (typeof readinessScore !== 'number') return undefined;
  if (readinessScore < 45) return 'low';
  if (readinessScore < 65) return 'medium';
  return 'high';
};

const humanizeRuntimeLabel = (value?: string | null) =>
  value ? value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() : '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to update Nora daily assignments.');
  }

  const idToken = await user.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

async function recordAssignmentEvent(
  input: RecordPulseCheckAssignmentEventInput
): Promise<PulseCheckAssignmentEventRecordResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/record-pulsecheck-assignment-event'), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data as PulseCheckAssignmentEventRecordResult;
}

function resolveSnapshotDrivenActionType({
  snapshot,
  hasResolvedExercise,
  fallbackActionType,
}: {
  snapshot?: PulseCheckStateSnapshot | null;
  hasResolvedExercise: boolean;
  fallbackActionType: PulseCheckDailyAssignmentActionType;
}): PulseCheckDailyAssignmentActionType {
  if (!snapshot) {
    return fallbackActionType;
  }

  switch (snapshot.recommendedRouting) {
    case 'defer_alternate_path':
      return 'defer';
    case 'protocol_only':
    case 'protocol_then_sim':
      return hasResolvedExercise ? 'lighter_sim' : 'defer';
    case 'sim_only':
    case 'sim_then_protocol':
    case 'trial_only':
    default:
      return hasResolvedExercise ? 'sim' : 'defer';
  }
}

function buildSnapshotDrivenRationale({
  snapshot,
  actionType,
  fallbackRationale,
}: {
  snapshot?: PulseCheckStateSnapshot | null;
  actionType: PulseCheckDailyAssignmentActionType;
  fallbackRationale?: string;
}): string {
  if (!snapshot) {
    return fallbackRationale || '';
  }

  const confidenceLabel = humanizeRuntimeLabel(snapshot.confidence) || 'current';
  const routingLabel = humanizeRuntimeLabel(snapshot.recommendedRouting) || 'sim only';
  const readinessLabel = snapshot.overallReadiness ? `${snapshot.overallReadiness} readiness` : 'current readiness';
  const protocolLabel =
    snapshot.recommendedProtocolClass && snapshot.recommendedProtocolClass !== 'none'
      ? `${humanizeRuntimeLabel(snapshot.recommendedProtocolClass)} protocol`
      : '';

  let runtimeLead = '';
  switch (actionType) {
    case 'defer':
      runtimeLead = `Nora paused the main task because today's state snapshot reads ${readinessLabel} with ${confidenceLabel} confidence.`;
      break;
    case 'lighter_sim':
      runtimeLead = protocolLabel
        ? `Nora is front-loading ${protocolLabel} work because today's state snapshot reads ${readinessLabel} and routes ${routingLabel}.`
        : `Nora softened today's entry because the state snapshot reads ${readinessLabel} and routes ${routingLabel}.`;
      break;
    case 'sim':
    default:
      runtimeLead = `Nora kept today's task live because the state snapshot reads ${readinessLabel} and routes ${routingLabel}.`;
      break;
  }

  return fallbackRationale ? `${runtimeLead} ${fallbackRationale}` : runtimeLead;
}

const sortByFreshness = (left: PulseCheckDailyAssignment, right: PulseCheckDailyAssignment) =>
  (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt);

async function resolveActiveAthleteMembership(athleteId: string): Promise<PulseCheckTeamMembership | null> {
  const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(athleteId);
  const athleteMemberships = memberships
    .filter((membership) => membership.role === 'athlete')
    .sort((left, right) => membershipTimestamp(right) - membershipTimestamp(left));

  return athleteMemberships[0] || null;
}

async function resolveCoachId(
  athleteId: string,
  athleteMembership: PulseCheckTeamMembership,
  existingCoachId?: string
): Promise<string | undefined> {
  if (existingCoachId && existingCoachId !== athleteId) {
    return existingCoachId;
  }

  if (athleteMembership.legacyCoachId && athleteMembership.legacyCoachId !== athleteId) {
    return athleteMembership.legacyCoachId;
  }

  const teamMemberships = await pulseCheckProvisioningService.listTeamMemberships(athleteMembership.teamId);
  const candidate = teamMemberships
    .filter((membership) => membership.userId !== athleteId && membership.role !== 'athlete' && membership.role !== 'clinician')
    .sort((left, right) => {
      const byRole = rolePriority(left) - rolePriority(right);
      if (byRole !== 0) return byRole;
      return membershipTimestamp(right) - membershipTimestamp(left);
    })[0];

  return candidate?.userId;
}

async function persistResolvedCoachId(athleteId: string, coachId?: string) {
  if (!coachId) return;

  await setDoc(
    doc(db, ATHLETE_PROGRESS_COLLECTION, athleteId),
    {
      coachId,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

export const assignmentOrchestratorService = {
  async getById(id: string): Promise<PulseCheckDailyAssignment | null> {
    const snapshot = await getDoc(doc(db, DAILY_ASSIGNMENTS_COLLECTION, id));
    if (!snapshot.exists()) return null;
    return pulseCheckDailyAssignmentFromFirestore(snapshot.id, snapshot.data() as Record<string, any>);
  },

  async getForAthleteOnDate(athleteId: string, sourceDate: string): Promise<PulseCheckDailyAssignment | null> {
    return this.getById(buildDailyAssignmentId(athleteId, sourceDate));
  },

  async getLatestForAthlete(athleteId: string): Promise<PulseCheckDailyAssignment | null> {
    const snapshot = await getDocs(
      query(collection(db, DAILY_ASSIGNMENTS_COLLECTION), where('athleteId', '==', athleteId))
    );

    const assignments = snapshot.docs
      .map((docSnap) => pulseCheckDailyAssignmentFromFirestore(docSnap.id, docSnap.data() as Record<string, any>))
      .sort(sortByFreshness);

    return assignments[0] || null;
  },

  async listRecentForCoach(coachId: string, max = 20): Promise<PulseCheckDailyAssignment[]> {
    const snapshot = await getDocs(
      query(collection(db, DAILY_ASSIGNMENTS_COLLECTION), where('coachId', '==', coachId))
    );

    return snapshot.docs
      .map((docSnap) => pulseCheckDailyAssignmentFromFirestore(docSnap.id, docSnap.data() as Record<string, any>))
      .sort(sortByFreshness)
      .slice(0, max);
  },

  async orchestratePostCheckIn({
    athleteId,
    sourceCheckInId,
    sourceStateSnapshotId,
    sourceDate,
  }: {
    athleteId: string;
    sourceCheckInId: string;
    sourceStateSnapshotId?: string;
    sourceDate: string;
  }): Promise<PulseCheckDailyAssignment | null> {
    const progress = await athleteProgressService.get(athleteId);
    if (!progress?.activeProgram) {
      return null;
    }

    const snapshot =
      (sourceStateSnapshotId ? await stateSnapshotService.getById(sourceStateSnapshotId) : null) ||
      (await stateSnapshotService.getForAthleteOnDate(athleteId, sourceDate));

    const athleteMembership = await resolveActiveAthleteMembership(athleteId);
    if (!athleteMembership) {
      return null;
    }

    const coachId = await resolveCoachId(athleteId, athleteMembership, progress.coachId);
    await persistResolvedCoachId(athleteId, coachId);

    const readinessScore =
      snapshot?.readinessScore ??
      (
        progress.activeProgram.generatedAt
          ? progress.taxonomyProfile?.modifierScores?.readiness
          : undefined
      );
    const assignmentId = buildDailyAssignmentId(athleteId, sourceDate);
    const existing = await this.getById(assignmentId);

    if (existing && !isMutableStatus(existing.status)) {
      return existing;
    }

    const isLowerReadiness =
      progress.activeProgram.sessionType === 'recovery_rep' || progress.activeProgram.sessionType === 'probe';
    const fallbackActionType = progress.activeProgram.recommendedSimId
      ? isLowerReadiness
        ? 'lighter_sim'
        : 'sim'
      : 'defer';
    const actionType = resolveSnapshotDrivenActionType({
      snapshot,
      hasResolvedExercise: Boolean(progress.activeProgram.recommendedSimId || progress.activeProgram.recommendedLegacyExerciseId),
      fallbackActionType,
    });

    const now = Date.now();
    const nextAssignment: PulseCheckDailyAssignment = {
      id: assignmentId,
      lineageId: existing?.lineageId || assignmentId,
      revision: existing?.revision || 1,
      previousRevision: existing?.previousRevision,
      athleteId,
      teamId: athleteMembership.teamId,
      teamMembershipId: athleteMembership.id,
      coachId,
      sourceCheckInId,
      sourceStateSnapshotId,
      sourceDate,
      assignedBy: 'nora',
      status: actionType === 'defer' ? PulseCheckDailyAssignmentStatus.Deferred : PulseCheckDailyAssignmentStatus.Assigned,
      actionType,
      simSpecId: progress.activeProgram.recommendedSimId,
      legacyExerciseId: progress.activeProgram.recommendedLegacyExerciseId,
      sessionType: progress.activeProgram.sessionType,
      durationMode: progress.activeProgram.durationMode,
      durationSeconds: progress.activeProgram.durationSeconds,
      rationale: buildSnapshotDrivenRationale({
        snapshot,
        actionType,
        fallbackRationale: progress.activeProgram.rationale,
      }),
      readinessScore,
      readinessBand: toReadinessBand(readinessScore),
      escalationTier: 0,
      supportFlag: false,
      programSnapshot: progress.activeProgram,
      coachNotifiedAt: existing?.coachNotifiedAt,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await setDoc(
      doc(db, DAILY_ASSIGNMENTS_COLLECTION, assignmentId),
      pulseCheckDailyAssignmentToFirestore(nextAssignment),
      { merge: true }
    );

    if (sourceStateSnapshotId) {
      await stateSnapshotService.attachExecutionLink(sourceStateSnapshotId, assignmentId);
    }

    return nextAssignment;
  },

  async markCoachNotified(id: string): Promise<void> {
    await updateDoc(doc(db, DAILY_ASSIGNMENTS_COLLECTION, id), {
      coachNotifiedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async markViewed(id: string): Promise<void> {
    await recordAssignmentEvent({ assignmentId: id, eventType: 'viewed' });
  },

  async markStarted(id: string): Promise<void> {
    await recordAssignmentEvent({ assignmentId: id, eventType: 'started' });
  },

  async markCompleted(id: string): Promise<void> {
    await recordAssignmentEvent({ assignmentId: id, eventType: 'completed' });
  },

  async resolveExercise(id: string) {
    const assignment = await this.getById(id);
    if (!assignment) return null;

    const exercise =
      (assignment.legacyExerciseId ? await simModuleLibraryService.getById(assignment.legacyExerciseId) : null) ||
      (assignment.simSpecId ? await simModuleLibraryService.getBySimSpecId(assignment.simSpecId) : null);

    if (!exercise) {
      return null;
    }

    return { assignment, exercise };
  },

  async overrideAssignment({
    id,
    overriddenBy,
    reason,
  }: {
    id: string;
    overriddenBy: string;
    reason: string;
  }): Promise<void> {
    await recordAssignmentEvent({
      assignmentId: id,
      eventType: 'overridden',
      actorUserId: overriddenBy,
      reason,
    });
  },

  async deferAssignment({
    id,
    overriddenBy,
    reason,
  }: {
    id: string;
    overriddenBy: string;
    reason: string;
  }): Promise<void> {
    await recordAssignmentEvent({
      assignmentId: id,
      eventType: 'deferred',
      actorUserId: overriddenBy,
      reason,
    });
  },
};
