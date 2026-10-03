import type { firestore } from 'firebase-admin';
export const validTeamId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export class DashboardAccessError extends Error { constructor(public status: number, message: string) { super(message); } }
export const activeRecord = (d: Record<string, any>) => (d.status == null || d.status === 'active') && !d.revokedAt && !d.removedAt && !d.archivedAt && !d.deletedAt && d.revoked !== true;
export function dashboardAccess(membership: Record<string, any>, uid: string, teamId: string) {
  const active = membership.userId === uid && membership.teamId === teamId && activeRecord(membership);
  const capabilities: string[] = Array.isArray(membership.staffCapabilities) ? membership.staffCapabilities : [];
  const legacyParticipation = !Object.prototype.hasOwnProperty.call(membership, 'staffCapabilities') && ['team-admin', 'coach', 'performance-staff'].includes(membership.role);
  const staff = active && membership.role !== 'athlete';
  return { participation: staff && (legacyParticipation || capabilities.some(c => ['admin', 'coaching', 'athletic_trainer'].includes(c))), wellbeing: staff && capabilities.includes('athletic_trainer'), athlete: active && membership.role === 'athlete' };
}
export async function loadTeamAccess(db: firestore.Firestore, uid: string, teamId: string) {
  const [member, team] = await Promise.all([db.collection('pulsecheck-team-memberships').doc(`${teamId}_${uid}`).get(), db.collection('pulsecheck-teams').doc(teamId).get()]);
  const membership = member.data() || {}; const teamData = team.data() || {};
  if (!member.exists || !team.exists || teamData.status !== 'active' || !activeRecord(teamData) || !validTeamId(teamData.organizationId) || membership.organizationId !== teamData.organizationId) throw new DashboardAccessError(403, 'This team is not available to your account.');
  const organization = await db.collection('pulsecheck-organizations').doc(teamData.organizationId).get();
  if (!organization.exists || organization.data()?.status !== 'active' || !activeRecord(organization.data() || {})) throw new DashboardAccessError(403, 'This organization is not active.');
  return { membership, team: teamData, access: dashboardAccess(membership, uid, teamId) };
}
export function visibleAthlete(membership: Record<string, any>, athleteId: string) {
  if (membership.rosterVisibilityScope === 'none') return false;
  if (membership.rosterVisibilityScope === 'assigned') return Array.isArray(membership.allowedAthleteIds) && membership.allowedAthleteIds.includes(athleteId);
  return membership.rosterVisibilityScope == null || membership.rosterVisibilityScope === 'team';
}
