const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileTypeScriptRuntime,
  createFirestoreAdminMock,
  createNextApiResponseRecorder,
  loadCompiledModule,
  repoRoot,
} = require('../firebase-admin/_runtimeHarness.cjs');

const compiledRuntime = compileTypeScriptRuntime({
  cacheKey: 'native-athlete-invite-handoff',
  entryPaths: [
    path.join(
      repoRoot,
      'src/lib/server/pulsecheck/native-athlete-invite-handoff.ts'
    ),
    path.join(
      repoRoot,
      'src/pages/api/pulsecheck/team-invite/native-handoff/create.ts'
    ),
    path.join(
      repoRoot,
      'src/pages/api/pulsecheck/team-invite/native-handoff/consume.ts'
    ),
  ],
});

const clearCompiledRuntime = () => {
  const realOutputDirectory = fs.realpathSync(compiledRuntime.outDir);
  for (const cacheKey of Object.keys(require.cache)) {
    if (cacheKey.startsWith(realOutputDirectory)) {
      delete require.cache[cacheKey];
    }
  }
};

const baseInvite = (overrides = {}) => ({
  inviteType: 'team-access',
  status: 'active',
  redemptionMode: 'general',
  organizationId: 'org-1',
  teamId: 'team-1',
  teamMembershipRole: 'athlete',
  targetEmail: 'athlete@example.com',
  ...overrides,
});

const request = ({ body = {}, authorization = '', firebaseMode = '' } = {}) => ({
  method: 'POST',
  headers: {
    ...(authorization ? { authorization } : {}),
    ...(firebaseMode ? { 'x-pulsecheck-firebase-mode': firebaseMode } : {}),
  },
  body,
});

const loadHandoffRuntime = ({ invite = baseInvite(), decoded = {} } = {}) => {
  clearCompiledRuntime();
  const firebase = createFirestoreAdminMock({
    collections: {
      'pulsecheck-invite-links': [
        { id: 'invite-1', data: invite },
      ],
      'pulsecheck-native-athlete-invite-handoffs': [],
      'pulsecheck-team-memberships': [],
    },
  });
  const modeCalls = [];
  const authCalls = [];
  const auth = {
    async verifyIdToken(token) {
      authCalls.push({ method: 'verifyIdToken', token });
      return {
        uid: 'athlete-1',
        email: 'athlete@example.com',
        email_verified: true,
        ...decoded,
      };
    },
    async createCustomToken(uid, claims) {
      authCalls.push({ method: 'createCustomToken', uid, claims });
      return `custom-token-for-${uid}`;
    },
  };
  firebase.admin.auth = () => auth;

  const firebaseAdminModule = {
    __esModule: true,
    default: firebase.admin,
    getFirebaseAdminApp(forceDevFirebase) {
      modeCalls.push(forceDevFirebase);
      return { name: forceDevFirebase ? 'dev-app' : 'prod-app' };
    },
  };
  const mocks = {
    '/lib/firebase-admin': firebaseAdminModule,
  };
  const createModule = loadCompiledModule({
    compiled: compiledRuntime,
    fileName: 'create.js',
    mocks,
  });
  const consumeModule = loadCompiledModule({
    compiled: compiledRuntime,
    fileName: 'consume.js',
    mocks,
  });

  return {
    authCalls,
    create: createModule.default,
    consume: consumeModule.default,
    firebase,
    modeCalls,
  };
};

const createHandoff = async (runtime, overrides = {}) => {
  const response = createNextApiResponseRecorder();
  await runtime.create(
    request({
      authorization: 'Bearer native-firebase-id-token',
      firebaseMode: 'dev',
      body: {
        inviteToken: 'invite-1',
        forceDevFirebase: true,
        ...overrides,
      },
    }),
    response
  );
  return response;
};

test('native handoff creation requires Firebase authentication', async () => {
  const runtime = loadHandoffRuntime();
  const response = createNextApiResponseRecorder();

  await runtime.create(
    request({ body: { inviteToken: 'invite-1' } }),
    response
  );

  assert.equal(response.statusCode, 401);
  assert.equal(runtime.authCalls.length, 0);
});

test('native handoff stores only a hashed, five-minute, invite-bound code', async () => {
  const runtime = loadHandoffRuntime();
  const response = await createHandoff(runtime);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.expiresInSeconds, 300);
  assert.match(response.body.handoffCode, /^[A-Za-z0-9_-]{40,}$/);
  assert.deepEqual(runtime.modeCalls, [true]);
  assert.deepEqual(runtime.authCalls, [
    { method: 'verifyIdToken', token: 'native-firebase-id-token' },
  ]);

  const handoffId = createHash('sha256')
    .update(response.body.handoffCode, 'utf8')
    .digest('hex');
  const stored = runtime.firebase.getDocument(
    `pulsecheck-native-athlete-invite-handoffs/${handoffId}`
  );
  assert.equal(stored.inviteToken, 'invite-1');
  assert.equal(stored.userId, 'athlete-1');
  assert.equal(stored.organizationId, 'org-1');
  assert.equal(stored.teamId, 'team-1');
  assert.equal(stored.firebaseMode, 'dev');
  assert.equal(stored.status, 'active');
  const remainingSeconds =
    stored.expiresAtEpochSeconds - Math.floor(Date.now() / 1000);
  assert.ok(remainingSeconds >= 299 && remainingSeconds <= 300);
  assert.equal(JSON.stringify(stored).includes(response.body.handoffCode), false);
  assert.equal(runtime.firebase.getDocument('pulsecheck-team-memberships/athlete-1'), undefined);
});

test('native handoff consumes once, checks the exact invite, and mints the bound user token', async () => {
  const runtime = loadHandoffRuntime();
  const created = await createHandoff(runtime);
  const handoffCode = created.body.handoffCode;

  const wrongInvite = createNextApiResponseRecorder();
  await runtime.consume(
    request({
      firebaseMode: 'dev',
      body: {
        inviteToken: 'another-invite',
        handoffCode,
        forceDevFirebase: true,
      },
    }),
    wrongInvite
  );
  assert.equal(wrongInvite.statusCode, 403);

  const consumed = createNextApiResponseRecorder();
  await runtime.consume(
    request({
      firebaseMode: 'dev',
      body: { inviteToken: 'invite-1', handoffCode, forceDevFirebase: true },
    }),
    consumed
  );
  assert.equal(consumed.statusCode, 200);
  assert.deepEqual(consumed.body, { customToken: 'custom-token-for-athlete-1' });
  assert.deepEqual(runtime.authCalls.at(-1), {
    method: 'createCustomToken',
    uid: 'athlete-1',
    claims: undefined,
  });

  const replay = createNextApiResponseRecorder();
  await runtime.consume(
    request({
      firebaseMode: 'dev',
      body: { inviteToken: 'invite-1', handoffCode, forceDevFirebase: true },
    }),
    replay
  );
  assert.equal(replay.statusCode, 410);
  assert.equal(
    runtime.authCalls.filter((call) => call.method === 'createCustomToken').length,
    1
  );
  assert.equal(runtime.firebase.writes.updates.length, 1);
  assert.equal(runtime.firebase.writes.updates[0].next.status, 'consumed');
  assert.equal(runtime.firebase.getDocument('pulsecheck-team-memberships/athlete-1'), undefined);
});

test('native handoff rejects the wrong athlete account and rechecks revocation at consume time', async () => {
  const wrongAccountRuntime = loadHandoffRuntime({
    decoded: { email: 'someone-else@example.com' },
  });
  const wrongAccount = await createHandoff(wrongAccountRuntime);
  assert.equal(wrongAccount.statusCode, 403);
  assert.equal(wrongAccount.body.error, 'Sign in with the account this athlete invite was sent to.');

  const runtime = loadHandoffRuntime();
  const created = await createHandoff(runtime);
  await runtime.firebase.db
    .collection('pulsecheck-invite-links')
    .doc('invite-1')
    .update({ revokedAt: new Date().toISOString() });

  const response = createNextApiResponseRecorder();
  await runtime.consume(
    request({
      firebaseMode: 'dev',
      body: {
        inviteToken: 'invite-1',
        handoffCode: created.body.handoffCode,
        forceDevFirebase: true,
      },
    }),
    response
  );
  assert.equal(response.statusCode, 410);
  assert.equal(
    runtime.authCalls.filter((call) => call.method === 'createCustomToken').length,
    0
  );
});
