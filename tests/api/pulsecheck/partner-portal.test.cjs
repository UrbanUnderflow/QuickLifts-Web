const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const portal = require('../../../netlify/functions/lib/partner-portal');
const now = Date.parse('2026-10-11T12:00:00Z');
const password = 'synthetic-portal-password-distinct-123';
const secret = 'synthetic-api-secret-not-a-real-key';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
async function fixture() {
  const encryptionKey = Buffer.alloc(32, 8), iv = Buffer.alloc(12, 9), cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  cipher.setAAD(Buffer.from(portal.KEY_ID));
  const encryptedSecret = { version: 'v1', iv: iv.toString('base64'), ciphertext: Buffer.concat([cipher.update(secret), cipher.final()]).toString('base64'), tag: cipher.getAuthTag().toString('base64') };
  const env = { PARTNER_API_KEY_ENCRYPTION_KEYS_JSON: JSON.stringify({ v1: encryptionKey.toString('base64') }), PARTNER_API_KEY_ACTIVE_ENCRYPTION_VERSION: 'v1' };
  const key = { keyId: portal.KEY_ID, partnerId: 'auntedna', environment: 'production', status: 'active', expiresAtMs: now + 2 * 86400000, encryptedSecret, scopeMode: 'all-athleticmind', grants: [] };
  const keyPath = `partner-api-keys/${hash(portal.KEY_ID)}`;
  const records = new Map([[keyPath, key]]);
  const ref = path => ({ path, get: async () => ({ exists: records.has(path), data: () => structuredClone(records.get(path)) }) });
  let serial = Promise.resolve();
  const db = { collection: name => ({ doc: id => ref(`${name}/${id}`) }), runTransaction: callback => {
    const next = serial.then(() => callback({ get: ref => ref.get(), set: (ref, value) => records.set(ref.path, structuredClone(value)), update: (ref, value) => records.set(ref.path, structuredClone({ ...records.get(ref.path), ...value })) }));
    serial = next.catch(() => {}); return next;
  } };
  await portal.configurePartnerPortal(db, { password, actorEmail: 'synthetic-admin@example.invalid', now });
  const action = input => portal.partnerPortalAction(db, { now, env, ...input });
  const login = async () => (await action({ action: 'login', password, address: 'synthetic-client' })).cookie.split(';')[0];
  return { db, env, records, keyPath, key: () => records.get(keyPath), action, login };
}
test('separate password creates bounded opaque session and explicit reveal equals existing encrypted secret', async () => {
  const f = await fixture(), cookieHeader = await f.login();
  const session = await f.action({ action: 'session', cookieHeader });
  assert.equal(session.body.secret, undefined);
  assert.equal(session.body.expiresAt, new Date(f.key().expiresAtMs).toISOString());
  assert.equal(session.body.sessionExpiresAt, new Date(now + portal.SESSION_MS).toISOString());
  assert.equal((await f.action({ action: 'secret', cookieHeader })).body.secret, secret);
  assert.equal(JSON.stringify([...f.records.values()]).includes(password), false);
  assert.equal(JSON.stringify([...f.records.values()]).includes(secret), false);
  assert.equal(JSON.stringify(f.key().portal).includes(cookieHeader.split('=')[1]), false);
  assert.deepEqual(f.key().grants, []);
});
test('shared docs cookie, incorrect password, foreign session and oversized cookie never authorize reveal', async () => {
  const f = await fixture();
  await assert.rejects(f.action({ action: 'login', password: 'shared-docs-password', address: 'client' }), /invalid_authentication/);
  for (const cookieHeader of ['pulse_developer_clinical_bridge=synthetic', `${portal.COOKIE}=${'a'.repeat(64)}`, 'x'.repeat(8193)]) await assert.rejects(f.action({ action: 'secret', cookieHeader }), /invalid_authentication/);
});
test('revoked, rotating, expired, wrong partner, and deleted key immediately deny existing sessions', async () => {
  for (const update of [{ status: 'revoked' }, { status: 'rotating' }, { expiresAtMs: now }, { partnerId: 'other' }, { deletedAt: 'synthetic' }]) {
    const f = await fixture(), cookieHeader = await f.login();
    Object.assign(f.key(), update);
    await assert.rejects(f.action({ action: 'secret', cookieHeader }), /invalid_authentication/);
  }
});
test('logout, password rotation, portal disable and session expiry invalidate access', async () => {
  for (const operation of ['logout', 'password', 'disable', 'expiry']) {
    const f = await fixture(), cookieHeader = await f.login();
    if (operation === 'logout') assert.match((await f.action({ action: 'logout', cookieHeader })).cookie, /Max-Age=0/);
    if (operation === 'password') await portal.configurePartnerPortal(f.db, { password: password + '-changed', actorEmail: 'synthetic-admin', now });
    if (operation === 'disable') await portal.disablePartnerPortal(f.db, { actorEmail: 'synthetic-admin', now });
    await assert.rejects(f.action({ action: 'secret', cookieHeader, ...(operation === 'expiry' ? { now: now + portal.SESSION_MS + 1 } : {}) }), /invalid_authentication/);
  }
});
test('concurrent logins retain only five sessions and login rate cap applies before password work', async () => {
  const f = await fixture();
  const cookies = await Promise.all(Array.from({ length: 6 }, () => f.login()));
  assert.equal(f.key().portal.sessions.length, 5);
  const authorized = await Promise.all(cookies.map(cookieHeader => f.action({ action: 'session', cookieHeader }).then(() => true, () => false)));
  assert.equal(authorized.filter(Boolean).length, 5);
  for (let i = 0; i < 4; i++) await assert.rejects(f.action({ action: 'login', password: 'wrong', address: 'synthetic-client' }), /invalid_authentication/);
  await assert.rejects(f.action({ action: 'login', password, address: 'synthetic-client' }), error => error.statusCode === 429);
});
test('explicit reveal rate is bounded and audit is metadata only', async () => {
  const f = await fixture(), cookieHeader = await f.login();
  for (let i = 0; i < 30; i++) await f.action({ action: 'secret', cookieHeader });
  await assert.rejects(f.action({ action: 'secret', cookieHeader }), error => error.statusCode === 429);
  const audit = [...f.records.entries()].filter(([key]) => key.startsWith('partner-api-key-audit/'));
  assert.equal(audit.length, 30); assert.equal(JSON.stringify(audit).includes(secret), false);
});
test('admin key metadata listing never includes portal credentials or session hashes', async () => {
  const f = await fixture(); await f.login();
  const { listPartnerAccess } = require('../../../netlify/functions/lib/partner-api-keys');
  const db = { collection(name) { const query = { where: () => query, orderBy: () => query, limit: () => query, get: async () => ({ docs: name === 'partner-api-keys' ? [{ id: hash(portal.KEY_ID), data: () => f.key() }] : [] }) }; return query; } };
  const metadata = JSON.stringify(await listPartnerAccess(db));
  assert.equal(metadata.includes('portal'), false);
  assert.equal(metadata.includes(f.key().portal.passwordHash), false);
  assert.equal(metadata.includes(f.key().portal.sessions[0].tokenHash), false);
  assert.equal(metadata.includes('encryptedSecret'), false);
});
