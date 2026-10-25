import { randomBytes } from 'crypto';
import { VERSION } from './questionnaire';
import { tokenDigest } from './service';
import { validateEnrollment, enrollmentIdFor, type Enrollment } from './delivery';

// Pure preparation only: no database, network, account lookup or sends. A future
// authorized administrator must verify the recipient and review these records
// before provisioning them into the private namespace. Never log this bundle.
export function prepareCoachSurveySetup(input: Omit<Enrollment, 'enabled' | 'approved' | 'baselineResponseId'>, origin: string, now = Date.now()) {
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(origin)) throw Error('Use an approved HTTPS origin.');
  const token = randomBytes(32).toString('base64url'), invitationId = tokenDigest(token);
  const enrollment = validateEnrollment({ ...input, enabled: false, approved: false, baselineResponseId: invitationId });
  return {
    invitationId,
    enrollmentId: enrollmentIdFor(input.participantId, input.programId),
    baselineLink: `${origin}/PulseCheck/coach-survey/baseline#token=${token}`,
    baselineInvitation: { kind: 'baseline', enabled: false, version: VERSION, participantId: input.participantId, programId: input.programId, periodId: 'baseline', opensAtMs: now, expiresAtMs: now + 21 * 86400000 },
    enrollment,
  };
}
export function coachSurveyStatus(enrollment: Enrollment, baselineExists: boolean, latestDelivery?: { status: string }) {
  return {
    baseline: baselineExists ? 'completed' : 'awaiting-response',
    periodic: enrollment.stoppedAtMs ? 'stopped' : !baselineExists ? 'awaiting-baseline' : !enrollment.enabled || !enrollment.approved ? 'paused' : 'scheduled',
    lastDelivery: latestDelivery?.status || 'not-sent',
    startDate: enrollment.startDate, endDate: enrollment.endDate, timeZone: enrollment.timeZone,
  };
}
