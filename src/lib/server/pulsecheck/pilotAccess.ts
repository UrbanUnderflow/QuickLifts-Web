import { resolveAtomicConsentDocuments } from './atomicConsent';
import { athleteHasSatisfiedAccessRequirements, hasCompletedEntryOnboarding } from '../../../api/firebase/pulsecheckProvisioning/accessState';
import { resolveSchoolActivationFlow } from '../../../api/firebase/pulsecheckProvisioning/schoolActivationFlow';
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const safeId = (value: unknown): value is string => !!clean(value) && clean(value).length <= 240 && !clean(value).includes('/');
const active = (row: any) => row?.status === 'active' && !row.revokedAt && !row.archivedAt && !row.deletedAt;
const millis = (value: any) => value == null ? null : typeof value.toMillis === 'function' ? value.toMillis() : value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);

/** Pilot participation is independent of a paid team plan. Start dates are reporting only. */
export async function resolveActiveSchoolPilotAccess(db: any, uid: string, context: any, now = Date.now()): Promise<boolean> {
  const member = context?.member, team = context?.rawTeam;
  if (!safeId(uid) || !context?.isTeamAthlete || !active(member) || member.userId !== uid || !active(team)
    || team.commercialConfig?.commercialModel !== 'team-plan' || !safeId(member.organizationId)
    || member.organizationId !== team.organizationId || !safeId(member.teamId) || member.teamId !== context.team?.id) return false;
  const onboarding = member.athleteOnboarding || {};
  const pilotId = clean(onboarding.targetPilotId), cohortId = clean(onboarding.targetCohortId);
  if (!safeId(pilotId) || cohortId && !safeId(cohortId)) return false;
  const [orgSnap, pilotSnap, enrollmentSnap, closureSnap, userSnap] = await Promise.all([
    db.collection('pulsecheck-organizations').doc(member.organizationId).get(),
    db.collection('pulsecheck-pilots').doc(pilotId).get(),
    db.collection('pulsecheck-pilot-enrollments').doc(`${pilotId}_${uid}`).get(),
    db.collection('account-closure-jobs').doc(uid).get(), db.collection('users').doc(uid).get(),
  ]);
  const org = orgSnap.data(), pilot = pilotSnap.data(), enrollment = enrollmentSnap.data(), user = userSnap.data() || {};
  if (closureSnap.exists || user.accountClosureRequestedAt || user.accountClosureStatus || !active(org)
    || !resolveSchoolActivationFlow({ productBrand: org.productBrand, role: member.role }) || !active(pilot)
    || pilot.teamId !== member.teamId || pilot.organizationId !== member.organizationId
    || !active(enrollment) || enrollment.userId !== uid || enrollment.teamId !== member.teamId
    || enrollment.organizationId !== member.organizationId || enrollment.pilotId !== pilotId
    || enrollment.teamMembershipId !== member.id || enrollment.enrollmentMode !== 'pilot') return false;
  const end = millis(pilot.endAt);
  if (pilot.endAt != null && (!Number.isFinite(end) || end! <= now)) return false;
  if (cohortId) {
    const cohort = (await db.collection('pulsecheck-pilot-cohorts').doc(cohortId).get()).data();
    if (!active(cohort) || cohort.pilotId !== pilotId || cohort.teamId !== member.teamId || cohort.organizationId !== member.organizationId || enrollment.cohortId !== cohortId) return false;
  } else if (clean(enrollment.cohortId)) return false;
  const documents = resolveAtomicConsentDocuments(team, pilot, org.productBrand, org);
  return documents.some(document => document.category === 'participation') && hasCompletedEntryOnboarding(onboarding)
    && athleteHasSatisfiedAccessRequirements({ ...onboarding, requiredConsents: documents }, pilot.studyMode || 'operational');
}
