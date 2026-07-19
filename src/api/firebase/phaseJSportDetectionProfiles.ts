// =============================================================================
// Phase J Sport Detection Profiles
//
// Profile definitions for mapping sport configuration/load-model concepts into
// the contextual detection primitives emitted by Phase J. Load-input blends are
// driven by the Sports Intelligence catalog (`pulsecheckSportConfig.ts`
// reportPolicy.loadModel — code-owned, so the code defaults are the source of
// truth); detection-specific bits (clarification questions, primitive weights,
// snapshot proxies) stay code-owned here as overlays.
// Spec: PulseCheck/docs/specs/sports-intelligence-source-of-truth-spec.md §5.
// =============================================================================

import type {
  PhaseJConfidenceTier,
  PhaseJPrimitiveSnapshot,
  PhaseJPromptTarget,
  PhaseJQuestionType,
  PhaseJSessionType,
} from './phaseJSessionContracts';
import type { PulseCheckSportConfigurationEntry } from './pulsecheckSportConfig';
import { getDefaultPulseCheckSports } from './pulsecheckSportConfig';

// Sport ids resolve against the catalog (plus Phase-J-only ids like 'lift' and
// the generic-* fallbacks), so this is an open string, not a closed union.
export type PhaseJSportDetectionProfileSportId = string;

export type PhaseJPrimitiveProfileMatchMode = 'presence' | 'minimum' | 'maximum' | 'range';

export type PhaseJPrimitiveProfileKey =
  | keyof PhaseJPrimitiveSnapshot
  | 'durationMin'
  | 'totalHrZoneMinutes'
  | 'activeHrZoneMinutes'
  | 'highIntensityMinutes'
  | 'internalLoadHr'
  | `hrZoneMinutes.${string}`
  | string;

export interface PhaseJPrimitiveProfileWeight {
  key: PhaseJPrimitiveProfileKey;
  weight: number;
  matchMode?: PhaseJPrimitiveProfileMatchMode;
  sourceField?: PhaseJPrimitiveProfileKey;
  min?: number;
  max?: number;
  candidateKinds?: PhaseJSessionType[];
  description?: string;
}

export interface PhaseJSportDetectionClarificationQuestion {
  id: string;
  candidateKind: PhaseJSessionType;
  target: PhaseJPromptTarget;
  questionType: PhaseJQuestionType;
  promptText: string;
  answerOptions?: string[];
  reason: string;
  missingContextResolved: string[];
}

export interface PhaseJSportDetectionConfidenceGates {
  strongContextualScore: number;
  usableScore: number;
  directionalScore: number;
  holdBackBelowScore: number;
  minDurationSec?: number;
  minDeviceCoveragePct?: number;
  maxMissingPrimitiveCount?: number;
  defaultTier: PhaseJConfidenceTier;
}

export interface PhaseJSportDetectionLoadInput {
  key: string;
  weight: number;
  source: string;
  primitiveKey?: PhaseJPrimitiveProfileKey;
  filter?: string;
  required?: boolean;
  candidateKinds?: PhaseJSessionType[];
}

export interface PhaseJCandidateKindHint {
  candidateKind: PhaseJSessionType;
  positiveHints: string[];
  ambiguousWith?: PhaseJSessionType[];
  defaultConfidenceTier: PhaseJConfidenceTier;
}

export interface PhaseJSportDetectionProfile {
  sportId: PhaseJSportDetectionProfileSportId;
  sportConfigId?: string;
  sportName: string;
  sessionTypes: PhaseJSessionType[];
  primitiveWeights: PhaseJPrimitiveProfileWeight[];
  clarificationQuestions: PhaseJSportDetectionClarificationQuestion[];
  confidenceGates: PhaseJSportDetectionConfidenceGates;
  loadInputs: PhaseJSportDetectionLoadInput[];
  candidateKindHints: PhaseJCandidateKindHint[];
}

export interface PhaseJSportDetectionSportConfig {
  id: string;
  name: string;
  reportPolicy?: {
    loadModel?: {
      primitives?: PhaseJSportDetectionLoadInputSeed[];
    };
  };
}

export interface PhaseJSportDetectionLoadInputSeed {
  key: string;
  weight: number;
  source: string;
  filter?: string;
}

export interface PhaseJSportDetectionCatalogLoadOverlay {
  /** Catalog primitive keys that must be present for a usable load handoff. */
  requiredKeys?: string[];
  /** Per-sport snapshot proxy overrides, on top of SNAPSHOT_PROXY_BY_CATALOG_PRIMITIVE. */
  primitiveKeyByCatalogKey?: Record<string, PhaseJPrimitiveProfileKey>;
  /** Detection-only inputs appended after the catalog blend (e.g. sessionRpe). */
  supplementalInputs?: PhaseJSportDetectionLoadInput[];
}

export type PhaseJSportDetectionProfileSeed = Omit<
  PhaseJSportDetectionProfile,
  'clarificationQuestions' | 'confidenceGates' | 'loadInputs'
> & {
  clarificationQuestions?: PhaseJSportDetectionClarificationQuestion[];
  confidenceGates?: Partial<PhaseJSportDetectionConfidenceGates>;
  /**
   * Code-owned load inputs for sports whose detection blend intentionally
   * diverges from the catalog loadModel (no snapshot proxy exists yet for the
   * catalog primitives), or that have no catalog entry at all. Omit to derive
   * the blend from the catalog entry's loadModel via the adapter.
   */
  loadInputs?: PhaseJSportDetectionLoadInput[];
  /** Detection-specific overlay applied when loadInputs is derived from the catalog. */
  catalogLoadOverlay?: PhaseJSportDetectionCatalogLoadOverlay;
};

export interface PhaseJSportDetectionProfileFromConfigInput {
  sportConfig: PhaseJSportDetectionSportConfig;
  sessionTypes: PhaseJSessionType[];
  primitiveWeights?: PhaseJPrimitiveProfileWeight[];
  clarificationQuestions?: PhaseJSportDetectionClarificationQuestion[];
  confidenceGates?: Partial<PhaseJSportDetectionConfidenceGates>;
  candidateKindHints?: PhaseJCandidateKindHint[];
  catalogLoadOverlay?: PhaseJSportDetectionCatalogLoadOverlay;
}

const SPORT_ID_ALIASES: Record<string, PhaseJSportDetectionProfileSportId> = {
  track: 'track-field',
  'track-and-field': 'track-field',
  track_field: 'track-field',
  trackfield: 'track-field',
  generic: 'generic-practice',
  practice: 'generic-practice',
  conditioning: 'generic-conditioning',
  game: 'generic-game',
};

const normalizeSportId = (sportId: string): string => {
  const normalized = sportId.trim().toLowerCase();
  return SPORT_ID_ALIASES[normalized] || normalized;
};

let catalogSportsById: Map<string, PulseCheckSportConfigurationEntry> | null = null;

const catalogSportById = (sportId: string): PulseCheckSportConfigurationEntry | undefined => {
  if (!catalogSportsById) {
    catalogSportsById = new Map(getDefaultPulseCheckSports().map((sport) => [sport.id, sport]));
  }
  return catalogSportsById.get(sportId);
};

// How Phase J approximates catalog load-model primitives with the snapshot
// primitives the phone/watch can actually compute. Catalog keys without an
// entry keep their own key and are excluded at handoff time when unavailable.
const SNAPSHOT_PROXY_BY_CATALOG_PRIMITIVE: Record<string, PhaseJPrimitiveProfileKey> = {
  jumpCount: 'accelerationBurstCount',
  lateralAccelCount: 'accelerationBurstCount',
  sprintReps: 'accelerationBurstCount',
  impactCollisionLoad: 'accelerationBurstCount',
  snapCountProxy: 'accelerationBurstCount',
  highSpeedRunDistance: 'highIntensityMinutes',
  tempoThresholdTime: 'highIntensityMinutes',
  sprintDistance: 'distanceMeters',
  totalDistance: 'distanceMeters',
  walkingDistance: 'distanceMeters',
  blockRoundDuration: 'durationMin',
  matchDuration: 'durationMin',
  hrZoneTime: 'totalHrZoneMinutes',
  cardioMinutes: 'activeHrZoneMinutes',
  dailySteps: 'stepCount',
};

const DEFAULT_CONFIDENCE_GATES: PhaseJSportDetectionConfidenceGates = {
  strongContextualScore: 0.82,
  usableScore: 0.62,
  directionalScore: 0.42,
  holdBackBelowScore: 0.25,
  minDurationSec: 10 * 60,
  minDeviceCoveragePct: 35,
  maxMissingPrimitiveCount: 3,
  defaultTier: 'directional',
};

const candidateHint = (
  candidateKind: PhaseJSessionType,
  positiveHints: string[],
  ambiguousWith: PhaseJSessionType[] = [],
  defaultConfidenceTier: PhaseJConfidenceTier = 'directional',
): PhaseJCandidateKindHint => ({
  candidateKind,
  positiveHints,
  ambiguousWith,
  defaultConfidenceTier,
});

const question = (
  id: string,
  candidateKind: PhaseJSessionType,
  promptText: string,
  answerOptions: string[],
  reason: string,
  missingContextResolved: string[],
  questionType: PhaseJQuestionType = 'session_type',
  target: PhaseJPromptTarget = 'athlete',
): PhaseJSportDetectionClarificationQuestion => ({
  id,
  candidateKind,
  target,
  questionType,
  promptText,
  answerOptions,
  reason,
  missingContextResolved,
});

const loadInput = (
  key: string,
  weight: number,
  source: string,
  primitiveKey?: PhaseJPrimitiveProfileKey,
  config: Partial<Omit<PhaseJSportDetectionLoadInput, 'key' | 'weight' | 'source' | 'primitiveKey'>> = {},
): PhaseJSportDetectionLoadInput => ({
  key,
  weight,
  source,
  primitiveKey,
  ...config,
});

const primitiveWeight = (
  key: PhaseJPrimitiveProfileKey,
  weight: number,
  config: Partial<Omit<PhaseJPrimitiveProfileWeight, 'key' | 'weight'>> = {},
): PhaseJPrimitiveProfileWeight => ({
  key,
  weight,
  matchMode: config.matchMode || 'minimum',
  ...config,
});

const commonPracticeQuestions = (sportId: string): PhaseJSportDetectionClarificationQuestion[] => [
  question(
    `${sportId}-practice-session-type`,
    'practice',
    'Was this a practice, conditioning block, lift, or game?',
    ['Practice', 'Conditioning', 'Lift', 'Game', 'Other'],
    'Practice-like movement often overlaps with conditioning and team warmups.',
    ['sessionType'],
  ),
  question(
    `${sportId}-game-session-type`,
    'game',
    'Was this a game/competition or a practice?',
    ['Game / Competition', 'Practice', 'Conditioning', 'Other'],
    'Competition context changes the load model and coach-facing interpretation.',
    ['sessionType', 'competitionContext'],
  ),
];

// Detection-only inputs the catalog loadModel does not carry; appended to
// catalog-derived blends via catalogLoadOverlay.supplementalInputs.
const supplementalTeamSportLoadInputs: PhaseJSportDetectionLoadInput[] = [
  loadInput('activeEnergyKcal', 0.4, 'Active energy from the normalized primitive snapshot.', 'activeEnergyKcal'),
  loadInput('sessionRpe', 0.5, 'Athlete-reported session RPE when available after clarification.', 'sessionRpe'),
];

const sharedTeamSportLoadInputs = [
  loadInput('internalLoadHr', 1.0, 'TRIMP-style HR-zone integration over detected sessions.', 'internalLoadHr', { required: true }),
  ...supplementalTeamSportLoadInputs,
];

const seededProfile = (seed: PhaseJSportDetectionProfileSeed): PhaseJSportDetectionProfile => {
  const { catalogLoadOverlay: _catalogLoadOverlay, loadInputs, ...rest } = seed;
  return {
    ...rest,
    loadInputs: loadInputs || [],
    clarificationQuestions: seed.clarificationQuestions || commonPracticeQuestions(seed.sportId),
    confidenceGates: {
      ...DEFAULT_CONFIDENCE_GATES,
      ...(seed.confidenceGates || {}),
    },
  };
};

const loadInputsFromSportConfig = (
  sportConfig: Pick<PhaseJSportDetectionSportConfig, 'reportPolicy'>,
  overlay?: PhaseJSportDetectionCatalogLoadOverlay,
): PhaseJSportDetectionLoadInput[] => {
  const primitives = sportConfig.reportPolicy?.loadModel?.primitives || [];
  const catalogKeys = new Set(primitives.map((primitive) => primitive.key));
  return [
    ...primitives.map((primitive) =>
      loadInput(
        primitive.key,
        primitive.weight,
        primitive.source,
        overlay?.primitiveKeyByCatalogKey?.[primitive.key]
          || SNAPSHOT_PROXY_BY_CATALOG_PRIMITIVE[primitive.key]
          || primitive.key,
        {
          filter: primitive.filter,
          ...(overlay?.requiredKeys?.includes(primitive.key) ? { required: true } : {}),
        },
      ),
    ),
    ...(overlay?.supplementalInputs || []).filter((input) => !catalogKeys.has(input.key)),
  ];
};

export const mapPulseCheckSportConfigToPhaseJDetectionProfile = (
  input: PhaseJSportDetectionProfileFromConfigInput,
): PhaseJSportDetectionProfile => {
  const sportId = normalizeSportId(input.sportConfig.id);
  return {
    ...seededProfile({
      sportId,
      sportConfigId: input.sportConfig.id,
      sportName: input.sportConfig.name,
      sessionTypes: input.sessionTypes,
      primitiveWeights: input.primitiveWeights || [],
      clarificationQuestions: input.clarificationQuestions,
      confidenceGates: input.confidenceGates,
      candidateKindHints: input.candidateKindHints || [],
    }),
    loadInputs: loadInputsFromSportConfig(input.sportConfig, input.catalogLoadOverlay),
  };
};

// Seeds with explicit loadInputs intentionally diverge from their catalog
// loadModel: those blends were adapted to what the phone/watch can detect
// today (see SNAPSHOT_PROXY_BY_CATALOG_PRIMITIVE for the proxies that exist).
// tests/unit/phase-j-sport-detection-catalog.test.ts pins each divergence so
// catalog edits force a deliberate reconciliation here.
const PHASE_J_SPORT_DETECTION_PROFILE_SEEDS: PhaseJSportDetectionProfileSeed[] = [
  {
    sportId: 'lift',
    sportName: 'Lift',
    sessionTypes: ['lift'],
    primitiveWeights: [
      primitiveWeight('durationMin', 0.8, { min: 15, description: 'Strength sessions should clear a meaningful duration floor.' }),
      primitiveWeight('restGapCount', 0.8, { min: 3, description: 'Set-based lifting usually includes repeated rest gaps.' }),
      primitiveWeight('longestRestGapSec', 0.6, { min: 90, description: 'Lifting often has longer rests than field conditioning.' }),
      primitiveWeight('movementDensity', 0.4, { matchMode: 'range', min: 0.12, max: 0.7 }),
      primitiveWeight('activeEnergyKcal', 0.3, { min: 75 }),
    ],
    clarificationQuestions: [
      question(
        'lift-summary',
        'lift',
        'Was this a lift? If yes, what were the main exercises?',
        ['Lift', 'Conditioning', 'Practice', 'Other'],
        'Lift confirmation unlocks parsed exercise summaries and strength-load accounting.',
        ['sessionType', 'liftSummary'],
        'lift_summary',
      ),
    ],
    confidenceGates: { minDurationSec: 12 * 60, defaultTier: 'usable' },
    loadInputs: [
      loadInput('strengthVolume', 1.0, 'Exercise sets, reps, and load from the parsed lift summary.', 'parsedLiftSummary', { required: true }),
      loadInput('internalLoadHr', 0.5, 'HR-zone integration when wearable coverage exists.', 'internalLoadHr'),
      loadInput('activeEnergyKcal', 0.4, 'Active energy from the normalized primitive snapshot.', 'activeEnergyKcal'),
      loadInput('sessionRpe', 0.6, 'Athlete-reported session RPE after lift clarification.', 'sessionRpe'),
    ],
    candidateKindHints: [
      candidateHint('lift', ['long rest gaps', 'set-like movement bursts', 'moderate movement density'], ['conditioning', 'practice'], 'usable'),
    ],
  },
  {
    sportId: 'basketball',
    sportName: 'Basketball',
    sessionTypes: ['practice', 'conditioning', 'game'],
    primitiveWeights: [
      primitiveWeight('internalLoadHr', 1.0, { min: 20 }),
      primitiveWeight('accelerationBurstCount', 0.9, { min: 18, description: 'Proxy for jumps, closeouts, cuts, and repeat sprint actions.' }),
      primitiveWeight('movementDensity', 0.7, { min: 0.45 }),
      primitiveWeight('highIntensityMinutes', 0.6, { min: 6 }),
      primitiveWeight('restGapCount', 0.3, { min: 4 }),
    ],
    clarificationQuestions: commonPracticeQuestions('basketball'),
    // Load blend comes from the catalog loadModel (keys and weights are aligned);
    // the overlay marks HR load required and appends the detection-only supplements.
    catalogLoadOverlay: {
      requiredKeys: ['internalLoadHr'],
      supplementalInputs: supplementalTeamSportLoadInputs,
    },
    candidateKindHints: [
      candidateHint('practice', ['repeat sprint pattern', 'jump/cut burst density', 'stop-start rest gaps'], ['conditioning', 'game'], 'directional'),
      candidateHint('game', ['competition schedule match', 'sustained high HR', 'repeat sprint and jump density'], ['practice'], 'usable'),
      candidateHint('conditioning', ['high HR with less rest structure', 'repeat sprint density'], ['practice'], 'directional'),
    ],
  },
  {
    sportId: 'football',
    sportName: 'Football',
    sessionTypes: ['practice', 'conditioning', 'game'],
    primitiveWeights: [
      primitiveWeight('accelerationBurstCount', 1.0, { min: 14, description: 'Proxy for snaps, starts, collisions, and special-teams reps.' }),
      primitiveWeight('restGapCount', 0.8, { min: 8, description: 'Football often alternates short explosive reps and huddle/rest windows.' }),
      primitiveWeight('longestRestGapSec', 0.5, { min: 60 }),
      primitiveWeight('highIntensityMinutes', 0.5, { min: 4 }),
      primitiveWeight('internalLoadHr', 0.5, { min: 15 }),
    ],
    clarificationQuestions: [
      ...commonPracticeQuestions('football'),
      question(
        'football-contact-context',
        'practice',
        'Was this contact, shells, walk-through, or conditioning?',
        ['Full contact', 'Shells / thud', 'Walk-through', 'Conditioning', 'Other'],
        'Contact level changes the load contribution for football.',
        ['contactContext', 'sessionType'],
        'session_intent',
        'coach',
      ),
    ],
    loadInputs: [
      ...sharedTeamSportLoadInputs,
      loadInput('snapCountProxy', 0.8, 'Position-specific accelerometer cadence and intensity per detected football session.', 'accelerationBurstCount'),
      loadInput('collisionLoad', 0.8, 'Impact magnitude where supported by the device.', 'accelerationBurstCount'),
      loadInput('highIntensityEfforts', 0.6, 'Explosive start and sprint bursts.', 'accelerationBurstCount'),
    ],
    candidateKindHints: [
      candidateHint('practice', ['bursty reps', 'frequent rest gaps', 'contact-context ambiguity'], ['conditioning', 'game'], 'directional'),
      candidateHint('game', ['schedule match', 'snap-like burst/rest cadence'], ['practice'], 'usable'),
      candidateHint('conditioning', ['sprint bursts with fewer huddle gaps'], ['practice'], 'directional'),
    ],
  },
  {
    sportId: 'soccer',
    sportName: 'Soccer',
    sessionTypes: ['practice', 'conditioning', 'game', 'run'],
    primitiveWeights: [
      primitiveWeight('distanceMeters', 1.0, { min: 1800 }),
      primitiveWeight('movementDensity', 0.9, { min: 0.5 }),
      primitiveWeight('internalLoadHr', 0.9, { min: 25 }),
      primitiveWeight('highIntensityMinutes', 0.7, { min: 8 }),
      primitiveWeight('accelerationBurstCount', 0.5, { min: 12 }),
    ],
    clarificationQuestions: [
      ...commonPracticeQuestions('soccer'),
      question(
        'soccer-run-vs-session',
        'run',
        'Was this a soccer session or a standalone run?',
        ['Soccer practice', 'Soccer game', 'Standalone run', 'Conditioning', 'Other'],
        'GPS-heavy soccer and standalone running can look similar without context.',
        ['sessionType', 'sportContext'],
      ),
    ],
    loadInputs: [
      ...sharedTeamSportLoadInputs,
      loadInput('totalDistance', 0.5, 'GPS total distance per session.', 'distanceMeters'),
      loadInput('highSpeedRuns', 0.9, 'Sustained high-speed efforts from GPS or accelerometer primitives.', 'highIntensityMinutes'),
      loadInput('sprintDistance', 0.7, 'Distance accumulated above sprint threshold.', 'distanceMeters'),
      loadInput('accelerations', 0.5, 'Acceleration burst count during field play.', 'accelerationBurstCount'),
    ],
    candidateKindHints: [
      candidateHint('practice', ['field-play distance', 'high movement density', 'repeat accelerations'], ['run', 'conditioning', 'game'], 'directional'),
      candidateHint('game', ['longer duration', 'high total distance', 'competition schedule match'], ['practice'], 'usable'),
      candidateHint('run', ['steady distance with fewer acceleration bursts'], ['practice', 'conditioning'], 'directional'),
    ],
  },
  {
    sportId: 'track-field',
    sportConfigId: 'track-field',
    sportName: 'Track & Field',
    sessionTypes: ['practice', 'conditioning', 'game', 'run'],
    primitiveWeights: [
      primitiveWeight('distanceMeters', 0.9, { min: 800 }),
      primitiveWeight('highIntensityMinutes', 0.8, { min: 3 }),
      primitiveWeight('accelerationBurstCount', 0.7, { min: 6 }),
      primitiveWeight('restGapCount', 0.5, { min: 3 }),
      primitiveWeight('internalLoadHr', 0.5, { min: 12 }),
    ],
    clarificationQuestions: [
      question(
        'track-event-group',
        'practice',
        'What kind of track session was this?',
        ['Sprints / hurdles', 'Distance', 'Jumps', 'Throws', 'Meet / competition', 'Other'],
        'Event group determines whether distance, sprint bursts, or technical reps should dominate load.',
        ['eventGroup', 'sessionType'],
        'session_intent',
      ),
      question(
        'track-run-vs-conditioning',
        'run',
        'Was this track practice, conditioning, or a standalone run?',
        ['Track practice', 'Conditioning', 'Standalone run', 'Meet / competition', 'Other'],
        'Track running can be sport practice or general conditioning depending on intent.',
        ['sessionType', 'sportContext'],
      ),
    ],
    loadInputs: [
      ...sharedTeamSportLoadInputs,
      loadInput('sprintReps', 0.8, 'Acceleration and max-velocity rep count.', 'accelerationBurstCount'),
      loadInput('tempoThresholdTime', 0.5, 'Time in tempo and threshold pace zones.', 'highIntensityMinutes'),
      loadInput('jumpThrowTechnicalReps', 0.5, 'Technical event reps inferred from burst/rest structure or coach context.', 'accelerationBurstCount'),
    ],
    candidateKindHints: [
      candidateHint('practice', ['rep/rest structure', 'event-group ambiguity', 'track venue or schedule context'], ['conditioning', 'run'], 'directional'),
      candidateHint('run', ['distance signal', 'steady aerobic load'], ['practice', 'conditioning'], 'directional'),
      candidateHint('game', ['meet schedule match', 'event-group confirmation'], ['practice'], 'usable'),
    ],
  },
  {
    sportId: 'volleyball',
    sportName: 'Volleyball',
    sessionTypes: ['practice', 'conditioning', 'game'],
    primitiveWeights: [
      primitiveWeight('accelerationBurstCount', 1.0, { min: 20, description: 'Proxy for jumps, approaches, blocks, and defensive reactions.' }),
      primitiveWeight('movementDensity', 0.7, { min: 0.35 }),
      primitiveWeight('restGapCount', 0.6, { min: 8 }),
      primitiveWeight('internalLoadHr', 0.5, { min: 12 }),
      primitiveWeight('distanceMeters', 0.3, { matchMode: 'maximum', max: 2500 }),
    ],
    clarificationQuestions: commonPracticeQuestions('volleyball'),
    loadInputs: [
      ...sharedTeamSportLoadInputs,
      loadInput('jumpCount', 1.0, 'Approach and block jump proxy from vertical acceleration bursts.', 'accelerationBurstCount'),
      loadInput('landingLoad', 0.7, 'Repeated landing load inferred from burst density.', 'accelerationBurstCount'),
      loadInput('shoulderVolume', 0.5, 'Serve/attack shoulder volume from sport context when available.', 'sessionRpe'),
    ],
    candidateKindHints: [
      candidateHint('practice', ['jump burst density', 'point-like rest cadence', 'low total distance'], ['conditioning', 'game'], 'directional'),
      candidateHint('game', ['match schedule context', 'high jump/rest cadence'], ['practice'], 'usable'),
      candidateHint('conditioning', ['high HR with less point cadence'], ['practice'], 'directional'),
    ],
  },
  {
    sportId: 'bowling',
    sportName: 'Bowling',
    sessionTypes: ['practice', 'game'],
    primitiveWeights: [
      primitiveWeight('durationMin', 1.0, { min: 35 }),
      primitiveWeight('movementDensity', 0.7, { matchMode: 'range', min: 0.04, max: 0.35 }),
      primitiveWeight('stepCount', 0.5, { min: 400 }),
      primitiveWeight('highIntensityMinutes', 0.4, { matchMode: 'maximum', max: 8 }),
      primitiveWeight('activeEnergyKcal', 0.3, { min: 60 }),
    ],
    clarificationQuestions: [
      question(
        'bowling-practice-or-match',
        'practice',
        'Was this bowling practice, a match, or a tournament block?',
        ['Practice', 'Match', 'Tournament block', 'Other'],
        'Bowling load depends on block length and competition context more than HR intensity.',
        ['sessionType', 'competitionContext'],
      ),
      question(
        'bowling-game-context',
        'game',
        'Was this a bowling match or tournament block?',
        ['Match', 'Tournament block', 'Practice', 'Other'],
        'Competition context changes stamina and coach report framing.',
        ['sessionType', 'competitionContext'],
      ),
    ],
    loadInputs: [
      loadInput('blockRoundDuration', 1.0, 'Detected bowling-block duration and density.', 'durationMin', { required: true }),
      loadInput('frameVolume', 0.8, 'Frame or game count from scoring context when available.', 'sessionRpe'),
      loadInput('activeEnergyKcal', 0.3, 'Active energy from the normalized primitive snapshot.', 'activeEnergyKcal'),
      loadInput('sessionRpe', 0.4, 'Athlete-reported session RPE, especially for tournament blocks.', 'sessionRpe'),
    ],
    candidateKindHints: [
      candidateHint('practice', ['long low-intensity block', 'low movement density', 'repeated approach steps'], ['game'], 'directional'),
      candidateHint('game', ['competition schedule match', 'long low-intensity block'], ['practice'], 'usable'),
    ],
  },
  {
    sportId: 'golf',
    sportName: 'Golf',
    sessionTypes: ['practice', 'game', 'walk'],
    primitiveWeights: [
      primitiveWeight('durationMin', 1.0, { min: 45 }),
      primitiveWeight('stepCount', 0.8, { min: 1200 }),
      primitiveWeight('distanceMeters', 0.7, { min: 800 }),
      primitiveWeight('movementDensity', 0.5, { matchMode: 'range', min: 0.08, max: 0.45 }),
      primitiveWeight('highIntensityMinutes', 0.4, { matchMode: 'maximum', max: 10 }),
    ],
    clarificationQuestions: [
      question(
        'golf-round-or-practice',
        'practice',
        'Was this a round, range session, short-game practice, or a walk?',
        ['Round', 'Range session', 'Short-game practice', 'Walk only', 'Other'],
        'Golf detection needs playing context to separate sport load from a normal walk.',
        ['sessionType', 'sportContext'],
      ),
      question(
        'golf-game-context',
        'game',
        'Was this a tournament/qualifying round or a practice round?',
        ['Tournament / qualifying', 'Practice round', 'Recreational round', 'Range only', 'Other'],
        'Competition context changes coach report interpretation.',
        ['sessionType', 'competitionContext'],
      ),
    ],
    loadInputs: [
      loadInput('walkingLoad', 1.0, 'Walking duration, step count, and course distance.', 'stepCount', { required: true }),
      loadInput('roundDuration', 0.8, 'Total detected round or practice duration.', 'durationMin'),
      loadInput('heatExposure', 0.3, 'Environmental context when available.', 'sessionRpe'),
      loadInput('sessionRpe', 0.4, 'Athlete-reported effort after long rounds or range blocks.', 'sessionRpe'),
    ],
    candidateKindHints: [
      candidateHint('practice', ['long low-intensity movement', 'range or short-game context needed'], ['walk', 'game'], 'directional'),
      candidateHint('game', ['round-length duration', 'competition schedule match', 'walking load'], ['practice', 'walk'], 'usable'),
      candidateHint('walk', ['steps and distance without sport context'], ['practice', 'game'], 'directional'),
    ],
  },
  {
    sportId: 'generic-practice',
    sportName: 'Generic Practice',
    sessionTypes: ['practice'],
    primitiveWeights: [
      primitiveWeight('durationMin', 0.8, { min: 25 }),
      primitiveWeight('movementDensity', 0.8, { min: 0.25 }),
      primitiveWeight('internalLoadHr', 0.6, { min: 12 }),
      primitiveWeight('accelerationBurstCount', 0.4, { min: 6 }),
    ],
    clarificationQuestions: commonPracticeQuestions('generic-practice'),
    loadInputs: sharedTeamSportLoadInputs,
    candidateKindHints: [
      candidateHint('practice', ['team schedule overlap', 'moderate to high movement density', 'mixed work/rest pattern'], ['conditioning', 'game'], 'directional'),
    ],
  },
  {
    sportId: 'generic-conditioning',
    sportName: 'Generic Conditioning',
    sessionTypes: ['conditioning'],
    primitiveWeights: [
      primitiveWeight('internalLoadHr', 1.0, { min: 18 }),
      primitiveWeight('movementDensity', 0.8, { min: 0.45 }),
      primitiveWeight('highIntensityMinutes', 0.6, { min: 5 }),
      primitiveWeight('durationMin', 0.5, { min: 15 }),
    ],
    clarificationQuestions: [
      question(
        'generic-conditioning-intent',
        'conditioning',
        'Was this conditioning, practice, a lift, or a game?',
        ['Conditioning', 'Practice', 'Lift', 'Game', 'Other'],
        'Conditioning can mimic sport practice when only primitive signals are available.',
        ['sessionType', 'sessionIntent'],
        'session_intent',
      ),
    ],
    loadInputs: sharedTeamSportLoadInputs,
    candidateKindHints: [
      candidateHint('conditioning', ['high HR load', 'sustained movement density', 'limited sport-specific context'], ['practice', 'run', 'lift'], 'directional'),
    ],
  },
  {
    sportId: 'generic-game',
    sportName: 'Generic Game',
    sessionTypes: ['game'],
    primitiveWeights: [
      primitiveWeight('durationMin', 0.8, { min: 30 }),
      primitiveWeight('internalLoadHr', 0.8, { min: 18 }),
      primitiveWeight('movementDensity', 0.6, { min: 0.3 }),
      primitiveWeight('accelerationBurstCount', 0.5, { min: 6 }),
    ],
    clarificationQuestions: [
      question(
        'generic-game-context',
        'game',
        'Was this a game/competition? If yes, what sport or event was it?',
        ['Game / Competition', 'Practice', 'Conditioning', 'Other'],
        'Competition context should be confirmed before canonical game records are written.',
        ['sessionType', 'sportContext', 'competitionContext'],
      ),
    ],
    confidenceGates: { minDurationSec: 20 * 60 },
    loadInputs: sharedTeamSportLoadInputs,
    candidateKindHints: [
      candidateHint('game', ['competition schedule match', 'sustained load', 'sport context still missing'], ['practice'], 'directional'),
    ],
  },
];

const profileFromSeed = (seed: PhaseJSportDetectionProfileSeed): PhaseJSportDetectionProfile => {
  const catalogEntry = catalogSportById(seed.sportConfigId || seed.sportId);
  if (catalogEntry && !seed.loadInputs) {
    return mapPulseCheckSportConfigToPhaseJDetectionProfile({
      sportConfig: catalogEntry,
      sessionTypes: seed.sessionTypes,
      primitiveWeights: seed.primitiveWeights,
      clarificationQuestions: seed.clarificationQuestions,
      confidenceGates: seed.confidenceGates,
      candidateKindHints: seed.candidateKindHints,
      catalogLoadOverlay: seed.catalogLoadOverlay,
    });
  }
  return seededProfile({
    ...seed,
    sportConfigId: seed.sportConfigId || catalogEntry?.id,
  });
};

export const PHASE_J_SPORT_DETECTION_PROFILES: PhaseJSportDetectionProfile[] =
  PHASE_J_SPORT_DETECTION_PROFILE_SEEDS.map(profileFromSeed);

const cloneProfile = (profile: PhaseJSportDetectionProfile): PhaseJSportDetectionProfile => ({
  ...profile,
  sessionTypes: [...profile.sessionTypes],
  primitiveWeights: profile.primitiveWeights.map((weight) => ({ ...weight, candidateKinds: weight.candidateKinds ? [...weight.candidateKinds] : undefined })),
  clarificationQuestions: profile.clarificationQuestions.map((questionEntry) => ({
    ...questionEntry,
    answerOptions: questionEntry.answerOptions ? [...questionEntry.answerOptions] : undefined,
    missingContextResolved: [...questionEntry.missingContextResolved],
  })),
  confidenceGates: { ...profile.confidenceGates },
  loadInputs: profile.loadInputs.map((input) => ({ ...input, candidateKinds: input.candidateKinds ? [...input.candidateKinds] : undefined })),
  candidateKindHints: profile.candidateKindHints.map((hint) => ({
    ...hint,
    positiveHints: [...hint.positiveHints],
    ambiguousWith: hint.ambiguousWith ? [...hint.ambiguousWith] : undefined,
  })),
});

export const listPhaseJSportDetectionProfiles = (): PhaseJSportDetectionProfile[] =>
  PHASE_J_SPORT_DETECTION_PROFILES.map(cloneProfile);

// Detection posture for catalog sports without a code-owned seed above: the
// catalog loadModel drives the load blend, and detection scoring falls back to
// the generic team-practice shape until a sport-specific seed is authored.
const catalogFallbackProfile = (sportId: string): PhaseJSportDetectionProfile | undefined => {
  const catalogEntry = catalogSportById(sportId);
  if (!catalogEntry?.reportPolicy?.loadModel) return undefined;
  return mapPulseCheckSportConfigToPhaseJDetectionProfile({
    sportConfig: catalogEntry,
    sessionTypes: ['practice', 'conditioning', 'game'],
    primitiveWeights: [
      primitiveWeight('durationMin', 0.8, { min: 25 }),
      primitiveWeight('movementDensity', 0.8, { min: 0.25 }),
      primitiveWeight('internalLoadHr', 0.6, { min: 12 }),
      primitiveWeight('accelerationBurstCount', 0.4, { min: 6 }),
    ],
    candidateKindHints: [
      candidateHint('practice', ['team schedule overlap', 'moderate to high movement density'], ['conditioning', 'game'], 'directional'),
      candidateHint('game', ['competition schedule match', 'sustained load'], ['practice'], 'directional'),
      candidateHint('conditioning', ['high HR with less sport-specific structure'], ['practice'], 'directional'),
    ],
    catalogLoadOverlay: { supplementalInputs: supplementalTeamSportLoadInputs },
  });
};

const catalogFallbackProfileCloned = (sportId: string): PhaseJSportDetectionProfile | undefined => {
  const profile = catalogFallbackProfile(sportId);
  return profile ? cloneProfile(profile) : undefined;
};

export const getPhaseJSportDetectionProfile = (
  sportId: string,
): PhaseJSportDetectionProfile | undefined => {
  const normalizedSportId = normalizeSportId(sportId);
  const profile = PHASE_J_SPORT_DETECTION_PROFILES.find(
    (candidate) => candidate.sportId === normalizedSportId || candidate.sportConfigId === normalizedSportId,
  );
  if (profile) return cloneProfile(profile);
  return catalogFallbackProfileCloned(normalizedSportId);
};

export const getClarificationQuestionsForCandidateKind = (
  candidateKind: PhaseJSessionType,
  sportId?: string,
): PhaseJSportDetectionClarificationQuestion[] => {
  const profiles = sportId
    ? [getPhaseJSportDetectionProfile(sportId)].filter((profile): profile is PhaseJSportDetectionProfile => Boolean(profile))
    : PHASE_J_SPORT_DETECTION_PROFILES;

  const seen = new Set<string>();
  return profiles
    .flatMap((profile) => profile.clarificationQuestions)
    .filter((questionEntry) => questionEntry.candidateKind === candidateKind)
    .filter((questionEntry) => {
      if (seen.has(questionEntry.id)) return false;
      seen.add(questionEntry.id);
      return true;
    })
    .map((questionEntry) => ({
      ...questionEntry,
      answerOptions: questionEntry.answerOptions ? [...questionEntry.answerOptions] : undefined,
      missingContextResolved: [...questionEntry.missingContextResolved],
    }));
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundTo = (value: number, decimals = 3): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const sumHrZoneMinutes = (
  snapshot: PhaseJPrimitiveSnapshot,
  predicate: (zoneId: string) => boolean,
): number | undefined => {
  const entries = Object.entries(snapshot.hrZoneMinutes || {}).filter(([zoneId]) => predicate(zoneId));
  if (entries.length === 0) return undefined;
  return entries.reduce((sum, [, minutes]) => sum + (isFiniteNumber(minutes) ? minutes : 0), 0);
};

const primitiveValue = (
  snapshot: PhaseJPrimitiveSnapshot,
  key: PhaseJPrimitiveProfileKey,
): number | undefined => {
  if (key === 'durationMin') return snapshot.durationSec / 60;
  if (key === 'totalHrZoneMinutes') return sumHrZoneMinutes(snapshot, () => true);
  if (key === 'activeHrZoneMinutes') return sumHrZoneMinutes(snapshot, (zoneId) => zoneId !== 'rest');
  if (key === 'highIntensityMinutes') {
    return sumHrZoneMinutes(snapshot, (zoneId) => ['zone4', 'zone5', 'high', 'max'].includes(zoneId));
  }
  if (key === 'internalLoadHr') {
    const zoneWeights: Record<string, number> = {
      rest: 0,
      zone1: 1,
      zone2: 2,
      zone3: 3,
      zone4: 4,
      zone5: 5,
      high: 4,
      max: 5,
    };
    const entries = Object.entries(snapshot.hrZoneMinutes || {});
    if (entries.length === 0) return undefined;
    return entries.reduce((sum, [zoneId, minutes]) => {
      const weight = zoneWeights[zoneId] ?? 1;
      return sum + (isFiniteNumber(minutes) ? minutes * weight : 0);
    }, 0);
  }
  if (key.startsWith('hrZoneMinutes.')) {
    const zoneId = key.replace('hrZoneMinutes.', '');
    return snapshot.hrZoneMinutes?.[zoneId];
  }

  const value = snapshot[key as keyof PhaseJPrimitiveSnapshot];
  return isFiniteNumber(value) ? value : undefined;
};

const scorePrimitiveWeight = (
  snapshot: PhaseJPrimitiveSnapshot,
  primitive: PhaseJPrimitiveProfileWeight,
): number => {
  const value = primitiveValue(snapshot, primitive.sourceField || primitive.key);
  if (!isFiniteNumber(value)) return 0;

  const matchMode = primitive.matchMode || 'minimum';
  if (matchMode === 'presence') return value > 0 ? 1 : 0;

  if (matchMode === 'maximum') {
    if (!isFiniteNumber(primitive.max)) return value > 0 ? 1 : 0;
    if (value <= primitive.max) return 1;
    return primitive.max <= 0 ? 0 : clamp(primitive.max / value, 0, 1);
  }

  if (matchMode === 'range') {
    const min = primitive.min;
    const max = primitive.max;
    if (isFiniteNumber(min) && value < min) return min <= 0 ? 0 : clamp(value / min, 0, 1);
    if (isFiniteNumber(max) && value > max) return max <= 0 ? 0 : clamp(max / value, 0, 1);
    return 1;
  }

  if (!isFiniteNumber(primitive.min)) return value > 0 ? 1 : 0;
  if (value >= primitive.min) return 1;
  return primitive.min <= 0 ? 0 : clamp(value / primitive.min, 0, 1);
};

export const scorePrimitiveProfileMatch = (
  profile: PhaseJSportDetectionProfile,
  primitiveSnapshot: PhaseJPrimitiveSnapshot,
  candidateKind?: PhaseJSessionType,
): number => {
  const weights = profile.primitiveWeights.filter(
    (weight) => !candidateKind || !weight.candidateKinds || weight.candidateKinds.includes(candidateKind),
  );

  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, weight.weight), 0);
  if (totalWeight <= 0) return 0;

  const weightedScore = weights.reduce((sum, weight) => {
    const primitiveScore = scorePrimitiveWeight(primitiveSnapshot, weight);
    return sum + primitiveScore * Math.max(0, weight.weight);
  }, 0);

  return roundTo(clamp(weightedScore / totalWeight, 0, 1));
};
