// =============================================================================
// Daily Assignment Generator — picks 1 protocol + 1 sim per athlete per day.
//
// Doctrine (Phase I, Daily Curriculum Layer):
//   - Athletes build automaticity through spaced repetition. The system
//     decides what they practice today, every day, regardless of their
//     state. This is the PROACTIVE counterpart to the reactive Adaptation
//     Framing Layer.
//   - Selection is pillar-balance-aware: the most-underrepped pillar in
//     the athlete's last-30-days history wins for the day.
//   - The generator writes to the existing `pulsecheck-daily-assignments`
//     collection with `assignedBy: 'curriculum-engine'`. Same shape as
//     coach-authored or Nora-authored assignments → no iOS client work
//     needed for the read path.
//
// Selection algorithm:
//   1. Pull config (pillar weights + frequency targets + engine-enabled flag)
//   2. Pull last-30-days completions for the athlete
//   3. Compute current pillar rep counts + per-pillar gap vs target
//   4. Pick the WORST-GAP pillar → that pillar drives today's selection
//   5. From the eligible-asset pool (foundational always; intermediate +
//      advanced require prerequisitePillarReps to be met):
//      a. Filter by drivingPillar
//      b. Apply coach overrides (pinned items boost weight; excluded items
//         removed from pool)
//      c. Apply variety filter (don't repeat the same item assigned in
//         the last 2 days)
//      d. Pick by lowest "actualReps / recommendedFrequency" ratio (the
//         most-underdone item wins)
//   6. Repeat for sim
//   7. Write the two assignment docs + a generation-trace doc
// =============================================================================

import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config';
import {
  MentalExercise,
  PulseCheckDailyAssignment,
  PulseCheckProtocolDefinition,
} from '../mentaltraining/types';
import { TaxonomyPillar } from '../mentaltraining/taxonomy';
import {
  CurriculumGenerationResult,
  yearMonthOf,
} from './types';
import { getOrInitCurriculumConfig, resolvePillarWeightsForSport } from './curriculumConfig';
import { listOverridesForAthlete, markOverrideConsumed } from './coachOverride';
import {
  CompletionsSnapshot,
  assetPillar,
  assetPrerequisites,
  assetProgression,
  countRepsByPillar,
  pickAsset,
  pickWorstGapPillar,
} from './selection';

// ──────────────────────────────────────────────────────────────────────────────
// Collection helpers (existing collections we read from / write to)
// ──────────────────────────────────────────────────────────────────────────────

const PROTOCOLS_COLLECTION = 'pulsecheck-protocols';
const SIM_MODULES_COLLECTION = 'sim-modules';
const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';
const ASSIGNMENT_EVENTS_COLLECTION = 'pulsecheck-assignment-events';
const GENERATION_TRACES_COLLECTION = 'pulsecheck-curriculum-generation-traces';

const stripUndefinedDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [k, v]) => {
      if (v === undefined) return acc;
      acc[k] = stripUndefinedDeep(v);
      return acc;
    }, {});
  }
  return value;
};

const dateKey = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const subtractDaysUtc = (d: Date, days: number): Date => {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() - days);
  return r;
};

// ──────────────────────────────────────────────────────────────────────────────
// Inputs to the generator
// ──────────────────────────────────────────────────────────────────────────────

export interface GenerateDailyAssignmentInput {
  athleteUserId: string;
  teamId: string;
  teamMembershipId: string;
  /** Athlete's sport (for per-sport pillar weights). Optional; equal weights
   *  apply if not provided. */
  sportId?: string;
  /** Date this generation is for, in athlete-local YYYY-MM-DD. Defaults
   *  to today UTC if not provided. */
  sourceDate?: string;
  /** Athlete IANA timezone — passed through to the daily assignment doc
   *  so iOS reminder schedulers can use it. */
  timezone?: string;
  /** Optional preview mode — computes selection but does NOT write any
   *  Firestore docs. Used by the admin surface preview tool. */
  preview?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public entry — single-athlete generation
// ──────────────────────────────────────────────────────────────────────────────

export const generateDailyAssignment = async (
  input: GenerateDailyAssignmentInput,
): Promise<CurriculumGenerationResult | null> => {
  const config = await getOrInitCurriculumConfig();
  if (!config.engineEnabled) {
    return null; // master kill switch — caller should log
  }

  const sourceDate = input.sourceDate || dateKey(new Date());
  const yearMonth = yearMonthOf(sourceDate);
  const generatedAt = Date.now();

  const [protocols, sims, completions, overrides] = await Promise.all([
    fetchEligibleProtocols(),
    fetchEligibleSims(),
    fetchLast30DaysCompletions(input.athleteUserId, sourceDate),
    listOverridesForAthlete(input.athleteUserId, yearMonth),
  ]);

  const pillarRepCounts = countRepsByPillar(completions, protocols, sims);
  const recentlyAssigned = completions.recentlyAssignedIds(2);
  const pillarWeights = resolvePillarWeightsForSport(config, input.sportId);
  const drivingPillar = pickWorstGapPillar(
    pillarRepCounts,
    pillarWeights,
    config.frequencyTargetsByLevel,
    protocols,
  );

  const protocolPick = pickAsset({
    pool: protocols,
    drivingPillar,
    completions,
    overrides,
    recentlyAssigned,
    kind: 'protocol',
    frequencyDefaults: config.frequencyTargetsByLevel,
  });

  const simPick = pickAsset({
    pool: sims,
    drivingPillar,
    completions,
    overrides,
    recentlyAssigned,
    kind: 'sim',
    frequencyDefaults: config.frequencyTargetsByLevel,
  });

  if (!protocolPick || !simPick) {
    return null; // pool too thin — caller should log + alert admin
  }

  const generatorNotes: string[] = [];
  generatorNotes.push(
    `Driving pillar: ${drivingPillar} (worst-gap from baseline of ${
      pillarRepCounts.composure
    }/${pillarRepCounts.focus}/${pillarRepCounts.decision} composure/focus/decision).`,
  );
  if (protocolPick.coachOverrideId) {
    generatorNotes.push(`Coach override applied for protocol: ${protocolPick.coachOverrideId}`);
  }
  if (simPick.coachOverrideId) {
    generatorNotes.push(`Coach override applied for sim: ${simPick.coachOverrideId}`);
  }

  // Build the two assignment docs (existing schema reused).
  const protocolAssignmentId = `${input.athleteUserId}_${sourceDate}_protocol_${generatedAt}`;
  const simAssignmentId = `${input.athleteUserId}_${sourceDate}_sim_${generatedAt}`;

  const protocolAssignment: Partial<PulseCheckDailyAssignment> = {
    id: protocolAssignmentId,
    lineageId: protocolAssignmentId,
    revision: 1,
    athleteId: input.athleteUserId,
    teamId: input.teamId,
    teamMembershipId: input.teamMembershipId,
    sourceCheckInId: '',
    sourceDate,
    timezone: input.timezone,
    assignedBy: 'curriculum-engine' as PulseCheckDailyAssignment['assignedBy'],
    materializedAt: generatedAt,
    isPrimaryForDate: true,
    status: 'assigned' as PulseCheckDailyAssignment['status'],
    actionType: 'protocol' as PulseCheckDailyAssignment['actionType'],
    chosenCandidateId: protocolPick.asset.id,
    chosenCandidateType: 'protocol' as PulseCheckDailyAssignment['chosenCandidateType'],
    protocolId: protocolPick.asset.id,
    protocolLabel: (protocolPick.asset as PulseCheckProtocolDefinition).label,
    rationale: protocolPick.rationale,
    durationSeconds: (protocolPick.asset as PulseCheckProtocolDefinition).durationSeconds,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };

  const simAssignment: Partial<PulseCheckDailyAssignment> = {
    id: simAssignmentId,
    lineageId: simAssignmentId,
    revision: 1,
    athleteId: input.athleteUserId,
    teamId: input.teamId,
    teamMembershipId: input.teamMembershipId,
    sourceCheckInId: '',
    sourceDate,
    timezone: input.timezone,
    assignedBy: 'curriculum-engine' as PulseCheckDailyAssignment['assignedBy'],
    materializedAt: generatedAt,
    isPrimaryForDate: false,
    status: 'assigned' as PulseCheckDailyAssignment['status'],
    actionType: 'simulation' as PulseCheckDailyAssignment['actionType'],
    chosenCandidateId: simPick.asset.id,
    chosenCandidateType: 'simulation' as PulseCheckDailyAssignment['chosenCandidateType'],
    simSpecId: (simPick.asset as MentalExercise).simSpecId || simPick.asset.id,
    simName: (simPick.asset as MentalExercise).name,
    rationale: simPick.rationale,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };

  const result: CurriculumGenerationResult = {
    athleteUserId: input.athleteUserId,
    sourceDate,
    generatedAt,
    protocolSelection: {
      protocolId: protocolPick.asset.id,
      protocolLabel: (protocolPick.asset as PulseCheckProtocolDefinition).label,
      cognitivePillar: protocolPick.cognitivePillar,
      progressionLevel: protocolPick.progressionLevel,
      drivingPillar,
      rationale: protocolPick.rationale,
      coachOverrideApplied: protocolPick.coachOverrideId,
    },
    simSelection: {
      simId: simPick.asset.id,
      simName: (simPick.asset as MentalExercise).name,
      cognitivePillar: simPick.cognitivePillar,
      progressionLevel: simPick.progressionLevel,
      drivingPillar,
      rationale: simPick.rationale,
      coachOverrideApplied: simPick.coachOverrideId,
    },
    pillarBalanceAtGeneration: pillarRepCounts,
    dailyAssignmentIdProtocol: protocolAssignmentId,
    dailyAssignmentIdSim: simAssignmentId,
    generatorNotes,
  };

  if (input.preview) {
    return result;
  }

  // Persist (best-effort — never throw on a single sub-doc failure).
  const writeBatch: Promise<unknown>[] = [];
  writeBatch.push(
    setDoc(
      doc(collection(db, DAILY_ASSIGNMENTS_COLLECTION), protocolAssignmentId),
      stripUndefinedDeep(protocolAssignment) as Record<string, unknown>,
      { merge: false },
    ),
  );
  writeBatch.push(
    setDoc(
      doc(collection(db, DAILY_ASSIGNMENTS_COLLECTION), simAssignmentId),
      stripUndefinedDeep(simAssignment) as Record<string, unknown>,
      { merge: false },
    ),
  );
  // Write a generation trace for observability.
  const traceId = `${input.athleteUserId}_${sourceDate}_${generatedAt}`;
  writeBatch.push(
    setDoc(
      doc(collection(db, GENERATION_TRACES_COLLECTION), traceId),
      stripUndefinedDeep({
        id: traceId,
        athleteUserId: input.athleteUserId,
        sourceDate,
        generatedAt,
        result,
        configRevisionId: config.revisionId,
      }) as Record<string, unknown>,
      { merge: false },
    ),
  );
  await Promise.all(writeBatch);

  // Mark applied overrides as consumed.
  if (protocolPick.coachOverrideId) {
    try { await markOverrideConsumed(protocolPick.coachOverrideId); } catch { /* swallow */ }
  }
  if (simPick.coachOverrideId) {
    try { await markOverrideConsumed(simPick.coachOverrideId); } catch { /* swallow */ }
  }

  return result;
};

const fetchLast30DaysCompletions = async (
  athleteUserId: string,
  sourceDate: string,
): Promise<CompletionsSnapshot> => {
  const sourceDateMs = Date.UTC(
    parseInt(sourceDate.slice(0, 4), 10),
    parseInt(sourceDate.slice(5, 7), 10) - 1,
    parseInt(sourceDate.slice(8, 10), 10),
  );
  const windowStartMs = sourceDateMs - 30 * 24 * 60 * 60 * 1000;
  const cutoffEpochSec = windowStartMs / 1000;

  const eventsQuery = query(
    collection(db, ASSIGNMENT_EVENTS_COLLECTION),
    where('athleteId', '==', athleteUserId),
    where('eventType', '==', 'completed'),
    where('eventAt', '>=', cutoffEpochSec),
    orderBy('eventAt', 'desc'),
    limit(200),
  );
  const recentAssignmentsQuery = query(
    collection(db, DAILY_ASSIGNMENTS_COLLECTION),
    where('athleteId', '==', athleteUserId),
    orderBy('createdAt', 'desc'),
    limit(20),
  );

  let events: Array<Record<string, unknown>> = [];
  let recentAssignments: Array<Record<string, unknown>> = [];
  try {
    const eventsSnap = await getDocs(eventsQuery);
    events = eventsSnap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate missing index in dev — falls back to empty */
  }
  try {
    const assignmentsSnap = await getDocs(recentAssignmentsQuery);
    recentAssignments = assignmentsSnap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate missing index in dev */
  }

  const byAssetId = new Map<string, number>();
  const byPillar: Record<TaxonomyPillar, number> = {
    [TaxonomyPillar.Composure]: 0,
    [TaxonomyPillar.Focus]: 0,
    [TaxonomyPillar.Decision]: 0,
  };

  for (const ev of events) {
    // Resolve which asset id this event was for. Event docs reference
    // assignment by `assignmentId`; we resolve via assignment lookup at
    // most once per event. For Phase I Part 1 we use the inlined fields
    // when available (chosenCandidateId on event), else skip.
    const assetId = (ev.chosenCandidateId as string | undefined) ||
      (ev.protocolId as string | undefined) ||
      (ev.simSpecId as string | undefined);
    if (assetId) {
      byAssetId.set(assetId, (byAssetId.get(assetId) || 0) + 1);
    }
    const pillarFromEvent = ev.cognitivePillar as TaxonomyPillar | undefined;
    if (pillarFromEvent && byPillar[pillarFromEvent] !== undefined) {
      byPillar[pillarFromEvent] += 1;
    }
  }

  const recentlyAssignedIds = (lookbackDays: number): Set<string> => {
    const cutoff = sourceDateMs - lookbackDays * 24 * 60 * 60 * 1000;
    const set = new Set<string>();
    for (const a of recentAssignments) {
      const created = (a.createdAt as number | undefined) ?? 0;
      const createdMs = created > 1e12 ? created : created * 1000;
      if (createdMs >= cutoff) {
        const id = (a.chosenCandidateId as string | undefined) ||
          (a.protocolId as string | undefined) ||
          (a.simSpecId as string | undefined);
        if (id) set.add(id);
      }
    }
    return set;
  };

  return { byAssetId, byPillar, recentlyAssignedIds };
};

const fetchEligibleProtocols = async (): Promise<PulseCheckProtocolDefinition[]> => {
  try {
    const snap = await getDocs(
      query(
        collection(db, PROTOCOLS_COLLECTION),
        where('publishStatus', '==', 'published'),
        where('isActive', '==', true),
      ),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PulseCheckProtocolDefinition);
  } catch {
    return [];
  }
};

const fetchEligibleSims = async (): Promise<MentalExercise[]> => {
  try {
    const snap = await getDocs(
      query(
        collection(db, SIM_MODULES_COLLECTION),
        where('isActive', '==', true),
      ),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MentalExercise);
  } catch {
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Public service surface
// ──────────────────────────────────────────────────────────────────────────────

export const dailyAssignmentGenerator = {
  generate: generateDailyAssignment,
};

// Internal exports for tests
export const __internal = {
  pickWorstGapPillar,
  countRepsByPillar,
  pickAsset,
  assetPillar,
  assetProgression,
  assetPrerequisites,
};
