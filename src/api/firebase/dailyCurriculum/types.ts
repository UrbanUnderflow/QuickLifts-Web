// =============================================================================
// Daily Curriculum Layer — Phase I types.
//
// Doctrine: athletes build automaticity through spaced repetition. Every
// athlete gets 1 protocol + 1 simulation per day, selected by a generator
// that balances composure / focus / decisioning rep history. This is the
// PROACTIVE layer that runs in parallel with the reactive Adaptation
// Framing Layer.
//
// Reuses existing infrastructure:
//   - `pulsecheck-daily-assignments` collection (writes there, with
//     `assignedBy: 'curriculum-engine'` to distinguish from coach-authored)
//   - `pulsecheck-assignment-events` collection (lifecycle events)
//   - `TaxonomyPillar` enum (composure / focus / decision)
//
// New collections owned by this layer:
//   - `pulsecheck-curriculum-config` — singleton + per-sport overrides
//   - `pulsecheck-curriculum-assessments` — 30-day rollup per athlete per
//     yyyy-mm window
//   - `pulsecheck-curriculum-overrides` — coach pin: "athlete X focuses on
//     protocol Y this month"
//
// Schema additions to existing collections (handled separately in
// mentaltraining/types.ts):
//   - PulseCheckProtocolDefinition + MentalExercise gain:
//     `cognitivePillar` (TaxonomyPillar)
//     `recommendedFrequencyPer30Days` (number)
//     `progressionLevel` ('foundational' | 'intermediate' | 'advanced')
//     `prerequisitePillarReps` (Partial<Record<TaxonomyPillar, number>>)
// =============================================================================

import { TaxonomyPillar } from '../mentaltraining/taxonomy';

// ──────────────────────────────────────────────────────────────────────────────
// Collection constants
// ──────────────────────────────────────────────────────────────────────────────

export const CURRICULUM_CONFIG_COLLECTION = 'pulsecheck-curriculum-config';
export const CURRICULUM_ASSESSMENTS_COLLECTION = 'pulsecheck-curriculum-assessments';
export const CURRICULUM_OVERRIDES_COLLECTION = 'pulsecheck-curriculum-overrides';

/** Singleton id for the global config doc. */
export const CURRICULUM_CONFIG_SINGLETON_ID = 'current';

// ──────────────────────────────────────────────────────────────────────────────
// Progression model
// ──────────────────────────────────────────────────────────────────────────────

export type ProgressionLevel = 'foundational' | 'intermediate' | 'advanced';

export const PROGRESSION_LEVELS: ProgressionLevel[] = [
  'foundational',
  'intermediate',
  'advanced',
];

/**
 * Default rep targets per 30-day window, by progression level. Used as the
 * fallback when a protocol/sim doesn't carry an explicit
 * `recommendedFrequencyPer30Days` field. Operator-tunable in
 * pulsecheck-curriculum-config.
 *
 * Foundational protocols (box breathing, 4-7-8 breath, basic body scan)
 * need the most reps — they're the building blocks of automaticity.
 * Intermediate protocols layer on top. Advanced protocols are sparingly
 * used — they're situational, not foundational.
 */
export const DEFAULT_FREQUENCY_PER_30_DAYS: Record<ProgressionLevel, number> = {
  foundational: 12,
  intermediate: 8,
  advanced: 4,
};

// ──────────────────────────────────────────────────────────────────────────────
// Curriculum schema additions for protocols + sims
// (Re-exported from mentaltraining/types.ts; kept here as the doctrine
// reference so anyone reading curriculum code sees the contract.)
// ──────────────────────────────────────────────────────────────────────────────

export interface CurriculumMetadata {
  /** Which cognitive pillar this asset trains. */
  cognitivePillar: TaxonomyPillar;
  /** Recommended reps in a 30-day window. Falls back to
   *  DEFAULT_FREQUENCY_PER_30_DAYS[progressionLevel] if absent. */
  recommendedFrequencyPer30Days?: number;
  /** Progression level — gates which protocols can be assigned before
   *  prerequisite pillar reps are met. */
  progressionLevel: ProgressionLevel;
  /** Per-pillar prerequisite rep counts. Only matters for intermediate +
   *  advanced. Example: a sport-specific advanced sim may require 8 focus
   *  reps + 5 composure reps before it becomes assignable. */
  prerequisitePillarReps?: Partial<Record<TaxonomyPillar, number>>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Pillar weights (per-sport optional override)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Equal default — composure 33 / focus 33 / decision 33. Sums need not
 * be exactly 100; the generator normalizes. Per-sport overrides can
 * weight differently (basketball might weight decision higher).
 */
export interface PillarWeights {
  composure: number;
  focus: number;
  decision: number;
}

export const EQUAL_PILLAR_WEIGHTS: PillarWeights = {
  composure: 33,
  focus: 33,
  decision: 33,
};

// ──────────────────────────────────────────────────────────────────────────────
// Curriculum config singleton
// ──────────────────────────────────────────────────────────────────────────────

export interface CurriculumConfig {
  /** Always 'current' for the singleton; future versions could split. */
  id: string;
  /** Default pillar weights — used when no per-sport override exists. */
  defaultPillarWeights: PillarWeights;
  /** Per-sport weights, keyed by sport id (matches PulseCheckSportConfig.id). */
  pillarWeightsBySport?: Record<string, PillarWeights>;
  /** Default frequency targets per progression level. Operator-tunable. */
  frequencyTargetsByLevel: Record<ProgressionLevel, number>;
  /** Notification cadence — how many push points per day the engine fires. */
  notificationCadence: NotificationCadence;
  /** Master kill switch — when false the daily generator is a no-op. */
  engineEnabled: boolean;
  /** Revision metadata — bumps every time admin edits the config. */
  revisionId: string;
  revisionLog: CurriculumConfigRevision[];
  createdAt: number;
  updatedAt: number;
}

export interface CurriculumConfigRevision {
  revisionId: string;
  changedAt: number;
  changedByUserId?: string;
  summary: string;
}

export interface NotificationCadence {
  /** Morning push — "today's protocol: …". Local hour in 0-23. */
  morningHourLocal: number;
  /** Optional midday nudge for the sim. null disables. */
  middayHourLocal: number | null;
  /** Evening recovery push (only fires if assignment uncompleted). null disables. */
  eveningHourLocal: number | null;
}

export const DEFAULT_NOTIFICATION_CADENCE: NotificationCadence = {
  morningHourLocal: 8,
  middayHourLocal: 13,
  eveningHourLocal: 20,
};

// ──────────────────────────────────────────────────────────────────────────────
// 30-day assessment doc
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Doc id format: `${userId}_${yyyy-mm}` (e.g. `athlete-1_2026-04`).
 * Written by the monthly assessment cron.
 */
export interface CurriculumAssessment {
  id: string;
  athleteUserId: string;
  yearMonth: string; // YYYY-MM
  windowStart: string; // YYYY-MM-DD
  windowEnd: string; // YYYY-MM-DD

  /** Reps completed per cognitive pillar in the window. */
  repsByPillar: Record<TaxonomyPillar, number>;
  /** Target reps per pillar (sum of recommended frequencies × weighted share). */
  targetByPillar: Record<TaxonomyPillar, number>;
  /** Gap = target - reps. Negative = exceeded; positive = under. */
  gapByPillar: Record<TaxonomyPillar, number>;
  /** Most-underrepped pillar — the one to bias next month toward. */
  worstGapPillar: TaxonomyPillar;

  /** Per-protocol rep counts (every protocol the athlete touched). */
  protocolRepCounts: Array<{
    protocolId: string;
    protocolLabel: string;
    cognitivePillar: TaxonomyPillar;
    progressionLevel: ProgressionLevel;
    recommendedFrequencyPer30Days: number;
    actualReps: number;
    gap: number;
  }>;
  /** Per-sim rep counts. */
  simRepCounts: Array<{
    simId: string;
    simName: string;
    cognitivePillar: TaxonomyPillar;
    progressionLevel: ProgressionLevel;
    recommendedFrequencyPer30Days: number;
    actualReps: number;
    gap: number;
  }>;

  /** Summary stats. */
  totalAssignmentsAssigned: number;
  totalAssignmentsCompleted: number;
  adherenceRate: number; // 0-1
  longestStreakDays: number;

  /** Coach-visible narrative — kept short, pillar-balance-led, no biomarkers. */
  reviewerNote: string;

  generatedAt: number;
  generatorRevision: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Coach override
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Doc id format: `${athleteUserId}_${yyyy-mm}_${overrideId}`.
 * Coach pins a specific protocol or sim for an athlete during a month
 * window. The generator respects pinned items by always assigning them
 * if the day's pillar selection matches their pillar; otherwise the
 * override is informational.
 */
export interface CurriculumOverride {
  id: string;
  athleteUserId: string;
  yearMonth: string; // YYYY-MM
  overrideType: 'pin-protocol' | 'pin-simulation' | 'exclude-protocol' | 'exclude-simulation';
  targetId: string; // protocolId or simId
  rationale?: string;
  createdByUserId: string;
  createdByRole: 'coach' | 'team-admin' | 'pulse-staff';
  createdAt: number;
  expiresAt: number; // end of yearMonth window
  status: 'active' | 'consumed' | 'expired' | 'revoked';
}

// ──────────────────────────────────────────────────────────────────────────────
// Daily-generation result (in-memory; written to existing
// pulsecheck-daily-assignments collection for the iOS read path)
// ──────────────────────────────────────────────────────────────────────────────

export interface CurriculumGenerationResult {
  athleteUserId: string;
  sourceDate: string; // YYYY-MM-DD athlete-local
  generatedAt: number;

  /** The protocol the engine selected for today, plus why. */
  protocolSelection: {
    protocolId: string;
    protocolLabel: string;
    cognitivePillar: TaxonomyPillar;
    progressionLevel: ProgressionLevel;
    /** Pillar that drove the selection (most-underrepped). */
    drivingPillar: TaxonomyPillar;
    rationale: string;
    coachOverrideApplied?: string; // override id if any
  };
  /** The sim the engine selected. */
  simSelection: {
    simId: string;
    simName: string;
    cognitivePillar: TaxonomyPillar;
    progressionLevel: ProgressionLevel;
    drivingPillar: TaxonomyPillar;
    rationale: string;
    coachOverrideApplied?: string;
  };

  /** Pillar balance snapshot at time of generation (used for audit). */
  pillarBalanceAtGeneration: Record<TaxonomyPillar, number>;
  /** The daily assignment doc ids written. */
  dailyAssignmentIdProtocol: string;
  dailyAssignmentIdSim: string;

  /** Notes for the reviewer / admin surface. */
  generatorNotes: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Validators (lightweight — fuller validation lives in the service)
// ──────────────────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const issue = (field: string, message: string): ValidationIssue => ({ field, message });

export const validatePillarWeights = (weights: PillarWeights): ValidationResult => {
  const issues: ValidationIssue[] = [];
  for (const [key, value] of Object.entries(weights)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      issues.push(issue(`pillarWeights.${key}`, `must be a non-negative finite number; got ${value}`));
    }
  }
  const sum = weights.composure + weights.focus + weights.decision;
  if (sum <= 0) {
    issues.push(issue('pillarWeights.sum', 'sum must be positive (engine normalizes; do not zero out all pillars)'));
  }
  return { ok: issues.length === 0, issues };
};

export const validateCurriculumConfig = (config: CurriculumConfig): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const defaultCheck = validatePillarWeights(config.defaultPillarWeights);
  if (!defaultCheck.ok) issues.push(...defaultCheck.issues);
  if (config.pillarWeightsBySport) {
    for (const [sportId, weights] of Object.entries(config.pillarWeightsBySport)) {
      const r = validatePillarWeights(weights);
      if (!r.ok) {
        for (const sub of r.issues) issues.push(issue(`pillarWeightsBySport.${sportId}.${sub.field}`, sub.message));
      }
    }
  }
  for (const level of PROGRESSION_LEVELS) {
    const v = config.frequencyTargetsByLevel[level];
    if (typeof v !== 'number' || v < 0 || !Number.isFinite(v)) {
      issues.push(issue(`frequencyTargetsByLevel.${level}`, `must be a non-negative finite number; got ${v}`));
    }
  }
  const cad = config.notificationCadence;
  for (const key of ['morningHourLocal', 'middayHourLocal', 'eveningHourLocal'] as const) {
    const v = cad[key];
    if (v === null) continue;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 23) {
      issues.push(issue(`notificationCadence.${key}`, `must be null or integer 0-23; got ${v}`));
    }
  }
  return { ok: issues.length === 0, issues };
};

export const validateCurriculumOverride = (override: CurriculumOverride): ValidationResult => {
  const issues: ValidationIssue[] = [];
  if (!override.athleteUserId) issues.push(issue('athleteUserId', 'required'));
  if (!override.targetId) issues.push(issue('targetId', 'required'));
  if (!/^\d{4}-\d{2}$/.test(override.yearMonth)) {
    issues.push(issue('yearMonth', 'must be YYYY-MM'));
  }
  if (!['pin-protocol', 'pin-simulation', 'exclude-protocol', 'exclude-simulation'].includes(override.overrideType)) {
    issues.push(issue('overrideType', `unknown override type "${override.overrideType}"`));
  }
  return { ok: issues.length === 0, issues };
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Normalizes pillar weights so they sum to 1. Used by the generator. */
export const normalizePillarWeights = (weights: PillarWeights): PillarWeights => {
  const sum = weights.composure + weights.focus + weights.decision;
  if (sum <= 0) {
    return { composure: 1 / 3, focus: 1 / 3, decision: 1 / 3 };
  }
  return {
    composure: weights.composure / sum,
    focus: weights.focus / sum,
    decision: weights.decision / sum,
  };
};

/** Derive yyyy-mm from a date or YYYY-MM-DD string. */
export const yearMonthOf = (dateOrKey: Date | string): string => {
  if (typeof dateOrKey === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateOrKey)) {
    return dateOrKey.slice(0, 7);
  }
  const d = typeof dateOrKey === 'string' ? new Date(dateOrKey) : dateOrKey;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/** Resolve effective frequency for an asset: explicit field wins, level
 *  default falls back. */
export const resolveFrequency = (
  meta: Pick<CurriculumMetadata, 'recommendedFrequencyPer30Days' | 'progressionLevel'>,
  defaults: Record<ProgressionLevel, number> = DEFAULT_FREQUENCY_PER_30_DAYS,
): number => {
  if (
    typeof meta.recommendedFrequencyPer30Days === 'number' &&
    Number.isFinite(meta.recommendedFrequencyPer30Days) &&
    meta.recommendedFrequencyPer30Days >= 0
  ) {
    return meta.recommendedFrequencyPer30Days;
  }
  return defaults[meta.progressionLevel];
};
