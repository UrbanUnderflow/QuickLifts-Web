// =============================================================================
// Pilot Adherence Metrics — computes the four canonical adherence numbers
// the coach report opens with: wearRate7d, noraCheckinCompletion7d,
// protocolOrSimCompletion7d, trainingOrNutritionCoverage7d.
//
// This service replaces the placeholder zeros in the report generator's
// `buildAdherence()`. It reads from the canonical Firestore sources:
//
//   - wearRate7d                    ← `health-context-source-records`
//                                     (count distinct dateKeys with a
//                                     wearable-family record in the window)
//   - noraCheckinCompletion7d        ← `mental-check-ins/{userId}/check-ins`
//                                     (count distinct sourceDate values in window)
//   - protocolOrSimCompletion7d      ← `pulsecheck-daily-assignments`
//                                     (status === 'completed' for protocol or sim)
//   - trainingOrNutritionCoverage7d  ← `mental-check-ins` for sleep/energy
//                                     fields (proxy until FWP/Macra wires real
//                                     training/nutrition session counts)
//
// Per the Pilot Outcome Metrics Contract, the canonical long-term read
// path is the rollups collection. Until that ships, this service computes
// on the fly. Swapping to rollup-read is a 30-line refactor when the
// rollup writer lands — the public surface stays the same.
//
// Confidence policy (per spec):
//   - "Strong read"   : ≥3/4 categories ≥70%
//   - "Usable read"   : ≥2/4 categories ≥70%
//   - "Thin read"     : ≥1/4 categories ≥70%
//   - "Insufficient"  : 0/4 categories ≥70%
// =============================================================================

import { collection, getDocs, query, where, type QueryConstraint } from 'firebase/firestore';
import { db } from './config';

// ──────────────────────────────────────────────────────────────────────────────
// Wearable source families we count toward wearRate. Mirror the canonical
// list in `healthContextSourceRecord.ts`.
// ──────────────────────────────────────────────────────────────────────────────

const WEARABLE_SOURCE_FAMILIES = ['oura', 'apple_health', 'polar', 'whoop', 'garmin'];

const HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION = 'health-context-source-records';
const MENTAL_CHECKINS_ROOT_COLLECTION = 'mental-check-ins';
const MENTAL_CHECKINS_SUBCOLLECTION = 'check-ins';
const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';

// Adherence categories considered "ready" at this fraction or above.
const READY_THRESHOLD = 0.7;

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

export interface AdherenceWindow {
  startDateKey: string; // YYYY-MM-DD
  endDateKey: string;   // YYYY-MM-DD
  expectedDays: number; // typically 7
}

export interface AthleteAdherenceWindow {
  athleteUserId: string;
  window: AdherenceWindow;
  wearRate: number;
  noraCheckinCompletion: number;
  protocolOrSimCompletion: number;
  trainingOrNutritionCoverage: number;
  /** Number of categories at or above READY_THRESHOLD (0–4). */
  categoriesReady: number;
  confidenceLabel: AdherenceConfidenceLabel;
}

export interface TeamAdherenceSummary {
  teamId: string;
  window: AdherenceWindow;
  wearRate: number;
  noraCheckinCompletion: number;
  protocolOrSimCompletion: number;
  trainingOrNutritionCoverage: number;
  categoriesReady: number;
  confidenceLabel: AdherenceConfidenceLabel;
  /** Per-athlete breakdown for the reviewer pane. */
  athletes: AthleteAdherenceWindow[];
  athleteCount: number;
}

export type AdherenceConfidenceLabel = 'Strong read' | 'Usable read' | 'Thin read' | 'Insufficient';

// ──────────────────────────────────────────────────────────────────────────────
// Window helpers
// ──────────────────────────────────────────────────────────────────────────────

const requireString = (value: unknown, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[PilotAdherenceMetrics] ${label} is required.`);
  }
  return normalized;
};

const dateKeyToUnixSeconds = (dateKey: string, endOfDay = false): number => {
  const isoSuffix = endOfDay ? 'T23:59:59Z' : 'T00:00:00Z';
  const ms = new Date(`${dateKey}${isoSuffix}`).getTime();
  if (!Number.isFinite(ms)) {
    throw new Error(`[PilotAdherenceMetrics] Invalid date key: "${dateKey}"`);
  }
  return Math.round(ms / 1000);
};

export const buildSevenDayWindow = (endDateKey: string): AdherenceWindow => {
  const end = new Date(`${requireString(endDateKey, 'endDateKey')}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) {
    throw new Error(`[PilotAdherenceMetrics] Invalid endDateKey: "${endDateKey}"`);
  }
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  return {
    startDateKey: start.toISOString().slice(0, 10),
    endDateKey: end.toISOString().slice(0, 10),
    expectedDays: 7,
  };
};

const isoDateKeysInWindow = (window: AdherenceWindow): Set<string> => {
  const out = new Set<string>();
  let current = new Date(`${window.startDateKey}T00:00:00Z`);
  const end = new Date(`${window.endDateKey}T00:00:00Z`);
  while (current.getTime() <= end.getTime()) {
    out.add(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
};

const recordObservedAtToDateKey = (observedAt: number, timezone?: string): string => {
  // observedAt is unix seconds; we treat it as UTC for the day key. Timezone
  // refinement (athlete-local day boundaries) is a future iteration.
  const date = new Date(observedAt * 1000);
  return date.toISOString().slice(0, 10);
};

// ──────────────────────────────────────────────────────────────────────────────
// Pure helpers (testable in isolation)
// ──────────────────────────────────────────────────────────────────────────────

export const ratioReady = (ratio: number): boolean => ratio >= READY_THRESHOLD;

export const countReadyCategories = (a: {
  wearRate: number;
  noraCheckinCompletion: number;
  protocolOrSimCompletion: number;
  trainingOrNutritionCoverage: number;
}): number => {
  let count = 0;
  if (ratioReady(a.wearRate)) count += 1;
  if (ratioReady(a.noraCheckinCompletion)) count += 1;
  if (ratioReady(a.protocolOrSimCompletion)) count += 1;
  if (ratioReady(a.trainingOrNutritionCoverage)) count += 1;
  return count;
};

export const confidenceLabelFromAdherence = (categoriesReady: number): AdherenceConfidenceLabel => {
  if (categoriesReady >= 3) return 'Strong read';
  if (categoriesReady >= 2) return 'Usable read';
  if (categoriesReady >= 1) return 'Thin read';
  return 'Insufficient';
};

export const meanRatio = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
  return sum / values.length;
};

// ──────────────────────────────────────────────────────────────────────────────
// Firestore queries
// ──────────────────────────────────────────────────────────────────────────────

const countDistinctWearDays = async (
  athleteUserId: string,
  window: AdherenceWindow,
): Promise<number> => {
  const startSec = dateKeyToUnixSeconds(window.startDateKey);
  const endSec = dateKeyToUnixSeconds(window.endDateKey, true);
  const constraints: QueryConstraint[] = [
    where('athleteUserId', '==', athleteUserId),
    where('observedAt', '>=', startSec),
    where('observedAt', '<=', endSec),
    where('sourceFamily', 'in', WEARABLE_SOURCE_FAMILIES),
    where('status', '==', 'active'),
  ];
  const snap = await getDocs(query(collection(db, HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION), ...constraints));
  const days = new Set<string>();
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const observedAt = Number(data.observedAt);
    if (!Number.isFinite(observedAt)) continue;
    days.add(recordObservedAtToDateKey(observedAt, typeof data.timezone === 'string' ? data.timezone : undefined));
  }
  return days.size;
};

const countDistinctNoraCheckinDays = async (
  athleteUserId: string,
  window: AdherenceWindow,
): Promise<{ totalDays: number; coveredCategories: { sleep: number; energy: number } }> => {
  const checkinsRef = collection(
    db,
    MENTAL_CHECKINS_ROOT_COLLECTION,
    athleteUserId,
    MENTAL_CHECKINS_SUBCOLLECTION,
  );
  const snap = await getDocs(checkinsRef);
  const checkinDays = new Set<string>();
  let sleepDays = 0;
  let energyDays = 0;
  const inWindow = isoDateKeysInWindow(window);
  const seenDateKeysForSleep = new Set<string>();
  const seenDateKeysForEnergy = new Set<string>();
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const sourceDate = String(data.sourceDate || '').trim();
    if (!sourceDate || !inWindow.has(sourceDate)) continue;
    checkinDays.add(sourceDate);
    if (typeof data.sleepQuality === 'number' && !seenDateKeysForSleep.has(sourceDate)) {
      seenDateKeysForSleep.add(sourceDate);
      sleepDays += 1;
    }
    if (typeof data.energyLevel === 'number' && !seenDateKeysForEnergy.has(sourceDate)) {
      seenDateKeysForEnergy.add(sourceDate);
      energyDays += 1;
    }
  }
  return {
    totalDays: checkinDays.size,
    coveredCategories: { sleep: sleepDays, energy: energyDays },
  };
};

const countCompletedAssignments = async (
  athleteUserId: string,
  window: AdherenceWindow,
): Promise<{ assignedCount: number; completedCount: number }> => {
  const inWindow = isoDateKeysInWindow(window);
  const constraints: QueryConstraint[] = [
    where('athleteId', '==', athleteUserId),
    where('sourceDate', '>=', window.startDateKey),
    where('sourceDate', '<=', window.endDateKey),
  ];
  const snap = await getDocs(query(collection(db, DAILY_ASSIGNMENTS_COLLECTION), ...constraints));
  let assigned = 0;
  let completed = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const sourceDate = String(data.sourceDate || '').trim();
    if (!sourceDate || !inWindow.has(sourceDate)) continue;
    const actionType = String(data.actionType || '').trim();
    if (actionType !== 'protocol' && actionType !== 'sim' && actionType !== 'lighter_sim') {
      continue;
    }
    assigned += 1;
    if (String(data.status || '').trim() === 'completed') {
      completed += 1;
    }
  }
  return { assignedCount: assigned, completedCount: completed };
};

// ──────────────────────────────────────────────────────────────────────────────
// Public entry — per-athlete + team aggregation
// ──────────────────────────────────────────────────────────────────────────────

export const computeAthleteAdherence = async (
  athleteUserId: string,
  window: AdherenceWindow,
): Promise<AthleteAdherenceWindow> => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const expectedDays = Math.max(1, Math.min(window.expectedDays, 31));

  const [wearDays, noraResult, assignmentResult] = await Promise.all([
    countDistinctWearDays(scopedAthleteId, window),
    countDistinctNoraCheckinDays(scopedAthleteId, window),
    countCompletedAssignments(scopedAthleteId, window),
  ]);

  const wearRate = wearDays / expectedDays;
  const noraCheckinCompletion = noraResult.totalDays / expectedDays;
  const protocolOrSimCompletion =
    assignmentResult.assignedCount > 0
      ? assignmentResult.completedCount / assignmentResult.assignedCount
      : 0;
  // Until FWP training + Macra nutrition are wired through HCSR, we proxy
  // training/nutrition coverage with the daily-checkin sleep+energy
  // self-report coverage. Reviewer surface flags this explicitly.
  const trainingOrNutritionCoverage =
    Math.max(noraResult.coveredCategories.sleep, noraResult.coveredCategories.energy) / expectedDays;

  const categoriesReady = countReadyCategories({
    wearRate,
    noraCheckinCompletion,
    protocolOrSimCompletion,
    trainingOrNutritionCoverage,
  });

  return {
    athleteUserId: scopedAthleteId,
    window,
    wearRate,
    noraCheckinCompletion,
    protocolOrSimCompletion,
    trainingOrNutritionCoverage,
    categoriesReady,
    confidenceLabel: confidenceLabelFromAdherence(categoriesReady),
  };
};

export interface TeamAdherenceInput {
  teamId: string;
  athleteUserIds: string[];
  endDateKey: string;
}

export const computeTeamAdherenceSummary = async (
  input: TeamAdherenceInput,
): Promise<TeamAdherenceSummary> => {
  const teamId = requireString(input.teamId, 'teamId');
  const window = buildSevenDayWindow(input.endDateKey);
  const athleteIds = (input.athleteUserIds || []).map((id) => requireString(id, 'athleteUserId'));

  if (athleteIds.length === 0) {
    return {
      teamId,
      window,
      wearRate: 0,
      noraCheckinCompletion: 0,
      protocolOrSimCompletion: 0,
      trainingOrNutritionCoverage: 0,
      categoriesReady: 0,
      confidenceLabel: 'Insufficient',
      athletes: [],
      athleteCount: 0,
    };
  }

  const athletes = await Promise.all(
    athleteIds.map((athleteUserId) => computeAthleteAdherence(athleteUserId, window)),
  );

  const wearRate = meanRatio(athletes.map((a) => a.wearRate));
  const noraCheckinCompletion = meanRatio(athletes.map((a) => a.noraCheckinCompletion));
  const protocolOrSimCompletion = meanRatio(athletes.map((a) => a.protocolOrSimCompletion));
  const trainingOrNutritionCoverage = meanRatio(athletes.map((a) => a.trainingOrNutritionCoverage));

  const categoriesReady = countReadyCategories({
    wearRate,
    noraCheckinCompletion,
    protocolOrSimCompletion,
    trainingOrNutritionCoverage,
  });

  return {
    teamId,
    window,
    wearRate,
    noraCheckinCompletion,
    protocolOrSimCompletion,
    trainingOrNutritionCoverage,
    categoriesReady,
    confidenceLabel: confidenceLabelFromAdherence(categoriesReady),
    athletes,
    athleteCount: athletes.length,
  };
};

export const pilotAdherenceMetricsService = {
  buildSevenDayWindow,
  computeAthleteAdherence,
  computeTeamAdherenceSummary,
  ratioReady,
  countReadyCategories,
  confidenceLabelFromAdherence,
  meanRatio,
};
