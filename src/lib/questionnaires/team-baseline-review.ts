import { createHash } from 'crypto';
import { hasCompletedEntryOnboarding, hasCompletedRequiredConsents } from '../../api/firebase/pulsecheckProvisioning/accessState';
import { MENTAL_SKILL_FAMILIES } from '../../api/firebase/mentaltraining/mentalSkillsBaseline';
import { COLLECTION, QUESTIONNAIRE_VERSION, VERSION, baselineComplete, questions, questionCustodian, validateSubmission } from './cau';
import { completedStartingProfile, validateSkillsDraft } from './cau-skills';

const text = (value: any) => typeof value === 'string' ? value.trim() : '';
const active = (value: any) => value?.status === 'active' && value.revokedAt == null
  && value.archivedAt == null && value.deletedAt == null && value.removedAt == null && value.revoked !== true;
const epoch = (value: any): string => value?.toMillis ? String(value.toMillis())
  : value?.seconds != null ? `${value.seconds}:${value.nanoseconds || 0}` : String(value || 'original');

/** An active-member invite retry is the same join. Reactivation gets a new joined-at marker. */
export function teamBaselineReviewId(uid: string, membershipId: string, member: any) {
  return createHash('sha256').update(JSON.stringify([uid, membershipId,
    epoch(member.baselineJoinedAt || member.joinedAt || member.createdAt)])).digest('hex');
}
export const teamBaselineRecordId = (reviewId: string) => `team_baseline_${reviewId}_${QUESTIONNAIRE_VERSION}`;

/** Pick an unfinished join, rather than allowing an account-wide completion to satisfy every team.
 * No health answer or consent is copied across teams. All scope comes from active server records.
 */
export async function resolveTeamBaselineReview(db: any, uid: string, existing: any, legacyCompleted = false, canonical: any = null) {
  const snapshot = await db.collection('pulsecheck-team-memberships').where('userId', '==', uid).get();
  const members = snapshot.docs.map((doc: any) => ({ id: doc.id, member: doc.data() }))
    .filter(({ member }: any) => active(member) && member.userId === uid && member.role === 'athlete'
      && text(member.teamId) && hasCompletedEntryOnboarding(member.athleteOnboarding)
      && member.athleteOnboarding?.productConsentAccepted === true
      && hasCompletedRequiredConsents({ ...member.athleteOnboarding,
        requiredConsents: (member.athleteOnboarding.requiredConsents || []).filter((d: any) => d.category !== 'health_authorization') }))
    .sort((a: any, b: any) => a.id.localeCompare(b.id));
  for (const { id, member } of members) {
    // Preserve historical completion for that team. New joins/reactivations
    // carry a separate marker and must be reviewed even for the same account.
    if (legacyCompleted && !member.baselineJoinedAt && existing?.teamId === member.teamId
      && (!existing.teamMembershipId || existing.teamMembershipId === id)) continue;
    const reviewId = teamBaselineReviewId(uid, id, member);
    if (baselineComplete((await db.collection(COLLECTION).doc(teamBaselineRecordId(reviewId)).get()).data(), uid)) continue;
    const team = (await db.collection('pulsecheck-teams').doc(member.teamId).get()).data();
    if (!active(team) || !text(team.organizationId) || team.organizationId !== member.organizationId) continue;
    const org = (await db.collection('pulsecheck-organizations').doc(team.organizationId).get()).data();
    if (!active(org) || !['pulsecheck', 'athleticmind'].includes(org.productBrand)) continue;
    const pilotId = text(member.athleteOnboarding?.targetPilotId);
    if (pilotId) {
      const pilot = (await db.collection('pulsecheck-pilots').doc(pilotId).get()).data();
      if (!active(pilot) || pilot.teamId !== member.teamId || pilot.organizationId !== member.organizationId) continue;
    }
    const reference = db.collection(COLLECTION).doc(`team_assignment_${reviewId}`);
    return db.runTransaction(async (tx: any) => {
      const current = await tx.get(reference);
      if (current.exists) return current.data();
      const sourceAssignment = existing?.teamId === member.teamId ? existing : {};
      const value = { ...sourceAssignment, kind: 'assignment', enabled: true, version: VERSION,
        questionnaireVersion: QUESTIONNAIRE_VERSION, userId: uid, scope: 'team', teamId: member.teamId,
        teamMembershipId: id, organizationId: team.organizationId, reviewId,
        ...(completedStartingProfile(canonical) ? {previousStartingProfile: canonical} : {}),
        teamName: text(team.displayName) || text(team.name) || 'your team',
        submissionId: `team-${reviewId}`, environment: sourceAssignment.environment || 'unconfigured',
        universityCode: sourceAssignment.universityCode || '', source: 'team-join-baseline', createdAt: new Date().toISOString() };
      tx.create(reference, value);
      return value;
    });
  }
  return null;
}

/** Only readable, retained performance answers can be prefilled. External health references are not answers. */
export function teamBaselinePrefill(records: any[], canonical: any) {
  const previous = records.filter(Boolean).sort((a, b) =>
    String(b.reviewedAt || b.recordedAt?.toDate?.()?.toISOString() || '').localeCompare(String(a.reviewedAt || a.recordedAt?.toDate?.()?.toISOString() || '')))[0];
  const answers: Record<string, any> = {};
  for (const question of questions.filter(q => questionCustodian(q.id) === 'PulseCheck')) {
    const field = previous?.fields?.[question.id];
    if (field?.state !== 'local') continue;
    try {
      const checked = validateSubmission({ name: 'Review', email: 'review@example.invalid', answers: { [question.id]: field.value } });
      if (checked.fields[question.id]?.state === 'local') answers[question.id] = checked.fields[question.id].value;
    } catch { /* Invalid or removed historical choices remain unanswered. */ }
  }
  const priorSkills = previous?.startingProfile || canonical;
  let skillsDraft: any = null;
  if (completedStartingProfile(priorSkills)) {
    try {
      skillsDraft = validateSkillsDraft({ version: 2, assessmentKind: 'self_report_starting_profile', step: 'tools',
        familiarity: priorSkills.familiarity,
        answeredFamiliarity: priorSkills.version === 6 ? priorSkills.answeredFamiliarity || []
          : MENTAL_SKILL_FAMILIES.filter(f => priorSkills.familiarity?.[f] && priorSkills.familiarity[f] !== 'new_to_me') });
    } catch { /* A partial historical record cannot manufacture experience answers. */ }
  }
  return { answers, skillsDraft, name: text(previous?.identity?.name), email: text(previous?.identity?.email),
    performanceQuestionsComplete: Object.keys(answers).length > 0 || previous?.fields?.['cau-starting-point-46']?.state === 'skipped',
    hasPreviousBaseline: Boolean(previous), sourceSubmissionId: text(previous?.submissionId),
    prefilledQuestionCount: Object.keys(answers).length + (skillsDraft?.answeredFamiliarity.length || 0),
    unavailableHealthAnswers: Boolean(previous && questions.some(q => questionCustodian(q.id) === 'auntEDNA')) };
}
