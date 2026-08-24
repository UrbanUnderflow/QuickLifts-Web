const assert = require('node:assert/strict');
const test = require('node:test');

const {
  TEAM_JOIN_EMAIL_RECIPIENT,
  buildPulseCheckTeamJoinDeliveryKey,
  buildPulseCheckTeamJoinEmailContent,
  buildPulseCheckTeamJoinNotificationKey,
  resolveTeamJoinLifecycle,
  sendPulseCheckTeamJoinEmail,
} = require('../../../functions/utils/pulsecheckTeamJoinEmail');

class FakeFirestore {
  constructor() {
    this.documents = new Map();
  }

  collection(collectionName) {
    return {
      doc: (documentId) => {
        const path = `${collectionName}/${documentId}`;
        return {
          path,
          set: async (value, options) => {
            const existing = this.documents.get(path) || {};
            this.documents.set(path, options?.merge ? {...existing, ...value} : {...value});
          },
        };
      },
    };
  }

  async runTransaction(operation) {
    const transaction = {
      get: async (reference) => {
        const value = this.documents.get(reference.path);
        return {
          exists: Boolean(value),
          data: () => value,
        };
      },
      set: (reference, value, options) => {
        const existing = this.documents.get(reference.path) || {};
        this.documents.set(reference.path, options?.merge ? {...existing, ...value} : {...value});
      },
    };
    return operation(transaction);
  }
}

const baseInput = {
  eventId: 'event-one',
  athleteName: 'Jordan Lee',
  athleteEmail: 'jordan@example.edu',
  teamName: 'Spring Volleyball',
  organizationName: 'Clark Atlanta University',
  teamId: 'team-one',
  organizationId: 'org-one',
  athleteId: 'athlete-one',
  runtimeProjectId: 'quicklifts-dd3f1',
  apiKey: 'test-key',
};

test('builds the requested athlete and team wording with escaped HTML', () => {
  const content = buildPulseCheckTeamJoinEmailContent({
    athleteName: 'Jordan <Lee>',
    athleteEmail: 'jordan@example.edu',
    teamName: 'Spring & Summer Volleyball',
    organizationName: 'Clark Atlanta University',
  });

  assert.equal(content.subject, 'Jordan <Lee> just joined Spring & Summer Volleyball');
  assert.match(content.textContent, /Jordan <Lee> just joined Spring & Summer Volleyball\./);
  assert.match(content.htmlContent, /Jordan &lt;Lee&gt; just joined Spring &amp; Summer Volleyball/);
  assert.doesNotMatch(content.htmlContent, /<h1[^>]*>Jordan <Lee>/);
});

test('delivery keys are stable for retries and distinct for later Firestore events', () => {
  const first = buildPulseCheckTeamJoinDeliveryKey({eventId: 'event-one'});
  assert.equal(first, buildPulseCheckTeamJoinDeliveryKey({eventId: 'event-one'}));
  assert.notEqual(first, buildPulseCheckTeamJoinDeliveryKey({eventId: 'event-two'}));
  assert.equal(TEAM_JOIN_EMAIL_RECIPIENT, 'info@fitwithpulse.ai');
});

test('classifies restored athletes as rejoins without relabeling pending first activation', () => {
  assert.equal(resolveTeamJoinLifecycle({role: 'athlete', status: 'pending'}), 'join');
  assert.equal(resolveTeamJoinLifecycle({role: 'athlete', status: 'invited'}), 'join');
  assert.equal(resolveTeamJoinLifecycle({role: 'athlete', status: 'inactive'}), 'rejoin');
  assert.equal(resolveTeamJoinLifecycle({role: 'athlete', status: 'removed'}), 'rejoin');
  assert.equal(resolveTeamJoinLifecycle({role: 'athlete', status: 'active', removedAt: new Date()}), 'rejoin');
  assert.equal(resolveTeamJoinLifecycle({role: 'coach', status: 'removed'}), 'join');
});

test('keeps the first-join notification key and gives each rejoin event a stable distinct key', () => {
  const firstJoin = buildPulseCheckTeamJoinNotificationKey({membershipId: 'team-one_athlete-one'});
  const firstRejoin = buildPulseCheckTeamJoinNotificationKey({
    membershipId: 'team-one_athlete-one',
    lifecycle: 'rejoin',
    lifecycleEventId: 'firestore-event-one',
  });
  const firstRejoinRetry = buildPulseCheckTeamJoinNotificationKey({
    membershipId: 'team-one_athlete-one',
    lifecycle: 'rejoin',
    lifecycleEventId: 'firestore-event-one',
  });
  const secondRejoin = buildPulseCheckTeamJoinNotificationKey({
    membershipId: 'team-one_athlete-one',
    lifecycle: 'rejoin',
    lifecycleEventId: 'firestore-event-two',
  });

  assert.equal(firstJoin, 'pulsecheck_team_join_team-one_athlete-one');
  assert.equal(firstRejoin, firstRejoinRetry);
  assert.notEqual(firstRejoin, firstJoin);
  assert.notEqual(secondRejoin, firstRejoin);
  assert.throws(
    () => buildPulseCheckTeamJoinNotificationKey({
      membershipId: 'team-one_athlete-one',
      lifecycle: 'rejoin',
    }),
    /lifecycle event ID/
  );
});

test('uses rejoin wording only for a returning athlete lifecycle', () => {
  const firstJoin = buildPulseCheckTeamJoinEmailContent({
    athleteName: 'Jordan Lee',
    teamName: 'Spring Volleyball',
  });
  const rejoin = buildPulseCheckTeamJoinEmailContent({
    athleteName: 'Jordan Lee',
    teamName: 'Spring Volleyball',
    lifecycle: 'rejoin',
  });

  assert.equal(firstJoin.subject, 'Jordan Lee just joined Spring Volleyball');
  assert.equal(rejoin.subject, 'Jordan Lee rejoined Spring Volleyball');
  assert.match(rejoin.textContent, /Jordan Lee rejoined Spring Volleyball\./);
  assert.match(rejoin.htmlContent, /Jordan Lee rejoined Spring Volleyball/);
});

test('production sends once for the same event id and records a sent lock', async () => {
  const db = new FakeFirestore();
  const requests = [];
  const fetchImpl = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({messageId: 'brevo-message-one'}),
      text: async () => '',
    };
  };

  const first = await sendPulseCheckTeamJoinEmail({...baseInput, db, fetchImpl});
  const retry = await sendPulseCheckTeamJoinEmail({...baseInput, db, fetchImpl});

  assert.equal(first.success, true);
  assert.equal(first.messageId, 'brevo-message-one');
  assert.equal(retry.skipped, true);
  assert.equal(retry.reason, 'already_sent');
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].to, [{email: 'info@fitwithpulse.ai', name: 'PulseCheck'}]);
  assert.equal(requests[0].subject, 'Jordan Lee just joined Spring Volleyball');
});

test('separate rejoin events each send once with rejoin metadata and copy', async () => {
  const db = new FakeFirestore();
  const requests = [];
  const fetchImpl = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({messageId: `brevo-message-${requests.length}`}),
      text: async () => '',
    };
  };

  const firstRejoin = {...baseInput, eventId: 'rejoin-event-one', lifecycle: 'rejoin', db, fetchImpl};
  await sendPulseCheckTeamJoinEmail(firstRejoin);
  const retry = await sendPulseCheckTeamJoinEmail(firstRejoin);
  await sendPulseCheckTeamJoinEmail({...firstRejoin, eventId: 'rejoin-event-two'});

  assert.equal(retry.skipped, true);
  assert.equal(retry.reason, 'already_sent');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].subject, 'Jordan Lee rejoined Spring Volleyball');
  assert.deepEqual(requests[0].tags, ['pulsecheck', 'team-rejoin', 'internal-notification']);

  const sentLogs = [...db.documents.entries()]
    .filter(([path]) => path.startsWith('email-logs/'))
    .map(([, value]) => value);
  assert.equal(sentLogs.length, 2);
  assert.ok(sentLogs.every((entry) => entry.idempotencyMetadata.membershipLifecycle === 'rejoin'));
});

test('a failed delivery releases the event key so a Firebase retry can send', async () => {
  const db = new FakeFirestore();
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts === 1) {
      return {
        ok: false,
        status: 503,
        json: async () => ({}),
        text: async () => 'temporarily unavailable',
      };
    }
    return {
      ok: true,
      json: async () => ({messageId: 'brevo-message-retry'}),
      text: async () => '',
    };
  };

  await assert.rejects(
    sendPulseCheckTeamJoinEmail({...baseInput, db, fetchImpl}),
    /Brevo request failed \(503\)/
  );
  const retry = await sendPulseCheckTeamJoinEmail({...baseInput, db, fetchImpl});

  assert.equal(attempts, 2);
  assert.equal(retry.messageId, 'brevo-message-retry');
});

test('development memberships never send to the company inbox by default', async () => {
  const previousOverride = process.env.PULSECHECK_TEAM_JOIN_EMAILS_ENABLED;
  delete process.env.PULSECHECK_TEAM_JOIN_EMAILS_ENABLED;
  let called = false;
  try {
    const result = await sendPulseCheckTeamJoinEmail({
      ...baseInput,
      db: null,
      runtimeProjectId: 'quicklifts-dev-01',
      fetchImpl: async () => {
        called = true;
        throw new Error('fetch should not run');
      },
    });
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'non-production-project');
    assert.equal(called, false);
  } finally {
    if (previousOverride === undefined) {
      delete process.env.PULSECHECK_TEAM_JOIN_EMAILS_ENABLED;
    } else {
      process.env.PULSECHECK_TEAM_JOIN_EMAILS_ENABLED = previousOverride;
    }
  }
});
