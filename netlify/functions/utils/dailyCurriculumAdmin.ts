import type * as FirebaseAdmin from 'firebase-admin';
import type {
  MentalExercise,
  PulseCheckDailyAssignment,
  PulseCheckProtocolDefinition,
} from '../../../src/api/firebase/mentaltraining/types';
import { TaxonomyPillar } from '../../../src/api/firebase/mentaltraining/taxonomy';
import {
  CURRICULUM_ASSESSMENTS_COLLECTION,
  CURRICULUM_CONFIG_COLLECTION,
  CURRICULUM_CONFIG_SINGLETON_ID,
  CURRICULUM_OVERRIDES_COLLECTION,
  CurriculumAssessment,
  CurriculumConfig,
  CurriculumGenerationResult,
  CurriculumOverride,
  DEFAULT_FREQUENCY_PER_30_DAYS,
  DEFAULT_NOTIFICATION_CADENCE,
  EQUAL_PILLAR_WEIGHTS,
  ProgressionLevel,
  resolveFrequency,
  yearMonthOf,
} from '../../../src/api/firebase/dailyCurriculum/types';
import {
  CompletionsSnapshot,
  countRepsByPillar,
  pickAsset,
  pickWorstGapPillar,
} from '../../../src/api/firebase/dailyCurriculum/selection';

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

const buildDefaultCurriculumConfig = (): CurriculumConfig => {
  const now = Date.now();
  const revisionId = `r-${new Date(now).toISOString().slice(0, 10)}-default`;
  return {
    id: CURRICULUM_CONFIG_SINGLETON_ID,
    defaultPillarWeights: { ...EQUAL_PILLAR_WEIGHTS },
    pillarWeightsBySport: {},
    frequencyTargetsByLevel: { ...DEFAULT_FREQUENCY_PER_30_DAYS },
    notificationCadence: { ...DEFAULT_NOTIFICATION_CADENCE },
    engineEnabled: true,
    revisionId,
    revisionLog: [
      {
        revisionId,
        changedAt: now,
        summary: 'Default curriculum config seeded.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

export const getOrInitCurriculumConfigAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
): Promise<CurriculumConfig> => {
  const ref = db.collection(CURRICULUM_CONFIG_COLLECTION).doc(CURRICULUM_CONFIG_SINGLETON_ID);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as CurriculumConfig;
  const defaults = buildDefaultCurriculumConfig();
  await ref.set(stripUndefinedDeep(defaults) as Record<string, unknown>, { merge: false });
  return defaults;
};

const resolvePillarWeightsForSportAdmin = (config: CurriculumConfig, sportId?: string) => {
  if (sportId && config.pillarWeightsBySport && config.pillarWeightsBySport[sportId]) {
    return config.pillarWeightsBySport[sportId];
  }
  return config.defaultPillarWeights;
};

export interface GenerateDailyAssignmentAdminInput {
  athleteUserId: string;
  teamId: string;
  teamMembershipId: string;
  sportId?: string;
  sourceDate?: string;
  timezone?: string;
  preview?: boolean;
}

export const generateDailyAssignmentAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
  input: GenerateDailyAssignmentAdminInput,
): Promise<CurriculumGenerationResult | null> => {
  const config = await getOrInitCurriculumConfigAdmin(db);
  if (!config.engineEnabled) return null;

  const sourceDate = input.sourceDate || dateKey(new Date());
  const yearMonth = yearMonthOf(sourceDate);
  const generatedAt = Date.now();

  const [protocols, sims, completions, overrides] = await Promise.all([
    fetchEligibleProtocolsAdmin(db),
    fetchEligibleSimsAdmin(db),
    fetchLast30DaysCompletionsAdmin(db, input.athleteUserId, sourceDate),
    listOverridesForAthleteAdmin(db, input.athleteUserId, yearMonth),
  ]);

  const pillarRepCounts = countRepsByPillar(completions, protocols, sims);
  const recentlyAssigned = completions.recentlyAssignedIds(2);
  const pillarWeights = resolvePillarWeightsForSportAdmin(config, input.sportId);
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

  if (!protocolPick || !simPick) return null;

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
    assignedBy: 'curriculum-engine',
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
    assignedBy: 'curriculum-engine',
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

  if (input.preview) return result;

  const traceId = `${input.athleteUserId}_${sourceDate}_${generatedAt}`;
  await Promise.all([
    db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(protocolAssignmentId).set(
      stripUndefinedDeep(protocolAssignment) as Record<string, unknown>,
      { merge: false },
    ),
    db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(simAssignmentId).set(
      stripUndefinedDeep(simAssignment) as Record<string, unknown>,
      { merge: false },
    ),
    db.collection(GENERATION_TRACES_COLLECTION).doc(traceId).set(
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
  ]);

  if (protocolPick.coachOverrideId) {
    try { await markOverrideConsumedAdmin(db, protocolPick.coachOverrideId); } catch { /* swallow */ }
  }
  if (simPick.coachOverrideId) {
    try { await markOverrideConsumedAdmin(db, simPick.coachOverrideId); } catch { /* swallow */ }
  }

  return result;
};

const fetchLast30DaysCompletionsAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
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

  let events: Array<Record<string, unknown>> = [];
  let recentAssignments: Array<Record<string, unknown>> = [];
  try {
    const snap = await db
      .collection(ASSIGNMENT_EVENTS_COLLECTION)
      .where('athleteId', '==', athleteUserId)
      .where('eventType', '==', 'completed')
      .where('eventAt', '>=', cutoffEpochSec)
      .orderBy('eventAt', 'desc')
      .limit(200)
      .get();
    events = snap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate missing index in dev */
  }
  try {
    const snap = await db
      .collection(DAILY_ASSIGNMENTS_COLLECTION)
      .where('athleteId', '==', athleteUserId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    recentAssignments = snap.docs.map((d) => d.data() as Record<string, unknown>);
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
    const assetId = (ev.chosenCandidateId as string | undefined) ||
      (ev.protocolId as string | undefined) ||
      (ev.simSpecId as string | undefined);
    if (assetId) byAssetId.set(assetId, (byAssetId.get(assetId) || 0) + 1);
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

const fetchEligibleProtocolsAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
): Promise<PulseCheckProtocolDefinition[]> => {
  try {
    const snap = await db
      .collection(PROTOCOLS_COLLECTION)
      .where('publishStatus', '==', 'published')
      .where('isActive', '==', true)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PulseCheckProtocolDefinition);
  } catch {
    return [];
  }
};

const fetchEligibleSimsAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
): Promise<MentalExercise[]> => {
  try {
    const snap = await db.collection(SIM_MODULES_COLLECTION).where('isActive', '==', true).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MentalExercise);
  } catch {
    return [];
  }
};

const listOverridesForAthleteAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
  athleteUserId: string,
  yearMonth: string,
): Promise<CurriculumOverride[]> => {
  const snap = await db
    .collection(CURRICULUM_OVERRIDES_COLLECTION)
    .where('athleteUserId', '==', athleteUserId)
    .where('yearMonth', '==', yearMonth)
    .where('status', '==', 'active')
    .get();
  return snap.docs.map((d) => ({ ...(d.data() as CurriculumOverride), id: d.id }));
};

const markOverrideConsumedAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
  overrideId: string,
): Promise<void> => {
  await db.collection(CURRICULUM_OVERRIDES_COLLECTION).doc(overrideId).set(
    { status: 'consumed', updatedAt: Date.now() },
    { merge: true },
  );
};

export interface RunCurriculumAssessmentAdminInput {
  athleteUserId: string;
  yearMonth?: string;
  preview?: boolean;
}

const lastMonthUtc = (): string => {
  const now = new Date();
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return yearMonthOf(last);
};

const monthBoundsUtc = (yearMonth: string): { startMs: number; endMs: number; startKey: string; endKey: string } => {
  const [y, m] = yearMonth.split('-').map((s) => parseInt(s, 10));
  const startMs = Date.UTC(y, m - 1, 1);
  const endMs = Date.UTC(y, m, 1) - 1;
  return {
    startMs,
    endMs,
    startKey: dateKey(new Date(startMs)),
    endKey: dateKey(new Date(endMs)),
  };
};

export const runCurriculumAssessmentAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
  input: RunCurriculumAssessmentAdminInput,
): Promise<CurriculumAssessment | null> => {
  const yearMonth = input.yearMonth || lastMonthUtc();
  const { startMs, endMs, startKey, endKey } = monthBoundsUtc(yearMonth);
  const config = await getOrInitCurriculumConfigAdmin(db);
  const generatedAt = Date.now();

  const startEpochSec = startMs / 1000;
  const endEpochSec = endMs / 1000;

  let events: Array<Record<string, unknown>> = [];
  let assignments: Array<Record<string, unknown>> = [];
  try {
    const snap = await db
      .collection(ASSIGNMENT_EVENTS_COLLECTION)
      .where('athleteId', '==', input.athleteUserId)
      .where('eventAt', '>=', startEpochSec)
      .where('eventAt', '<=', endEpochSec)
      .orderBy('eventAt', 'asc')
      .limit(1000)
      .get();
    events = snap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate missing index in dev */
  }
  try {
    const snap = await db
      .collection(DAILY_ASSIGNMENTS_COLLECTION)
      .where('athleteId', '==', input.athleteUserId)
      .where('sourceDate', '>=', startKey)
      .where('sourceDate', '<=', endKey)
      .orderBy('sourceDate', 'asc')
      .limit(500)
      .get();
    assignments = snap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate */
  }

  const [protocols, sims] = await Promise.all([
    db.collection(PROTOCOLS_COLLECTION).where('isActive', '==', true).get()
      .then((s) => s.docs.map((d) => d.data() as Record<string, unknown>))
      .catch(() => [] as Array<Record<string, unknown>>),
    db.collection(SIM_MODULES_COLLECTION).where('isActive', '==', true).get()
      .then((s) => s.docs.map((d) => d.data() as Record<string, unknown>))
      .catch(() => [] as Array<Record<string, unknown>>),
  ]);
  const protocolById = new Map(protocols.map((p) => [p.id as string, p]));
  const simById = new Map(sims.map((s) => [s.id as string, s]));

  const completedByAssetId = new Map<string, number>();
  let completedCount = 0;
  const assignedCount = assignments.length;
  for (const ev of events) {
    if (ev.eventType !== 'completed') continue;
    completedCount += 1;
    const assetId =
      (ev.chosenCandidateId as string | undefined) ||
      (ev.protocolId as string | undefined) ||
      (ev.simSpecId as string | undefined);
    if (assetId) completedByAssetId.set(assetId, (completedByAssetId.get(assetId) || 0) + 1);
  }

  const repsByPillar: Record<TaxonomyPillar, number> = {
    [TaxonomyPillar.Composure]: 0,
    [TaxonomyPillar.Focus]: 0,
    [TaxonomyPillar.Decision]: 0,
  };
  const protocolRepCounts: CurriculumAssessment['protocolRepCounts'] = [];
  const simRepCounts: CurriculumAssessment['simRepCounts'] = [];

  const resolvePillar = (asset: Record<string, unknown>): TaxonomyPillar | undefined => {
    const cog = asset.cognitivePillar as TaxonomyPillar | undefined;
    if (cog) return cog;
    const tax = asset.taxonomy as { primaryPillar?: TaxonomyPillar } | undefined;
    return tax?.primaryPillar;
  };
  const resolveProgression = (asset: Record<string, unknown>): ProgressionLevel =>
    (asset.progressionLevel as ProgressionLevel | undefined) || 'foundational';

  for (const [assetId, reps] of completedByAssetId.entries()) {
    if (protocolById.has(assetId)) {
      const p = protocolById.get(assetId)!;
      const pillar = resolvePillar(p);
      const progression = resolveProgression(p);
      const recommended = resolveFrequency(
        {
          recommendedFrequencyPer30Days: p.recommendedFrequencyPer30Days as number | undefined,
          progressionLevel: progression,
        },
        config.frequencyTargetsByLevel,
      );
      if (pillar) repsByPillar[pillar] += reps;
      protocolRepCounts.push({
        protocolId: assetId,
        protocolLabel: (p.label as string) || assetId,
        cognitivePillar: pillar || TaxonomyPillar.Composure,
        progressionLevel: progression,
        recommendedFrequencyPer30Days: recommended,
        actualReps: reps,
        gap: recommended - reps,
      });
    } else if (simById.has(assetId)) {
      const s = simById.get(assetId)!;
      const pillar = resolvePillar(s);
      const progression = resolveProgression(s);
      const recommended = resolveFrequency(
        {
          recommendedFrequencyPer30Days: s.recommendedFrequencyPer30Days as number | undefined,
          progressionLevel: progression,
        },
        config.frequencyTargetsByLevel,
      );
      if (pillar) repsByPillar[pillar] += reps;
      simRepCounts.push({
        simId: assetId,
        simName: (s.name as string) || assetId,
        cognitivePillar: pillar || TaxonomyPillar.Focus,
        progressionLevel: progression,
        recommendedFrequencyPer30Days: recommended,
        actualReps: reps,
        gap: recommended - reps,
      });
    }
  }

  const baseTarget = config.frequencyTargetsByLevel.foundational;
  const totalWeight =
    config.defaultPillarWeights.composure +
    config.defaultPillarWeights.focus +
    config.defaultPillarWeights.decision;
  const norm = (v: number) => (totalWeight > 0 ? v / totalWeight : 1 / 3);
  const targetByPillar: Record<TaxonomyPillar, number> = {
    [TaxonomyPillar.Composure]: norm(config.defaultPillarWeights.composure) * baseTarget * 3,
    [TaxonomyPillar.Focus]: norm(config.defaultPillarWeights.focus) * baseTarget * 3,
    [TaxonomyPillar.Decision]: norm(config.defaultPillarWeights.decision) * baseTarget * 3,
  };
  const gapByPillar: Record<TaxonomyPillar, number> = {
    [TaxonomyPillar.Composure]: targetByPillar[TaxonomyPillar.Composure] - repsByPillar[TaxonomyPillar.Composure],
    [TaxonomyPillar.Focus]: targetByPillar[TaxonomyPillar.Focus] - repsByPillar[TaxonomyPillar.Focus],
    [TaxonomyPillar.Decision]: targetByPillar[TaxonomyPillar.Decision] - repsByPillar[TaxonomyPillar.Decision],
  };
  const ranked = (Object.entries(gapByPillar) as Array<[TaxonomyPillar, number]>).sort((a, b) => b[1] - a[1]);
  const worstGapPillar = ranked[0][0];

  const completedDayKeys = new Set<string>();
  for (const ev of events) {
    if (ev.eventType !== 'completed') continue;
    const evAt = ev.eventAt as number | undefined;
    if (!evAt) continue;
    const ms = evAt > 1e12 ? evAt : evAt * 1000;
    completedDayKeys.add(dateKey(new Date(ms)));
  }
  let longestStreak = 0;
  let currentStreak = 0;
  for (let ms = startMs; ms <= endMs; ms += 24 * 60 * 60 * 1000) {
    const k = dateKey(new Date(ms));
    if (completedDayKeys.has(k)) {
      currentStreak += 1;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  const adherenceRate = assignedCount > 0 ? completedCount / assignedCount : 0;
  const reviewerNote = buildReviewerNote(
    repsByPillar,
    targetByPillar,
    gapByPillar,
    worstGapPillar,
    adherenceRate,
    longestStreak,
  );

  const id = `${input.athleteUserId}_${yearMonth}`;
  const assessment: CurriculumAssessment = {
    id,
    athleteUserId: input.athleteUserId,
    yearMonth,
    windowStart: startKey,
    windowEnd: endKey,
    repsByPillar,
    targetByPillar,
    gapByPillar,
    worstGapPillar,
    protocolRepCounts: protocolRepCounts.sort((a, b) => b.gap - a.gap),
    simRepCounts: simRepCounts.sort((a, b) => b.gap - a.gap),
    totalAssignmentsAssigned: assignedCount,
    totalAssignmentsCompleted: completedCount,
    adherenceRate,
    longestStreakDays: longestStreak,
    reviewerNote,
    generatedAt,
    generatorRevision: config.revisionId,
  };

  if (input.preview) return assessment;

  await db.collection(CURRICULUM_ASSESSMENTS_COLLECTION).doc(id).set(
    stripUndefinedDeep(assessment) as Record<string, unknown>,
    { merge: false },
  );
  return assessment;
};

const buildReviewerNote = (
  reps: Record<TaxonomyPillar, number>,
  targets: Record<TaxonomyPillar, number>,
  gaps: Record<TaxonomyPillar, number>,
  worstGapPillar: TaxonomyPillar,
  adherenceRate: number,
  longestStreak: number,
): string => {
  const adhPct = Math.round(adherenceRate * 100);
  const round = (v: number) => Math.round(v);
  const worstGap = Math.round(gaps[worstGapPillar]);
  const lines: string[] = [];
  lines.push(
    `Adherence ${adhPct}% (${longestStreak}-day streak). Pillar reps: composure ${
      round(reps[TaxonomyPillar.Composure])
    }/${round(targets[TaxonomyPillar.Composure])}, focus ${round(reps[TaxonomyPillar.Focus])}/${
      round(targets[TaxonomyPillar.Focus])
    }, decision ${round(reps[TaxonomyPillar.Decision])}/${round(targets[TaxonomyPillar.Decision])}.`,
  );
  if (worstGap > 0) {
    lines.push(
      `Most-underrepped pillar: ${worstGapPillar} (${worstGap} reps short). Engine will bias next month toward ${worstGapPillar}.`,
    );
  } else {
    lines.push(`All pillars at or above target this month.`);
  }
  return lines.join(' ');
};
