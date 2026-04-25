import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

export interface PulseCheckSportConfigurationEntry {
  id: string;
  name: string;
  emoji: string;
  positions: string[];
  sortOrder: number;
  schemaVersion?: number;
  attributes?: PulseCheckSportAttributeDefinition[];
  metrics?: PulseCheckSportMetricDefinition[];
  prompting?: PulseCheckSportPromptingConfiguration;
  reportPolicy?: PulseCheckSportReportPolicy;
}

export type PulseCheckSportAttributeType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'singleSelect'
  | 'multiSelect';

export type PulseCheckSportAttributeScope =
  | 'athlete'
  | 'team'
  | 'season'
  | 'competition'
  | 'nutrition'
  | 'recovery';

export interface PulseCheckSportAttributeOption {
  label: string;
  value: string;
}

export interface PulseCheckSportAttributeDefinition {
  id: string;
  key: string;
  label: string;
  type: PulseCheckSportAttributeType;
  scope: PulseCheckSportAttributeScope;
  required?: boolean;
  includeInNoraContext?: boolean;
  includeInMacraContext?: boolean;
  options?: PulseCheckSportAttributeOption[];
  placeholder?: string;
  sortOrder?: number;
}

export interface PulseCheckSportMetricDefinition {
  id: string;
  key: string;
  label: string;
  unit?: string;
  scope?: PulseCheckSportAttributeScope;
  includeInNoraContext?: boolean;
  sortOrder?: number;
}

export interface PulseCheckSportPromptingConfiguration {
  noraContext?: string;
  macraNutritionContext?: string;
  riskFlags?: string[];
  restrictedAdvice?: string[];
  recommendedLanguage?: string[];
}

export type PulseCheckSportsIntelligenceDimension = 'focus' | 'composure' | 'decisioning';

export interface PulseCheckSportReportLens {
  id: string;
  label: string;
  inputFamilies: string[];
  linkedDimensions: PulseCheckSportsIntelligenceDimension[];
}

export interface PulseCheckSportWatchlistSignal {
  id: string;
  label: string;
  inputFamilies: string[];
  linkedDimensions: PulseCheckSportsIntelligenceDimension[];
}

export interface PulseCheckSportCoachActionPolicy {
  id: string;
  label: string;
  linkedSignals: string[];
}

export interface PulseCheckSportEarlyWarningFamily {
  id: string;
  label: string;
  inputFamilies: string[];
}

export interface PulseCheckSportLanguagePosture {
  summary: string;
  recommendedLanguage: string[];
  mustAvoid: string[];
}

export interface PulseCheckSportLoadPrimitive {
  /** Identifier from the canonical primitive catalog (see Sport Load Model spec tab). */
  key: string;
  /** Weight in the sport's blend. Weights need not sum to 1.0 — internal HR-load is the universal baseline; sport-specific primitives multiply on top. */
  weight: number;
  /** Where this primitive comes from in the Health Context Source Record / session_record. */
  source: string;
  /** Optional pre-accumulation filter (e.g., 'GPS speed > 6 m/s, sustained > 2s'). */
  filter?: string;
}

export interface PulseCheckSportLoadThresholds {
  /** Normalized 0–1 load_au bands. Below low = "fresh"; above concerning = "looking heavy". */
  low: number;
  moderate: number;
  high: number;
  concerning: number;
}

export interface PulseCheckSportLoadContextModifier {
  /** Identifier (e.g., 'heatExposure', 'travelDays', 'shortTurnaround'). */
  key: string;
  /** Multiplier applied to load_au when this context is active (e.g., 1.10 = +10%). */
  multiplier: number;
  /** One-line coach-context for why this modifier exists in this sport. */
  rationale: string;
}

export interface PulseCheckSportLoadPrescribedComparisonWeights {
  /** Adjustment weight for (executed reps / prescribed reps). */
  executedRepsFraction: number;
  /** Adjustment weight for pace deviation. */
  paceDeviation: number;
  /** Adjustment weight for rest deviation. */
  restDeviation: number;
  /** Adjustment weight for volume deviation. */
  volumeDeviation: number;
  /** Adjustment weight for modality drift (interval vs. steady, strength vs. game, etc.). */
  modalityDrift: number;
}

export interface PulseCheckSportLoadModel {
  /** Plain-English one-liner used by the admin Load Model panel headline. */
  summary: string;
  /** Per-sport primitive blend. */
  primitives: PulseCheckSportLoadPrimitive[];
  /** Sport-tolerable load bands. */
  thresholds: PulseCheckSportLoadThresholds;
  /** Sport-tolerable acute:chronic ratio ceiling before "concerning" flag. */
  acwrCeiling: number;
  /** Half-life (in days) over which chronic load decays without new sessions. */
  decayHalfLifeDays: number;
  /** How negative the score may go before "deload — push it again" copy fires (e.g., -0.20). */
  recoveryDebtFloor: number;
  /** Sport-specific context modifiers (heat, travel, schedule density, etc.). */
  contextModifiers: PulseCheckSportLoadContextModifier[];
  /** How prescribed-vs-executed deltas adjust the load score. */
  prescribedComparisonWeights: PulseCheckSportLoadPrescribedComparisonWeights;
}

export interface PulseCheckSportReportPolicy {
  contextModifiers: string[];
  kpiRefs: string[];
  weeklyRead: { reportLenses: PulseCheckSportReportLens[] };
  gameDayRead: { reportLenses: PulseCheckSportReportLens[] };
  watchlistSignals: PulseCheckSportWatchlistSignal[];
  coachActions: PulseCheckSportCoachActionPolicy[];
  earlyWarningFamilies: PulseCheckSportEarlyWarningFamily[];
  languagePosture: PulseCheckSportLanguagePosture;
  dimensionMap: Record<PulseCheckSportsIntelligenceDimension, string[]>;
  // Translation table that converts internal evidence labels into coach English.
  // Generators (and the demo renderer) should run output copy through this before
  // delivery so the coach never sees jargon like "HRV down 12%" or "underfueling pattern".
  coachLanguageTranslations?: Record<string, string>;
  // Per-sport load formula (primitives, thresholds, ACWR ceiling, decay, modifiers,
  // prescribed-comparison weights). Edited in code; rendered as a review-only panel
  // on the Sports Intelligence Layer admin page.
  loadModel?: PulseCheckSportLoadModel;
}

export const PULSECHECK_REPORT_POLICY_DEFAULTS = {
  outputRules: {
    // Reports carry the interpretation. The Coach Dashboard exists as a thin access
    // surface that links into reports and exposes a small set of supporting KPIs +
    // adherence; it never tries to replace the narrative interpretation in the report.
    interpretationLivesInReport: true,
    coachDashboardIsThinAccessSurface: true,
    includeTeamSentimentInAggregateOnly: true,
    includeAdherenceBlock: true,
    includeDataCoverageBlock: true,
    internalDimensionBackbone: ['focus', 'composure', 'decisioning'] as PulseCheckSportsIntelligenceDimension[],
  },
  adherenceBlockMetrics: [
    'wearRate7d',
    'noraCheckinCompletion7d',
    'protocolCompletion7d',
    'simulationCompletion7d',
    'coachReportReviewStatus',
    'dataCoverageConfidence',
  ],
  confidencePolicy: {
    showConfidenceChip: true,
    minConfidenceForWatchlist: 'stable',
    minConfidenceForCoachAction: 'stable',
    minConfidenceForEarlyWarning: 'high_confidence',
    degradedCopyRule: 'monitor_only_with_provenance',
  },
  privacyPolicy: {
    teamSentimentOnly: true,
    suppressIndividualDisclosures: true,
  },
  clinicalBoundary: {
    coachAlertsExcludeClinicalThresholdSignals: true,
    clinicalSignalsRouteToAuntEDNA: true,
  },
  reportSections: [
    'weeklyRead',
    'gameDayRead',
    'watchlistSignals',
    'coachActions',
    'sportNativeKpis',
    'languagePosture',
    'mustAvoid',
    'adherence',
    'confidence',
  ],
  // Cross-sport translation defaults. Each sport may extend or override its own
  // coachLanguageTranslations on top of these. Translations are applied case-insensitively.
  coachLanguageTranslations: {
    'hrv down': 'recovery is below his usual',
    'hrv below baseline': 'recovery is below his usual',
    'underfueling pattern': 'has been skipping pre-practice meals',
    'underfueling': 'fueling has been light',
    'acwr above 1.5': 'training load is climbing faster than recovery',
    'acwr trending up': 'training load is climbing faster than recovery',
    'nora check-ins': 'daily check-ins',
    'protocol/sims': 'mental performance reps',
    'protocol / sims': 'mental performance reps',
    'rpe coverage': 'training-effort logging',
    'session rpe': 'effort rating',
    'sentiment shift': 'mood is off',
    'composure decline': 'response after mistakes is shaky',
    'decisioning decline': 'reads are slower under fatigue',
    'baseline': 'his usual',
    'directional confidence': 'early signal',
    'emerging confidence': 'pattern forming',
    'stable confidence': 'reliable read',
    'high_confidence': 'strong read',
  } as Record<string, string>,
};

const CONFIG_COLLECTION = 'company-config';
const CONFIG_DOCUMENT = 'pulsecheck-sports';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeOptionValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const option = (label: string, value = normalizeOptionValue(label)): PulseCheckSportAttributeOption => ({
  label,
  value,
});

const options = (labels: string[]) => labels.map((label) => option(label));

const COMPETITIVE_LEVEL_OPTIONS = options(['Youth', 'High School', 'College', 'Semi-Pro', 'Pro / Elite', 'Recreational']);
const SEASON_PHASE_OPTIONS = options(['Off-Season', 'Preseason', 'In-Season', 'Postseason', 'Tournament Week', 'Return to Play']);
const TRAINING_LOAD_OPTIONS = options(['Deload / Taper', 'Normal Load', 'High Load', 'Two-a-Day Block', 'Travel / Congested Schedule', 'Return to Play']);
const HANDEDNESS_OPTIONS = options(['Right', 'Left', 'Switch / Both']);

const attribute = (
  sportId: string,
  key: string,
  label: string,
  type: PulseCheckSportAttributeType,
  scope: PulseCheckSportAttributeScope,
  sortOrder: number,
  config: Partial<Omit<PulseCheckSportAttributeDefinition, 'id' | 'key' | 'label' | 'type' | 'scope' | 'sortOrder'>> = {}
): PulseCheckSportAttributeDefinition => ({
  id: `${sportId}-${normalizeOptionValue(key)}`,
  key,
  label,
  type,
  scope,
  required: Boolean(config.required),
  includeInNoraContext: config.includeInNoraContext !== false,
  includeInMacraContext: Boolean(config.includeInMacraContext),
  options: config.options || [],
  placeholder: config.placeholder || '',
  sortOrder,
});

const metric = (
  sportId: string,
  key: string,
  label: string,
  unit: string,
  scope: PulseCheckSportAttributeScope,
  sortOrder: number,
  includeInNoraContext = true
): PulseCheckSportMetricDefinition => ({
  id: `${sportId}-${normalizeOptionValue(key)}`,
  key,
  label,
  unit,
  scope,
  includeInNoraContext,
  sortOrder,
});

const sportDefaults = (
  sport: Omit<PulseCheckSportConfigurationEntry, 'schemaVersion'> & {
    attributes?: PulseCheckSportAttributeDefinition[];
    metrics?: PulseCheckSportMetricDefinition[];
    prompting: PulseCheckSportPromptingConfiguration;
  }
): PulseCheckSportConfigurationEntry => ({
  schemaVersion: 2,
  ...sport,
});

const basketballReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['travelImpact', 'awayGame', 'shortTurnaround', 'scheduleDensity', 'minutesConcentration'],
  kpiRefs: ['minutesPerGame', 'usageRole', 'assistTurnoverRatio', 'freeThrowPercentage', 'verticalJump', 'repeatSprintReadiness', 'sessionRpe'],
  weeklyRead: {
    reportLenses: [
      { id: 'game_density_minutes_concentration', label: 'Game density and minutes concentration', inputFamilies: ['training_load', 'sport_metric_minutes', 'recovery'], linkedDimensions: ['decisioning', 'composure'] },
      { id: 'decision_speed_under_fatigue', label: 'Decision speed under fatigue', inputFamilies: ['decisioning_trend', 'training_load', 'recovery'], linkedDimensions: ['decisioning'] },
      { id: 'late_game_composure_free_throw_posture', label: 'Late-game composure and free-throw posture', inputFamilies: ['composure_trend', 'sentiment', 'sport_metric_free_throw_pct'], linkedDimensions: ['composure'] },
      { id: 'jump_landing_repeat_sprint_load', label: 'Jump/landing and repeat-sprint load', inputFamilies: ['external_load', 'repeat_sprint_metric', 'recovery'], linkedDimensions: ['focus', 'composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'ball_handler_readiness', label: 'Ball-handler readiness', inputFamilies: ['recovery', 'decisioning_trend', 'focus_trend'], linkedDimensions: ['decisioning', 'focus'] },
      { id: 'high_minute_athlete_recovery', label: 'High-minute athlete recovery', inputFamilies: ['recovery', 'sport_metric_minutes', 'sleep'], linkedDimensions: ['composure', 'decisioning'] },
      { id: 'travel_sleep_hydration', label: 'Travel sleep and hydration', inputFamilies: ['travel_impact', 'sleep', 'nutrition_hydration_context'], linkedDimensions: ['focus', 'composure'] },
      { id: 'possession_level_reset_protocol', label: 'Possession-level reset protocol', inputFamilies: ['protocol_effectiveness', 'composure_trend', 'sentiment'], linkedDimensions: ['composure', 'focus'] },
    ],
  },
  watchlistSignals: [
    { id: 'low_hrv_high_acwr_high_minute', label: 'Low HRV + high ACWR in high-minute roles', inputFamilies: ['hrv', 'training_load', 'sport_metric_minutes'], linkedDimensions: ['composure', 'decisioning'] },
    { id: 'decisioning_decline_after_congested_schedule', label: 'Decisioning decline after congested schedule', inputFamilies: ['decisioning_trend', 'schedule_density', 'recovery'], linkedDimensions: ['decisioning'] },
    { id: 'sentiment_drop_after_role_minutes_volatility', label: 'Sentiment drop after role/minutes volatility', inputFamilies: ['sentiment', 'sport_metric_minutes', 'lineup_role_context'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'adjust_high_intensity_practice_dose_by_role', label: 'Adjust high-intensity practice dose by role', linkedSignals: ['low_hrv_high_acwr_high_minute', 'game_density_minutes_concentration'] },
    { id: 'protect_late_game_decision_makers_from_extra_cognitive_load', label: 'Protect late-game decision-makers from unnecessary cognitive load', linkedSignals: ['decisioning_decline_after_congested_schedule', 'ball_handler_readiness'] },
    { id: 'use_possession_level_reset_language_in_walkthrough', label: 'Use possession-level reset language in walkthrough', linkedSignals: ['possession_level_reset_protocol', 'late_game_composure_free_throw_posture'] },
  ],
  earlyWarningFamilies: [
    { id: 'recovery_limited_high_minute_athlete', label: 'Recovery-limited high-minute athlete', inputFamilies: ['recovery', 'sport_metric_minutes', 'sleep'] },
    { id: 'sustained_decisioning_drop_during_schedule_congestion', label: 'Sustained decisioning drop during schedule congestion', inputFamilies: ['decisioning_trend', 'schedule_density', 'sentiment'] },
    { id: 'abrupt_sentiment_shift_after_role_change', label: 'Abrupt sentiment shift after role change', inputFamilies: ['sentiment', 'lineup_role_context'] },
  ],
  languagePosture: {
    summary: 'Concise film-room language focused on pace, spacing, reads, possessions, closeouts, and late-clock decisions.',
    recommendedLanguage: ['pace', 'spacing', 'read', 'possession', 'closeout', 'late-clock', 'reset', 'minutes', 'load'],
    mustAvoid: ['Generic hustle advice', 'Raw readiness score rankings', 'Mechanics changes without coach context'],
  },
  dimensionMap: {
    focus: ['possession discipline', 'walkthrough retention', 'late-clock attention'],
    composure: ['late-game composure', 'free-throw posture', 'reset after turnover or opponent run'],
    decisioning: ['ball-handler reads', 'decision speed under fatigue', 'shot-pass discrimination late in possessions'],
  },
  coachLanguageTranslations: {
    'high-minute role': 'starter logging heavy minutes',
    'minutes concentration': 'minutes piling up on the same guys',
    'congested schedule': 'back-to-back stretch',
    'role/minutes volatility': 'rotation has been changing',
    'repeat-sprint readiness': 'legs',
    'cognitive load': 'film-and-walkthrough demand',
  },
  loadModel: {
    summary: 'Repeat-sprint plus jump-volume sport with collision and lateral overlay; load is dominated by minutes × intensity, with high-intensity efforts and jump count as the lead indicators.',
    primitives: [
      { key: 'internalLoadHr', weight: 1.0, source: 'TRIMP-style HR-zone integration over detected basketball sessions.' },
      { key: 'jumpCount', weight: 0.9, source: 'Vertical accelerometer Z-spike count above basketball jump threshold.', filter: 'Z-spike > 2.0g' },
      { key: 'lateralAccelCount', weight: 0.7, source: 'X/Y deflection count above defensive cut threshold.' },
      { key: 'sprintReps', weight: 0.7, source: 'GPS speed > 5.5 m/s sustained > 2s during open-court play.' },
      { key: 'impactCollisionLoad', weight: 0.4, source: 'Accelerometer impact-magnitude integration; supplemental when device exposes it.' },
    ],
    thresholds: { low: 0.30, moderate: 0.60, high: 0.85, concerning: 1.05 },
    acwrCeiling: 1.5,
    decayHalfLifeDays: 5,
    recoveryDebtFloor: -0.20,
    contextModifiers: [
      { key: 'travelDays', multiplier: 1.08, rationale: 'Time-zone shifts and back-to-back travel push effective load on conference road trips.' },
      { key: 'shortTurnaround', multiplier: 1.10, rationale: '<48h between games compounds repeat-sprint cost.' },
      { key: 'heatExposure', multiplier: 1.05, rationale: 'Tournament gyms and summer travel runs push HR-zone load harder than usual.' },
    ],
    prescribedComparisonWeights: { executedRepsFraction: 0.7, paceDeviation: 0.4, restDeviation: 0.6, volumeDeviation: 0.7, modalityDrift: 0.8 },
  },
};

const golfReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['teeTime', 'qualifyingVsTournamentRound', 'heat', 'wind', 'roundDuration', 'walkingLoad'],
  kpiRefs: ['scoringAverage', 'fairwaysHit', 'greensInRegulation', 'puttsPerRound', 'upAndDownPercentage', 'clubSpeed', 'shotDispersion'],
  weeklyRead: {
    reportLenses: [
      { id: 'pre_shot_routine_stability', label: 'Pre-shot routine', inputFamilies: ['focus_trend', 'protocol_effectiveness', 'routine_consistency'], linkedDimensions: ['focus'] },
      { id: 'course_management_quality', label: 'Course management', inputFamilies: ['decisioning_trend', 'round_context', 'sport_metric_scoring_average'], linkedDimensions: ['decisioning'] },
      { id: 'bad_shot_recovery', label: 'Bad-shot recovery', inputFamilies: ['composure_trend', 'sentiment', 'round_context'], linkedDimensions: ['composure'] },
      { id: 'late_round_fatigue_and_heat', label: 'Late-round fatigue and heat', inputFamilies: ['recovery', 'heat_context', 'walking_load'], linkedDimensions: ['focus', 'composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'commitment_and_target_clarity', label: 'Commitment and target clarity', inputFamilies: ['focus_trend', 'decisioning_trend', 'routine_consistency'], linkedDimensions: ['focus', 'decisioning'] },
      { id: 'caffeine_hydration_timing', label: 'Caffeine/hydration timing', inputFamilies: ['nutrition_hydration_context', 'tee_time', 'heat_context'], linkedDimensions: ['focus', 'composure'] },
      { id: 'walking_load_readiness', label: 'Walking load', inputFamilies: ['walking_load', 'recovery', 'sleep'], linkedDimensions: ['focus', 'composure'] },
      { id: 'putting_confidence', label: 'Putting confidence', inputFamilies: ['composure_trend', 'sentiment', 'sport_metric_putts_per_round'], linkedDimensions: ['composure', 'focus'] },
    ],
  },
  watchlistSignals: [
    { id: 'bad_shot_carryover', label: 'Bad-shot carryover', inputFamilies: ['composure_trend', 'round_context', 'sentiment'], linkedDimensions: ['composure'] },
    { id: 'sleep_disruption_before_qualifying', label: 'Sleep disruption before qualifying', inputFamilies: ['sleep', 'qualifying_vs_tournament_round'], linkedDimensions: ['focus'] },
    { id: 'late_round_dispersion_increase', label: 'Late-round dispersion increase', inputFamilies: ['sport_metric_shot_dispersion', 'walking_load', 'recovery'], linkedDimensions: ['decisioning', 'focus'] },
    { id: 'caffeine_jitters', label: 'Caffeine jitters', inputFamilies: ['nutrition_hydration_context', 'sentiment', 'recovery'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'keep_cue_count_to_one', label: 'Keep cue count to one', linkedSignals: ['bad_shot_carryover', 'commitment_and_target_clarity'] },
    { id: 'reinforce_target_routine_acceptance', label: 'Reinforce target/routine/acceptance', linkedSignals: ['pre_shot_routine_stability', 'bad_shot_recovery'] },
    { id: 'plan_steady_small_fueling_windows', label: 'Plan steady small fueling windows', linkedSignals: ['caffeine_hydration_timing', 'late_round_fatigue_and_heat'] },
  ],
  earlyWarningFamilies: [
    { id: 'pre_round_sleep_and_heat_risk', label: 'Pre-round sleep and heat risk', inputFamilies: ['sleep', 'heat_context', 'tee_time'] },
    { id: 'persistent_bad_shot_carryover_pattern', label: 'Persistent bad-shot carryover pattern', inputFamilies: ['composure_trend', 'sentiment', 'round_context'] },
    { id: 'late_round_dispersion_break', label: 'Late-round dispersion break', inputFamilies: ['sport_metric_shot_dispersion', 'walking_load', 'recovery'] },
  ],
  languagePosture: {
    summary: 'Caddie-style language focused on target, commitment, routine, acceptance, tempo, and course management.',
    recommendedLanguage: ['target', 'commitment', 'routine', 'acceptance', 'tempo', 'course management', 'walk', 'window'],
    mustAvoid: ['Swing rebuilds', 'Multiple technical cues', 'Ignoring course conditions and round duration'],
  },
  dimensionMap: {
    focus: ['pre-shot routine', 'target clarity', 'putting attention'],
    composure: ['bad-shot recovery', 'acceptance', 'late-round emotional stability'],
    decisioning: ['course management', 'club and target commitment', 'risk selection'],
  },
  coachLanguageTranslations: {
    'bad-shot carryover': 'bad shots have been bleeding into the next hole',
    'shot dispersion': 'spread on approach shots',
    'caffeine jitters': 'a little wired off the caffeine',
    'walking load': 'the grind of walking 18',
    'late-round dispersion': 'tightness late in the round',
  },
  loadModel: {
    summary: 'Walk-volume + heat + grind-of-18 sport; walking distance and round duration anchor the read, with swing reps and tournament density driving the high end.',
    primitives: [
      { key: 'walkingDistance', weight: 1.0, source: 'GPS distance at sustained low speed (1–2 m/s) over multi-hour activity window.' },
      { key: 'blockRoundDuration', weight: 0.9, source: 'Detected round duration (4–5 hours per 18 holes).' },
      { key: 'swingReps', weight: 0.7, source: 'Accelerometer swing-signature count (driving range + course).' },
      { key: 'heatExposure', weight: 0.6, source: 'Skin temp + ambient temperature × round duration.' },
      { key: 'internalLoadHr', weight: 0.4, source: 'HR-zone integration; lower weight given low aerobic profile.' },
    ],
    thresholds: { low: 0.25, moderate: 0.50, high: 0.80, concerning: 1.05 },
    acwrCeiling: 1.7,
    decayHalfLifeDays: 4,
    recoveryDebtFloor: -0.18,
    contextModifiers: [
      { key: 'tournamentDay', multiplier: 1.15, rationale: '36-hole tournament days double walking distance and round duration on a single day.' },
      { key: 'heatExposure', multiplier: 1.12, rationale: 'Outdoor summer heat over a 4-5 hour round materially raises systemic cost.' },
      { key: 'travelDays', multiplier: 1.05, rationale: 'Travel pre-tournament adds sleep disruption on top of round volume.' },
    ],
    prescribedComparisonWeights: { executedRepsFraction: 0.5, paceDeviation: 0.3, restDeviation: 0.4, volumeDeviation: 0.7, modalityDrift: 0.5 },
  },
};

const bowlingReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['tournamentDay', 'blockLength', 'laneTransition', 'earlyStart', 'travelImpact'],
  kpiRefs: ['frameAverage', 'strikePercentage', 'spareConversionPercentage', 'singlePinSparePercentage', 'openFrameRate', 'firstBallCount', 'laneTransitionAdjustmentQuality'],
  weeklyRead: {
    reportLenses: [
      { id: 'shot_repeatability_across_blocks', label: 'Shot repeatability across blocks', inputFamilies: ['sport_metric_shot_repeatability', 'focus_trend', 'fatigue'], linkedDimensions: ['focus'] },
      { id: 'spare_system_stability', label: 'Spare-system stability', inputFamilies: ['sport_metric_spare_conversion_pct', 'decisioning_trend', 'composure_trend'], linkedDimensions: ['decisioning', 'composure'] },
      { id: 'lane_transition_adaptability', label: 'Lane transition adaptability', inputFamilies: ['lane_transition', 'decisioning_trend', 'sport_metric_pocket_hit_pct'], linkedDimensions: ['decisioning'] },
      { id: 'tournament_window_endurance', label: 'Tournament-window endurance and composure', inputFamilies: ['block_length', 'recovery', 'composure_trend'], linkedDimensions: ['focus', 'composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'target_clarity_and_routine', label: 'Target clarity and routine', inputFamilies: ['focus_trend', 'routine_consistency', 'protocol_effectiveness'], linkedDimensions: ['focus'] },
      { id: 'lane_transition_readiness', label: 'Lane transition readiness', inputFamilies: ['lane_transition', 'decisioning_trend', 'sport_metric_pocket_hit_pct'], linkedDimensions: ['decisioning'] },
      { id: 'between_block_reset_quality', label: 'Between-block reset quality', inputFamilies: ['composure_trend', 'sentiment', 'protocol_effectiveness'], linkedDimensions: ['composure'] },
      { id: 'energy_and_hydration_stability', label: 'Energy and hydration stability across long competition windows', inputFamilies: ['nutrition_hydration_context', 'block_length', 'recovery'], linkedDimensions: ['focus', 'composure'] },
    ],
  },
  watchlistSignals: [
    { id: 'shot_repeatability_drift_late_block', label: 'Shot repeatability drift late in block', inputFamilies: ['sport_metric_shot_repeatability', 'block_length', 'fatigue'], linkedDimensions: ['focus'] },
    { id: 'spare_conversion_drop_after_fatigue_build', label: 'Spare conversion drop after fatigue build', inputFamilies: ['sport_metric_spare_conversion_pct', 'recovery', 'fatigue'], linkedDimensions: ['decisioning', 'composure'] },
    { id: 'sentiment_drop_after_open_frame_cluster', label: 'Sentiment drop after open-frame cluster', inputFamilies: ['sentiment', 'frame_sequence_context'], linkedDimensions: ['composure'] },
    { id: 'composure_decline_after_split_miss_pattern', label: 'Composure decline after repeated split / pressure-spare misses', inputFamilies: ['composure_trend', 'frame_sequence_context', 'sport_metric_single_pin_spare_pct'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'keep_adjustments_to_one_change_at_a_time', label: 'Keep adjustments to one change at a time', linkedSignals: ['lane_transition_adaptability', 'shot_repeatability_drift_late_block'] },
    { id: 'protect_pre_shot_and_between_block_routine', label: 'Protect pre-shot and between-block routine', linkedSignals: ['target_clarity_and_routine', 'between_block_reset_quality'] },
    { id: 'plan_reset_and_fueling_windows_between_blocks', label: 'Plan reset and fueling windows between blocks', linkedSignals: ['energy_and_hydration_stability', 'tournament_window_endurance'] },
    { id: 'avoid_mid_block_mechanics_overhaul', label: 'Avoid mid-block mechanics overhaul unless coach sees a stable pattern', linkedSignals: ['shot_repeatability_drift_late_block', 'composure_decline_after_split_miss_pattern'] },
  ],
  earlyWarningFamilies: [
    { id: 'late_block_accuracy_collapse', label: 'Late-block accuracy collapse', inputFamilies: ['sport_metric_shot_repeatability', 'fatigue', 'recovery'] },
    { id: 'spare_miss_cluster_with_composure_drop', label: 'Spare-miss cluster with composure drop', inputFamilies: ['sport_metric_spare_conversion_pct', 'composure_trend', 'sentiment'] },
    { id: 'lane_transition_adaptation_failure', label: 'Lane-transition adaptation failure', inputFamilies: ['lane_transition', 'decisioning_trend', 'sport_metric_pocket_hit_pct'] },
  ],
  languagePosture: {
    summary: 'Lane-play language focused on target, line, tempo, spare system, transition, repeatability, and reset.',
    recommendedLanguage: ['target', 'line', 'tempo', 'spare system', 'transition', 'repeatability', 'reset', 'block'],
    mustAvoid: ['Mid-block overhaul language', 'Generic “just relax” advice', 'Raw readiness rankings', 'Technical rebuilds without bowling context'],
  },
  dimensionMap: {
    focus: ['target discipline', 'shot-to-shot repeatability', 'pre-shot routine stability'],
    composure: ['reset after open frame', 'response to split or pressure-spare miss', 'emotional stability across long blocks'],
    decisioning: ['lane-transition adjustments', 'ball and line choice', 'spare-system execution under pressure'],
  },
  coachLanguageTranslations: {
    'shot repeatability': 'repeating the same shot',
    'lane transition': 'how the lane is changing',
    'spare conversion': 'closing out spares',
    'open-frame cluster': 'a stretch of open frames',
    'block length': 'long block',
    'split miss': 'tough spare miss',
  },
  loadModel: {
    summary: 'Block-density sport with grip-strain overlay; total shots × block length anchor the read, with Day-2 stamina and travel days driving the high end.',
    primitives: [
      { key: 'blockRoundDuration', weight: 1.0, source: 'Detected bowling-block duration × block density.' },
      { key: 'swingReps', weight: 0.8, source: 'Accelerometer swing-signature count (release + approach combined).' },
      { key: 'gripStrainProxy', weight: 0.7, source: 'Forearm accelerometer signature integrated across the day.' },
      { key: 'travelDays', weight: 0.4, source: 'GPS-detected location change beyond home venue / hotel signature.' },
      { key: 'internalLoadHr', weight: 0.3, source: 'HR-zone integration; minor input given low aerobic profile.' },
    ],
    thresholds: { low: 0.25, moderate: 0.50, high: 0.80, concerning: 1.05 },
    acwrCeiling: 1.6,
    decayHalfLifeDays: 5,
    recoveryDebtFloor: -0.18,
    contextModifiers: [
      { key: 'multiDayTournament', multiplier: 1.15, rationale: 'Day-2 of a tournament block compounds grip and approach cost.' },
      { key: 'travelDays', multiplier: 1.07, rationale: 'Bus + plane travel routines disrupt sleep on top of competition density.' },
      { key: 'longBlockShift', multiplier: 1.08, rationale: 'Late-night shift bowling blocks push past the home-block design window.' },
    ],
    prescribedComparisonWeights: { executedRepsFraction: 0.5, paceDeviation: 0.3, restDeviation: 0.4, volumeDeviation: 0.7, modalityDrift: 0.5 },
  },
};

const soccerReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['fixtureCongestion', 'travelImpact', 'heat', 'surface', 'matchMinutes'],
  kpiRefs: ['minutesPerMatch', 'totalDistance', 'highSpeedRuns', 'sprintDistance', 'touchesUnderPressure', 'passCompletionUnderPressure', 'sessionRpe'],
  weeklyRead: {
    reportLenses: [
      { id: 'fixture_congestion_load', label: 'Fixture congestion and recovery', inputFamilies: ['training_load', 'recovery', 'sport_metric_minutes_per_match'], linkedDimensions: ['composure', 'decisioning'] },
      { id: 'high_speed_running_load', label: 'High-speed running and hamstring/groin load', inputFamilies: ['external_load', 'sport_metric_high_speed_runs', 'recovery'], linkedDimensions: ['focus'] },
      { id: 'scanning_first_touch_pressure', label: 'Scanning and first-touch pressure', inputFamilies: ['focus_trend', 'sport_metric_touches_under_pressure'], linkedDimensions: ['focus', 'decisioning'] },
      { id: 'goalkeeper_confidence_communication', label: 'Goalkeeper confidence and communication', inputFamilies: ['composure_trend', 'sentiment', 'role_context_goalkeeper'], linkedDimensions: ['composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'position_specific_running_load', label: 'Position-specific running load', inputFamilies: ['recovery', 'sport_metric_high_speed_runs', 'sport_metric_sprint_distance'], linkedDimensions: ['focus', 'composure'] },
      { id: 'heat_travel_impact', label: 'Heat and travel impact', inputFamilies: ['heat_context', 'travel_impact', 'sleep'], linkedDimensions: ['focus', 'composure'] },
      { id: 'transition_set_piece_decisioning', label: 'Transition and set-piece decision posture', inputFamilies: ['decisioning_trend', 'protocol_effectiveness'], linkedDimensions: ['decisioning'] },
      { id: 'goalkeeper_tracking_composure', label: 'Goalkeeper tracking and composure', inputFamilies: ['composure_trend', 'role_context_goalkeeper'], linkedDimensions: ['composure', 'focus'] },
    ],
  },
  watchlistSignals: [
    { id: 'high_speed_run_spike_low_recovery', label: 'High-speed run spike with degraded recovery', inputFamilies: ['sport_metric_high_speed_runs', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'composure_decline_after_mistakes', label: 'Composure decline after mistakes', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
    { id: 'underfueling_during_match_block', label: 'Underfueling during heavy match block', inputFamilies: ['nutrition_hydration_context', 'training_load'], linkedDimensions: ['composure', 'focus'] },
  ],
  coachActions: [
    { id: 'modulate_small_sided_volume_by_position', label: 'Modulate small-sided volume by position', linkedSignals: ['high_speed_run_spike_low_recovery', 'fixture_congestion_load'] },
    { id: 'use_role_specific_scanning_cues', label: 'Use role-specific scanning cues', linkedSignals: ['scanning_first_touch_pressure'] },
    { id: 'reinforce_next_action_communication', label: 'Reinforce next-action communication after errors', linkedSignals: ['composure_decline_after_mistakes', 'goalkeeper_confidence_communication'] },
  ],
  earlyWarningFamilies: [
    { id: 'soft_tissue_load_risk', label: 'Soft-tissue load risk in midfield/wide players', inputFamilies: ['sport_metric_high_speed_runs', 'recovery', 'sleep'] },
    { id: 'goalkeeper_confidence_drop', label: 'Goalkeeper confidence drop', inputFamilies: ['composure_trend', 'sentiment', 'role_context_goalkeeper'] },
    { id: 'fixture_congestion_overload', label: 'Fixture-congestion overload pattern', inputFamilies: ['training_load', 'recovery', 'sentiment'] },
  ],
  languagePosture: {
    summary: 'Match-phase language focused on build-up, transition, final third, defending, set pieces, and next-action communication.',
    recommendedLanguage: ['build-up', 'transition', 'final third', 'defending', 'set piece', 'next action', 'shape', 'press', 'cover'],
    mustAvoid: ['One conditioning recommendation for all positions', 'Technique overreach without tactical role', 'Body-weight advice without staff context'],
  },
  dimensionMap: {
    focus: ['scanning', 'first touch under pressure', 'set-piece assignment'],
    composure: ['response after mistakes', 'goalkeeper confidence', 'pressure-moment posture'],
    decisioning: ['transition choices', 'pass selection under pressure', 'final-third reads'],
  },
  loadModel: {
    summary: 'High-speed running plus repeat-sprint sport; total distance and HR-zone time anchor the read, with sprint count and high-speed running distance as the position-aware top end.',
    primitives: [
      { key: 'internalLoadHr', weight: 1.0, source: 'TRIMP-style HR-zone integration over detected soccer sessions.' },
      { key: 'highSpeedRunDistance', weight: 0.9, source: 'GPS distance accumulated above 5.5 m/s.' },
      { key: 'sprintReps', weight: 0.8, source: 'GPS speed > 7.0 m/s sustained > 2s.' },
      { key: 'sprintDistance', weight: 0.7, source: 'GPS distance accumulated above 7.0 m/s.' },
      { key: 'totalDistance', weight: 0.5, source: 'GPS total distance per session.' },
    ],
    thresholds: { low: 0.30, moderate: 0.60, high: 0.85, concerning: 1.05 },
    acwrCeiling: 1.5,
    decayHalfLifeDays: 6,
    recoveryDebtFloor: -0.20,
    contextModifiers: [
      { key: 'matchDensity', multiplier: 1.10, rationale: 'Mid-week + weekend matches compound high-speed running cost beyond practice load alone.' },
      { key: 'travelDays', multiplier: 1.07, rationale: 'Conference travel adds time-zone and routine disruption on top of match volume.' },
      { key: 'heatExposure', multiplier: 1.06, rationale: 'Late-summer and tournament heat pushes total-distance cost.' },
    ],
    prescribedComparisonWeights: { executedRepsFraction: 0.6, paceDeviation: 0.6, restDeviation: 0.5, volumeDeviation: 0.7, modalityDrift: 0.8 },
  },
};

const footballReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['gameWeek', 'opponent', 'travelImpact', 'campLoad', 'heat', 'positionGroup'],
  kpiRefs: ['snapCount', 'explosivePlays', 'missedAssignments', 'tenYardSplit', 'bodyWeight', 'collisionLoad', 'sessionRpe'],
  weeklyRead: {
    reportLenses: [
      { id: 'collision_accumulation_by_unit', label: 'Collision accumulation by unit', inputFamilies: ['external_load', 'sport_metric_collision_load', 'recovery'], linkedDimensions: ['composure', 'focus'] },
      { id: 'assignment_clarity_playbook_load', label: 'Assignment clarity and playbook load', inputFamilies: ['focus_trend', 'sport_metric_missed_assignments'], linkedDimensions: ['focus', 'decisioning'] },
      { id: 'explosive_readiness', label: 'Explosive readiness', inputFamilies: ['sport_metric_ten_yard_split', 'recovery', 'training_load'], linkedDimensions: ['focus'] },
      { id: 'position_body_composition_context', label: 'Position body-composition context', inputFamilies: ['sport_metric_body_weight', 'nutrition_context'], linkedDimensions: ['composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'pre_snap_routine_stability', label: 'Pre-snap routine stability', inputFamilies: ['focus_trend', 'protocol_effectiveness'], linkedDimensions: ['focus'] },
      { id: 'contact_recovery_readiness', label: 'Contact recovery readiness', inputFamilies: ['recovery', 'sport_metric_collision_load', 'sleep'], linkedDimensions: ['composure'] },
      { id: 'specialist_skill_line_split', label: 'Specialist vs skill vs line readiness', inputFamilies: ['recovery', 'role_context_unit'], linkedDimensions: ['focus', 'composure'] },
      { id: 'heat_camp_load', label: 'Heat and camp load', inputFamilies: ['heat_context', 'training_load'], linkedDimensions: ['focus', 'composure'] },
    ],
  },
  watchlistSignals: [
    { id: 'collision_load_spike_poor_sleep', label: 'Collision-load spike with poor sleep', inputFamilies: ['sport_metric_collision_load', 'sleep', 'recovery'], linkedDimensions: ['composure'] },
    { id: 'missed_assignments_with_cognitive_fatigue', label: 'Missed assignments rising with cognitive fatigue', inputFamilies: ['sport_metric_missed_assignments', 'focus_trend'], linkedDimensions: ['focus', 'decisioning'] },
    { id: 'weight_manipulation_pressure', label: 'Weight manipulation pressure', inputFamilies: ['sport_metric_body_weight', 'sentiment'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'adjust_contact_exposure_by_unit', label: 'Adjust contact exposure by unit', linkedSignals: ['collision_load_spike_poor_sleep', 'collision_accumulation_by_unit'] },
    { id: 'use_pre_snap_routine_reminders', label: 'Use pre-snap routine reminders', linkedSignals: ['pre_snap_routine_stability', 'missed_assignments_with_cognitive_fatigue'] },
    { id: 'separate_install_from_heavy_load', label: 'Separate mental install from heavy physical load when fatigue is high', linkedSignals: ['assignment_clarity_playbook_load'] },
  ],
  earlyWarningFamilies: [
    { id: 'sustained_collision_overload', label: 'Sustained collision-overload pattern', inputFamilies: ['sport_metric_collision_load', 'recovery', 'sleep'] },
    { id: 'cognitive_install_overload', label: 'Cognitive install overload', inputFamilies: ['focus_trend', 'sport_metric_missed_assignments', 'sentiment'] },
    { id: 'weight_pressure_pattern', label: 'Sustained weight-pressure pattern', inputFamilies: ['sport_metric_body_weight', 'sentiment'] },
  ],
  languagePosture: {
    summary: 'Direct position-room language focused on unit, assignment, snap, pre-snap, next play, and explosive intent.',
    recommendedLanguage: ['unit', 'assignment', 'snap', 'pre-snap', 'next play', 'install', 'explosive', 'finish'],
    mustAvoid: ['Concussion or return-to-play advice', 'Flattening positions into one load model', 'Weight-change recommendations without staff context'],
  },
  dimensionMap: {
    focus: ['assignment clarity', 'pre-snap routine', 'position-room install'],
    composure: ['next-play reset', 'arousal control', 'contact confidence'],
    decisioning: ['quarterback and coverage reads', 'unit communication', 'play responsibility'],
  },
  loadModel: {
    summary: 'Collision and snap-density sport; load is dominated by impact accumulation plus position-specific accelerometer signature, with HR-zone time as the conditioning baseline.',
    primitives: [
      { key: 'impactCollisionLoad', weight: 1.0, source: 'Accelerometer impact-magnitude integration; helmet IMU weighting when available.' },
      { key: 'internalLoadHr', weight: 0.9, source: 'TRIMP-style HR-zone integration; lower weight than collision sports without contact.' },
      { key: 'snapCountProxy', weight: 0.8, source: 'Position-specific accelerometer cadence × intensity per detected football session.' },
      { key: 'sprintDistance', weight: 0.6, source: 'GPS distance above sprint threshold; weighted by position group.' },
      { key: 'sprintReps', weight: 0.5, source: 'GPS speed > 6.5 m/s sustained > 2s.' },
    ],
    thresholds: { low: 0.30, moderate: 0.55, high: 0.80, concerning: 1.00 },
    acwrCeiling: 1.4,
    decayHalfLifeDays: 8,
    recoveryDebtFloor: -0.22,
    contextModifiers: [
      { key: 'paddedPracticeBlock', multiplier: 1.15, rationale: 'Padded practice days compound contact load beyond what accelerometer counts alone capture.' },
      { key: 'heatExposure', multiplier: 1.08, rationale: 'Camp and early-season heat raises effective load even without higher distance.' },
      { key: 'travelDays', multiplier: 1.05, rationale: 'Long road trips disrupt sleep and recovery on top of match-week volume.' },
    ],
    prescribedComparisonWeights: { executedRepsFraction: 0.6, paceDeviation: 0.4, restDeviation: 0.5, volumeDeviation: 0.6, modalityDrift: 0.7 },
  },
};

const baseballReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['startingRole', 'reliefRole', 'travelImpact', 'heat', 'doubleheader', 'pitchCountWindow'],
  kpiRefs: ['pitchCount', 'inningsWorkload', 'throwingVelocity', 'strikePercentage', 'exitVelocity', 'onBasePercentage', 'popTime', 'armCareReadiness'],
  weeklyRead: {
    reportLenses: [
      { id: 'throwing_volume_role', label: 'Throwing volume by role', inputFamilies: ['sport_metric_pitch_count', 'sport_metric_innings_workload', 'recovery'], linkedDimensions: ['focus'] },
      { id: 'pitch_at_bat_routine_quality', label: 'Pitch-to-pitch and at-bat routine quality', inputFamilies: ['focus_trend', 'protocol_effectiveness'], linkedDimensions: ['focus'] },
      { id: 'command_confidence_slump_reset', label: 'Command confidence and slump reset', inputFamilies: ['composure_trend', 'sentiment', 'sport_metric_strike_percentage'], linkedDimensions: ['composure'] },
      { id: 'long_game_fueling_heat', label: 'Long-game fueling and heat', inputFamilies: ['nutrition_hydration_context', 'heat_context', 'recovery'], linkedDimensions: ['composure', 'focus'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'pitcher_catcher_readiness', label: 'Pitcher and catcher readiness', inputFamilies: ['sport_metric_arm_care_readiness', 'recovery'], linkedDimensions: ['focus', 'composure'] },
      { id: 'bullpen_timing', label: 'Bullpen timing', inputFamilies: ['recovery', 'sport_metric_pitch_count'], linkedDimensions: ['decisioning'] },
      { id: 'low_frequency_high_pressure_actions', label: 'Low-frequency high-pressure actions', inputFamilies: ['decisioning_trend', 'composure_trend'], linkedDimensions: ['decisioning', 'composure'] },
      { id: 'dugout_fueling_practicality', label: 'Dugout fueling practicality', inputFamilies: ['nutrition_hydration_context', 'block_length'], linkedDimensions: ['focus', 'composure'] },
    ],
  },
  watchlistSignals: [
    { id: 'throwing_workload_spike', label: 'Throwing-workload spike', inputFamilies: ['sport_metric_pitch_count', 'sport_metric_innings_workload', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'command_volatility_with_poor_recovery', label: 'Command volatility with poor recovery', inputFamilies: ['sport_metric_strike_percentage', 'recovery'], linkedDimensions: ['composure'] },
    { id: 'slump_rumination_confidence_drop', label: 'Slump rumination and confidence drop', inputFamilies: ['sentiment', 'composure_trend'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'protect_arm_care_window', label: 'Protect arm-care window', linkedSignals: ['throwing_workload_spike', 'pitcher_catcher_readiness'] },
    { id: 'keep_cueing_routine_based', label: 'Keep cueing routine-based', linkedSignals: ['pitch_at_bat_routine_quality'] },
    { id: 'use_at_bat_reset_prompts', label: 'Use at-bat-to-at-bat reset prompts', linkedSignals: ['command_confidence_slump_reset'] },
  ],
  earlyWarningFamilies: [
    { id: 'arm_load_overuse_pattern', label: 'Arm-load overuse pattern', inputFamilies: ['sport_metric_pitch_count', 'sport_metric_innings_workload', 'recovery'] },
    { id: 'sustained_command_drop', label: 'Sustained command drop with sentiment shift', inputFamilies: ['sport_metric_strike_percentage', 'sentiment'] },
    { id: 'heat_block_underfueling', label: 'Heat-block underfueling', inputFamilies: ['nutrition_hydration_context', 'heat_context'] },
  ],
  languagePosture: {
    summary: 'Pitch-to-pitch and at-bat-to-at-bat language focused on approach, command, routine, and reset.',
    recommendedLanguage: ['approach', 'command', 'routine', 'reset', 'at-bat', 'inning', 'count', 'pitch'],
    mustAvoid: ['Throwing pain diagnosis', 'Swing or pitching rebuilds', 'Pitcher and position-player equivalence'],
  },
  dimensionMap: {
    focus: ['pitch-to-pitch routine', 'plate approach', 'defensive readiness'],
    composure: ['command anxiety', 'slump reset', 'response after errors'],
    decisioning: ['pitch selection', 'swing/take approach', 'situational choices'],
  },
  loadModel: {
    summary: 'Throwing-volume + at-bat-density sport; pitcher arm-care drives a hard ceiling, while position players blend throwing volume with at-bat density and HR-zone time.',
    primitives: [
      { key: 'pitchCount', weight: 1.0, source: 'Detected pitch events per session (pitchers); blended with throwing volume for catchers.' },
      { key: 'throwingVolume', weight: 0.9, source: 'Accelerometer throw-signature count across the practice/game window.' },
      { key: 'innings', weight: 0.7, source: 'Detected innings of activity per pitcher; cap-aware.' },
      { key: 'atBatDensity', weight: 0.5, source: 'Detected swing events × game density (position players).' },
      { key: 'internalLoadHr', weight: 0.4, source: 'HR-zone integration; secondary input for a low-aerobic-density sport.' },
    ],
    thresholds: { low: 0.25, moderate: 0.55, high: 0.80, concerning: 1.00 },
    acwrCeiling: 1.4,
    decayHalfLifeDays: 9,
    recoveryDebtFloor: -0.20,
    contextModifiers: [
      { key: 'pitchCountWindow', multiplier: 1.20, rationale: 'Pitchers inside the arm-care window compound load far beyond aerobic cost.' },
      { key: 'doubleHeader', multiplier: 1.12, rationale: 'Doubleheaders push at-bat and throwing volume past a single-game ceiling.' },
      { key: 'travelDays', multiplier: 1.06, rationale: 'Bus + flight road trips add fatigue beyond the box score.' },
    ],
    prescribedComparisonWeights: { executedRepsFraction: 0.8, paceDeviation: 0.4, restDeviation: 0.7, volumeDeviation: 0.8, modalityDrift: 0.6 },
  },
};

const softballReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['tournamentDay', 'doubleheader', 'travelImpact', 'heat', 'allDayWindow'],
  kpiRefs: ['pitchCount', 'pitchVelocity', 'strikePercentage', 'exitVelocity', 'onBasePercentage', 'popTime', 'reactionReadiness'],
  weeklyRead: {
    reportLenses: [
      { id: 'tournament_rhythm', label: 'Tournament rhythm', inputFamilies: ['training_load', 'recovery', 'sentiment'], linkedDimensions: ['composure'] },
      { id: 'throwing_volume_catcher_fatigue', label: 'Throwing volume and catcher fatigue', inputFamilies: ['sport_metric_pitch_count', 'role_context_catcher', 'recovery'], linkedDimensions: ['focus'] },
      { id: 'reaction_window_readiness', label: 'Reaction-window readiness', inputFamilies: ['sport_metric_reaction_readiness', 'recovery'], linkedDimensions: ['focus'] },
      { id: 'confidence_after_errors_at_bats', label: 'Confidence after errors or tough at-bats', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'all_day_fueling_heat', label: 'All-day fueling and heat', inputFamilies: ['nutrition_hydration_context', 'heat_context'], linkedDimensions: ['focus', 'composure'] },
      { id: 'pitcher_catcher_workload', label: 'Pitcher and catcher workload', inputFamilies: ['sport_metric_pitch_count', 'role_context_catcher'], linkedDimensions: ['focus'] },
      { id: 'pitch_to_pitch_reset', label: 'Pitch-to-pitch reset', inputFamilies: ['composure_trend', 'protocol_effectiveness'], linkedDimensions: ['composure'] },
      { id: 'defensive_reaction_readiness', label: 'Defensive reaction readiness', inputFamilies: ['sport_metric_reaction_readiness', 'recovery'], linkedDimensions: ['focus'] },
    ],
  },
  watchlistSignals: [
    { id: 'tournament_underfueling', label: 'Tournament underfueling', inputFamilies: ['nutrition_hydration_context', 'training_load'], linkedDimensions: ['composure', 'focus'] },
    { id: 'throwing_workload_spike', label: 'Throwing-workload spike', inputFamilies: ['sport_metric_pitch_count', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'error_carryover', label: 'Error carryover', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
    { id: 'catcher_fatigue', label: 'Catcher fatigue', inputFamilies: ['role_context_catcher', 'recovery', 'sport_metric_pitch_count'], linkedDimensions: ['focus'] },
  ],
  coachActions: [
    { id: 'plan_predictable_fueling_windows', label: 'Plan predictable fueling windows', linkedSignals: ['tournament_underfueling', 'all_day_fueling_heat'] },
    { id: 'adjust_extra_throwing_volume', label: 'Adjust extra throwing volume', linkedSignals: ['throwing_workload_spike', 'pitcher_catcher_workload'] },
    { id: 'use_inning_reset_cues', label: 'Use inning-to-inning reset cues', linkedSignals: ['error_carryover', 'pitch_to_pitch_reset'] },
  ],
  earlyWarningFamilies: [
    { id: 'all_day_underfueling_pattern', label: 'All-day underfueling pattern', inputFamilies: ['nutrition_hydration_context', 'training_load', 'heat_context'] },
    { id: 'arm_load_overuse_pattern', label: 'Arm-load overuse pattern', inputFamilies: ['sport_metric_pitch_count', 'recovery'] },
    { id: 'sustained_error_carryover', label: 'Sustained error carryover with sentiment drop', inputFamilies: ['composure_trend', 'sentiment'] },
  ],
  languagePosture: {
    summary: 'Pitch-to-pitch, inning-to-inning, dugout-practical language with short action cues.',
    recommendedLanguage: ['approach', 'reset', 'inning', 'pitch', 'dugout', 'fueling window', 'next at-bat'],
    mustAvoid: ['Throwing rehab guidance', 'Mechanical rebuilds', 'Ignoring all-day tournament logistics'],
  },
  dimensionMap: {
    focus: ['pitch-to-pitch routine', 'defensive reaction', 'dugout reset'],
    composure: ['error carryover', 'tough at-bat recovery', 'tournament pressure'],
    decisioning: ['pitch command', 'situational hitting', 'baserunning choices'],
  },
  loadModel: {
    summary: 'Tournament-density sport with windmill-pitcher load profile; pitch count, throwing volume, and Day-2 stamina dominate; nutrition coverage is part of the load story.',
    primitives: [
      { key: 'pitchCount', weight: 1.0, source: 'Detected windmill pitch signature (pitchers); blended with throwing volume for catchers/utility.' },
      { key: 'throwingVolume', weight: 0.8, source: 'Accelerometer throw-signature count (position players).' },
      { key: 'tournamentDayDensity', weight: 0.7, source: 'Number of detected games × innings within a single tournament day.' },
      { key: 'atBatDensity', weight: 0.5, source: 'Detected swing events × game density.' },
      { key: 'internalLoadHr', weight: 0.5, source: 'HR-zone integration; tournament heat exposure can raise this disproportionately.' },
    ],
    thresholds: { low: 0.30, moderate: 0.60, high: 0.85, concerning: 1.05 },
    acwrCeiling: 1.5,
    decayHalfLifeDays: 6,
    recoveryDebtFloor: -0.20,
    contextModifiers: [
      { key: 'tournamentBlock', multiplier: 1.18, rationale: 'Multi-game tournament days compound throwing and HR-zone load across the weekend.' },
      { key: 'heatExposure', multiplier: 1.10, rationale: 'Outdoor tournament heat raises effective load on long-day events.' },
      { key: 'thinAtBatFueling', multiplier: 1.08, rationale: 'All-day fueling thinness amplifies tournament fatigue (input from Macra coverage flag).' },
    ],
    prescribedComparisonWeights: { executedRepsFraction: 0.7, paceDeviation: 0.4, restDeviation: 0.6, volumeDeviation: 0.7, modalityDrift: 0.6 },
  },
};

const volleyballReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['tournamentWave', 'travelImpact', 'matchGap', 'rotationRole'],
  kpiRefs: ['attackPercentage', 'serveReceiveRating', 'acesErrorsRatio', 'blockTouches', 'digsPerSet', 'jumpCount', 'approachJump'],
  weeklyRead: {
    reportLenses: [
      { id: 'jump_landing_load', label: 'Jump and landing load', inputFamilies: ['sport_metric_jump_count', 'recovery', 'external_load'], linkedDimensions: ['focus'] },
      { id: 'serve_receive_composure', label: 'Serve-receive composure', inputFamilies: ['sport_metric_serve_receive_rating', 'composure_trend'], linkedDimensions: ['composure'] },
      { id: 'setter_decision_speed', label: 'Setter decision speed', inputFamilies: ['decisioning_trend', 'role_context_setter'], linkedDimensions: ['decisioning'] },
      { id: 'shoulder_volume_tournament_waves', label: 'Shoulder volume and tournament waves', inputFamilies: ['external_load', 'recovery', 'block_length'], linkedDimensions: ['focus'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'rotation_role_readiness', label: 'Rotation-role readiness', inputFamilies: ['recovery', 'role_context_position'], linkedDimensions: ['focus'] },
      { id: 'point_to_point_reset', label: 'Point-to-point reset', inputFamilies: ['composure_trend', 'protocol_effectiveness'], linkedDimensions: ['composure'] },
      { id: 'serve_receive_pressure', label: 'Serve/receive pressure', inputFamilies: ['sport_metric_serve_receive_rating', 'composure_trend'], linkedDimensions: ['composure'] },
      { id: 'long_match_gaps', label: 'Long gaps between matches', inputFamilies: ['recovery', 'block_length', 'nutrition_hydration_context'], linkedDimensions: ['focus', 'composure'] },
    ],
  },
  watchlistSignals: [
    { id: 'jump_count_spike_low_recovery', label: 'Jump-count spike with degraded recovery', inputFamilies: ['sport_metric_jump_count', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'serve_receive_anxiety', label: 'Serve-receive anxiety', inputFamilies: ['sport_metric_serve_receive_rating', 'sentiment'], linkedDimensions: ['composure'] },
    { id: 'communication_breakdown', label: 'Communication breakdown', inputFamilies: ['sentiment', 'composure_trend'], linkedDimensions: ['composure'] },
    { id: 'tournament_underfueling', label: 'Tournament underfueling', inputFamilies: ['nutrition_hydration_context', 'training_load'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'adjust_jump_volume', label: 'Adjust jump volume', linkedSignals: ['jump_count_spike_low_recovery', 'jump_landing_load'] },
    { id: 'reinforce_point_reset_routines', label: 'Reinforce point-reset routines', linkedSignals: ['point_to_point_reset'] },
    { id: 'time_fueling_around_play_windows', label: 'Keep fueling light and timed around play windows', linkedSignals: ['tournament_underfueling', 'long_match_gaps'] },
  ],
  earlyWarningFamilies: [
    { id: 'jump_load_overuse_pattern', label: 'Jump-load overuse pattern', inputFamilies: ['sport_metric_jump_count', 'recovery'] },
    { id: 'serve_receive_confidence_drop', label: 'Sustained serve-receive confidence drop', inputFamilies: ['sport_metric_serve_receive_rating', 'sentiment'] },
    { id: 'tournament_communication_collapse', label: 'Tournament communication collapse', inputFamilies: ['sentiment', 'composure_trend'] },
  ],
  languagePosture: {
    summary: 'Point-to-point language focused on platform, read, rotation, timing, communication, and reset.',
    recommendedLanguage: ['platform', 'read', 'rotation', 'timing', 'communication', 'reset', 'point', 'set'],
    mustAvoid: ['Generic confidence advice', 'Shoulder/knee rehab claims', 'Ignoring tournament match gaps'],
  },
  dimensionMap: {
    focus: ['serve receive', 'rotation responsibility', 'setter attention'],
    composure: ['point-to-point reset', 'communication after errors', 'pressure serving'],
    decisioning: ['setter choice speed', 'defensive read', 'block/attack timing'],
  },
};

const tennisReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['surface', 'matchDuration', 'tournamentDensity', 'heat', 'singlesVsDoubles'],
  kpiRefs: ['firstServePercentage', 'secondServePointsWon', 'unforcedErrors', 'winnersToErrors', 'breakPointConversion', 'matchDuration', 'sessionRpe'],
  weeklyRead: {
    reportLenses: [
      { id: 'match_duration_uncertainty', label: 'Match-duration uncertainty', inputFamilies: ['sport_metric_match_duration', 'recovery'], linkedDimensions: ['composure', 'focus'] },
      { id: 'between_point_routine', label: 'Between-point routine', inputFamilies: ['focus_trend', 'protocol_effectiveness'], linkedDimensions: ['focus'] },
      { id: 'surface_playing_style', label: 'Surface and playing style', inputFamilies: ['decisioning_trend', 'context_modifier_surface'], linkedDimensions: ['decisioning'] },
      { id: 'heat_tournament_density', label: 'Heat and tournament density', inputFamilies: ['heat_context', 'training_load', 'recovery'], linkedDimensions: ['focus', 'composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'serve_confidence', label: 'Serve confidence', inputFamilies: ['sport_metric_first_serve_pct', 'composure_trend'], linkedDimensions: ['composure', 'focus'] },
      { id: 'point_construction', label: 'Point construction', inputFamilies: ['decisioning_trend', 'sport_metric_winners_to_errors'], linkedDimensions: ['decisioning'] },
      { id: 'changeover_fueling', label: 'Changeover fueling', inputFamilies: ['nutrition_hydration_context', 'heat_context'], linkedDimensions: ['focus', 'composure'] },
      { id: 'singles_vs_doubles_decision_demand', label: 'Singles vs doubles decision demand', inputFamilies: ['decisioning_trend', 'role_context_format'], linkedDimensions: ['decisioning'] },
    ],
  },
  watchlistSignals: [
    { id: 'unforced_error_rise_with_fatigue', label: 'Unforced-error rise with fatigue', inputFamilies: ['sport_metric_unforced_errors', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'heat_stress', label: 'Heat stress', inputFamilies: ['heat_context', 'nutrition_hydration_context'], linkedDimensions: ['composure', 'focus'] },
    { id: 'momentum_swing_volatility', label: 'Emotional momentum-swing volatility', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
    { id: 'grip_shoulder_fatigue', label: 'Grip and shoulder fatigue', inputFamilies: ['external_load', 'recovery'], linkedDimensions: ['focus'] },
  ],
  coachActions: [
    { id: 'use_between_point_reset_plans', label: 'Use between-point reset plans', linkedSignals: ['between_point_routine', 'momentum_swing_volatility'] },
    { id: 'prepare_portable_fueling_sodium', label: 'Prepare portable fueling and sodium', linkedSignals: ['changeover_fueling', 'heat_stress'] },
    { id: 'keep_tactical_cue_count_low', label: 'Keep tactical cue count low', linkedSignals: ['point_construction', 'unforced_error_rise_with_fatigue'] },
  ],
  earlyWarningFamilies: [
    { id: 'heat_block_overload', label: 'Heat-block overload', inputFamilies: ['heat_context', 'training_load'] },
    { id: 'sustained_serve_confidence_drop', label: 'Sustained serve-confidence drop', inputFamilies: ['sport_metric_first_serve_pct', 'sentiment'] },
    { id: 'momentum_collapse_pattern', label: 'Momentum-collapse pattern', inputFamilies: ['composure_trend', 'sentiment'] },
  ],
  languagePosture: {
    summary: 'Between-point and changeover language focused on serve + 1, patterns, reset, momentum, and court position.',
    recommendedLanguage: ['serve + 1', 'pattern', 'reset', 'momentum', 'court position', 'changeover', 'point construction'],
    mustAvoid: ['Overloading swing thoughts', 'Assuming match length', 'Treating singles and doubles as identical'],
  },
  dimensionMap: {
    focus: ['between-point routine', 'serve target', 'pattern commitment'],
    composure: ['momentum swings', 'break points', 'response after errors'],
    decisioning: ['point construction', 'serve + 1 choice', 'doubles positioning'],
  },
};

const swimmingReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['eventDistance', 'taperState', 'sessionDouble', 'travelImpact', 'meetTiming'],
  kpiRefs: ['raceTime', 'splitConsistency', 'strokeRate', 'strokeCount', 'startReaction', 'underwaterDistance', 'sessionRpe'],
  weeklyRead: {
    reportLenses: [
      { id: 'stroke_event_distance', label: 'Stroke and event-distance demand', inputFamilies: ['training_load', 'role_context_event'], linkedDimensions: ['focus'] },
      { id: 'training_volume_doubles', label: 'Training volume and double sessions', inputFamilies: ['external_load', 'recovery', 'sleep'], linkedDimensions: ['composure', 'focus'] },
      { id: 'taper_state', label: 'Taper state', inputFamilies: ['training_load', 'sentiment', 'recovery'], linkedDimensions: ['composure'] },
      { id: 'starts_turns_split_consistency', label: 'Starts/turns and split consistency', inputFamilies: ['sport_metric_split_consistency', 'sport_metric_start_reaction'], linkedDimensions: ['focus', 'decisioning'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'race_segment_readiness', label: 'Race-segment readiness', inputFamilies: ['focus_trend', 'sport_metric_split_consistency'], linkedDimensions: ['focus', 'decisioning'] },
      { id: 'warm_up_race_timing', label: 'Warm-up and race timing', inputFamilies: ['protocol_effectiveness', 'sentiment'], linkedDimensions: ['focus'] },
      { id: 'water_feel', label: 'Water feel', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
      { id: 'start_turn_anxiety', label: 'Anxiety around start/turn execution', inputFamilies: ['composure_trend', 'sport_metric_start_reaction'], linkedDimensions: ['composure'] },
    ],
  },
  watchlistSignals: [
    { id: 'heavy_volume_poor_sleep', label: 'Heavy volume with poor sleep', inputFamilies: ['external_load', 'sleep', 'recovery'], linkedDimensions: ['composure', 'focus'] },
    { id: 'split_fade_trend', label: 'Split-fade trend', inputFamilies: ['sport_metric_split_consistency', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'start_reaction_drop', label: 'Start-reaction drop', inputFamilies: ['sport_metric_start_reaction', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'taper_anxiety', label: 'Taper anxiety', inputFamilies: ['sentiment', 'composure_trend'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'align_cues_to_race_segment', label: 'Align cues to race segment', linkedSignals: ['race_segment_readiness', 'split_fade_trend'] },
    { id: 'protect_recovery_during_taper', label: 'Protect recovery during taper', linkedSignals: ['taper_state', 'taper_anxiety'] },
    { id: 'use_rhythm_based_language', label: 'Use rhythm-based language', linkedSignals: ['warm_up_race_timing', 'water_feel'] },
  ],
  earlyWarningFamilies: [
    { id: 'taper_overload_pattern', label: 'Taper overload or under-taper pattern', inputFamilies: ['training_load', 'sentiment', 'recovery'] },
    { id: 'split_consistency_collapse', label: 'Split-consistency collapse', inputFamilies: ['sport_metric_split_consistency', 'recovery'] },
    { id: 'travel_meet_sleep_disruption', label: 'Travel/meet sleep disruption', inputFamilies: ['travel_impact', 'sleep'] },
  ],
  languagePosture: {
    summary: 'Race-segment language focused on start, breakout, turn, underwater, split, finish, and rhythm.',
    recommendedLanguage: ['start', 'breakout', 'turn', 'underwater', 'split', 'finish', 'rhythm', 'breath'],
    mustAvoid: ['Generic conditioning advice', 'Ignoring event distance', 'Assuming low hydration need because sweat is less visible'],
  },
  dimensionMap: {
    focus: ['race plan', 'start/turn execution', 'split awareness'],
    composure: ['race anxiety', 'taper nerves', 'response after a poor heat or swim'],
    decisioning: ['pacing choices', 'race-segment adjustment', 'relay exchange discipline'],
  },
};

const trackFieldReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['eventGroup', 'meetSchedule', 'heat', 'wind', 'taperState', 'travelImpact'],
  kpiRefs: ['personalBest', 'seasonBest', 'splitTime', 'approachSpeed', 'jumpDistanceHeight', 'throwDistance', 'sessionRpe'],
  weeklyRead: {
    reportLenses: [
      { id: 'event_group_demands', label: 'Event-group demands', inputFamilies: ['training_load', 'role_context_event_group'], linkedDimensions: ['focus'] },
      { id: 'meet_schedule_heat', label: 'Meet schedule and heat', inputFamilies: ['heat_context', 'training_load', 'recovery'], linkedDimensions: ['composure'] },
      { id: 'approach_rhythm_consistency', label: 'Approach and rhythm consistency', inputFamilies: ['focus_trend', 'sport_metric_approach_speed', 'sport_metric_split_time'], linkedDimensions: ['focus'] },
      { id: 'body_composition_pressure', label: 'Body-composition pressure when relevant', inputFamilies: ['sentiment', 'nutrition_context'], linkedDimensions: ['composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'event_specific_arousal', label: 'Event-specific arousal', inputFamilies: ['composure_trend', 'protocol_effectiveness'], linkedDimensions: ['composure'] },
      { id: 'warm_up_timing', label: 'Warm-up timing', inputFamilies: ['protocol_effectiveness', 'role_context_event'], linkedDimensions: ['focus'] },
      { id: 'technical_rhythm', label: 'Technical rhythm', inputFamilies: ['focus_trend', 'sport_metric_approach_speed'], linkedDimensions: ['focus'] },
      { id: 'distance_vs_power_recovery', label: 'Distance vs power recovery needs', inputFamilies: ['recovery', 'role_context_event_group'], linkedDimensions: ['composure', 'focus'] },
    ],
  },
  watchlistSignals: [
    { id: 'speed_power_drop_high_load', label: 'Speed/power drop with high load', inputFamilies: ['training_load', 'recovery', 'sport_metric_split_time'], linkedDimensions: ['focus'] },
    { id: 'distance_underfueling', label: 'Distance-event underfueling', inputFamilies: ['nutrition_context', 'training_load'], linkedDimensions: ['composure'] },
    { id: 'approach_inconsistency', label: 'Approach inconsistency', inputFamilies: ['sport_metric_approach_speed', 'focus_trend'], linkedDimensions: ['focus'] },
    { id: 'meet_anxiety', label: 'Meet anxiety', inputFamilies: ['sentiment', 'composure_trend'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'separate_event_group_logic', label: 'Separate sprint/jump/throw/distance logic in the weekly plan', linkedSignals: ['event_group_demands', 'distance_vs_power_recovery'] },
    { id: 'use_event_specific_cueing', label: 'Use event-specific cueing', linkedSignals: ['approach_rhythm_consistency', 'technical_rhythm'] },
    { id: 'avoid_unnecessary_volume_meet_week', label: 'Avoid unnecessary volume near meet day', linkedSignals: ['speed_power_drop_high_load', 'meet_schedule_heat'] },
  ],
  earlyWarningFamilies: [
    { id: 'speed_power_collapse', label: 'Speed/power collapse pattern', inputFamilies: ['sport_metric_split_time', 'recovery', 'training_load'] },
    { id: 'distance_underfueling_pattern', label: 'Distance underfueling pattern', inputFamilies: ['nutrition_context', 'sentiment'] },
    { id: 'sustained_approach_breakdown', label: 'Sustained approach breakdown', inputFamilies: ['sport_metric_approach_speed', 'focus_trend'] },
  ],
  languagePosture: {
    summary: 'Event-group language focused on rhythm, split, approach, drive phase, clearance, release, and kick.',
    recommendedLanguage: ['rhythm', 'split', 'approach', 'drive phase', 'clearance', 'release', 'kick', 'heat', 'flight', 'taper'],
    // mustAvoid is enforced as a substring check by the report generator's audit,
    // so each entry is an atomic banned phrase rather than a meta-description.
    mustAvoid: ['rotation athletes', 'body-pressure containment', 'foul/miss', 'generic weight pressure', 'technical overhaul from readiness'],
  },
  dimensionMap: {
    focus: ['event routine', 'approach rhythm', 'split awareness'],
    composure: ['meet-day arousal', 'response after a foul or missed attempt', 'pressure containment in flights'],
    decisioning: ['warm-up timing', 'tactical pacing', 'jump/throw attempt selection'],
  },
  coachLanguageTranslations: {
    'sprint volume': 'sprint reps',
    'distance underfueling': 'distance group has been skipping pre-practice meals',
    'meet-day arousal': 'how amped they are at the line',
    'approach rhythm': 'their approach feels',
    'split awareness': 'feel for splits',
    'taper state': 'how the taper is going',
  },
};

const wrestlingReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['weighInWindow', 'weightCutStatus', 'tournamentBracket', 'travelImpact'],
  kpiRefs: ['weightDelta', 'matTime', 'takedownConversion', 'escapeRate', 'ridingTime', 'gripReadiness', 'sessionRpe'],
  weeklyRead: {
    reportLenses: [
      { id: 'weight_class_context', label: 'Weight-class context', inputFamilies: ['sport_metric_weight_delta', 'nutrition_context'], linkedDimensions: ['composure'] },
      { id: 'weigh_in_timing', label: 'Weigh-in timing', inputFamilies: ['nutrition_context', 'recovery', 'sport_metric_weight_delta'], linkedDimensions: ['focus', 'composure'] },
      { id: 'grip_mat_fatigue', label: 'Grip and mat fatigue', inputFamilies: ['sport_metric_grip_readiness', 'recovery'], linkedDimensions: ['focus'] },
      { id: 'match_emotional_control', label: 'Match-by-match emotional control', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'hydration_refuel_status', label: 'Hydration and refuel status', inputFamilies: ['nutrition_context', 'recovery'], linkedDimensions: ['focus', 'composure'] },
      { id: 'stance_hand_fight_readiness', label: 'Stance and hand-fight readiness', inputFamilies: ['focus_trend', 'sport_metric_grip_readiness'], linkedDimensions: ['focus'] },
      { id: 'fatigue_tolerance', label: 'Fatigue tolerance', inputFamilies: ['recovery', 'training_load'], linkedDimensions: ['composure'] },
      { id: 'tournament_bracket_rhythm', label: 'Tournament bracket rhythm', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
    ],
  },
  watchlistSignals: [
    { id: 'aggressive_weight_delta', label: 'Aggressive weight delta', inputFamilies: ['sport_metric_weight_delta', 'nutrition_context'], linkedDimensions: ['composure'] },
    { id: 'hydration_risk', label: 'Hydration risk', inputFamilies: ['nutrition_context', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'grip_fatigue', label: 'Grip fatigue', inputFamilies: ['sport_metric_grip_readiness', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'confidence_drop_after_close_losses', label: 'Confidence drop after close losses', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'flag_unsafe_cut_patterns', label: 'Flag unsafe cut patterns', linkedSignals: ['aggressive_weight_delta', 'hydration_risk'] },
    { id: 'plan_post_weigh_in_refuel', label: 'Plan post-weigh-in refuel', linkedSignals: ['weigh_in_timing', 'hydration_refuel_status'] },
    { id: 'use_match_by_match_reset_language', label: 'Use match-by-match reset language', linkedSignals: ['match_emotional_control', 'confidence_drop_after_close_losses'] },
  ],
  earlyWarningFamilies: [
    { id: 'unsafe_weight_cut_pattern', label: 'Unsafe weight-cut pattern', inputFamilies: ['sport_metric_weight_delta', 'nutrition_context', 'recovery'] },
    { id: 'sustained_grip_fatigue', label: 'Sustained grip fatigue', inputFamilies: ['sport_metric_grip_readiness', 'recovery'] },
    { id: 'tournament_confidence_collapse', label: 'Tournament confidence collapse', inputFamilies: ['composure_trend', 'sentiment'] },
  ],
  languagePosture: {
    summary: 'Mat-specific language focused on stance, hand fight, shot, escape, ride, reset, and period.',
    recommendedLanguage: ['stance', 'hand fight', 'shot', 'escape', 'ride', 'reset', 'period', 'finish'],
    mustAvoid: ['Unsafe dehydration guidance', 'Weight-cut normalization', 'Injury or clearance advice'],
  },
  dimensionMap: {
    focus: ['stance', 'hand fighting', 'mat awareness'],
    composure: ['match-by-match reset', 'weight-class pressure', 'close-loss recovery'],
    decisioning: ['shot selection', 'escape timing', 'period strategy'],
  },
};

const crossfitReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['competitionFormat', 'eventSpacing', 'limiterFocus', 'travelImpact'],
  kpiRefs: ['benchmarkScore', 'oneRepMax', 'gymnasticsVolume', 'monostructuralPace', 'gripFatigue', 'sessionRpe', 'sleepQuality'],
  weeklyRead: {
    reportLenses: [
      { id: 'mixed_modal_density', label: 'Mixed-modal density', inputFamilies: ['training_load', 'recovery'], linkedDimensions: ['focus', 'composure'] },
      { id: 'limiter_identification', label: 'Limiter identification', inputFamilies: ['decisioning_trend', 'training_load'], linkedDimensions: ['decisioning'] },
      { id: 'grip_eccentric_load', label: 'Grip and eccentric load', inputFamilies: ['sport_metric_grip_fatigue', 'sport_metric_gymnastics_volume'], linkedDimensions: ['focus'] },
      { id: 'skill_strength_engine_separation', label: 'Skill, strength, and engine separation', inputFamilies: ['training_load', 'role_context_athlete_bias'], linkedDimensions: ['decisioning'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'event_spacing', label: 'Event spacing', inputFamilies: ['recovery', 'block_length'], linkedDimensions: ['decisioning'] },
      { id: 'gut_comfort_before_intensity', label: 'Gut comfort before intensity', inputFamilies: ['nutrition_context', 'sentiment'], linkedDimensions: ['focus'] },
      { id: 'pacing_strategy', label: 'Pacing strategy', inputFamilies: ['decisioning_trend', 'training_load'], linkedDimensions: ['decisioning'] },
      { id: 'movement_standards', label: 'Movement standards', inputFamilies: ['focus_trend', 'protocol_effectiveness'], linkedDimensions: ['focus'] },
    ],
  },
  watchlistSignals: [
    { id: 'grip_fatigue_with_gymnastics_spike', label: 'Grip fatigue with gymnastics-volume spike', inputFamilies: ['sport_metric_grip_fatigue', 'sport_metric_gymnastics_volume'], linkedDimensions: ['focus'] },
    { id: 'sleep_decline_high_density_block', label: 'Sleep decline during high-density block', inputFamilies: ['sleep', 'training_load'], linkedDimensions: ['composure'] },
    { id: 'overpacing_pattern', label: 'Overpacing pattern', inputFamilies: ['decisioning_trend', 'sport_metric_session_rpe'], linkedDimensions: ['decisioning'] },
  ],
  coachActions: [
    { id: 'separate_limiter_from_mindset', label: 'Separate limiter problem from mindset issue', linkedSignals: ['limiter_identification', 'overpacing_pattern'] },
    { id: 'protect_grip_shoulder_volume', label: 'Protect grip and shoulder volume', linkedSignals: ['grip_fatigue_with_gymnastics_spike', 'grip_eccentric_load'] },
    { id: 'plan_carbs_around_event_spacing', label: 'Plan carbs around event spacing', linkedSignals: ['event_spacing', 'gut_comfort_before_intensity'] },
  ],
  earlyWarningFamilies: [
    { id: 'sustained_grip_breakdown', label: 'Sustained grip breakdown', inputFamilies: ['sport_metric_grip_fatigue', 'sport_metric_gymnastics_volume', 'recovery'] },
    { id: 'sleep_debt_density_pattern', label: 'Sleep-debt high-density pattern', inputFamilies: ['sleep', 'training_load'] },
    { id: 'pacing_collapse', label: 'Pacing collapse', inputFamilies: ['decisioning_trend', 'sport_metric_session_rpe'] },
  ],
  languagePosture: {
    summary: 'Competition-floor language focused on event, limiter, standard, pacing, transition, engine, and skill.',
    recommendedLanguage: ['event', 'limiter', 'standard', 'pacing', 'transition', 'engine', 'skill', 'redline'],
    mustAvoid: ['Treating every miss as mental toughness', 'Ignoring movement standards', 'One fueling plan for all event types'],
  },
  dimensionMap: {
    focus: ['movement standards', 'transition discipline', 'pacing cues'],
    composure: ['response when workouts hurt', 'failed-rep recovery', 'leaderboard pressure'],
    decisioning: ['event pacing', 'limiter management', 'skill vs strength tradeoff'],
  },
};

const lacrosseReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['tournamentWeekend', 'travelImpact', 'heat', 'phaseRole', 'fieldSurface'],
  kpiRefs: ['points', 'shotsOnGoal', 'groundBalls', 'causedTurnovers', 'savePercentage', 'sprintRepeatReadiness', 'sessionRpe'],
  weeklyRead: {
    reportLenses: [
      { id: 'two_way_sprint_demand', label: 'Two-way sprint demand', inputFamilies: ['external_load', 'sport_metric_sprint_repeat_readiness', 'recovery'], linkedDimensions: ['focus'] },
      { id: 'contact_tolerance', label: 'Contact tolerance', inputFamilies: ['recovery', 'external_load'], linkedDimensions: ['composure'] },
      { id: 'stick_skill_under_pressure', label: 'Stick skill under pressure', inputFamilies: ['focus_trend', 'protocol_effectiveness'], linkedDimensions: ['focus'] },
      { id: 'goalkeeper_confidence', label: 'Goalkeeper confidence when relevant', inputFamilies: ['composure_trend', 'sport_metric_save_percentage', 'role_context_goalkeeper'], linkedDimensions: ['composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'shift_possession_readiness', label: 'Shift and possession readiness', inputFamilies: ['recovery', 'sport_metric_sprint_repeat_readiness'], linkedDimensions: ['focus'] },
      { id: 'communication_after_turnovers', label: 'Communication after turnovers', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
      { id: 'ground_ball_effort_under_fatigue', label: 'Ground-ball effort under fatigue', inputFamilies: ['sport_metric_ground_balls', 'recovery'], linkedDimensions: ['focus'] },
      { id: 'heat_tournament_recovery', label: 'Heat and tournament recovery', inputFamilies: ['heat_context', 'recovery'], linkedDimensions: ['composure'] },
    ],
  },
  watchlistSignals: [
    { id: 'repeat_sprint_fatigue', label: 'Repeat sprint fatigue', inputFamilies: ['sport_metric_sprint_repeat_readiness', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'contact_accumulation', label: 'Contact accumulation', inputFamilies: ['external_load', 'recovery'], linkedDimensions: ['composure'] },
    { id: 'turnover_carryover', label: 'Turnover carryover', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
    { id: 'goalie_confidence_swings', label: 'Goalie confidence swings', inputFamilies: ['composure_trend', 'sport_metric_save_percentage', 'role_context_goalkeeper'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'adjust_high_speed_contact_dose', label: 'Adjust high-speed and contact dose', linkedSignals: ['repeat_sprint_fatigue', 'contact_accumulation'] },
    { id: 'use_possession_reset_language', label: 'Use possession reset language', linkedSignals: ['turnover_carryover', 'communication_after_turnovers'] },
    { id: 'emphasize_communication_ground_balls', label: 'Emphasize communication and ground-ball actions', linkedSignals: ['ground_ball_effort_under_fatigue'] },
  ],
  earlyWarningFamilies: [
    { id: 'sprint_load_overuse', label: 'Sprint-load overuse pattern', inputFamilies: ['sport_metric_sprint_repeat_readiness', 'recovery'] },
    { id: 'goalie_confidence_drop', label: 'Sustained goalie confidence drop', inputFamilies: ['composure_trend', 'sport_metric_save_percentage', 'sentiment'] },
    { id: 'tournament_recovery_collapse', label: 'Tournament-recovery collapse', inputFamilies: ['recovery', 'heat_context', 'sleep'] },
  ],
  languagePosture: {
    summary: 'Shift and possession language focused on dodge, clear, slide, ground ball, reset, and next play.',
    recommendedLanguage: ['shift', 'possession', 'dodge', 'clear', 'slide', 'ground ball', 'reset', 'next play'],
    mustAvoid: ['Goalie/field-player flattening', 'Injury rehab advice', 'Ignoring contact and sprint density'],
  },
  dimensionMap: {
    focus: ['stick skill under pressure', 'communication', 'ground-ball readiness'],
    composure: ['turnover carryover', 'goalie confidence', 'contact response'],
    decisioning: ['dodge/pass choices', 'defensive slides', 'clearing decisions'],
  },
};

const hockeyReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['gameDensity', 'travelImpact', 'usageRole', 'shiftPattern', 'lateNightGame'],
  kpiRefs: ['timeOnIce', 'averageShiftLength', 'shotsOnGoal', 'faceoffWinRate', 'savePercentage', 'skateRepeatReadiness', 'sessionRpe'],
  weeklyRead: {
    reportLenses: [
      { id: 'shift_length_repeatability', label: 'Shift length and repeatability', inputFamilies: ['sport_metric_average_shift_length', 'sport_metric_skate_repeat_readiness'], linkedDimensions: ['focus'] },
      { id: 'contact_accumulation', label: 'Contact accumulation', inputFamilies: ['external_load', 'recovery'], linkedDimensions: ['composure'] },
      { id: 'puck_decisions_under_pressure', label: 'Puck decisions under pressure', inputFamilies: ['decisioning_trend', 'sentiment'], linkedDimensions: ['decisioning'] },
      { id: 'goalie_tracking_confidence', label: 'Goalie tracking and confidence when relevant', inputFamilies: ['composure_trend', 'sport_metric_save_percentage', 'role_context_goalie'], linkedDimensions: ['composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'bench_reset', label: 'Bench reset', inputFamilies: ['composure_trend', 'protocol_effectiveness'], linkedDimensions: ['composure'] },
      { id: 'skate_repeat_readiness', label: 'Skating repeat readiness', inputFamilies: ['sport_metric_skate_repeat_readiness', 'recovery'], linkedDimensions: ['focus'] },
      { id: 'late_night_game_travel_sleep', label: 'Late-night game and travel sleep', inputFamilies: ['sleep', 'travel_impact'], linkedDimensions: ['focus', 'composure'] },
      { id: 'cold_rink_hydration', label: 'Cold-rink hydration blind spots', inputFamilies: ['nutrition_hydration_context'], linkedDimensions: ['focus'] },
    ],
  },
  watchlistSignals: [
    { id: 'shift_fatigue', label: 'Shift fatigue', inputFamilies: ['sport_metric_average_shift_length', 'recovery'], linkedDimensions: ['composure'] },
    { id: 'puck_decision_panic', label: 'Puck decision panic', inputFamilies: ['decisioning_trend', 'sentiment'], linkedDimensions: ['decisioning'] },
    { id: 'goalie_confidence_swings', label: 'Goalie confidence swings', inputFamilies: ['composure_trend', 'sport_metric_save_percentage', 'role_context_goalie'], linkedDimensions: ['composure'] },
    { id: 'underhydration', label: 'Underhydration in cold environments', inputFamilies: ['nutrition_hydration_context'], linkedDimensions: ['focus'] },
  ],
  coachActions: [
    { id: 'adjust_shift_workload_expectations', label: 'Adjust shift and workload expectations', linkedSignals: ['shift_fatigue', 'shift_length_repeatability'] },
    { id: 'use_bench_reset_cueing', label: 'Use bench-reset cueing', linkedSignals: ['bench_reset', 'puck_decision_panic'] },
    { id: 'separate_goalie_skater_recommendations', label: 'Separate goalie and skater recommendations', linkedSignals: ['goalie_confidence_swings', 'goalie_tracking_confidence'] },
  ],
  earlyWarningFamilies: [
    { id: 'shift_overload_pattern', label: 'Shift-overload pattern', inputFamilies: ['sport_metric_average_shift_length', 'recovery'] },
    { id: 'goalie_confidence_drop', label: 'Sustained goalie confidence drop', inputFamilies: ['composure_trend', 'sport_metric_save_percentage', 'sentiment'] },
    { id: 'cold_rink_hydration_pattern', label: 'Cold-rink hydration pattern', inputFamilies: ['nutrition_hydration_context'] },
  ],
  languagePosture: {
    summary: 'Shift-by-shift language focused on puck decision, gap, tracking, bench reset, net-front, and next shift.',
    recommendedLanguage: ['shift', 'puck decision', 'gap', 'tracking', 'bench reset', 'net-front', 'next shift'],
    mustAvoid: ['Goalie and skater equivalence', 'Concussion or injury guidance', 'Ignoring game density and shift length'],
  },
  dimensionMap: {
    focus: ['shift discipline', 'puck tracking', 'goalie visual routine'],
    composure: ['bench reset', 'contact response', 'goalie confidence swings'],
    decisioning: ['puck decisions under pressure', 'gap choice', 'shift-change timing'],
  },
};

const gymnasticsReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['skillStage', 'meetWindow', 'apparatusFocus', 'recoverySensitivity'],
  kpiRefs: ['difficultyScore', 'executionScore', 'routineHitRate', 'stuckLandings', 'skillAttempts', 'landingLoad', 'sessionRpe'],
  weeklyRead: {
    reportLenses: [
      { id: 'apparatus_skill_stage', label: 'Apparatus and skill stage', inputFamilies: ['training_load', 'role_context_apparatus'], linkedDimensions: ['focus'] },
      { id: 'fear_block_routine_confidence', label: 'Fear blocks and routine confidence', inputFamilies: ['sentiment', 'composure_trend'], linkedDimensions: ['composure'] },
      { id: 'landing_load', label: 'Landing load', inputFamilies: ['sport_metric_landing_load', 'recovery'], linkedDimensions: ['focus'] },
      { id: 'meet_day_composure', label: 'Meet-day composure', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'routine_readiness', label: 'Routine readiness', inputFamilies: ['focus_trend', 'sport_metric_routine_hit_rate'], linkedDimensions: ['focus'] },
      { id: 'air_awareness_confidence', label: 'Air-awareness confidence', inputFamilies: ['composure_trend', 'sentiment'], linkedDimensions: ['composure'] },
      { id: 'psychological_safety', label: 'Psychological safety', inputFamilies: ['sentiment', 'composure_trend'], linkedDimensions: ['composure'] },
      { id: 'apparatus_specific_cueing', label: 'Apparatus-specific cueing', inputFamilies: ['focus_trend', 'role_context_apparatus'], linkedDimensions: ['focus'] },
    ],
  },
  watchlistSignals: [
    { id: 'fear_block_escalation', label: 'Fear-block escalation', inputFamilies: ['sentiment', 'composure_trend'], linkedDimensions: ['composure'] },
    { id: 'landing_load_spike', label: 'Landing-load spike', inputFamilies: ['sport_metric_landing_load', 'recovery'], linkedDimensions: ['focus'] },
    { id: 'restrictive_eating_pressure', label: 'Restrictive eating pressure', inputFamilies: ['sentiment', 'nutrition_context'], linkedDimensions: ['composure'] },
    { id: 'perfectionism_spiral', label: 'Perfectionism spiral', inputFamilies: ['sentiment', 'composure_trend'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'use_safe_progression_language', label: 'Use safe, precise progression language', linkedSignals: ['fear_block_routine_confidence', 'routine_readiness'] },
    { id: 'separate_courage_from_readiness', label: 'Separate courage from readiness', linkedSignals: ['fear_block_escalation', 'air_awareness_confidence'] },
    { id: 'encourage_support_staff_communication', label: 'Encourage support-staff communication when needed', linkedSignals: ['restrictive_eating_pressure', 'perfectionism_spiral'] },
  ],
  earlyWarningFamilies: [
    { id: 'restrictive_eating_pattern', label: 'Restrictive eating pattern', inputFamilies: ['sentiment', 'nutrition_context'] },
    { id: 'fear_block_pattern', label: 'Sustained fear-block pattern', inputFamilies: ['sentiment', 'composure_trend'] },
    { id: 'landing_load_overuse', label: 'Landing-load overuse pattern', inputFamilies: ['sport_metric_landing_load', 'recovery'] },
  ],
  languagePosture: {
    summary: 'Psychologically safe apparatus language focused on routine, landing, connection, air awareness, confidence, and progression.',
    recommendedLanguage: ['routine', 'landing', 'connection', 'air awareness', 'confidence', 'progression', 'apparatus'],
    mustAvoid: ['Weight or leanness shortcuts', 'Return-to-skill clearance', 'Shaming fear responses'],
  },
  dimensionMap: {
    focus: ['routine sequence', 'apparatus cue', 'landing attention'],
    composure: ['fear blocks', 'meet-day nerves', 'perfectionism spiral'],
    decisioning: ['skill readiness communication', 'routine progression', 'attempt selection'],
  },
};

const bodybuildingPhysiqueReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['prepPhase', 'weeksOut', 'peakWeek', 'foodVarianceTolerance', 'travelImpact'],
  kpiRefs: ['weeksOut', 'stageWeightTarget', 'cardioMinutesPerWeek', 'fastedWeightAverage', 'dailySteps', 'posingMinutes', 'waistMeasurement'],
  weeklyRead: {
    reportLenses: [
      { id: 'prep_phase_show_timeline', label: 'Prep phase and show timeline', inputFamilies: ['role_context_prep_phase', 'sport_metric_weeks_out'], linkedDimensions: ['focus', 'decisioning'] },
      { id: 'food_variance_tolerance', label: 'Food variance tolerance', inputFamilies: ['nutrition_context', 'sentiment'], linkedDimensions: ['composure'] },
      { id: 'cardio_steps_load', label: 'Cardio and steps load', inputFamilies: ['sport_metric_cardio_minutes_per_week', 'sport_metric_daily_steps'], linkedDimensions: ['focus'] },
      { id: 'posing_practice_recovery', label: 'Posing practice and recovery', inputFamilies: ['sport_metric_posing_minutes', 'recovery'], linkedDimensions: ['focus'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'peak_week_status', label: 'Peak-week status', inputFamilies: ['role_context_prep_phase', 'sport_metric_weeks_out'], linkedDimensions: ['decisioning', 'composure'] },
      { id: 'predictable_approved_foods', label: 'Predictable approved foods', inputFamilies: ['nutrition_context', 'role_context_approved_foods'], linkedDimensions: ['focus'] },
      { id: 'flatness_spillover_indicators', label: 'Flatness or spillover indicators', inputFamilies: ['sentiment', 'sport_metric_fasted_weight_average'], linkedDimensions: ['composure'] },
      { id: 'post_show_reverse_guardrails', label: 'Post-show reverse guardrails', inputFamilies: ['nutrition_context', 'sentiment'], linkedDimensions: ['composure'] },
    ],
  },
  watchlistSignals: [
    { id: 'target_mismatch', label: 'Target mismatch', inputFamilies: ['nutrition_context', 'sport_metric_fasted_weight_average'], linkedDimensions: ['decisioning'] },
    { id: 'digestion_variance', label: 'Digestion variance', inputFamilies: ['nutrition_context', 'sentiment'], linkedDimensions: ['composure'] },
    { id: 'rebound_overeating_risk', label: 'Rebound overeating risk', inputFamilies: ['sentiment', 'nutrition_context'], linkedDimensions: ['composure'] },
    { id: 'unsafe_restriction_pressure', label: 'Unsafe restriction pressure', inputFamilies: ['sentiment', 'nutrition_context'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'audit_against_coach_set_macros', label: 'Audit against coach-set macros', linkedSignals: ['target_mismatch'] },
    { id: 'keep_adjustments_controlled', label: 'Keep adjustments controlled', linkedSignals: ['flatness_spillover_indicators', 'food_variance_tolerance'] },
    { id: 'use_prep_phase_specific_language', label: 'Use prep-phase-specific language', linkedSignals: ['prep_phase_show_timeline', 'peak_week_status'] },
  ],
  earlyWarningFamilies: [
    { id: 'unsafe_restriction_pattern', label: 'Unsafe restriction pattern', inputFamilies: ['sentiment', 'nutrition_context'] },
    { id: 'rebound_pattern', label: 'Rebound pattern after show', inputFamilies: ['sentiment', 'nutrition_context'] },
    { id: 'sustained_target_mismatch', label: 'Sustained target mismatch', inputFamilies: ['nutrition_context', 'sport_metric_fasted_weight_average'] },
  ],
  languagePosture: {
    summary: 'Precise prep-coach language focused on weeks out, phase, division, flatness, spillover, reverse, and approved foods.',
    recommendedLanguage: ['weeks out', 'phase', 'division', 'flatness', 'spillover', 'reverse', 'approved foods', 'macros'],
    mustAvoid: ['Generic food swaps near show window', 'Casual weight-loss advice', 'Undermining coach-locked macros'],
  },
  dimensionMap: {
    focus: ['prep execution', 'posing attention', 'food consistency'],
    composure: ['scale volatility', 'peak-week anxiety', 'post-show rebound pressure'],
    decisioning: ['controlled adjustments', 'coach-macro adherence', 'food variance choices'],
  },
};

const otherReportPolicy: PulseCheckSportReportPolicy = {
  contextModifiers: ['unknownDiscipline', 'competitionPhase', 'movementDemand'],
  kpiRefs: ['competitionDate', 'trainingLoad', 'sessionRpe', 'readinessScore', 'performanceScore'],
  weeklyRead: {
    reportLenses: [
      { id: 'clarify_discipline_movement_demand', label: 'Clarify discipline and movement demand', inputFamilies: ['role_context_sport_detail'], linkedDimensions: ['focus'] },
      { id: 'competition_phase', label: 'Competition phase', inputFamilies: ['role_context_competition_phase'], linkedDimensions: ['decisioning'] },
      { id: 'training_load_recovery', label: 'Training load and recovery', inputFamilies: ['training_load', 'recovery'], linkedDimensions: ['composure'] },
      { id: 'mental_performance_demand', label: 'Mental performance demand', inputFamilies: ['focus_trend', 'composure_trend', 'decisioning_trend'], linkedDimensions: ['focus', 'composure', 'decisioning'] },
    ],
  },
  gameDayRead: {
    reportLenses: [
      { id: 'known_competition_duration', label: 'Known competition duration', inputFamilies: ['role_context_competition_duration'], linkedDimensions: ['focus'] },
      { id: 'movement_energy_system_demand', label: 'Movement and energy-system demand', inputFamilies: ['training_load', 'recovery'], linkedDimensions: ['focus'] },
      { id: 'heat_travel_recovery_context', label: 'Heat, travel, and recovery context', inputFamilies: ['heat_context', 'travel_impact', 'recovery'], linkedDimensions: ['composure'] },
      { id: 'confidence_focus_needs', label: 'Confidence and focus needs', inputFamilies: ['composure_trend', 'focus_trend'], linkedDimensions: ['focus', 'composure'] },
    ],
  },
  watchlistSignals: [
    { id: 'missing_sport_context', label: 'Missing sport context', inputFamilies: ['role_context_sport_detail'], linkedDimensions: ['decisioning'] },
    { id: 'unknown_movement_demand', label: 'Unknown movement demand', inputFamilies: ['role_context_sport_detail'], linkedDimensions: ['focus'] },
    { id: 'generic_advice_risk', label: 'Generic advice risk', inputFamilies: ['role_context_sport_detail'], linkedDimensions: ['decisioning'] },
    { id: 'unverified_injury_context', label: 'Unverified injury context', inputFamilies: ['role_context_sport_detail', 'sentiment'], linkedDimensions: ['composure'] },
  ],
  coachActions: [
    { id: 'ask_one_clarifying_question', label: 'Ask one clarifying question before precision', linkedSignals: ['missing_sport_context', 'unknown_movement_demand'] },
    { id: 'keep_recommendations_adaptable', label: 'Keep recommendations adaptable', linkedSignals: ['generic_advice_risk'] },
    { id: 'flag_need_for_sport_specific_config', label: 'Flag need for sport-specific configuration if recurring', linkedSignals: ['missing_sport_context'] },
  ],
  earlyWarningFamilies: [
    { id: 'persistent_missing_context', label: 'Persistent missing-context pattern', inputFamilies: ['role_context_sport_detail'] },
    { id: 'generic_advice_drift', label: 'Generic-advice drift', inputFamilies: ['role_context_sport_detail', 'sentiment'] },
    { id: 'unverified_injury_signal', label: 'Unverified injury signal', inputFamilies: ['role_context_sport_detail', 'sentiment'] },
  ],
  languagePosture: {
    summary: 'Transparent assumption language focused on discipline, role, phase, load, movement demand, and competition duration.',
    recommendedLanguage: ['discipline', 'role', 'phase', 'load', 'movement demand', 'competition duration', 'assumption'],
    mustAvoid: ['Pretending sport-specific certainty', 'Injury diagnosis', 'Over-specific recommendations from incomplete context'],
  },
  dimensionMap: {
    focus: ['discipline-specific routine and attention demands'],
    composure: ['pressure response and recovery after disruption'],
    decisioning: ['sport-specific tactical or execution choices once context is known'],
  },
};

const DEFAULT_PULSECHECK_SPORTS: PulseCheckSportConfigurationEntry[] = [
  sportDefaults({
    id: 'basketball',
    name: 'Basketball',
    emoji: '🏀',
    positions: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
    sortOrder: 0,
    attributes: [
      attribute('basketball', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('basketball', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('basketball', 'primaryRoleDemand', 'Primary Role Demand', 'singleSelect', 'athlete', 2, {
        options: options(['Primary Ball Handler', 'Secondary Creator', 'Off-Ball Shooter', '3-and-D Wing', 'Rim Runner', 'Interior Anchor']),
      }),
      attribute('basketball', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 3, {
        options: options(['Shooting Confidence', 'Decision Speed', 'Late-Game Composure', 'Defensive Pressure', 'Contact Finishing', 'Conditioning']),
      }),
      attribute('basketball', 'movementDemand', 'Movement Demand', 'multiSelect', 'athlete', 4, {
        options: options(['Acceleration / Deceleration', 'Lateral Containment', 'Jumping / Landing', 'Change of Direction', 'Contact Balance', 'Repeat Sprint']),
      }),
      attribute('basketball', 'currentLoadPattern', 'Current Load Pattern', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('basketball', 'minutesPerGame', 'Minutes / Game', 'min', 'competition', 0),
      metric('basketball', 'usageRole', 'Usage Role', '%', 'competition', 1),
      metric('basketball', 'assistTurnoverRatio', 'Assist-to-Turnover Ratio', 'ratio', 'competition', 2),
      metric('basketball', 'freeThrowPercentage', 'Free Throw %', '%', 'competition', 3),
      metric('basketball', 'verticalJump', 'Vertical Jump', 'in', 'athlete', 4),
      metric('basketball', 'repeatSprintReadiness', 'Repeat Sprint Readiness', 'score', 'recovery', 5),
      metric('basketball', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach basketball through role, pace, spacing, decision speed, emotional regulation, and repeat high-intensity movement. Tie advice to position demands and game context before giving mindset or performance guidance.',
      macraNutritionContext: 'Basketball nutrition should account for game density, minutes, travel, sweat rate, repeat sprint demand, and late-game energy. Adjust fueling and recovery around practices, lifts, and games rather than generic macro advice.',
      riskFlags: ['late-game fatigue', 'decision fatigue', 'confidence volatility', 'ankle or knee load', 'jump landing volume', 'travel sleep disruption', 'high-minute overreach'],
      restrictedAdvice: basketballReportPolicy.languagePosture.mustAvoid,
      recommendedLanguage: basketballReportPolicy.languagePosture.recommendedLanguage,
    },
    reportPolicy: basketballReportPolicy,
  }),
  sportDefaults({
    id: 'soccer',
    name: 'Soccer',
    emoji: '⚽',
    positions: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
    sortOrder: 1,
    attributes: [
      attribute('soccer', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('soccer', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('soccer', 'tacticalDemand', 'Tactical Demand', 'multiSelect', 'athlete', 2, {
        options: options(['High Press', 'Possession Build-Up', 'Transition Running', 'Set Pieces', '1v1 Defending', 'Chance Creation']),
      }),
      attribute('soccer', 'dominantFoot', 'Dominant Foot', 'singleSelect', 'athlete', 3, { options: HANDEDNESS_OPTIONS }),
      attribute('soccer', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Scanning', 'First Touch', 'Composure Under Pressure', 'Finishing', 'Defensive Timing', 'Communication']),
      }),
      attribute('soccer', 'matchLoadPattern', 'Match Load Pattern', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('soccer', 'minutesPerMatch', 'Minutes / Match', 'min', 'competition', 0),
      metric('soccer', 'totalDistance', 'Total Distance', 'km', 'competition', 1),
      metric('soccer', 'highSpeedRuns', 'High-Speed Runs', 'count', 'competition', 2),
      metric('soccer', 'sprintDistance', 'Sprint Distance', 'm', 'competition', 3),
      metric('soccer', 'touchesUnderPressure', 'Touches Under Pressure', 'count', 'competition', 4),
      metric('soccer', 'passCompletionUnderPressure', 'Pass Completion Under Pressure', '%', 'competition', 5),
      metric('soccer', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach soccer through position, tactical system, scanning, decision windows, aerobic-repeat sprint demands, and emotional control after mistakes. Goalkeepers require separate confidence, communication, and reaction framing.',
      macraNutritionContext: 'Soccer fueling should reflect match minutes, high-speed running, heat, travel, and fixture congestion. Prioritize glycogen restoration, hydration, and recovery timing around matches and heavy training.',
      riskFlags: ['fixture congestion', 'hamstring or groin load', 'confidence after mistakes', 'underfueling during high-speed blocks', 'heat stress', 'travel fatigue'],
      restrictedAdvice: ['Do not give one-size-fits-all conditioning advice across positions.', 'Do not suggest aggressive body-weight changes in-season without performance staff context.', 'Do not overcoach technique without knowing tactical role.'],
      recommendedLanguage: ['Use match-phase language: build-up, transition, final third, defending.', 'Frame mindset around the next action and communication.', 'Connect biomechanics to repeatable field behaviors.'],
    },
    reportPolicy: soccerReportPolicy,
  }),
  sportDefaults({
    id: 'football',
    name: 'Football',
    emoji: '🏈',
    positions: ['Quarterback', 'Running Back', 'Wide Receiver', 'Tight End', 'Offensive Line', 'Defensive Line', 'Linebacker', 'Cornerback', 'Safety', 'Kicker'],
    sortOrder: 2,
    attributes: [
      attribute('football', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('football', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('football', 'unit', 'Primary Unit', 'singleSelect', 'athlete', 2, { options: options(['Offense', 'Defense', 'Special Teams', 'Two-Way']) }),
      attribute('football', 'contactLoad', 'Contact Load', 'singleSelect', 'recovery', 3, {
        options: options(['Low Contact', 'Moderate Contact', 'Heavy Contact', 'Game Week Recovery', 'Return to Contact']),
        includeInMacraContext: true,
      }),
      attribute('football', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Assignment Discipline', 'Explosive First Step', 'Route / Coverage Timing', 'Pocket Poise', 'Tackling Confidence', 'Communication']),
      }),
      attribute('football', 'bodyCompositionGoal', 'Body Composition Goal', 'singleSelect', 'nutrition', 5, {
        options: options(['Maintain', 'Lean Mass Gain', 'Reduce Fat Mass', 'Position-Specific Weight Target', 'No Active Change']),
        includeInMacraContext: true,
      }),
    ],
    metrics: [
      metric('football', 'snapCount', 'Snap Count', 'snaps', 'competition', 0),
      metric('football', 'explosivePlays', 'Explosive Plays', 'count', 'competition', 1),
      metric('football', 'missedAssignments', 'Missed Assignments', 'count', 'competition', 2),
      metric('football', 'tenYardSplit', '10-Yard Split', 'sec', 'athlete', 3),
      metric('football', 'bodyWeight', 'Body Weight', 'lb', 'nutrition', 4),
      metric('football', 'collisionLoad', 'Collision Load', 'score', 'recovery', 5),
      metric('football', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach football by unit, position, playbook responsibility, collision exposure, explosive intent, and arousal control. Prioritize assignment clarity and repeatable pre-snap or pre-play routines.',
      macraNutritionContext: 'Football nutrition should account for position body composition goals, collision recovery, heat, camp load, and weekly game rhythm. Fueling differs sharply between skill, big-skill, linemen, and specialists.',
      riskFlags: ['collision fatigue', 'playbook overload', 'weight manipulation pressure', 'camp under-recovery', 'heat stress', 'over-arousal', 'return-to-contact risk'],
      restrictedAdvice: ['Do not recommend body-weight changes without position and staff context.', 'Do not give medical concussion or injury-clearance advice.', 'Do not flatten all positions into the same conditioning or nutrition plan.'],
      recommendedLanguage: ['Use direct position-room language.', 'Translate psychology into pre-snap routines and next-play resets.', 'Respect staff, scheme, and return-to-play boundaries.'],
    },
    reportPolicy: footballReportPolicy,
  }),
  sportDefaults({
    id: 'baseball',
    name: 'Baseball',
    emoji: '⚾',
    positions: ['Pitcher', 'Catcher', 'First Base', 'Second Base', 'Third Base', 'Shortstop', 'Left Field', 'Center Field', 'Right Field'],
    sortOrder: 3,
    attributes: [
      attribute('baseball', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('baseball', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('baseball', 'roleType', 'Role Type', 'singleSelect', 'athlete', 2, { options: options(['Pitcher', 'Catcher', 'Position Player', 'Two-Way', 'Designated Hitter']) }),
      attribute('baseball', 'handedness', 'Throw / Hit Handedness', 'singleSelect', 'athlete', 3, { options: options(['R/R', 'R/L', 'L/R', 'L/L', 'Switch Hitter']) }),
      attribute('baseball', 'throwingVolumePhase', 'Throwing Volume Phase', 'singleSelect', 'recovery', 4, {
        options: options(['Build-Up', 'Maintenance', 'High Volume', 'Deload', 'Return to Throw']),
        includeInMacraContext: true,
      }),
      attribute('baseball', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 5, {
        options: options(['Plate Approach', 'Pitch Command', 'Velocity', 'Receiving / Blocking', 'Throwing Accuracy', 'Slump Reset']),
      }),
    ],
    metrics: [
      metric('baseball', 'pitchCount', 'Pitch Count', 'pitches', 'competition', 0),
      metric('baseball', 'inningsWorkload', 'Innings Workload', 'innings', 'competition', 1),
      metric('baseball', 'throwingVelocity', 'Throwing Velocity', 'mph', 'athlete', 2),
      metric('baseball', 'strikePercentage', 'Strike %', '%', 'competition', 3),
      metric('baseball', 'exitVelocity', 'Exit Velocity', 'mph', 'competition', 4),
      metric('baseball', 'onBasePercentage', 'On-Base %', '%', 'competition', 5),
      metric('baseball', 'popTime', 'Pop Time', 'sec', 'competition', 6),
      metric('baseball', 'armCareReadiness', 'Arm Care Readiness', 'score', 'recovery', 7),
    ],
    prompting: {
      noraContext: 'Coach baseball through role, throwing volume, pitch-to-pitch routines, attentional control during low-frequency high-pressure actions, and confidence during slumps or command volatility.',
      macraNutritionContext: 'Baseball nutrition should respect long game windows, travel, heat, bullpen timing, and throwing recovery. Keep fueling practical for dugout access and avoid heavy choices that disrupt game feel.',
      riskFlags: ['throwing workload spike', 'slump rumination', 'command anxiety', 'long-game underfueling', 'travel fatigue', 'heat and hydration issues'],
      restrictedAdvice: ['Do not diagnose throwing pain or prescribe rehab.', 'Do not rebuild swing or pitching mechanics without coach context.', 'Do not ignore pitcher versus position-player demands.'],
      recommendedLanguage: ['Use pitch-to-pitch and at-bat-to-at-bat language.', 'Emphasize routines, approach, and controllable reads.', 'Keep mechanical guidance cue-based and conservative.'],
    },
    reportPolicy: baseballReportPolicy,
  }),
  sportDefaults({
    id: 'softball',
    name: 'Softball',
    emoji: '🥎',
    positions: ['Pitcher', 'Catcher', 'First Base', 'Second Base', 'Third Base', 'Shortstop', 'Outfield'],
    sortOrder: 4,
    attributes: [
      attribute('softball', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('softball', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('softball', 'roleType', 'Role Type', 'singleSelect', 'athlete', 2, { options: options(['Pitcher', 'Catcher', 'Infielder', 'Outfielder', 'Utility', 'Designated Player']) }),
      attribute('softball', 'offensiveStyle', 'Offensive Style', 'singleSelect', 'athlete', 3, { options: options(['Power Hitter', 'Contact Hitter', 'Slapper', 'Baserunning Pressure', 'Situational Hitter']) }),
      attribute('softball', 'throwingVolumePhase', 'Throwing Volume Phase', 'singleSelect', 'recovery', 4, {
        options: options(['Build-Up', 'Maintenance', 'High Volume', 'Tournament Weekend', 'Return to Throw']),
        includeInMacraContext: true,
      }),
      attribute('softball', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 5, {
        options: options(['Pitch Command', 'Plate Confidence', 'Defensive Reaction', 'Catcher Leadership', 'Baserunning Aggression', 'Slump Reset']),
      }),
    ],
    metrics: [
      metric('softball', 'pitchCount', 'Pitch Count', 'pitches', 'competition', 0),
      metric('softball', 'pitchVelocity', 'Pitch Velocity', 'mph', 'competition', 1),
      metric('softball', 'strikePercentage', 'Strike %', '%', 'competition', 2),
      metric('softball', 'exitVelocity', 'Exit Velocity', 'mph', 'competition', 3),
      metric('softball', 'onBasePercentage', 'On-Base %', '%', 'competition', 4),
      metric('softball', 'popTime', 'Pop Time', 'sec', 'competition', 5),
      metric('softball', 'reactionReadiness', 'Reaction Readiness', 'score', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach softball through role, tournament rhythm, fast reaction windows, emotional steadiness, pitch-to-pitch resets, and confidence after errors or tough at-bats.',
      macraNutritionContext: 'Softball nutrition should account for tournament days, heat, repeated games, dugout fueling, and throwing recovery. Favor predictable foods, hydration, and small repeatable fueling windows.',
      riskFlags: ['tournament underfueling', 'heat stress', 'throwing workload spike', 'error carryover', 'slump rumination', 'catcher fatigue'],
      restrictedAdvice: ['Do not prescribe throwing rehab or diagnose pain.', 'Do not rebuild swing or pitching mechanics without coach context.', 'Do not ignore all-day tournament fueling logistics.'],
      recommendedLanguage: ['Use pitch-to-pitch and inning-to-inning reset language.', 'Keep cues short and action oriented.', 'Balance confidence with tactical approach.'],
    },
    reportPolicy: softballReportPolicy,
  }),
  sportDefaults({
    id: 'volleyball',
    name: 'Volleyball',
    emoji: '🏐',
    positions: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'],
    sortOrder: 5,
    attributes: [
      attribute('volleyball', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('volleyball', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('volleyball', 'rotationRole', 'Rotation Role', 'singleSelect', 'athlete', 2, { options: options(['Six-Rotation', 'Front Row', 'Back Row', 'Serving Specialist', 'Situational Sub']) }),
      attribute('volleyball', 'jumpLoadPhase', 'Jump Load Phase', 'singleSelect', 'recovery', 3, {
        options: options(['Low Jump Load', 'Normal Jump Load', 'High Jump Load', 'Tournament Weekend', 'Deload / Taper']),
        includeInMacraContext: true,
      }),
      attribute('volleyball', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Serve Receive', 'Setter Decision Speed', 'Attack Confidence', 'Blocking Timing', 'Defensive Read', 'Communication']),
      }),
      attribute('volleyball', 'movementDemand', 'Movement Demand', 'multiSelect', 'athlete', 5, {
        options: options(['Approach Jump', 'Lateral Shuffle', 'Landing Control', 'Shoulder Volume', 'Reaction / Read', 'Repeated Dive']),
      }),
    ],
    metrics: [
      metric('volleyball', 'attackPercentage', 'Attack %', '%', 'competition', 0),
      metric('volleyball', 'serveReceiveRating', 'Serve Receive Rating', 'score', 'competition', 1),
      metric('volleyball', 'acesErrorsRatio', 'Aces-to-Errors Ratio', 'ratio', 'competition', 2),
      metric('volleyball', 'blockTouches', 'Block Touches', 'count', 'competition', 3),
      metric('volleyball', 'digsPerSet', 'Digs / Set', 'count', 'competition', 4),
      metric('volleyball', 'jumpCount', 'Jump Count', 'jumps', 'recovery', 5),
      metric('volleyball', 'approachJump', 'Approach Jump', 'in', 'athlete', 6),
    ],
    prompting: {
      noraContext: 'Coach volleyball through role, rotation responsibility, communication, serve-receive composure, jump/landing load, shoulder volume, and point-to-point emotional reset.',
      macraNutritionContext: 'Volleyball nutrition should account for tournament waves, jump volume, shoulder load, hydration, and long gaps between matches. Keep fueling light, repeatable, and timed around play windows.',
      riskFlags: ['jump load spike', 'shoulder volume', 'serve-receive anxiety', 'communication breakdown', 'tournament underfueling', 'landing fatigue'],
      restrictedAdvice: ['Do not give generic confidence advice without rotation and role context.', 'Do not prescribe shoulder or knee rehab.', 'Do not ignore tournament timing and long match gaps.'],
      recommendedLanguage: ['Use point-to-point reset language.', 'Frame cues around read, platform, timing, and communication.', 'Separate technical cue from emotional reset.'],
    },
    reportPolicy: volleyballReportPolicy,
  }),
  sportDefaults({
    id: 'tennis',
    name: 'Tennis',
    emoji: '🎾',
    positions: ['Singles', 'Doubles'],
    sortOrder: 6,
    attributes: [
      attribute('tennis', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('tennis', 'matchFormat', 'Match Format', 'singleSelect', 'competition', 1, { options: options(['Singles', 'Doubles', 'Both', 'Tournament Multi-Match']) }),
      attribute('tennis', 'courtSurface', 'Court Surface', 'singleSelect', 'competition', 2, { options: options(['Hard Court', 'Clay', 'Grass', 'Indoor', 'Mixed']) }),
      attribute('tennis', 'playingStyle', 'Playing Style', 'singleSelect', 'athlete', 3, { options: options(['Aggressive Baseliner', 'Counterpuncher', 'Serve + 1', 'All-Court', 'Net Player']) }),
      attribute('tennis', 'scheduleDensity', 'Schedule Density', 'singleSelect', 'recovery', 4, {
        options: options(['Single Match', 'Tournament Day', 'Back-to-Back Days', 'Travel Week', 'Training Block']),
        includeInMacraContext: true,
      }),
      attribute('tennis', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 5, {
        options: options(['Serve Routine', 'Return Confidence', 'Unforced Error Control', 'Point Construction', 'Tie-Break Composure', 'Between-Point Reset']),
      }),
    ],
    metrics: [
      metric('tennis', 'firstServePercentage', 'First Serve %', '%', 'competition', 0),
      metric('tennis', 'secondServePointsWon', 'Second Serve Points Won', '%', 'competition', 1),
      metric('tennis', 'unforcedErrors', 'Unforced Errors', 'count', 'competition', 2),
      metric('tennis', 'winnersToErrors', 'Winners-to-Errors', 'ratio', 'competition', 3),
      metric('tennis', 'breakPointConversion', 'Break Point Conversion', '%', 'competition', 4),
      metric('tennis', 'matchDuration', 'Match Duration', 'min', 'competition', 5),
      metric('tennis', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach tennis through style, surface, point construction, between-point routines, emotional momentum, and repeated acceleration/deceleration. Treat singles and doubles decision demands differently.',
      macraNutritionContext: 'Tennis nutrition should account for match duration uncertainty, heat, sweat rate, tournament density, and court changeovers. Prioritize portable fueling, sodium, and recovery between matches.',
      riskFlags: ['heat stress', 'cramping risk', 'momentum spirals', 'serve yips', 'long-match underfueling', 'shoulder or elbow load', 'travel fatigue'],
      restrictedAdvice: ['Do not rebuild strokes without coach context.', 'Do not ignore surface and match duration uncertainty.', 'Do not give medical advice for tendon pain or cramping.'],
      recommendedLanguage: ['Use point-by-point and between-point language.', 'Give reset routines and tactical intentions.', 'Keep cues simple enough to use mid-match.'],
    },
    reportPolicy: tennisReportPolicy,
  }),
  sportDefaults({
    id: 'swimming',
    name: 'Swimming',
    emoji: '🏊',
    positions: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley'],
    sortOrder: 7,
    attributes: [
      attribute('swimming', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('swimming', 'primaryStroke', 'Primary Stroke', 'singleSelect', 'athlete', 1, { options: options(['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley', 'Distance Free']) }),
      attribute('swimming', 'eventDistance', 'Event Distance', 'singleSelect', 'competition', 2, {
        options: options(['Sprint', 'Middle Distance', 'Distance', 'Relay', 'Open Water']),
        includeInMacraContext: true,
      }),
      attribute('swimming', 'trainingPhase', 'Training Phase', 'singleSelect', 'season', 3, { options: options(['Base', 'Race Pace', 'Taper', 'Championship Meet', 'Recovery Block']), includeInMacraContext: true }),
      attribute('swimming', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Start Reaction', 'Underwaters', 'Turns', 'Pacing', 'Stroke Efficiency', 'Race Anxiety']),
      }),
      attribute('swimming', 'drylandLoad', 'Dryland Load', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('swimming', 'raceTime', 'Race Time', 'sec', 'competition', 0),
      metric('swimming', 'splitConsistency', 'Split Consistency', 'score', 'competition', 1),
      metric('swimming', 'strokeRate', 'Stroke Rate', 'strokes/min', 'competition', 2),
      metric('swimming', 'strokeCount', 'Stroke Count', 'count', 'competition', 3),
      metric('swimming', 'startReaction', 'Start Reaction', 'sec', 'competition', 4),
      metric('swimming', 'underwaterDistance', 'Underwater Distance', 'm', 'competition', 5),
      metric('swimming', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach swimming through event distance, stroke mechanics, pacing, taper state, race anxiety, start/turn execution, and water feel. Keep cues rhythm-based and specific to the race segment.',
      macraNutritionContext: 'Swimming nutrition should account for high training volume, double sessions, dryland, early practices, taper, and meet-day race timing. Recovery fueling and hydration matter even when sweat is less visible.',
      riskFlags: ['taper anxiety', 'underfueling during doubles', 'shoulder load', 'race pacing panic', 'meet-day fueling gaps', 'sleep disruption from early practice'],
      restrictedAdvice: ['Do not prescribe shoulder rehab or diagnose pain.', 'Do not give generic endurance advice without event distance.', 'Do not ignore taper or championship timing.'],
      recommendedLanguage: ['Use race-segment language: start, breakout, turn, finish.', 'Translate mindset into rhythm, breath, and execution cues.', 'Respect coach-defined stroke mechanics.'],
    },
    reportPolicy: swimmingReportPolicy,
  }),
  sportDefaults({
    id: 'track-field',
    name: 'Track & Field',
    emoji: '🏃',
    positions: ['Sprinter', 'Middle Distance', 'Long Distance', 'Jumper', 'Thrower', 'Hurdler'],
    sortOrder: 8,
    attributes: [
      attribute('track-field', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('track-field', 'eventGroup', 'Event Group', 'singleSelect', 'competition', 1, {
        options: options(['Sprints', 'Hurdles', 'Middle Distance', 'Distance', 'Jumps', 'Throws', 'Multi-Event']),
        required: true,
        includeInMacraContext: true,
      }),
      attribute('track-field', 'primaryEvent', 'Primary Event', 'text', 'competition', 2, { placeholder: '100m, 400m, Long Jump, Shot Put...' }),
      attribute('track-field', 'trainingPhase', 'Training Phase', 'singleSelect', 'season', 3, { options: options(['General Prep', 'Specific Prep', 'Competition', 'Championship Peak', 'Transition']), includeInMacraContext: true }),
      attribute('track-field', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Start / Acceleration', 'Max Velocity', 'Speed Endurance', 'Rhythm', 'Approach Consistency', 'Release / Takeoff', 'Race Anxiety']),
      }),
      attribute('track-field', 'loadSensitivity', 'Load Sensitivity', 'singleSelect', 'recovery', 5, { options: options(['Low', 'Moderate', 'High', 'Currently Managing Pain / Return']), includeInMacraContext: true }),
    ],
    metrics: [
      metric('track-field', 'personalBest', 'Personal Best', 'event unit', 'competition', 0),
      metric('track-field', 'seasonBest', 'Season Best', 'event unit', 'competition', 1),
      metric('track-field', 'splitTime', 'Split Time', 'sec', 'competition', 2),
      metric('track-field', 'approachSpeed', 'Approach Speed', 'm/s', 'competition', 3),
      metric('track-field', 'jumpDistanceHeight', 'Jump Distance / Height', 'm', 'competition', 4),
      metric('track-field', 'throwDistance', 'Throw Distance', 'm', 'competition', 5),
      metric('track-field', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach track and field by event group first. Sprint, hurdle, distance, jump, throw, and multi-event athletes have different arousal, rhythm, technical, and energy-system needs.',
      macraNutritionContext: 'Track nutrition should reflect event group, meet schedule, body composition pressure, training phase, and heat. Distance athletes, sprinters, jumpers, and throwers should not receive identical fueling advice.',
      riskFlags: ['event mismatch', 'peaking anxiety', 'hamstring or tendon load', 'underfueling in distance athletes', 'weight pressure', 'technical overthinking', 'meet-day timing errors'],
      restrictedAdvice: ['Do not give generic running advice without event group.', 'Do not prescribe injury rehab.', 'Do not recommend weight changes without event, phase, and staff context.'],
      recommendedLanguage: ['Use event-specific language and concise technical cues.', 'Separate arousal, rhythm, and execution.', 'Respect peaking and taper timing.'],
    },
    reportPolicy: trackFieldReportPolicy,
  }),
  sportDefaults({
    id: 'wrestling',
    name: 'Wrestling',
    emoji: '🤼',
    positions: ['Individual'],
    sortOrder: 9,
    attributes: [
      attribute('wrestling', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('wrestling', 'style', 'Style', 'singleSelect', 'competition', 1, { options: options(['Folkstyle', 'Freestyle', 'Greco-Roman', 'No-Gi / Hybrid']) }),
      attribute('wrestling', 'weightClass', 'Weight Class', 'text', 'competition', 2, { placeholder: 'e.g. 165 lb', includeInMacraContext: true }),
      attribute('wrestling', 'weightCutStatus', 'Weight Cut Status', 'singleSelect', 'nutrition', 3, {
        options: options(['Not Cutting', 'Small Cut', 'Moderate Cut', 'Aggressive Cut', 'Recovery From Weigh-In']),
        includeInMacraContext: true,
      }),
      attribute('wrestling', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Hand Fight Pressure', 'Shot Confidence', 'Bottom Escape', 'Top Control', 'Gas Tank', 'Match Composure']),
      }),
      attribute('wrestling', 'trainingLoadPattern', 'Training Load Pattern', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('wrestling', 'weightDelta', 'Weight Delta', 'lb', 'nutrition', 0),
      metric('wrestling', 'matTime', 'Mat Time', 'min', 'competition', 1),
      metric('wrestling', 'takedownConversion', 'Takedown Conversion', '%', 'competition', 2),
      metric('wrestling', 'escapeRate', 'Escape Rate', '%', 'competition', 3),
      metric('wrestling', 'ridingTime', 'Riding Time', 'sec', 'competition', 4),
      metric('wrestling', 'gripReadiness', 'Grip Readiness', 'score', 'recovery', 5),
      metric('wrestling', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach wrestling through style, weight class, stance, hand fighting, positional confidence, fatigue tolerance, and match-by-match emotional control. Weight-cut context changes everything.',
      macraNutritionContext: 'Wrestling nutrition must handle weight class, weigh-in timing, hydration, glycogen, and refuel strategy carefully. Flag aggressive cuts and avoid unsafe dehydration or rapid weight-loss guidance.',
      riskFlags: ['aggressive weight cut', 'dehydration risk', 'post-weigh-in rebound', 'gas tank drop', 'match anxiety', 'grip fatigue', 'overtraining during cut'],
      restrictedAdvice: ['Do not give unsafe dehydration, sauna, laxative, or crash-cut advice.', 'Do not diagnose injuries or skin conditions.', 'Do not ignore weigh-in timing when discussing food or fluids.'],
      recommendedLanguage: ['Be direct and safety-aware.', 'Use position-specific language: hand fight, shot, finish, ride, escape.', 'Separate weight management from performance identity.'],
    },
    reportPolicy: wrestlingReportPolicy,
  }),
  sportDefaults({
    id: 'crossfit',
    name: 'CrossFit',
    emoji: '🏋️',
    positions: ['Individual'],
    sortOrder: 10,
    attributes: [
      attribute('crossfit', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('crossfit', 'competitionFormat', 'Competition Format', 'singleSelect', 'competition', 1, { options: options(['Open / Online', 'Local Throwdown', 'Sanctioned Qualifier', 'Multi-Day Competition', 'Training Only']) }),
      attribute('crossfit', 'athleteBias', 'Athlete Bias', 'singleSelect', 'athlete', 2, { options: options(['Strength Bias', 'Engine Bias', 'Gymnastics Bias', 'Power Bias', 'Balanced']) }),
      attribute('crossfit', 'primaryLimiter', 'Primary Limiter', 'multiSelect', 'athlete', 3, {
        options: options(['Heavy Barbell', 'Gymnastics Skill', 'Monostructural Engine', 'Mixed Modal Pacing', 'Grip', 'Mobility']),
      }),
      attribute('crossfit', 'trainingLoadPattern', 'Training Load Pattern', 'singleSelect', 'recovery', 4, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
      attribute('crossfit', 'nutritionPriority', 'Nutrition Priority', 'singleSelect', 'nutrition', 5, {
        options: options(['Performance Fueling', 'Body Composition', 'Competition Day Strategy', 'Recovery', 'Gut Comfort']),
        includeInMacraContext: true,
      }),
    ],
    metrics: [
      metric('crossfit', 'benchmarkScore', 'Benchmark Score', 'score', 'competition', 0),
      metric('crossfit', 'oneRepMax', '1RM', 'lb', 'athlete', 1),
      metric('crossfit', 'gymnasticsVolume', 'Gymnastics Volume', 'reps', 'recovery', 2),
      metric('crossfit', 'monostructuralPace', 'Mono Pace', 'pace', 'competition', 3),
      metric('crossfit', 'gripFatigue', 'Grip Fatigue', 'score', 'recovery', 4),
      metric('crossfit', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 5),
      metric('crossfit', 'sleepQuality', 'Sleep Quality', 'score', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach CrossFit through mixed-modal demands, pacing, limiter identification, movement standards, competition format, and emotional control when workouts hurt. Separate skill, strength, and engine problems.',
      macraNutritionContext: 'CrossFit nutrition should consider training density, glycogen demand, gut comfort before high-intensity sessions, competition-day event spacing, and recovery from mixed eccentric and metabolic load.',
      riskFlags: ['redline pacing', 'underfueling high volume', 'grip blow-up', 'technical breakdown under fatigue', 'competition-day gut distress', 'sleep debt'],
      restrictedAdvice: ['Do not encourage reckless intensity through pain or technical failure.', 'Do not prescribe injury rehab.', 'Do not give generic macro cuts that compromise training quality.'],
      recommendedLanguage: ['Use limiter-based coaching.', 'Separate pacing, skill, strength, and recovery.', 'Keep competition advice event-sequence specific.'],
    },
    reportPolicy: crossfitReportPolicy,
  }),
  sportDefaults({
    id: 'golf',
    name: 'Golf',
    emoji: '⛳',
    positions: ['Individual'],
    sortOrder: 11,
    attributes: [
      attribute('golf', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('golf', 'handedness', 'Handedness', 'singleSelect', 'athlete', 1, { options: options(['Right-Handed', 'Left-Handed']) }),
      attribute('golf', 'playingContext', 'Playing Context', 'singleSelect', 'competition', 2, { options: options(['Tournament', 'Practice Round', 'Qualifying', 'Match Play', 'Recreational']) }),
      attribute('golf', 'courseDemand', 'Course Demand', 'multiSelect', 'competition', 3, {
        options: options(['Tight Driving', 'Wind', 'Firm Greens', 'Long Course', 'Wedge Scoring', 'Putting Speed Control']),
      }),
      attribute('golf', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Pre-Shot Routine', 'Driver Commitment', 'Approach Precision', 'Putting Confidence', 'Bad-Shot Reset', 'Course Management']),
      }),
      attribute('golf', 'physicalLoadContext', 'Physical Load Context', 'singleSelect', 'recovery', 5, { options: options(['Walking 18', 'Walking 36', 'Cart', 'Travel Week', 'Strength Block']), includeInMacraContext: true }),
    ],
    metrics: [
      metric('golf', 'scoringAverage', 'Scoring Average', 'strokes', 'competition', 0),
      metric('golf', 'fairwaysHit', 'Fairways Hit', '%', 'competition', 1),
      metric('golf', 'greensInRegulation', 'Greens in Regulation', '%', 'competition', 2),
      metric('golf', 'puttsPerRound', 'Putts / Round', 'count', 'competition', 3),
      metric('golf', 'upAndDownPercentage', 'Up-and-Down %', '%', 'competition', 4),
      metric('golf', 'clubSpeed', 'Club Speed', 'mph', 'athlete', 5),
      metric('golf', 'shotDispersion', 'Shot Dispersion', 'yd', 'competition', 6),
    ],
    prompting: {
      noraContext: 'Coach golf through pre-shot routine, commitment, course management, emotional recovery after bad shots, tempo, and fatigue over long rounds. Avoid cluttering the athlete with swing thoughts.',
      macraNutritionContext: 'Golf nutrition should account for long rounds, walking load, heat, caffeine timing, and steady energy without gut heaviness. Hydration and small fueling windows matter even when intensity feels low.',
      riskFlags: ['swing-thought overload', 'bad-shot carryover', 'late-round fatigue', 'heat dehydration', 'caffeine jitters', 'travel disruption'],
      restrictedAdvice: golfReportPolicy.languagePosture.mustAvoid,
      recommendedLanguage: golfReportPolicy.languagePosture.recommendedLanguage,
    },
    reportPolicy: golfReportPolicy,
  }),
  sportDefaults({
    id: 'bowling',
    name: 'Bowling',
    emoji: '🎳',
    positions: ['Anchor', 'Leadoff', 'Middle Lineup', 'Baker Rotation', 'Individual'],
    sortOrder: 12,
    attributes: [
      attribute('bowling', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('bowling', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('bowling', 'lineupRole', 'Lineup Role', 'singleSelect', 'athlete', 2, { options: options(['Anchor', 'Leadoff', 'Middle Lineup', 'Baker Rotation', 'Individual']) }),
      attribute('bowling', 'laneCondition', 'Lane Condition', 'singleSelect', 'competition', 3, { options: options(['House Shot', 'Sport Pattern', 'Short Oil', 'Medium Oil', 'Long Oil', 'Transitioning']) }),
      attribute('bowling', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Pre-Shot Routine', 'Spare Process', 'Lane Transition Reads', 'Anchor-Frame Composure', 'Target-Line Commitment', 'Tournament Stamina']),
      }),
      attribute('bowling', 'tournamentLoad', 'Tournament Load', 'singleSelect', 'recovery', 5, {
        options: options(['Single Match', 'Multi-Game Block', 'Baker Format', 'Multi-Day Tournament', 'Travel / Congested Schedule']),
        includeInMacraContext: true,
      }),
    ],
    metrics: [
      metric('bowling', 'frameAverage', 'Frame Average', 'pins', 'competition', 0),
      metric('bowling', 'strikePercentage', 'Strike %', '%', 'competition', 1),
      metric('bowling', 'spareConversionPercentage', 'Spare Conversion %', '%', 'competition', 2),
      metric('bowling', 'singlePinSparePercentage', 'Single-Pin Spare %', '%', 'competition', 3),
      metric('bowling', 'openFrameRate', 'Open Frame Rate', '%', 'competition', 4),
      metric('bowling', 'firstBallCount', 'First-Ball Count', 'pins', 'competition', 5),
      metric('bowling', 'laneTransitionAdjustmentQuality', 'Lane Transition Adjustment Quality', 'score', 'competition', 6),
      metric('bowling', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 7),
    ],
    prompting: {
      noraContext: 'Coach bowling through pre-shot routine, spare process, target-line commitment, lane transition reads, tournament stamina, and emotional control after bad breaks or carry variance.',
      macraNutritionContext: 'Bowling nutrition should account for long tournament blocks, travel, hand/grip comfort, hydration, and steady energy without gut heaviness during repeated frames.',
      riskFlags: ['spare-process drift', 'carry-variance frustration', 'lane transition delay', 'tournament fatigue', 'travel disruption', 'hydration neglect'],
      restrictedAdvice: bowlingReportPolicy.languagePosture.mustAvoid,
      recommendedLanguage: bowlingReportPolicy.languagePosture.recommendedLanguage,
    },
    reportPolicy: bowlingReportPolicy,
  }),
  sportDefaults({
    id: 'lacrosse',
    name: 'Lacrosse',
    emoji: '🥍',
    positions: ['Attack', 'Midfield', 'Defense', 'Goalkeeper'],
    sortOrder: 13,
    attributes: [
      attribute('lacrosse', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('lacrosse', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('lacrosse', 'stickHand', 'Dominant Stick Hand', 'singleSelect', 'athlete', 2, { options: HANDEDNESS_OPTIONS }),
      attribute('lacrosse', 'phaseRole', 'Phase Role', 'singleSelect', 'athlete', 3, { options: options(['Dodger / Creator', 'Shooter', 'Two-Way Midfielder', 'Close Defender', 'LSM', 'Goalkeeper', 'Faceoff']) }),
      attribute('lacrosse', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Dodging Confidence', 'Shot Selection', 'Defensive Footwork', 'Clearing Composure', 'Communication', 'Ground Balls']),
      }),
      attribute('lacrosse', 'contactLoad', 'Contact Load', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('lacrosse', 'points', 'Points', 'count', 'competition', 0),
      metric('lacrosse', 'shotsOnGoal', 'Shots on Goal', '%', 'competition', 1),
      metric('lacrosse', 'groundBalls', 'Ground Balls', 'count', 'competition', 2),
      metric('lacrosse', 'causedTurnovers', 'Caused Turnovers', 'count', 'competition', 3),
      metric('lacrosse', 'savePercentage', 'Save %', '%', 'competition', 4),
      metric('lacrosse', 'sprintRepeatReadiness', 'Sprint Repeat Readiness', 'score', 'recovery', 5),
      metric('lacrosse', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach lacrosse through role, two-way sprint demand, stick skill under pressure, communication, contact tolerance, and fast emotional resets after turnovers or goals.',
      macraNutritionContext: 'Lacrosse nutrition should account for repeat sprint demand, contact load, tournament weekends, heat, and quick recovery between games or shifts.',
      riskFlags: ['repeat sprint fatigue', 'contact accumulation', 'turnover carryover', 'goalie confidence swings', 'heat stress', 'tournament underfueling'],
      restrictedAdvice: ['Do not flatten goalie and field-player demands.', 'Do not prescribe injury rehab.', 'Do not ignore contact and sprint density when discussing recovery.'],
      recommendedLanguage: ['Use shift, possession, and next-play language.', 'Translate mindset into communication and ground-ball actions.', 'Keep biomechanics tied to field movement.'],
    },
    reportPolicy: lacrosseReportPolicy,
  }),
  sportDefaults({
    id: 'hockey',
    name: 'Hockey',
    emoji: '🏒',
    positions: ['Forward', 'Defenseman', 'Goalie'],
    sortOrder: 14,
    attributes: [
      attribute('hockey', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('hockey', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 1, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('hockey', 'shotHand', 'Shot Hand', 'singleSelect', 'athlete', 2, { options: options(['Left Shot', 'Right Shot']) }),
      attribute('hockey', 'usageRole', 'Usage Role', 'singleSelect', 'athlete', 3, { options: options(['Top Line / Pair', 'Middle Rotation', 'Checking Role', 'Power Play', 'Penalty Kill', 'Goalie Starter', 'Goalie Backup']) }),
      attribute('hockey', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['First-Step Quickness', 'Puck Decisions', 'Defensive Gap', 'Net-Front Battles', 'Goalie Tracking', 'Shift Reset']),
      }),
      attribute('hockey', 'contactLoad', 'Contact Load', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('hockey', 'timeOnIce', 'Time on Ice', 'min', 'competition', 0),
      metric('hockey', 'averageShiftLength', 'Average Shift Length', 'sec', 'competition', 1),
      metric('hockey', 'shotsOnGoal', 'Shots on Goal', 'count', 'competition', 2),
      metric('hockey', 'faceoffWinRate', 'Faceoff Win %', '%', 'competition', 3),
      metric('hockey', 'savePercentage', 'Save %', '%', 'competition', 4),
      metric('hockey', 'skateRepeatReadiness', 'Skate Repeat Readiness', 'score', 'recovery', 5),
      metric('hockey', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach hockey through role, shift length, puck decisions under pressure, contact load, skating repeatability, bench resets, and goalie-specific tracking/confidence when relevant.',
      macraNutritionContext: 'Hockey nutrition should reflect game density, cold-rink hydration blind spots, contact recovery, shift intensity, travel, and late-night games.',
      riskFlags: ['shift fatigue', 'contact accumulation', 'puck decision panic', 'goalie confidence swings', 'travel sleep disruption', 'underhydration in cold environments'],
      restrictedAdvice: ['Do not give goalie and skater advice as if they are the same role.', 'Do not prescribe concussion or injury guidance.', 'Do not ignore shift length and game density.'],
      recommendedLanguage: ['Use shift-by-shift and bench-reset language.', 'Be direct and role-specific.', 'Connect skating mechanics to repeatable game actions.'],
    },
    reportPolicy: hockeyReportPolicy,
  }),
  sportDefaults({
    id: 'gymnastics',
    name: 'Gymnastics',
    emoji: '🤸',
    positions: ['Individual'],
    sortOrder: 15,
    attributes: [
      attribute('gymnastics', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 0, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('gymnastics', 'discipline', 'Discipline', 'singleSelect', 'competition', 1, { options: options(['Women Artistic', 'Men Artistic', 'Rhythmic', 'Trampoline', 'Acro', 'Tumbling']) }),
      attribute('gymnastics', 'apparatusFocus', 'Apparatus Focus', 'multiSelect', 'competition', 2, {
        options: options(['Vault', 'Bars', 'Beam', 'Floor', 'Rings', 'Pommel Horse', 'Parallel Bars', 'High Bar', 'Trampoline']),
      }),
      attribute('gymnastics', 'skillStage', 'Skill Stage', 'singleSelect', 'athlete', 3, { options: options(['Learning', 'Connecting', 'Routine Ready', 'Competition Polishing', 'Return to Skill']) }),
      attribute('gymnastics', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 4, {
        options: options(['Fear Block', 'Routine Confidence', 'Landing Control', 'Air Awareness', 'Beam Composure', 'Meet-Day Nerves']),
      }),
      attribute('gymnastics', 'recoverySensitivity', 'Recovery Sensitivity', 'singleSelect', 'recovery', 5, { options: options(['Low', 'Moderate', 'High', 'Growth / Load Sensitive', 'Return to Impact']), includeInMacraContext: true }),
    ],
    metrics: [
      metric('gymnastics', 'difficultyScore', 'Difficulty Score', 'score', 'competition', 0),
      metric('gymnastics', 'executionScore', 'Execution Score', 'score', 'competition', 1),
      metric('gymnastics', 'routineHitRate', 'Routine Hit Rate', '%', 'competition', 2),
      metric('gymnastics', 'stuckLandings', 'Stuck Landings', 'count', 'competition', 3),
      metric('gymnastics', 'skillAttempts', 'Skill Attempts', 'count', 'recovery', 4),
      metric('gymnastics', 'landingLoad', 'Landing Load', 'contacts', 'recovery', 5),
      metric('gymnastics', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 6),
    ],
    prompting: {
      noraContext: 'Coach gymnastics through apparatus, skill stage, fear blocks, routine confidence, air awareness, landing load, and meet-day composure. Psychological safety and coach boundaries matter.',
      macraNutritionContext: 'Gymnastics nutrition should support growth, recovery, concentration, and high-skill training without reinforcing harmful body pressure. Flag restrictive patterns and prioritize safe fueling language.',
      riskFlags: ['fear block', 'landing load spike', 'restrictive eating pressure', 'growth and recovery sensitivity', 'overuse pain', 'meet anxiety', 'perfectionism spiral'],
      restrictedAdvice: ['Do not encourage weight loss or leanness as a performance shortcut.', 'Do not prescribe injury rehab or return-to-skill clearance.', 'Do not shame fear responses.'],
      recommendedLanguage: ['Use psychologically safe, precise language.', 'Separate courage, readiness, and technical progression.', 'Reinforce communication with coach and support staff.'],
    },
    reportPolicy: gymnasticsReportPolicy,
  }),
  sportDefaults({
    id: 'bodybuilding-physique',
    name: 'Bodybuilding / Physique',
    emoji: '🏆',
    positions: ['Men’s Physique', 'Classic Physique', 'Bodybuilding', 'Bikini', 'Figure', 'Wellness', 'Fitness'],
    sortOrder: 16,
    attributes: [
      {
        id: 'physique-division',
        key: 'division',
        label: 'Division',
        type: 'singleSelect',
        scope: 'competition',
        required: true,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Men’s Physique', value: 'mens_physique' },
          { label: 'Classic Physique', value: 'classic_physique' },
          { label: 'Bodybuilding', value: 'bodybuilding' },
          { label: 'Bikini', value: 'bikini' },
          { label: 'Figure', value: 'figure' },
          { label: 'Wellness', value: 'wellness' },
          { label: 'Fitness', value: 'fitness' },
        ],
        sortOrder: 0,
      },
      {
        id: 'physique-competition-date',
        key: 'competitionDate',
        label: 'Competition Date',
        type: 'date',
        scope: 'competition',
        required: true,
        includeInNoraContext: true,
        includeInMacraContext: true,
        sortOrder: 1,
      },
      {
        id: 'physique-prep-phase',
        key: 'prepPhase',
        label: 'Prep Phase',
        type: 'singleSelect',
        scope: 'season',
        required: true,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Improvement Season', value: 'improvement_season' },
          { label: 'Contest Prep', value: 'contest_prep' },
          { label: 'Peak Week', value: 'peak_week' },
          { label: 'Post-Show Reverse', value: 'post_show_reverse' },
          { label: 'Off-Season', value: 'off_season' },
        ],
        sortOrder: 2,
      },
      {
        id: 'physique-food-variance',
        key: 'foodVarianceTolerance',
        label: 'Food Variance Tolerance',
        type: 'singleSelect',
        scope: 'nutrition',
        required: false,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
        ],
        sortOrder: 3,
      },
      {
        id: 'physique-approved-carb-sources',
        key: 'approvedCarbSources',
        label: 'Approved Carb Sources',
        type: 'multiSelect',
        scope: 'nutrition',
        required: false,
        includeInNoraContext: true,
        includeInMacraContext: true,
        options: [
          { label: 'Rice', value: 'rice' },
          { label: 'Cream of Rice', value: 'cream_of_rice' },
          { label: 'Potatoes', value: 'potatoes' },
          { label: 'Oats', value: 'oats' },
          { label: 'Rice Cakes', value: 'rice_cakes' },
        ],
        sortOrder: 4,
      },
      {
        id: 'physique-coach-macros-locked',
        key: 'coachMacrosLocked',
        label: 'Coach Macros Locked',
        type: 'boolean',
        scope: 'nutrition',
        required: false,
        includeInNoraContext: true,
        includeInMacraContext: true,
        sortOrder: 5,
      },
      attribute('bodybuilding-physique', 'posingPriority', 'Posing Priority', 'multiSelect', 'competition', 6, {
        options: options(['Front Pose', 'Back Pose', 'Transitions', 'Stage Presence', 'Mandatories', 'Routine Flow']),
      }),
      attribute('bodybuilding-physique', 'cardioLoad', 'Cardio Load', 'singleSelect', 'nutrition', 7, {
        options: options(['None', 'Low', 'Moderate', 'High', 'Peak Week Taper']),
        includeInMacraContext: true,
      }),
    ],
    metrics: [
      { id: 'physique-weeks-out', key: 'weeksOut', label: 'Weeks Out', unit: 'weeks', scope: 'competition', includeInNoraContext: true, sortOrder: 0 },
      { id: 'physique-stage-weight-target', key: 'stageWeightTarget', label: 'Stage Weight Target', unit: 'lb', scope: 'competition', includeInNoraContext: true, sortOrder: 1 },
      { id: 'physique-cardio-minutes', key: 'cardioMinutesPerWeek', label: 'Cardio Minutes / Week', unit: 'min', scope: 'nutrition', includeInNoraContext: true, sortOrder: 2 },
      metric('bodybuilding-physique', 'fastedWeightAverage', 'Fasted Weight Average', 'lb', 'nutrition', 3),
      metric('bodybuilding-physique', 'dailySteps', 'Daily Steps', 'steps', 'nutrition', 4),
      metric('bodybuilding-physique', 'posingMinutes', 'Posing Minutes', 'min', 'competition', 5),
      metric('bodybuilding-physique', 'waistMeasurement', 'Waist Measurement', 'in', 'competition', 6),
    ],
    prompting: {
      noraContext: 'Treat this athlete as a physique competitor. Always classify prep phase and show timeline before giving performance advice.',
      macraNutritionContext: 'In contest prep, peak week, or post-show reverse, audit macro targets against body size, show date, division, and food-variance tolerance. Favor predictable foods and controlled adjustments.',
      riskFlags: ['target mismatch', 'flatness', 'spillover', 'rebound overeating', 'digestion variance'],
      restrictedAdvice: ['Do not casually suggest fruit, whole grains, or generic starchy vegetables inside the near-show window unless already approved.'],
      recommendedLanguage: ['Use precise prep-coach language and explain when user-set targets should be questioned.'],
    },
    reportPolicy: bodybuildingPhysiqueReportPolicy,
  }),
  sportDefaults({
    id: 'other',
    name: 'Other',
    emoji: '🏅',
    positions: ['Individual'],
    sortOrder: 17,
    attributes: [
      attribute('other', 'sportDetail', 'Sport / Discipline Detail', 'text', 'athlete', 0, { placeholder: 'Describe the sport, event, or role' }),
      attribute('other', 'competitiveLevel', 'Competitive Level', 'singleSelect', 'athlete', 1, { options: COMPETITIVE_LEVEL_OPTIONS, includeInMacraContext: true }),
      attribute('other', 'seasonPhase', 'Season Phase', 'singleSelect', 'season', 2, { options: SEASON_PHASE_OPTIONS, includeInMacraContext: true }),
      attribute('other', 'performanceFocus', 'Performance Focus', 'multiSelect', 'athlete', 3, {
        options: options(['Confidence', 'Focus', 'Composure', 'Decision Making', 'Mechanics', 'Conditioning', 'Recovery']),
      }),
      attribute('other', 'movementDemand', 'Movement Demand', 'multiSelect', 'athlete', 4, {
        options: options(['Speed', 'Power', 'Endurance', 'Agility', 'Precision', 'Contact', 'Mobility']),
      }),
      attribute('other', 'trainingLoadPattern', 'Training Load Pattern', 'singleSelect', 'recovery', 5, { options: TRAINING_LOAD_OPTIONS, includeInMacraContext: true }),
    ],
    metrics: [
      metric('other', 'competitionDate', 'Competition Date', 'date', 'competition', 0),
      metric('other', 'trainingLoad', 'Training Load', 'score', 'recovery', 1),
      metric('other', 'sessionRpe', 'Session RPE', '1-10', 'recovery', 2),
      metric('other', 'readinessScore', 'Readiness Score', 'score', 'recovery', 3),
      metric('other', 'performanceScore', 'Performance Score', 'score', 'competition', 4),
    ],
    prompting: {
      noraContext: 'When sport is Other, ask for the discipline, role, competition phase, movement demands, and mental performance demand before giving precise coaching.',
      macraNutritionContext: 'For uncategorized sports, audit fueling against training load, competition duration, body composition pressure, heat, travel, and recovery needs before making nutrition recommendations.',
      riskFlags: ['missing sport context', 'unknown movement demand', 'unknown competition phase', 'generic advice risk', 'unverified injury context'],
      restrictedAdvice: ['Do not pretend sport-specific certainty when the sport is unknown.', 'Ask one clarifying question when context is missing.', 'Do not provide injury diagnosis or return-to-play clearance.'],
      recommendedLanguage: ['Be transparent about assumptions.', 'Gather sport, role, phase, and load before narrowing advice.', 'Keep guidance adaptable until sport-specific configuration exists.'],
    },
    reportPolicy: otherReportPolicy,
  }),
];

const slugifySportId = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || `sport-${Date.now()}`;
};

const normalizePositions = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  const seen = new Set<string>();
  const normalized = rawValues.reduce<string[]>((acc, entry) => {
    const position = normalizeString(entry);
    if (!position) return acc;

    const key = position.toLowerCase();
    if (seen.has(key)) return acc;

    seen.add(key);
    acc.push(position);
    return acc;
  }, []);

  return normalized.length > 0 ? normalized : ['Individual'];
};

const normalizeList = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  const seen = new Set<string>();
  return rawValues.reduce<string[]>((acc, entry) => {
    const item = normalizeString(entry);
    if (!item) return acc;
    const key = item.toLowerCase();
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push(item);
    return acc;
  }, []);
};

const ATTRIBUTE_TYPES: PulseCheckSportAttributeType[] = ['text', 'number', 'date', 'boolean', 'singleSelect', 'multiSelect'];
const ATTRIBUTE_SCOPES: PulseCheckSportAttributeScope[] = ['athlete', 'team', 'season', 'competition', 'nutrition', 'recovery'];

const normalizeAttributeOptions = (value: unknown): PulseCheckSportAttributeOption[] => {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  const seen = new Set<string>();
  return entries.reduce<PulseCheckSportAttributeOption[]>((acc, entry) => {
    let label = '';
    let optionValue = '';

    if (typeof entry === 'string') {
      label = entry.trim();
      optionValue = normalizeOptionValue(label);
    } else if (entry && typeof entry === 'object') {
      const candidate = entry as Record<string, unknown>;
      label = normalizeString(candidate.label);
      optionValue = normalizeString(candidate.value) || normalizeOptionValue(label);
    }

    if (!label || !optionValue) return acc;
    const key = optionValue.toLowerCase();
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push({ label, value: optionValue });
    return acc;
  }, []);
};

const normalizeAttributes = (value: unknown): PulseCheckSportAttributeDefinition[] => {
  if (!Array.isArray(value)) return [];

  const seenKeys = new Set<string>();
  return value.reduce<PulseCheckSportAttributeDefinition[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const label = normalizeString(candidate.label);
    const key = normalizeString(candidate.key) || normalizeOptionValue(label);
    if (!label || !key) return acc;
    const normalizedKey = key.toLowerCase();
    if (seenKeys.has(normalizedKey)) return acc;
    seenKeys.add(normalizedKey);

    const rawType = normalizeString(candidate.type) as PulseCheckSportAttributeType;
    const rawScope = normalizeString(candidate.scope) as PulseCheckSportAttributeScope;
    const type = ATTRIBUTE_TYPES.includes(rawType) ? rawType : 'text';
    const scope = ATTRIBUTE_SCOPES.includes(rawScope) ? rawScope : 'athlete';
    const options = normalizeAttributeOptions(candidate.options);

    acc.push({
      id: normalizeString(candidate.id) || `${key}-${index}`,
      key,
      label,
      type,
      scope,
      required: Boolean(candidate.required),
      includeInNoraContext: candidate.includeInNoraContext !== false,
      includeInMacraContext: Boolean(candidate.includeInMacraContext),
      options: type === 'singleSelect' || type === 'multiSelect' ? options : [],
      placeholder: normalizeString(candidate.placeholder),
      sortOrder: typeof candidate.sortOrder === 'number' && Number.isFinite(candidate.sortOrder) ? candidate.sortOrder : index,
    });

    return acc;
  }, []).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
};

const normalizeMetrics = (value: unknown): PulseCheckSportMetricDefinition[] => {
  if (!Array.isArray(value)) return [];

  const seenKeys = new Set<string>();
  return value.reduce<PulseCheckSportMetricDefinition[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const label = normalizeString(candidate.label);
    const key = normalizeString(candidate.key) || normalizeOptionValue(label);
    if (!label || !key) return acc;
    const normalizedKey = key.toLowerCase();
    if (seenKeys.has(normalizedKey)) return acc;
    seenKeys.add(normalizedKey);
    const rawScope = normalizeString(candidate.scope) as PulseCheckSportAttributeScope;

    acc.push({
      id: normalizeString(candidate.id) || `${key}-${index}`,
      key,
      label,
      unit: normalizeString(candidate.unit),
      scope: ATTRIBUTE_SCOPES.includes(rawScope) ? rawScope : 'athlete',
      includeInNoraContext: candidate.includeInNoraContext !== false,
      sortOrder: typeof candidate.sortOrder === 'number' && Number.isFinite(candidate.sortOrder) ? candidate.sortOrder : index,
    });

    return acc;
  }, []).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
};

const normalizePrompting = (value: unknown): PulseCheckSportPromptingConfiguration => {
  if (!value || typeof value !== 'object') return {};
  const candidate = value as Record<string, unknown>;
  return {
    noraContext: normalizeString(candidate.noraContext),
    macraNutritionContext: normalizeString(candidate.macraNutritionContext),
    riskFlags: normalizeList(candidate.riskFlags),
    restrictedAdvice: normalizeList(candidate.restrictedAdvice),
    recommendedLanguage: normalizeList(candidate.recommendedLanguage),
  };
};

const SPORTS_INTELLIGENCE_DIMENSIONS: PulseCheckSportsIntelligenceDimension[] = ['focus', 'composure', 'decisioning'];

const normalizeDimensions = (value: unknown): PulseCheckSportsIntelligenceDimension[] =>
  normalizeList(value).filter((dimension): dimension is PulseCheckSportsIntelligenceDimension =>
    SPORTS_INTELLIGENCE_DIMENSIONS.includes(dimension as PulseCheckSportsIntelligenceDimension)
  );

const normalizeReportLenses = (value: unknown): PulseCheckSportReportLens[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<PulseCheckSportReportLens[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const label = normalizeString(candidate.label);
    const id = normalizeString(candidate.id) || normalizeOptionValue(label);
    if (!id || !label) return acc;

    acc.push({
      id,
      label,
      inputFamilies: normalizeList(candidate.inputFamilies),
      linkedDimensions: normalizeDimensions(candidate.linkedDimensions),
    });

    return acc;
  }, []);
};

const normalizeWatchlistSignals = (value: unknown): PulseCheckSportWatchlistSignal[] =>
  normalizeReportLenses(value).map((signal) => ({
    id: signal.id,
    label: signal.label,
    inputFamilies: signal.inputFamilies,
    linkedDimensions: signal.linkedDimensions,
  }));

const normalizeCoachActions = (value: unknown): PulseCheckSportCoachActionPolicy[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<PulseCheckSportCoachActionPolicy[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const label = normalizeString(candidate.label);
    const id = normalizeString(candidate.id) || normalizeOptionValue(label);
    if (!id || !label) return acc;

    acc.push({
      id,
      label,
      linkedSignals: normalizeList(candidate.linkedSignals),
    });

    return acc;
  }, []);
};

const normalizeEarlyWarningFamilies = (value: unknown): PulseCheckSportEarlyWarningFamily[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<PulseCheckSportEarlyWarningFamily[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const label = normalizeString(candidate.label);
    const id = normalizeString(candidate.id) || normalizeOptionValue(label);
    if (!id || !label) return acc;

    acc.push({
      id,
      label,
      inputFamilies: normalizeList(candidate.inputFamilies),
    });

    return acc;
  }, []);
};

const normalizeDimensionMap = (value: unknown): Record<PulseCheckSportsIntelligenceDimension, string[]> => {
  const candidate = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    focus: normalizeList(candidate.focus),
    composure: normalizeList(candidate.composure),
    decisioning: normalizeList(candidate.decisioning),
  };
};

const normalizeLoadModel = (value: unknown): PulseCheckSportLoadModel | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;

  const primitives: PulseCheckSportLoadPrimitive[] = [];
  if (Array.isArray(candidate.primitives)) {
    for (const entry of candidate.primitives) {
      if (!entry || typeof entry !== 'object') continue;
      const primitive = entry as Record<string, unknown>;
      const key = normalizeString(primitive.key);
      const source = normalizeString(primitive.source);
      const weight = typeof primitive.weight === 'number' ? primitive.weight : Number(primitive.weight);
      if (!key || !source || !Number.isFinite(weight)) continue;
      primitives.push({
        key,
        weight,
        source,
        filter: typeof primitive.filter === 'string' && primitive.filter.trim() ? primitive.filter.trim() : undefined,
      });
    }
  }

  const contextModifiers: PulseCheckSportLoadContextModifier[] = [];
  if (Array.isArray(candidate.contextModifiers)) {
    for (const entry of candidate.contextModifiers) {
      if (!entry || typeof entry !== 'object') continue;
      const modifier = entry as Record<string, unknown>;
      const key = normalizeString(modifier.key);
      const rationale = normalizeString(modifier.rationale);
      const multiplier = typeof modifier.multiplier === 'number' ? modifier.multiplier : Number(modifier.multiplier);
      if (!key || !rationale || !Number.isFinite(multiplier)) continue;
      contextModifiers.push({ key, multiplier, rationale });
    }
  }

  const thresholdsRaw = candidate.thresholds && typeof candidate.thresholds === 'object'
    ? candidate.thresholds as Record<string, unknown>
    : null;
  const thresholds: PulseCheckSportLoadThresholds | null = thresholdsRaw
    ? {
        low: Number(thresholdsRaw.low),
        moderate: Number(thresholdsRaw.moderate),
        high: Number(thresholdsRaw.high),
        concerning: Number(thresholdsRaw.concerning),
      }
    : null;

  const weightsRaw = candidate.prescribedComparisonWeights && typeof candidate.prescribedComparisonWeights === 'object'
    ? candidate.prescribedComparisonWeights as Record<string, unknown>
    : null;
  const prescribedComparisonWeights: PulseCheckSportLoadPrescribedComparisonWeights | null = weightsRaw
    ? {
        executedRepsFraction: Number(weightsRaw.executedRepsFraction),
        paceDeviation: Number(weightsRaw.paceDeviation),
        restDeviation: Number(weightsRaw.restDeviation),
        volumeDeviation: Number(weightsRaw.volumeDeviation),
        modalityDrift: Number(weightsRaw.modalityDrift),
      }
    : null;

  const summary = normalizeString(candidate.summary);
  const acwrCeiling = Number(candidate.acwrCeiling);
  const decayHalfLifeDays = Number(candidate.decayHalfLifeDays);
  const recoveryDebtFloor = Number(candidate.recoveryDebtFloor);

  const hasContent = primitives.length > 0
    && contextModifiers.length > 0
    && thresholds
    && prescribedComparisonWeights
    && Boolean(summary)
    && Number.isFinite(acwrCeiling)
    && Number.isFinite(decayHalfLifeDays)
    && Number.isFinite(recoveryDebtFloor);

  if (!hasContent) return undefined;

  return {
    summary,
    primitives,
    thresholds: thresholds!,
    acwrCeiling,
    decayHalfLifeDays,
    recoveryDebtFloor,
    contextModifiers,
    prescribedComparisonWeights: prescribedComparisonWeights!,
  };
};

const normalizeReportPolicy = (value: unknown): PulseCheckSportReportPolicy | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  const weeklyRead = candidate.weeklyRead && typeof candidate.weeklyRead === 'object'
    ? candidate.weeklyRead as Record<string, unknown>
    : {};
  const gameDayRead = candidate.gameDayRead && typeof candidate.gameDayRead === 'object'
    ? candidate.gameDayRead as Record<string, unknown>
    : {};
  const languagePosture = candidate.languagePosture && typeof candidate.languagePosture === 'object'
    ? candidate.languagePosture as Record<string, unknown>
    : {};

  const translations: Record<string, string> = {};
  if (candidate.coachLanguageTranslations && typeof candidate.coachLanguageTranslations === 'object') {
    for (const [key, value] of Object.entries(candidate.coachLanguageTranslations as Record<string, unknown>)) {
      const cleanedKey = normalizeString(key);
      const cleanedValue = normalizeString(value);
      if (cleanedKey && cleanedValue) {
        translations[cleanedKey] = cleanedValue;
      }
    }
  }

  const policy: PulseCheckSportReportPolicy = {
    contextModifiers: normalizeList(candidate.contextModifiers),
    kpiRefs: normalizeList(candidate.kpiRefs),
    weeklyRead: { reportLenses: normalizeReportLenses(weeklyRead.reportLenses) },
    gameDayRead: { reportLenses: normalizeReportLenses(gameDayRead.reportLenses) },
    watchlistSignals: normalizeWatchlistSignals(candidate.watchlistSignals),
    coachActions: normalizeCoachActions(candidate.coachActions),
    earlyWarningFamilies: normalizeEarlyWarningFamilies(candidate.earlyWarningFamilies),
    languagePosture: {
      summary: normalizeString(languagePosture.summary),
      recommendedLanguage: normalizeList(languagePosture.recommendedLanguage),
      mustAvoid: normalizeList(languagePosture.mustAvoid),
    },
    dimensionMap: normalizeDimensionMap(candidate.dimensionMap),
    coachLanguageTranslations: Object.keys(translations).length > 0 ? translations : undefined,
    loadModel: normalizeLoadModel(candidate.loadModel),
  };

  const hasPolicyContent = [
    policy.contextModifiers,
    policy.kpiRefs,
    policy.weeklyRead.reportLenses,
    policy.gameDayRead.reportLenses,
    policy.watchlistSignals,
    policy.coachActions,
    policy.earlyWarningFamilies,
    policy.languagePosture.recommendedLanguage,
    policy.languagePosture.mustAvoid,
    policy.dimensionMap.focus,
    policy.dimensionMap.composure,
    policy.dimensionMap.decisioning,
  ].some((items) => items.length > 0) || Boolean(policy.languagePosture.summary);

  return hasPolicyContent ? policy : undefined;
};

const sortSports = (sports: PulseCheckSportConfigurationEntry[]) =>
  [...sports].sort((left, right) => {
    if (left.sortOrder === right.sortOrder) {
      return left.name.localeCompare(right.name);
    }

    return left.sortOrder - right.sortOrder;
  });

const cloneSports = (sports: PulseCheckSportConfigurationEntry[]) =>
  sports.map((sport) => ({
    ...sport,
    positions: [...sport.positions],
    attributes: (sport.attributes || []).map((attribute) => ({
      ...attribute,
      options: (attribute.options || []).map((option) => ({ ...option })),
    })),
    metrics: (sport.metrics || []).map((metric) => ({ ...metric })),
    prompting: {
      ...(sport.prompting || {}),
      riskFlags: [...(sport.prompting?.riskFlags || [])],
      restrictedAdvice: [...(sport.prompting?.restrictedAdvice || [])],
      recommendedLanguage: [...(sport.prompting?.recommendedLanguage || [])],
    },
    reportPolicy: normalizeReportPolicy(sport.reportPolicy),
  }));

const normalizeSportArray = (value: unknown): PulseCheckSportConfigurationEntry[] => {
  if (!Array.isArray(value)) {
    return getDefaultPulseCheckSports();
  }

  const seenNames = new Set<string>();
  const normalized = value.reduce<PulseCheckSportConfigurationEntry[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;

    const candidate = entry as Record<string, unknown>;
    const name = normalizeString(candidate.name);
    if (!name) return acc;

    const normalizedName = name.toLowerCase();
    if (seenNames.has(normalizedName)) return acc;
    seenNames.add(normalizedName);

    const parsedSortOrder =
      typeof candidate.sortOrder === 'number' && Number.isFinite(candidate.sortOrder)
        ? candidate.sortOrder
        : index;

    acc.push({
      id: normalizeString(candidate.id) || slugifySportId(name),
      name,
      emoji: normalizeString(candidate.emoji) || '🏅',
      positions: normalizePositions(candidate.positions),
      sortOrder: parsedSortOrder,
      schemaVersion: typeof candidate.schemaVersion === 'number' && Number.isFinite(candidate.schemaVersion)
        ? candidate.schemaVersion
        : 1,
      attributes: normalizeAttributes(candidate.attributes),
      metrics: normalizeMetrics(candidate.metrics),
      prompting: normalizePrompting(candidate.prompting),
      reportPolicy: normalizeReportPolicy(candidate.reportPolicy),
    });

    return acc;
  }, []);

  if (normalized.length === 0) {
    return getDefaultPulseCheckSports();
  }

  return sortSports(normalized).map((sport, index) => ({
    ...sport,
    sortOrder: index,
  }));
};

export const getDefaultPulseCheckSports = () => cloneSports(DEFAULT_PULSECHECK_SPORTS);

// --- Report-policy enforcement helpers ---------------------------------------------------
//
// These helpers are the runtime gates referenced in the Sports Intelligence Report Outlines
// spec. They exist so any future weekly / game-day report generator (and the admin demo
// renderer) shares one source of truth for vocabulary checks, top-line composition, and
// watchlist / coach-action validity. Every gate degrades to a "thin read" rather than
// emitting unsubstantiated coach-facing copy.

export interface ReportVocabularyViolation {
  phrase: string;
  matchedText: string;
  matchedAt: number;
}

export interface ReportVocabularyAuditResult {
  passed: boolean;
  violations: ReportVocabularyViolation[];
  recognizedTerms: string[];
}

export const auditReportCopyAgainstSportPolicy = (
  copy: string,
  policy: PulseCheckSportReportPolicy
): ReportVocabularyAuditResult => {
  const lower = copy.toLowerCase();
  const violations: ReportVocabularyViolation[] = [];
  for (const phrase of policy.languagePosture.mustAvoid || []) {
    const cleaned = phrase.toLowerCase().replace(/[“”"']/g, '');
    if (!cleaned) continue;
    const idx = lower.indexOf(cleaned);
    if (idx !== -1) {
      violations.push({ phrase, matchedText: copy.slice(idx, idx + cleaned.length), matchedAt: idx });
    }
  }
  const recognizedTerms = (policy.languagePosture.recommendedLanguage || []).filter((term) =>
    term && lower.includes(term.toLowerCase())
  );
  return { passed: violations.length === 0, violations, recognizedTerms };
};

export interface ReportTopLineFills {
  whatChanged: string;
  who: string;
  firstAction: string;
  // Optional second story for the week. Rendered as a separate paragraph so the
  // primary priority does not get muddled. If empty, only the primary lede renders.
  secondaryThread?: string;
}

export interface ReportTopLineResult {
  primary: string;
  secondary?: string;
  used: 'specific' | 'thin_read';
  missingFills: Array<keyof ReportTopLineFills>;
}

const isMeaningfulFill = (value: string): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < 4) return false;
  return true;
};

export const composeReportTopLine = (
  fills: Partial<ReportTopLineFills>,
  options?: { sportName?: string }
): ReportTopLineResult => {
  const whatChanged = (fills.whatChanged || '').trim();
  const who = (fills.who || '').trim();
  const firstAction = (fills.firstAction || '').trim();
  const secondaryThread = (fills.secondaryThread || '').trim();

  const missingFills: Array<keyof ReportTopLineFills> = [];
  if (!isMeaningfulFill(whatChanged)) missingFills.push('whatChanged');
  if (!isMeaningfulFill(who)) missingFills.push('who');
  if (!isMeaningfulFill(firstAction)) missingFills.push('firstAction');

  if (missingFills.length > 0) {
    const sport = options?.sportName ? `${options.sportName} ` : '';
    return {
      used: 'thin_read',
      missingFills,
      primary: `Coverage is incomplete this week, so this ${sport}report does not name a specific change, athlete, or first action. Use the data coverage block below to plan participation reminders before next week's report.`,
    };
  }

  const cleanAction = firstAction.replace(/\.$/, '');
  return {
    used: 'specific',
    missingFills,
    primary: `${whatChanged} ${cleanAction}.`,
    secondary: secondaryThread || undefined,
  };
};

// --- Team Read composer ---------------------------------------------------------------
//
// State-driven instead of cue-listing. Each dimension carries a state verb (solid /
// watch / declining) plus a concise sport-localized cue. The team read leads with a
// one-sentence verdict per dimension instead of dumping the dimensionMap verbatim.

export type ReportDimensionState = 'solid' | 'watch' | 'declining' | 'thin_evidence';

export interface ReportDimensionStateMap {
  focus: ReportDimensionState;
  composure: ReportDimensionState;
  decisioning: ReportDimensionState;
}

export interface TeamReadDimensionLine {
  dimension: PulseCheckSportsIntelligenceDimension;
  state: ReportDimensionState;
  stateLabel: string;
  cue: string;
}

export interface TeamReadResult {
  lines: TeamReadDimensionLine[];
  prose: string;
}

const STATE_LABELS: Record<ReportDimensionState, string> = {
  solid: 'solid',
  watch: 'one to watch',
  declining: 'trending down',
  thin_evidence: 'thin evidence',
};

const STATE_VERBS: Record<ReportDimensionState, (cue: string) => string> = {
  solid: (cue) => `is solid${cue ? ` — ${cue}` : ''}`,
  watch: (cue) => `is the one to watch${cue ? ` — ${cue}` : ''}`,
  declining: (cue) => `is trending down${cue ? ` — ${cue}` : ''}`,
  thin_evidence: () => 'has thin evidence this week, so claims are held back',
};

export const composeTeamRead = (
  state: Partial<ReportDimensionStateMap>,
  policy: PulseCheckSportReportPolicy
): TeamReadResult => {
  const dims: PulseCheckSportsIntelligenceDimension[] = ['focus', 'composure', 'decisioning'];
  const lines: TeamReadDimensionLine[] = dims.map((dim) => {
    const dimState = state[dim] || 'thin_evidence';
    const cueList = policy.dimensionMap?.[dim] || [];
    const cue = cueList.length > 0 ? cueList[0] : '';
    return {
      dimension: dim,
      state: dimState,
      stateLabel: STATE_LABELS[dimState],
      cue,
    };
  });

  const proseParts = lines
    .filter((line) => line.state !== 'thin_evidence')
    .map((line) => `${capitalize(line.dimension)} ${STATE_VERBS[line.state](line.cue)}`);

  const prose = proseParts.length > 0
    ? `${proseParts.join('. ')}.`
    : 'Evidence across focus, composure, and decisioning is thin this week — strong team-level claims are held back until participation improves.';

  return { lines, prose };
};

const capitalize = (value: string) => (value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value);

// --- Game-Day look-for / if-then composer ---------------------------------------------
//
// Replaces the generic prose game-day note with concrete coach instructions.
// Each item names a thing to look for and a clear if/then move.

export interface GameDayLookFor {
  athleteOrUnit: string;
  lookFor: string;
  ifThen: string;
}

export interface GameDayNoteResult {
  items: GameDayLookFor[];
  suppressed: boolean;
  suppressionReason?: string;
}

export const composeGameDayLookFors = (items: GameDayLookFor[] | undefined): GameDayNoteResult => {
  const cleaned = (items || []).filter((item) => {
    if (!item) return false;
    return Boolean(item.athleteOrUnit && item.lookFor && item.ifThen);
  });
  if (cleaned.length === 0) {
    return {
      items: [],
      suppressed: true,
      suppressionReason: 'No game-day look-for met the structure bar (athleteOrUnit + lookFor + ifThen). The generic warm-up note is suppressed by policy until specifics are available.',
    };
  }
  return { items: cleaned, suppressed: false };
};

// --- Coach-language translation -------------------------------------------------------
//
// Applies the per-sport + global translations table to a string. Case-insensitive
// substring replace. Longer keys are applied first so multi-word translations win
// over single-word overlaps.

export const applyCoachLanguageTranslations = (
  text: string,
  policy?: PulseCheckSportReportPolicy
): string => {
  if (!text) return text;
  const merged: Record<string, string> = {
    ...(PULSECHECK_REPORT_POLICY_DEFAULTS.coachLanguageTranslations as Record<string, string>),
    ...(policy?.coachLanguageTranslations || {}),
  };
  const keys = Object.keys(merged).sort((a, b) => b.length - a.length);
  let result = text;
  for (const key of keys) {
    if (!key) continue;
    const replacement = merged[key];
    if (!replacement) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), replacement);
  }
  return result;
};

export interface NamedAthleteWatchEntry {
  athleteName: string;
  role?: string;
  whyMatters: string;
  coachMove: string;
  evidenceRefs?: string[];
  confidenceTier?: 'directional' | 'emerging' | 'stable' | 'high_confidence' | 'degraded';
}

export interface WatchlistGateResult {
  rendered: NamedAthleteWatchEntry[];
  suppressed: boolean;
  suppressionReason?: string;
}

export const enforceNamedAthleteWatchlist = (
  candidates: NamedAthleteWatchEntry[],
  options?: { minConfidence?: NamedAthleteWatchEntry['confidenceTier'] }
): WatchlistGateResult => {
  const allowedTiers: Array<NamedAthleteWatchEntry['confidenceTier']> = ['stable', 'high_confidence'];
  const minTier = options?.minConfidence || 'stable';
  const rendered = (candidates || []).filter((entry) => {
    if (!entry || !entry.athleteName || entry.athleteName.trim().length === 0) return false;
    if (!entry.whyMatters || !entry.coachMove) return false;
    if (entry.confidenceTier && minTier === 'stable' && !allowedTiers.includes(entry.confidenceTier)) {
      return false;
    }
    return true;
  });
  if (rendered.length === 0) {
    return {
      rendered: [],
      suppressed: true,
      suppressionReason: 'No watchlist candidate carried both a named athlete and a stable-confidence evidence trace; group-only watchlists are suppressed by policy.',
    };
  }
  return { rendered, suppressed: false };
};

export interface CoachActionCandidate {
  action: string;
  appliesTo?: string;
  session?: string;
  linkedSignals?: string[];
}

export interface CoachActionGateResult {
  rendered: CoachActionCandidate[];
  suppressed: CoachActionCandidate[];
  suppressionReason?: string;
}

export const enforceCoachActionSpecificity = (
  candidates: CoachActionCandidate[]
): CoachActionGateResult => {
  const rendered: CoachActionCandidate[] = [];
  const suppressed: CoachActionCandidate[] = [];
  for (const candidate of candidates || []) {
    const hasAthlete = !!(candidate.appliesTo && candidate.appliesTo.trim().length > 0);
    const hasSession = !!(candidate.session && candidate.session.trim().length > 0);
    if (!candidate.action || !candidate.action.trim()) continue;
    if (hasAthlete || hasSession) {
      rendered.push(candidate);
    } else {
      suppressed.push(candidate);
    }
  }
  const suppressionReason = suppressed.length > 0
    ? 'Generic coach principles were filtered out: every coach action must reference a named athlete or a specific session.'
    : undefined;
  return { rendered, suppressed, suppressionReason };
};

export const fetchPulseCheckSportConfiguration = async (): Promise<PulseCheckSportConfigurationEntry[]> => {
  try {
    const snapshot = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOCUMENT));
    if (!snapshot.exists()) {
      return getDefaultPulseCheckSports();
    }

    return normalizeSportArray(snapshot.data()?.sports);
  } catch (error) {
    console.error('[PulseCheckSportConfig] Failed to fetch sport configuration:', error);
    return getDefaultPulseCheckSports();
  }
};

export const savePulseCheckSportConfiguration = async (
  sports: PulseCheckSportConfigurationEntry[]
): Promise<PulseCheckSportConfigurationEntry[]> => {
  const normalizedSports = normalizeSportArray(sports).map((sport, index) => ({
    ...sport,
    sortOrder: index,
  }));

  await setDoc(
    doc(db, CONFIG_COLLECTION, CONFIG_DOCUMENT),
    {
        sports: normalizedSports.map((sport) => ({
          id: sport.id,
          name: sport.name,
          emoji: sport.emoji,
          positions: sport.positions,
          sortOrder: sport.sortOrder,
          schemaVersion: sport.schemaVersion || 1,
          attributes: normalizeAttributes(sport.attributes),
          metrics: normalizeMetrics(sport.metrics),
          prompting: normalizePrompting(sport.prompting),
          reportPolicy: normalizeReportPolicy(sport.reportPolicy),
        })),
      updatedAt: serverTimestamp(),
      updatedBySource: 'human-ui',
      updatedByUid: auth.currentUser?.uid || '',
      updatedByEmail: auth.currentUser?.email || '',
    },
    { merge: true }
  );

  return normalizedSports;
};
