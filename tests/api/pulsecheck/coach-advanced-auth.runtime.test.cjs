const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const coachServicesPath = path.join(
  repoRoot,
  'netlify/functions/lib/pulsecheck-coach-services.js'
);
const earningsPath = path.join(
  repoRoot,
  'netlify/functions/get-pulsecheck-coach-earnings.js'
);
const payoutPath = path.join(
  repoRoot,
  'netlify/functions/pulsecheck-coach-payout.js'
);
const noraPath = path.join(
  repoRoot,
  'netlify/functions/coach-nora-chat.js'
);
const sendBrevoPath = path.join(
  repoRoot,
  'netlify/functions/utils/sendBrevoTransactionalEmail.js'
);

const clearRuntimeModules = () => {
  for (const modulePath of [
    coachServicesPath,
    earningsPath,
    payoutPath,
    noraPath,
    sendBrevoPath,
    configPath,
  ]) {
    delete require.cache[modulePath];
  }
};

const createFirestoreMock = (seed = {}) => {
  const recordsByCollection = new Map(
    Object.entries(seed).map(([collectionName, records]) => [
      collectionName,
      (records || []).map((record, index) => ({
        ...record,
        id: record.id || `${collectionName}-${index + 1}`,
      })),
    ])
  );
  const queries = [];
  const documentReads = [];
  const writes = [];
  let nextDocumentId = 1;

  const snapshot = (record) => ({
    id: record.id,
    exists: true,
    data: () => {
      const { id: _id, ...data } = record;
      return data;
    },
  });

  const getRecords = (collectionName) => (
    recordsByCollection.get(collectionName) || []
  );

  const collection = (collectionName) => {
    const makeQuery = (constraints = []) => ({
      where(field, operator, value) {
        return makeQuery([...constraints, { field, operator, value }]);
      },
      async get() {
        queries.push({ collectionName, constraints });
        const records = getRecords(collectionName).filter((record) => (
          constraints.every(({ field, operator, value }) => {
            if (operator === '==') return record[field] === value;
            if (operator === 'in') return Array.isArray(value) && value.includes(record[field]);
            throw new Error(`Unsupported test query operator: ${operator}`);
          })
        ));
        return {
          empty: records.length === 0,
          docs: records.map(snapshot),
        };
      },
    });

    return {
      ...makeQuery(),
      doc(documentId) {
        const resolvedId = documentId || `generated-${nextDocumentId++}`;
        return {
          id: resolvedId,
          async get() {
            documentReads.push({ collectionName, documentId: resolvedId });
            const record = getRecords(collectionName)
              .find((entry) => entry.id === resolvedId);
            return record
              ? snapshot(record)
              : { id: resolvedId, exists: false, data: () => undefined };
          },
          async set(data) {
            writes.push({ collectionName, documentId: resolvedId, data });
          },
        };
      },
    };
  };

  return {
    collection,
    documentReads,
    queries,
    writes,
  };
};

const installOpenAiMock = (result = {
  reply: 'I can help with that.',
  note: null,
}) => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPEN_AI_SECRET_KEY;
  const requests = [];
  process.env.OPEN_AI_SECRET_KEY = 'test-openai-key';
  global.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify(result),
          },
        }],
      }),
    };
  };

  return {
    requests,
    restore() {
      global.fetch = originalFetch;
      if (originalOpenAiKey == null) {
        delete process.env.OPEN_AI_SECRET_KEY;
      } else {
        process.env.OPEN_AI_SECRET_KEY = originalOpenAiKey;
      }
    },
  };
};

const loadRuntime = ({
  decoded = { uid: 'coach-authenticated', email: 'coach@example.com' },
  verifyError = null,
  database = {},
} = {}) => {
  clearRuntimeModules();
  const verifiedTokens = [];
  const firebaseRequests = [];
  let firestoreCalls = 0;

  const app = {
    auth: () => ({
      verifyIdToken: async (token) => {
        verifiedTokens.push(token);
        if (verifyError) throw verifyError;
        return decoded;
      },
    }),
    firestore: () => {
      firestoreCalls += 1;
      return database;
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      admin: {
        firestore: {
          FieldValue: {
            serverTimestamp: () => 'server-timestamp',
          },
        },
      },
      db: database,
      getFirebaseAdminApp: (event) => {
        firebaseRequests.push(event);
        return app;
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
  };
  require.cache[sendBrevoPath] = {
    id: sendBrevoPath,
    filename: sendBrevoPath,
    loaded: true,
    exports: {
      buildEmailDedupeKey: () => 'test-dedupe-key',
      sendBrevoTransactionalEmail: async () => ({ success: true }),
    },
  };

  return {
    app,
    firebaseRequests,
    firestoreCalls: () => firestoreCalls,
    verifiedTokens,
    coachServices: require(coachServicesPath),
    earnings: require(earningsPath),
    payout: require(payoutPath),
    nora: require(noraPath),
  };
};

test('shared coach auth verifies a strict bearer token with the request-selected Firebase app', async () => {
  const runtime = loadRuntime();
  const event = {
    headers: {
      Authorization: 'Bearer coach-token',
      'x-pulsecheck-firebase-mode': 'dev',
    },
  };

  const result = await runtime.coachServices.verifyFirebaseUser(event, {
    authErrorMessage: 'Coach sign-in required.',
  });

  assert.equal(result.userId, 'coach-authenticated');
  assert.equal(result.decoded.email, 'coach@example.com');
  assert.equal(result.app, runtime.app);
  assert.deepEqual(runtime.verifiedTokens, ['coach-token']);
  assert.equal(runtime.firebaseRequests[0], event);
});

test('earnings and payout auth reject anonymous or invalid Firebase callers', async () => {
  const anonymousRuntime = loadRuntime();

  await assert.rejects(
    anonymousRuntime.earnings.verifyCoach({ headers: {} }),
    (error) => error.statusCode === 401
      && error.message === 'Sign in is required to view coach earnings.'
  );
  await assert.rejects(
    anonymousRuntime.payout.verifyCoach({
      headers: { authorization: 'Basic credentials' },
    }),
    (error) => error.statusCode === 401
      && error.message === 'Sign in is required to request a payout.'
  );
  assert.deepEqual(anonymousRuntime.verifiedTokens, []);

  const invalidRuntime = loadRuntime({
    verifyError: new Error('raw token verifier detail'),
  });
  await assert.rejects(
    invalidRuntime.payout.verifyCoach({
      headers: { authorization: 'Bearer invalid-token' },
    }),
    (error) => error.statusCode === 401
      && error.message === 'Sign in is required to request a payout.'
  );
  assert.deepEqual(invalidRuntime.verifiedTokens, ['invalid-token']);
});

test('earnings requires a safe explicit selected team before authentication or reads', async () => {
  for (const teamId of [undefined, 'team/escape']) {
    const runtime = loadRuntime();
    const response = await runtime.earnings.handler({
      httpMethod: 'GET',
      headers: { authorization: 'Bearer coach-token' },
      queryStringParameters: teamId ? { teamId } : {},
    });

    assert.equal(response.statusCode, 400);
    assert.equal(runtime.firestoreCalls(), 0);
    assert.deepEqual(runtime.verifiedTokens, []);
  }
});

test('earnings rejects revoked staff and wrong-organization memberships', async () => {
  for (const membership of [
    {
      id: 'team-a_coach-authenticated',
      userId: 'coach-authenticated',
      teamId: 'team-a',
      organizationId: 'org-a',
      role: 'team-admin',
      status: 'revoked',
    },
    {
      id: 'team-a_coach-authenticated',
      userId: 'coach-authenticated',
      teamId: 'team-a',
      organizationId: 'org-other',
      role: 'team-admin',
      status: 'active',
    },
  ]) {
    const database = createFirestoreMock({
      'pulsecheck-team-memberships': [membership],
      'pulsecheck-teams': [{
        id: 'team-a',
        organizationId: 'org-a',
        status: 'active',
        commercialConfig: {
          referralKickbackEnabled: true,
          referralRevenueSharePct: 20,
          revenueRecipientUserId: 'coach-authenticated',
        },
      }],
      'pulsecheck-organizations': [{ id: 'org-a', status: 'active' }],
    });
    const runtime = loadRuntime({ database });

    await assert.rejects(
      runtime.earnings.loadCoachEarnings(
        'coach-authenticated',
        'team-a',
        database
      ),
      (error) => error.statusCode === 403
    );
  }
});

test('earnings includes only active exact athletes on the selected team', async () => {
  const database = createFirestoreMock({
    'pulsecheck-team-memberships': [
      {
        id: 'team-a_coach-authenticated',
        userId: 'coach-authenticated',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'team-admin',
        status: 'active',
      },
      {
        id: 'team-a_active-athlete',
        userId: 'active-athlete',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'athlete',
        status: 'active',
      },
      {
        id: 'team-a_revoked-athlete',
        userId: 'revoked-athlete',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'athlete',
        status: 'revoked',
      },
      {
        id: 'team-a_wrong-org-athlete',
        userId: 'wrong-org-athlete',
        teamId: 'team-a',
        organizationId: 'org-other',
        role: 'athlete',
        status: 'active',
      },
    ],
    'pulsecheck-teams': [{
      id: 'team-a',
      organizationId: 'org-a',
      status: 'active',
      commercialConfig: {
        referralKickbackEnabled: true,
        referralRevenueSharePct: 20,
        revenueRecipientUserId: 'coach-authenticated',
      },
    }],
    'pulsecheck-organizations': [{ id: 'org-a', status: 'active' }],
    users: [{ id: 'active-athlete', displayName: 'Active Athlete' }],
  });
  const runtime = loadRuntime({ database });
  const earnings = await runtime.earnings.loadCoachEarnings(
    'coach-authenticated',
    'team-a',
    database
  );

  assert.equal(earnings.teamId, 'team-a');
  assert.deepEqual(
    earnings.members.map((member) => member.userId),
    ['active-athlete']
  );
});

test('assessment earnings use Stripe payment truth and reject refunds or scope changes', () => {
  const runtime = loadRuntime();
  const purchase = {
    stripeSessionId: 'cs_assessment_1',
    stripePaymentIntentId: 'pi_assessment_1',
  };
  const paymentIntent = {
    id: 'pi_assessment_1',
    livemode: true,
    status: 'succeeded',
    amount_received: 10_000,
    currency: 'usd',
    latest_charge: {
      id: 'ch_assessment_1',
      paid: true,
      amount: 10_000,
      amount_captured: 10_000,
      amount_refunded: 0,
      refunded: false,
      disputed: false,
    },
  };
  const session = {
    id: 'cs_assessment_1',
    livemode: true,
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 10_000,
    currency: 'usd',
    created: 1_700_000_000,
    metadata: {
      payment_type: 'pulsecheck_assessment',
      assessmentId: 'parent',
      referralType: 'parent-assessment',
      teamId: 'team-a',
      organizationId: 'org-a',
    },
  };

  const truth = runtime.earnings.assessmentStripePaymentTruth({
    entryId: 'cs_assessment_1',
    purchase,
    session,
    paymentIntent,
    teamId: 'team-a',
    organizationId: 'org-a',
    expectedStripeMode: 'live',
  });
  assert.equal(truth.amountCents, 10_000);
  assert.equal(truth.paymentIntentId, 'pi_assessment_1');

  assert.equal(
    runtime.earnings.assessmentStripePaymentTruth({
      entryId: 'cs_assessment_1',
      purchase,
      session: {
        ...session,
        metadata: { ...session.metadata, teamId: 'team-b' },
      },
      paymentIntent,
      teamId: 'team-a',
      organizationId: 'org-a',
      expectedStripeMode: 'live',
    }),
    null
  );
  assert.equal(
    runtime.earnings.assessmentStripePaymentTruth({
      entryId: 'cs_assessment_1',
      purchase,
      session,
      paymentIntent: {
        ...paymentIntent,
        latest_charge: {
          ...paymentIntent.latest_charge,
          refunded: true,
          amount_refunded: 10_000,
        },
      },
      teamId: 'team-a',
      organizationId: 'org-a',
      expectedStripeMode: 'live',
    }),
    null
  );
  assert.equal(
    runtime.earnings.assessmentStripePaymentTruth({
      entryId: 'cs_assessment_1',
      purchase,
      session: { ...session, livemode: false },
      paymentIntent: { ...paymentIntent, livemode: false },
      teamId: 'team-a',
      organizationId: 'org-a',
      expectedStripeMode: 'live',
    }),
    null
  );
});

test('subscription earnings reject cross-user, cross-mode, and client alias identities', () => {
  const runtime = loadRuntime();
  const subscription = {
    id: 'sub_athlete_1',
    livemode: true,
    metadata: { userId: 'athlete-1' },
  };
  assert.equal(
    runtime.earnings.stripeSubscriptionMatchesAthlete({
      subscription,
      subscriptionId: 'sub_athlete_1',
      athleteUserId: 'athlete-1',
      expectedStripeMode: 'live',
    }),
    true
  );
  assert.equal(
    runtime.earnings.stripeSubscriptionMatchesAthlete({
      subscription,
      subscriptionId: 'sub_athlete_1',
      athleteUserId: 'athlete-2',
      expectedStripeMode: 'live',
    }),
    false
  );
  assert.equal(
    runtime.earnings.stripeSubscriptionMatchesAthlete({
      subscription: { ...subscription, livemode: false },
      subscriptionId: 'sub_athlete_1',
      athleteUserId: 'athlete-1',
      expectedStripeMode: 'live',
    }),
    false
  );
  assert.deepEqual(
    runtime.earnings.revenueCatCustomerIdsForAthlete('athlete-1'),
    ['athlete-1']
  );
  assert.equal(
    runtime.earnings.revenueCatProfileMatchesAthlete({
      subscriber: {
        original_app_user_id: 'another-athlete',
        aliases: ['anonymous-other'],
      },
    }, 'athlete-1'),
    false
  );
  assert.equal(
    runtime.earnings.revenueCatProfileMatchesAthlete({
      subscriber: {
        original_app_user_id: 'anonymous-id',
        aliases: ['athlete-1'],
      },
    }, 'athlete-1'),
    true
  );
});

test('selected-team payout includes verified referral share and service net', () => {
  const runtime = loadRuntime();
  assert.equal(
    runtime.earnings.calculatePayoutEligibleCents({
      referralShareCents: 2_500,
      serviceNetCents: 7_500,
    }),
    10_000
  );
});

test('Nora rejects a caller-supplied coach id that differs from the verified uid', async () => {
  const runtime = loadRuntime();
  const response = await runtime.nora.handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer coach-token' },
    body: JSON.stringify({
      coachId: 'another-coach',
      message: 'Remember our Monday meeting.',
    }),
  });

  assert.equal(response.statusCode, 403);
  assert.equal(runtime.firestoreCalls(), 0);
});

test('Nora rejects an anonymous caller before any Firestore access', async () => {
  const runtime = loadRuntime();
  const response = await runtime.nora.handler({
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({
      message: 'How is the team doing?',
      athletes: [],
    }),
  });

  assert.equal(response.statusCode, 401);
  assert.equal(runtime.firestoreCalls(), 0);
});

test('Nora requires a safe explicit team id before Firestore access', async () => {
  for (const teamId of [undefined, 'team/escape']) {
    const runtime = loadRuntime();
    const response = await runtime.nora.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer coach-token' },
      body: JSON.stringify({
        teamId,
        message: 'How is the team doing?',
      }),
    });

    assert.equal(response.statusCode, 400);
    assert.equal(runtime.firestoreCalls(), 0);
  }
});

test('Nora fails closed for an authenticated athlete without coach or staff access', async () => {
  const database = createFirestoreMock({
    'pulsecheck-team-memberships': [{
      id: 'team-a_athlete-caller',
      userId: 'athlete-caller',
      teamId: 'team-a',
      role: 'athlete',
      status: 'active',
    }],
  });
  const runtime = loadRuntime({
    decoded: { uid: 'athlete-caller', email: 'athlete@example.com' },
    database,
  });
  const response = await runtime.nora.handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer athlete-token' },
    body: JSON.stringify({
      teamId: 'team-a',
      message: 'Show me the team.',
      athletes: [{ id: 'athlete-a', displayName: 'Athlete A' }],
    }),
  });

  assert.equal(response.statusCode, 403);
  assert.equal(
    database.queries.some((query) => query.collectionName === 'coach-nora-vault'),
    false
  );
  assert.equal(
    database.queries.some((query) => query.collectionName === 'escalation-records'),
    false
  );
});

test('Nora derives its vault query from the verified uid when coachId is omitted', async () => {
  const database = createFirestoreMock({
    'pulsecheck-team-memberships': [{
      id: 'team-a_coach-authenticated',
      userId: 'coach-authenticated',
      teamId: 'team-a',
      organizationId: 'org-a',
      role: 'coach',
      status: 'active',
      staffCapabilities: ['coaching'],
      rosterVisibilityScope: 'team',
    }],
    'pulsecheck-teams': [{
      id: 'team-a',
      organizationId: 'org-a',
      status: 'active',
    }],
    'pulsecheck-organizations': [{
      id: 'org-a',
      status: 'active',
    }],
  });
  const runtime = loadRuntime({ database });
  const openAi = installOpenAiMock();

  try {
    const response = await runtime.nora.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer coach-token' },
      body: JSON.stringify({
        teamId: 'team-a',
        message: 'How is the team doing?',
        athletes: [],
      }),
    });

    assert.equal(response.statusCode, 200);
    const vaultQuery = database.queries.find(
      (query) => query.collectionName === 'coach-nora-vault'
    );
    assert.deepEqual(vaultQuery.constraints, [
      {
        field: 'coachId',
        operator: '==',
        value: 'coach-authenticated',
      },
      {
        field: 'teamId',
        operator: '==',
        value: 'team-a',
      },
    ]);
  } finally {
    openAi.restore();
  }
});

test('Nora reads and writes only the selected modern team vault', async () => {
  const database = createFirestoreMock({
    'pulsecheck-team-memberships': [{
      id: 'team-a_coach-authenticated',
      userId: 'coach-authenticated',
      teamId: 'team-a',
      organizationId: 'org-a',
      role: 'coach',
      status: 'active',
      staffCapabilities: ['coaching'],
      rosterVisibilityScope: 'team',
    }],
    'pulsecheck-teams': [{
      id: 'team-a',
      organizationId: 'org-a',
      status: 'active',
    }],
    'pulsecheck-organizations': [{
      id: 'org-a',
      status: 'active',
    }],
    'coach-nora-vault': [
      {
        id: 'selected-note',
        coachId: 'coach-authenticated',
        teamId: 'team-a',
        type: 'note',
        title: 'Selected Team Detail',
        content: 'Team A trains at 8.',
      },
      {
        id: 'other-team-note',
        coachId: 'coach-authenticated',
        teamId: 'team-b',
        type: 'note',
        title: 'Other Team Secret',
        content: 'Do not expose this.',
      },
      {
        id: 'unscoped-note',
        coachId: 'coach-authenticated',
        type: 'note',
        title: 'Unscoped Legacy Secret',
        content: 'Do not expose this either.',
      },
    ],
  });
  const runtime = loadRuntime({ database });
  const openAi = installOpenAiMock({
    reply: 'Saved that.',
    note: {
      title: 'Bus departure',
      content: 'The bus leaves at six.',
      category: 'Schedule',
    },
  });

  try {
    const response = await runtime.nora.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer coach-token' },
      body: JSON.stringify({
        teamId: 'team-a',
        message: 'Remember the bus leaves at six.',
        athletes: [],
      }),
    });

    assert.equal(response.statusCode, 200);
    const prompt = openAi.requests[0].messages[0].content;
    assert.equal(prompt.includes('Selected Team Detail'), true);
    assert.equal(prompt.includes('Other Team Secret'), false);
    assert.equal(prompt.includes('Unscoped Legacy Secret'), false);

    const noteWrite = database.writes.find(
      (write) => write.collectionName === 'coach-nora-vault'
        && write.documentId.startsWith('generated-')
    );
    assert.equal(noteWrite.data.coachId, 'coach-authenticated');
    assert.equal(noteWrite.data.teamId, 'team-a');
  } finally {
    openAi.restore();
  }
});

test('Nora removes an athlete outside the coach team before loading alerts or prompting', async () => {
  const database = createFirestoreMock({
    'pulsecheck-team-memberships': [
      {
        id: 'team-a_coach-authenticated',
        userId: 'coach-authenticated',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'coach',
        status: 'active',
        staffCapabilities: ['coaching'],
        rosterVisibilityScope: 'team',
      },
      {
        id: 'team-a_inside-athlete',
        userId: 'inside-athlete',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'athlete',
        status: 'active',
      },
      {
        id: 'team-b_outside-athlete',
        userId: 'outside-athlete',
        teamId: 'team-b',
        organizationId: 'org-b',
        role: 'athlete',
        status: 'active',
      },
      {
        id: 'team-a_wrong-org-athlete',
        userId: 'wrong-org-athlete',
        teamId: 'team-a',
        organizationId: 'org-b',
        role: 'athlete',
        status: 'active',
      },
    ],
    'pulsecheck-teams': [{
      id: 'team-a',
      organizationId: 'org-a',
      status: 'active',
    }],
    'pulsecheck-organizations': [{
      id: 'org-a',
      status: 'active',
    }],
  });
  const runtime = loadRuntime({ database });
  const openAi = installOpenAiMock();

  try {
    const response = await runtime.nora.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer coach-token' },
      body: JSON.stringify({
        teamId: 'team-a',
        message: 'Who needs a check-in?',
        athletes: [
          {
            id: 'inside-athlete',
            displayName: 'Inside Athlete',
            status: 'steady',
          },
          {
            id: 'outside-athlete',
            displayName: 'Outside Athlete',
            status: 'watch',
          },
          {
            id: 'wrong-org-athlete',
            displayName: 'Wrong Org Athlete',
            status: 'watch',
          },
        ],
      }),
    });

    assert.equal(response.statusCode, 200);
    const escalationQuery = database.queries.find(
      (query) => query.collectionName === 'escalation-records'
    );
    assert.deepEqual(escalationQuery.constraints, [{
      field: 'userId',
      operator: 'in',
      value: ['inside-athlete'],
    }]);
    const prompt = openAi.requests[0].messages[0].content;
    assert.equal(prompt.includes('Inside Athlete'), true);
    assert.equal(prompt.includes('Outside Athlete'), false);
    assert.equal(prompt.includes('Wrong Org Athlete'), false);
  } finally {
    openAi.restore();
  }
});

test('Nora keeps an active administrative staff account scoped to no athletes', async () => {
  const database = createFirestoreMock({
    'pulsecheck-team-memberships': [
      {
        id: 'team-a_coach-authenticated',
        userId: 'coach-authenticated',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'support-staff',
        status: 'active',
        staffCapabilities: ['administrative'],
        rosterVisibilityScope: 'none',
      },
      {
        id: 'team-a_athlete-a',
        userId: 'athlete-a',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'athlete',
        status: 'active',
      },
    ],
    'pulsecheck-teams': [{
      id: 'team-a',
      organizationId: 'org-a',
      status: 'active',
    }],
    'pulsecheck-organizations': [{
      id: 'org-a',
      status: 'active',
    }],
  });
  const runtime = loadRuntime({ database });
  const openAi = installOpenAiMock();

  try {
    const response = await runtime.nora.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer coach-token' },
      body: JSON.stringify({
        teamId: 'team-a',
        message: 'Help me plan the week.',
        athletes: [{ id: 'athlete-a', displayName: 'Hidden Athlete' }],
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      database.queries.some((query) => query.collectionName === 'escalation-records'),
      false
    );
    assert.equal(
      openAi.requests[0].messages[0].content.includes('Hidden Athlete'),
      false
    );
  } finally {
    openAi.restore();
  }
});

test('Nora assigned scope includes only assigned athletes who remain active on the team', async () => {
  const database = createFirestoreMock({
    'pulsecheck-team-memberships': [
      {
        id: 'team-a_coach-authenticated',
        userId: 'coach-authenticated',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'coach',
        status: 'active',
        staffCapabilities: ['coaching'],
        rosterVisibilityScope: 'assigned',
        allowedAthleteIds: ['assigned-athlete', 'former-athlete'],
      },
      {
        id: 'team-a_assigned-athlete',
        userId: 'assigned-athlete',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'athlete',
        status: 'active',
      },
      {
        id: 'team-a_unassigned-athlete',
        userId: 'unassigned-athlete',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'athlete',
        status: 'active',
      },
      {
        id: 'team-a_former-athlete',
        userId: 'former-athlete',
        teamId: 'team-a',
        organizationId: 'org-a',
        role: 'athlete',
        status: 'removed',
      },
    ],
    'pulsecheck-teams': [{
      id: 'team-a',
      organizationId: 'org-a',
      status: 'active',
    }],
    'pulsecheck-organizations': [{
      id: 'org-a',
      status: 'active',
    }],
  });
  const runtime = loadRuntime({ database });
  const openAi = installOpenAiMock();

  try {
    const response = await runtime.nora.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer coach-token' },
      body: JSON.stringify({
        teamId: 'team-a',
        message: 'Who needs a check-in?',
        athletes: [
          { id: 'assigned-athlete', displayName: 'Assigned Athlete' },
          { id: 'unassigned-athlete', displayName: 'Unassigned Athlete' },
          { id: 'former-athlete', displayName: 'Former Athlete' },
        ],
      }),
    });

    assert.equal(response.statusCode, 200);
    const escalationQuery = database.queries.find(
      (query) => query.collectionName === 'escalation-records'
    );
    assert.deepEqual(escalationQuery.constraints, [{
      field: 'userId',
      operator: 'in',
      value: ['assigned-athlete'],
    }]);
    const prompt = openAi.requests[0].messages[0].content;
    assert.equal(prompt.includes('Assigned Athlete'), true);
    assert.equal(prompt.includes('Unassigned Athlete'), false);
    assert.equal(prompt.includes('Former Athlete'), false);
  } finally {
    openAi.restore();
  }
});

test('Nora legacy scope requires a valid coach profile and includes only active coachAthletes links', async () => {
  const database = createFirestoreMock({
    coaches: [{
      id: 'coach-authenticated',
      userId: 'coach-authenticated',
      userType: 'coach',
    }],
    coachAthletes: [
      {
        id: 'active-link',
        coachId: 'coach-authenticated',
        athleteUserId: 'legacy-active-athlete',
        status: 'active',
      },
      {
        id: 'disconnected-link',
        coachId: 'coach-authenticated',
        athleteUserId: 'legacy-disconnected-athlete',
        status: 'disconnected',
      },
    ],
  });
  const runtime = loadRuntime({ database });
  const openAi = installOpenAiMock();

  try {
    const response = await runtime.nora.handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer coach-token' },
      body: JSON.stringify({
        teamId: 'legacy:coach-authenticated',
        message: 'How are my athletes doing?',
        athletes: [
          {
            id: 'legacy-active-athlete',
            displayName: 'Legacy Active Athlete',
          },
          {
            id: 'legacy-disconnected-athlete',
            displayName: 'Legacy Disconnected Athlete',
          },
        ],
      }),
    });

    assert.equal(response.statusCode, 200);
    const escalationQuery = database.queries.find(
      (query) => query.collectionName === 'escalation-records'
    );
    assert.deepEqual(escalationQuery.constraints, [{
      field: 'userId',
      operator: 'in',
      value: ['legacy-active-athlete'],
    }]);
    const prompt = openAi.requests[0].messages[0].content;
    assert.equal(prompt.includes('Legacy Active Athlete'), true);
    assert.equal(prompt.includes('Legacy Disconnected Athlete'), false);
  } finally {
    openAi.restore();
  }
});
