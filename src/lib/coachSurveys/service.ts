import { cadenceDays } from './cadence';
import { createHash } from 'crypto';
import { VERSION, validateSubmission, type SurveyKind } from './questionnaire';

// Reuse an explicitly denied, server-only collection. Never create a new top-level
// collection under the repository's signed-in compatibility fallback.
export const COLLECTION = 'pulsecheck-restricted-questionnaire-submissions';
export const ROOT = 'coach-surveys-v1';
export const tokenDigest = (token: string) => createHash('sha256').update(token).digest('hex');
export const validToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
export class SurveyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// The server owns participant/program/baseline linkage and the invitation period.
// The client can submit only item responses and the optional comment.
export async function processSurvey(db: FirebaseFirestore.Firestore, token: string, kind: SurveyKind, body?: unknown) {
  const root = db.collection(COLLECTION).doc(ROOT);
  const id = tokenDigest(token), invitation = root.collection('invitations').doc(id);
  const response = root.collection('responses').doc(id);
  return db.runTransaction(async tx => {
    const invite = (await tx.get(invitation)).data();
    if (!invite || invite.enabled !== true || invite.kind !== kind || invite.version !== VERSION ||
      !Number.isFinite(invite.expiresAtMs) || invite.expiresAtMs <= Date.now() ||
      !Number.isFinite(invite.opensAtMs) || invite.opensAtMs > Date.now() ||
      !['participantId', 'programId', 'periodId'].every(k => typeof invite[k] === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(invite[k]))) {
      throw new SurveyError(403, 'This survey link is unavailable or has expired. Ask your program contact for a new link.');
    }
    if (invite.enrollmentId) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(invite.enrollmentId)) throw new SurveyError(403, 'This survey link is unavailable.');
      const enrollment = (await tx.get(root.collection('enrollments').doc(invite.enrollmentId))).data();
      if (!enrollment || enrollment.enabled !== true || enrollment.stoppedAtMs || enrollment.participantId !== invite.participantId || enrollment.programId !== invite.programId) throw new SurveyError(403, 'This survey enrollment has stopped.');
    }
    // One trusted invitation per participant/program/period. The response is
    // immutable, so a retry after an uncertain network result cannot overwrite it.
    const period = root.collection('periods').doc(tokenDigest(JSON.stringify([invite.participantId, invite.programId, kind, invite.periodId])));
    if ((await tx.get(response)).exists || (await tx.get(period)).exists) return { completed: true };
    if (kind === 'check-in') {
      if (!/^[a-f0-9]{64}$/.test(invite.baselineResponseId || '')) throw new SurveyError(409, 'Complete your initial coach questionnaire before this check-in.');
      const baseline = (await tx.get(root.collection('responses').doc(invite.baselineResponseId))).data();
      if (!baseline || baseline.kind !== 'baseline' || baseline.participantId !== invite.participantId || baseline.programId !== invite.programId) throw new SurveyError(409, 'Complete your initial coach questionnaire before this check-in.');
    }
    const recallDays = kind === 'check-in' ? cadenceDays(invite.recallDays) ?? 21 : null;
    if (body === undefined) return { completed: false, recallDays };
    let validated;
    try { validated = validateSubmission(kind, body); }
    catch (error) { throw new SurveyError(400, (error as Error).message); }
    tx.create(response, {
      ...validated, recallDays, participantId: invite.participantId, programId: invite.programId,
      periodId: invite.periodId, baselineResponseId: kind === 'baseline' ? id : invite.baselineResponseId,
      submittedAtMs: Date.now(), provenance: kind === 'baseline' ? 'proposed-coach-readiness-v2' : 'proposed-first-hand-experience-v2',
    });
    tx.create(period, { responseId: id });
    return { completed: true };
  });
}
