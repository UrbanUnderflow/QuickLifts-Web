import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Doctrine constants
// ---------------------------------------------------------------------------

export const ADAPTIVE_FRAMING_SCALE_COLLECTION = 'pulsecheck-adaptive-framing-scale';
export const TRANSLATION_TABLE_COLLECTION = 'pulsecheck-translation-table';
export const CONVERSATION_TREE_COLLECTION = 'pulsecheck-conversation-tree';
export const OFF_LIMITS_CONFIG_COLLECTION = 'pulsecheck-off-limits-config';
export const TRANSLATION_LOG_COLLECTION = 'pulsecheck-nora-translation-log';

export const OFF_LIMITS_CONFIG_DOCUMENT_ID = 'current';
export const ADAPTIVE_FRAMING_SCALE_DOCUMENT_ID = 'current';

export const VOICE_REVIEW_STATUSES = [
  'seed-pending-review',
  'reviewed',
  'needs-revision',
] as const;
export type VoiceReviewStatus = (typeof VOICE_REVIEW_STATUSES)[number];

export const FRAMING_TIERS = ['mild', 'standard', 'strong'] as const;
export type FramingTier = (typeof FRAMING_TIERS)[number];

export const SURFACE_VISIBILITIES = ['coach-only', 'athlete-allowed'] as const;
export type SurfaceVisibility = (typeof SURFACE_VISIBILITIES)[number];

export const PRIMING_RISK_TIERS = ['high', 'medium', 'low', 'safe'] as const;
export type PrimingRiskTier = (typeof PRIMING_RISK_TIERS)[number];

export const TRANSLATION_DOMAINS = ['sleep', 'travel', 'autonomic', 'load', 'circadian'] as const;
export type TranslationDomain = (typeof TRANSLATION_DOMAINS)[number];

export const CONVERSATION_TRIGGERS = [
  'coach-context-flag',
  'hcsr-delta-detected',
  'calendar-sport-event',
  'behavioral-drift',
] as const;
export type ConversationTrigger = (typeof CONVERSATION_TRIGGERS)[number];

// Doctrine: forbidden performance-priming markers. Athletes never see numeric
// values for these; coaches see evidence-rich. Erlacher et al. 2014 basis.
export const PERFORMANCE_PRIMING_MARKERS = [
  'hrv',
  'sleepScore',
  'readiness',
  'recovery',
  'rhr',
  'tempDev',
  'daytimeStress',
  'acwr',
  'compositeScores',
] as const;
export type PerformancePrimingMarker = (typeof PERFORMANCE_PRIMING_MARKERS)[number];

// ---------------------------------------------------------------------------
// Adaptive Framing Scale
// ---------------------------------------------------------------------------

export interface FramingScaleSignalEntry {
  signalId: string;
  primingRiskTier: PrimingRiskTier;
  framingTier: FramingTier;
  surfaceVisibility: SurfaceVisibility;
  rationale: string;
}

export interface FramingScaleRevisionLogEntry {
  revisionId: string;
  authorUserId: string;
  authorRole: string;
  summary: string;
  recordedAt: Timestamp | null;
}

export interface AdaptiveFramingScale {
  id: string;
  version: string;
  signals: FramingScaleSignalEntry[];
  revisionLog: FramingScaleRevisionLogEntry[];
  revisionId: string;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Translation Table
// ---------------------------------------------------------------------------

export interface TranslationRow {
  id: string;
  domain: TranslationDomain;
  state: string;
  athletePhrasing: string;
  requiredActionVerbs: string[];
  forbiddenTokens: string[];
  voiceReviewStatus: VoiceReviewStatus;
  revisionId: string;
  createdBy: string;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  archivedAt?: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Conversation Tree
// ---------------------------------------------------------------------------

export interface ConversationNode {
  nodeId: string;
  text: string;
  voiceReviewStatus: VoiceReviewStatus;
  notes?: string;
}

export interface ConversationBranch {
  id: string;
  trigger: ConversationTrigger;
  description: string;
  opener: ConversationNode;
  probe: ConversationNode;
  actionDelivery: ConversationNode;
  revisionId: string;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  archivedAt?: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Off-Limits Config (singleton)
// ---------------------------------------------------------------------------

export interface NumericValueRule {
  ruleId: string;
  pattern: string;
  flags?: string;
  description: string;
}

export interface OffLimitsConfig {
  id: typeof OFF_LIMITS_CONFIG_DOCUMENT_ID;
  forbiddenMarkers: string[];
  forbiddenPhrasePatterns: string[];
  numericValueRules: NumericValueRule[];
  revisionId: string;
  updatedBy: string;
  updatedAt?: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const issue = (field: string, message: string): ValidationIssue => ({ field, message });

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const matchesAnyMarker = (text: string, markers: readonly string[]) => {
  const lower = text.toLowerCase();
  return markers.some((marker) => lower.includes(marker.toLowerCase()));
};

const NUMERIC_NEAR_MARKER_REGEX = /\d+\s?(ms|bpm|°[FC]|%)/i;

export const validateTranslationRow = (
  row: TranslationRow,
  offLimits?: Pick<OffLimitsConfig, 'forbiddenMarkers' | 'forbiddenPhrasePatterns' | 'numericValueRules'>,
): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (!isString(row.id)) issues.push(issue('id', 'id is required'));
  if (!TRANSLATION_DOMAINS.includes(row.domain)) {
    issues.push(issue('domain', `domain must be one of ${TRANSLATION_DOMAINS.join(', ')}`));
  }
  if (!isString(row.state)) issues.push(issue('state', 'state is required'));
  if (!isString(row.athletePhrasing)) {
    issues.push(issue('athletePhrasing', 'athletePhrasing is required'));
  }
  if (!VOICE_REVIEW_STATUSES.includes(row.voiceReviewStatus)) {
    issues.push(issue('voiceReviewStatus', `must be one of ${VOICE_REVIEW_STATUSES.join(', ')}`));
  }

  const phrasing = isString(row.athletePhrasing) ? row.athletePhrasing : '';

  if (phrasing) {
    const sentenceCount = phrasing
      .split(/[.!?]+/)
      .map((part) => part.trim())
      .filter(Boolean).length;
    if (sentenceCount < 1 || sentenceCount > 3) {
      issues.push(issue('athletePhrasing', 'athletePhrasing must be 1–3 sentences'));
    }
  }

  if (Array.isArray(row.requiredActionVerbs) && row.requiredActionVerbs.length > 0 && phrasing) {
    const lowered = phrasing.toLowerCase();
    const missing = row.requiredActionVerbs.filter((verb) => !lowered.includes(verb.toLowerCase()));
    if (missing.length > 0) {
      issues.push(
        issue(
          'athletePhrasing',
          `athletePhrasing missing required action verbs: ${missing.join(', ')}`,
        ),
      );
    }
  }

  if (Array.isArray(row.forbiddenTokens) && phrasing) {
    const present = row.forbiddenTokens.filter((token) =>
      phrasing.toLowerCase().includes(token.toLowerCase()),
    );
    if (present.length > 0) {
      issues.push(
        issue('athletePhrasing', `athletePhrasing contains forbidden tokens: ${present.join(', ')}`),
      );
    }
  }

  if (offLimits && phrasing) {
    if (matchesAnyMarker(phrasing, offLimits.forbiddenMarkers ?? [])) {
      if (NUMERIC_NEAR_MARKER_REGEX.test(phrasing)) {
        issues.push(
          issue(
            'athletePhrasing',
            'athletePhrasing pairs a numeric value with an off-limits marker',
          ),
        );
      }
    }

    for (const pattern of offLimits.forbiddenPhrasePatterns ?? []) {
      try {
        if (new RegExp(pattern, 'i').test(phrasing)) {
          issues.push(
            issue('athletePhrasing', `athletePhrasing matches forbidden phrase pattern: ${pattern}`),
          );
        }
      } catch {
        issues.push(issue('forbiddenPhrasePatterns', `invalid regex pattern: ${pattern}`));
      }
    }

    for (const rule of offLimits.numericValueRules ?? []) {
      try {
        if (new RegExp(rule.pattern, rule.flags ?? 'i').test(phrasing)) {
          issues.push(
            issue(
              'athletePhrasing',
              `athletePhrasing violates numeric value rule '${rule.ruleId}'`,
            ),
          );
        }
      } catch {
        issues.push(issue('numericValueRules', `invalid regex pattern in rule '${rule.ruleId}'`));
      }
    }
  }

  return { ok: issues.length === 0, issues };
};

export const validateConversationBranch = (branch: ConversationBranch): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (!isString(branch.id)) issues.push(issue('id', 'id is required'));
  if (!CONVERSATION_TRIGGERS.includes(branch.trigger)) {
    issues.push(issue('trigger', `trigger must be one of ${CONVERSATION_TRIGGERS.join(', ')}`));
  }

  const validateNode = (node: ConversationNode | undefined, path: string) => {
    if (!node || typeof node !== 'object') {
      issues.push(issue(path, `${path} is required`));
      return;
    }
    if (!isString(node.nodeId)) issues.push(issue(`${path}.nodeId`, 'nodeId is required'));
    if (!isString(node.text)) issues.push(issue(`${path}.text`, 'text is required'));
    if (!VOICE_REVIEW_STATUSES.includes(node.voiceReviewStatus)) {
      issues.push(
        issue(
          `${path}.voiceReviewStatus`,
          `must be one of ${VOICE_REVIEW_STATUSES.join(', ')}`,
        ),
      );
    }
  };

  validateNode(branch.opener, 'opener');
  validateNode(branch.probe, 'probe');
  validateNode(branch.actionDelivery, 'actionDelivery');

  // v1 max-depth enforcement: branches must contain only the three named nodes.
  // Future versions may add probes[]; until then, reject extra node-shaped fields.
  const allowedKeys = new Set([
    'id',
    'trigger',
    'description',
    'opener',
    'probe',
    'actionDelivery',
    'revisionId',
    'createdBy',
    'createdAt',
    'updatedAt',
    'archivedAt',
  ]);
  for (const key of Object.keys(branch)) {
    if (!allowedKeys.has(key)) {
      issues.push(issue(key, `unexpected field '${key}' on conversation branch (v1 max-depth)`));
    }
  }

  return { ok: issues.length === 0, issues };
};

export const validateAdaptiveFramingScale = (scale: AdaptiveFramingScale): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (!isString(scale.id)) issues.push(issue('id', 'id is required'));
  if (!isString(scale.version)) issues.push(issue('version', 'version is required'));
  if (!Array.isArray(scale.signals) || scale.signals.length === 0) {
    issues.push(issue('signals', 'signals must be a non-empty array'));
  } else {
    const seen = new Set<string>();
    scale.signals.forEach((signal, index) => {
      if (!isString(signal.signalId)) {
        issues.push(issue(`signals[${index}].signalId`, 'signalId is required'));
        return;
      }
      if (seen.has(signal.signalId)) {
        issues.push(issue(`signals[${index}].signalId`, `duplicate signalId '${signal.signalId}'`));
      }
      seen.add(signal.signalId);
      if (!PRIMING_RISK_TIERS.includes(signal.primingRiskTier)) {
        issues.push(
          issue(
            `signals[${index}].primingRiskTier`,
            `primingRiskTier must be one of ${PRIMING_RISK_TIERS.join(', ')}`,
          ),
        );
      }
      if (!FRAMING_TIERS.includes(signal.framingTier)) {
        issues.push(
          issue(`signals[${index}].framingTier`, `framingTier must be one of ${FRAMING_TIERS.join(', ')}`),
        );
      }
      if (!SURFACE_VISIBILITIES.includes(signal.surfaceVisibility)) {
        issues.push(
          issue(
            `signals[${index}].surfaceVisibility`,
            `surfaceVisibility must be one of ${SURFACE_VISIBILITIES.join(', ')}`,
          ),
        );
      }
      if (!isString(signal.rationale)) {
        issues.push(issue(`signals[${index}].rationale`, 'rationale is required'));
      }
    });

    // Doctrine guard: every performance-priming marker must be classified
    // coach-only so it can never accidentally surface to athletes.
    for (const marker of PERFORMANCE_PRIMING_MARKERS) {
      const entry = scale.signals.find((signal) => signal.signalId === marker);
      if (!entry) {
        issues.push(issue('signals', `framing scale missing performance-priming marker '${marker}'`));
        continue;
      }
      if (entry.surfaceVisibility !== 'coach-only') {
        issues.push(
          issue(
            `signals[${marker}].surfaceVisibility`,
            `performance-priming marker '${marker}' must be coach-only`,
          ),
        );
      }
    }
  }

  return { ok: issues.length === 0, issues };
};

export const validateOffLimitsConfig = (config: OffLimitsConfig): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (config.id !== OFF_LIMITS_CONFIG_DOCUMENT_ID) {
    issues.push(issue('id', `id must equal '${OFF_LIMITS_CONFIG_DOCUMENT_ID}'`));
  }
  if (!Array.isArray(config.forbiddenMarkers) || config.forbiddenMarkers.length === 0) {
    issues.push(issue('forbiddenMarkers', 'forbiddenMarkers must be a non-empty array'));
  } else {
    for (const marker of PERFORMANCE_PRIMING_MARKERS) {
      if (!config.forbiddenMarkers.some((entry) => entry.toLowerCase() === marker.toLowerCase())) {
        issues.push(
          issue('forbiddenMarkers', `forbiddenMarkers missing performance-priming marker '${marker}'`),
        );
      }
    }
  }

  for (const pattern of config.forbiddenPhrasePatterns ?? []) {
    try {
      new RegExp(pattern);
    } catch {
      issues.push(issue('forbiddenPhrasePatterns', `invalid regex: ${pattern}`));
    }
  }

  for (const rule of config.numericValueRules ?? []) {
    if (!isString(rule.ruleId)) {
      issues.push(issue('numericValueRules', 'numericValueRules entry missing ruleId'));
      continue;
    }
    try {
      new RegExp(rule.pattern, rule.flags ?? '');
    } catch {
      issues.push(issue('numericValueRules', `invalid regex in rule '${rule.ruleId}'`));
    }
  }

  return { ok: issues.length === 0, issues };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Map a signal id to its priming-risk tier per Athlete Surface Doctrine.
// `safe` means it can be exposed numerically; `high` means coach-only forever.
export const derivePrimingRiskTier = (signalId: string): PrimingRiskTier => {
  const normalized = signalId.trim();
  if ((PERFORMANCE_PRIMING_MARKERS as readonly string[]).includes(normalized)) {
    return 'high';
  }
  if (/score$|index$|composite/i.test(normalized)) return 'high';
  if (/^(hr|spo2|temp|bodyTemp|coreTemp)/i.test(normalized)) return 'medium';
  if (/^(sleepDuration|totalSleepMin|sleepMidpoint|sleepMidpointShiftMinutes)$/i.test(normalized)) {
    return 'low';
  }
  if (/^(daytimeAutonomicLoadMinutes|stepsCount|trainingMinutes)$/i.test(normalized)) {
    return 'low';
  }
  return 'safe';
};

// Merge two off-limits configs preserving regex compatibility.
// Newer fields win; arrays are union-merged (deduped, case-insensitive).
export const mergeOffLimitsConfig = (
  current: OffLimitsConfig | null,
  next: Partial<OffLimitsConfig>,
): OffLimitsConfig => {
  const base: OffLimitsConfig = current ?? {
    id: OFF_LIMITS_CONFIG_DOCUMENT_ID,
    forbiddenMarkers: [],
    forbiddenPhrasePatterns: [],
    numericValueRules: [],
    revisionId: '',
    updatedBy: '',
  };

  const dedupeStrings = (values: string[]) => {
    const seen = new Map<string, string>();
    for (const value of values) {
      const key = value.toLowerCase();
      if (!seen.has(key)) seen.set(key, value);
    }
    return Array.from(seen.values());
  };

  const dedupeRules = (values: NumericValueRule[]) => {
    const seen = new Map<string, NumericValueRule>();
    for (const rule of values) {
      if (!seen.has(rule.ruleId)) seen.set(rule.ruleId, rule);
    }
    return Array.from(seen.values());
  };

  return {
    id: OFF_LIMITS_CONFIG_DOCUMENT_ID,
    forbiddenMarkers: dedupeStrings([
      ...(base.forbiddenMarkers ?? []),
      ...(next.forbiddenMarkers ?? []),
    ]),
    forbiddenPhrasePatterns: dedupeStrings([
      ...(base.forbiddenPhrasePatterns ?? []),
      ...(next.forbiddenPhrasePatterns ?? []),
    ]),
    numericValueRules: dedupeRules([
      ...(base.numericValueRules ?? []),
      ...(next.numericValueRules ?? []),
    ]),
    revisionId: next.revisionId ?? base.revisionId,
    updatedBy: next.updatedBy ?? base.updatedBy,
    updatedAt: next.updatedAt ?? base.updatedAt ?? null,
  };
};

export const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as unknown as T;
  }
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    output[key] = stripUndefinedDeep(entry);
  }
  return output as T;
};
