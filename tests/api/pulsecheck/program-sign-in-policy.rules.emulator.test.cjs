const { test, before, after } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc } = require('firebase/firestore');
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-phone-policy', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'pulsecheck-organizations', 'program'), { status: 'active', signInPolicy: { mode: 'institution-phone', emailDomains: ['school.edu'] } });
    await setDoc(doc(db, 'pulsecheck-teams', 'team'), { status: 'active', organizationId: 'program' });
    await setDoc(doc(db, 'pulsecheck-team-memberships', 'team_athlete'), { userId: 'athlete', teamId: 'team', organizationId: 'program', role: 'athlete', status: 'active' });
    await setDoc(doc(db, 'admin', 'admin@example.test'), { role: 'admin' });
  });
});
after(async () => { await env?.cleanup(); });
test('direct database access to a phone-only team requires a phone session, including iOS handoff', async () => {
  for (const provider of ['password', 'google.com', 'apple.com', 'custom']) {
    const db = env.authenticatedContext('athlete', { firebase: { sign_in_provider: provider }, email: 'a@school.edu' }).firestore();
    await assertFails(getDoc(doc(db, 'pulsecheck-teams', 'team')));
  }
  for (const claims of [{ firebase: { sign_in_provider: 'phone' } }, { firebase: { sign_in_provider: 'custom' }, pulse_phone_auth: true }]) {
    await assertSucceeds(getDoc(doc(env.authenticatedContext('athlete', claims).firestore(), 'pulsecheck-teams', 'team')));
  }
});
test('platform administrators retain provisioning access', async () => {
  const db = env.authenticatedContext('admin', { email: 'admin@example.test', firebase: { sign_in_provider: 'google.com' } }).firestore();
  await assertSucceeds(getDoc(doc(db, 'pulsecheck-teams', 'team')));
});
