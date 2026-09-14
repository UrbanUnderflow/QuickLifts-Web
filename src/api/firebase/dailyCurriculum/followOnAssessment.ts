/** Future association contract only. No existing learner assessment is approved as module follow-on. */
export interface FollowOnAssessmentConfiguration {
  instrumentId: string;
  instrumentVersion: string;
  moduleId: string;
  eligibilityPolicyId: string;
}
export interface FollowOnAssessmentEligibility {
  id: string; athleteId: string; assignmentId: string; moduleId: string;
  instrumentId: string; instrumentVersion: string; eligibilityPolicyId: string;
  eligibleAt: number;
}
export interface FollowOnAssessmentResponseLink {
  /** Immutable response identifier, not a generated rollup or current mutable baseline. */
  responseId: string; eligibilityId: string; athleteId: string; assignmentId: string;
  moduleId: string; instrumentId: string; instrumentVersion: string; completedAt: number;
}
export type FollowOnAssessmentMetric =
  | { status: 'unavailable'; numerator: null; denominator: null; rate: null; reason: string }
  | { status: 'available'; numerator: number; denominator: number; rate: number | null; reason: string };
/** Deliberately empty. Enabling requires an actual instrument, durable response source, and approved eligibility policy. */
export const APPROVED_FOLLOW_ON_ASSESSMENTS: readonly FollowOnAssessmentConfiguration[] = Object.freeze([]);
export function aggregateFollowOnAssessment(input: {
  moduleId: string; window: { start: number; end: number };
  eligibility: readonly FollowOnAssessmentEligibility[];
  responses: readonly FollowOnAssessmentResponseLink[];
}): FollowOnAssessmentMetric {
  if (!APPROVED_FOLLOW_ON_ASSESSMENTS.some(config => config.moduleId === input.moduleId)) return {
    status: 'unavailable', numerator: null, denominator: null, rate: null,
    reason: 'No approved module follow-on instrument or eligibility policy. Starting-point baselines and generated monthly summaries are excluded.',
  };
  // No live reader or write endpoint is enabled until the registry has a reviewed source adapter.
  return { status: 'unavailable', numerator: null, denominator: null, rate: null, reason: 'The approved instrument needs a verified durable response adapter.' };
}
/** Pure validation for a future server-side adapter; never authorizes or persists a client assertion. */
export function validateFollowOnAssessmentLink(input: {
  authenticatedAthleteId: string;
  eligibility: FollowOnAssessmentEligibility;
  response: FollowOnAssessmentResponseLink;
}): boolean {
  const { authenticatedAthleteId: actor, eligibility: e, response: r } = input;
  return !!actor && actor === e.athleteId && actor === r.athleteId &&
    !!e.id && !!e.assignmentId && !!e.moduleId && !!e.instrumentId && !!e.instrumentVersion && !!e.eligibilityPolicyId &&
    !!r.responseId && r.eligibilityId === e.id && r.assignmentId === e.assignmentId &&
    r.moduleId === e.moduleId && r.instrumentId === e.instrumentId && r.instrumentVersion === e.instrumentVersion &&
    Number.isFinite(e.eligibleAt) && Number.isFinite(r.completedAt) && e.eligibleAt > 0 && r.completedAt >= e.eligibleAt;
}
/** Stable retry key scoped to an eligibility record and immutable response; no timestamp-based association. */
export function followOnAssessmentLinkKey(eligibilityId: string, responseId: string): string {
  if (!eligibilityId || !responseId) throw new Error('Explicit eligibility and response identifiers are required');
  return JSON.stringify([eligibilityId, responseId]);
}
