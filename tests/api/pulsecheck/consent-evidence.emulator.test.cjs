const { test } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDoc } = require('firebase/firestore');
test('consent evidence belongs to the signer and cannot be changed or supplied by a coach', async () => {
 const env = await initializeTestEnvironment({ projectId: 'demo-pulse-consent', firestore: {host:'127.0.0.1',port:8188,rules:fs.readFileSync('firestore.rules','utf8')} });
 try {
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(),'pulsecheck-team-memberships','team_athlete'),{userId:'athlete',teamId:'team',role:'athlete'}); });
  const athlete = env.authenticatedContext('athlete').firestore();
  const coach = env.authenticatedContext('coach').firestore();
  const path = 'pulsecheck-team-memberships/team_athlete/consent-events/evidence';
  await assertSucceeds(setDoc(doc(athlete,path),{actorUserId:'athlete',decisions:{health:{decision:'declined'}},recordedAt:serverTimestamp()}));
  await assertSucceeds(getDoc(doc(athlete,path)));
  await assertFails(updateDoc(doc(athlete,path),{decisions:{health:{decision:'accepted'}}}));
  await assertFails(deleteDoc(doc(athlete,path)));
  await assertFails(getDoc(doc(coach,path)));
  await assertFails(setDoc(doc(coach,path+'-forged'),{actorUserId:'athlete',decisions:{},recordedAt:serverTimestamp()}));
 } finally { await env.cleanup(); }
});
