const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createFirestoreAdminMock, compileTypeScriptRuntime, loadCompiledModule, repoRoot } = require('../firebase-admin/_runtimeHarness.cjs');
const { provisionEntity } = require('../../../src/lib/server/pulsecheck/provisionEntity');
const { processInviteAcceptedOutbox, COLLECTION } = require('../../../netlify/functions/lib/invite-accepted-outbox');

test('lost provisioning response retries return the same entity; separate operations remain separate', async () => {
  const { db } = createFirestoreAdminMock();
  const input = { kind: 'organization', actor: 'admin@example.test', operationId: 'operation-00000001', payload: { displayName: 'Same name', productBrand: 'pulsecheck', appBranding: { pulsecheck: 'athleticmind' } } };
  const first = await provisionEntity(db, input, 1);
  assert.equal((await provisionEntity(db, input, 2)).id, first.id);
  assert.equal((await provisionEntity(db, input, 2)).created, false);
  assert.notEqual((await provisionEntity(db, { ...input, operationId: 'operation-00000002' }, 3)).id, first.id);
  assert.deepEqual((await db.collection('pulsecheck-organizations').doc(first.id).get()).data().appBranding, input.payload.appBranding);
  await assert.rejects(provisionEntity(db, { ...input, payload: { displayName: 'Missing product' } }, 1));
});

function outboxFixture(staffStatus = 'active') {
  return createFirestoreAdminMock({ collections: {
    [COLLECTION]: [{ id: 'team_athlete', data: { status: 'pending', membershipId: 'team_athlete', athleteUserId: 'athlete', teamId: 'team', organizationId: 'org', inviteToken: 'invite' } }],
    'pulsecheck-team-memberships': [
      { id: 'team_athlete', data: { status: 'active', grantedByInviteToken: 'invite', role: 'athlete', userId: 'athlete', teamId: 'team', organizationId: 'org' } },
      { id: 'team_coach', data: { status: staffStatus, role: 'coach', userId: 'coach', teamId: 'team', organizationId: 'org' } },
    ],
    'pulsecheck-invite-links': [{ id: 'invite', data: { status: 'redeemed', teamId: 'team', organizationId: 'org', notifyCoachOnAccept: true, createdByUserId: 'coach', createdByEmail: 'spoofed@example.test' } }],
    'pulsecheck-teams': [{ id: 'team', data: { status: 'active', organizationId: 'org', displayName: 'Team' } }],
    'pulsecheck-organizations': [{ id: 'org', data: { status: 'active', displayName: 'Org' } }],
  } });
}
const recipient = async uid => ({ uid, email: 'verified@example.test', displayName: 'Coach' });

test('notification outage remains pending; retry uses verified recipient; sent replay never sends again', async () => {
  const { db, getDocument } = outboxFixture();
  await assert.rejects(processInviteAcceptedOutbox(db, 'team_athlete', async () => { throw Object.assign(new Error('confirmed pre-send outage'), { retrySafe: true }); }, 100, recipient));
  assert.equal(getDocument(`${COLLECTION}/team_athlete`).status, 'pending');
  let sends = 0;
  const send = async input => { sends++; assert.equal(input.coachEmail, 'verified@example.test'); assert.equal(input.athleteEmail, undefined); return { success: true }; };
  assert.equal((await processInviteAcceptedOutbox(db, 'team_athlete', send, 200, recipient)).sent, true);
  assert.equal((await processInviteAcceptedOutbox(db, 'team_athlete', send, 300, recipient)).skipped, true);
  assert.equal(sends, 1);
});

test('removed recipient and inactive enrollment cancel delivery', async () => {
  const { db } = outboxFixture('removed');
  let sends = 0;
  assert.equal((await processInviteAcceptedOutbox(db, 'team_athlete', async () => { sends++; }, 1, recipient)).cancelled, true);
  assert.equal(sends, 0);
});

test('existing lease prevents concurrent delivery and expired lease is recoverable', async () => {
  const { db } = outboxFixture();
  await db.collection(COLLECTION).doc('team_athlete').set({ leaseUntil: 500 }, { merge: true });
  let sends = 0;
  const send = async () => { sends++; return { success: true }; };
  assert.equal((await processInviteAcceptedOutbox(db, 'team_athlete', send, 100, recipient)).skipped, true);
  assert.equal((await processInviteAcceptedOutbox(db, 'team_athlete', send, 501, recipient)).sent, true);
  assert.equal(sends, 1);
});

const compiled = compileTypeScriptRuntime({ cacheKey: 'secure-invite-accepted', entryPaths: [path.join(repoRoot, 'netlify/functions/send-pulsecheck-invite-accepted-email.ts')] });
test('public sender rejects unauthenticated and forged membership requests without delivering', async () => {
  let sends = 0;
  const { db } = outboxFixture();
  const load = userId => loadCompiledModule({ compiled, fileName: 'send-pulsecheck-invite-accepted-email.js', mocks: {
    './lib/invite-accepted-outbox': { COLLECTION, processInviteAcceptedOutbox },
    './lib/pulsecheck-coach-services': { verifyFirebaseUser: async () => { if (!userId) throw Object.assign(new Error('auth'), { statusCode: 401 }); return { userId, app: { firestore: () => db, auth: () => ({ verifyIdToken: async () => ({ uid: userId }) }) } }; } },
    './utils/emailSequenceHelpers': { buildEmailDedupeKey: () => 'id', sendBrevoTransactionalEmail: async () => { sends++; return { success: true }; } },
  } }).handler;
  const request = { httpMethod: 'POST', headers: {}, body: JSON.stringify({ membershipId: 'team_athlete', coachEmail: 'attacker@example.test', notifyCoach: true }) };
  assert.equal((await load(null)(request)).statusCode, 401);
  assert.equal((await load('other')(request)).statusCode, 403);
  assert.equal(sends, 0);
});

test('ambiguous provider delivery is held for reconciliation and cannot be replayed', async () => {
  const { db, getDocument } = outboxFixture();
  let sends = 0;
  const send = async () => { sends++; throw new Error('timeout after dispatch'); };
  await assert.rejects(processInviteAcceptedOutbox(db, 'team_athlete', send, 100, recipient));
  assert.equal(getDocument(`${COLLECTION}/team_athlete`).status, 'needs-review');
  await processInviteAcceptedOutbox(db, 'team_athlete', send, 9999999, recipient);
  assert.equal(sends, 1);
});

test('worker that loses its lease before dispatch cannot deliver', async () => {
  const { db } = outboxFixture();
  let sends = 0;
  const stolen = async uid => {
    await db.collection(COLLECTION).doc('team_athlete').set({ lease: 'replacement-worker' }, { merge: true });
    return recipient(uid);
  };
  assert.equal((await processInviteAcceptedOutbox(db, 'team_athlete', async () => { sends++; }, 100, stolen)).skipped, true);
  assert.equal(sends, 0);
});

test('interrupted dispatch becomes needs-review after lease expiry without resending', async () => {
  const { db, getDocument } = outboxFixture();
  await db.collection(COLLECTION).doc('team_athlete').set({ status: 'sending', leaseUntil: 100 }, { merge: true });
  let sends = 0;
  await processInviteAcceptedOutbox(db, 'team_athlete', async () => { sends++; }, 101, recipient);
  assert.equal(getDocument(`${COLLECTION}/team_athlete`).status, 'needs-review');
  assert.equal(sends, 0);
});
