const assert = require('node:assert/strict');
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
  cacheKey: 'remove-athlete-from-team',
  entryPaths: [
    path.join(
      repoRoot,
      'src/pages/api/admin/pulsecheck/remove-athlete-from-team.ts'
    ),
  ],
});

const activeMembership = ({
  id = 'team-1_athlete-1',
  teamId = 'team-1',
  organizationId = 'org-1',
  commercialAccess,
  grantedVia,
} = {}) => ({
  id,
  data: {
    userId: 'athlete-1',
    email: 'athlete@example.com',
    teamId,
    organizationId,
    role: 'athlete',
    status: 'active',
    revokedAt: null,
    athleteOnboarding: {
      enrollmentMode: 'pilot',
      targetPilotId: 'pilot-1',
      targetPilotName: 'Spring Pilot',
      targetCohortId: 'cohort-1',
      targetCohortName: 'Spring',
      eligibleForResearchDataset: true,
    },
    ...(commercialAccess ? { commercialAccess } : {}),
    ...(grantedVia ? { grantedVia } : {}),
  },
});

const request = ({
  method = 'POST',
  authorization = 'Bearer valid-token',
  body = {
    teamId: 'team-1',
    athleteId: 'athlete-1',
    operationId: 'remove-operation-1',
  },
} = {}) => ({
  method,
  headers: authorization ? { authorization } : {},
  body,
});

const loadHandler = ({
  decoded = {
    uid: 'admin-1',
    email: 'admin@example.com',
    admin: true,
  },
  watchListActive = false,
  includeAlternateTeam = true,
  alternateTeamPlanAccess = true,
  currentGrantViaTeamCode = false,
  includeCurrentCommercialPointer = true,
} = {}) => {
  delete require.cache[
    require.resolve(compiledRuntime.emittedFiles['remove-athlete-from-team.js'])
  ];
  const alternateCommercialAccess = {
    sourceOrganizationId: 'org-2',
    sourceTeamId: 'team-2',
    teamName: 'Alternate Team',
    teamPlanBypassesPaywall: alternateTeamPlanAccess,
  };
  const memberships = [activeMembership({
    grantedVia: currentGrantViaTeamCode ? 'team-code-manual-entry' : undefined,
  })];
  if (includeAlternateTeam) {
    memberships.push(activeMembership({
      id: 'team-2_athlete-1',
      teamId: 'team-2',
      organizationId: 'org-2',
      commercialAccess: alternateCommercialAccess,
    }));
  }

  const firebaseMock = createFirestoreAdminMock({
    collections: {
      admin: [],
      users: [
        { id: 'admin-1', data: { email: 'admin@example.com' } },
        {
          id: 'athlete-1',
          data: {
            email: 'athlete@example.com',
            subscriptionType: 'Team Plan Access',
            ...(includeCurrentCommercialPointer
              ? {
                  pulseCheckTeamCommercialAccess: {
                    sourceOrganizationId: 'org-1',
                    sourceTeamId: 'team-1',
                    teamPlanBypassesPaywall: true,
                  },
                }
              : {}),
            onboardInvite: {
              teamId: 'team-1',
              source: currentGrantViaTeamCode ? 'pulsecheck-team-code' : 'pulsecheck-team-invite',
              ...(currentGrantViaTeamCode ? { grantedVia: 'team-code-manual-entry' } : {}),
            },
          },
        },
      ],
      'pulsecheck-team-memberships': memberships,
      'pulsecheck-pilot-enrollments': [
        {
          id: 'pilot-1_athlete-1',
          data: {
            userId: 'athlete-1',
            teamId: 'team-1',
            organizationId: 'org-1',
            pilotId: 'pilot-1',
            status: 'active',
            eligibleForResearchDataset: true,
          },
        },
      ],
      'pulsecheck-pilot-operational-states': [
        {
          id: 'pilot-1_athlete-1',
          data: { watchListActive },
        },
      ],
      'pulsecheck-provisioning-audit-events': [],
    },
  });
  firebaseMock.admin.auth = () => ({
    verifyIdToken: async () => decoded,
  });

  const firebaseAdminModule = {
    __esModule: true,
    default: firebaseMock.admin,
    getFirebaseAdminApp: () => ({ name: 'mock-app' }),
  };
  const module = loadCompiledModule({
    compiled: compiledRuntime,
    fileName: 'remove-athlete-from-team.js',
    mocks: {
      '../../../../lib/firebase-admin': firebaseAdminModule,
      '/lib/firebase-admin': firebaseAdminModule,
    },
  });

  return {
    handler: module.default,
    firebaseMock,
    alternateCommercialAccess,
  };
};

test('team removal soft-removes membership, withdraws pilot, and preserves alternate team access', async () => {
  const { handler, firebaseMock, alternateCommercialAccess } = loadHandler();
  const response = createNextApiResponseRecorder();

  await handler(request(), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.alreadyRemoved, false);
  assert.deepEqual(response.body.withdrawnPilotIds, ['pilot-1']);
  assert.equal(response.body.withdrawnEnrollmentCount, 1);

  const membership = firebaseMock.getDocument('pulsecheck-team-memberships/team-1_athlete-1');
  assert.equal(membership.status, 'removed');
  assert.equal(membership.revokedAt, 'server-timestamp');
  assert.equal(membership.removalReason, 'platform-admin-removal');
  assert.equal(membership.athleteOnboarding.enrollmentMode, 'product-only');
  assert.equal(membership.athleteOnboarding.targetPilotId, '');

  const enrollment = firebaseMock.getDocument('pulsecheck-pilot-enrollments/pilot-1_athlete-1');
  assert.equal(enrollment.status, 'withdrawn');
  assert.equal(enrollment.eligibleForResearchDataset, false);
  assert.equal(enrollment.withdrawalReason, 'team-removal');

  const user = firebaseMock.getDocument('users/athlete-1');
  assert.deepEqual(user.pulseCheckTeamCommercialAccess, alternateCommercialAccess);
  assert.equal(user.subscriptionType, 'Team Plan Access');
  assert.equal(user.onboardInvite, undefined);

  const audit = firebaseMock.getDocument('pulsecheck-provisioning-audit-events/remove-operation-1');
  assert.equal(audit.status, 'completed');
  assert.equal(audit.actorUserId, 'admin-1');
  assert.deepEqual(audit.withdrawnPilotIds, ['pilot-1']);
});

test('team removal is idempotent for an operation retry', async () => {
  const { handler, firebaseMock } = loadHandler();
  const firstResponse = createNextApiResponseRecorder();
  const retryResponse = createNextApiResponseRecorder();

  await handler(request(), firstResponse);
  await handler(request(), retryResponse);

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(retryResponse.statusCode, 200);
  assert.deepEqual(retryResponse.body, firstResponse.body);
  assert.equal(
    firebaseMock.writes.sets.filter((write) =>
      write.path === 'pulsecheck-provisioning-audit-events/remove-operation-1'
    ).length,
    1
  );
});

test('removing the last active team clears team-plan access without touching the account', async () => {
  const { handler, firebaseMock } = loadHandler({ includeAlternateTeam: false });
  const response = createNextApiResponseRecorder();

  await handler(request(), response);

  assert.equal(response.statusCode, 200);
  const user = firebaseMock.getDocument('users/athlete-1');
  assert.equal(user.pulseCheckTeamCommercialAccess, undefined);
  assert.equal(user.subscriptionType, 'Unsubscribed');
  assert.equal(user.email, 'athlete@example.com');
});

test('an athlete-pay alternate membership does not retain team-plan access', async () => {
  const { handler, firebaseMock } = loadHandler({ alternateTeamPlanAccess: false });
  const response = createNextApiResponseRecorder();

  await handler(request(), response);

  assert.equal(response.statusCode, 200);
  const user = firebaseMock.getDocument('users/athlete-1');
  assert.equal(user.pulseCheckTeamCommercialAccess, undefined);
  assert.equal(user.subscriptionType, 'Unsubscribed');
  assert.equal(
    firebaseMock.getDocument('pulsecheck-team-memberships/team-2_athlete-1').status,
    'active'
  );
});

test('legacy team-code access is revoked even when no commercial pointer was stored', async () => {
  const { handler, firebaseMock } = loadHandler({
    includeAlternateTeam: false,
    currentGrantViaTeamCode: true,
    includeCurrentCommercialPointer: false,
  });
  const response = createNextApiResponseRecorder();

  await handler(request(), response);

  assert.equal(response.statusCode, 200);
  const user = firebaseMock.getDocument('users/athlete-1');
  assert.equal(user.subscriptionType, 'Unsubscribed');
  assert.equal(user.onboardInvite, undefined);
});

test('active watch-list state blocks team removal before any lifecycle write', async () => {
  const { handler, firebaseMock } = loadHandler({ watchListActive: true });
  const response = createNextApiResponseRecorder();

  await handler(request(), response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'ACTIVE_WATCH_LIST');
  assert.equal(
    firebaseMock.getDocument('pulsecheck-team-memberships/team-1_athlete-1').status,
    'active'
  );
  assert.equal(
    firebaseMock.getDocument('pulsecheck-pilot-enrollments/pilot-1_athlete-1').status,
    'active'
  );
});

test('team removal requires platform-admin authorization', async () => {
  const { handler } = loadHandler({
    decoded: { uid: 'coach-1', email: 'coach@example.com' },
  });
  const response = createNextApiResponseRecorder();

  await handler(request(), response);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'PLATFORM_ADMIN_REQUIRED');
});

test('team removal rejects missing authentication and non-POST requests', async (t) => {
  const { handler } = loadHandler();

  await t.test('missing bearer token', async () => {
    const response = createNextApiResponseRecorder();
    await handler(request({ authorization: '' }), response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.code, 'AUTH_REQUIRED');
  });

  await t.test('wrong method', async () => {
    const response = createNextApiResponseRecorder();
    await handler(request({ method: 'GET' }), response);
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, 'POST');
  });
});
