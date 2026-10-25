const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the real handler without initializing credentials or making network calls.
function harness(options = {}) {
  const calls = { tokens: [], reads: [], writes: [] };
  const admin = {
    auth: () => ({ verifyIdToken: async (...args) => {
      calls.tokens.push(args);
      if (options.authError) throw options.authError;
      return options.identity || { uid: 'admin-id', email: 'Owner@Example.com', email_verified: true };
    } }),
    firestore: { FieldValue: { serverTimestamp: () => 'server-time' } },
  };
  const db = { collection: (collection) => ({ doc: (id) => ({
    get: async () => {
      calls.reads.push([collection, id]);
      return { exists: options.exists !== false, data: () => ({ permissions: options.permissions ?? ['all'] }) };
    },
    set: async (data) => {
      if (options.writeError) throw options.writeError;
      calls.writes.push([collection, id, data]);
    },
  }) }) };
  const context = {
    exports: {},
    require: (name) => {
      assert.equal(name, './config/firebase');
      return { admin, db, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
    },
    console: { error() {} },
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../../netlify/functions/add-admin.js'), 'utf8'), context);
  return { handler: context.exports.handler, calls };
}

const request = (overrides = {}) => ({
  httpMethod: 'POST', headers: { authorization: 'Bearer verified-token' },
  body: JSON.stringify({ email: ' New@Example.com ' }), ...overrides,
});

test('preflight allows Authorization without authenticating or accessing Firestore', async () => {
  const { handler, calls } = harness();
  const result = await handler(request({ httpMethod: 'OPTIONS', headers: {} }));
  assert.equal(result.statusCode, 200);
  assert.match(result.headers['Access-Control-Allow-Headers'], /Authorization/);
  assert.deepEqual(calls, { tokens: [], reads: [], writes: [] });
});

test('rejects other methods and legacy shared-secret requests without any privileged work', async () => {
  for (const event of [request({ httpMethod: 'GET' }), request({ headers: {}, body: JSON.stringify({ email: 'new@example.com', adminKey: 'pulse-admin-2024' }) })]) {
    const { handler, calls } = harness();
    assert.equal((await handler(event)).statusCode, event.httpMethod === 'GET' ? 405 : 401);
    assert.deepEqual(calls, { tokens: [], reads: [], writes: [] });
  }
});

test('rejects expired, revoked, and wrong-project tokens before reading membership', async () => {
  for (const code of ['auth/id-token-expired', 'auth/id-token-revoked', 'auth/argument-error']) {
    const { handler, calls } = harness({ authError: Object.assign(new Error('private details'), { code }) });
    const result = await handler(request());
    assert.equal(result.statusCode, 401);
    assert.deepEqual(calls.tokens, [['verified-token', true]]);
    assert.equal(calls.reads.length, 0);
    assert.equal(calls.writes.length, 0);
    assert.doesNotMatch(result.body, /private details/);
  }
});

test('requires a verified email before looking up administrator membership', async () => {
  for (const identity of [{ uid: 'id' }, { uid: 'id', email: 'owner@example.com', email_verified: false }]) {
    const { handler, calls } = harness({ identity });
    assert.equal((await handler(request())).statusCode, 403);
    assert.equal(calls.reads.length, 0);
    assert.equal(calls.writes.length, 0);
  }
});

test('missing, limited, and malformed administrator permissions cannot grant access', async () => {
  for (const options of [{ exists: false }, { permissions: [] }, { permissions: ['reports'] }, { permissions: 'all' }, { permissions: 'small' }]) {
    const { handler, calls } = harness(options);
    assert.equal((await handler(request())).statusCode, 403);
    assert.equal(calls.writes.length, 0);
  }
});

test('invalid JSON, primitive bodies, and invalid emails cannot create an administrator', async () => {
  for (const body of ['{', 'null', '[]', '42', '"string"', '{}', '{"email":"invalid"}']) {
    const { handler, calls } = harness();
    assert.equal((await handler(request({ body }))).statusCode, 400);
    assert.equal(calls.writes.length, 0);
  }
});

test('verified full administrator provisions normalized email with server-owned metadata', async () => {
  const { handler, calls } = harness();
  const result = await handler(request({ body: JSON.stringify({ email: ' New@Example.com ', addedBy: 'forged', createdAt: 123, permissions: ['forged'] }) }));
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(calls.tokens, [['verified-token', true]]);
  assert.deepEqual(calls.reads, [['admin', 'owner@example.com']]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.writes)), [['admin', 'new@example.com', { email: 'new@example.com', createdAt: 'server-time', addedBy: 'owner@example.com', permissions: ['all'] }]]);
});

test('database errors fail closed without disclosing internal error messages', async () => {
  const { handler } = harness({ writeError: new Error('private database details') });
  const result = await handler(request());
  assert.equal(result.statusCode, 500);
  assert.doesNotMatch(result.body, /private database details/);
});
