import {
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { protocolRegistryService } from './protocolRegistryService';
import { stateSnapshotService } from './stateSnapshotService';
import { correlationEngineService } from './correlationEngineService';
import type {
  AthletePatternModel,
  CorrelationConsumer,
  RecommendationProjection,
} from './correlationEngineTypes';
import { sanitizeFirestoreValue, type PulseCheckStateSnapshot } from './types';

const ENGINE_VERSION = 'correlation_engine_v0_1';
const DAY_MS = 24 * 60 * 60 * 1000;
type LatestStateSnapshot = PulseCheckStateSnapshot;

function toDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function deriveCurrentPhysiologyBand(snapshot: LatestStateSnapshot): string {
  const readiness = snapshot.overallReadiness;
  const fatigue = snapshot.stateDimensions.cognitiveFatigue;
  const focus = snapshot.stateDimensions.focusReadiness;
  const activation = snapshot.stateDimensions.activation;

  if (readiness === 'red' || fatigue >= 70) return 'low_recovery_protect_window';
  if (activation >= 70) return 'high_activation_window';
  if (focus >= 70 && fatigue <= 40) return 'sharp_push_window';
  return 'steady_build_window';
}

function deriveWarningLevel(snapshot: LatestStateSnapshot): RecommendationProjection['warningLevel'] {
  if (snapshot.overallReadiness === 'red' || snapshot.stateDimensions.cognitiveFatigue >= 75) return 'protect';
  if (snapshot.overallReadiness === 'yellow' || snapshot.stateDimensions.emotionalLoad >= 65) return 'caution';
  if (snapshot.stateDimensions.activation >= 60 || snapshot.stateDimensions.focusReadiness <= 50) return 'watch';
  return 'none';
}

function latestTimingWindow(patterns: AthletePatternModel[]): string | null {
  return patterns.find((pattern) => pattern.bestTrainingWindow)?.bestTrainingWindow || null;
}

function sortPatternsForConsumer(patterns: AthletePatternModel[]): AthletePatternModel[] {
  const confidenceRank: Record<AthletePatternModel['confidenceTier'], number> = {
    high_confidence: 5,
    stable: 4,
    emerging: 3,
    directional: 2,
    degraded: 1,
  };

  return [...patterns].sort((left, right) => {
    if (confidenceRank[right.confidenceTier] !== confidenceRank[left.confidenceTier]) {
      return confidenceRank[right.confidenceTier] - confidenceRank[left.confidenceTier];
    }
    return (right.confidenceScore || 0) - (left.confidenceScore || 0);
  });
}

function filterPatternsForConsumer(patterns: AthletePatternModel[], consumer: CorrelationConsumer): AthletePatternModel[] {
  return sortPatternsForConsumer(
    patterns.filter((pattern) => {
      if (!pattern.supportedConsumers.includes(consumer)) return false;
      if (consumer === 'coach') return true;
      return pattern.recommendationEligibility !== 'not_eligible';
    })
  );
}

function buildConfidenceDisplay(patterns: AthletePatternModel[]): string {
  const top = patterns[0];
  if (!top) return 'Still learning';
  switch (top.confidenceTier) {
    case 'high_confidence':
      return 'High confidence';
    case 'stable':
      return 'Stable pattern';
    case 'emerging':
      return 'Emerging pattern';
    case 'directional':
      return 'Early directional signal';
    default:
      return 'Degraded confidence';
  }
}

function buildProjectionReason(patterns: AthletePatternModel[], currentBand: string): string {
  const top = patterns[0];
  if (!top) return `No stable physiology-cognition pattern is eligible yet for ${currentBand}.`;
  return `${top.patternFamily} is the strongest current pattern for ${currentBand}.`;
}

function buildSourceSummary(snapshot: LatestStateSnapshot): string {
  const sources = snapshot.sourcesUsed.length ? snapshot.sourcesUsed.join(', ') : 'pulsecheck';
  return `Current state derived from ${sources}.`;
}

function buildSummaryTitle(
  consumer: CorrelationConsumer,
  patterns: AthletePatternModel[],
  snapshot: LatestStateSnapshot
): string {
  const top = patterns[0];
  if (!top) {
    return consumer === 'coach'
      ? 'Not enough linked physiology evidence yet'
      : 'Nora is still learning what your body state means';
  }

  if (consumer === 'coach') {
    return top.coachSummary;
  }

  if (snapshot.overallReadiness === 'red') {
    return 'Today looks better for steadier work than heavy pressure.';
  }
  if (snapshot.overallReadiness === 'green' && top.directionality === 'positive') {
    return 'Today looks like a good window to trust your sharper work.';
  }
  return top.athleteSummary;
}

function buildSummaryBody(
  consumer: CorrelationConsumer,
  patterns: AthletePatternModel[],
  snapshot: LatestStateSnapshot
): string {
  const top = patterns[0];
  const second = patterns[1];

  if (!top) {
    return consumer === 'coach'
      ? 'Pattern engine has not yet crossed the minimum evidence threshold for a planning-grade recommendation.'
      : 'Once Nora has more linked Oura, Health, and sim history, this section will start calling out what tends to help you most.';
  }

  if (consumer === 'coach') {
    return [
      top.observedRelationship,
      second ? `Secondary signal: ${second.observedRelationship}` : '',
      `Confidence: ${top.confidenceTier}. Sample: ${top.sampleSizeDays} linked days / ${top.sampleSizeSims} sims.`,
    ].filter(Boolean).join(' ');
  }

  if (consumer === 'nora') {
    return [
      top.athleteSummary,
      second ? `Secondary read: ${second.athleteSummary}` : '',
      snapshot.recommendedRouting === 'protocol_then_sim'
        ? 'Start cleaner and build from there.'
        : snapshot.recommendedRouting === 'protocol_only'
          ? 'This looks more like a reset day than a push day.'
          : 'If you feel sharp, you can build after the first clean reps.',
    ].filter(Boolean).join(' ');
  }

  if (consumer === 'protocol_planner') {
    return [
      top.athleteSummary,
      snapshot.recommendedProtocolClass && snapshot.recommendedProtocolClass !== 'none'
        ? `Current state posture points toward ${snapshot.recommendedProtocolClass}.`
        : 'No protocol class override is being forced right now.',
    ].join(' ');
  }

  return [
    top.athleteSummary,
    second ? `Also showing up: ${second.athleteSummary}` : '',
  ].filter(Boolean).join(' ');
}

function buildRecommendedMode(
  consumer: CorrelationConsumer,
  snapshot: LatestStateSnapshot
): string | null {
  if (consumer === 'coach') return snapshot.recommendedRouting;
  if (snapshot.recommendedRouting === 'protocol_only' || snapshot.recommendedRouting === 'defer_alternate_path') return 'protect';
  if (snapshot.recommendedRouting === 'protocol_then_sim') return 'steady';
  return 'push';
}

async function suggestProtocolIds(
  consumer: CorrelationConsumer,
  snapshot: LatestStateSnapshot
): Promise<string[]> {
  if (!['protocol_planner', 'nora', 'coach'].includes(consumer)) return [];
  if (!snapshot.recommendedProtocolClass || snapshot.recommendedProtocolClass === 'none') return [];

  const runtimeRecords = await protocolRegistryService.list();
  return runtimeRecords
    .filter((protocol) =>
      protocol.isActive
      && protocol.publishStatus === 'published'
      && protocol.protocolClass === snapshot.recommendedProtocolClass
      && protocol.evidenceStatus !== 'insufficient'
    )
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 3)
    .map((protocol) => protocol.id);
}

function projectionExpiresAt(patterns: AthletePatternModel[], snapshotUpdatedAt: number): number {
  const top = patterns[0];
  const freshnessWindowDays =
    !top ? 1 :
    top.confidenceTier === 'high_confidence' ? 3 :
    top.confidenceTier === 'stable' ? 2 :
    1;
  return snapshotUpdatedAt + freshnessWindowDays * DAY_MS;
}

export const correlationProjectionService = {
  async getByKey(athleteId: string, projectionKey: string): Promise<RecommendationProjection | null> {
    const snap = await getDoc(correlationEngineService.projectionRef(athleteId, projectionKey));
    if (!snap.exists()) return null;
    return snap.data() as RecommendationProjection;
  },

  async listForAthlete(athleteId: string, limitCount = 24): Promise<RecommendationProjection[]> {
    const snap = await getDocs(
      query(
        correlationEngineService.projectionCollectionRef(athleteId),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      )
    );
    return snap.docs.map((entry) => entry.data() as RecommendationProjection);
  },

  async generateForConsumer(
    athleteId: string,
    consumer: CorrelationConsumer,
    options?: { force?: boolean; actorId?: string | null; requestId?: string | null }
  ): Promise<RecommendationProjection> {
    const snapshot = await stateSnapshotService.getLatestForAthlete(athleteId);
    if (!snapshot) {
      throw new Error(`No current state snapshot available for athlete ${athleteId}.`);
    }

    const patternSnap = await getDocs(
      query(
        correlationEngineService.patternCollectionRef(athleteId),
        orderBy('updatedAt', 'desc'),
        limit(24)
      )
    );
    const allPatterns = patternSnap.docs.map((entry) => entry.data() as AthletePatternModel);
    const supportedPatterns = filterPatternsForConsumer(allPatterns, consumer);
    const currentBand = deriveCurrentPhysiologyBand(snapshot);
    const projectionDate = toDateKey(Date.now());
    const projectionKey = correlationEngineService.buildProjectionKey({ consumer, projectionDate });
    const projectionRef = correlationEngineService.projectionRef(athleteId, projectionKey);

    const existing = await getDoc(projectionRef);
    if (existing.exists() && !options?.force) {
      return existing.data() as RecommendationProjection;
    }

    const suggestedProtocolIds = await suggestProtocolIds(consumer, snapshot);
    const now = Date.now();
    const projection: RecommendationProjection = {
      projectionKey,
      athleteId,
      consumer,
      projectionDate,
      generatedAt: now,
      expiresAt: projectionExpiresAt(supportedPatterns, snapshot.updatedAt),
      currentPhysiologyBand: currentBand,
      currentStateSignalRefs: [snapshot.id, ...snapshot.sourceEventIds],
      currentSnapshotRevision: snapshot.id,
      projectionReason: buildProjectionReason(supportedPatterns, currentBand),
      summaryTitle: buildSummaryTitle(consumer, supportedPatterns, snapshot),
      summaryBody: buildSummaryBody(consumer, supportedPatterns, snapshot),
      recommendedMode: buildRecommendedMode(consumer, snapshot),
      suggestedProtocolIds,
      timingWindow: latestTimingWindow(supportedPatterns),
      warningLevel: deriveWarningLevel(snapshot),
      supportingPatternKeys: supportedPatterns.slice(0, 3).map((pattern) => pattern.patternKey),
      confidenceTier: supportedPatterns[0]?.confidenceTier ?? 'directional',
      confidenceDisplay: buildConfidenceDisplay(supportedPatterns),
      evidenceSnippet: supportedPatterns[0]?.observedRelationship ?? null,
      sourceSummary: buildSourceSummary(snapshot),
      templateId: `projection_${consumer}_v1`,
      templateVersion: 'v1',
      copyValidated: true,
      medicalClaimCheck: 'not_required',
      staleAt: snapshot.updatedAt + DAY_MS,
      trace: correlationEngineService.buildTraceMetadata({
        operation: 'projection_generate',
        actorType: options?.actorId ? 'manual' : 'system',
        actorId: options?.actorId ?? null,
        requestId: options?.requestId ?? null,
        trigger: options?.force ? 'manual_recompute' : 'event_driven',
        sourceRevisionIds: [
          snapshot.id,
          ...supportedPatterns.slice(0, 3).map((pattern) => pattern.patternKey),
        ],
      }),
      createdAt: existing.exists()
        ? ((existing.data() as RecommendationProjection).createdAt || now)
        : now,
      updatedAt: now,
    };

    await setDoc(projectionRef, sanitizeFirestoreValue(projection), { merge: true });

    const rootRef = correlationEngineService.rootRef(athleteId);
    const rootSnap = await getDoc(rootRef);
    const rootData = rootSnap.exists()
      ? (rootSnap.data() as Record<string, unknown>)
      : correlationEngineService.buildRoot(athleteId, ENGINE_VERSION, now);
    const activeProjectionKeys = new Set<string>(
      Array.isArray(rootData.activeProjectionKeys) ? (rootData.activeProjectionKeys as string[]) : []
    );
    activeProjectionKeys.add(projectionKey);

    await setDoc(
      rootRef,
      sanitizeFirestoreValue({
        ...rootData,
        athleteId,
        engineVersion: ENGINE_VERSION,
        activeProjectionKeys: Array.from(activeProjectionKeys),
        lastProjectionRefreshAt: now,
        lastEngineRefreshAt: now,
        updatedAt: now,
      }),
      { merge: true }
    );

    return projection;
  },

  async generateCoreConsumerProjections(athleteId: string): Promise<RecommendationProjection[]> {
    const consumers: CorrelationConsumer[] = ['profile', 'nora', 'coach', 'protocol_planner'];
    const projections: RecommendationProjection[] = [];
    for (const consumer of consumers) {
      projections.push(await this.generateForConsumer(athleteId, consumer));
    }
    return projections;
  },
};
