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
  const key = { requestId: 'synthetic-request', partnerName: 'AuntEdna', scopes: ['athleticmind.snapshot.read'], maxRequestsPerMinute: 30, expiresAt: new Date(now + 2 * 86400000).toISOString(), keyId: portal.KEY_ID, partnerId: 'auntedna', environment: 'production', status: 'active', expiresAtMs: now + 2 * 86400000, encryptedSecret, scopeMode: 'all-athleticmind', grants: [] };
  const keyPath = `partner-api-keys/${hash(portal.KEY_ID)}`;
  const records = new Map([[keyPath, key]]);
  const ref = path => ({ path, get: async () => ({ exists: records.has(path), data: () => structuredClone(records.get(path)) }) });
  let serial = Promise.resolve();
  const db = { collection: name => ({ doc: id => ref(`${name}/${id}`) }), runTransaction: callback => {
    const next = serial.then(async () => {
      const writes = [];
      const result = await callback({get: ref => {assert.equal(writes.length, 0, 'Firestore requires reads before writes'); return ref.get();}, set: (ref, value) => writes.push(() => records.set(ref.path, structuredClone(value))), update: (ref, value) => writes.push(() => records.set(ref.path, structuredClone({...records.get(ref.path), ...value})))});
      writes.forEach(write => write()); return result;
    });
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
test('partner rotation replaces ID and secret, preserves grants/expiry, and keeps only the initiating session', async () => {
  const f = await fixture(), other = await f.login(), cookieHeader = await f.login();
  const original = structuredClone(f.key());
  const result = await f.action({ action: 'rotate', cookieHeader, expectedKeyId: portal.KEY_ID, overlapMinutes: 15 });
  assert.notEqual(result.body.keyId, portal.KEY_ID);
  assert.equal(result.body.secret, undefined);
  const replacement = f.records.get(`partner-api-keys/${hash(result.body.keyId)}`);
  for (const field of ['partnerId','scopeMode','grants','scopes','environment','maxRequestsPerMinute','expiresAtMs']) assert.deepEqual(replacement[field], original[field]);
  assert.equal(f.key().status, 'rotating');
  assert.equal(f.key().expiresAtMs, now + 15 * 60000);
  assert.equal(f.key().portal.currentKeyId, replacement.keyId);
  assert.equal(f.key().portal.sessions.length, 1);
  assert.equal(f.key().portal.passwordHash, original.portal.passwordHash);
  assert.equal((await f.action({ action: 'session', cookieHeader })).body.keyId, replacement.keyId);
  const revealed = (await f.action({ action: 'secret', cookieHeader })).body;
  assert.equal(revealed.keyId, replacement.keyId); assert.notEqual(revealed.secret, secret);
  assert.equal(require('../../../netlify/functions/lib/partner-api-keys').decryptPartnerKeySecret(replacement, f.env), revealed.secret);
  assert.equal(JSON.stringify([...f.records.values()]).includes(revealed.secret), false);
  await assert.rejects(f.action({ action: 'secret', cookieHeader: other }), /invalid_authentication/);
  const newLogin = await f.login();
  assert.equal((await f.action({ action: 'session', cookieHeader: newLogin })).body.keyId, replacement.keyId);
});
test('rotation rejects unauthenticated, stale, invalid overlap and repeated requests without creating extra keys', async () => {
  const f = await fixture(), cookieHeader = await f.login();
  const request = {action:'rotate',cookieHeader,expectedKeyId:portal.KEY_ID,overlapMinutes:0};
  await assert.rejects(f.action({...request,cookieHeader:undefined}),/invalid_authentication/);
  for(const overlapMinutes of [-1,61,1.5,'15',undefined]) await assert.rejects(f.action({...request,overlapMinutes}),/invalid_rotation/);
  await assert.rejects(f.action({...request,expectedKeyId:'pk_'+'b'.repeat(32)}),/credential_changed/);
  const results=await Promise.allSettled([f.action(request),f.action(request)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  const current=f.key().portal.currentKeyId;
  await assert.rejects(f.action({...request,expectedKeyId:current}),/rate_limited/);
  assert.equal([...f.records.keys()].filter(k=>k.startsWith('partner-api-keys/')).length,2);
  assert.equal(f.key().expiresAtMs,now);
});
test('successive rotations remain accessible and current revocation or portal disable closes access', async () => {
  for(const operation of ['revoke','disable','password']) {
    const f=await fixture(),cookieHeader=await f.login();
    const one=await f.action({action:'rotate',cookieHeader,expectedKeyId:portal.KEY_ID,overlapMinutes:5});
    const two=await f.action({action:'rotate',cookieHeader,expectedKeyId:one.body.keyId,overlapMinutes:0,now:now+61000});
    assert.equal((await f.action({action:'secret',cookieHeader,now:now+61000})).body.keyId,two.body.keyId);
    if(operation==='revoke') f.records.get(`partner-api-keys/${hash(two.body.keyId)}`).status='revoked';
    if(operation==='disable') await portal.disablePartnerPortal(f.db,{actorEmail:'admin',now:now+61000});
    if(operation==='password') await portal.configurePartnerPortal(f.db,{password:password+'-new',actorEmail:'admin',now:now+61000});
    await assert.rejects(f.action({action:'secret',cookieHeader,now:now+61000}),/invalid_authentication/);
    if(operation==='password') assert.equal((await f.action({action:'login',password:password+'-new',address:'new',now:now+61000})).body.keyId,two.body.keyId);
  }
});
test('rotation fails without changing the key when encryption is unavailable, and overlap never extends expiry',async()=>{
 const f=await fixture(),cookieHeader=await f.login();
 const before=JSON.stringify([...f.records]);
 await assert.rejects(f.action({action:'rotate',cookieHeader,expectedKeyId:portal.KEY_ID,overlapMinutes:15,env:{}}),/key_encryption_unavailable/);
 assert.equal(JSON.stringify([...f.records]),before);
 f.key().expiresAtMs=now+30000;f.key().expiresAt=new Date(now+30000).toISOString();
 const r=await f.action({action:'rotate',cookieHeader,expectedKeyId:portal.KEY_ID,overlapMinutes:60});
 assert.equal(Date.parse(r.body.previousKeyValidUntil),now+30000);
 assert.equal(Date.parse(r.body.expiresAt),now+30000);
});
