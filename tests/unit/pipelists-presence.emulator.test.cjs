const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { collection, doc, setDoc, getDocs, getDoc, deleteDoc, serverTimestamp, disableNetwork, enableNetwork } = require('firebase/firestore');
const { activePipeListPeople, pipeListInitials, PRESENCE_LIFETIME_MS } = require('../../src/components/PipeListPresence.tsx');

let env;
before(async () => {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Requires local Firestore emulator');
  env = await initializeTestEnvironment({
    projectId: 'demo-pipelists-presence',
    firestore: { rules: readFileSync('firestore.simpbudget.rules', 'utf8') },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    for (const id of ['team', 'elsewhere']) {
      await setDoc(doc(context.firestore(), 'pipeListShares', id), {
        ownerUid: 'owner', publicRead: true, viewerEmails: ['reader@test.example'],
        editorEmails: id === 'team' ? ['editor@test.example'] : [],
      });
    }
  });
});
after(() => env?.cleanup());

test('same-list sessions deduplicate, expire after disconnect, and return upon reconnect', async () => {
  const account = uid => env.authenticatedContext(uid, { email: uid + '@test.example' }).firestore();
  const owner = account('owner');
  const editor = account('editor');
  const path = 'pipeListProtectedShares/team/presence';
  const beat = (db, tab, uid) => setDoc(doc(db, path, tab), { uid, initials: pipeListInitials(uid), seenAt: serverTimestamp() });
  await assertSucceeds(beat(owner, 'first', 'owner'));
  await assertSucceeds(beat(editor, 'second', 'editor'));
  await assertSucceeds(beat(editor, 'third', 'editor'));
  const people = async now => {
    const rows = await getDocs(collection(owner, path));
    return activePipeListPeople(rows.docs.map(row => ({ ...row.data(), seenAt: row.data().seenAt.toMillis() })), now)
      .map(row => row.uid);
  };
  assert.deepEqual(await people(Date.now()), ['editor', 'owner']);
  await deleteDoc(doc(editor, path, 'second'));
  assert.deepEqual(await people(Date.now()), ['editor', 'owner']);
  await disableNetwork(editor);
  assert.deepEqual(await people(Date.now() + PRESENCE_LIFETIME_MS + 1000), []);
  await enableNetwork(editor);
  await assertSucceeds(beat(editor, 'third', 'editor'));
  assert.deepEqual(await people(Date.now()), ['editor', 'owner']);

  await assertSucceeds(getDocs(collection(account('reader'), path)));
  for (const client of [env.unauthenticatedContext().firestore(), account('stranger')]) {
    await assertSucceeds(getDoc(doc(client, 'pipeListShares/team')));
    await assertFails(getDocs(collection(client, path)));
    await assertFails(getDoc(doc(client, path, 'first')));
    await assertFails(beat(client, 'public', 'stranger'));
  }
  await assertFails(getDocs(collection(editor, 'pipeListProtectedShares/elsewhere/presence')));
  await assertFails(beat(editor, 'first', 'editor'));
  await assertFails(beat(editor, 'fake', 'owner'));
  await assertFails(deleteDoc(doc(editor, path, 'first')));
  await assertFails(setDoc(doc(editor, path, 'extra'), {
    uid: 'editor', initials: 'ED', email: 'editor@test.example', seenAt: serverTimestamp(),
  }));
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'pipeListShares/team'), { editorEmails: [] }, { merge: true }));
  await assertFails(getDocs(collection(editor, path)));
  await assertFails(beat(editor, 'third', 'editor'));
});
