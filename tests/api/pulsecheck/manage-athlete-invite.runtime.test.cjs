const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  compileTypeScriptRuntime,
  createFirestoreAdminMock,
  loadCompiledModule,
  repoRoot,
} = require('../firebase-admin/_runtimeHarness.cjs');

const compiledRuntime = compileTypeScriptRuntime({
  cacheKey: 'manage-pulsecheck-athlete-invite',
  entryPaths: [
    path.join(
      repoRoot,
      'netlify/functions/manage-pulsecheck-athlete-invite.ts'
    ),
  ],
});

const activeMembership = ({
  id = 'membership-1',
  userId = 'coach-1',
  teamId = 'team-1',
  organizationId = 'org-1',
  role = 'coach',
  capabilities = ['coaching'],
  status = 'active',
} = {}) => ({
  id,
  data: {
    userId,
    teamId,
    organizationId,
    role,
    staffCapabilities: capabilities,
    status,
  },
});

const teamRecords = [
  {
    id: 'team-1',
    data: {
      organizationId: 'org-1',
      displayName: 'Riverside Track',
    },
  },
  {
    id: 'team-2',
    data: {
      organizationId: 'org-2',
      displayName: 'Lakeside Track',
    },
  },
];

const organizationRecords = [
  { id: 'org-1', data: { displayName: 'Riverside Athletics' } },
  { id: 'org-2', data: { displayName: 'Lakeside Athletics' } },
];

const isActiveMembership = (membership) => {
  const status = String(membership?.status || '').trim().toLowerCase();
  return ![
    'inactive',
    'removed',
    'revoked',
    'declined',
    'expired',
    'pending',
    'invited',
    'suspended',
    'disabled',
  ].includes(status)
    && !membership?.revokedAt
    && !membership?.archivedAt
    && !membership?.deletedAt;
};

const resolveCapabilities = (membership) => {
  const role = String(membership?.role || '').trim().toLowerCase();
  const capabilities = new Set(
    Array.isArray(membership?.staffCapabilities)
      ? membership.staffCapabilities
      : []
  );
  if (role === 'team-admin') {
    capabilities.add('admin');
  } else if (capabilities.size === 0 && role === 'coach') {
    capabilities.add('coaching');
  } else if (capabilities.size === 0 && role === 'support-staff') {
    capabilities.add('administrative');
  }
  return capabilities;
};

const request = (body, authorization = 'Bearer valid-token') => ({
  httpMethod: 'POST',
  headers: authorization ? { authorization } : {},
  body: JSON.stringify(body),
});

const personalInvite = ({
  id = 'invite-1',
  teamId = 'team-1',
  organizationId = 'org-1',
  createdByUserId = 'original-coach',
} = {}) => ({
  id,
  data: {
    inviteType: 'team-access',
    status: 'active',
    redemptionMode: 'single-use',
    redemptionCount: 0,
    teamId,
    organizationId,
    teamMembershipRole: 'athlete',
    staffCapabilities: [],
    token: id,
    activationUrl: `https://fitwithpulse.ai/PulseCheck/team-invite/${id}`,
    recipientName: 'Jordan Lee',
    targetEmail: 'jordan@example.com',
    athleteAge: 16,
    athleteTrackOverride: 'junior',
    notifyCoachOnAccept: false,
    createdByUserId,
    createdByEmail: 'original@example.com',
    createdByName: 'Original Coach',
  },
});

const loadHandler = ({
  memberships = [activeMembership()],
  invites = [],
  teams = teamRecords,
  organizations = organizationRecords,
  userId = 'coach-1',
  decoded = {
    uid: 'coach-1',
    email: 'coach@example.com',
    name: 'Coach Taylor',
  },
  devMode = false,
} = {}) => {
  delete require.cache[
    require.resolve(
      compiledRuntime.emittedFiles['manage-pulsecheck-athlete-invite.js']
    )
  ];
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      'pulsecheck-team-memberships': memberships,
      'pulsecheck-teams': teams,
      'pulsecheck-organizations': organizations,
      'pulsecheck-invite-links': invites,
    },
  });
  const verifyFirebaseUser = async (event) => {
    if (!event.headers?.authorization) {
      const error = new Error('Sign in is required to manage athlete invites.');
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
  const firebaseConfigMock = {
    ...firebaseMock,
    isDevMode: () => devMode,
  };

  const module = loadCompiledModule({
    compiled: compiledRuntime,
    fileName: 'manage-pulsecheck-athlete-invite.js',
    mocks: {
      './config/firebase': firebaseConfigMock,
      '/config/firebase': firebaseConfigMock,
      './lib/pulsecheck-coach-services': { verifyFirebaseUser },
      '/lib/pulsecheck-coach-services': { verifyFirebaseUser },
      './lib/pulsecheck-invite-email-auth': {
        isActiveMembership,
        resolveCapabilities,
      },
      '/lib/pulsecheck-invite-email-auth': {
        isActiveMembership,
        resolveCapabilities,
      },
    },
  });

  return {
    handler: module.handler,
    firebaseMock,
  };
};

test('athlete invite mutation requires Firebase authentication', async () => {
  const { handler } = loadHandler();
  const response = await handler(request({
    action: 'create',
    teamId: 'team-1',
    mode: 'general',
  }, ''));

  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).success, false);
});

test('athlete invite mutation rejects a selected team outside active membership', async () => {
  const { handler } = loadHandler();
  const response = await handler(request({
    action: 'create',
    teamId: 'team-2',
    mode: 'general',
  }));

  assert.equal(response.statusCode, 403);
  assert.match(JSON.parse(response.body).error, /selected team/i);
});

test('athlete invite mutation fails closed for inactive team or organization state', async (t) => {
  await t.test('inactive team', async () => {
    const { handler } = loadHandler({
      teams: teamRecords.map((team) =>
        team.id === 'team-1'
          ? { ...team, data: { ...team.data, status: 'suspended' } }
          : team
      ),
    });
    const response = await handler(request({
      action: 'create',
      teamId: 'team-1',
      mode: 'general',
    }));

    assert.equal(response.statusCode, 403);
    assert.match(JSON.parse(response.body).error, /team is inactive/i);
  });

  await t.test('inactive organization', async () => {
    const { handler } = loadHandler({
      organizations: organizationRecords.map((organization) =>
        organization.id === 'org-1'
          ? {
              ...organization,
              data: { ...organization.data, status: 'revoked' },
            }
          : organization
      ),
    });
    const response = await handler(request({
      action: 'create',
      teamId: 'team-1',
      mode: 'general',
    }));

    assert.equal(response.statusCode, 403);
    assert.match(JSON.parse(response.body).error, /organization is inactive/i);
  });

  await t.test('archived team', async () => {
    const { handler } = loadHandler({
      teams: teamRecords.map((team) =>
        team.id === 'team-1'
          ? { ...team, data: { ...team.data, archivedAt: { seconds: 1 } } }
          : team
      ),
    });
    const response = await handler(request({
      action: 'create',
      teamId: 'team-1',
      mode: 'general',
    }));

    assert.equal(response.statusCode, 403);
    assert.match(JSON.parse(response.body).error, /team is inactive/i);
  });

  await t.test('deleted organization', async () => {
    const { handler } = loadHandler({
      organizations: organizationRecords.map((organization) =>
        organization.id === 'org-1'
          ? {
              ...organization,
              data: { ...organization.data, deletedAt: { seconds: 1 } },
            }
          : organization
      ),
    });
    const response = await handler(request({
      action: 'create',
      teamId: 'team-1',
      mode: 'general',
    }));

    assert.equal(response.statusCode, 403);
    assert.match(JSON.parse(response.body).error, /organization is inactive/i);
  });
});

test('athlete invite mutation requires exact membership organization scope', async () => {
  const { handler } = loadHandler({
    memberships: [
      activeMembership({
        organizationId: 'org-2',
      }),
    ],
  });
  const response = await handler(request({
    action: 'create',
    teamId: 'team-1',
    mode: 'general',
  }));

  assert.equal(response.statusCode, 403);
  assert.match(JSON.parse(response.body).error, /access record is inconsistent/i);
});

test('athletic trainer capability cannot create or edit athlete invites', async () => {
  const { handler } = loadHandler({
    memberships: [
      activeMembership({
        role: 'performance-staff',
        capabilities: ['athletic_trainer'],
      }),
    ],
  });
  const response = await handler(request({
    action: 'create',
    teamId: 'team-1',
    mode: 'single-use',
    recipientName: 'Jordan Lee',
    email: 'jordan@example.com',
  }));

  assert.equal(response.statusCode, 403);
  assert.match(JSON.parse(response.body).error, /coach or manager/i);
});

test('coach creates a server-owned team athlete invite', async () => {
  const { handler, firebaseMock } = loadHandler();
  const response = await handler(request({
    action: 'create',
    teamId: 'team-1',
    mode: 'single-use',
    recipientName: ' Jordan Lee ',
    email: 'JORDAN@EXAMPLE.COM',
    athleteAge: 16,
    athleteTrack: 'junior',
    notifyCoachOnAccept: true,
    senderName: 'Coach Taylor',
    createdByUserId: 'forged-user',
    organizationId: 'forged-org',
  }));

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.success, true);
  assert.equal(body.invite.recipientName, 'Jordan Lee');
  assert.equal(body.invite.email, 'jordan@example.com');
  assert.equal(body.invite.athleteTrack, 'junior');
  assert.match(body.invite.activationUrl, /inviteToken=/);

  const stored = firebaseMock.getDocument(
    `pulsecheck-invite-links/${body.invite.id}`
  );
  assert.equal(stored.teamId, 'team-1');
  assert.equal(stored.organizationId, 'org-1');
  assert.equal(stored.createdByUserId, 'coach-1');
  assert.equal(stored.createdByEmail, 'coach@example.com');
  assert.equal(stored.issuedByMembershipId, 'membership-1');
  assert.equal(stored.teamMembershipRole, 'athlete');
});

test('coach-priced athlete offer uses the account-first web checkout URL', async () => {
  const { handler, firebaseMock } = loadHandler({
    devMode: true,
    teams: teamRecords.map((team) =>
      team.id === 'team-1'
        ? {
            ...team,
            data: {
              ...team.data,
              commercialConfig: {
                commercialModel: 'athlete-pay',
                teamPlanStatus: 'inactive',
                athleteAppSubscriptionEnabled: true,
                athleteAppSubscriptionMonthlyPriceCents: 1299,
              },
            },
          }
        : team
    ),
  });
  const response = await handler(request({
    action: 'create',
    teamId: 'team-1',
    mode: 'single-use',
    recipientName: 'Jordan Lee',
    email: 'jordan@example.com',
  }));

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.match(
    body.invite.activationUrl,
    /\/PulseCheck\/athlete-offer\/[a-f0-9-]+\?devFirebase=1$/
  );
  const stored = firebaseMock.getDocument(
    `pulsecheck-invite-links/${body.invite.id}`
  );
  assert.equal(stored.activationUrl, body.invite.activationUrl);
});

test('repeated reusable invite requests return one stable team link', async () => {
  const { handler, firebaseMock } = loadHandler();
  const createRequest = request({
    action: 'create',
    teamId: 'team-1',
    mode: 'general',
  });

  const firstResponse = await handler(createRequest);
  const secondResponse = await handler(createRequest);
  const thirdResponse = await handler(createRequest);

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(thirdResponse.statusCode, 200);

  const firstInvite = JSON.parse(firstResponse.body).invite;
  const secondInvite = JSON.parse(secondResponse.body).invite;
  const thirdInvite = JSON.parse(thirdResponse.body).invite;

  assert.equal(secondInvite.id, firstInvite.id);
  assert.equal(thirdInvite.id, firstInvite.id);
  assert.equal(secondInvite.activationUrl, firstInvite.activationUrl);
  assert.equal(thirdInvite.activationUrl, firstInvite.activationUrl);
  const generalInvites = await firebaseMock.db
    .collection('pulsecheck-invite-links')
    .where('redemptionMode', '==', 'general')
    .get();
  assert.equal(
    generalInvites.docs.length,
    1
  );
});

test('enabling coach pricing upgrades a reusable legacy invite to checkout', async () => {
  const legacyInvite = personalInvite({ id: 'legacy-general-invite' });
  legacyInvite.data.redemptionMode = 'general';
  legacyInvite.data.recipientName = '';
  legacyInvite.data.targetEmail = '';
  legacyInvite.data.athleteAge = null;
  legacyInvite.data.athleteTrackOverride = null;
  legacyInvite.data.activationUrl =
    'https://pulsecheckapp.onelink.me/uT14?inviteToken=legacy-general-invite';

  const { handler, firebaseMock } = loadHandler({
    invites: [legacyInvite],
    teams: teamRecords.map((team) =>
      team.id === 'team-1'
        ? {
            ...team,
            data: {
              ...team.data,
              commercialConfig: {
                commercialModel: 'athlete-pay',
                teamPlanStatus: 'inactive',
                athleteAppSubscriptionEnabled: true,
                athleteAppSubscriptionMonthlyPriceCents: 1299,
              },
            },
          }
        : team
    ),
  });
  const response = await handler(request({
    action: 'create',
    teamId: 'team-1',
    mode: 'general',
  }));

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.invite.id, 'legacy-general-invite');
  assert.match(body.invite.activationUrl, /\/PulseCheck\/athlete-offer\//);
  assert.equal(
    firebaseMock.getDocument(
      'pulsecheck-invite-links/legacy-general-invite'
    ).activationUrl,
    body.invite.activationUrl
  );
});

test('active sponsored team plan keeps the direct app invite bypass', async () => {
  const { handler } = loadHandler({
    teams: teamRecords.map((team) =>
      team.id === 'team-1'
        ? {
            ...team,
            data: {
              ...team.data,
              commercialConfig: {
                commercialModel: 'team-plan',
                teamPlanStatus: 'active',
                athleteAppSubscriptionEnabled: true,
                athleteAppSubscriptionMonthlyPriceCents: 1299,
              },
            },
          }
        : team
    ),
  });
  const response = await handler(request({
    action: 'create',
    teamId: 'team-1',
    mode: 'general',
  }));

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.match(body.invite.activationUrl, /pulsecheckapp\.onelink\.me/);
  assert.doesNotMatch(body.invite.activationUrl, /\/athlete-offer\//);
});

test('manager edits pending personal fields while ownership stays immutable', async () => {
  const { handler, firebaseMock } = loadHandler({
    memberships: [
      activeMembership({
        role: 'support-staff',
        capabilities: ['administrative'],
      }),
    ],
    invites: [personalInvite()],
  });
  const response = await handler(request({
    action: 'update',
    teamId: 'team-1',
    inviteId: 'invite-1',
    recipientName: 'Jordan Smith',
    email: 'jordan.smith@example.com',
    athleteAge: 17,
    athleteTrack: 'pro',
    notifyCoachOnAccept: true,
    createdByUserId: 'manager-tries-to-replace-owner',
  }));

  assert.equal(response.statusCode, 200);
  const stored = firebaseMock.getDocument(
    'pulsecheck-invite-links/invite-1'
  );
  assert.equal(stored.recipientName, 'Jordan Smith');
  assert.equal(stored.targetEmail, 'jordan.smith@example.com');
  assert.equal(stored.athleteAge, 17);
  assert.equal(stored.athleteTrackOverride, 'pro');
  assert.equal(stored.notifyCoachOnAccept, true);
  assert.equal(stored.createdByUserId, 'original-coach');
  assert.equal(stored.createdByEmail, 'original@example.com');
  assert.equal(stored.createdByName, 'Original Coach');
  assert.equal(stored.updatedByUserId, 'coach-1');
});

test('revoke stays admin-only and is scoped to the selected team', async () => {
  const invite = personalInvite();
  const coachFixture = loadHandler({ invites: [invite] });
  const coachResponse = await coachFixture.handler(request({
    action: 'revoke',
    teamId: 'team-1',
    inviteId: 'invite-1',
  }));
  assert.equal(coachResponse.statusCode, 403);
  assert.equal(
    coachFixture.firebaseMock.getDocument(
      'pulsecheck-invite-links/invite-1'
    ).status,
    'active'
  );

  const adminFixture = loadHandler({
    memberships: [
      activeMembership({
        role: 'team-admin',
        capabilities: ['admin'],
      }),
    ],
    invites: [invite],
  });
  const adminResponse = await adminFixture.handler(request({
    action: 'revoke',
    teamId: 'team-1',
    inviteId: 'invite-1',
  }));

  assert.equal(adminResponse.statusCode, 200);
  const stored = adminFixture.firebaseMock.getDocument(
    'pulsecheck-invite-links/invite-1'
  );
  assert.equal(stored.status, 'revoked');
  assert.equal(stored.revokedByUserId, 'coach-1');
  assert.equal(stored.createdByUserId, 'original-coach');
});
