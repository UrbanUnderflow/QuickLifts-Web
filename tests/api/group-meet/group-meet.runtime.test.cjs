const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApiResponseRecorder,
  createPublicInviteHandlerRuntime,
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

test('computeGroupMeetAnalysis ranks a full-match window ahead of partial overlap', () => {
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

test('getGoogleCalendarSetupStatus reports Secret Manager-backed service-account readiness', async () => {
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

test('getGoogleCalendarSetupStatus blocks scheduling when delegated mailbox is missing', async () => {
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

test('public guest invite endpoint resolves an invite by stored token and honors localhost dev firebase', async () => {
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
