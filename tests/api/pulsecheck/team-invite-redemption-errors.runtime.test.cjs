const assert = require('node:assert/strict');
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
  cacheKey: 'team-invite-redemption-errors',
  entryPaths: [
    path.join(
      repoRoot,
      'src/lib/server/pulsecheck/teamInviteRedemptionErrors.ts'
    ),
    path.join(
      repoRoot,
      'src/pages/api/pulsecheck/team-invite/redeem.ts'
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
  pilotId: 'pilot-1',
  cohortId: 'cohort-1',
  teamMembershipRole: 'athlete',
  ...overrides,
});

const baseOrganization = (overrides = {}) => ({
  status: 'active',
  displayName: 'Example University',
  ...overrides,
});

const baseTeam = (overrides = {}) => ({
  status: 'active',
  organizationId: 'org-1',
  displayName: 'Volleyball',
  ...overrides,
});

const basePilot = (overrides = {}) => ({
  status: 'active',
  organizationId: 'org-1',
  teamId: 'team-1',
  name: 'Spring Pilot',
  studyMode: 'operational',
  ...overrides,
});

const baseCohort = (overrides = {}) => ({
  status: 'active',
  organizationId: 'org-1',
  teamId: 'team-1',
  pilotId: 'pilot-1',
  ...overrides,
});

const records = (value, id) =>
  value === null ? [] : [{ id, data: value }];

const loadRuntime = ({
  invite = baseInvite(),
  organization = baseOrganization(),
  team = baseTeam(),
  pilot = basePilot(),
  cohort = baseCohort(),
  enrollment = null,
  entitlement = null,
  decoded = {},
  authError = null,
  transactionError = null,
} = {}) => {
  const firebase = createFirestoreAdminMock({
    collections: {
      'pulsecheck-invite-links': records(invite, 'invite-1'),
      'pulsecheck-organizations': records(organization, 'org-1'),
      'pulsecheck-teams': records(team, 'team-1'),
      'pulsecheck-pilots': records(pilot, 'pilot-1'),
      'pulsecheck-pilot-cohorts': records(cohort, 'cohort-1'),
      'pulsecheck-pilot-enrollments': records(
        enrollment,
        'pilot-1_athlete-1'
      ),
      'pulsecheck-athlete-app-entitlements': records(
        entitlement,
        'team-1_athlete-1'
      ),
      'pulsecheck-team-memberships': [],
      'pulsecheck-organization-memberships': [],
      users: [],
    },
  });
  const auth = {
    async verifyIdToken() {
      if (authError) throw authError;
      return {
        uid: 'athlete-1',
        email: 'athlete@example.com',
        email_verified: true,
        ...decoded,
      };
    },
  };
  firebase.admin.auth = () => auth;
  if (transactionError) {
    firebase.db.runTransaction = async () => {
      throw transactionError;
    };
  }

  clearCompiledRuntime();
  const handlerModule = loadCompiledModule({
    compiled: compiledRuntime,
    fileName: 'redeem.js',
    mocks: {
      '/lib/firebase-admin': {
        __esModule: true,
        default: firebase.admin,
        getFirebaseAdminApp: () => ({ name: 'production-app' }),
      },
    },
  });

  return handlerModule.default;
};

const request = ({
  method = 'POST',
  authorization = 'Bearer firebase-id-token',
  body = { token: 'invite-1' },
} = {}) => ({
  method,
  headers: authorization ? { authorization } : {},
  body,
});

const redeem = async (runtimeOptions, requestOptions) => {
  const response = createNextApiResponseRecorder();
  await loadRuntime(runtimeOptions)(request(requestOptions), response);
  return response;
};

const expectError = (response, code, statusCode) => {
  assert.equal(response.statusCode, statusCode);
  assert.equal(response.body.code, code);
  assert.equal(response.body.message, response.body.error);
  assert.equal(typeof response.body.retryable, 'boolean');
  assert.equal(JSON.stringify(response.body).includes('sensitive'), false);
};

test('request and authentication errors use the stable response contract', async () => {
  expectError(
    await redeem({}, { method: 'GET' }),
    'METHOD_NOT_ALLOWED',
    405
  );
  expectError(
    await redeem({}, { authorization: '' }),
    'AUTH_REQUIRED',
    401
  );
  expectError(
    await redeem({}, { body: {} }),
    'INVITE_TOKEN_REQUIRED',
    400
  );
  expectError(
    await redeem({}, { body: { token: 'invalid/token' } }),
    'INVITE_TOKEN_INVALID',
    400
  );
  expectError(
    await redeem({ decoded: { email: '' } }),
    'AUTH_EMAIL_REQUIRED',
    400
  );
  expectError(
    await redeem({
      authError: {
        code: 'auth/id-token-expired',
        message: 'sensitive provider detail',
      },
    }),
    'AUTH_INVALID',
    401
  );
});

test('invite lifecycle and email errors are distinct and do not expose the target email', async () => {
  expectError(
    await redeem({ invite: null }),
    'INVITE_NOT_FOUND',
    404
  );
  expectError(
    await redeem({ invite: baseInvite({ inviteType: 'admin-activation' }) }),
    'INVITE_TYPE_INVALID',
    409
  );
  expectError(
    await redeem({ invite: baseInvite({ revokedAt: { seconds: 1 } }) }),
    'INVITE_REVOKED',
    410
  );
  expectError(
    await redeem({
      invite: baseInvite({ expiresAt: { seconds: 1 } }),
    }),
    'INVITE_EXPIRED',
    410
  );
  expectError(
    await redeem({ invite: baseInvite({ status: 'inactive' }) }),
    'INVITE_INACTIVE',
    410
  );
  expectError(
    await redeem({ invite: baseInvite({ status: 'revoked' }) }),
    'INVITE_REVOKED',
    410
  );
  expectError(
    await redeem({
      invite: baseInvite({
        redemptionMode: 'single-use',
        status: 'redeemed',
        redeemedByUserId: 'someone-else',
      }),
    }),
    'INVITE_ALREADY_REDEEMED',
    409
  );
  const emailMismatch = await redeem({
    invite: baseInvite({ targetEmail: 'private-athlete@example.com' }),
  });
  expectError(emailMismatch, 'INVITE_EMAIL_MISMATCH', 403);
  assert.equal(
    JSON.stringify(emailMismatch.body).includes('private-athlete@example.com'),
    false
  );
  expectError(
    await redeem({
      invite: baseInvite({ targetEmail: 'athlete@example.com' }),
      decoded: { email_verified: false },
    }),
    'INVITE_EMAIL_UNVERIFIED',
    403
  );
});

test('organization, team, and pilot scope failures identify the broken level', async () => {
  expectError(
    await redeem({ organization: null }),
    'ORGANIZATION_NOT_FOUND',
    404
  );
  expectError(
    await redeem({ organization: baseOrganization({ status: 'archived' }) }),
    'ORGANIZATION_INACTIVE',
    403
  );
  for (const status of ['draft', 'provisioning', 'ready-for-activation']) {
    expectError(
      await redeem({ organization: baseOrganization({ status }) }),
      'ORGANIZATION_ACTIVATION_REQUIRED',
      409
    );
  }
  const fullyPreActivation = await redeem({
    organization: baseOrganization({ status: 'ready-for-activation' }),
    team: baseTeam({ status: 'ready-for-activation' }),
  });
  expectError(fullyPreActivation, 'ORGANIZATION_ACTIVATION_REQUIRED', 409);
  assert.match(fullyPreActivation.body.message, /organization and team/i);
  expectError(
    await redeem({ team: null }),
    'TEAM_NOT_FOUND',
    404
  );
  expectError(
    await redeem({ team: baseTeam({ status: 'inactive' }) }),
    'TEAM_INACTIVE',
    403
  );
  for (const status of ['draft', 'provisioning', 'ready-for-activation']) {
    expectError(
      await redeem({ team: baseTeam({ status }) }),
      'TEAM_ACTIVATION_REQUIRED',
      409
    );
  }
  expectError(
    await redeem({ team: baseTeam({ organizationId: 'other-org' }) }),
    'TEAM_SCOPE_MISMATCH',
    409
  );
  expectError(
    await redeem({ pilot: null }),
    'PILOT_NOT_FOUND',
    404
  );
  expectError(
    await redeem({ pilot: basePilot({ organizationId: 'other-org' }) }),
    'PILOT_SCOPE_MISMATCH',
    409
  );
  expectError(
    await redeem({ pilot: basePilot({ status: 'completed' }) }),
    'PILOT_INACTIVE',
    409
  );
});

test('pilot schedule errors tell the client whether enrollment is early, ended, or invalid', async () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  expectError(
    await redeem({
      pilot: basePilot({ startAt: { seconds: nowSeconds + 86_400 } }),
    }),
    'PILOT_ENROLLMENT_NOT_STARTED',
    409
  );
  expectError(
    await redeem({
      pilot: basePilot({ endAt: { seconds: nowSeconds - 86_400 } }),
    }),
    'PILOT_ENROLLMENT_ENDED',
    409
  );
  expectError(
    await redeem({
      pilot: basePilot({
        startAt: { seconds: nowSeconds + 86_400 },
        endAt: { seconds: nowSeconds - 86_400 },
      }),
    }),
    'PILOT_SCHEDULE_INVALID',
    409
  );
});

test('cohort, existing enrollment, and app-access errors retain corrective detail', async () => {
  expectError(
    await redeem({ cohort: null }),
    'COHORT_NOT_FOUND',
    404
  );
  expectError(
    await redeem({ cohort: baseCohort({ status: 'paused' }) }),
    'COHORT_INACTIVE',
    409
  );
  expectError(
    await redeem({ cohort: baseCohort({ pilotId: 'other-pilot' }) }),
    'COHORT_SCOPE_MISMATCH',
    409
  );
  expectError(
    await redeem({
      enrollment: {
        status: 'active',
        cohortId: 'another-cohort',
      },
    }),
    'ENROLLMENT_COHORT_CONFLICT',
    409
  );
  expectError(
    await redeem({
      team: baseTeam({
        commercialConfig: {
          commercialModel: 'athlete-pay',
          teamPlanStatus: 'inactive',
          athleteAppSubscriptionEnabled: true,
        },
      }),
    }),
    'ATHLETE_APP_ACCESS_REQUIRED',
    402
  );
});

test('unexpected infrastructure failures return only the safe internal error', async () => {
  const response = await redeem({
    transactionError: new Error('sensitive Firestore project and document path'),
  });

  expectError(response, 'REDEMPTION_FAILED', 500);
  assert.match(response.body.message, /server problem/i);
});

test('the stable error contract does not change a successful redemption response', async () => {
  const response = await redeem();

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.organizationId, 'org-1');
  assert.equal(response.body.teamId, 'team-1');
  assert.equal(response.body.pilotId, 'pilot-1');
  assert.equal(response.body.cohortId, 'cohort-1');
  assert.equal(response.body.teamMembershipRole, 'athlete');
  assert.equal('code' in response.body, false);
  assert.equal('error' in response.body, false);
});
