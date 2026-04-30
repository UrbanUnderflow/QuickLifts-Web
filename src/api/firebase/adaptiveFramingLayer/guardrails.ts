// Phase C — Adaptive Framing Layer guardrails.
//
// Pure post-processors that gate athlete-facing phrasing before it ships.
// Claude is told what to do in the prompt; these enforce it. When any
// guardrail flags a violation, the translation service falls back to the
// static seed `athletePhrasing` from the translation row.
//
// No Firestore deps — guardrails are unit-testable without env setup.

import type { OffLimitsConfig, TranslationRow, ValidationIssue } from './types';

const issue = (field: string, message: string): ValidationIssue => ({ field, message });

// Mirrors validateTranslationRow in types.ts so seed phrasings (which already
// pass the validator) automatically pass guardrails too.
const NUMERIC_NEAR_MARKER_REGEX = /\d+\s?(ms|bpm|°[FC]|%)/i;

// Negative-priming patterns. Built into this module (not configurable via
// off-limits) because the rule is doctrine: never tell an athlete their body
// or numbers look bad. If we ever need to tune, move into off-limits config.
const NEGATIVE_PRIMING_PATTERNS: RegExp[] = [
  /\byour\s+\w+\s+(is|was|looks?|seems?)\s+(low|poor|bad|terrible|down|critical|elevated|off|weak)\b/i,
  /\byou[\u2019']ve\s+been\s+\w+/i,
  /\byour\s+(numbers|metrics|stats|data|scores?)\s+(look|are|show|seem)/i,
  /\b(low|poor|bad|terrible|critical|weak)\s+(hrv|sleep\s*score|sleepscore|readiness|recovery|rhr|stress|tempdev|acwr)\b/i,
];

export const validateNumericValue = (
  phrasing: string,
  offLimits: Pick<OffLimitsConfig, 'numericValueRules'>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!phrasing) return issues;

  if (NUMERIC_NEAR_MARKER_REGEX.test(phrasing)) {
    issues.push(
      issue('phrasing', 'phrasing pairs a numeric value with an off-limits unit (ms, bpm, °F/°C, %)'),
    );
  }

  for (const rule of offLimits.numericValueRules ?? []) {
    try {
      const regex = new RegExp(rule.pattern, rule.flags ?? 'i');
      if (regex.test(phrasing)) {
        issues.push(issue('phrasing', `phrasing violates numeric value rule '${rule.ruleId}'`));
      }
    } catch {
      // Bad regex in config — surface as an issue so the operator notices.
      issues.push(issue('numericValueRules', `invalid regex pattern in rule '${rule.ruleId}'`));
    }
  }

  return issues;
};

export const validateForbiddenPhrases = (
  phrasing: string,
  offLimits: Pick<OffLimitsConfig, 'forbiddenPhrasePatterns'>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!phrasing) return issues;

  for (const pattern of offLimits.forbiddenPhrasePatterns ?? []) {
    try {
      if (new RegExp(pattern, 'i').test(phrasing)) {
        issues.push(issue('phrasing', `phrasing matches forbidden phrase pattern: ${pattern}`));
      }
    } catch {
      issues.push(issue('forbiddenPhrasePatterns', `invalid regex pattern: ${pattern}`));
    }
  }

  return issues;
};

export const validateNegativePriming = (phrasing: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!phrasing) return issues;

  for (const pattern of NEGATIVE_PRIMING_PATTERNS) {
    if (pattern.test(phrasing)) {
      issues.push(issue('phrasing', `phrasing uses negative-priming language matching ${pattern}`));
    }
  }

  return issues;
};

export const validateActionPresence = (
  phrasing: string,
  requiredVerbs: readonly string[] | undefined,
): ValidationIssue[] => {
  if (!phrasing || !requiredVerbs || requiredVerbs.length === 0) return [];

  const lowered = phrasing.toLowerCase();
  // Doctrine: at least ONE required action verb must appear (substring match,
  // case-insensitive — same shape as validateTranslationRow).
  const present = requiredVerbs.some((verb) => lowered.includes(verb.toLowerCase()));
  if (present) return [];

  return [
    issue(
      'phrasing',
      `phrasing missing required action verbs (need at least one of: ${requiredVerbs.join(', ')})`,
    ),
  ];
};

export const validateSentenceCount = (phrasing: string): ValidationIssue[] => {
  if (!phrasing) return [];

  const sentenceCount = phrasing
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;

  if (sentenceCount < 1 || sentenceCount > 3) {
    return [issue('phrasing', `phrasing must be 1–3 sentences (got ${sentenceCount})`)];
  }

  return [];
};

export interface GuardrailResult {
  ok: boolean;
  violations: ValidationIssue[];
}

export const runAthletePhrasingGuardrails = (
  phrasing: string,
  row: Pick<TranslationRow, 'requiredActionVerbs'>,
  offLimits: Pick<OffLimitsConfig, 'numericValueRules' | 'forbiddenPhrasePatterns'>,
): GuardrailResult => {
  const violations: ValidationIssue[] = [
    ...validateNumericValue(phrasing, offLimits),
    ...validateForbiddenPhrases(phrasing, offLimits),
    ...validateNegativePriming(phrasing),
    ...validateActionPresence(phrasing, row.requiredActionVerbs),
    ...validateSentenceCount(phrasing),
  ];

  return { ok: violations.length === 0, violations };
};
