import {
  ADAPTIVE_FRAMING_SCALE_DOCUMENT_ID,
  AdaptiveFramingScale,
  ConversationBranch,
  FramingScaleSignalEntry,
  NumericValueRule,
  OFF_LIMITS_CONFIG_DOCUMENT_ID,
  OffLimitsConfig,
  PERFORMANCE_PRIMING_MARKERS,
  TranslationRow,
} from './types';

// ---------------------------------------------------------------------------
// Adaptive Framing Scale (singleton 'current')
// ---------------------------------------------------------------------------

// Performance-priming markers (Erlacher et al. 2014 doctrine): coach-only,
// strong framing tier, high priming risk. Athletes never see numeric values.
const performancePrimingSignals: FramingScaleSignalEntry[] = (
  PERFORMANCE_PRIMING_MARKERS as readonly string[]
).map((signalId) => ({
  signalId,
  primingRiskTier: 'high',
  framingTier: 'strong',
  surfaceVisibility: 'coach-only',
  rationale:
    'Performance-priming marker. Athletes receive translated guidance only; numeric values are coach-only per Athlete Surface Doctrine.',
}));

const lowRiskSignals: FramingScaleSignalEntry[] = [
  {
    signalId: 'sleepMidpoint',
    primingRiskTier: 'low',
    framingTier: 'mild',
    surfaceVisibility: 'athlete-allowed',
    rationale: 'Schedule anchor; framed as a rhythm cue, not a performance verdict.',
  },
  {
    signalId: 'sleepMidpointShiftMinutes',
    primingRiskTier: 'low',
    framingTier: 'mild',
    surfaceVisibility: 'athlete-allowed',
    rationale: 'Shift magnitude can be referenced as travel context, not as a score.',
  },
  {
    signalId: 'daytimeAutonomicLoadMinutes',
    primingRiskTier: 'low',
    framingTier: 'mild',
    surfaceVisibility: 'athlete-allowed',
    rationale: 'Time-in-state framing; usable as a daily texture cue without scoring.',
  },
  {
    signalId: 'circadianDisruption',
    primingRiskTier: 'low',
    framingTier: 'standard',
    surfaceVisibility: 'athlete-allowed',
    rationale: 'Interpretation band (settled/mild_shift/travel_signature/jetlag_significant) — never a number.',
  },
  {
    signalId: 'totalSleepMin',
    primingRiskTier: 'low',
    framingTier: 'mild',
    surfaceVisibility: 'athlete-allowed',
    rationale: 'Duration is non-priming when used as plain context, not as a score.',
  },
];

export const SEED_ADAPTIVE_FRAMING_SCALE: AdaptiveFramingScale = {
  id: ADAPTIVE_FRAMING_SCALE_DOCUMENT_ID,
  version: '2026-04-28-seed-v1',
  signals: [...performancePrimingSignals, ...lowRiskSignals],
  revisionLog: [
    {
      revisionId: 'r-2026-04-28-seed-v1',
      authorUserId: 'system-seed',
      authorRole: 'system',
      summary:
        'Initial scale: all performance-priming markers locked coach-only/strong; rhythm and duration signals athlete-allowed at mild framing.',
      recordedAt: null,
    },
  ],
  revisionId: 'r-2026-04-28-seed-v1',
  createdBy: 'system-seed',
};

// ---------------------------------------------------------------------------
// Translation Table — 15 starter rows
// ---------------------------------------------------------------------------

// Voice constraints (locked at seed time):
//   • Nora voice: warm but not saccharine, coach-adjacent, never pathologizing
//   • Action-verb-led
//   • No numerics for off-limits markers
//   • No negative priming ("your X is poor/low/bad", "you've been...")
//   • 1–3 sentences
//   • No emoji unless the row is an explicit encouragement-only path
//
// Every row ships voiceReviewStatus: 'seed-pending-review' so Tremaine can
// audit row-by-row in the Phase E admin surface and flip to 'reviewed' once
// each is signed off. Phase C guardrails fall back to these strings when a
// model output is rejected.
export const SEED_TRANSLATION_ROWS: TranslationRow[] = [
  {
    id: 'sleep-strong',
    domain: 'sleep',
    state: 'strong',
    athletePhrasing:
      'Carry that into your warm-up. Move with intent and lock in your first reps.',
    requiredActionVerbs: ['Carry', 'Move', 'lock'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'sleep-adequate',
    domain: 'sleep',
    state: 'adequate',
    athletePhrasing:
      'Get ten minutes of morning sunlight and hydrate before your warm-up. Steady is plenty for today.',
    requiredActionVerbs: ['Get', 'hydrate'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'sleep-debt',
    domain: 'sleep',
    state: 'debt',
    athletePhrasing:
      'Box-breathe through your warm-up and add a slow second-rep on your top sets. Trust your reps; the body will follow.',
    requiredActionVerbs: ['Box-breathe', 'Trust'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'sleep-deficit',
    domain: 'sleep',
    state: 'deficit',
    athletePhrasing:
      'Lean into a longer warm-up — five extra minutes today. Pick one technical focus and let everything else come to you.',
    requiredActionVerbs: ['Lean', 'Pick'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'travel-pre-departure',
    domain: 'travel',
    state: 'pre-departure',
    athletePhrasing:
      'Pack a water bottle and a no-screen wind-down book. Set your alarm to your destination time tonight to start the shift.',
    requiredActionVerbs: ['Pack', 'Set'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'travel-day-of-arrival',
    domain: 'travel',
    state: 'day-of-arrival',
    athletePhrasing:
      'Get sunlight on your eyes within the first hour. Hydrate, walk for ten, and eat at the local meal time.',
    requiredActionVerbs: ['Get', 'Hydrate', 'walk'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'travel-day-2-post',
    domain: 'travel',
    state: 'day-2-post',
    athletePhrasing:
      'Schedule your hardest block earlier than usual today. Box-breathe before your warm-up and ride the body’s natural pull.',
    requiredActionVerbs: ['Schedule', 'Box-breathe'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'autonomic-sympathetic-dominant',
    domain: 'autonomic',
    state: 'sympathetic-dominant',
    athletePhrasing:
      'Box-breathe four rounds before warm-up — in four, hold four, out six. Walk into the session unhurried.',
    requiredActionVerbs: ['Box-breathe', 'Walk'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'autonomic-parasympathetic-restored',
    domain: 'autonomic',
    state: 'parasympathetic-restored',
    athletePhrasing:
      'Lean in. Push the tempo on your top set and trust the reps you’ve banked.',
    requiredActionVerbs: ['Lean', 'Push', 'trust'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'load-acwr-climbing',
    domain: 'load',
    state: 'acwr-climbing',
    athletePhrasing:
      'Tighten your warm-up and skip the optional accessory. Save the spare reps for next week.',
    requiredActionVerbs: ['Tighten', 'Save'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'load-acwr-settled',
    domain: 'load',
    state: 'acwr-settled',
    athletePhrasing:
      'Stack a quality second wave on top of your main lift. The base is here; build on it.',
    requiredActionVerbs: ['Stack', 'build'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'circadian-settled',
    domain: 'circadian',
    state: 'settled',
    athletePhrasing:
      'Roll into your warm-up on schedule. Move with intent and let the rhythm carry.',
    requiredActionVerbs: ['Roll', 'Move'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'circadian-mild-shift',
    domain: 'circadian',
    state: 'mild_shift',
    athletePhrasing:
      'Get sunlight within fifteen minutes of waking and hydrate before your warm-up. Anchor your meal times where you are.',
    requiredActionVerbs: ['Get', 'hydrate', 'Anchor'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'circadian-travel-signature',
    domain: 'circadian',
    state: 'travel_signature',
    athletePhrasing:
      'Walk in daylight for ten minutes after waking. Eat on local time and box-breathe before your hardest block.',
    requiredActionVerbs: ['Walk', 'Eat', 'box-breathe'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'circadian-jetlag-significant',
    domain: 'circadian',
    state: 'jetlag_significant',
    athletePhrasing:
      'Anchor a slow morning — daylight, walk, breakfast on local time. Save your hardest work for when your body finds the new floor.',
    requiredActionVerbs: ['Anchor', 'Save'],
    forbiddenTokens: [],
    voiceReviewStatus: 'seed-pending-review',
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
];

// ---------------------------------------------------------------------------
// Conversation Tree — 4 trigger branches (depth-1 v1)
// ---------------------------------------------------------------------------

const seedNode = (
  nodeId: string,
  text: string,
): { nodeId: string; text: string; voiceReviewStatus: 'seed-pending-review' } => ({
  nodeId,
  text,
  voiceReviewStatus: 'seed-pending-review',
});

export const SEED_CONVERSATION_BRANCHES: ConversationBranch[] = [
  {
    id: 'coach-context-flag',
    trigger: 'coach-context-flag',
    description: 'Coach has flagged something specific for this athlete to address today.',
    opener: seedNode(
      'coach-context-flag-opener',
      'Your coach left a note for you in today’s session.',
    ),
    probe: seedNode(
      'coach-context-flag-probe',
      'What’s one piece of last week you want to carry in today?',
    ),
    actionDelivery: seedNode(
      'coach-context-flag-action',
      'Lock in your warm-up routine and message your coach when you’re set.',
    ),
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'hcsr-delta-detected',
    trigger: 'hcsr-delta-detected',
    description: 'Health-context source record shows a meaningful day-over-day shift.',
    opener: seedNode(
      'hcsr-delta-opener',
      'Today’s body has a slightly different rhythm than yesterday.',
    ),
    probe: seedNode(
      'hcsr-delta-probe',
      'Where in your body are you noticing it most?',
    ),
    actionDelivery: seedNode(
      'hcsr-delta-action',
      'Add five minutes to your warm-up and box-breathe through the first round.',
    ),
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'calendar-sport-event',
    trigger: 'calendar-sport-event',
    description: 'Race, competition, or major scheduled event lands today or tomorrow.',
    opener: seedNode('calendar-event-opener', 'Big day on the calendar.'),
    probe: seedNode(
      'calendar-event-probe',
      'What’s the one cue that gets you locked in?',
    ),
    actionDelivery: seedNode(
      'calendar-event-action',
      'Walk through your warm-up at the same pace as a normal session and trust the work.',
    ),
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
  {
    id: 'behavioral-drift',
    trigger: 'behavioral-drift',
    description: 'Self-report and biomarker patterns have drifted across recent sessions.',
    opener: seedNode(
      'behavioral-drift-opener',
      'Checking in — last few days have looked a little different.',
    ),
    probe: seedNode(
      'behavioral-drift-probe',
      'Anything off the routine I should know about?',
    ),
    actionDelivery: seedNode(
      'behavioral-drift-action',
      'Pick one anchor today — sleep, food, or movement — and lean on that.',
    ),
    revisionId: 'r-2026-04-28-seed-v1',
    createdBy: 'system-seed',
  },
];

// ---------------------------------------------------------------------------
// Off-Limits Config (singleton 'current')
// ---------------------------------------------------------------------------

const numericValueRules: NumericValueRule[] = [
  {
    ruleId: 'numeric-with-unit-near-marker',
    pattern: '\\d+\\s?(ms|bpm|°[FC]|%)',
    flags: 'i',
    description: 'Numeric value with unit (ms, bpm, °F/°C, %) appearing near a forbidden marker.',
  },
  {
    ruleId: 'marker-name-with-direct-number',
    pattern:
      '\\b(hrv|sleepscore|readiness|recovery|rhr|tempdev|daytimestress|acwr)\\b\\s*[:=of]?\\s*\\d',
    flags: 'i',
    description: 'Forbidden marker name immediately followed by a numeric value.',
  },
];

const forbiddenPhrasePatterns: string[] = [
  // Direct negative priming about a marker.
  "your\\s+\\w+\\s+(is|was|looks|seems)\\s+(low|poor|bad|terrible|down|critical|elevated)",
  // "You've been..." narratives.
  "you[\\'\u2019]ve\\s+been\\s+\\w+",
  // "Your numbers..." talk.
  "your\\s+(numbers|metrics|stats|data)\\s+(look|are|show)",
  // "Low/poor + marker" framings.
  "\\b(low|poor|bad|terrible|critical)\\s+(hrv|sleep score|sleepscore|readiness|recovery|rhr|stress|tempdev|acwr)\\b",
];

export const SEED_OFF_LIMITS_CONFIG: OffLimitsConfig = {
  id: OFF_LIMITS_CONFIG_DOCUMENT_ID,
  forbiddenMarkers: [...PERFORMANCE_PRIMING_MARKERS],
  forbiddenPhrasePatterns,
  numericValueRules,
  revisionId: 'r-2026-04-28-seed-v1',
  updatedBy: 'system-seed',
};

// ---------------------------------------------------------------------------
// Aggregate seed bundle (used by seeder + tests)
// ---------------------------------------------------------------------------

export interface AdaptiveFramingLayerSeedBundle {
  framingScale: AdaptiveFramingScale;
  translationRows: TranslationRow[];
  conversationBranches: ConversationBranch[];
  offLimitsConfig: OffLimitsConfig;
}

export const getAdaptiveFramingLayerSeedBundle = (): AdaptiveFramingLayerSeedBundle => ({
  framingScale: SEED_ADAPTIVE_FRAMING_SCALE,
  translationRows: SEED_TRANSLATION_ROWS,
  conversationBranches: SEED_CONVERSATION_BRANCHES,
  offLimitsConfig: SEED_OFF_LIMITS_CONFIG,
});
