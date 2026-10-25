import { resolvePulseCheckPilotEnrollmentAcceptance, toPulseCheckPilotScheduleDate } from '../../../utils/pulseCheckPilotSchedule';
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
export class ActivationError extends Error {
  constructor(public code: string, public status = 404) { super('This invitation is unavailable. Ask your team for a current activation code.'); }
}
const safe = (v: string) => /^[A-Za-z0-9_-]{1,240}$/.test(v);
export function activationIdentifier(input: unknown): string {
  let value = text(input);
  if (value.length > 4096) throw new ActivationError('CODE_INVALID', 400);
  if (/^[a-z]+:\/\//i.test(value)) {
    let url: URL;
    try { url = new URL(value); } catch { throw new ActivationError('CODE_INVALID', 400); }
    const allowed = ['fitwithpulse.ai','www.fitwithpulse.ai','pulsecheckmind.ai','theathleticmind.ai','www.theathleticmind.ai','pulsecheckapp.onelink.me','fitwithpulse.onelink.me'];
    const configured = process.env.NEXT_PUBLIC_ATHLETICMIND_ONELINK_URL;
    if (configured) { try { allowed.push(new URL(configured).hostname); } catch {} }
    if (!(['pulsecheck:','athleticmind:'].includes(url.protocol) || (url.protocol === 'https:' && allowed.includes(url.hostname)))) throw new ActivationError('CODE_INVALID', 400);
    value = url.searchParams.get('deep_link_sub2') || url.searchParams.get('inviteToken') || url.searchParams.get('token') || '';
    if (!value) {
      try { value = decodeURIComponent(url.pathname.match(/\/(?:team-invite|invite)\/([^/]+)\/?$/i)?.[1] || ''); } catch { throw new ActivationError('CODE_INVALID', 400); }
    }
  }
  if (!safe(value)) throw new ActivationError('CODE_INVALID', 400);
  return value;
}
const active = (d: any) => d && d.status === 'active' && !d.deletedAt && !d.archivedAt && !d.revokedAt && !['deleted','purging','purged'].includes(d.lifecycleState);
export async function resolveActivation(db: any, input: unknown, now = new Date()) {
  const code = activationIdentifier(input);
  const invites = db.collection('pulsecheck-invite-links');
  let snap = await invites.doc(code).get();
  if (!snap.exists) {
    const [codes, aliases] = await Promise.all([
      invites.where('activationCode', '==', code.toUpperCase()).limit(2).get(),
      invites.where('activationAliases', 'array-contains', code.toUpperCase()).limit(2).get(),
    ]);
    const matches = [...new Map([...codes.docs, ...aliases.docs].map((doc: any) => [doc.id, doc])).values()] as any[];
    if (matches.length !== 1) throw new ActivationError('INVITE_NOT_FOUND');
    snap = matches[0];
  }
  const invite = snap.data();
  if (invite.inviteType !== 'team-access' || invite.teamMembershipRole !== 'athlete') throw new ActivationError('INVITE_ROLE_UNSUPPORTED', 403);
  const expiration = toPulseCheckPilotScheduleDate(invite.expiresAt || invite.expirationDate);
  if ((invite.expiresAt || invite.expirationDate) && !expiration) throw new ActivationError('INVITE_INACTIVE', 410);
  if (!['active', ...(invite.redemptionMode === 'general' ? ['redeemed'] : [])].includes(invite.status) || invite.revokedAt || invite.archivedAt || invite.deletedAt || (expiration && expiration <= now) || (Number(invite.maxUses) > 0 && Number(invite.redemptionCount || 0) >= Number(invite.maxUses))) throw new ActivationError('INVITE_INACTIVE', 410);
  const orgId = text(invite.organizationId), teamId = text(invite.teamId), pilotId = text(invite.pilotId), cohortId = text(invite.cohortId);
  if (!safe(orgId) || !safe(teamId) || (pilotId && !safe(pilotId)) || (cohortId && (!safe(cohortId) || !pilotId))) throw new ActivationError('INVITE_CONTEXT_INVALID');
  const read = async (collection: string, id: string) => { const d = await db.collection(collection).doc(id).get(); return d.exists ? d.data() : null; };
  const [org, team, pilot, cohort] = await Promise.all([read('pulsecheck-organizations', orgId), read('pulsecheck-teams', teamId), pilotId ? read('pulsecheck-pilots', pilotId) : null, cohortId ? read('pulsecheck-pilot-cohorts', cohortId) : null]);
  if (!active(org) || !active(team) || team.organizationId !== orgId) throw new ActivationError('INVITE_CONTEXT_INVALID');
  if (pilotId && (!pilot || pilot.organizationId !== orgId || pilot.teamId !== teamId || !resolvePulseCheckPilotEnrollmentAcceptance(pilot, now).acceptsEnrollment)) throw new ActivationError('INVITE_INACTIVE', 410);
  if (cohortId && (!active(cohort) || cohort.status !== 'active' || cohort.organizationId !== orgId || cohort.teamId !== teamId || cohort.pilotId !== pilotId)) throw new ActivationError('INVITE_CONTEXT_INVALID');
  if (!(text(org.displayName) || text(org.name)) || !(text(team.displayName) || text(team.name)) || (cohortId && !text(cohort.name))) throw new ActivationError('INVITE_CONTEXT_INVALID');
  return {inviteToken: snap.id, organizationId: orgId, organizationName: text(org.displayName) || text(org.name), teamId, teamName: text(team.displayName) || text(team.name), cohortId: cohortId || null, cohortName: cohortId ? text(cohort.name) : null, productBrand: org.productBrand === 'pulsecheck' ? 'pulsecheck' : 'athleticmind'};
}
