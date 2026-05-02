// =============================================================================
// Phase J QA Audit Helpers
//
// Pure validators for session candidates/records before reviewer surfaces and
// load consumers trust the payload. These helpers do not read or write Firestore.
// =============================================================================

import {
  PHASE_J_REQUIRED_PROVENANCE_FIELDS,
  isPhaseJConfidenceTier,
  type PhaseJRecordProvenance,
  type PhaseJSessionCandidate,
  type PhaseJSessionRecord,
} from './phaseJSessionContracts';

export type PhaseJQaAuditSeverity = 'error' | 'warning' | 'info';
export type PhaseJQaAuditArea = 'provenance' | 'confidence' | 'missing_context' | 'load_handoff';

export interface PhaseJQaAuditIssue {
  area: PhaseJQaAuditArea;
  severity: PhaseJQaAuditSeverity;
  code: string;
  message: string;
}

export interface PhaseJQaAuditResult {
  ok: boolean;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  issues: PhaseJQaAuditIssue[];
}

export interface PhaseJQaAuditInput {
  candidate?: Partial<PhaseJSessionCandidate> | null;
  record?: Partial<PhaseJSessionRecord> | null;
}

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const addIssue = (
  issues: PhaseJQaAuditIssue[],
  area: PhaseJQaAuditArea,
  severity: PhaseJQaAuditSeverity,
  code: string,
  message: string,
): void => {
  issues.push({ area, severity, code, message });
};

const auditProvenance = (
  issues: PhaseJQaAuditIssue[],
  provenance: Partial<PhaseJRecordProvenance> | undefined,
  label: 'candidate' | 'record',
): void => {
  if (!provenance) {
    addIssue(issues, 'provenance', 'error', `${label}_provenance_missing`, `${label} provenance is required.`);
    return;
  }

  for (const field of PHASE_J_REQUIRED_PROVENANCE_FIELDS) {
    if (!hasOwn(provenance, field)) {
      addIssue(
        issues,
        'provenance',
        'error',
        `${label}_provenance_${field}_missing`,
        `${label} provenance.${field} is required.`,
      );
    }
  }

  if (Array.isArray(provenance.sourceRecordIds) && provenance.sourceRecordIds.length === 0) {
    addIssue(
      issues,
      'provenance',
      'warning',
      `${label}_provenance_source_records_empty`,
      `${label} provenance has no sourceRecordIds; audit trace may be weak.`,
    );
  }

  if (typeof provenance.observedAt === 'number' && typeof provenance.ingestedAt === 'number') {
    if (provenance.ingestedAt < provenance.observedAt) {
      addIssue(
        issues,
        'provenance',
        'warning',
        `${label}_provenance_ingested_before_observed`,
        `${label} provenance ingestedAt is earlier than observedAt.`,
      );
    }
  }
};

const auditConfidence = (
  issues: PhaseJQaAuditIssue[],
  value: unknown,
  score: unknown,
  label: 'candidate' | 'record',
): void => {
  if (!isPhaseJConfidenceTier(value)) {
    addIssue(
      issues,
      'confidence',
      'error',
      `${label}_confidence_tier_invalid`,
      `${label} confidenceTier must be a Phase J confidence tier.`,
    );
  }

  if (score !== undefined) {
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) {
      addIssue(
        issues,
        'confidence',
        'warning',
        `${label}_confidence_score_invalid`,
        `${label} confidenceScore should be between 0 and 1 when present.`,
      );
    }
  }
};

const auditMissingContext = (
  issues: PhaseJQaAuditIssue[],
  missingContext: unknown,
  label: 'candidate' | 'record',
): void => {
  if (!Array.isArray(missingContext)) {
    addIssue(
      issues,
      'missing_context',
      'error',
      `${label}_missing_context_invalid`,
      `${label} missingContext must be an array.`,
    );
    return;
  }

  const unique = new Set(missingContext.map(String));
  if (unique.size !== missingContext.length) {
    addIssue(
      issues,
      'missing_context',
      'info',
      `${label}_missing_context_duplicates`,
      `${label} missingContext contains duplicate keys.`,
    );
  }
};

const auditRecordLoadHandoff = (
  issues: PhaseJQaAuditIssue[],
  record: Partial<PhaseJSessionRecord> | null | undefined,
): void => {
  if (!record) return;
  if (record.sessionType !== 'lift') return;

  const parsedLiftSummary = record.parsedLiftSummary as Record<string, unknown> | undefined;
  const loadContribution = record.loadContribution;
  const exercises = Array.isArray(parsedLiftSummary?.exercises) ? parsedLiftSummary.exercises : [];

  if (!parsedLiftSummary || exercises.length === 0) {
    addIssue(
      issues,
      'load_handoff',
      'warning',
      'record_lift_summary_missing',
      'Lift record has no parsedLiftSummary exercises for load consumers.',
    );
  }

  if (!loadContribution || Object.keys(loadContribution).length === 0) {
    addIssue(
      issues,
      'load_handoff',
      'warning',
      'record_load_contribution_missing',
      'Lift record has no loadContribution payload for downstream load models.',
    );
  }

  if (!record.athleteNote && !record.athleteVisibleSummary) {
    addIssue(
      issues,
      'load_handoff',
      'info',
      'record_athlete_summary_missing',
      'Lift record has no athlete-visible note or summary.',
    );
  }
};

export const auditPhaseJSessionCandidate = (
  candidate: Partial<PhaseJSessionCandidate>,
): PhaseJQaAuditResult => {
  const issues: PhaseJQaAuditIssue[] = [];
  auditProvenance(issues, candidate.provenance, 'candidate');
  auditConfidence(issues, candidate.confidenceTier, candidate.confidenceScore, 'candidate');
  auditMissingContext(issues, candidate.missingContext, 'candidate');
  return buildPhaseJQaAuditResult(issues);
};

export const auditPhaseJSessionRecord = (
  record: Partial<PhaseJSessionRecord>,
): PhaseJQaAuditResult => {
  const issues: PhaseJQaAuditIssue[] = [];
  auditProvenance(issues, record.provenance, 'record');
  auditConfidence(issues, record.confidenceTier, undefined, 'record');
  auditRecordLoadHandoff(issues, record);
  return buildPhaseJQaAuditResult(issues);
};

export const auditPhaseJSessionHandoff = (
  input: PhaseJQaAuditInput,
): PhaseJQaAuditResult => {
  const issues: PhaseJQaAuditIssue[] = [];

  if (input.candidate) {
    issues.push(...auditPhaseJSessionCandidate(input.candidate).issues);
  }
  if (input.record) {
    issues.push(...auditPhaseJSessionRecord(input.record).issues);
  }

  if (input.candidate && input.record) {
    if (input.record.candidateId && input.candidate.id && input.record.candidateId !== input.candidate.id) {
      addIssue(
        issues,
        'provenance',
        'error',
        'record_candidate_id_mismatch',
        'Session record candidateId does not match the audited candidate.',
      );
    }
    if (input.record.athleteUserId && input.candidate.athleteUserId && input.record.athleteUserId !== input.candidate.athleteUserId) {
      addIssue(
        issues,
        'provenance',
        'error',
        'record_athlete_id_mismatch',
        'Session record athleteUserId does not match the audited candidate.',
      );
    }
  }

  return buildPhaseJQaAuditResult(issues);
};

const buildPhaseJQaAuditResult = (issues: PhaseJQaAuditIssue[]): PhaseJQaAuditResult => {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  return {
    ok: errorCount === 0,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues,
  };
};
