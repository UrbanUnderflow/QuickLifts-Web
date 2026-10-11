const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { decryptPartnerKeySecret } = require('./partner-api-keys');
const scrypt = promisify(crypto.scrypt);
const KEY_ID = 'pk_14ea32e13ebfda899720bb9768dd3400';
const COOKIE = '__Host-pulse_partner_auntedna';
const SESSION_MS = 8 * 60 * 60 * 1000;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const error = (code, statusCode = 401) => { throw Object.assign(new Error(code), { code, statusCode }); };
const keyRef = db => db.collection('partner-api-keys').doc(hash(KEY_ID));
function activeKey(key, now) {
  return key?.keyId === KEY_ID && key.partnerId === 'auntedna' && key.environment === 'production' && key.status === 'active' && !key.revokedAt && !key.deletedAt && !key.archivedAt && Number.isFinite(key.expiresAtMs) && key.expiresAtMs > now;
}
function activePortal(key, now) {
  const portal = key?.portal;
  return activeKey(key, now) && portal?.enabled === true && /^[a-f0-9]{32}$/.test(portal.credentialVersion || '') && /^[a-f0-9]{64}$/.test(portal.passwordSalt || '') && /^[a-f0-9]{128}$/.test(portal.passwordHash || '');
}
function cookie(value, maxAge) { return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`; }
function sessionToken(cookieHeader) {
  if (typeof cookieHeader !== 'string' || cookieHeader.length > 8192) return null;
  const matches = String(cookieHeader || '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${COOKIE}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
function validSession(key, token, now) {
  if (!token || !activePortal(key, now)) return null;
  return (Array.isArray(key.portal.sessions) ? key.portal.sessions : []).find(session => session.tokenHash === hash(token) && session.credentialVersion === key.portal.credentialVersion && session.expiresAtMs > now && session.expiresAtMs <= now + SESSION_MS);
}
async function configurePartnerPortal(db, { password, actorEmail, now = Date.now() }) {
  if (typeof password !== 'string' || password.length < 20 || password.length > 256 || !actorEmail) error('invalid_portal_configuration', 400);
  const passwordSalt = crypto.randomBytes(32).toString('hex');
  const passwordHash = (await scrypt(password, passwordSalt, 64)).toString('hex');
  const portal = { enabled: true, credentialVersion: crypto.randomBytes(16).toString('hex'), passwordSalt, passwordHash, sessions: [], configuredAt: new Date(now).toISOString(), configuredBy: actorEmail };
  await db.runTransaction(async tx => {
    const ref = keyRef(db), saved = await tx.get(ref);
    if (!saved.exists || !activeKey(saved.data(), now)) error('partner_key_unavailable', 409);
    tx.update(ref, { portal });
  });
  return { keyId: KEY_ID, configured: true };
}
async function consumeLoginAttempt(db, address, now) {
  const bucket = Math.floor(now / 900000);
  const refs = [db.collection('partner-api-key-rate-limits').doc(hash(`portal:ip:${address}:${bucket}`)), db.collection('partner-api-key-rate-limits').doc(hash(`portal:key:${KEY_ID}:${bucket}`))];
  await db.runTransaction(async tx => {
    const saved = await Promise.all(refs.map(ref => tx.get(ref)));
    const limits = [10, 100];
    if (saved.some((doc, index) => Number(doc.data()?.count || 0) >= limits[index])) error('rate_limited', 429);
    refs.forEach((ref, index) => tx.set(ref, { count: Number(saved[index].data()?.count || 0) + 1, expiresAt: new Date((bucket + 2) * 900000) }));
  });
}
async function partnerPortalAction(db, { action, password, cookieHeader, address = 'unknown', now = Date.now(), env = process.env }) {
  const ref = keyRef(db);
  if (action === 'login') {
    await consumeLoginAttempt(db, address, now);
    if (typeof password !== 'string' || password.length < 1 || password.length > 256) error('invalid_authentication');
    const saved = await ref.get(), key = saved.data();
    if (!saved.exists || !activePortal(key, now)) error('invalid_authentication');
    const candidate = await scrypt(password, key.portal.passwordSalt, 64);
    if (!crypto.timingSafeEqual(candidate, Buffer.from(key.portal.passwordHash, 'hex'))) error('invalid_authentication');
    const token = crypto.randomBytes(32).toString('hex');
    let expiresAtMs, keyExpiresAtMs;
    await db.runTransaction(async tx => {
      const current = await tx.get(ref), record = current.data();
      if (!activePortal(record, now) || record.portal.credentialVersion !== key.portal.credentialVersion || record.portal.passwordHash !== key.portal.passwordHash) error('invalid_authentication');
      keyExpiresAtMs = record.expiresAtMs;
      expiresAtMs = Math.min(now + SESSION_MS, record.expiresAtMs);
      const sessions = (Array.isArray(record.portal.sessions) ? record.portal.sessions : []).filter(session => session.expiresAtMs > now && session.credentialVersion === record.portal.credentialVersion).slice(-4);
      sessions.push({ tokenHash: hash(token), credentialVersion: record.portal.credentialVersion, createdAtMs: now, expiresAtMs });
      tx.update(ref, { portal: { ...record.portal, sessions } });
    });
    return { body: { authenticated: true, keyId: KEY_ID, expiresAt: new Date(keyExpiresAtMs).toISOString(), sessionExpiresAt: new Date(expiresAtMs).toISOString() }, cookie: cookie(token, Math.floor((expiresAtMs - now) / 1000)) };
  }
  const token = sessionToken(cookieHeader);
  if (action === 'logout') {
    if (token) await db.runTransaction(async tx => {
      const saved = await tx.get(ref), key = saved.data();
      if (saved.exists && Array.isArray(key.portal?.sessions)) tx.update(ref, { portal: { ...key.portal, sessions: key.portal.sessions.filter(session => session.tokenHash !== hash(token)) } });
    });
    return { body: { success: true }, cookie: cookie('', 0) };
  }
  if (!['session', 'secret'].includes(action)) error('not_found', 404);
  return db.runTransaction(async tx => {
    const saved = await tx.get(ref), key = saved.data(), session = validSession(key, token, now);
    if (!session) error('invalid_authentication');
    const body = { authenticated: true, keyId: KEY_ID, expiresAt: new Date(key.expiresAtMs).toISOString(), sessionExpiresAt: new Date(session.expiresAtMs).toISOString() };
    if (action === 'secret') {
      const bucket = Math.floor(now / 60000);
      const rateRef = db.collection('partner-api-key-rate-limits').doc(hash(`portal:reveal:${KEY_ID}:${bucket}`));
      const rate = await tx.get(rateRef);
      if (Number(rate.data()?.count || 0) >= 30) error('rate_limited', 429);
      tx.set(rateRef, { count: Number(rate.data()?.count || 0) + 1, expiresAt: new Date((bucket + 2) * 60000) });
      // Decrypt only for the explicitly requested reveal, after current persisted authorization.
      try { body.secret = decryptPartnerKeySecret(key, env); } catch { error('partner_secret_unavailable', 503); }
      tx.set(db.collection('partner-api-key-audit').doc(crypto.randomUUID()), { action: 'partner_portal_secret_revealed', keyId: KEY_ID, partnerId: 'auntedna', createdAt: new Date(now).toISOString() });
    }
    return { body };
  });
}
async function disablePartnerPortal(db, { actorEmail, now = Date.now() }) {
  if (!actorEmail) error('invalid_portal_configuration', 400);
  await db.runTransaction(async tx => {
    const ref = keyRef(db), saved = await tx.get(ref), key = saved.data();
    if (!saved.exists || key.keyId !== KEY_ID) error('partner_key_unavailable', 409);
    tx.update(ref, { portal: { ...key.portal, enabled: false, sessions: [], disabledAt: new Date(now).toISOString(), disabledBy: actorEmail } });
  });
  return { keyId: KEY_ID, disabled: true };
}
module.exports = { disablePartnerPortal, KEY_ID, COOKIE, SESSION_MS, configurePartnerPortal, partnerPortalAction };
