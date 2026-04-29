// Phase B+ — Anthropic gateway routing config.
//
// Single source of truth for which provider each customer-facing feature uses,
// what model it pins to, and (for dual-path features) which provider to fall
// back to. Bump model strings here when 4.7/4.8 lands — every endpoint and the
// bridge gateway read from this file.

export const ANTHROPIC_MODEL_SONNET_4_6 = 'claude-sonnet-4-6';
export const ANTHROPIC_MODEL_HAIKU_4_5 = 'claude-haiku-4-5';

// Pattern used by anthropic-bridge.ts to gate model strings the client may
// pass through. Accepts current Claude 4.5+ family ids; rejects everything
// else so a compromised client can't escalate to a more expensive model.
export const ANTHROPIC_MODEL_PATTERN = /^claude-(sonnet|haiku|opus)-4-(5|6|7)(-\d{8})?$/;

export type Provider = 'anthropic' | 'openai';

// migrationModeId tags every fallback log row so the post-pilot audit can
// filter by which migration cohort the entry came from.
export type MigrationModeId =
  | 'macra-full-cutover-v1'
  | 'pulsecheck-dual-path-v1';

export interface FeatureRoutingConfig {
  // Stable feature id — lowercased, kebab-case. Matches the `anthropic-organization`
  // header value used by the bridge gateway.
  featureId: string;
  provider: Provider;
  fallbackProvider?: Provider;
  model: string;
  // Hard cap enforced by the bridge gateway. Endpoint-side calls may pass a
  // smaller value, but never larger.
  maxTokens: number;
  migrationModeId: MigrationModeId;
}

// Macra full-cutover features. No fallback — pre-release, no users.
export const NORA_NUTRITION_CHAT: FeatureRoutingConfig = {
  featureId: 'noraNutritionChat',
  provider: 'anthropic',
  model: ANTHROPIC_MODEL_SONNET_4_6,
  maxTokens: 700,
  migrationModeId: 'macra-full-cutover-v1',
};

export const MACRA_MEAL_PLAN: FeatureRoutingConfig = {
  featureId: 'macraMealPlan',
  provider: 'anthropic',
  model: ANTHROPIC_MODEL_SONNET_4_6,
  maxTokens: 2000,
  migrationModeId: 'macra-full-cutover-v1',
};

export const MACRA_DAILY_INSIGHT: FeatureRoutingConfig = {
  featureId: 'macraDailyInsight',
  provider: 'anthropic',
  model: ANTHROPIC_MODEL_SONNET_4_6,
  maxTokens: 1200,
  migrationModeId: 'macra-full-cutover-v1',
};

// PulseCheck dual-path features (Phase B+ Part 2 — to be wired in next step).
// Listed here so featureRouting is the single source of truth.
export const PULSECHECK_PROTOCOL_PRACTICE_EVAL: FeatureRoutingConfig = {
  featureId: 'pulsecheckProtocolPracticeEval',
  provider: 'anthropic',
  fallbackProvider: 'openai',
  model: ANTHROPIC_MODEL_SONNET_4_6,
  maxTokens: 2000,
  migrationModeId: 'pulsecheck-dual-path-v1',
};

export const PULSECHECK_SPORT_INTELLIGENCE: FeatureRoutingConfig = {
  featureId: 'pulsecheckSportIntelligence',
  provider: 'anthropic',
  fallbackProvider: 'openai',
  model: ANTHROPIC_MODEL_SONNET_4_6,
  maxTokens: 8000,
  migrationModeId: 'pulsecheck-dual-path-v1',
};

// Note: ttsMentalStep is not migratable. tts-mental-step.ts performs
// audio synthesis (openai.audio.speech.create → MP3 bytes) and Anthropic has no
// TTS API. Removed from this routing config. The endpoint stays on OpenAI/ElevenLabs.

export const GENERATE_CAPTION: FeatureRoutingConfig = {
  featureId: 'generateCaption',
  provider: 'anthropic',
  fallbackProvider: 'openai',
  model: ANTHROPIC_MODEL_HAIKU_4_5,
  maxTokens: 400,
  migrationModeId: 'pulsecheck-dual-path-v1',
};

export const FEATURE_ROUTING_CONFIGS: FeatureRoutingConfig[] = [
  NORA_NUTRITION_CHAT,
  MACRA_MEAL_PLAN,
  MACRA_DAILY_INSIGHT,
  PULSECHECK_PROTOCOL_PRACTICE_EVAL,
  PULSECHECK_SPORT_INTELLIGENCE,
  GENERATE_CAPTION,
];

const FEATURE_ROUTING_BY_ID = new Map(
  FEATURE_ROUTING_CONFIGS.map((config) => [config.featureId, config]),
);

export const getFeatureRouting = (featureId: string): FeatureRoutingConfig | null =>
  FEATURE_ROUTING_BY_ID.get(featureId) ?? null;

// Bridge gateway uses this map to enforce per-feature token caps. Keep in sync
// with the configs above — the bridge falls back to a conservative default if
// a feature id isn't listed.
export const ANTHROPIC_FEATURE_LIMITS: Record<string, { maxTokens: number; modelPattern: RegExp }> = {
  noraNutritionChat: { maxTokens: NORA_NUTRITION_CHAT.maxTokens, modelPattern: ANTHROPIC_MODEL_PATTERN },
  macraMealPlan: { maxTokens: MACRA_MEAL_PLAN.maxTokens, modelPattern: ANTHROPIC_MODEL_PATTERN },
  macraDailyInsight: { maxTokens: MACRA_DAILY_INSIGHT.maxTokens, modelPattern: ANTHROPIC_MODEL_PATTERN },
  pulsecheckProtocolPracticeEval: {
    maxTokens: PULSECHECK_PROTOCOL_PRACTICE_EVAL.maxTokens,
    modelPattern: ANTHROPIC_MODEL_PATTERN,
  },
  pulsecheckSportIntelligence: {
    maxTokens: PULSECHECK_SPORT_INTELLIGENCE.maxTokens,
    modelPattern: ANTHROPIC_MODEL_PATTERN,
  },
  generateCaption: { maxTokens: GENERATE_CAPTION.maxTokens, modelPattern: ANTHROPIC_MODEL_PATTERN },
  default: { maxTokens: 1000, modelPattern: ANTHROPIC_MODEL_PATTERN },
};
