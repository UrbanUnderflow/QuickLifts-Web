const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadGoogleCalendarRuntime,
  loadGroupMeetRuntime,
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
