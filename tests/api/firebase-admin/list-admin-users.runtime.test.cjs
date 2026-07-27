const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { repoRoot, withModuleMocks } = require('./_runtimeHarness.cjs');

const functionPath = path.join(repoRoot, 'netlify/functions/list-admin-users.js');

const loadFunction = (app) => {
  delete require.cache[functionPath];
  return withModuleMocks(
    {
      './config/firebase': {
        headers: {},
        getFirebaseAdminApp: () => app,
      },
    },
    () => require(functionPath),
  );
};

const makeDocument = (id, data) => ({
  id,
  data: () => data,
});

test('admin user helpers search identity fields and normalize registration origins', () => {
  const { __test } = loadFunction({
    auth: () => ({}),
    firestore: () => ({}),
  });

  assert.equal(
    __test.matchesSearch('user-1', {
      email: 'coach@example.com',
      username: 'CoachCalvin',
    }, 'calvin'),
    true,
  );
  assert.equal(
    __test.matchesSearch('user-1', {
      email: 'relay@privaterelay.appleid.com',
      signInEmails: ['coach@example.com'],
    }, 'coach@example.com'),
    true,
  );
  assert.equal(__test.normalizeOrigin('quicklifts_ios'), 'fit_with_pulse');
  assert.equal(__test.normalizeOrigin('Pulse-Check'), 'pulse_check');
});

test('initial admin user request reads one 100-user page', async () => {
  const calls = [];
  const documents = [
    makeDocument('newer', { email: 'newer@example.com', createdAt: new Date('2026-07-02') }),
    makeDocument('older', { email: 'older@example.com', createdAt: new Date('2026-07-01') }),
  ];
  const usersRef = {
    orderBy(field, direction) {
      calls.push(['orderBy', field, direction]);
      return {
        limit(value) {
          calls.push(['limit', value]);
          return {
            async get() {
              return { docs: documents, size: documents.length };
            },
          };
        },
      };
    },
  };
  const db = {
    collection(name) {
      if (name === 'admin') {
        return {
          async get() {
            return { docs: [], size: 0 };
          },
        };
      }
      assert.equal(name, 'users');
      return usersRef;
    },
  };
  const { handler } = loadFunction({
    auth: () => ({
      async verifyIdToken() {
        return { uid: 'admin-1', admin: true };
      },
    }),
    firestore: () => db,
  });

  const response = await handler({
    httpMethod: 'GET',
    headers: { authorization: 'Bearer token' },
    queryStringParameters: { limit: '100', counts: 'false' },
  });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.users.length, 2);
  assert.deepEqual(calls, [
    ['orderBy', 'createdAt', 'desc'],
    ['limit', 101],
  ]);
});

test('admin user search scans the database on the server and returns matching users', async () => {
  const documents = [
    makeDocument('one', {
      email: 'first@example.com',
      username: 'first',
      createdAt: new Date('2026-07-01'),
    }),
    makeDocument('two', {
      email: 'coach@example.com',
      username: 'CoachCalvin',
      createdAt: new Date('2026-07-02'),
    }),
  ];
  let fullScanCount = 0;
  const usersRef = {
    async get() {
      fullScanCount += 1;
      return { docs: documents, size: documents.length };
    },
  };
  const db = {
    collection(name) {
      if (name === 'admin') {
        return {
          async get() {
            return { docs: [], size: 0 };
          },
        };
      }
      assert.equal(name, 'users');
      return usersRef;
    },
  };
  const { handler } = loadFunction({
    auth: () => ({
      async verifyIdToken() {
        return { uid: 'admin-1', admin: true };
      },
    }),
    firestore: () => db,
  });

  const response = await handler({
    httpMethod: 'GET',
    headers: { authorization: 'Bearer token' },
    queryStringParameters: { q: 'calvin', limit: '100', counts: 'false' },
  });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(fullScanCount, 1);
  assert.deepEqual(payload.users.map(user => user.id), ['two']);
});
