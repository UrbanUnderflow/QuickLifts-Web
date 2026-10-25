const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');

const { harness } = require('./user-data-harness.cjs');

const routes = ['get-body-weight', 'get-user-workouts', 'get-monthly-statement', 'save-fatburn-summary'];
function event(route, token = 'owner') {
  return { httpMethod: route === 'save-fatburn-summary' ? 'POST' : 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    queryStringParameters: { userId: 'owner', month: '2020-01' },
    body: JSON.stringify({ userId: 'owner', id: 'summary' }),
  };
}

for (const route of routes) {
  test(`${route}: preflight succeeds without identity or parameters and permits Authorization`, async () => {
    const h = harness();
    const result = await h.handler(route)({ httpMethod: 'OPTIONS', headers: {} });
    assert.equal(result.statusCode, 200);
    assert.match(result.headers['Access-Control-Allow-Headers'], /Authorization/i);
    assert.equal(h.calls.reads.length + h.calls.writes.length + h.calls.tokens.length, 0);
  });
  test(`${route}: missing, revoked, expired, wrong-project, and cross-account access denied`, async () => {
    for (const token of [null, 'expired', 'revoked', 'wrong-project', 'missing-uid', 'stranger']) {
      const h = harness();
      const result = await h.handler(route)(event(route, token));
      assert.equal(result.statusCode, token === 'stranger' ? 403 : 401, String(token));
      assert.equal(h.calls.writes.length + h.calls.stripe.length, 0);
      assert.ok(!h.calls.reads.some(p => /bodyWeight|MyCreatedWorkouts|fatBurnSummaries/.test(p)));
      if (route !== 'get-body-weight') assert.equal(h.calls.reads.length, 0);
      for (const verification of h.calls.tokens) assert.equal(verification.revoked, true);
    }
  });
  test(`${route}: authenticated owner succeeds with existing payload`, async () => {
    const h = harness({ profile: { creator: { stripeAccountId: 'trusted-account' } } });
    const result = await h.handler(route)(event(route));
    assert.equal(result.statusCode, 200);
    if (route === 'save-fatburn-summary') assert.equal(h.calls.writes[0].path, 'users/owner/fatBurnSummaries/summary');
    if (route === 'get-monthly-statement') assert.equal(h.calls.stripe[0].stripeAccount, 'trusted-account');
  });
  test(`${route}: rejects unsupported HTTP methods`, async () => {
    const h = harness();
    assert.equal((await h.handler(route)({ ...event(route), httpMethod: 'DELETE' })).statusCode, 405);
    assert.equal(h.calls.reads.length + h.calls.writes.length, 0);
  });
}

for (const [name, profile, follow, token, status] of [
  ['public opt-in permits anonymous viewing', { checkinsPrivacy: 'publicAccess' }, null, null, 200],
  ['public opt-in permits signed-in viewing', { checkinsPrivacy: 'publicAccess' }, null, 'viewer', 200],
  ['explicit private share permits its recipient', { checkinsAccessList: ['viewer'] }, null, 'viewer', 200],
  ['malformed access list cannot grant access', { checkinsAccessList: 'viewer' }, null, 'viewer', 403],
  ['accepted incoming follower is authorized', { checkinsPrivacy: 'followersOnly' }, { fromUser: { id: 'viewer' }, toUser: { id: 'owner' }, status: 'accepted' }, 'viewer', 200],
  ['pending follower is denied', { checkinsPrivacy: 'followersOnly' }, { fromUser: { id: 'viewer' }, toUser: { id: 'owner' }, status: 'pending' }, 'viewer', 403],
  ['reverse relationship is denied', { checkinsPrivacy: 'followersOnly' }, { fromUser: { id: 'owner' }, toUser: { id: 'viewer' }, status: 'accepted' }, 'viewer', 403],
  ['missing relationship is denied', { checkinsPrivacy: 'followersOnly' }, null, 'viewer', 403],
  ['unknown privacy is private', { checkinsPrivacy: 'unknown' }, null, 'viewer', 403],
  ['invalid token cannot use public fallback', { checkinsPrivacy: 'publicAccess' }, null, 'expired', 401],
]) test(`body-weight sharing: ${name}`, async () => {
  const h = harness({ profile, follow });
  const result = await h.handler('get-body-weight')(event('get-body-weight', token));
  assert.equal(result.statusCode, status);
  assert.equal(h.calls.reads.some(p => p.endsWith('/bodyWeight')), status === 200);
});

test('sharing never grants statements, workouts, or writes', async () => {
  for (const route of routes.slice(1)) {
    const h = harness({ profile: { checkinsPrivacy: 'publicAccess', checkinsAccessList: ['viewer'] } });
    assert.equal((await h.handler(route)(event(route, 'viewer'))).statusCode, 403);
    assert.equal(h.calls.reads.length + h.calls.writes.length + h.calls.stripe.length, 0);
  }
});

test('private PulseCheck accounts cannot expose check-ins through legacy sharing settings', async () => {
  const h = harness({ privateAccount: true, profile: { checkinsPrivacy: 'publicAccess', checkinsAccessList: ['viewer'] } });
  for (const token of [null, 'viewer']) {
    assert.equal((await h.handler('get-body-weight')(event('get-body-weight', token))).statusCode, 403);
  }
  assert.ok(!h.calls.reads.some(p => p.endsWith('/bodyWeight')));
  assert.equal((await h.handler('get-body-weight')(event('get-body-weight'))).statusCode, 200);
});

test('body-weight rejects absent parameters and unbounded query limits', async () => {
  const h = harness();
  const handler = h.handler('get-body-weight');
  assert.equal((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 400);
  for (const limit of ['0', '-1', '101', '1.5', '50garbage']) {
    assert.equal((await handler({ ...event('get-body-weight'), queryStringParameters: { userId: 'owner', limit } })).statusCode, 400);
  }
});

for (const privateAccount of [false, true]) test(`public profile projection excludes health data (private marker=${privateAccount})`, async () => {
  const sensitiveProfile = { username: 'sample', bodyWeight: [{ newWeight: 99, frontUrl: 'private-photo' }] };
  const logs = [];
  const snapshot = { empty: false, docs: [{ id: 'owner', data: () => sensitiveProfile }] };
  const db = { collection(name) {
    if (name === 'users') return { where: () => ({ get: async () => snapshot }) };
    assert.equal(name, 'pulsecheck-private-users');
    return { doc: () => ({ get: async () => ({ exists: privateAccount }) }) };
  } };
  const exports = {};
  const dependencies = {
    './config/firebase': { db, headers: {} },
    '../../src/lib/server/firebase/credential-source': { resolveFirebaseAdminCredential: () => ({ source: 'synthetic' }) },
  };
  const context = { exports, module: { exports }, process: { env: {} },
    console: { log: (...args) => logs.push(args), error() {} }, require: name => dependencies[name] };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'netlify/functions/get-user-profile.js'), 'utf8'), context);
  const result = await context.module.exports.handler({ httpMethod: 'GET', queryStringParameters: { username: 'sample' } });
  const data = JSON.parse(result.body);
  assert.ok(!result.body.includes('private-photo'));
  if (privateAccount) assert.equal(data.success, false);
  else { assert.equal(data.success, true); assert.deepEqual(data.user.bodyWeight, []); }
  assert.ok(!logs.flat().includes(sensitiveProfile));
});
