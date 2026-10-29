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

test('setup consent saves receipts without advancing an incomplete athlete or creating enrollment', async () => {
  await db.doc('pulsecheck-teams/team').update({ status: 'ready-for-activation' });
  await db.doc('pulsecheck-organizations/org').update({ status: 'provisioning' });
  await db.doc('pulsecheck-pilots/pilot').update({ status: 'draft' });
  await db.doc(memberPath).update({ onboardingStatus: 'pending-consent', 'athleteOnboarding.entryOnboardingStep': 'consent', 'athleteOnboarding.baselinePathStatus': 'pending' });
  const beforeState = await snapshot();
  const request = structuredClone(input); request.onboarding.intakeResponses = {}; request.onboarding.entryOnboardingStep = 'complete';
  const result = await save(request); const state = await snapshot();
  assert.equal(result.consentOnly, true); assert.equal(state.events.length, 1);
  assert.equal(state.member.onboardingStatus, 'pending-consent');
  assert.equal(state.member.athleteOnboarding.entryOnboardingStep, 'consent');
  assert.equal(state.member.athleteOnboarding.baselinePathStatus, 'pending');
  assert.equal(state.member.athleteOnboarding.intakeResponses, undefined);
  assert.equal(state.member.athleteOnboarding.eligibleForResearchDataset, false);
  assert.equal(state.member.phone, undefined); assert.equal(state.enrollment, undefined);
  assert.deepEqual(state.user, beforeState.user);
  assert.equal((await db.doc('pulsecheck-private-users/athlete').get()).exists, false);
});

test('setup consent refresh preserves completed onboarding and existing enrollment status', async () => {
  await save();
  await db.doc('pulsecheck-teams/team').update({ status: 'ready-for-activation' });
  await db.doc('pulsecheck-organizations/org').update({ status: 'ready-for-activation' });
  await db.doc('pulsecheck-pilots/pilot').update({ status: 'draft' });
  await db.doc('pulsecheck-pilot-cohorts/cohort').set({ status: 'draft', pilotId: 'pilot', teamId: 'team', organizationId: 'org' });
  await db.doc(memberPath).update({ 'athleteOnboarding.targetCohortId': 'cohort' });
  await db.doc('pulsecheck-pilot-enrollments/pilot_athlete').update({ status: 'pending-consent' });
  const beforeState = await snapshot();
  const request = structuredClone(input); request.expectedContext.cohortId = 'cohort';
  request.onboarding.consentDecisions['pulsecheck-health-authorization'].decision = 'accepted';
  request.onboarding.consentDecisions['pulsecheck-health-authorization'].signedName = 'Synthetic Athlete';
  request.profile.name = 'Should Not Change'; request.profile.phone = 'Should Not Change';
  await save(request); const state = await snapshot();
  assert.equal(state.events.length, 2); assert.equal(state.member.onboardingStatus, 'complete');
  assert.equal(state.member.athleteOnboarding.entryOnboardingStep, 'complete');
  assert.equal(state.enrollment.status, 'pending-consent');
  assert.equal(state.enrollment.enrollmentMode, beforeState.enrollment.enrollmentMode);
  assert.equal(state.member.phone, beforeState.member.phone); assert.deepEqual(state.user, beforeState.user);
  assert.equal((await db.doc('pulsecheck-pilots/pilot').get()).data().status, 'draft');
});

for (const [path, statuses] of [
  ['pulsecheck-teams/team', ['paused', 'archived', 'unknown', '']],
  ['pulsecheck-organizations/org', ['implementation-hold', 'archived', 'unknown', '']],
  ['pulsecheck-pilots/pilot', ['paused', 'completed', 'archived', 'provisioning', 'unknown', '']],
]) test(`setup consent still rejects inactive or unknown states for ${path}`, async () => {
  for (const status of statuses) {
    await db.doc(path).update({ status }); const beforeState = await snapshot();
    await assert.rejects(save(), e => e.code === 'PROGRAM_UNAVAILABLE');
    assert.deepEqual(await snapshot(), beforeState);
  }
});

test('every supported parent setup state accepts consent but revoked setup scope does not', async () => {
  for (const status of ['draft', 'provisioning', 'ready-for-activation']) {
    await db.doc('pulsecheck-teams/team').update({ status });
    await db.doc('pulsecheck-organizations/org').update({ status });
    assert.equal((await save()).consentOnly, true);
  }
  await db.doc('pulsecheck-teams/team').update({ revokedAt: 1 });
  const beforeState = await snapshot(); await assert.rejects(save(), e => e.code === 'PROGRAM_UNAVAILABLE');
  assert.deepEqual(await snapshot(), beforeState);
});

test('setup saves retain signature, current-document, cohort and ended-enrollment guards', async () => {
  await db.doc('pulsecheck-teams/team').update({ status: 'draft' });
  const unsigned = structuredClone(input); unsigned.onboarding.consentDecisions[input.expectedContext.documents[0].id].signedName = '';
  await assert.rejects(save(unsigned), e => e.code === 'INVALID_DECISION');
  const stale = structuredClone(input); stale.expectedContext.documents[0].body += ' changed';
  await assert.rejects(save(stale), e => e.code === 'CONSENT_CONTEXT_CHANGED');
  await db.doc('pulsecheck-pilot-cohorts/cohort').set({ status: 'paused', pilotId: 'pilot', teamId: 'team', organizationId: 'org' });
  await db.doc(memberPath).update({ 'athleteOnboarding.targetCohortId': 'cohort' }); input.expectedContext.cohortId = 'cohort';
  for (const status of ['paused', 'archived', 'unknown', '', 'provisioning']) {
    await db.doc('pulsecheck-pilot-cohorts/cohort').update({ status });
    await assert.rejects(save(), e => e.code === 'PROGRAM_UNAVAILABLE');
  }
  await db.doc('pulsecheck-pilot-cohorts/cohort').update({ status: 'draft' });
  for (const status of ['withdrawn', 'ended', 'completed']) {
    await db.doc('pulsecheck-pilot-enrollments/pilot_athlete').set({ status });
    await assert.rejects(save(), e => e.code === 'ENROLLMENT_ENDED');
  }
  assert.equal((await snapshot()).events.length, 0);
});

const compiledBaselineHealth = compileTypeScriptRuntime({cacheKey:'baseline-health',entryPaths:['src/lib/questionnaires/cau-health.ts']});
const {baselineHealthContext,saveBaselineHealthDecision}=loadCompiledModule({compiled:compiledBaselineHealth,fileName:'cau-health.js'});
test('existing member reconsent appends exact health evidence while preserving completed baseline and earlier receipts',async()=>{
 await save();const original=await snapshot();
 const documents=structuredClone(input.expectedContext.documents);const health=documents.find(d=>d.category==='health_authorization');health.version='v2';health.body+=' Updated approved synthetic terms.';
 await db.doc('pulsecheck-teams/team').update({requiredConsents:documents});
 const assignment={teamId:'team',teamMembershipId:memberId};let context=await baselineHealthContext(db,'athlete',assignment);
 assert.equal(context.eligible,true);assert.equal(context.healthAuthorizationRequired,true);
 const entry={decision:'accepted',version:health.version,document:health,signedName:'Synthetic Athlete',decidedAt:'2026-10-25T12:00:00Z'};
 await saveBaselineHealthDecision(db,'athlete',context,{[health.id]:entry},now);
 context=await baselineHealthContext(db,'athlete',assignment);assert.equal(context.healthSharingAllowed,true);assert.equal(context.healthAuthorizationRequired,false);
 const updated=await snapshot();assert.equal(updated.events.length,2);assert.equal(updated.member.athleteOnboarding.baselinePathStatus,'complete');
 assert.ok(updated.events.some(e=>JSON.stringify(e.decisions)===JSON.stringify(original.events[0].decisions)));
 assert.equal(updated.member.athleteOnboarding.intakeResponses.goal,'Synthetic goal');
});
test('baseline health decisions reject foreign scope, stale terms and unsigned acceptance without mutation',async()=>{
 await save();const context=await baselineHealthContext(db,'athlete',{teamId:'team',teamMembershipId:memberId});
 const document=context.healthDocuments[0],entry={decision:'accepted',version:document.version,document,signedName:''};const before=await snapshot();
 await assert.rejects(saveBaselineHealthDecision(db,'athlete',context,{[document.id]:entry},now));
 await assert.rejects(saveBaselineHealthDecision(db,'athlete',context,{[document.id]:{...entry,signedName:'Athlete',document:{...document,body:'Stale body'}}},now));
 await db.doc(memberPath).update({organizationId:'foreign'});
 const foreign=await baselineHealthContext(db,'athlete',{teamId:'team',teamMembershipId:memberId});assert.equal(foreign.eligible,false);
 await assert.rejects(saveBaselineHealthDecision(db,'athlete',foreign,{[document.id]:{...entry,signedName:'Athlete'}},now));
 assert.equal((await snapshot()).events.length,before.events.length);
});
test('individual health has a real private decision flow and accepts decline without fabricating a signature',async()=>{
 const assignment={scope:'individual'};let context=await baselineHealthContext(db,'athlete',assignment);
 assert.equal(context.healthBaselineEnabled,true);assert.equal(context.healthAuthorizationRequired,true);
 const document=context.healthDocuments[0];
 await saveBaselineHealthDecision(db,'athlete',context,{[document.id]:{decision:'declined',version:document.version,document,signedName:'',decidedAt:'2026-10-25T12:00:00Z'}},now);
 context=await baselineHealthContext(db,'athlete',assignment);assert.equal(context.healthAuthorizationRequired,false);assert.equal(context.healthSharingAllowed,false);assert.equal(context.healthAuthorizationDecision,'declined');
 const summary=(await db.doc('pulsecheck-private-users/athlete').get()).data();assert.equal(summary.baselineHealthConsentDecisions[document.id].signedName,'');
 assert.equal((await db.collection('pulsecheck-private-users/athlete/consent-events').get()).size,1);
});

test('school activation derives scope and sport from persisted team, skips intake without completing baseline', async () => {
  await db.doc('pulsecheck-organizations/org').update({ productBrand: 'athleticmind' });
  await db.doc('pulsecheck-teams/team').update({ sportOrProgram: 'Bowling' });
  await db.doc('users/athlete').update({ sport: '' });
  await db.doc(memberPath).update({ 'athleteOnboarding.baselinePathStatus': 'pending', 'athleteOnboarding.intakeResponses': { goal: 'Keep previous answer' } });
  const request = structuredClone(input);
  request.expectedContext.productBrand = 'athleticmind';
  const team = (await db.doc('pulsecheck-teams/team').get()).data();
  const pilot = (await db.doc('pulsecheck-pilots/pilot').get()).data();
  const docs = resolveAtomicConsentDocuments(team, pilot, 'athleticmind');
  request.expectedContext.documents = docs;
  request.onboarding.consentDecisions = Object.fromEntries(docs.map(document => [document.id, { decision: document.category === 'health_authorization' ? 'declined' : 'accepted', version: document.version, signedName: 'Synthetic Athlete', document }]));
  delete request.onboarding.intakeResponses;
  await save(request);
  const state = await snapshot();
  assert.equal(state.member.athleteOnboarding.flowVersion, 'school-activation-v1');
  assert.equal(state.member.athleteOnboarding.baselinePathStatus, 'ready');
  assert.equal(state.member.athleteOnboarding.intakeCompletedAt, undefined);
  assert.deepEqual(state.member.athleteOnboarding.intakeResponses, { goal: 'Keep previous answer' });
  assert.equal(state.user.sport, 'Bowling');
});

test('caller school flow flag cannot bypass another organization intake', async () => {
  const request = structuredClone(input);
  request.onboarding.flowVersion = 'school-activation-v1';
  request.onboarding.intakeResponses = {};
  await assert.rejects(save(request), error => error.code === 'INTAKE_INCOMPLETE');
});
