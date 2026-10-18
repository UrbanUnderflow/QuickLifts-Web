const crypto = require('node:crypto');
const COLLECTIONS = { requests: 'partner-api-access-requests', keys: 'partner-api-keys', audit: 'partner-api-key-audit', rates: 'partner-api-key-rate-limits' };
const SCOPE = 'athleticmind.snapshot.read';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const KEY_ID = /^pk_[a-f0-9]{32}$/;
const MAX_LIST = 200;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (code, statusCode = 400) => { throw Object.assign(new Error(code), { code, statusCode }); };
const nowValue = value => value === undefined ? Date.now() : value;
const active = data => data?.status === 'active' && !data.deletedAt && !data.archivedAt && !data.revokedAt;
function encryptionConfig(env = process.env) {
  let raw; try { raw = JSON.parse(env.PARTNER_API_KEY_ENCRYPTION_KEYS_JSON || ''); } catch { fail('key_encryption_unavailable', 503); }
  const version = env.PARTNER_API_KEY_ACTIVE_ENCRYPTION_VERSION;
  if (!raw || Array.isArray(raw) || !ID.test(version || '') || !Object.prototype.hasOwnProperty.call(raw, version)) fail('key_encryption_unavailable', 503);
  const keys = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!ID.test(id) || typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value) || Buffer.from(value, 'base64').length !== 32) fail('key_encryption_unavailable', 503);
    keys[id] = Buffer.from(value, 'base64');
  }
  return { version, keys };
}
function encryptSecret(secret, keyId, env) {
  const { version, keys } = encryptionConfig(env), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keys[version], iv); cipher.setAAD(Buffer.from(keyId));
  return { version, iv: iv.toString('base64'), ciphertext: Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]).toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}
function decryptSecret(record, env) {
  const { keys } = encryptionConfig(env), saved = record.encryptedSecret;
  if (!saved || !keys[saved.version]) fail('key_encryption_unavailable', 503);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keys[saved.version], Buffer.from(saved.iv, 'base64'));
  decipher.setAAD(Buffer.from(record.keyId)); decipher.setAuthTag(Buffer.from(saved.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(saved.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
function metadata(record) {
  const fields = ['partnerId', 'partnerName', 'keyId', 'requestId', 'organizationId', 'teamIds', 'scopes', 'environment', 'status', 'createdAt', 'createdBy', 'expiresAt', 'maxRequestsPerMinute', 'revokedAt', 'revokedBy', 'rotatedAt', 'replacesKeyId', 'replacementKeyId'];
  return { ...Object.fromEntries(fields.filter(field => record[field] !== undefined).map(field => [field, record[field]])), scopeMode: record.scopeMode || 'explicit', grants: normalizeGrants(record) };
}
function writeAudit(tx, db, action, values, now) {
  tx.set(db.collection(COLLECTIONS.audit).doc(crypto.randomUUID()), { action, ...values, createdAt: new Date(now).toISOString() });
}
async function scopeValid(reader, db, organizationId, teamIds) {
  if (!ID.test(organizationId || '') || !Array.isArray(teamIds) || !teamIds.length || teamIds.length > 50 || !teamIds.every(id => typeof id === 'string' && ID.test(id)) || new Set(teamIds).size !== teamIds.length) return false;
  const org = await reader.get(db.collection('pulsecheck-organizations').doc(organizationId));
  if (!org.exists || !active(org.data()) || org.data().productBrand !== 'athleticmind') return false;
  for (const id of teamIds) { const team = await reader.get(db.collection('pulsecheck-teams').doc(id)); if (!team.exists || !active(team.data()) || team.data().organizationId !== organizationId) return false; }
  return true;
}
function normalizeGrants(record) {
  if (Object.prototype.hasOwnProperty.call(record, 'grants')) return Array.isArray(record.grants) ? record.grants : [];
  return record.organizationId && Array.isArray(record.teamIds) ? [{ organizationId: record.organizationId, teamIds: record.teamIds }] : [];
}
function validateGrants(grants, environment) {
  if (!Array.isArray(grants) || grants.length > 50) fail('invalid_grants');
  const organizations = new Set(), teams = new Set();
  return grants.map(grant => {
    if (!grant || !ID.test(grant.organizationId || '') || organizations.has(grant.organizationId) || !Array.isArray(grant.teamIds) || !grant.teamIds.length || grant.teamIds.length > 50 || !grant.teamIds.every(id => typeof id === 'string' && ID.test(id) && !teams.has(id)) || new Set(grant.teamIds).size !== grant.teamIds.length) fail('invalid_grants');
    if (environment === 'test' && (!grant.organizationId.startsWith('synthetic-') || !grant.teamIds.every(id => id.startsWith('synthetic-')))) fail('test_scope_must_be_synthetic');
    organizations.add(grant.organizationId); grant.teamIds.forEach(id => teams.add(id));
    if (teams.size > 200) fail('invalid_grants');
    return { organizationId: grant.organizationId, teamIds: [...grant.teamIds].sort() };
  }).sort((a, b) => a.organizationId.localeCompare(b.organizationId));
}
async function grantsValid(reader, db, grants) {
  for (const grant of grants) if (!await scopeValid(reader, db, grant.organizationId, grant.teamIds)) return false;
  return true;
}
async function requestGrant(reader, db, record, teamId) {
  if (record.scopeMode === 'all-athleticmind') {
    if (!ID.test(teamId || '')) return null;
    const team = await reader.get(db.collection('pulsecheck-teams').doc(teamId));
    const organizationId = team.data()?.organizationId;
    if (!team.exists || !active(team.data()) || !ID.test(organizationId || '')) return null;
    if (record.environment === 'test' && (!organizationId.startsWith('synthetic-') || !teamId.startsWith('synthetic-'))) return null;
    return { organizationId, teamIds: [teamId] };
  }
  if (record.scopeMode && record.scopeMode !== 'explicit') return null;
  const grants = normalizeGrants(record).filter(grant => Array.isArray(grant.teamIds) && grant.teamIds.includes(teamId));
  return grants.length === 1 ? grants[0] : null;
}
function validateApproval(input, now) {
  const expiry = typeof input.expiresAt === 'string' ? Date.parse(input.expiresAt) : NaN;
  if (!['test', 'production'].includes(input.environment) || !Array.isArray(input.scopes) || input.scopes.length !== 1 || input.scopes[0] !== SCOPE || !Number.isFinite(expiry) || expiry <= now || expiry > now + 365 * 86400000) fail('invalid_key_scope_or_expiry');
  const rate = input.maxRequestsPerMinute === undefined ? 30 : input.maxRequestsPerMinute;
  if (!Number.isInteger(rate) || rate < 1 || rate > 300) fail('invalid_rate_limit');
  return { expiry, rate };
}
function newKey(input, now, env) {
  const { expiry, rate } = validateApproval(input, now);
  if (!ID.test(input.partnerId || '') || typeof input.partnerName !== 'string' || !input.partnerName.trim() || input.partnerName.trim().length > 200) fail('invalid_partner_identity');
  const scopeMode = input.scopeMode || 'explicit';
  if (!['explicit', 'all-athleticmind'].includes(scopeMode)) fail('invalid_scope_mode');
  const grants = validateGrants(input.grants, input.environment);
  if (scopeMode === 'all-athleticmind' && grants.length) fail('invalid_grants');
  const keyId = `pk_${crypto.randomBytes(16).toString('hex')}`, secret = crypto.randomBytes(32).toString('base64url');
  const record = { keyId, requestId: input.requestId, partnerId: input.partnerId, partnerName: input.partnerName.trim(), scopeMode, grants, scopes: [SCOPE], environment: input.environment, status: 'active', createdAt: new Date(now).toISOString(), createdBy: input.actorEmail, expiresAt: new Date(expiry).toISOString(), expiresAtMs: expiry, maxRequestsPerMinute: rate, encryptedSecret: encryptSecret(secret, keyId, env) };
  return { record, secret };
}
async function requestPartnerAccess(db, input) {
  const now = nowValue(input.now), clean = {};
  for (const [name, limit] of [['organizationName', 200], ['contactName', 150], ['contactEmail', 254], ['intendedUse', 2000]]) {
    const value = input[name]; if (typeof value !== 'string' || !value.trim() || value.trim().length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) fail('invalid_access_request'); clean[name] = value.trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.contactEmail)) fail('invalid_contact_email');
  const requestId = crypto.randomUUID(), bucket = Math.floor(now / 3600000), ref = db.collection(COLLECTIONS.rates).doc(hash(`request:${input.address || 'unknown'}:${bucket}`));
  await db.runTransaction(async tx => {
    const current = await tx.get(ref); if ((current.data()?.count || 0) >= 5) fail('rate_limited', 429);
    tx.set(ref, { count: (current.data()?.count || 0) + 1, expiresAt: new Date((bucket + 2) * 3600000) });
    tx.set(db.collection(COLLECTIONS.requests).doc(requestId), { ...clean, requestId, status: 'pending', requestedScopes: [SCOPE], createdAt: new Date(now).toISOString() });
    writeAudit(tx, db, 'access_requested', { requestId }, now);
  });
  return { requestId, status: 'pending' };
}
async function approvePartnerAccessRequest(db, input) {
  const now = nowValue(input.now); if (!ID.test(input.requestId || '') || !input.actorEmail) fail('invalid_approval');
  const issued = newKey(input, now, input.env), ref = db.collection(COLLECTIONS.requests).doc(input.requestId);
  await db.runTransaction(async tx => {
    const request = await tx.get(ref); if (!request.exists || request.data().status !== 'pending') fail('request_not_pending', 409);
    if (!await grantsValid(tx, db, issued.record.grants)) fail('invalid_saved_organization_or_team_scope');
    tx.set(db.collection(COLLECTIONS.keys).doc(hash(issued.record.keyId)), issued.record);
    tx.update(ref, { status: 'approved', approvedAt: new Date(now).toISOString(), approvedBy: input.actorEmail, keyId: issued.record.keyId });
    writeAudit(tx, db, 'key_approved', { requestId: input.requestId, keyId: issued.record.keyId, actorEmail: input.actorEmail, partnerId: issued.record.partnerId, scopeMode: issued.record.scopeMode, grants: issued.record.grants, scopes: issued.record.scopes, environment: input.environment }, now);
  });
  return { key: metadata(issued.record), secret: issued.secret };
}
async function revealPartnerKey(db, input) {
  if (!KEY_ID.test(input.keyId || '') || !input.actorEmail) fail('invalid_key');
  const now = nowValue(input.now);
  return db.runTransaction(async tx => {
    const saved = await tx.get(db.collection(COLLECTIONS.keys).doc(hash(input.keyId)));
    if (!saved.exists) fail('key_not_found', 404);
    const record = saved.data();
    if (record.keyId !== input.keyId || !active(record) || !Number.isFinite(record.expiresAtMs) || record.expiresAtMs <= now) fail('key_not_active', 409);
    const secret = decryptSecret(record, input.env);
    writeAudit(tx, db, 'key_secret_accessed', { keyId: input.keyId, actorEmail: input.actorEmail }, now);
    return { keyId: input.keyId, secret };
  });
}
async function revokePartnerKey(db, input) {
  if (!KEY_ID.test(input.keyId || '') || !input.actorEmail) fail('invalid_key');
  const now = nowValue(input.now), ref = db.collection(COLLECTIONS.keys).doc(hash(input.keyId)); let result;
  await db.runTransaction(async tx => {
    const saved = await tx.get(ref); if (!saved.exists) fail('key_not_found', 404);
    result = { ...saved.data(), status: 'revoked', revokedAt: new Date(now).toISOString(), revokedBy: input.actorEmail };
    tx.update(ref, { status: result.status, revokedAt: result.revokedAt, revokedBy: result.revokedBy });
    writeAudit(tx, db, 'key_revoked', { keyId: input.keyId, actorEmail: input.actorEmail }, now);
  });
  return { key: metadata(result) };
}
async function rotatePartnerKeyInTransaction(tx, db, input) {
  const now = nowValue(input.now), overlap = input.overlapMinutes === undefined ? 0 : input.overlapMinutes;
  if (!KEY_ID.test(input.keyId || '') || !input.actorEmail || !Number.isInteger(overlap) || overlap < 0 || overlap > 60) fail('invalid_rotation');
  encryptionConfig(input.env); const ref = db.collection(COLLECTIONS.keys).doc(hash(input.keyId)); let issued;
  const saved = await tx.get(ref), old = saved.data();
  if (!saved.exists || old.status !== 'active' || old.expiresAtMs <= now) fail('key_not_active', 409);
  if (!await grantsValid(tx, db, normalizeGrants(old))) fail('invalid_saved_organization_or_team_scope');
  issued = newKey({ ...old, partnerId: old.partnerId || `legacy-${hash(old.keyId).slice(0, 32)}`, partnerName: old.partnerName || 'Legacy partner', grants: normalizeGrants(old), actorEmail: input.actorEmail }, now, input.env); issued.record.replacesKeyId = old.keyId;
  const expiry = Math.min(old.expiresAtMs, now + overlap * 60000);
  tx.update(ref, { status: 'rotating', rotatedAt: new Date(now).toISOString(), expiresAt: new Date(expiry).toISOString(), expiresAtMs: expiry, replacementKeyId: issued.record.keyId });
  tx.set(db.collection(COLLECTIONS.keys).doc(hash(issued.record.keyId)), issued.record);
  writeAudit(tx, db, 'key_rotated', { keyId: old.keyId, replacementKeyId: issued.record.keyId, actorEmail: input.actorEmail, overlapMinutes: overlap }, now);
  return { key: metadata(issued.record), secret: issued.secret };
}
async function rotatePartnerKey(db, input) {
  return db.runTransaction(tx => rotatePartnerKeyInTransaction(tx, db, input));
}
async function updatePartnerKeyGrants(db, input) {
  if (!KEY_ID.test(input.keyId || '') || !input.actorEmail) fail('invalid_key');
  const now = nowValue(input.now), ref = db.collection(COLLECTIONS.keys).doc(hash(input.keyId)); let result;
  await db.runTransaction(async tx => {
    const saved = await tx.get(ref), record = saved.data();
    if (!saved.exists || record.status !== 'active' || record.revokedAt || record.expiresAtMs <= now) fail('key_not_active', 409);
    const scopeMode = input.scopeMode || record.scopeMode || 'explicit';
    if (!['explicit', 'all-athleticmind'].includes(scopeMode)) fail('invalid_scope_mode');
    const grants = validateGrants(input.grants, record.environment);
    if (scopeMode === 'all-athleticmind' && grants.length) fail('invalid_grants');
    if (!await grantsValid(tx, db, grants)) fail('invalid_saved_organization_or_team_scope');
    const predecessors = [];
    let priorId = record.replacesKeyId;
    const visited = new Set([record.keyId]);
    while (priorId) {
      if (!KEY_ID.test(priorId) || visited.has(priorId) || visited.size > 100) fail('invalid_rotation_chain', 409);
      visited.add(priorId);
      const priorRef = db.collection(COLLECTIONS.keys).doc(hash(priorId));
      const prior = await tx.get(priorRef), data = prior.data();
      if (!prior.exists) fail('invalid_rotation_chain', 409);
      if (data.status === 'rotating' && data.expiresAtMs > now) predecessors.push({ ref: priorRef, keyId: priorId });
      priorId = data.replacesKeyId;
    }
    result = { ...record, scopeMode, grants };
    for (const prior of predecessors) {
      tx.update(prior.ref, { status: 'revoked', revokedAt: new Date(now).toISOString(), revokedBy: input.actorEmail });
      writeAudit(tx, db, 'key_revoked_for_grant_change', { keyId: prior.keyId, replacementKeyId: record.keyId, actorEmail: input.actorEmail }, now);
    }
    tx.update(ref, { scopeMode, grants, grantsUpdatedAt: new Date(now).toISOString(), grantsUpdatedBy: input.actorEmail });
    writeAudit(tx, db, 'key_grants_updated', { keyId: record.keyId, partnerId: record.partnerId || null, previousScopeMode: record.scopeMode || 'explicit', scopeMode, previousGrants: normalizeGrants(record), grants, actorEmail: input.actorEmail }, now);
  });
  return { key: metadata(result) };
}
function usable(record, input, now) {
  return record && KEY_ID.test(record.keyId || '') && ['active', 'rotating'].includes(record.status) && !record.revokedAt && Number.isFinite(record.expiresAtMs) && record.expiresAtMs > now && ['test', 'production'].includes(input.environment) && record.environment === input.environment && input.scope === SCOPE && record.scopes?.length === 1 && record.scopes[0] === SCOPE && Number.isInteger(record.maxRequestsPerMinute) && record.maxRequestsPerMinute >= 1 && record.maxRequestsPerMinute <= 300;
}
async function revalidatePartnerPrincipal(db, input) {
  const keyId = input.principal?.keyId, now = nowValue(input.now);
  if (!KEY_ID.test(keyId || '')) return { ok: false, reason: 'invalid_authentication' };
  const doc = await db.collection(COLLECTIONS.keys).doc(hash(keyId)).get(), record = doc.data();
  if (!usable(record, input, now) || record.keyId !== keyId) return { ok: false, reason: 'invalid_authentication' };
  const grant = await requestGrant({ get: ref => ref.get() }, db, record, input.teamId);
  if (!grant || grant.organizationId !== input.principal.organizationId) return { ok: false, reason: 'scope_not_authorized' };
  if (!await scopeValid({ get: ref => ref.get() }, db, grant.organizationId, [input.teamId])) return { ok: false, reason: 'scope_not_authorized' };
  return { ok: true };
}
async function authenticatePartnerRequest(db, input) {
  const now = nowValue(input.now), signature = typeof input.signature === 'string' && input.signature.match(/^t=(\d{10}),v1=([a-f0-9]{64})$/);
  if (!KEY_ID.test(input.keyId || '') || !signature || Math.abs(now / 1000 - Number(signature[1])) > 300 || typeof input.rawBody !== 'string' || typeof input.path !== 'string' || typeof input.method !== 'string') return { ok: false, reason: 'invalid_authentication' };
  const ref = db.collection(COLLECTIONS.keys).doc(hash(input.keyId)), saved = await ref.get(), record = saved.data();
  if (!usable(record, input, now) || record.keyId !== input.keyId) return { ok: false, reason: 'invalid_authentication' };
  let secret; try { secret = decryptSecret(record, input.env); } catch { return { ok: false, reason: 'invalid_authentication' }; }
  const expected = crypto.createHmac('sha256', secret).update(`${signature[1]}.${input.method}.${input.path}.${input.rawBody}`).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature[2], 'hex'))) return { ok: false, reason: 'invalid_authentication' };
  const bucket = Math.floor(now / 60000), rateRef = db.collection(COLLECTIONS.rates).doc(hash(`key:${input.keyId}:${bucket}`));
  return db.runTransaction(async tx => {
    const current = await tx.get(ref), quota = await tx.get(rateRef), data = current.data();
    if (!usable(data, input, now) || data.keyId !== record.keyId || JSON.stringify(data.encryptedSecret) !== JSON.stringify(record.encryptedSecret)) return { ok: false, reason: 'invalid_authentication' };
    const grant = await requestGrant(tx, db, data, input.teamId);
    if (!grant) return { ok: false, reason: 'scope_not_authorized' };
    if (!await scopeValid(tx, db, grant.organizationId, [input.teamId])) return { ok: false, reason: 'scope_not_authorized' };
    if ((quota.data()?.count || 0) >= data.maxRequestsPerMinute) return { ok: false, reason: 'rate_limited' };
    tx.set(rateRef, { keyId: data.keyId, count: (quota.data()?.count || 0) + 1, expiresAt: new Date((bucket + 2) * 60000) });
    writeAudit(tx, db, 'key_authenticated', { keyId: data.keyId, partnerId: data.partnerId || null, organizationId: grant.organizationId, teamId: input.teamId, scope: input.scope, environment: data.environment }, now);
    return { ok: true, principal: { keyId: data.keyId, partnerId: data.partnerId || null, organizationId: grant.organizationId, teamIds: grant.teamIds, scopes: data.scopes, environment: data.environment } };
  });
}
async function listPartnerAccess(db, { cursors = {} } = {}) {
  const read = async (name, cursor, filter) => {
    if (cursor !== undefined && (typeof cursor !== 'string' || !ID.test(cursor))) fail('invalid_cursor');
    let query = db.collection(name); if (filter) query = query.where(...filter);
    query = query.orderBy('__name__'); if (cursor) query = query.startAfter(cursor);
    const result = await query.limit(MAX_LIST + 1).get(), docs = result.docs.slice(0, MAX_LIST);
    return { rows: docs.map(doc => ({ ...doc.data(), id: doc.id })), page: { hasMore: result.docs.length > MAX_LIST, cursor: docs.length ? docs[docs.length - 1].id : null } };
  };
  const [requests, keys, organizations, teams] = await Promise.all([read(COLLECTIONS.requests, cursors.requests), read(COLLECTIONS.keys, cursors.keys), read('pulsecheck-organizations', cursors.organizations, ['productBrand', '==', 'athleticmind']), read('pulsecheck-teams', cursors.teams)]);
  // Scope choices are independently paged; approval always validates the actual saved organization/team.
  const orgs = organizations.rows.filter(org => active(org) && org.productBrand === 'athleticmind');
  return { requests: requests.rows, keys: keys.rows.map(metadata), pagination: { requests: requests.page, keys: keys.page, organizations: organizations.page, teams: teams.page }, scopeOptions: { organizations: orgs.map(org => ({ id: org.id, name: org.name || org.displayName || org.id })), teams: teams.rows.filter(team => active(team)).map(team => ({ id: team.id, name: team.name || team.id, organizationId: team.organizationId })), apis: [SCOPE], environments: ['test', 'production'] } };
}

module.exports = { rotatePartnerKeyInTransaction, revealPartnerKey, decryptPartnerKeySecret: decryptSecret, updatePartnerKeyGrants, normalizeGrants, COLLECTIONS, SCOPE, requestPartnerAccess, approvePartnerAccessRequest, rotatePartnerKey, revokePartnerKey, listPartnerAccess, authenticatePartnerRequest, revalidatePartnerPrincipal };
