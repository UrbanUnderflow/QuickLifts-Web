import test from 'node:test';
import assert from 'node:assert/strict';
import { activationIdentifier, resolveActivation } from '../../src/lib/server/pulsecheck/activation-preview';
import { buildPulseCheckTeamInviteOneLink } from '../../src/utils/pulsecheckInviteLinks';
const records = () => ({
  'pulsecheck-invite-links': { token: {inviteType:'team-access',teamMembershipRole:'athlete',status:'active',redemptionMode:'general',organizationId:'org',teamId:'team',pilotId:'pilot',cohortId:'cohort',activationCode:'ABC123',targetEmail:'private@example.com',recipientName:'Private athlete'} },
  'pulsecheck-organizations': {org:{status:'active',displayName:'UMES',productBrand:'athleticmind'}},
  'pulsecheck-teams': {team:{status:'active',organizationId:'org',displayName:'Volleyball'}},
  'pulsecheck-pilots': {pilot:{status:'active',organizationId:'org',teamId:'team'}},
  'pulsecheck-pilot-cohorts': {cohort:{status:'active',organizationId:'org',teamId:'team',pilotId:'pilot',name:'Fall cohort'}}
});
function database(data: any) {
 const snapshot = (id: string, value: any) => ({id, exists:!!value, data:()=>value});
 return { collection: (name: string) => ({
   doc: (id: string) => ({get: async () => snapshot(id, data[name]?.[id])}),
   where: (field: string, _: string, value: string) => ({limit: () => ({get: async () => ({docs: Object.entries(data[name] || {}).filter(([,v]: any) => v[field] === value).map(([id,v]) => snapshot(id,v))})})})
 })};
}
test('OneLink carries token through UDL and resolver extracts exact invitation',()=>{
 const url = buildPulseCheckTeamInviteOneLink({token:'token',role:'athlete',fallbackPath:'/PulseCheck/team-invite/token',productBrand:'pulsecheck'});
 assert.equal(new URL(url).searchParams.get('deep_link_sub2'),'token');
 assert.equal(activationIdentifier(url),'token');
 assert.throws(()=>activationIdentifier('https://evil.example/team-invite/token'));
});
test('pre-auth preview binds to exact cohort and omits personal data',async()=>{
 const result = await resolveActivation(database(records()),'abc123');
 assert.deepEqual(result,{inviteToken:'token',organizationId:'org',organizationName:'UMES',teamId:'team',teamName:'Volleyball',cohortId:'cohort',cohortName:'Fall cohort',productBrand:'athleticmind'});
});
test('does not guess team using organization name or arbitrary ID',async()=>{
 await assert.rejects(resolveActivation(database(records()),'UMES'),{code:'INVITE_NOT_FOUND'});
});
test('rejects staff, expired, exhausted, revoked and cross-team cohort invitations',async()=>{
 for (const patch of [{teamMembershipRole:'coach'},{expiresAt:new Date(0)},{maxUses:3,redemptionCount:3},{revokedAt:new Date()}]) {
  const d=records();Object.assign(d['pulsecheck-invite-links'].token,patch);
  await assert.rejects(resolveActivation(database(d),'token'));
 }
 const d=records(); d['pulsecheck-pilot-cohorts'].cohort.teamId='other';
 await assert.rejects(resolveActivation(database(d),'token'),{code:'INVITE_CONTEXT_INVALID'});
});
test('ambiguous short code fails closed',async()=>{
 const d:any=records();d['pulsecheck-invite-links'].second={...d['pulsecheck-invite-links'].token};
 await assert.rejects(resolveActivation(database(d),'ABC123'),{code:'INVITE_NOT_FOUND'});
});

test('preview rejects inactive parents and missing display names', async () => {
 for (const patch of [{status:'draft'}, {status:'provisioning'}, {displayName:''}]) {
  const d=records(); Object.assign(d['pulsecheck-organizations'].org, patch);
  await assert.rejects(resolveActivation(database(d),'token'),{code:'INVITE_CONTEXT_INVALID'});
 }
});
test('legacy OneLink is accepted and malformed input is a 400', () => {
 assert.equal(activationIdentifier('https://fitwithpulse.onelink.me/uT14?inviteToken=token'), 'token');
 for(const input of [null, {}, 'https://fitwithpulse.ai/team-invite/%xx', 'x'.repeat(4097)]) assert.throws(() => activationIdentifier(input), {code:'CODE_INVALID', status:400});
});

test('future reporting start permits QR and code preview with exact pilot context', async () => {
 const d = records();
 Object.assign(d['pulsecheck-pilots'].pilot, {
   startAt: new Date('2026-10-28T04:00:00Z'), endAt: new Date('2027-02-15T04:00:00Z'),
 });
 for (const identifier of ['token', 'ABC123']) {
   const result = await resolveActivation(database(d), identifier, new Date('2026-10-24T12:00:00Z'));
   assert.equal(result.teamId, 'team');
   assert.equal(result.cohortId, 'cohort');
 }
 assert.equal((d['pulsecheck-pilots'].pilot as any).startAt.toISOString(), '2026-10-28T04:00:00.000Z');
});
