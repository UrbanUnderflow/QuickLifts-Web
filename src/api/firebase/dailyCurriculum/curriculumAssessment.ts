// =============================================================================
// Curriculum Assessment — monthly rollup of athlete adherence + pillar balance.
//
// Doctrine: every 30 days we assess what the athlete actually completed
// vs the recommended cadence. The output flows to coach reports + admin
// surfaces; it never goes to the athlete in raw form (rep counts are
// behavioral data, OK to surface to athletes per Athlete Surface
// Doctrine — but only via translated summaries, not the raw rollup doc).
//
// Coach-visible rollup includes: per-pillar gap, per-protocol/sim rep
// counts, total adherence rate (assigned vs completed), longest streak.
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
} from 'firebase/firestore';
import { db } from '../config';
import { TaxonomyPillar } from '../mentaltraining/taxonomy';
import {
  CurriculumAssessment,
  CURRICULUM_ASSESSMENTS_COLLECTION,
  ProgressionLevel,
  resolveFrequency,
  yearMonthOf,
} from './types';
import { getOrInitCurriculumConfig } from './curriculumConfig';

const ASSIGNMENT_EVENTS_COLLECTION = 'pulsecheck-assignment-events';
const PROTOCOLS_COLLECTION = 'pulsecheck-protocols';
const SIM_MODULES_COLLECTION = 'sim-modules';
const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';

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

interface RunAssessmentInput {
  athleteUserId: string;
  /** Month to assess (YYYY-MM). Defaults to last month UTC. */
  yearMonth?: string;
  /** If true, computes the assessment but does not persist. Used by admin
   *  preview tool. */
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

export const runCurriculumAssessment = async (
  input: RunAssessmentInput,
): Promise<CurriculumAssessment | null> => {
  const yearMonth = input.yearMonth || lastMonthUtc();
  const { startMs, endMs, startKey, endKey } = monthBoundsUtc(yearMonth);
  const config = await getOrInitCurriculumConfig();
  const generatedAt = Date.now();

  const startEpochSec = startMs / 1000;
  const endEpochSec = endMs / 1000;

  // Pull events + assignments in window.
  const eventsQ = query(
    collection(db, ASSIGNMENT_EVENTS_COLLECTION),
    where('athleteId', '==', input.athleteUserId),
    where('eventAt', '>=', startEpochSec),
    where('eventAt', '<=', endEpochSec),
    orderBy('eventAt', 'asc'),
    limit(1000),
  );
  const assignmentsQ = query(
    collection(db, DAILY_ASSIGNMENTS_COLLECTION),
    where('athleteId', '==', input.athleteUserId),
    where('sourceDate', '>=', startKey),
    where('sourceDate', '<=', endKey),
    orderBy('sourceDate', 'asc'),
    limit(500),
  );

  let events: Array<Record<string, unknown>> = [];
  let assignments: Array<Record<string, unknown>> = [];
  try {
    const snap = await getDocs(eventsQ);
    events = snap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate missing index in dev */
  }
  try {
    const snap = await getDocs(assignmentsQ);
    assignments = snap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate */
  }

  // Pull protocol + sim metadata to resolve pillar / progression / target.
  const [protocols, sims] = await Promise.all([
    getDocs(query(collection(db, PROTOCOLS_COLLECTION), where('isActive', '==', true)))
      .then((s) => s.docs.map((d) => d.data() as Record<string, unknown>))
      .catch(() => [] as Array<Record<string, unknown>>),
    getDocs(query(collection(db, SIM_MODULES_COLLECTION), where('isActive', '==', true)))
      .then((s) => s.docs.map((d) => d.data() as Record<string, unknown>))
      .catch(() => [] as Array<Record<string, unknown>>),
  ]);
  const protocolById = new Map(protocols.map((p) => [p.id as string, p]));
  const simById = new Map(sims.map((s) => [s.id as string, s]));

  // Tally completions per asset.
  const completedByAssetId = new Map<string, number>();
  let completedCount = 0;
  let assignedCount = assignments.length;
  for (const ev of events) {
    if (ev.eventType !== 'completed') continue;
    completedCount += 1;
    const assetId =
      (ev.chosenCandidateId as string | undefined) ||
      (ev.protocolId as string | undefined) ||
      (ev.simSpecId as string | undefined);
    if (assetId) completedByAssetId.set(assetId, (completedByAssetId.get(assetId) || 0) + 1);
  }

  // Build per-asset rep counts + reps-by-pillar.
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

  // Compute targets per pillar and gaps.
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

  // Compute longest streak (consecutive days with at least one completion).
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

  await setDoc(
    doc(collection(db, CURRICULUM_ASSESSMENTS_COLLECTION), id),
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

export const curriculumAssessmentService = {
  run: runCurriculumAssessment,
};
