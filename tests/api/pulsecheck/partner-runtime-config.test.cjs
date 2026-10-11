const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createPartnerRuntimeConfigLoader, ALLOWED_KEYS, TTL_MS } = require('../../../netlify/functions/lib/partner-runtime-config');
const bundle = Object.fromEntries(ALLOWED_KEYS.map(key => [key, `synthetic-${key}`]));
const response = value => ({ ok: true, json: async () => ({ payload: { data: Buffer.from(JSON.stringify(value)).toString('base64') } }) });
function fixture(overrides = {}) {
  const env = { PULSE_PARTNER_CONFIG_SECRET: 'pulse-partner-production' };
  let at = 1000, calls = 0;
  const load = createPartnerRuntimeConfigLoader({ env, now: () => at, getProjectId: () => 'synthetic-project', getAccessToken: async () => 'synthetic-token', fetchImpl: async (url, options) => { calls++; assert.equal(url, 'https://secretmanager.googleapis.com/v1/projects/synthetic-project/secrets/pulse-partner-production/versions/latest:access'); assert.equal(options.headers.Authorization, 'Bearer synthetic-token'); return response(bundle); }, ...overrides });
  return { env, load, calls: () => calls, advance: () => { at += TTL_MS + 1; } };
}
test('runtime config coalesces concurrent loads, hydrates six fields atomically, and refreshes after five minutes', async () => {
  const f = fixture();
  await Promise.all([f.load(), f.load(), f.load()]);
  assert.equal(f.calls(), 1);
  for (const key of ALLOWED_KEYS) assert.equal(f.env[key], bundle[key]);
  await f.load(); assert.equal(f.calls(), 1);
  f.advance(); await f.load(); assert.equal(f.calls(), 2);
});
test('absent reference preserves local fixtures without credential or network access', async () => {
  const env = { PARTNER_API_ENVIRONMENT: 'test' };
  await createPartnerRuntimeConfigLoader({ env, getAccessToken: () => { throw new Error('must not run'); }, fetchImpl: () => { throw new Error('must not run'); } })();
  assert.deepEqual(env, { PARTNER_API_ENVIRONMENT: 'test' });
});
test('configured failure does not silently fall back to existing values or expose provider errors', async () => {
  for (const fetchImpl of [async () => ({ ok: false }), async () => { throw new Error('PRIVATE_PROVIDER_RESPONSE'); }, async () => response({ ...bundle, FORBIDDEN: 'private' }), async () => response({ DEVELOPER_DOCS_COOKIE_SECRET: 'partial' })]) {
    const env = { PULSE_PARTNER_CONFIG_SECRET: 'pulse-partner-production', DEVELOPER_DOCS_COOKIE_SECRET: 'previous' };
    const f = fixture({ env, fetchImpl });
    await assert.rejects(f.load(), error => error.statusCode === 503 && error.message === 'partner_runtime_config_unavailable');
    assert.equal(env.DEVELOPER_DOCS_COOKIE_SECRET, 'previous');
    assert.equal(env.FORBIDDEN, undefined);
    assert.equal(env.PARTNER_API_ENVIRONMENT, undefined);
  }
});
test('reference changes reload and configured refresh failure remains fail closed', async () => {
  const env = { PULSE_PARTNER_CONFIG_SECRET: 'projects/123456/secrets/synthetic/versions/1' };
  let calls = 0;
  const f = fixture({ env, fetchImpl: async url => { calls++; if (url.includes('/versions/2:access')) throw new Error('unavailable'); return response(bundle); } });
  await f.load(); assert.equal(calls, 1);
  env.PULSE_PARTNER_CONFIG_SECRET = 'projects/123456/secrets/synthetic/versions/2';
  await assert.rejects(f.load(), /partner_runtime_config_unavailable/);
  await assert.rejects(f.load(), /partner_runtime_config_unavailable/);
  assert.equal(calls, 3);
});
test('snapshot deployment entrypoint waits for config and never invokes data handler after failure', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../netlify/functions/auntedna-snapshot-pull.js'), 'utf8');
  const exports = {}; let hydrated = false, calls = 0;
  vm.runInNewContext(source, { exports, require(name) {
    if (name === './lib/partner-runtime-config') return { ensurePartnerRuntimeConfig: async () => { if (hydrated) throw new Error('private failure'); hydrated = true; } };
    if (name === './lib/athleticmind-snapshot-pull') return { createDeployedSnapshotPullHandler: () => { assert.equal(hydrated, true); calls++; return async () => ({ statusCode: 200 }); } };
    throw new Error('Unexpected source access');
  } });
  assert.equal((await exports.handler({})).statusCode, 200);
  const failed = await exports.handler({});
  assert.equal(failed.statusCode, 503); assert.equal(calls, 1);
  assert.equal(failed.body.includes('private failure'), false);
});
