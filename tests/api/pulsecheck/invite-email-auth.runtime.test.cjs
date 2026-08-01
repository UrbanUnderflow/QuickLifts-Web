const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const configPath = path.join(
  repoRoot,
  'netlify/functions/config/firebase.js'
);
const coachServicesPath = path.join(
  repoRoot,
  'netlify/functions/lib/pulsecheck-coach-services.js'
);
const inviteAuthPath = path.join(
  repoRoot,
  'netlify/functions/lib/pulsecheck-invite-email-auth.js'
);

const snapshot = (id, value) => ({
  id,
  exists: Boolean(value),
  data: () => value,
});

const loadInviteAuth = ({
  decoded = { uid: 'coach-1', email: 'coach@example.com' },
  invite = {
    inviteType: 'team-access',
    status: 'active',
    teamId: 'team-1',
    organizationId: 'org-1',
    teamMembershipRole: 'athlete',
    targetEmail: 'athlete@example.com',
    activationUrl:
      'https://pulsecheckapp.onelink.me/uT14?inviteToken=invite-1',
  },
  memberships = [{
    userId: 'coach-1',
    teamId: 'team-1',
    organizationId: 'org-1',
    role: 'coach',
    status: 'active',
    staffCapabilities: ['coaching'],
  }],
  isPlatformAdmin = false,
  team = { organizationId: 'org-1', status: 'active' },
  organization = { status: 'active' },
} = {}) => {
  for (const modulePath of [
    configPath,
    coachServicesPath,
    inviteAuthPath,
  ]) {
    delete require.cache[modulePath];
  }

  const database = {
    collection(collectionName) {
      return {
        doc(documentId) {
          return {
            async get() {
              if (collectionName === 'pulsecheck-invite-links') {
                return snapshot(documentId, documentId === 'invite-1' ? invite : null);
              }
              if (collectionName === 'admin') {
                return snapshot(
                  documentId,
                  isPlatformAdmin ? { email: documentId } : null
                );
              }
              if (collectionName === 'pulsecheck-teams') {
                return snapshot(documentId, documentId === 'team-1' ? team : null);
              }
              if (collectionName === 'pulsecheck-organizations') {
                return snapshot(documentId, documentId === 'org-1' ? organization : null);
              }
              return snapshot(documentId, null);
            },
          };
        },
        where(field, operator, value) {
          assert.equal(field, 'userId');
          assert.equal(operator, '==');
          return {
            async get() {
              const rows = collectionName === 'pulsecheck-team-memberships'
                ? memberships.filter((membership) => membership.userId === value)
                : [];
              return {
                docs: rows.map((membership) =>
                  snapshot(`${membership.teamId}_${membership.userId}`, membership)
                ),
              };
            },
          };
        },
      };
    },
  };

  const app = {
    auth: () => ({
      verifyIdToken: async (token) => {
        assert.equal(token, 'valid-token');
        return decoded;
      },
    }),
    firestore: () => database,
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      admin: {},
      db: database,
      getFirebaseAdminApp: () => app,
    },
  };

  return require(inviteAuthPath);
};

const event = {
  headers: { authorization: 'Bearer valid-token' },
};

test('invite token parser supports OneLink and direct team-invite URLs', () => {
  const { inviteTokenFromUrl } = loadInviteAuth();

  assert.equal(
    inviteTokenFromUrl(
      'https://pulsecheckapp.onelink.me/uT14?inviteToken=invite-1'
    ),
    'invite-1'
  );
  assert.equal(
    inviteTokenFromUrl(
      'https://fitwithpulse.ai/PulseCheck/team-invite/invite-1'
    ),
    'invite-1'
  );
  assert.equal(
    inviteTokenFromUrl(
      'https://fitwithpulse.ai/PulseCheck/athlete-offer/invite-1'
    ),
    'invite-1'
  );
});

test('active coach can email the trusted web-only athlete offer URL', async () => {
  const { authorizePulseCheckInviteEmail } = loadInviteAuth();

  const result = await authorizePulseCheckInviteEmail(event, {
    activationUrl:
      'https://fitwithpulse.ai/PulseCheck/athlete-offer/invite-1',
    toEmail: 'athlete@example.com',
    expectedRecipientRole: 'athlete',
    allowedCapabilities: ['coaching', 'administrative'],
  });

  assert.equal(result.inviteId, 'invite-1');
});

test('athlete offer URL rejects an untrusted host', async () => {
  const { authorizePulseCheckInviteEmail } = loadInviteAuth();

  await assert.rejects(
    authorizePulseCheckInviteEmail(event, {
      activationUrl:
        'https://example.com/PulseCheck/athlete-offer/invite-1',
      toEmail: 'athlete@example.com',
      expectedRecipientRole: 'athlete',
      allowedCapabilities: ['coaching', 'administrative'],
    }),
    (error) => error.statusCode === 403
  );
});

test('invite email authorization requires Firebase sign-in', async () => {
  const { authorizePulseCheckInviteEmail } = loadInviteAuth();

  await assert.rejects(
    authorizePulseCheckInviteEmail(
      { headers: {} },
      {
        activationUrl:
          'https://pulsecheckapp.onelink.me/uT14?inviteToken=invite-1',
        toEmail: 'athlete@example.com',
        expectedRecipientRole: 'athlete',
        allowedCapabilities: ['coaching', 'administrative'],
      }
    ),
    (error) => error.statusCode === 401
  );
});

test('active coach can send an email for a matching athlete invite', async () => {
  const { authorizePulseCheckInviteEmail } = loadInviteAuth();

  const result = await authorizePulseCheckInviteEmail(event, {
    activationUrl:
      'https://pulsecheckapp.onelink.me/uT14?inviteToken=invite-1',
    toEmail: 'athlete@example.com',
    expectedRecipientRole: 'athlete',
    allowedCapabilities: ['coaching', 'administrative'],
  });

  assert.equal(result.userId, 'coach-1');
  assert.equal(result.teamId, 'team-1');
  assert.equal(result.inviteId, 'invite-1');
});

test('coach capability cannot send a staff invite reserved for team admins', async () => {
  const staffInvite = {
    inviteType: 'team-access',
    status: 'active',
    teamId: 'team-1',
    organizationId: 'org-1',
    teamMembershipRole: 'coach',
    targetEmail: 'staff@example.com',
    activationUrl:
      'https://pulsecheckapp.onelink.me/uT14?inviteToken=invite-1',
  };
  const { authorizePulseCheckInviteEmail } = loadInviteAuth({
    invite: staffInvite,
  });

  await assert.rejects(
    authorizePulseCheckInviteEmail(event, {
      activationUrl: staffInvite.activationUrl,
      toEmail: 'staff@example.com',
      expectedRecipientRole: 'staff',
      allowedCapabilities: ['admin'],
    }),
    (error) => error.statusCode === 403
  );
});

test('team admin can send a verified staff invite', async () => {
  const staffInvite = {
    inviteType: 'team-access',
    status: 'active',
    teamId: 'team-1',
    organizationId: 'org-1',
    teamMembershipRole: 'coach',
    targetEmail: 'staff@example.com',
    activationUrl:
      'https://pulsecheckapp.onelink.me/uT14?inviteToken=invite-1',
  };
  const { authorizePulseCheckInviteEmail } = loadInviteAuth({
    invite: staffInvite,
    memberships: [{
      userId: 'coach-1',
      teamId: 'team-1',
      organizationId: 'org-1',
      role: 'team-admin',
      status: 'active',
      staffCapabilities: ['admin'],
    }],
  });

  const result = await authorizePulseCheckInviteEmail(event, {
    activationUrl: staffInvite.activationUrl,
    toEmail: 'staff@example.com',
    expectedRecipientRole: 'staff',
    allowedCapabilities: ['admin'],
  });

  assert.equal(result.teamId, 'team-1');
});

test('recipient or link tampering is rejected before email delivery', async () => {
  const { authorizePulseCheckInviteEmail } = loadInviteAuth();

  await assert.rejects(
    authorizePulseCheckInviteEmail(event, {
      activationUrl:
        'https://pulsecheckapp.onelink.me/uT14?inviteToken=invite-1',
      toEmail: 'another@example.com',
      expectedRecipientRole: 'athlete',
      allowedCapabilities: ['coaching', 'administrative'],
    }),
    (error) => error.statusCode === 403
  );
});

test('unknown membership status and wrong organization fail closed', async () => {
  const unknownStatus = loadInviteAuth({
    memberships: [{
      userId: 'coach-1',
      teamId: 'team-1',
      organizationId: 'org-1',
      role: 'coach',
      status: 'mystery-enabled',
      staffCapabilities: ['coaching'],
    }],
  });
  await assert.rejects(
    unknownStatus.authorizePulseCheckInviteEmail(event, {
      activationUrl:
        'https://pulsecheckapp.onelink.me/uT14?inviteToken=invite-1',
      toEmail: 'athlete@example.com',
      expectedRecipientRole: 'athlete',
      allowedCapabilities: ['coaching'],
    }),
    (error) => error.statusCode === 403
  );

  const wrongOrganization = loadInviteAuth({
    memberships: [{
      userId: 'coach-1',
      teamId: 'team-1',
      organizationId: 'org-other',
      role: 'coach',
      status: 'active',
      staffCapabilities: ['coaching'],
    }],
  });
  await assert.rejects(
    wrongOrganization.authorizePulseCheckInviteEmail(event, {
      activationUrl:
        'https://pulsecheckapp.onelink.me/uT14?inviteToken=invite-1',
      toEmail: 'athlete@example.com',
      expectedRecipientRole: 'athlete',
      allowedCapabilities: ['coaching'],
    }),
    (error) => error.statusCode === 403
  );
});

test('platform admin may send a verified invite without team membership', async () => {
  const { authorizePulseCheckInviteEmail } = loadInviteAuth({
    memberships: [],
    isPlatformAdmin: true,
  });

  const result = await authorizePulseCheckInviteEmail(event, {
    activationUrl:
      'https://pulsecheckapp.onelink.me/uT14?inviteToken=invite-1',
    toEmail: 'athlete@example.com',
    expectedRecipientRole: 'athlete',
    allowedCapabilities: ['coaching', 'administrative'],
  });

  assert.equal(result.userId, 'coach-1');
});
