import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { db } from '../config';
import {
  PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION,
  PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION,
  PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION,
  PULSECHECK_STATE_SNAPSHOTS_COLLECTION,
} from './collections';
import { protocolRegistryService } from './protocolRegistryService';
import {
  type PulseCheckAssignmentEvent,
  type PulseCheckDailyAssignment,
  type PulseCheckProtocolDefinition,
  type PulseCheckProtocolResponsivenessProfile,
  type PulseCheckProtocolResponsivenessSummary,
  type PulseCheckStateConfidence,
  type PulseCheckStateFreshness,
  type PulseCheckStateSnapshot,
  pulseCheckDailyAssignmentFromFirestore,
  pulseCheckProtocolResponsivenessProfileFromFirestore,
  pulseCheckProtocolResponsivenessProfileToFirestore,
  pulseCheckStateSnapshotFromFirestore,
} from './types';

const COLLECTION = PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION;
const DAY_MS = 24 * 60 * 60 * 1000;
const CURRENT_FRESHNESS_WINDOW_DAYS = 21;
const DEGRADED_FRESHNESS_WINDOW_DAYS = 45;

interface ProtocolEvidenceWindow {
  runtime: PulseCheckProtocolDefinition;
  responseDirection: PulseCheckProtocolResponsivenessSummary['responseDirection'];
  stateFit: string[];
  supportingEvidence: string[];
  sourceEventIds: string[];
  lastObservedAt: number;
  lastConfirmedAt?: number;
}

interface ResponsivenessAggregateBucket {
  protocolFamilyId?: string;
  protocolFamilyLabel?: string;
  variantId?: string;
  variantLabel?: string;
  protocolClass?: PulseCheckProtocolDefinition['protocolClass'];
  responseFamily?: PulseCheckProtocolDefinition['responseFamily'];
  sampleSize: number;
  positiveSignals: number;
  neutralSignals: number;
  negativeSignals: number;
  stateFit: Set<string>;
  supportingEvidence: string[];
  lastObservedAt: number;
  lastConfirmedAt?: number;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function pulseCheckAssignmentEventFromFirestore(
  id: string,
  data: Record<string, any>
): PulseCheckAssignmentEvent {
  return {
    id,
    assignmentId: data.assignmentId || '',
    athleteId: data.athleteId || '',
    teamId: data.teamId || '',
    sourceDate: data.sourceDate || '',
    eventType: data.eventType || 'viewed',
    actorType: data.actorType || 'system',
    actorUserId: data.actorUserId || '',
    eventAt: typeof data.eventAt === 'number' ? data.eventAt : (typeof data.createdAt === 'number' ? data.createdAt : Date.now()),
    metadata: data.metadata || undefined,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
  };
}

function deriveResponseDirection(
  positiveSignals: number,
  negativeSignals: number
): PulseCheckProtocolResponsivenessSummary['responseDirection'] {
  if (negativeSignals > positiveSignals && negativeSignals > 0) return 'negative';
  if (positiveSignals > negativeSignals && positiveSignals > 0) return 'positive';
  if (positiveSignals > 0 && negativeSignals > 0) return 'mixed';
  return 'neutral';
}

function deriveConfidence(
  sampleSize: number,
  positiveSignals: number,
  negativeSignals: number
): PulseCheckStateConfidence {
  const decisiveSignals = positiveSignals + negativeSignals;
  const dominantSignals = Math.max(positiveSignals, negativeSignals);
  const dominance = decisiveSignals > 0 ? dominantSignals / decisiveSignals : 0;

  if (sampleSize >= 6 && decisiveSignals >= 4 && dominance >= 0.66) return 'high';
  if (sampleSize >= 3 && decisiveSignals >= 2) return 'medium';
  return 'low';
}

function deriveFreshness(lastObservedAt?: number): PulseCheckStateFreshness {
  if (!lastObservedAt) return 'refresh_required';
  const ageDays = (Date.now() - lastObservedAt) / DAY_MS;
  if (ageDays <= CURRENT_FRESHNESS_WINDOW_DAYS) return 'current';
  if (ageDays <= DEGRADED_FRESHNESS_WINDOW_DAYS) return 'degraded';
  return 'refresh_required';
}

function buildStaleAt(lastObservedAt?: number) {
  const anchor = lastObservedAt || Date.now();
  return anchor + DEGRADED_FRESHNESS_WINDOW_DAYS * DAY_MS;
}

function classifyAssignmentWindow(
  assignment: PulseCheckDailyAssignment,
  runtime: PulseCheckProtocolDefinition,
  events: PulseCheckAssignmentEvent[],
  snapshot: PulseCheckStateSnapshot | null,
  downstreamAssignments: PulseCheckDailyAssignment[]
): ProtocolEvidenceWindow {
  const supportingEvidence: string[] = [];
  const sourceEventIds = events.map((event) => event.id);
  const latestMeaningfulEvent = events.find((event) =>
    event.eventType === 'completed' || event.eventType === 'deferred' || event.eventType === 'overridden'
  );

  let score = 0;
  let lastObservedAt = latestMeaningfulEvent?.eventAt || assignment.updatedAt || assignment.createdAt || Date.now();
  let lastConfirmedAt: number | undefined;

  if (latestMeaningfulEvent?.eventType === 'completed' || assignment.status === 'completed') {
    score += 1;
    lastConfirmedAt = Math.max(lastConfirmedAt || 0, latestMeaningfulEvent?.eventAt || assignment.completedAt || assignment.updatedAt || assignment.createdAt);
    supportingEvidence.push('Protocol assignment completed successfully.');
  } else if (
    latestMeaningfulEvent?.eventType === 'deferred' ||
    latestMeaningfulEvent?.eventType === 'overridden' ||
    assignment.status === 'deferred' ||
    assignment.status === 'overridden'
  ) {
    score -= 1;
    lastConfirmedAt = Math.max(lastConfirmedAt || 0, latestMeaningfulEvent?.eventAt || assignment.updatedAt || assignment.createdAt);
    supportingEvidence.push('Protocol was deferred or replaced before a clean completion.');
  } else if (assignment.status === 'started' || assignment.status === 'viewed') {
    supportingEvidence.push('Protocol was engaged but the outcome is still incomplete.');
  } else {
    supportingEvidence.push('Protocol was assigned without enough outcome signal yet.');
  }

  if (snapshot && typeof assignment.readinessScore === 'number' && typeof snapshot.readinessScore === 'number') {
    const readinessDelta = snapshot.readinessScore - assignment.readinessScore;
    lastObservedAt = Math.max(lastObservedAt, snapshot.updatedAt || 0);

    if (readinessDelta >= 5) {
      score += 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, snapshot.updatedAt || 0);
      supportingEvidence.push(`Same-day readiness improved from ${assignment.readinessScore} to ${snapshot.readinessScore}.`);
    } else if (readinessDelta <= -5) {
      score -= 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, snapshot.updatedAt || 0);
      supportingEvidence.push(`Same-day readiness dropped from ${assignment.readinessScore} to ${snapshot.readinessScore}.`);
    } else {
      supportingEvidence.push('Same-day readiness stayed near baseline after the protocol.');
    }
  }

  const downstreamSim = downstreamAssignments
    .slice()
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))[0];

  if (downstreamSim) {
    lastObservedAt = Math.max(lastObservedAt, downstreamSim.updatedAt || downstreamSim.createdAt || 0);
    if (downstreamSim.status === 'completed') {
      score += 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, downstreamSim.completedAt || downstreamSim.updatedAt || 0);
      supportingEvidence.push(`Downstream ${downstreamSim.actionType === 'lighter_sim' ? 'lighter sim' : 'sim'} completed on the same day.`);
    } else if (downstreamSim.status === 'deferred' || downstreamSim.status === 'overridden') {
      score -= 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, downstreamSim.updatedAt || 0);
      supportingEvidence.push(`Downstream ${downstreamSim.actionType === 'lighter_sim' ? 'lighter sim' : 'sim'} was deferred or overridden.`);
    } else {
      supportingEvidence.push('Downstream execution exists but is still inconclusive.');
    }
  }

  const stateFit = uniqueStrings([
    assignment.readinessBand ? `${assignment.readinessBand}_readiness` : '',
    snapshot?.overallReadiness ? `${snapshot.overallReadiness}_snapshot` : '',
    snapshot?.recommendedRouting || '',
    snapshot?.recommendedProtocolClass && snapshot.recommendedProtocolClass !== 'none'
      ? snapshot.recommendedProtocolClass
      : '',
    ...(snapshot?.contextTags || []),
    ...(runtime.preferredContextTags || []),
  ]);

  return {
    runtime,
    responseDirection: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
    stateFit,
    supportingEvidence: uniqueStrings(supportingEvidence).slice(0, 6),
    sourceEventIds,
    lastObservedAt,
    lastConfirmedAt,
  };
}

function addWindowToBucket(
  bucket: ResponsivenessAggregateBucket | undefined,
  window: ProtocolEvidenceWindow,
  identity: Pick<
    ResponsivenessAggregateBucket,
    'protocolFamilyId' | 'protocolFamilyLabel' | 'variantId' | 'variantLabel' | 'protocolClass' | 'responseFamily'
  >
): ResponsivenessAggregateBucket {
  const nextBucket: ResponsivenessAggregateBucket = bucket || {
    ...identity,
    sampleSize: 0,
    positiveSignals: 0,
    neutralSignals: 0,
    negativeSignals: 0,
    stateFit: new Set<string>(),
    supportingEvidence: [],
    lastObservedAt: 0,
    lastConfirmedAt: undefined,
  };

  nextBucket.sampleSize += 1;
  if (window.responseDirection === 'positive') nextBucket.positiveSignals += 1;
  else if (window.responseDirection === 'negative') nextBucket.negativeSignals += 1;
  else nextBucket.neutralSignals += 1;

  window.stateFit.forEach((tag) => nextBucket.stateFit.add(tag));
  nextBucket.supportingEvidence = uniqueStrings([...nextBucket.supportingEvidence, ...window.supportingEvidence]).slice(0, 6);
  nextBucket.lastObservedAt = Math.max(nextBucket.lastObservedAt, window.lastObservedAt);
  if (window.lastConfirmedAt) {
    nextBucket.lastConfirmedAt = Math.max(nextBucket.lastConfirmedAt || 0, window.lastConfirmedAt);
  }

  return nextBucket;
}

function bucketToSummary(bucket: ResponsivenessAggregateBucket): PulseCheckProtocolResponsivenessSummary {
  return {
    protocolFamilyId: bucket.protocolFamilyId,
    protocolFamilyLabel: bucket.protocolFamilyLabel,
    variantId: bucket.variantId,
    variantLabel: bucket.variantLabel,
    protocolClass: bucket.protocolClass,
    responseFamily: bucket.responseFamily,
    responseDirection: deriveResponseDirection(bucket.positiveSignals, bucket.negativeSignals),
    confidence: deriveConfidence(bucket.sampleSize, bucket.positiveSignals, bucket.negativeSignals),
    freshness: deriveFreshness(bucket.lastConfirmedAt || bucket.lastObservedAt),
    sampleSize: bucket.sampleSize,
    positiveSignals: bucket.positiveSignals,
    neutralSignals: bucket.neutralSignals,
    negativeSignals: bucket.negativeSignals,
    stateFit: Array.from(bucket.stateFit).slice(0, 8),
    supportingEvidence: bucket.supportingEvidence.slice(0, 6),
    lastObservedAt: bucket.lastObservedAt || undefined,
    lastConfirmedAt: bucket.lastConfirmedAt,
  };
}

async function listAssignmentsForAthlete(athleteId: string) {
  const snap = await getDocs(query(collection(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION), where('athleteId', '==', athleteId)));
  return snap.docs.map((entry) => pulseCheckDailyAssignmentFromFirestore(entry.id, entry.data() as Record<string, any>));
}

async function listEventsForAthlete(athleteId: string) {
  const snap = await getDocs(query(collection(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION), where('athleteId', '==', athleteId)));
  return snap.docs.map((entry) => pulseCheckAssignmentEventFromFirestore(entry.id, entry.data() as Record<string, any>));
}

async function listSnapshotsForAthlete(athleteId: string) {
  const snap = await getDocs(query(collection(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION), where('athleteId', '==', athleteId)));
  return snap.docs.map((entry) => pulseCheckStateSnapshotFromFirestore(entry.id, entry.data() as Record<string, any>));
}

export const protocolResponsivenessService = {
  async getByAthleteId(athleteId: string): Promise<PulseCheckProtocolResponsivenessProfile | null> {
    const profileSnap = await getDoc(doc(db, COLLECTION, athleteId));
    if (!profileSnap.exists()) return null;
    return pulseCheckProtocolResponsivenessProfileFromFirestore(profileSnap.id, profileSnap.data() as Record<string, any>);
  },

  async listRecentProfiles(max = 12): Promise<PulseCheckProtocolResponsivenessProfile[]> {
    const snapshot = await getDocs(query(collection(db, COLLECTION), orderBy('updatedAt', 'desc'), limit(max)));
    return snapshot.docs
      .map((docSnap) => pulseCheckProtocolResponsivenessProfileFromFirestore(docSnap.id, docSnap.data() as Record<string, any>))
      .sort((left, right) => (right.updatedAt || right.lastUpdatedAt || 0) - (left.updatedAt || left.lastUpdatedAt || 0))
      .slice(0, max);
  },

  async listForAthletes(athleteIds: string[]): Promise<Record<string, PulseCheckProtocolResponsivenessProfile | null>> {
    const entries = await Promise.all(
      uniqueStrings(athleteIds).map(async (athleteId) => [athleteId, await this.getByAthleteId(athleteId)] as const)
    );
    return Object.fromEntries(entries);
  },

  async refreshForAthlete(athleteId: string): Promise<PulseCheckProtocolResponsivenessProfile> {
    const existing = await this.getByAthleteId(athleteId);
    const now = Date.now();
    const [assignments, events, snapshots, runtimeRecords] = await Promise.all([
      listAssignmentsForAthlete(athleteId),
      listEventsForAthlete(athleteId),
      listSnapshotsForAthlete(athleteId),
      protocolRegistryService.list(),
    ]);

    const runtimeById = new Map(runtimeRecords.map((runtime) => [runtime.id, runtime]));
    const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
    const snapshotsByDate = new Map(snapshots.map((snapshot) => [snapshot.sourceDate, snapshot]));
    const eventsByAssignmentId = new Map<string, PulseCheckAssignmentEvent[]>();
    events.forEach((event) => {
      const existingEvents = eventsByAssignmentId.get(event.assignmentId) || [];
      existingEvents.push(event);
      existingEvents.sort((left, right) => right.eventAt - left.eventAt);
      eventsByAssignmentId.set(event.assignmentId, existingEvents);
    });

    const protocolAssignments = assignments.filter((assignment) => assignment.actionType === 'protocol' && assignment.protocolId && runtimeById.has(assignment.protocolId));
    const familyBuckets = new Map<string, ResponsivenessAggregateBucket>();
    const variantBuckets = new Map<string, ResponsivenessAggregateBucket>();
    const sourceEventIds = new Set<string>();
    let latestObservedAt = 0;

    protocolAssignments.forEach((assignment) => {
      if (!assignment.protocolId) return;
      const runtime = runtimeById.get(assignment.protocolId);
      if (!runtime) return;

      const snapshot = assignment.sourceStateSnapshotId
        ? (snapshotsById.get(assignment.sourceStateSnapshotId) || snapshotsByDate.get(assignment.sourceDate) || null)
        : (snapshotsByDate.get(assignment.sourceDate) || null);
      const downstreamAssignments = assignments.filter((candidate) =>
        candidate.athleteId === assignment.athleteId &&
        candidate.sourceDate === assignment.sourceDate &&
        candidate.id !== assignment.id &&
        (candidate.actionType === 'sim' || candidate.actionType === 'lighter_sim')
      );
      const evidenceWindow = classifyAssignmentWindow(
        assignment,
        runtime,
        eventsByAssignmentId.get(assignment.id) || [],
        snapshot,
        downstreamAssignments
      );

      latestObservedAt = Math.max(latestObservedAt, evidenceWindow.lastObservedAt);
      evidenceWindow.sourceEventIds.forEach((eventId) => sourceEventIds.add(eventId));

      familyBuckets.set(
        runtime.familyId,
        addWindowToBucket(familyBuckets.get(runtime.familyId), evidenceWindow, {
          protocolFamilyId: runtime.familyId,
          protocolFamilyLabel: runtime.familyLabel,
          protocolClass: runtime.protocolClass,
          responseFamily: runtime.responseFamily,
        })
      );
      variantBuckets.set(
        runtime.variantId,
        addWindowToBucket(variantBuckets.get(runtime.variantId), evidenceWindow, {
          protocolFamilyId: runtime.familyId,
          protocolFamilyLabel: runtime.familyLabel,
          variantId: runtime.variantId,
          variantLabel: runtime.variantLabel,
          protocolClass: runtime.protocolClass,
          responseFamily: runtime.responseFamily,
        })
      );
    });

    const familyResponses = Object.fromEntries(
      Array.from(familyBuckets.entries()).map(([familyId, bucket]) => [familyId, bucketToSummary(bucket)])
    );
    const variantResponses = Object.fromEntries(
      Array.from(variantBuckets.entries()).map(([variantId, bucket]) => [variantId, bucketToSummary(bucket)])
    );

    const profile: PulseCheckProtocolResponsivenessProfile = {
      id: athleteId,
      athleteId,
      familyResponses,
      variantResponses,
      sourceEventIds: Array.from(sourceEventIds).slice(0, 100),
      staleAt: buildStaleAt(latestObservedAt || existing?.updatedAt),
      lastUpdatedAt: now,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await setDoc(doc(db, COLLECTION, athleteId), pulseCheckProtocolResponsivenessProfileToFirestore(profile), { merge: true });
    return profile;
  },
};
