import { hasCompletedEntryOnboarding, hasCompletedRequiredConsents } from '../../api/firebase/pulsecheckProvisioning/accessState';
import { randomUUID } from 'crypto';
import { COLLECTION, QUESTIONNAIRE_VERSION, VERSION } from './cau';

export type StandardBaselineAssignment = Record<string, any>;

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const activeMembership = (membership: Record<string, any>) =>
  membership.status === 'active' && membership.revokedAt == null
  && membership.archivedAt == null && membership.deletedAt == null;

function hasStaffProfile(profile: Record<string, any>): boolean {
  if (['isCoach', 'isTrainer', 'isClinician', 'isStaff', 'isAdmin'].some(key => profile[key] === true)) return true;
  const roles = [profile.role, profile.userRole, profile.userType, profile.accountType,
    ...(Array.isArray(profile.roles) ? profile.roles : [])];
  return roles.some(role => /coach|trainer|clinician|staff|admin|physician|therapist/i.test(text(role)));
}

function athleteSport(profile: Record<string, any>): string {
  return text(profile.sport) || text(profile.athleteSport)
    || text(profile.athleteSport?.name) || text(profile.athleteSport?.sportName);
}

/** Resolve a baseline requirement from server-owned membership/profile records.
 * Explicit assignments, including disabled/retired ones, remain authoritative.
 * Creating a standard assignment never configures or authorizes clinical delivery.
 */
export async function resolveStandardBaselineAssignment(
  db: any,
  uid: string,
  existing: StandardBaselineAssignment | null | undefined,
): Promise<StandardBaselineAssignment | null> {
  if (existing != null) return existing;
  if (!text(uid) || uid.includes('/')) throw new Error('A valid authenticated user is required.');

  const memberships = await db.collection('pulsecheck-team-memberships')
    .where('userId', '==', uid).get();
  const active = memberships.docs
    .map((document: any) => ({ id: document.id, data: document.data() || {} }))
    .filter((membership: any) => activeMembership(membership.data));
  const athlete = active
    .filter((membership: any) => text(membership.data.role) === 'athlete' && text(membership.data.teamId)
      && hasCompletedEntryOnboarding(membership.data.athleteOnboarding)
      && membership.data.athleteOnboarding?.productConsentAccepted === true
      && hasCompletedRequiredConsents({...membership.data.athleteOnboarding, requiredConsents: (membership.data.athleteOnboarding?.requiredConsents || []).filter((document: any) => document.category !== 'health_authorization')}))
    .sort((left: any, right: any) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)[0];

  let context: Record<string, any>;
  if (athlete) {
    context = { scope: 'team', teamId: text(athlete.data.teamId), teamMembershipId: athlete.id };
  } else {
    // A staff-only account's saved sport does not make it an athlete account.
    if (active.length > 0) return null;
    const profile = (await db.collection('users').doc(uid).get()).data() || {};
    const sportName = athleteSport(profile);
    if (profile.pulseCheckOnboardingComplete !== true || hasStaffProfile(profile)) return null;
    context = { scope: 'individual', teamId: '', teamMembershipId: '', sportName: sportName || 'Sport' };
  }

  const assignment: StandardBaselineAssignment = {
    kind: 'assignment', enabled: true, version: VERSION,
    questionnaireVersion: QUESTIONNAIRE_VERSION, userId: uid,
    submissionId: randomUUID(), ...context,
    environment: 'unconfigured', universityCode: '',
    source: 'standard-athlete-baseline', createdAt: new Date().toISOString(),
  };
  const reference = db.collection(COLLECTION).doc(`assignment_${uid}`);
  return db.runTransaction(async (transaction: any) => {
    const current = await transaction.get(reference);
    // A concurrent trusted assignment (or revocation) always wins.
    if (current.exists) return current.data();
    transaction.create(reference, assignment);
    return assignment;
  });
}
