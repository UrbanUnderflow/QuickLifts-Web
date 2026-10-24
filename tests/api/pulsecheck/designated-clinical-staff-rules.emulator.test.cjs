const { test } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
test('clinical contacts and audit stay server-only even for authenticated team members and admins', async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-clinical-staff-private', firestore: { host: '127.0.0.1', port: 8188, rules: fs.readFileSync('firestore.rules', 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async c => {
      await setDoc(doc(c.firestore(), 'pulsecheck-team-escalation-settings/team'), { primary: { phone: '+14105550123' } });
      await setDoc(doc(c.firestore(), 'pulsecheck-team-escalation-settings/team/audit/change'), { action: 'draft-saved' });
      await setDoc(doc(c.firestore(), 'pulsecheck-team-memberships/team_athlete'), { teamId: 'team', userId: 'athlete', status: 'active', role: 'athlete' });
      await setDoc(doc(c.firestore(), 'admin/admin@example.test'), { email: 'admin@example.test' });
    });
    for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext('athlete'), env.authenticatedContext('coach'), env.authenticatedContext('admin', { email: 'admin@example.test', admin: true })]) {
      for (const path of ['pulsecheck-team-escalation-settings/team', 'pulsecheck-team-escalation-settings/team/audit/change']) {
        await assertFails(getDoc(doc(ctx.firestore(), path)));
        await assertFails(setDoc(doc(ctx.firestore(), path), { status: 'active' }));
      }
    }
  } finally { await env.cleanup(); }
});
