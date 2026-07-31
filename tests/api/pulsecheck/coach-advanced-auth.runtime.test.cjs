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

const installOpenAiMock = () => {
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
            content: JSON.stringify({
              reply: 'I can help with that.',
              note: null,
            }),
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
      role: 'coach',
      status: 'active',
      staffCapabilities: ['coaching'],
      rosterVisibilityScope: 'team',
    }],
    'pulsecheck-teams': [{
      id: 'team-a',
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
        message: 'How is the team doing?',
        athletes: [],
      }),
    });

    assert.equal(response.statusCode, 200);
    const vaultQuery = database.queries.find(
      (query) => query.collectionName === 'coach-nora-vault'
    );
    assert.deepEqual(vaultQuery.constraints, [{
      field: 'coachId',
      operator: '==',
      value: 'coach-authenticated',
    }]);
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
        role: 'coach',
        status: 'active',
        staffCapabilities: ['coaching'],
        rosterVisibilityScope: 'team',
      },
      {
        id: 'team-a_inside-athlete',
        userId: 'inside-athlete',
        teamId: 'team-a',
        role: 'athlete',
        status: 'active',
      },
      {
        id: 'team-b_outside-athlete',
        userId: 'outside-athlete',
        teamId: 'team-b',
        role: 'athlete',
        status: 'active',
      },
    ],
    'pulsecheck-teams': [{
      id: 'team-a',
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
        role: 'support-staff',
        status: 'active',
        staffCapabilities: ['administrative'],
        rosterVisibilityScope: 'none',
      },
      {
        id: 'team-a_athlete-a',
        userId: 'athlete-a',
        teamId: 'team-a',
        role: 'athlete',
        status: 'active',
      },
    ],
    'pulsecheck-teams': [{
      id: 'team-a',
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
        role: 'athlete',
        status: 'active',
      },
      {
        id: 'team-a_unassigned-athlete',
        userId: 'unassigned-athlete',
        teamId: 'team-a',
        role: 'athlete',
        status: 'active',
      },
      {
        id: 'team-a_former-athlete',
        userId: 'former-athlete',
        teamId: 'team-a',
        role: 'athlete',
        status: 'removed',
      },
    ],
    'pulsecheck-teams': [{
      id: 'team-a',
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
