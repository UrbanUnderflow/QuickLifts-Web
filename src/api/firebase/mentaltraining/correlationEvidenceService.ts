import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config';
import {
  ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION,
  PULSECHECK_STATE_SNAPSHOTS_COLLECTION,
  SIM_SESSIONS_ROOT,
} from './collections';
import { correlationEngineService } from './correlationEngineService';
import type {
  CorrelationAlignmentType,
  CorrelationConfidenceTier,
  CorrelationEvidenceRecord,
  CorrelationFreshnessTier,
} from './correlationEngineTypes';
import { sanitizeFirestoreValue, pulseCheckStateSnapshotFromFirestore, type PulseCheckStateSnapshot } from './types';
import type { SimSessionRecord } from './taxonomy';

type EvidenceWriteReason = 'initial_join' | 'backfill' | 'correction' | 'recompute';

interface EvidenceWriteOptions {
  actorType?: 'system' | 'ops' | 'research' | 'manual' | 'backfill';
  actorId?: string | null;
  requestId?: string | null;
  writeReason?: EvidenceWriteReason;
  force?: boolean;
}

interface SnapshotSelection {
  snapshot: PulseCheckStateSnapshot;
  alignmentType: CorrelationAlignmentType;
  timeDeltaMinutes: number;
  sameDayValidity: boolean;
  athleteLocalDate: string;
  sourceWindowStart: number;
  sourceWindowEnd: number;
}

const ENGINE_VERSION = 'correlation_engine_v0_1';
const SAME_DAY_WINDOW_RULE = 'state_snapshot_source_date_equals_session_date';
const BACKFILL_WINDOW_RULE = 'nearest_prior_state_snapshot_within_72h';

function toDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function sourceDateWindow(sourceDate: string): { start: number; end: number } {
  const start = Date.parse(`${sourceDate}T00:00:00.000Z`);
  const end = Date.parse(`${sourceDate}T23:59:59.999Z`);
  return {
    start: Number.isFinite(start) ? start : Date.now(),
    end: Number.isFinite(end) ? end : Date.now(),
  };
}

function mapFreshness(snapshot: PulseCheckStateSnapshot): CorrelationFreshnessTier {
  if (snapshot.freshness === 'current') return 'fresh';
  if (snapshot.freshness === 'degraded') return 'aging';
  return 'stale';
}

function mapConfidence(snapshot: PulseCheckStateSnapshot): CorrelationConfidenceTier {
  if (snapshot.freshness === 'refresh_required') return 'degraded';
  if (snapshot.confidence === 'high') return 'stable';
  if (snapshot.confidence === 'medium') return 'emerging';
  return 'directional';
}

function deriveSourceFamily(snapshot: PulseCheckStateSnapshot): CorrelationEvidenceRecord['physiology']['sourceFamily'] {
  const sources = new Set(snapshot.sourcesUsed);
  if (sources.has('oura')) return 'oura';
  if (sources.has('healthkit') || sources.has('oura_via_healthkit_export')) return 'healthkit';
  if (sources.has('apple_watch')) return 'apple_watch';
  if (sources.has('explicit_self_report')) return 'pulsecheck';
  return 'manual';
}

function deriveSourceType(snapshot: PulseCheckStateSnapshot): string {
  const sources = snapshot.sourcesUsed.filter(Boolean);
  if (sources.length) return sources.join('+');
  if (snapshot.decisionSource) return snapshot.decisionSource;
  return 'pulsecheck_state_snapshot';
}

function deriveCompletionQuality(session: SimSessionRecord): CorrelationEvidenceRecord['simOutcome']['completionQuality'] {
  if (!Number.isFinite(session.normalizedScore)) return 'excluded';
  if (Object.keys(session.supportingMetrics || {}).length >= 2 && session.durationSeconds > 0) return 'high';
  if (session.durationSeconds > 0) return 'medium';
  return 'low';
}

function buildVarietyTags(snapshot: PulseCheckStateSnapshot, session: SimSessionRecord): string[] {
  return Array.from(
    new Set([
      ...snapshot.contextTags,
      ...snapshot.sourcesUsed,
      ...session.targetSkills,
      ...session.pressureTypes,
      session.sessionType,
      session.durationMode,
      session.trialType,
      session.profileSnapshotMilestone,
    ].filter((value): value is string => Boolean(value)))
  );
}

function buildMissingSignals(snapshot: PulseCheckStateSnapshot, session: SimSessionRecord): string[] {
  const missing: string[] = [];
  if (snapshot.rawSignalSummary?.explicitSelfReport?.sleepQuality == null) missing.push('sleep_quality');
  if (snapshot.readinessScore == null) missing.push('readiness_score');
  if (!snapshot.enrichedInterpretation) missing.push('enriched_interpretation');
  if (!session.supportingMetrics || !Object.keys(session.supportingMetrics).length) missing.push('supporting_metrics');
  if (!session.targetSkills?.length) missing.push('target_skills');
  return missing;
}

function buildQualityFlags(
  snapshot: PulseCheckStateSnapshot,
  selection: SnapshotSelection,
  sourceFamily: CorrelationEvidenceRecord['physiology']['sourceFamily']
): string[] {
  const flags = new Set<string>();
  if (snapshot.freshness === 'degraded') flags.add('freshness_degraded');
  if (snapshot.freshness === 'refresh_required') flags.add('freshness_refresh_required');
  if (selection.alignmentType !== 'same_day') flags.add('alignment_backfill');
  if (sourceFamily === 'healthkit') flags.add('mirrored_source');
  if (snapshot.sourcesUsed.length <= 1 && snapshot.sourcesUsed.includes('explicit_self_report')) {
    flags.add('explicit_self_report_only');
  }
  if (snapshot.rawSignalSummary?.contradictionFlags?.length) flags.add('contradiction_flags_present');
  return Array.from(flags);
}

function snapshotSortValue(snapshot: PulseCheckStateSnapshot): number {
  const parsed = Date.parse(`${snapshot.sourceDate}T12:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : snapshot.updatedAt;
}

async function loadRecentSnapshots(athleteId: string, limitCount = 14): Promise<PulseCheckStateSnapshot[]> {
  const snap = await getDocs(
    query(
      collection(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION),
      where('athleteId', '==', athleteId),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    )
  );

  return snap.docs
    .map((entry) => pulseCheckStateSnapshotFromFirestore(entry.id, entry.data() as Record<string, any>))
    .sort((left, right) => snapshotSortValue(right) - snapshotSortValue(left));
}

function selectBestSnapshotForSession(session: SimSessionRecord, snapshots: PulseCheckStateSnapshot[]): SnapshotSelection | null {
  if (!snapshots.length) return null;
  const athleteLocalDate = toDateKey(session.createdAt);
  const exact = snapshots.find((snapshot) => snapshot.sourceDate === athleteLocalDate);
  const candidate =
    exact
    || snapshots
      .filter((snapshot) => snapshotSortValue(snapshot) <= session.createdAt)
      .sort((left, right) => snapshotSortValue(right) - snapshotSortValue(left))[0]
    || snapshots[0];

  if (!candidate) return null;

  const { start, end } = sourceDateWindow(candidate.sourceDate);
  const timeDeltaMinutes = Math.round(Math.abs(session.createdAt - candidate.updatedAt) / 60000);
  const sameDayValidity = candidate.sourceDate === athleteLocalDate;

  return {
    snapshot: candidate,
    alignmentType: sameDayValidity ? 'same_day' : 'windowed_backfill',
    timeDeltaMinutes,
    sameDayValidity,
    athleteLocalDate,
    sourceWindowStart: start,
    sourceWindowEnd: end,
  };
}

function buildEvidenceRecord(session: SimSessionRecord, selection: SnapshotSelection, options: Required<EvidenceWriteOptions>): CorrelationEvidenceRecord {
  const now = Date.now();
  const sourceFamily = deriveSourceFamily(selection.snapshot);
  const evidenceId = correlationEngineService.buildEvidenceId({
    sourceWindowStart: selection.sourceWindowStart,
    sourceWindowEnd: selection.sourceWindowEnd,
    simSessionId: session.id || `${session.userId}_${session.createdAt}`,
  });

  return {
    evidenceId,
    athleteId: session.userId,
    athleteLocalDate: selection.athleteLocalDate,
    sourceWindowStart: selection.sourceWindowStart,
    sourceWindowEnd: selection.sourceWindowEnd,
    engineVersion: ENGINE_VERSION,
    physiology: {
      sourceFamily,
      sourceType: deriveSourceType(selection.snapshot),
      sleep: {
        selfReportedSleepQuality: selection.snapshot.rawSignalSummary?.explicitSelfReport?.sleepQuality ?? null,
        normalizedReadinessScore: selection.snapshot.rawSignalSummary?.normalizedReadinessScore ?? null,
      },
      recovery: {
        overallReadiness: selection.snapshot.overallReadiness,
        readinessScore: selection.snapshot.readinessScore ?? null,
        focusReadiness: selection.snapshot.stateDimensions.focusReadiness,
        cognitiveFatigue: selection.snapshot.stateDimensions.cognitiveFatigue,
      },
      activityLoad: {
        contextTags: selection.snapshot.contextTags.join(', ') || null,
        executionLink: selection.snapshot.executionLink ?? null,
      },
      stressPosture: {
        activation: selection.snapshot.stateDimensions.activation,
        emotionalLoad: selection.snapshot.stateDimensions.emotionalLoad,
        supportFlag: selection.snapshot.supportFlag ?? null,
        contradictionFlags: selection.snapshot.rawSignalSummary?.contradictionFlags.join(', ') || null,
      },
      freshness: mapFreshness(selection.snapshot),
      observationTimes: {
        physiologyObservedAt: selection.snapshot.updatedAt,
        physiologyPublishedAt: selection.snapshot.updatedAt,
        simObservedAt: session.createdAt,
        joinedAt: now,
      },
    },
    simOutcome: {
      simSessionId: session.id || `${session.userId}_${session.createdAt}`,
      simFamily: session.simId,
      simVariant: session.simName,
      coreMetricName: session.coreMetricName,
      skillDomain: session.targetSkills?.[0] ?? null,
      pillarDomain: null,
      scores: {
        normalizedScore: session.normalizedScore,
        coreMetricValue: session.coreMetricValue,
        durationSeconds: session.durationSeconds,
        ...session.supportingMetrics,
      },
      completionQuality: deriveCompletionQuality(session),
      sessionTimestamp: session.createdAt,
    },
    alignment: {
      alignmentType: selection.alignmentType,
      timeDeltaMinutes: selection.timeDeltaMinutes,
      windowRule: selection.sameDayValidity ? SAME_DAY_WINDOW_RULE : BACKFILL_WINDOW_RULE,
      sameDayValidity: selection.sameDayValidity,
      joinedBy: options.writeReason === 'backfill' ? 'backfill' : 'engine',
    },
    quality: {
      dataConfidence: mapConfidence(selection.snapshot),
      varietyTags: buildVarietyTags(selection.snapshot, session),
      missingSignals: buildMissingSignals(selection.snapshot, session),
      qualityFlags: buildQualityFlags(selection.snapshot, selection, sourceFamily),
    },
    lineage: {
      healthSnapshotRevision: selection.snapshot.id,
      sourceRecordRefs: [
        `state_snapshot:${selection.snapshot.id}`,
        ...selection.snapshot.sourceEventIds.map((id) => `state_source:${id}`),
      ],
      trialOrAssignmentRefs: [
        session.id ? `sim_session:${session.id}` : `sim_session:${session.userId}:${session.createdAt}`,
        ...(session.profileSnapshotMilestone ? [`profile_milestone:${session.profileSnapshotMilestone}`] : []),
        ...(session.trialType ? [`trial_type:${session.trialType}`] : []),
      ],
      writeReason: options.writeReason,
    },
    trace: correlationEngineService.buildTraceMetadata({
      operation: 'evidence_write',
      actorType: options.actorType,
      actorId: options.actorId,
      requestId: options.requestId,
      trigger: options.writeReason === 'backfill' ? 'backfill' : 'event_driven',
      sourceRevisionIds: [selection.snapshot.id],
    }),
    createdAt: now,
    updatedAt: now,
  };
}

export const correlationEvidenceService = {
  async getById(athleteId: string, evidenceId: string): Promise<CorrelationEvidenceRecord | null> {
    const snap = await getDoc(correlationEngineService.evidenceRef(athleteId, evidenceId));
    if (!snap.exists()) return null;
    return snap.data() as CorrelationEvidenceRecord;
  },

  async getRecentForAthlete(athleteId: string, limitCount = 20): Promise<CorrelationEvidenceRecord[]> {
    const snap = await getDocs(
      query(
        correlationEngineService.evidenceCollectionRef(athleteId),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      )
    );

    return snap.docs.map((entry) => entry.data() as CorrelationEvidenceRecord);
  },

  async writeForSessionRecord(session: SimSessionRecord, options?: EvidenceWriteOptions): Promise<CorrelationEvidenceRecord> {
    if (!session.id) {
      throw new Error('Sim session id is required before writing a correlation evidence record.');
    }

    const resolvedOptions: Required<EvidenceWriteOptions> = {
      actorType: options?.actorType ?? 'system',
      actorId: options?.actorId ?? null,
      requestId: options?.requestId ?? null,
      writeReason: options?.writeReason ?? 'initial_join',
      force: options?.force ?? false,
    };

    const snapshots = await loadRecentSnapshots(session.userId);
    const selection = selectBestSnapshotForSession(session, snapshots);

    if (!selection) {
      throw new Error(`No state snapshot available to join against sim session ${session.id}.`);
    }

    const evidenceRecord = buildEvidenceRecord(session, selection, resolvedOptions);
    const evidenceRef = correlationEngineService.evidenceRef(session.userId, evidenceRecord.evidenceId);
    const existing = await getDoc(evidenceRef);
    if (existing.exists() && !resolvedOptions.force) {
      return existing.data() as CorrelationEvidenceRecord;
    }

    const now = Date.now();
    const existingRoot = await getDoc(correlationEngineService.rootRef(session.userId));
    const currentRoot = existingRoot.exists()
      ? (existingRoot.data() as Record<string, unknown>)
      : correlationEngineService.buildRoot(session.userId, ENGINE_VERSION, now);

    await setDoc(evidenceRef, sanitizeFirestoreValue(evidenceRecord), { merge: true });
    await setDoc(
      correlationEngineService.rootRef(session.userId),
      sanitizeFirestoreValue({
        ...currentRoot,
        athleteId: session.userId,
        engineVersion: ENGINE_VERSION,
        lastEvidenceAt: evidenceRecord.updatedAt,
        lastEngineRefreshAt: now,
        updatedAt: now,
      }),
      { merge: true }
    );

    return evidenceRecord;
  },

  async writeForSessionId(athleteId: string, sessionId: string, options?: EvidenceWriteOptions): Promise<CorrelationEvidenceRecord> {
    const sessionSnap = await getDoc(doc(db, SIM_SESSIONS_ROOT, athleteId, 'sessions', sessionId));
    if (!sessionSnap.exists()) {
      throw new Error(`Sim session not found: ${sessionId}`);
    }

    const session = { id: sessionSnap.id, ...(sessionSnap.data() as SimSessionRecord) };
    return this.writeForSessionRecord(session, options);
  },

  async backfillRecentForAthlete(athleteId: string, limitCount = 30): Promise<CorrelationEvidenceRecord[]> {
    const sessionSnap = await getDocs(
      query(
        collection(db, SIM_SESSIONS_ROOT, athleteId, 'sessions'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      )
    );

    const records: CorrelationEvidenceRecord[] = [];
    for (const entry of sessionSnap.docs) {
      const session = { id: entry.id, ...(entry.data() as SimSessionRecord) };
      records.push(
        await this.writeForSessionRecord(session, {
          actorType: 'backfill',
          writeReason: 'backfill',
        })
      );
    }

    return records;
  },
};
