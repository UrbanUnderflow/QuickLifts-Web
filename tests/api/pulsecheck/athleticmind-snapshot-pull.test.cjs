const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createSnapshotPullHandler, PATH } = require('../../../netlify/functions/lib/athleticmind-snapshot-pull');
const now = Date.parse('2026-10-11T12:00:00Z');
const env = { ATHLETICMIND_SNAPSHOT_PULL_ENABLED: 'true', ATHLETICMIND_SNAPSHOT_PULL_LEGACY_AUTH_ENABLED: 'true', PARTNER_API_ENVIRONMENT: 'production', SNAPSHOT_TEST_SECRET: 'synthetic-fixture-secret-only-123456789', ATHLETICMIND_SNAPSHOT_PULL_CLIENTS_JSON: JSON.stringify({ partner: { environment: 'production', secretEnv: 'SNAPSHOT_TEST_SECRET', organizationId: 'org-am', teamIds: ['team-am'] } }) };
const input = { requestId: 'request-1', teamId: 'team-am', athleteId: 'athlete-1', windowStart: '2026-10-10T12:00:00Z', windowEnd: '2026-10-11T12:00:00Z' };
function event(body = input, time = now) {
  const raw = JSON.stringify(body), t = Math.floor(time / 1000);
  const signature = crypto.createHmac('sha256', env.SNAPSHOT_TEST_SECRET).update(`${t}.POST.${PATH}.${raw}`).digest('hex');
  return { httpMethod: 'POST', body: raw, headers: { 'X-AuntEdna-Key-Id': 'partner', 'X-AuntEdna-Signature': `t=${t},v1=${signature}` } };
}
function fixture() {
  const records = new Map([['pulsecheck-teams/team-am', { organizationId: 'org-am', snapshotDelivery: { pullEnabled: true, receiver: { status: 'verified', verifiedAt: 'synthetic-date', verifiedBy: 'synthetic-reviewer', contractVersion: 'athleticmind-snapshot-v1' } } }]]);
  const ref = path => ({ path, get: async () => ({ exists: records.has(path), data: () => structuredClone(records.get(path)) }) });
  let serial = Promise.resolve();
  const db = {
    collection: name => ({ doc: id => ref(`${name}/${id}`) }),
    runTransaction: fn => {
      const next = serial.then(() => fn({ get: r => r.get(), update: (r, v) => records.set(r.path, structuredClone({ ...records.get(r.path), ...v })), set: (r, v, options) => records.set(r.path, structuredClone(options?.merge ? { ...records.get(r.path), ...v } : v)) }));
      serial = next.catch(() => {});
      return next;
    },
  };
  let eligible = true, assemblies = 0;
  const eligibility = () => ({ eligible, scope: { teamId: 'team-am', organizationId: 'org-am', athleteId: 'athlete-1', membershipId: 'team-am_athlete-1' }, consent: { id: 'policy', version: 'v2', eventId: 'receipt-1', acceptedAt: '2026-10-10T00:00:00Z', documentHash: 'policy-hash' } });
  const snapshot = { schemaVersion: 'athleticmind-snapshot-v1', onboarding: { responses: {} }, checkIns: [], supportStatus: [], snapshotId: 'a'.repeat(64), synthetic: false, scope: eligibility().scope, consent: eligibility().consent, window: { start: new Date(input.windowStart).toISOString(), end: new Date(input.windowEnd).toISOString() }, noraMessages: [{ sourceId: 'synthetic-conversation/message-1', revision: 'revision-1', text: 'Synthetic practice reflection.' }] };
  const handler = createSnapshotPullHandler({ getDb: () => db, env, now: () => now, checkEligibility: async () => eligibility(), assemble: async () => { assemblies++; return { eligible: true, snapshot: structuredClone(snapshot) }; } });
  return { handler, db, records, snapshot, revoke: () => { eligible = false; }, assemblies: () => assemblies };
}
test('disabled and invalid auth reject before touching any database', async () => {
  const getDb = () => { throw new Error('must not read'); };
  assert.equal((await createSnapshotPullHandler({ getDb, env: {} })(event())).statusCode, 503);
  const handler = createSnapshotPullHandler({ getDb, env, now: () => now });
  assert.equal((await handler({ ...event(), body: JSON.stringify({ ...input, athleteId: 'another' }) })).statusCode, 401);
  assert.equal((await handler(event(input, now - 301000))).statusCode, 401);
  assert.equal((await handler(event({ ...input, teamId: 'team-pulsecheck' }))).statusCode, 403);
});
test('authenticated pull has immutable retries and never changes delivery watermarks', async () => {
  const f = fixture();
  const first = await f.handler(event());
  assert.equal(first.statusCode, 200);
  const repeated = await f.handler(event());
  assert.equal(repeated.statusCode, 200);
  assert.equal(JSON.parse(repeated.body).receipt.replayed, true);
  assert.deepEqual(JSON.parse(repeated.body).snapshot, JSON.parse(first.body).snapshot);
  assert.equal(f.assemblies(), 2);
  assert.equal([...f.records.keys()].some(key => /watermark|deliveries/.test(key)), false);
  assert.equal((await f.handler(event({ ...input, athleteId: 'another' }))).statusCode, 409);
  f.revoke();
  assert.equal((await f.handler(event())).statusCode, 403);
});
test('wrong persisted organization and unverified program are denied', async () => {
  const f = fixture();
  f.records.get('pulsecheck-teams/team-am').organizationId = 'another-org';
  assert.equal((await f.handler(event())).statusCode, 403);
  assert.equal(f.assemblies(), 0);
  f.records.get('pulsecheck-teams/team-am').organizationId = 'org-am';
  f.records.get('pulsecheck-teams/team-am').snapshotDelivery.receiver.status = 'placeholder';
  assert.equal((await f.handler(event())).statusCode, 503);
  assert.equal(f.assemblies(), 0);
});
test('window, response limits and synthetic delivery protection fail closed', async () => {
  const f = fixture();
  assert.equal((await f.handler(event({ ...input, windowEnd: '2026-10-12T12:00:00Z' }))).statusCode, 400);
  f.snapshot.noraMessages[0].text = 'x'.repeat(513 * 1024);
  assert.equal((await f.handler(event())).statusCode, 413);
  assert.equal([...f.records.keys()].some(key => key.startsWith('athleticmind-snapshots/')), false);
  f.snapshot.noraMessages[0].text = 'Synthetic fixture';
  f.snapshot.synthetic = true;
  assert.equal((await f.handler(event())).statusCode, 403);
});

test('null, scalar, or array authentication configuration rejects without a database read', async () => {
  for (const configuration of ['null', '[]', '"value"', '1']) {
    const handler = createSnapshotPullHandler({ getDb: () => { throw new Error('must not read'); }, env: { ...env, ATHLETICMIND_SNAPSHOT_PULL_CLIENTS_JSON: configuration }, now: () => now });
    assert.equal((await handler(event())).statusCode, 401);
  }
});

test('cached source removal, changed revision, or changed onboarding requires a fresh request', async () => {
  for (const change of [
    snapshot => { snapshot.noraMessages = []; },
    snapshot => { snapshot.noraMessages[0].revision = 'revision-2'; },
    snapshot => { snapshot.onboarding.responses = { revised: 'Synthetic changed answer' }; },
  ]) {
    const f = fixture();
    assert.equal((await f.handler(event())).statusCode, 200);
    change(f.snapshot);
    const result = await f.handler(event());
    assert.equal(result.statusCode, 409);
    assert.equal(JSON.parse(result.body).error, 'snapshot_sources_changed_use_new_request_id');
    assert.equal([...f.records.keys()].some(key => /watermark|deliveries/.test(key)), false);
  }
});

test('newly available messages do not mutate an otherwise still-permitted frozen replay', async () => {
  const f = fixture();
  const first = await f.handler(event());
  f.snapshot.noraMessages.push({ sourceId: 'synthetic-conversation/message-2', revision: 'revision-2', text: 'Another synthetic message' });
  const retry = await f.handler(event());
  assert.equal(retry.statusCode, 200);
  assert.deepEqual(JSON.parse(retry.body).snapshot, JSON.parse(first.body).snapshot);
});

test('same snapshot ID across new requests preserves generatedAt and supplies a native TTL timestamp', async () => {
  const f = fixture();
  f.snapshot.generatedAt = '2026-10-11T12:00:00Z';
  const first = await f.handler(event());
  f.snapshot.generatedAt = '2026-10-11T12:00:01Z';
  const second = await f.handler(event({ ...input, requestId: 'request-2' }));
  assert.equal(second.statusCode, 200);
  assert.deepEqual(JSON.parse(second.body).snapshot, JSON.parse(first.body).snapshot);
  const saved = f.records.get(`athleticmind-snapshots/${f.snapshot.snapshotId}`);
  assert.ok(saved.expiresAt instanceof Date);
  assert.equal(saved.expiresAt.getTime(), saved.expiresAtMs);
});

test('cached and fresh responses recheck withdrawal immediately before release', async () => {
  for (const cached of [false, true]) {
    const f = fixture();
    if (cached) assert.equal((await f.handler(event())).statusCode, 200);
    let checks = 0;
    const handler = createSnapshotPullHandler({ getDb: () => f.db, env, now: () => now,
      checkEligibility: async () => ({ eligible: ++checks < (cached ? 2 : 3), scope: f.snapshot.scope, consent: f.snapshot.consent }),
      assemble: async () => ({ eligible: true, snapshot: structuredClone(f.snapshot) }),
    });
    const result = await handler(event());
    assert.equal(result.statusCode, 403);
    assert.equal(JSON.parse(result.body).error, 'consent_changed');
    assert.equal([...f.records.keys()].some(key => /watermark|deliveries/.test(key)), false);
  }
});

test('pull envelope schema, hash ID, scope, and exact window are validated before storage', async () => {
  for (const change of [
    snapshot => { snapshot.schemaVersion = 'unknown'; },
    snapshot => { snapshot.snapshotId = 'not-a-content-hash'; },
    snapshot => { snapshot.window.end = '2026-10-11T11:00:00.000Z'; },
    snapshot => { snapshot.scope.teamId = 'other-team'; },
    snapshot => { snapshot.consent.documentHash = 'wrong-policy'; },
  ]) {
    const f = fixture();
    change(f.snapshot);
    assert.equal((await f.handler(event())).statusCode, 403);
    assert.equal([...f.records.keys()].some(key => key.startsWith('athleticmind-snapshots/')), false);
  }
});

test('concurrent pull request owners cannot both publish one request ID', async () => {
  const f = fixture();
  let started, release;
  const ready = new Promise(resolve => { started = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const handler = createSnapshotPullHandler({ getDb: () => f.db, env, now: () => now,
    checkEligibility: async () => ({ eligible: true, scope: f.snapshot.scope, consent: f.snapshot.consent }),
    assemble: async () => { started(); await blocked; return { eligible: true, snapshot: structuredClone(f.snapshot) }; },
  });
  const first = handler(event());
  await ready;
  const concurrent = await handler(event());
  assert.equal(concurrent.statusCode, 409);
  assert.equal(JSON.parse(concurrent.body).error, 'request_in_progress');
  release();
  assert.equal((await first).statusCode, 200);
  assert.equal([...f.records.keys()].filter(key => key.startsWith('athleticmind-snapshots/')).length, 1);
});

test('legacy credentials require explicit compatibility opt-in and matching deployment environment', async () => {
  for (const override of [
    { ATHLETICMIND_SNAPSHOT_PULL_LEGACY_AUTH_ENABLED: undefined },
    { PARTNER_API_ENVIRONMENT: 'test' },
    { ATHLETICMIND_SNAPSHOT_PULL_CLIENTS_JSON: JSON.stringify({ partner: { secretEnv: 'SNAPSHOT_TEST_SECRET', organizationId: 'org-am', teamIds: ['team-am'] } }) },
  ]) {
    const handler = createSnapshotPullHandler({ getDb: () => { throw new Error('No source reads permitted'); }, env: { ...env, ...override }, now: () => now });
    assert.equal((await handler(event())).statusCode, 401);
  }
  const handler = createSnapshotPullHandler({ getDb: () => { throw new Error('No source reads permitted'); }, env: { ...env, PARTNER_API_ENVIRONMENT: undefined }, now: () => now });
  assert.equal((await handler(event())).statusCode, 503);
});

async function managedFixture(options = {}) {
  const keys = require('../../../netlify/functions/lib/partner-api-keys');
  const f = fixture();
  f.records.set('pulsecheck-organizations/org-am', { status: 'active', productBrand: 'athleticmind' });
  f.records.get('pulsecheck-teams/team-am').status = 'active';
  const managedEnv = { ATHLETICMIND_SNAPSHOT_PULL_ENABLED: 'true', PARTNER_API_ENVIRONMENT: 'production', PARTNER_API_KEY_ACTIVE_ENCRYPTION_VERSION: 'v1', PARTNER_API_KEY_ENCRYPTION_KEYS_JSON: JSON.stringify({ v1: Buffer.alloc(32, 7).toString('base64') }) };
  const request = await keys.requestPartnerAccess(f.db, { organizationName: 'Synthetic Organization', contactName: 'Synthetic Engineer', contactEmail: 'engineer@example.invalid', intendedUse: 'Synthetic local request', address: 'fixture', now });
  const issued = await keys.approvePartnerAccessRequest(f.db, { requestId: request.requestId, organizationId: 'org-am', teamIds: ['team-am'], scopes: [keys.SCOPE], environment: 'production', expiresAt: new Date(now + 86400000).toISOString(), maxRequestsPerMinute: options.rate || 30, actorEmail: 'admin@example.invalid', now, env: managedEnv });
  const signed = (body = input) => {
    const rawBody = JSON.stringify(body), timestamp = Math.floor(now / 1000);
    const signature = crypto.createHmac('sha256', issued.secret).update(`${timestamp}.POST.${PATH}.${rawBody}`).digest('hex');
    return { httpMethod: 'POST', body: rawBody, headers: { 'x-auntedna-key-id': issued.key.keyId, 'x-auntedna-signature': `t=${timestamp},v1=${signature}` } };
  };
  const eligibility = async () => ({ eligible: true, scope: f.snapshot.scope, consent: f.snapshot.consent });
  const handler = createSnapshotPullHandler({ getDb: () => f.db, env: managedEnv, now: () => now, checkEligibility: eligibility, assemble: async () => { if (options.duringAssembly) await options.duringAssembly({ ...f, keys, issued, managedEnv }); return { eligible: true, snapshot: f.snapshot }; } });
  return { ...f, keys, issued, managedEnv, signed, handler, eligibility };
}

test('issued managed key signs end-to-end pull, enforces atomic quota and records no payload in audit', async () => {
  const f = await managedFixture({ rate: 1 });
  const results = await Promise.all([f.handler(f.signed()), f.handler(f.signed())]);
  assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 429]);
  const audit = [...f.records.entries()].filter(([path]) => path.startsWith('partner-api-key-audit/')).map(([, value]) => value);
  assert.equal(audit.filter(value => value.action === 'key_authenticated').length, 1);
  assert.equal(JSON.stringify(audit).includes('Synthetic practice reflection'), false);
  assert.equal(JSON.stringify([...f.records.values()]).includes(f.issued.secret), false);
});

test('managed key revocation, expiry, rotation and environment mismatch deny cached or new pulls', async () => {
  for (const change of ['revoke', 'expire', 'rotate', 'environment']) {
    const f = await managedFixture();
    assert.equal((await f.handler(f.signed())).statusCode, 200);
    if (change === 'revoke') await f.keys.revokePartnerKey(f.db, { keyId: f.issued.key.keyId, actorEmail: 'admin@example.invalid', now });
    if (change === 'rotate') await f.keys.rotatePartnerKey(f.db, { keyId: f.issued.key.keyId, actorEmail: 'admin@example.invalid', now, env: f.managedEnv });
    if (change === 'expire') f.records.get(`partner-api-keys/${crypto.createHash('sha256').update(f.issued.key.keyId).digest('hex')}`).expiresAtMs = now;
    if (change === 'environment') f.managedEnv.PARTNER_API_ENVIRONMENT = 'test';
    assert.equal((await f.handler(f.signed())).statusCode, 401, change);
  }
});

test('revocation during assembly prevents response release', async () => {
  const f = await managedFixture({ duringAssembly: async ({ keys, db, issued }) => keys.revokePartnerKey(db, { keyId: issued.key.keyId, actorEmail: 'admin@example.invalid', now }) });
  assert.equal((await f.handler(f.signed())).statusCode, 401);
});

test('test deployments never call the real source assembler', async () => {
  const f = fixture();
  const testEnv = { ...env, PARTNER_API_ENVIRONMENT: 'test', ATHLETICMIND_SNAPSHOT_PULL_CLIENTS_JSON: JSON.stringify({ partner: { environment: 'test', secretEnv: 'SNAPSHOT_TEST_SECRET', organizationId: 'synthetic-org', teamIds: ['synthetic-team'] } }) };
  const handler = createSnapshotPullHandler({ getDb: () => f.db, env: testEnv, now: () => now });
  assert.equal((await handler(event({ ...input, teamId: 'synthetic-team', athleteId: 'synthetic-athlete' }))).statusCode, 503);
  assert.equal((await handler(event({ ...input, teamId: 'synthetic-team' }))).statusCode, 403);
});

test('deployed sandbox path serves deterministic synthetic data with an issued test key and no athlete source reads', async () => {
  const { createDeployedSnapshotPullHandler } = require('../../../netlify/functions/lib/athleticmind-snapshot-pull');
  const f = await managedFixture();
  f.records.set('pulsecheck-organizations/synthetic-org', { status: 'active', productBrand: 'athleticmind' });
  f.records.set('pulsecheck-teams/synthetic-team', { ...f.records.get('pulsecheck-teams/team-am'), organizationId: 'synthetic-org' });
  const request = await f.keys.requestPartnerAccess(f.db, { organizationName: 'Synthetic Sandbox', contactName: 'Synthetic Engineer', contactEmail: 'sandbox@example.invalid', intendedUse: 'Synthetic sandbox test', address: 'sandbox', now });
  const sandboxEnv = { ...f.managedEnv, PARTNER_API_ENVIRONMENT: 'test', ATHLETICMIND_SNAPSHOT_SANDBOX_ENABLED: 'true' };
  const issued = await f.keys.approvePartnerAccessRequest(f.db, { requestId: request.requestId, organizationId: 'synthetic-org', teamIds: ['synthetic-team'], scopes: [f.keys.SCOPE], environment: 'test', expiresAt: new Date(now + 86400000).toISOString(), actorEmail: 'admin@example.invalid', now, env: sandboxEnv });
  const db = { ...f.db, collection(name) {
    assert.ok(['partner-api-keys', 'partner-api-key-rate-limits', 'partner-api-key-audit', 'pulsecheck-organizations', 'pulsecheck-teams', 'athleticmind-snapshot-pulls', 'athleticmind-snapshots'].includes(name), `No athlete source read: ${name}`);
    return f.db.collection(name);
  } };
  const sandboxInput = { ...input, teamId: 'synthetic-team', athleteId: 'synthetic-athlete' };
  const rawBody = JSON.stringify(sandboxInput), timestamp = Math.floor(now / 1000);
  const signature = crypto.createHmac('sha256', issued.secret).update(`${timestamp}.POST.${PATH}.${rawBody}`).digest('hex');
  const requestEvent = { httpMethod: 'POST', body: rawBody, headers: { 'x-auntedna-key-id': issued.key.keyId, 'x-auntedna-signature': `t=${timestamp},v1=${signature}` } };
  const handler = createDeployedSnapshotPullHandler({ getDb: () => db, env: sandboxEnv, now: () => now });
  const first = await handler(requestEvent), second = await handler(requestEvent);
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(second.statusCode, 200, second.body);
  const snapshot = JSON.parse(first.body).snapshot;
  assert.equal(snapshot.synthetic, true);
  assert.deepEqual(snapshot, JSON.parse(second.body).snapshot);
  const Ajv = require('ajv');
  const validate = new Ajv({ allErrors: true }).compile(require('../../../docs/developer/athleticmind-snapshots/snapshot.schema.json'));
  assert.equal(validate(snapshot), true, JSON.stringify(validate.errors));
  const disabled = createDeployedSnapshotPullHandler({ getDb: () => db, env: { ...sandboxEnv, ATHLETICMIND_SNAPSHOT_SANDBOX_ENABLED: undefined }, now: () => now });
  assert.equal((await disabled(requestEvent)).statusCode, 503);
  const production = createDeployedSnapshotPullHandler({ getDb: () => db, env: { ...sandboxEnv, PARTNER_API_ENVIRONMENT: 'production' }, now: () => now });
  assert.equal((await production(requestEvent)).statusCode, 401);
});
