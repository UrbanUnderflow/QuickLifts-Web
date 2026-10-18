const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { compileTypeScriptRuntime, loadCompiledModule } = require('../firebase-admin/_runtimeHarness.cjs');
const compiled = compileTypeScriptRuntime({ cacheKey: 'atomic-consent', entryPaths: ['src/lib/server/pulsecheck/atomicConsent.ts'] });
const { saveAtomicConsent, resolveAtomicConsentDocuments } = loadCompiledModule({ compiled, fileName: 'atomicConsent.js' });
let app, db, input;
const now = () => admin.firestore.FieldValue.serverTimestamp();
const memberId = 'team_athlete';
const memberPath = `pulsecheck-team-memberships/${memberId}`;
const save = (request = input, firestore = db, uid = 'athlete') => saveAtomicConsent(firestore, uid, request, now);
before(() => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):8197$/);
  app = admin.initializeApp({ projectId: 'demo-consent-remediation' }, 'atomic-consent-tests');
  db = app.firestore();
});
after(async () => app?.delete());
beforeEach(async () => {
  const response = await fetch('http://127.0.0.1:8197/emulator/v1/projects/demo-consent-remediation/databases/(default)/documents', { method: 'DELETE' });
  assert.equal(response.ok, true);
  const team = { status: 'active', organizationId: 'org', intake: { athlete: { questions: [{ id: 'goal', required: true }] } } };
  const pilot = { status: 'active', teamId: 'team', organizationId: 'org', studyMode: 'operational' };
  const documents = resolveAtomicConsentDocuments(team, pilot, 'pulsecheck');
  await Promise.all([
    db.doc('pulsecheck-organizations/org').set({ status: 'active', productBrand: 'pulsecheck' }),
    db.doc('pulsecheck-teams/team').set(team), db.doc('pulsecheck-pilots/pilot').set(pilot),
    db.doc(memberPath).set({ userId: 'athlete', role: 'athlete', teamId: 'team', organizationId: 'org', status: 'active', athleteOnboarding: { targetPilotId: 'pilot', consentDecisions: {}, baselinePathStatus: 'complete' } }),
    db.doc('users/athlete').set({ displayName: 'Synthetic Athlete', sport: 'Existing Sport' }),
  ]);
  input = { teamMembershipId: memberId, action: 'complete', expectedContext: { organizationId: 'org', teamId: 'team', pilotId: 'pilot', cohortId: '', productBrand: 'pulsecheck', documents },
    onboarding: { productConsentAccepted: true, researchConsentStatus: 'not-required', intakeResponses: { goal: 'Synthetic goal' },
      consentDecisions: Object.fromEntries(documents.map(document => [document.id, { decision: document.category === 'health_authorization' ? 'declined' : 'accepted', version: document.version, signedName: document.category === 'health_authorization' ? '' : 'Synthetic Athlete', decidedAt: '2026-10-18T12:00:00.000Z', document }])) },
    profile: { name: 'Synthetic Athlete', phone: '+12025550123', sport: 'New Sport', timezone: 'America/New_York' } };
});
async function snapshot() {
  const [member, user, enrollment, events] = await Promise.all([db.doc(memberPath).get(), db.doc('users/athlete').get(), db.doc('pulsecheck-pilot-enrollments/pilot_athlete').get(), db.collection(`${memberPath}/consent-events`).get()]);
  return { member: member.data(), user: user.data(), enrollment: enrollment.data(), events: events.docs.map(d => d.data()) };
}
test('completion saves exact receipt, optional decline, membership, pilot and user together', async () => {
  const result = await save(); assert.equal(result.onboardingStatus, 'complete');
  const state = await snapshot(); assert.equal(state.events.length, 1); assert.equal(state.user.pulseCheckOnboardingComplete, true);
  assert.equal(state.enrollment.status, 'active'); assert.equal(state.member.athleteOnboarding.baselinePathStatus, 'complete');
  assert.equal(state.member.athleteOnboarding.consentDecisions['pulsecheck-health-authorization'].decision, 'declined');
  assert.equal(state.user.sport, 'Existing Sport'); assert.equal(state.user.dailyReflectionPreferences.hour, 20);
});
test('lost-response retry and concurrent submissions append one event', async () => {
  await Promise.all([save(), save()]); await save();
  assert.equal((await snapshot()).events.length, 1);
});
for (const failureAt of [1, 2, 3, 4, 5]) test(`failure at atomic write ${failureAt} leaves all state unchanged and retry converges`, async () => {
  const beforeState = await snapshot();
  const faulty = { collection: db.collection.bind(db), runTransaction: fn => db.runTransaction(async tx => {
    let count = 0;
    const wrapped = new Proxy(tx, { get(target, prop) {
      const value = target[prop];
      if (['create', 'update', 'set'].includes(prop)) return (...args) => { if (++count === failureAt) throw new Error('injected write interruption'); return value.apply(target, args); };
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    return fn(wrapped);
  }) };
  await assert.rejects(save(input, faulty), /injected/); assert.deepEqual(await snapshot(), beforeState);
  await save(); assert.equal((await snapshot()).user.pulseCheckOnboardingComplete, true);
});
test('foreign signer, revoked membership, archived team and closure request make no writes', async () => {
  await assert.rejects(save(input, db, 'other'), e => e.status === 403);
  for (const [path, change] of [[memberPath, { revokedAt: 1 }], ['pulsecheck-teams/team', { archivedAt: 1 }]]) {
    await db.doc(path).update(change); const beforeState = await snapshot(); await assert.rejects(save(), e => e.status === 403); assert.deepEqual(await snapshot(), beforeState);
    await db.doc(path).update(Object.fromEntries(Object.keys(change).map(key => [key, null])));
  }
  await db.doc('account-closure-jobs/athlete').set({ status: 'queued' }); await assert.rejects(save(), e => e.status === 403);
  assert.equal((await snapshot()).events.length, 0);
});
test('changed product, same-version changed body and changed pilot reject stale open forms', async () => {
  await db.doc('pulsecheck-organizations/org').update({ productBrand: 'athleticmind' }); await assert.rejects(save(), e => e.code === 'CONSENT_CONTEXT_CHANGED');
  await db.doc('pulsecheck-organizations/org').update({ productBrand: 'pulsecheck' });
  const altered = structuredClone(input.expectedContext.documents); altered[0].body += ' New term.';
  await db.doc('pulsecheck-teams/team').update({ requiredConsents: altered }); await assert.rejects(save(), e => e.code === 'CONSENT_CONTEXT_CHANGED');
  await db.doc('pulsecheck-teams/team').update({ requiredConsents: input.expectedContext.documents });
  const priorPilot = (await db.doc('pulsecheck-pilots/pilot').get()).data();
  await db.doc('pulsecheck-pilots/other-pilot').set(priorPilot);
  await db.doc(memberPath).update({ 'athleteOnboarding.targetPilotId': 'other-pilot' });
  await assert.rejects(save(), e => e.code === 'CONSENT_CONTEXT_CHANGED');
  assert.equal((await snapshot()).events.length, 0);
});
test('bare completion flags cannot create new acceptance; required refusal and missing intake block', async () => {
  const noReceipt = structuredClone(input); noReceipt.onboarding.consentDecisions = {}; noReceipt.onboarding.completedConsentIds = input.expectedContext.documents.map(d => d.id);
  await assert.rejects(save(noReceipt), e => e.code === 'CONSENT_INCOMPLETE');
  const refused = structuredClone(input); refused.onboarding.consentDecisions[input.expectedContext.documents[0].id].decision = 'declined';
  await assert.rejects(save(refused), e => e.code === 'CONSENT_INCOMPLETE');
  const noIntake = structuredClone(input); noIntake.onboarding.intakeResponses = {}; await assert.rejects(save(noIntake), e => e.code === 'INTAKE_INCOMPLETE');
  assert.equal((await snapshot()).events.length, 0);
});
test('optional revocation preserves earlier append-only history and does not create research eligibility', async () => {
  await save(); const request = structuredClone(input); request.action = 'progress'; request.onboarding.consentDecisions['pulsecheck-health-authorization'].decision = 'revoked';
  await save(request); const state = await snapshot(); assert.equal(state.events.length, 2); assert.equal(state.member.athleteOnboarding.eligibleForResearchDataset, false);
  assert.equal(state.member.onboardingStatus, 'complete');
});
