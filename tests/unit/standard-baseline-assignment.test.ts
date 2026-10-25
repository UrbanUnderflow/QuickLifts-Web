import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStandardBaselineAssignment } from '../../src/lib/questionnaires/standard-assignment';
import { COLLECTION, QUESTIONNAIRE_VERSION, VERSION } from '../../src/lib/questionnaires/cau';

function fixture(memberships: Array<{ id: string; [key: string]: any }> = [], profile: Record<string, any> = {}) {
  const documents = new Map<string, any>();
  let created = 0;
  let queried = 0;
  let concurrent: Record<string, any> | null = null;
  const snapshot = (key: string) => ({ exists: documents.has(key), data: () => documents.get(key) });
  const db = {
    collection(name: string) {
      return {
        where(field: string, operator: string, uid: string) {
          assert.equal(name, 'pulsecheck-team-memberships');
          assert.equal(field, 'userId'); assert.equal(operator, '=='); assert.equal(uid, 'athlete');
          queried++;
          return { get: async () => ({ docs: memberships.map(({ id, ...data }) => ({ id, data: () => ({...(data.role === 'athlete' ? {athleteOnboarding:{entryOnboardingStep:'complete',productConsentAccepted:true}} : {}),...data}) })) }) };
        },
        doc(id: string) {
          const key = `${name}/${id}`;
          return { key, get: async () => name === 'users' ? { data: () => profile } : snapshot(key) };
        },
      };
    },
    async runTransaction(operation: (transaction: any) => Promise<any>) {
      if (concurrent) {
        documents.set(`${COLLECTION}/assignment_athlete`, concurrent);
        concurrent = null;
      }
      return operation({
        get: async (reference: { key: string }) => snapshot(reference.key),
        create(reference: { key: string }, value: any) {
          assert.equal(documents.has(reference.key), false);
          documents.set(reference.key, value); created++;
        },
      });
    },
  };
  return { db, documents, created: () => created, queried: () => queried,
    raceWith: (value: Record<string, any>) => { concurrent = value; } };
}

test('active athlete membership creates a standard requirement using its actual membership id', async () => {
  const f = fixture([{ id: 'custom-membership', role: 'athlete', status: 'active', teamId: 'golf' }]);
  const result = await resolveStandardBaselineAssignment(f.db, 'athlete', null);
  assert.equal(result?.teamMembershipId, 'custom-membership');
  assert.equal(result?.teamId, 'golf'); assert.equal(result?.scope, 'team');
  assert.equal(result?.version, VERSION); assert.equal(result?.questionnaireVersion, QUESTIONNAIRE_VERSION);
  assert.match(result?.submissionId, /^[a-f0-9-]{36}$/);
  assert.equal(result?.environment, 'unconfigured'); assert.equal(result?.universityCode, '');
  assert.equal(f.created(), 1);
});

test('multiple athlete memberships resolve deterministically and ignore revoked or inactive memberships', async () => {
  const f = fixture([
    { id: 'z-active', role: 'athlete', status: 'active', teamId: 'second' },
    { id: 'a-revoked', role: 'athlete', status: 'active', teamId: 'revoked', revokedAt: 'now' },
    { id: 'a-inactive', role: 'athlete', status: 'inactive', teamId: 'inactive' },
    { id: 'b-active', role: 'athlete', status: 'active', teamId: 'first' },
  ]);
  assert.equal((await resolveStandardBaselineAssignment(f.db, 'athlete', null))?.teamId, 'first');
});

test('staff-only memberships never become athletes based on profile sport', async () => {
  const f = fixture([{ id: 'coach', role: 'coach', status: 'active', teamId: 'team' }],
    { pulseCheckOnboardingComplete: true, sport: 'Golf' });
  assert.equal(await resolveStandardBaselineAssignment(f.db, 'athlete', null), null);
  assert.equal(f.created(), 0);
});

test('an onboarded independent athlete is eligible without fabricated team or clinical context', async () => {
  const f = fixture([], { pulseCheckOnboardingComplete: true, athleteSport: { name: 'Golf' } });
  const result = await resolveStandardBaselineAssignment(f.db, 'athlete', null);
  assert.equal(result?.scope, 'individual'); assert.equal(result?.sportName, 'Golf');
  assert.equal(result?.teamId, ''); assert.equal(result?.environment, 'unconfigured');
});

test('incomplete and staff profiles do not infer athlete eligibility', async () => {
  for (const profile of [
    { sport: 'Golf' },
    { pulseCheckOnboardingComplete: true, sport: 'Golf', role: 'coach' },
    { pulseCheckOnboardingComplete: true, sport: 'Golf', isClinician: true },
  ]) {
    const f = fixture([], profile);
    assert.equal(await resolveStandardBaselineAssignment(f.db, 'athlete', null), null);
    assert.equal(f.created(), 0);
  }
});

test('an explicit disabled assignment remains authoritative without any membership lookup', async () => {
  const f = fixture();
  const retired = { kind: 'assignment', enabled: false, submissionId: 'original', environment: 'live', universityCode: 'CAU' };
  assert.strictEqual(await resolveStandardBaselineAssignment(f.db, 'athlete', retired), retired);
  assert.equal(f.queried(), 0); assert.equal(f.created(), 0);
});

test('repeated resolution preserves the original submission identity', async () => {
  const f = fixture([{ id: 'member', role: 'athlete', status: 'active', teamId: 'team' }]);
  const first = await resolveStandardBaselineAssignment(f.db, 'athlete', null);
  const second = await resolveStandardBaselineAssignment(f.db, 'athlete', null);
  assert.equal(first?.submissionId, second?.submissionId); assert.equal(f.created(), 1);
});

test('an explicit assignment created concurrently wins without overwrite', async () => {
  const f = fixture([{ id: 'member', role: 'athlete', status: 'active', teamId: 'team' }]);
  const concurrent = { kind: 'assignment', enabled: false, submissionId: 'trusted-existing', environment: 'live', universityCode: 'CAU' };
  f.raceWith(concurrent);
  assert.strictEqual(await resolveStandardBaselineAssignment(f.db, 'athlete', null), concurrent);
  assert.equal(f.created(), 0);
});

test('completed individual onboarding still requires the baseline when no sport is saved', async () => {
  const f=fixture([], {pulseCheckOnboardingComplete:true});
  const result=await resolveStandardBaselineAssignment(f.db,'athlete',null);
  assert.equal(result?.scope,'individual');assert.equal(result?.sportName,'Sport');
});

test('the baseline never replaces unfinished team onboarding or consent', async () => {
 const f=fixture([{id:'member',role:'athlete',status:'active',teamId:'team',athleteOnboarding:{entryOnboardingStep:'consent',productConsentAccepted:false}}],{pulseCheckOnboardingComplete:true,sport:'Golf'});
 assert.equal(await resolveStandardBaselineAssignment(f.db,'athlete',null),null);assert.equal(f.created(),0);
});
