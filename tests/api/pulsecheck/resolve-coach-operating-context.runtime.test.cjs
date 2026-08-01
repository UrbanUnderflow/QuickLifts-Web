const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileTypeScriptRuntime,
  createFirestoreAdminMock,
  loadCompiledModule,
  repoRoot,
} = require('../firebase-admin/_runtimeHarness.cjs');

const compiledRuntime = compileTypeScriptRuntime({
  cacheKey: 'resolve-pulsecheck-coach-operating-context',
  entryPaths: [
    path.join(
      repoRoot,
      'netlify/functions/resolve-pulsecheck-coach-operating-context.ts'
    ),
  ],
});

const request = (body = {}, authorization = 'Bearer valid-token') => ({
  httpMethod: 'POST',
  headers: authorization ? { authorization } : {},
  body: JSON.stringify(body),
});

const loadHandler = ({
  collections = {},
  userId = 'coach-1',
  decoded = {
    uid: 'coach-1',
    email: 'coach@example.com',
    name: 'Coach Taylor',
    admin: false,
  },
} = {}) => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'coach-1',
          data: {
            displayName: 'Coach Taylor',
            email: 'coach@example.com',
            role: 'coach',
            activeCoachAccount: true,
          },
        },
      ],
      coaches: [
        {
          id: 'coach-1',
          data: {
            userId: 'coach-1',
            username: 'Coach Taylor',
            email: 'coach@example.com',
            status: 'active',
          },
        },
      ],
      admin: [],
      'pulsecheck-organizations': [],
      'pulsecheck-teams': [],
      'pulsecheck-organization-memberships': [],
      'pulsecheck-team-memberships': [],
      ...collections,
    },
  });
  const verifyFirebaseUser = async (event) => {
    if (!event.headers?.authorization) {
      const error = new Error('Sign in is required to resolve the coach team.');
      error.statusCode = 401;
      throw error;
    }
    return {
      userId,
      decoded,
      app: {
        firestore: () => firebaseMock.db,
      },
    };
  };
  // macOS resolves /var through /private/var in require.cache, while the shared
  // harness retains the non-realpath temp prefix. Clear both forms so each
  // scenario receives its own Firebase/auth mocks.
  const emittedModule = compiledRuntime.emittedFiles[
    'resolve-pulsecheck-coach-operating-context.js'
  ];
  delete require.cache[emittedModule];
  delete require.cache[fs.realpathSync(emittedModule)];
  const module = loadCompiledModule({
    compiled: compiledRuntime,
    fileName: 'resolve-pulsecheck-coach-operating-context.js',
    mocks: {
      './config/firebase': firebaseMock,
      '/config/firebase': firebaseMock,
      './lib/pulsecheck-coach-services': { verifyFirebaseUser },
      '/lib/pulsecheck-coach-services': { verifyFirebaseUser },
    },
  });
  return { handler: module.handler, firebaseMock };
};

test('legacy coach bridge requires Firebase authentication', async () => {
  const { handler } = loadHandler();
  const response = await handler(request({ coachId: 'coach-1' }, ''));

  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).success, false);
});

test('legacy coach bridge is self-only', async () => {
  const { handler, firebaseMock } = loadHandler();
  const response = await handler(request({ coachId: 'coach-2' }));

  assert.equal(response.statusCode, 403);
  assert.equal(firebaseMock.writes.sets.length, 0);
});

test('inactive legacy coach cannot provision a bridge', async () => {
  const { handler, firebaseMock } = loadHandler({
    collections: {
      coaches: [
        {
          id: 'coach-1',
          data: {
            userId: 'coach-1',
            username: 'Coach Taylor',
            email: 'coach@example.com',
            status: 'suspended',
          },
        },
      ],
    },
  });
  const response = await handler(request({ coachId: 'coach-1' }));

  assert.equal(response.statusCode, 403);
  assert.match(JSON.parse(response.body).error, /active legacy coach/i);
  assert.equal(firebaseMock.writes.sets.length, 0);
});

test('non-admin legacy coach receives canonical active invite team context', async () => {
  const { handler, firebaseMock } = loadHandler();
  const response = await handler(request({ coachId: 'coach-1' }));
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.provisioned, true);
  assert.deepEqual(payload.context, {
    organizationId: 'legacy-coach-org-coach-1',
    organizationName: 'Coach Taylor Coaching',
    teamId: 'legacy-coach-team-coach-1',
    teamName: 'Coach Taylor Team',
    membershipId: 'legacy-coach-team-coach-1_coach-1',
    role: 'team-admin',
  });

  const organization = firebaseMock.getDocument(
    'pulsecheck-organizations/legacy-coach-org-coach-1'
  );
  const team = firebaseMock.getDocument(
    'pulsecheck-teams/legacy-coach-team-coach-1'
  );
  const organizationMembership = firebaseMock.getDocument(
    'pulsecheck-organization-memberships/legacy-coach-org-coach-1_coach-1'
  );
  const teamMembership = firebaseMock.getDocument(
    'pulsecheck-team-memberships/legacy-coach-team-coach-1_coach-1'
  );

  assert.equal(organization.status, 'active');
  assert.equal(organization.legacySource, 'legacy-coach-roster');
  assert.equal(organization.legacyCoachId, 'coach-1');
  assert.equal(team.status, 'active');
  assert.equal(team.organizationId, payload.context.organizationId);
  assert.equal(team.legacyCoachId, 'coach-1');
  assert.equal(organizationMembership.status, 'active');
  assert.equal(organizationMembership.userId, 'coach-1');
  assert.equal(teamMembership.status, 'active');
  assert.equal(teamMembership.userId, 'coach-1');
  assert.equal(teamMembership.teamId, payload.context.teamId);
  assert.equal(teamMembership.organizationId, payload.context.organizationId);
  assert.equal(teamMembership.role, 'team-admin');
  assert.deepEqual(teamMembership.staffCapabilities, ['admin', 'coaching']);
  assert.equal(firebaseMock.writes.sets.length, 4);
});

test('legacy coach bridge fails closed when deterministic ids belong to another coach', async () => {
  const { handler } = loadHandler({
    collections: {
      'pulsecheck-organizations': [
        {
          id: 'legacy-coach-org-coach-1',
          data: {
            displayName: 'Occupied',
            status: 'active',
            legacySource: 'legacy-coach-roster',
            legacyCoachId: 'coach-2',
          },
        },
      ],
    },
  });
  const response = await handler(request({ coachId: 'coach-1' }));

  assert.equal(response.statusCode, 409);
  assert.match(JSON.parse(response.body).error, /already occupied/i);
});

test('existing canonical staff context is returned without legacy provisioning', async () => {
  const { handler, firebaseMock } = loadHandler({
    collections: {
      'pulsecheck-organizations': [
        { id: 'org-1', data: { displayName: 'Riverside', status: 'active' } },
      ],
      'pulsecheck-teams': [
        {
          id: 'team-1',
          data: {
            organizationId: 'org-1',
            displayName: 'Riverside Track',
            status: 'active',
          },
        },
      ],
      'pulsecheck-team-memberships': [
        {
          id: 'team-1_coach-1',
          data: {
            organizationId: 'org-1',
            teamId: 'team-1',
            userId: 'coach-1',
            role: 'coach',
            staffCapabilities: ['coaching'],
            status: 'active',
          },
        },
      ],
    },
  });
  const response = await handler(request({ coachId: 'coach-1' }));
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.provisioned, false);
  assert.equal(payload.context.teamId, 'team-1');
  assert.equal(payload.context.organizationId, 'org-1');
  assert.equal(firebaseMock.writes.batchCommits, 0);
});
