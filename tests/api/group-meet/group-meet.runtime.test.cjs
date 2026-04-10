const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const {
  createApiResponseRecorder,
  createGuestCalendarConnectStartHandlerRuntime,
  createPublicFlexHandlerRuntime,
  createPublicInviteHandlerRuntime,
  loadGuestGoogleCalendarRuntime,
  loadGoogleCalendarRuntime,
  loadGroupMeetRuntime,
  makeTimestamp,
} = require('./_runtimeHarness.cjs');

const CALENDAR_ENV_KEYS = [
  'GOOGLE_CALENDAR_CLIENT_ID',
  'GOOGLE_CALENDAR_CLIENT_SECRET',
  'GOOGLE_CALENDAR_REFRESH_TOKEN',
  'GOOGLE_CALENDAR_REDIRECT_URI',
  'GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON',
  'GROUP_MEET_GOOGLE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_CALENDAR_SERVICE_ACCOUNT_SECRET_NAME',
  'GROUP_MEET_GOOGLE_SERVICE_ACCOUNT_SECRET_NAME',
  'GOOGLE_CALENDAR_CLIENT_EMAIL',
  'GOOGLE_CALENDAR_PRIVATE_KEY',
  'GOOGLE_CALENDAR_DELEGATED_USER_EMAIL',
  'GOOGLE_CALENDAR_ORGANIZER_EMAIL',
  'GOOGLE_CALENDAR_ID',
];

const GUEST_CALENDAR_ENV_KEYS = [
  'GOOGLE_GUEST_CALENDAR_OAUTH_JSON',
  'GOOGLE_GUEST_CALENDAR_OAUTH_SECRET_NAME',
  'GROUP_MEET_GUEST_GOOGLE_CALENDAR_OAUTH_SECRET_NAME',
  'GOOGLE_GUEST_CALENDAR_CLIENT_ID',
  'GOOGLE_GUEST_CALENDAR_CLIENT_SECRET',
  'GOOGLE_GUEST_CALENDAR_REDIRECT_URI',
  'GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY',
  'GOOGLE_GUEST_CALENDAR_ENCRYPTION_SECRET_NAME',
  'SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET',
  'FIREBASE_SECRET_KEY',
  'NODE_ENV',
];

function withIsolatedCalendarEnv(envPatch, run) {
  const previous = new Map(CALENDAR_ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of CALENDAR_ENV_KEYS) {
    delete process.env[key];
  }

  Object.assign(process.env, envPatch);

  try {
    return run();
  } finally {
    for (const key of CALENDAR_ENV_KEYS) {
      const priorValue = previous.get(key);
      if (priorValue == null) {
        delete process.env[key];
      } else {
        process.env[key] = priorValue;
      }
    }
  }
}

function withIsolatedGuestCalendarEnv(envPatch, run) {
  const previous = new Map(GUEST_CALENDAR_ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of GUEST_CALENDAR_ENV_KEYS) {
    delete process.env[key];
  }

  Object.assign(process.env, envPatch);

  try {
    return run();
  } finally {
    for (const key of GUEST_CALENDAR_ENV_KEYS) {
      const priorValue = previous.get(key);
      if (priorValue == null) {
        delete process.env[key];
      } else {
        process.env[key] = priorValue;
      }
    }
  }
}

test('computeGroupMeetAnalysis ranks a full-match window ahead of partial overlap', { concurrency: false }, () => {
  const { computeGroupMeetAnalysis } = loadGroupMeetRuntime();

  const invites = [
    {
      token: 'a',
      name: 'Avery',
      email: 'avery@example.com',
      shareUrl: 'https://example.com/a',
      emailStatus: 'sent',
      emailError: null,
      respondedAt: '2026-03-20T10:00:00.000Z',
      availabilityCount: 1,
      availabilityEntries: [{ date: '2026-04-10', startMinutes: 540, endMinutes: 720 }],
    },
    {
      token: 'b',
      name: 'Blake',
      email: 'blake@example.com',
      shareUrl: 'https://example.com/b',
      emailStatus: 'sent',
      emailError: null,
      respondedAt: '2026-03-20T10:05:00.000Z',
      availabilityCount: 1,
      availabilityEntries: [{ date: '2026-04-10', startMinutes: 600, endMinutes: 780 }],
    },
    {
      token: 'c',
      name: 'Casey',
      email: 'casey@example.com',
      shareUrl: 'https://example.com/c',
      emailStatus: 'sent',
      emailError: null,
      respondedAt: '2026-03-20T10:10:00.000Z',
      availabilityCount: 1,
      availabilityEntries: [{ date: '2026-04-10', startMinutes: 615, endMinutes: 690 }],
    },
  ];

  const analysis = computeGroupMeetAnalysis(invites, 60);

  assert.equal(analysis.totalParticipants, 3);
  assert.equal(analysis.respondedParticipantCount, 3);
  assert.equal(analysis.pendingParticipantCount, 0);
  assert.equal(analysis.fullMatchCandidates.length > 0, true);
  assert.equal(analysis.bestCandidates.length > 0, true);

  const [topCandidate] = analysis.bestCandidates;
  assert.equal(topCandidate.date, '2026-04-10');
  assert.equal(topCandidate.allAvailable, true);
  assert.equal(topCandidate.participantCount, 3);
  assert.equal(topCandidate.earliestStartMinutes, 615);
  assert.equal(topCandidate.latestStartMinutes, 630);
  assert.deepEqual(topCandidate.participantNames, ['Avery', 'Blake', 'Casey']);

  const [topDate] = analysis.dateSummaries;
  assert.equal(topDate.date, '2026-04-10');
  assert.equal(topDate.availableParticipantCount, 3);
});

test('getGoogleCalendarSetupStatus reports Secret Manager-backed service-account readiness', { concurrency: false }, async () => {
  await withIsolatedCalendarEnv(
    {
      GOOGLE_CALENDAR_SERVICE_ACCOUNT_SECRET_NAME: 'GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON',
      GOOGLE_CALENDAR_DELEGATED_USER_EMAIL: 'tre@fitwithpulse.ai',
      GOOGLE_CALENDAR_ORGANIZER_EMAIL: 'tre@fitwithpulse.ai',
      GOOGLE_CALENDAR_ID: 'primary',
    },
    async () => {
      const { getGoogleCalendarSetupStatus } = loadGoogleCalendarRuntime({
        secretManagerMock: async (secretName) => {
          assert.equal(secretName, 'GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON');
          return JSON.stringify({
            client_email: 'group-meet-pulse@quicklifts-dd3f1.iam.gserviceaccount.com',
            private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
          });
        },
      });

      const setup = await getGoogleCalendarSetupStatus();

      assert.equal(setup.ready, true);
      assert.equal(setup.source, 'secret_manager');
      assert.equal(setup.secretName, 'GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON');
      assert.equal(setup.delegatedUserEmail, 'tre@fitwithpulse.ai');
      assert.match(setup.message, /Secret Manager secret GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON/);
    }
  );
});

test('getGoogleCalendarSetupStatus blocks scheduling when delegated mailbox is missing', { concurrency: false }, async () => {
  await withIsolatedCalendarEnv(
    {
      GOOGLE_CALENDAR_SERVICE_ACCOUNT_SECRET_NAME: 'GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON',
      GOOGLE_CALENDAR_ID: 'primary',
    },
    async () => {
      const { getGoogleCalendarSetupStatus } = loadGoogleCalendarRuntime({
        secretManagerMock: async () =>
          JSON.stringify({
            client_email: 'group-meet-pulse@quicklifts-dd3f1.iam.gserviceaccount.com',
            private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
          }),
      });

      const setup = await getGoogleCalendarSetupStatus();

      assert.equal(setup.ready, false);
      assert.equal(setup.source, 'secret_manager');
      assert.match(setup.message, /GOOGLE_CALENDAR_DELEGATED_USER_EMAIL is missing/);
    }
  );
});

test('convertLocalDateMinutesToUtcIso respects timezone offsets and DST boundaries', { concurrency: false }, () => {
  const { convertLocalDateMinutesToUtcIso } = loadGoogleCalendarRuntime();

  assert.equal(
    convertLocalDateMinutesToUtcIso('2026-01-15', 9 * 60, 'America/New_York'),
    '2026-01-15T14:00:00.000Z'
  );

  assert.equal(
    convertLocalDateMinutesToUtcIso('2026-04-15', 9 * 60, 'America/New_York'),
    '2026-04-15T13:00:00.000Z'
  );

  assert.equal(
    convertLocalDateMinutesToUtcIso('2026-11-02', 9 * 60 + 30, 'America/Los_Angeles'),
    '2026-11-02T17:30:00.000Z'
  );
});

test('public guest invite endpoint resolves an invite by stored token and honors localhost dev firebase', { concurrency: false }, async () => {
  const { handler, state } = createPublicInviteHandlerRuntime({
    requestData: {
      title: 'Pulse Intelligence Labs Advisory Board Meeting',
      targetMonth: '2026-04',
      deadlineAt: makeTimestamp('2026-04-08T21:00:00.000Z'),
      timezone: 'America/New_York',
      meetingDurationMinutes: 60,
      status: 'draft',
    },
    inviteDocs: [
      {
        id: 'host-token',
        data: {
          token: 'host-token',
          name: 'Tremaine Grant',
          email: 'tre@fitwithpulse.ai',
          imageUrl: 'https://images.example.com/tre.png',
          participantType: 'host',
          shareUrl: 'https://fitwithpulse.ai/group-meet/host-token',
          availabilityEntries: [{ date: '2026-04-01', startMinutes: 540, endMinutes: 600 }],
          responseSubmittedAt: makeTimestamp('2026-03-31T12:00:00.000Z'),
          hasResponse: true,
        },
      },
      {
        id: 'guest-two-token',
        data: {
          token: 'guest-two-token',
          name: 'Valerie Alexander',
          email: 'valerie@speakhappiness.com',
          imageUrl: 'https://images.example.com/valerie.png',
          participantType: 'participant',
          shareUrl: 'https://fitwithpulse.ai/group-meet/guest-two-token',
          availabilityEntries: [{ date: '2026-04-01', startMinutes: 780, endMinutes: 840 }],
          responseSubmittedAt: makeTimestamp('2026-03-31T12:15:00.000Z'),
          hasResponse: true,
        },
      },
      {
        id: '40423acc545435231ec30c716f2f289d20c3609c67db7540',
        data: {
          token: '40423acc545435231ec30c716f2f289d20c3609c67db7540',
          name: 'Bobby Weke',
          email: 'bobby@fitwithpulse.ai',
          imageUrl: 'https://images.example.com/bobby.png',
          participantType: 'participant',
          shareUrl:
            'https://fitwithpulse.ai/group-meet/40423acc545435231ec30c716f2f289d20c3609c67db7540',
          availabilityEntries: [],
          responseSubmittedAt: null,
          hasResponse: false,
        },
      },
    ],
  });

  const req = {
    method: 'GET',
    query: { token: '40423acc545435231ec30c716f2f289d20c3609c67db7540' },
    headers: { host: 'localhost:8888' },
  };
  const res = createApiResponseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(
    res.payload.invite.shareUrl,
    'https://fitwithpulse.ai/group-meet/40423acc545435231ec30c716f2f289d20c3609c67db7540'
  );
  assert.equal(res.payload.invite.request.title, 'Pulse Intelligence Labs Advisory Board Meeting');
  assert.equal(res.payload.invite.peerAvailability.length, 2);
  assert.deepEqual(
    res.payload.invite.peerAvailability.map((participant) => participant.name),
    ['Tremaine Grant', 'Valerie Alexander']
  );
  assert.deepEqual(
    res.payload.invite.peerAvailability[0].availabilityEntries,
    [{ date: '2026-04-01', startMinutes: 540, endMinutes: 600 }]
  );
  assert.equal(state.firebaseAppSelections[0], true);
});

test('public guest invite save triggers host notification context after a participant responds', { concurrency: false }, async () => {
  const { handler, state } = createPublicInviteHandlerRuntime({
    requestData: {
      title: 'Pulse Intelligence Labs Advisory Board Meeting',
      targetMonth: '2026-04',
      deadlineAt: makeTimestamp('2026-04-08T21:00:00.000Z'),
      timezone: 'America/New_York',
      meetingDurationMinutes: 60,
      status: 'collecting',
      participantCount: 3,
    },
    inviteDocs: [
      {
        id: 'host-token',
        data: {
          token: 'host-token',
          name: 'Tremaine Grant',
          email: 'tre@fitwithpulse.ai',
          participantType: 'host',
          shareUrl: 'https://fitwithpulse.ai/group-meet/host-token',
          availabilityEntries: [{ date: '2026-04-01', startMinutes: 540, endMinutes: 600 }],
          responseSubmittedAt: makeTimestamp('2026-03-31T12:00:00.000Z'),
          hasResponse: true,
        },
      },
      {
        id: 'guest-token',
        data: {
          token: 'guest-token',
          name: 'Bobby Weke',
          email: 'bobby@fitwithpulse.ai',
          participantType: 'participant',
          shareUrl: 'https://fitwithpulse.ai/group-meet/guest-token',
          availabilityEntries: [],
          responseSubmittedAt: null,
          hasResponse: false,
        },
      },
      {
        id: 'guest-two-token',
        data: {
          token: 'guest-two-token',
          name: 'Valerie Alexander',
          email: 'valerie@speakhappiness.com',
          participantType: 'participant',
          shareUrl: 'https://fitwithpulse.ai/group-meet/guest-two-token',
          availabilityEntries: [],
          responseSubmittedAt: null,
          hasResponse: false,
        },
      },
    ],
  });

  const req = {
    method: 'POST',
    query: { token: 'guest-token' },
    headers: { host: 'fitwithpulse.ai' },
    body: {
      availabilityEntries: [{ date: '2026-04-02', startMinutes: 600, endMinutes: 660 }],
    },
  };
  const res = createApiResponseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(state.requestData.responseCount, 2);
  assert.equal(state.hostNotificationCalls.length, 1);
  assert.equal(state.hostNotificationCalls[0].responseAction, 'added');
  assert.equal(state.hostNotificationCalls[0].responderToken, 'guest-token');
  assert.equal(state.hostNotificationCalls[0].baseUrl, 'https://fitwithpulse.ai');
});

test('public guest invite remains open for saves after the deadline until the request is explicitly closed', { concurrency: false }, async () => {
  const { handler, state } = createPublicInviteHandlerRuntime({
    requestData: {
      title: 'Pulse Intelligence Labs Advisory Board Meeting',
      targetMonth: '2026-04',
      deadlineAt: makeTimestamp('2026-04-01T13:00:00.000Z'),
      timezone: 'America/New_York',
      meetingDurationMinutes: 60,
      status: 'collecting',
      participantCount: 2,
    },
    inviteDocs: [
      {
        id: 'host-token',
        data: {
          token: 'host-token',
          name: 'Tremaine Grant',
          email: 'tre@fitwithpulse.ai',
          participantType: 'host',
          shareUrl: 'https://fitwithpulse.ai/group-meet/host-token',
          availabilityEntries: [{ date: '2026-04-01', startMinutes: 540, endMinutes: 600 }],
          responseSubmittedAt: makeTimestamp('2026-03-31T12:00:00.000Z'),
          hasResponse: true,
        },
      },
      {
        id: 'guest-token',
        data: {
          token: 'guest-token',
          name: 'Bobby Weke',
          email: 'bobby@fitwithpulse.ai',
          participantType: 'participant',
          shareUrl: 'https://fitwithpulse.ai/group-meet/guest-token',
          availabilityEntries: [],
          responseSubmittedAt: null,
          hasResponse: false,
        },
      },
    ],
  });

  const res = createApiResponseRecorder();

  await handler(
    {
      method: 'POST',
      query: { token: 'guest-token' },
      headers: { host: 'fitwithpulse.ai' },
      body: {
        availabilityEntries: [{ date: '2026-04-02', startMinutes: 600, endMinutes: 660 }],
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.invite.request.status, 'collecting');
  assert.deepEqual(res.payload.invite.availabilityEntries, [
    { date: '2026-04-02', startMinutes: 600, endMinutes: 660 },
  ]);
  assert.equal(state.requestData.responseCount, 2);
});

test('guest Google Calendar config retries after an initial Secret Manager failure', { concurrency: false }, () => {
  const harnessPath = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/tests/api/group-meet/_runtimeHarness.cjs';
  const script = `
    const { loadGuestGoogleCalendarRuntime } = require(${JSON.stringify(harnessPath)});
    const keys = [
      'GOOGLE_GUEST_CALENDAR_OAUTH_JSON',
      'GOOGLE_GUEST_CALENDAR_OAUTH_SECRET_NAME',
      'GROUP_MEET_GUEST_GOOGLE_CALENDAR_OAUTH_SECRET_NAME',
      'GOOGLE_GUEST_CALENDAR_CLIENT_ID',
      'GOOGLE_GUEST_CALENDAR_CLIENT_SECRET',
      'GOOGLE_GUEST_CALENDAR_REDIRECT_URI',
      'GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY',
      'GOOGLE_GUEST_CALENDAR_ENCRYPTION_SECRET_NAME',
      'SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET',
      'FIREBASE_SECRET_KEY',
      'NODE_ENV',
    ];
    for (const key of keys) delete process.env[key];
    process.env.GOOGLE_GUEST_CALENDAR_OAUTH_SECRET_NAME = 'group-meet-guest-google-oauth';

    let secretReadCount = 0;
    const oauthClientOptions = [];

    class MockOAuth2Client {
      constructor(options) {
        oauthClientOptions.push(options);
      }

      generateAuthUrl() {
        return 'https://accounts.google.com/o/oauth2/v2/auth?mock=1';
      }
    }

    const { buildGuestGoogleCalendarConnectUrl } = loadGuestGoogleCalendarRuntime({
      secretManagerMock: async (secretName) => {
        secretReadCount += 1;
        if (secretName !== 'group-meet-guest-google-oauth') {
          throw new Error('Unexpected secret name ' + secretName);
        }
        if (secretReadCount === 1) {
          throw new Error('Failed to access Secret Manager secret group-meet-guest-google-oauth.');
        }
        return JSON.stringify({
          client_id: 'guest-client-id',
          client_secret: 'guest-client-secret',
          redirect_uri: 'https://fitwithpulse.ai/api/group-meet/calendar/google/callback',
          encryption_key: 'guest-encryption-key',
        });
      },
      OAuth2ClientMock: MockOAuth2Client,
    });

    (async () => {
      let firstError = null;
      try {
        await buildGuestGoogleCalendarConnectUrl({
          headers: { host: 'fitwithpulse.ai', 'x-forwarded-proto': 'https' },
        }, 'guest-token');
      } catch (error) {
        firstError = error.message;
      }

      const secondUrl = await buildGuestGoogleCalendarConnectUrl({
        headers: { host: 'fitwithpulse.ai', 'x-forwarded-proto': 'https' },
      }, 'guest-token');

      console.log(JSON.stringify({
        firstError,
        secondUrl,
        secretReadCount,
        oauthClientOptions,
      }));
    })().catch((error) => {
      console.error(error && error.stack ? error.stack : String(error));
      process.exit(1);
    });
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web',
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const payload = JSON.parse((result.stdout || '').trim());
  assert.equal(
    payload.firstError,
    'Failed to access Secret Manager secret group-meet-guest-google-oauth.'
  );
  assert.equal(payload.secondUrl, 'https://accounts.google.com/o/oauth2/v2/auth?mock=1');
  assert.equal(payload.secretReadCount, 2);
  assert.deepEqual(payload.oauthClientOptions, [
    {
      clientId: 'guest-client-id',
      clientSecret: 'guest-client-secret',
      redirectUri: 'https://fitwithpulse.ai/api/group-meet/calendar/google/callback',
    },
  ]);
});

test('guest Google Calendar config defaults to the canonical Secret Manager secret name without an env pointer', { concurrency: false }, () => {
  const harnessPath = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/tests/api/group-meet/_runtimeHarness.cjs';
  const script = `
    const { loadGuestGoogleCalendarRuntime } = require(${JSON.stringify(harnessPath)});
    const keys = [
      'GOOGLE_GUEST_CALENDAR_OAUTH_JSON',
      'GOOGLE_GUEST_CALENDAR_OAUTH_SECRET_NAME',
      'GROUP_MEET_GUEST_GOOGLE_CALENDAR_OAUTH_SECRET_NAME',
      'GOOGLE_GUEST_CALENDAR_CLIENT_ID',
      'GOOGLE_GUEST_CALENDAR_CLIENT_SECRET',
      'GOOGLE_GUEST_CALENDAR_REDIRECT_URI',
      'GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY',
      'GOOGLE_GUEST_CALENDAR_ENCRYPTION_SECRET_NAME',
      'SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET',
      'FIREBASE_SECRET_KEY',
      'NODE_ENV',
    ];
    for (const key of keys) delete process.env[key];

    const seenSecretNames = [];
    class MockOAuth2Client {
      constructor() {}
      generateAuthUrl() {
        return 'https://accounts.google.com/o/oauth2/v2/auth?mock=default-secret';
      }
    }

    const { buildGuestGoogleCalendarConnectUrl } = loadGuestGoogleCalendarRuntime({
      secretManagerMock: async (secretName) => {
        seenSecretNames.push(secretName);
        return JSON.stringify({
          client_id: 'guest-client-id',
          client_secret: 'guest-client-secret',
          redirect_uri: 'https://fitwithpulse.ai/api/group-meet/calendar/google/callback',
          encryption_key: 'guest-encryption-key',
        });
      },
      OAuth2ClientMock: MockOAuth2Client,
    });

    (async () => {
      const url = await buildGuestGoogleCalendarConnectUrl({
        headers: { host: 'fitwithpulse.ai', 'x-forwarded-proto': 'https' },
      }, 'guest-token');

      console.log(JSON.stringify({ url, seenSecretNames }));
    })().catch((error) => {
      console.error(error && error.stack ? error.stack : String(error));
      process.exit(1);
    });
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web',
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const payload = JSON.parse((result.stdout || '').trim());
  assert.equal(payload.url, 'https://accounts.google.com/o/oauth2/v2/auth?mock=default-secret');
  assert.deepEqual(payload.seenSecretNames, [
    'group-meet-guest-google-oauth',
  ]);
});

test('guest Google connect start route returns structured debug metadata on failure', { concurrency: false }, async () => {
  const { handler, state } = createGuestCalendarConnectStartHandlerRuntime({
    helperOverrides: {
      buildGuestGoogleCalendarConnectUrl: async () => {
        throw new Error('Permission denied while reading Secret Manager.');
      },
      getPublicGuestCalendarDebugInfo: () => ({
        code: 'secret_manager_permission_denied',
        hint: 'Grant the production runtime service account Secret Manager Secret Accessor on the guest Google OAuth secret.',
      }),
      shouldForceDevFirebase: () => true,
    },
  });

  const req = {
    method: 'POST',
    query: { token: 'guest-token' },
    headers: { host: 'localhost:8888' },
  };
  const res = createApiResponseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.error, 'Permission denied while reading Secret Manager.');
  assert.equal(res.payload.debugCode, 'secret_manager_permission_denied');
  assert.match(
    res.payload.debugHint,
    /Secret Manager Secret Accessor on the guest Google OAuth secret/
  );
  assert.match(
    res.payload.debugId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
  assert.deepEqual(state.firebaseAppSelections, [true]);
});

test('guest Google connect start route still returns an auth url after the deadline while the request remains open', { concurrency: false }, async () => {
  const { handler } = createGuestCalendarConnectStartHandlerRuntime({
    requestData: {
      title: 'Group Meet',
      targetMonth: '2026-04',
      deadlineAt: makeTimestamp('2026-04-01T13:00:00.000Z'),
      timezone: 'America/New_York',
      meetingDurationMinutes: 60,
      status: 'collecting',
    },
    helperOverrides: {
      buildGuestGoogleCalendarConnectUrl: async () => 'https://accounts.google.com/o/oauth2/v2/auth',
    },
  });

  const req = {
    method: 'POST',
    query: { token: 'guest-token' },
    headers: { host: 'fitwithpulse.ai' },
  };
  const res = createApiResponseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.url, 'https://accounts.google.com/o/oauth2/v2/auth');
});

test('public flex endpoint adds the selected slot and notifies the host', { concurrency: false }, async () => {
  const { handler, state } = createPublicFlexHandlerRuntime();
  const response = createApiResponseRecorder();

  await handler(
    {
      method: 'POST',
      query: { token: 'flex-token-123' },
      headers: { host: 'fitwithpulse.ai' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.requestTitle, 'Group Meet');
  assert.deepEqual(response.payload.selectedSlot, {
    date: '2026-04-08',
    startMinutes: 600,
    endMinutes: 660,
  });
  assert.deepEqual(state.firebaseAppSelections, [false]);

  const updatedInvite = state.inviteDocs.get('guest-token');
  assert.deepEqual(updatedInvite.availabilityEntries, [
    {
      date: '2026-04-08',
      startMinutes: 600,
      endMinutes: 660,
    },
  ]);
  assert.equal(state.requestData.responseCount, 2);
  assert.equal(state.hostNotificationCalls.length, 1);
  assert.equal(state.hostNotificationCalls[0].responseAction, 'added');
});

test('public flex endpoint remains usable after the deadline while the request is still collecting', { concurrency: false }, async () => {
  const { handler, state } = createPublicFlexHandlerRuntime({
    requestData: {
      title: 'Group Meet',
      targetMonth: '2026-04',
      deadlineAt: makeTimestamp('2026-04-01T13:00:00.000Z'),
      timezone: 'America/New_York',
      meetingDurationMinutes: 60,
      status: 'collecting',
    },
  });
  const response = createApiResponseRecorder();

  await handler(
    {
      method: 'POST',
      query: { token: 'flex-token-123' },
      headers: { host: 'fitwithpulse.ai' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(state.requestData.responseCount, 2);
  assert.deepEqual(state.inviteDocs.get('guest-token').availabilityEntries, [
    {
      date: '2026-04-08',
      startMinutes: 600,
      endMinutes: 660,
    },
  ]);
});

test('guest Google debug classification explains generic config-unavailable failures', { concurrency: false }, () => {
  const { getPublicGuestCalendarDebugInfo } = loadGuestGoogleCalendarRuntime({
    secretManagerMock: async () => {
      throw new Error('Secret Manager mock should not be called.');
    },
  });

  const debug = getPublicGuestCalendarDebugInfo(
    new Error('Google Calendar import is not available right now.')
  );

  assert.equal(debug.code, 'google_oauth_config_unavailable');
  assert.match(debug.hint, /group-meet-guest-google-oauth/);
});

test('guest Google scope helper recognizes the required read-only calendar scope', { concurrency: false }, () => {
  const { hasRequiredGuestCalendarScopes } = loadGuestGoogleCalendarRuntime({
    secretManagerMock: async () => {
      throw new Error('Secret Manager mock should not be called.');
    },
  });

  assert.equal(
    hasRequiredGuestCalendarScopes('openid email https://www.googleapis.com/auth/calendar.readonly'),
    true
  );
  assert.equal(hasRequiredGuestCalendarScopes('openid email'), false);
});

test('guest Google access token helper forces reconnect when the stored grant lacks calendar.readonly', { concurrency: false }, async () => {
  const previous = new Map(GUEST_CALENDAR_ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of GUEST_CALENDAR_ENV_KEYS) {
    delete process.env[key];
  }
  process.env.GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY = 'guest-calendar-encryption-secret';

  try {
    const {
      encryptGuestGoogleCalendarTokens,
      getGuestGoogleCalendarAccessToken,
      toPublicGuestCalendarErrorMessage,
    } = loadGuestGoogleCalendarRuntime({
      secretManagerMock: async () => {
        throw new Error('Secret Manager mock should not be called.');
      },
    });

    const encryptedToken = await encryptGuestGoogleCalendarTokens({
      accessToken: 'access-token',
      refreshToken: null,
      expiryDate: Date.now() + 60_000,
      scope: 'openid email',
      tokenType: 'Bearer',
      connectedEmail: 'tremaine.grant@gmail.com',
    });

    await assert.rejects(
      () =>
        getGuestGoogleCalendarAccessToken({
          req: { headers: { host: 'fitwithpulse.ai' } },
          inviteData: {
            calendarImport: {
              encryptedToken,
            },
          },
        }),
      /reconnected so Group Meet can request read-only calendar access/i
    );

    assert.equal(
      toPublicGuestCalendarErrorMessage(
        new Error('Request had insufficient authentication scopes.')
      ),
      'Google Calendar needs to be reconnected so Group Meet can request read-only calendar access.'
    );
  } finally {
    for (const key of GUEST_CALENDAR_ENV_KEYS) {
      const priorValue = previous.get(key);
      if (priorValue == null) {
        delete process.env[key];
      } else {
        process.env[key] = priorValue;
      }
    }
  }
});
