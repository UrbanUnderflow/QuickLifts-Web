const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const keys = require('../../../netlify/functions/lib/partner-api-keys');
const { createSnapshotAuthCheckHandler, PATH } = require('../../../netlify/functions/lib/athleticmind-snapshot-auth-check');
const now = Date.parse('2026-10-19T12:00:00Z');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

async function fixture({ rate = 30, scopeMode = 'explicit' } = {}) {
  const env = { PARTNER_API_ENVIRONMENT: 'production', ATHLETICMIND_SNAPSHOT_PULL_ENABLED: 'false', PARTNER_API_KEY_ACTIVE_ENCRYPTION_VERSION: 'v1', PARTNER_API_KEY_ENCRYPTION_KEYS_JSON: JSON.stringify({ v1: Buffer.alloc(32, 7).toString('base64') }) };
  const records = new Map([
    ['pulsecheck-organizations/org-am', { status: 'active', productBrand: 'athleticmind' }],
    ['pulsecheck-teams/team-am', { status: 'active', organizationId: 'org-am' }],
  ]);
  const reads = [], writes = [];
  const allowed = new Set(['partner-api-access-requests', 'partner-api-keys', 'partner-api-key-audit', 'partner-api-key-rate-limits', 'pulsecheck-organizations', 'pulsecheck-teams']);
  const ref = path => ({ path, get: async () => { reads.push(path); return { exists: records.has(path), data: () => structuredClone(records.get(path)) }; } });
  let serial = Promise.resolve();
  const db = {
    collection(name) { assert.ok(allowed.has(name), `Forbidden athlete or snapshot collection: ${name}`); return { doc: id => ref(`${name}/${id}`) }; },
    runTransaction(fn) {
      const save = (r, v, merge) => { writes.push(r.path); records.set(r.path, structuredClone(merge ? { ...records.get(r.path), ...v } : v)); };
      const next = serial.then(() => fn({ get: r => r.get(), set: (r, v, options) => save(r, v, options?.merge), update: (r, v) => save(r, v, true) }));
      serial = next.catch(() => {}); return next;
    },
  };
  const request = await keys.requestPartnerAccess(db, { organizationName: 'Synthetic Organization', contactName: 'Synthetic Engineer', contactEmail: 'engineer@example.invalid', intendedUse: 'Synthetic test', address: 'fixture', now });
  const issued = await keys.approvePartnerAccessRequest(db, { requestId: request.requestId, partnerId: 'auntedna', partnerName: 'AuntEdna', scopeMode, grants: scopeMode === 'explicit' ? [{ organizationId: 'org-am', teamIds: ['team-am'] }] : [], scopes: [keys.SCOPE], environment: 'production', expiresAt: new Date(now + 86400000).toISOString(), maxRequestsPerMinute: rate, actorEmail: 'admin@example.invalid', now, env });
  reads.length = 0; writes.length = 0;
  const signed = (body = { teamId: 'team-am' }, path = PATH, at = now) => {
    const raw = JSON.stringify(body), t = Math.floor(at / 1000);
    return { httpMethod: 'POST', body: raw, headers: { 'X-AuntEdna-Key-Id': issued.key.keyId, 'X-AuntEdna-Signature': `t=${t},v1=${crypto.createHmac('sha256', issued.secret).update(`${t}.POST.${path}.${raw}`).digest('hex')}` } };
  };
  const handler = createSnapshotAuthCheckHandler({ getDb: () => db, env, now: () => now });
  return { records, db, reads, writes, env, issued, signed, handler };
}

test('signed managed key succeeds while pull is disabled, with metadata only and ordinary audit/quota', async () => {
  const f = await fixture();
  const response = await f.handler(f.signed());
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.deepEqual(JSON.parse(response.body), { authenticated: true, contractVersion: 'athleticmind-snapshot-v2', snapshotPullStatus: 'snapshot_pull_disabled' });
  assert.ok(f.writes.every(path => /^(partner-api-key-rate-limits|partner-api-key-audit)\//.test(path)));
  assert.equal(f.writes.length, 2);
  assert.equal(JSON.stringify([...f.records.values()]).includes(f.issued.secret), false);
  assert.equal(f.env.ATHLETICMIND_SNAPSHOT_PULL_ENABLED, 'false');
});

test('exact endpoint, raw body and fresh timestamp must be signed; legacy keys are rejected', async () => {
  const f = await fixture();
  const valid = f.signed();
  for (const event of [
    f.signed({ teamId: 'team-am' }, '/.netlify/functions/auntedna-snapshot-pull'),
    f.signed({ teamId: 'team-am' }, PATH, now - 301000),
    { ...valid, body: '{ "teamId": "team-am" }' },
    { ...valid, headers: { ...valid.headers, 'X-AuntEdna-Key-Id': 'legacy-partner' } },
  ]) assert.equal((await f.handler(event)).statusCode, 401);
  const base64 = { ...valid, isBase64Encoded: true, body: Buffer.from(valid.body).toString('base64') };
  assert.equal((await f.handler(base64)).statusCode, 200);
});

test('only a team ID is accepted; athlete data and caller-selected environment are rejected before database access', async () => {
  const f = await fixture();
  for (const input of [null, [], 1, 'x', {}, { teamId: 'team-am', athleteId: 'athlete' }, { teamId: 'team-am', environment: 'test' }, { teamId: '../team' }]) assert.equal((await f.handler(f.signed(input))).statusCode, 400);
  assert.equal((await f.handler({ ...f.signed(), httpMethod: 'GET' })).statusCode, 405);
  assert.equal((await f.handler({ ...f.signed(), body: 'x'.repeat(1025) })).statusCode, 413);
  delete f.env.PARTNER_API_ENVIRONMENT;
  assert.equal((await f.handler(f.signed())).statusCode, 503);
  assert.deepEqual(f.reads, []);
});

test('current grants, active team and persisted Athletic Mind brand remain mandatory', async () => {
  for (const change of ['grant', 'team', 'org', 'brand', 'missing-brand']) {
    const f = await fixture();
    if (change === 'grant') f.records.get(`partner-api-keys/${hash(f.issued.key.keyId)}`).grants = [];
    if (change === 'team') f.records.get('pulsecheck-teams/team-am').status = 'inactive';
    if (change === 'org') f.records.get('pulsecheck-organizations/org-am').status = 'inactive';
    if (change === 'brand') f.records.get('pulsecheck-organizations/org-am').productBrand = 'pulsecheck';
    if (change === 'missing-brand') delete f.records.get('pulsecheck-organizations/org-am').productBrand;
    assert.equal((await f.handler(f.signed())).statusCode, 403, change);
  }
  const f = await fixture({ scopeMode: 'all-athleticmind' });
  assert.equal((await f.handler(f.signed())).statusCode, 200);
  f.records.get('pulsecheck-organizations/org-am').productBrand = 'pulsecheck';
  assert.equal((await f.handler(f.signed())).statusCode, 403);
});

test('expiry, revocation, rotation and fixed deployment environment reject the credential', async () => {
  for (const change of ['expire', 'revoke', 'rotate', 'environment']) {
    const f = await fixture();
    if (change === 'expire') f.records.get(`partner-api-keys/${hash(f.issued.key.keyId)}`).expiresAtMs = now;
    if (change === 'revoke') await keys.revokePartnerKey(f.db, { keyId: f.issued.key.keyId, actorEmail: 'admin@example.invalid', now });
    if (change === 'rotate') await keys.rotatePartnerKey(f.db, { keyId: f.issued.key.keyId, actorEmail: 'admin@example.invalid', now, env: f.env });
    if (change === 'environment') f.env.PARTNER_API_ENVIRONMENT = 'test';
    assert.equal((await f.handler(f.signed())).statusCode, 401, change);
  }
});

test('key check shares the managed key quota and final revalidation rejects concurrent revocation', async () => {
  const f = await fixture({ rate: 1 });
  assert.deepEqual((await Promise.all([f.handler(f.signed()), f.handler(f.signed())])).map(r => r.statusCode).sort(), [200, 429]);
  const g = await fixture();
  let clockCalls = 0;
  const handler = createSnapshotAuthCheckHandler({ getDb: () => g.db, env: g.env, now: () => {
    if (++clockCalls === 2) g.records.get(`partner-api-keys/${hash(g.issued.key.keyId)}`).status = 'revoked';
    return now;
  } });
  assert.equal((await handler(g.signed())).statusCode, 401);
});

test('readiness reports configuration only and never implies athlete consent or data access', async () => {
  const f = await fixture();
  f.env.ATHLETICMIND_SNAPSHOT_PULL_ENABLED = 'true';
  assert.equal(JSON.parse((await f.handler(f.signed())).body).snapshotPullStatus, 'program_snapshot_pull_disabled');
  const team = f.records.get('pulsecheck-teams/team-am');
  team.snapshotDelivery = { pullEnabled: true };
  assert.equal(JSON.parse((await f.handler(f.signed())).body).snapshotPullStatus, 'receiver_verification_required');
  team.snapshotDelivery.receiver = { status: 'verified', verifiedAt: 'synthetic-date', verifiedBy: 'synthetic-reviewer', contractVersion: 'athleticmind-snapshot-v2' };
  assert.equal(JSON.parse((await f.handler(f.signed())).body).snapshotPullStatus, 'athlete_eligibility_required');
});
