const crypto = require('node:crypto');
const { consentAndScopeMatch, isSnapshotReplayPermitted } = require('./athleticmind-snapshot-delivery');
const { assembleAthleticMindSnapshot, checkAthleticMindSnapshotEligibility } = require('./athleticmind-snapshot');

const PATH = '/.netlify/functions/auntedna-snapshot-pull';
const REQUESTS = 'athleticmind-snapshot-pulls';
const SNAPSHOTS = 'athleticmind-snapshots';
const MAX_BYTES = 512 * 1024;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const header = (event, name) => String(Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name)?.[1] || '');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function authenticatePull(event, rawBody, env, now) {
  if (env.ATHLETICMIND_SNAPSHOT_PULL_LEGACY_AUTH_ENABLED !== 'true' || !['test', 'production'].includes(env.PARTNER_API_ENVIRONMENT)) return null;
  let clients;
  try { clients = JSON.parse(env.ATHLETICMIND_SNAPSHOT_PULL_CLIENTS_JSON || '{}'); } catch { return null; }
  if (!clients || typeof clients !== 'object' || Array.isArray(clients)) return null;
  const keyId = header(event, 'x-auntedna-key-id');
  const client = Object.prototype.hasOwnProperty.call(clients, keyId) ? clients[keyId] : null;
  if (!client || client.environment !== env.PARTNER_API_ENVIRONMENT || keyId.startsWith('pk_') || !ID.test(keyId) || !ID.test(client.organizationId || '') || !Array.isArray(client.teamIds) || !client.teamIds.every(id => ID.test(id))) return null;
  const secret = typeof client.secretEnv === 'string' ? env[client.secretEnv] : null;
  if (typeof secret !== 'string' || secret.length < 32) return null;
  const signature = header(event, 'x-auntedna-signature').match(/^t=(\d{10}),v1=([a-f0-9]{64})$/);
  if (!signature || Math.abs(now / 1000 - Number(signature[1])) > 300) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${signature[1]}.POST.${PATH}.${rawBody}`).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature[2], 'hex'))) return null;
  return { keyId, organizationId: client.organizationId, teamIds: client.teamIds, environment: client.environment, legacy: true };
}

function parsePullRequest(rawBody, now) {
  const value = JSON.parse(rawBody);
  if (!value || Array.isArray(value) || Object.keys(value).some(key => !['requestId', 'teamId', 'athleteId', 'windowStart', 'windowEnd'].includes(key))) throw new Error('invalid_request');
  if (![value.requestId, value.teamId, value.athleteId].every(id => typeof id === 'string' && ID.test(id))) throw new Error('invalid_request');
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
  if (![value.windowStart, value.windowEnd].every(value => typeof value === 'string' && iso.test(value))) throw new Error('invalid_window');
  const start = Date.parse(value.windowStart), end = Date.parse(value.windowEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end > now || end - start > 7 * 86400000) throw new Error('invalid_window');
  return value;
}

function snapshotMatchesRequest(snapshot, input, organizationId, environment = 'production') {
  return snapshot?.schemaVersion === 'athleticmind-snapshot-v1' && snapshot.synthetic === (environment === 'test')
    && /^[a-f0-9]{64}$/.test(snapshot.snapshotId || '')
    && snapshot.scope?.organizationId === organizationId && snapshot.scope?.teamId === input.teamId
    && snapshot.scope?.athleteId === input.athleteId && ID.test(snapshot.scope?.membershipId || '')
    && snapshot.window?.start === new Date(input.windowStart).toISOString()
    && snapshot.window?.end === new Date(input.windowEnd).toISOString();
}

function createSnapshotPullHandler({ getDb, env = process.env, now = () => Date.now(), assemble = assembleAthleticMindSnapshot, checkEligibility = checkAthleticMindSnapshotEligibility }) {
  return async event => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (env.ATHLETICMIND_SNAPSHOT_PULL_ENABLED !== 'true') return json(503, { error: 'snapshot_pull_disabled' });
    const at = now();
    const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : String(event.body || '');
    if (Buffer.byteLength(rawBody) > 8192) return json(413, { error: 'request_too_large' });
    const environment = env.PARTNER_API_ENVIRONMENT;
    if (!['test', 'production'].includes(environment)) return json(503, { error: 'partner_environment_unconfigured' });
    const keyId = header(event, 'x-auntedna-key-id');
    const managed = keyId.startsWith('pk_');
    let principal = managed ? null : authenticatePull(event, rawBody, env, at);
    if (!managed && !principal) return json(401, { error: 'invalid_authentication' });
    let input;
    try { input = parsePullRequest(rawBody, at); } catch { return json(400, { error: 'invalid_request_or_window' }); }
    if (principal && !principal.teamIds.includes(input.teamId)) return json(403, { error: 'scope_not_authorized' });
    try {
      const db = await getDb(); // No client-selected Firebase environment.
      const keyService = managed ? require('./partner-api-keys') : null;
      const authentication = { keyId, signature: header(event, 'x-auntedna-signature'), method: 'POST', path: PATH, rawBody, scope: 'athleticmind.snapshot.read', environment, teamId: input.teamId, now: at, env };
      if (managed) {
        const result = await keyService.authenticatePartnerRequest(db, authentication);
        if (!result.ok) return json(result.reason === 'rate_limited' ? 429 : result.reason === 'scope_not_authorized' ? 403 : 401, { error: result.reason });
        principal = result.principal;
      }
      if (!managed) {
        const bucket = Math.floor(at / 60000);
        const rateRef = db.collection('partner-api-key-rate-limits').doc(hash(`legacy:${environment}:${principal.keyId}:${bucket}`));
        const allowed = await db.runTransaction(async tx => {
          const quota = await tx.get(rateRef);
          const count = Number(quota.data()?.count || 0);
          if (!Number.isFinite(count) || count >= 30) return false;
          tx.set(rateRef, { count: count + 1, expiresAt: new Date((bucket + 2) * 60000) });
          tx.set(db.collection('partner-api-key-audit').doc(crypto.randomUUID()), { action: 'legacy_key_authenticated', keyId: principal.keyId, organizationId: principal.organizationId, teamId: input.teamId, scope: 'athleticmind.snapshot.read', environment, createdAt: new Date(at).toISOString() });
          return true;
        });
        if (!allowed) return json(429, { error: 'rate_limited' });
      }
      if (!principal.teamIds.includes(input.teamId) || principal.environment !== environment) return json(403, { error: 'scope_not_authorized' });
      if (environment === 'test' && ![principal.organizationId, input.teamId, input.athleteId].every(value => value.startsWith('synthetic-'))) return json(403, { error: 'synthetic_scope_required' });
      if (environment === 'test' && (assemble === assembleAthleticMindSnapshot || checkEligibility === checkAthleticMindSnapshotEligibility)) return json(503, { error: 'synthetic_fixture_source_unconfigured' });
      const accessStillValid = async () => !managed || (await keyService.revalidatePartnerPrincipal(db, { ...authentication, principal, now: now() })).ok;

      const team = await db.collection('pulsecheck-teams').doc(input.teamId).get();
      const data = team.exists ? team.data() : {};
      if (data.organizationId !== principal.organizationId) return json(403, { error: 'scope_not_authorized' });
      const delivery = data.snapshotDelivery;
      if (delivery?.pullEnabled !== true || delivery?.receiver?.status !== 'verified' || !delivery?.receiver?.verifiedAt || !delivery?.receiver?.verifiedBy || delivery?.receiver?.contractVersion !== 'athleticmind-snapshot-v1') return json(503, { error: 'program_snapshot_pull_disabled' });
      const eligibility = await checkEligibility(db, { teamId: input.teamId, athleteId: input.athleteId, now: at });
      if (!eligibility.eligible || eligibility.scope?.organizationId !== principal.organizationId) return json(403, { error: 'athlete_not_eligible' });
      const requestKey = hash(`${principal.keyId}:${input.requestId}`);
      const requestRef = db.collection(REQUESTS).doc(requestKey);
      const requestHash = hash(JSON.stringify(input));
      const owner = crypto.randomUUID();
      const claim = await db.runTransaction(async tx => {
        const previous = await tx.get(requestRef);
        const record = previous.exists ? previous.data() : null;
        if (record && record.requestHash !== requestHash) return { error: 'request_id_conflict' };
        if (record?.expiresAtMs <= at) return { error: 'request_id_expired' };
        if (record?.status === 'complete') return { cached: record };
        if (record?.status === 'assembling' && record.leaseUntil > at) return { error: 'request_in_progress' };
        tx.set(requestRef, { requestHash, keyId: principal.keyId, teamId: input.teamId, athleteId: input.athleteId, organizationId: principal.organizationId, status: 'assembling', owner, leaseUntil: at + 120000, createdAtMs: record?.createdAtMs || at, expiresAtMs: record?.expiresAtMs || at + 86400000 }, { merge: true });
        return { claimed: true };
      });
      if (claim.error) return json(409, { error: claim.error });
      if (claim.cached) {
        if (claim.cached.consentEventId !== eligibility.consent?.eventId) return json(409, { error: 'consent_changed_use_new_request_id' });
        const saved = await db.collection(SNAPSHOTS).doc(claim.cached.snapshotId).get();
        if (!saved.exists || saved.data().expiresAtMs <= at) return json(410, { error: 'snapshot_expired_use_new_request_id' });
        const frozen = saved.data().snapshot;
        if (!snapshotMatchesRequest(frozen, input, principal.organizationId, environment) || frozen.snapshotId !== claim.cached.snapshotId || Buffer.byteLength(JSON.stringify(frozen)) > MAX_BYTES) return json(403, { error: 'cached_snapshot_invalid' });
        const current = await assemble(db, { ...input, now: now() });
        if (!current.eligible || !snapshotMatchesRequest(current.snapshot, input, principal.organizationId, environment) || !isSnapshotReplayPermitted(frozen, current.snapshot)) return json(409, { error: 'snapshot_sources_changed_use_new_request_id' });
        const finalEligibility = await checkEligibility(db, { teamId: input.teamId, athleteId: input.athleteId, now: now() });
        if (!finalEligibility.eligible || !consentAndScopeMatch(frozen, finalEligibility)) return json(403, { error: 'consent_changed' });
        if (!await accessStillValid()) return json(401, { error: 'invalid_authentication' });
        return json(200, { snapshot: frozen, receipt: { requestId: input.requestId, snapshotId: claim.cached.snapshotId, replayed: true } });
      }
      try {
        const assembled = await assemble(db, { ...input, now: at });
        const snapshot = assembled.snapshot;
        if (!assembled.eligible || !snapshotMatchesRequest(snapshot, input, principal.organizationId, environment) || !isSnapshotReplayPermitted(snapshot, snapshot)) throw Object.assign(new Error('athlete_not_eligible'), { statusCode: 403 });
        if (Buffer.byteLength(JSON.stringify(snapshot)) > MAX_BYTES) throw Object.assign(new Error('snapshot_too_large_narrow_window'), { statusCode: 413 });
        // Revalidate immediately before releasing data, including a concurrent withdrawal.
        const finalEligibility = await checkEligibility(db, { teamId: input.teamId, athleteId: input.athleteId, now: now() });
        if (!finalEligibility.eligible || !consentAndScopeMatch(snapshot, finalEligibility)) throw Object.assign(new Error('consent_changed'), { statusCode: 403 });
        let responseSnapshot = snapshot;
        await db.runTransaction(async tx => {
          const current = await tx.get(requestRef);
          const snapshotRef = db.collection(SNAPSHOTS).doc(snapshot.snapshotId);
          const previousSnapshot = await tx.get(snapshotRef);
          if (current.data()?.owner !== owner) throw Object.assign(new Error('request_lease_lost'), { statusCode: 409 });
          const previous = previousSnapshot.exists ? previousSnapshot.data() : null;
          if (previous && previous.expiresAtMs > at) {
            if (!snapshotMatchesRequest(previous.snapshot, input, principal.organizationId, environment) || !isSnapshotReplayPermitted(previous.snapshot, snapshot)) throw Object.assign(new Error('cached_snapshot_changed'), { statusCode: 409 });
            responseSnapshot = previous.snapshot;
          }
          const expiresAtMs = Math.max(previous?.expiresAtMs || 0, at + 86400000);
          tx.set(snapshotRef, { snapshot: responseSnapshot, expiresAtMs, expiresAt: new Date(expiresAtMs), createdAtMs: previous?.createdAtMs || at });
          tx.set(requestRef, { status: 'complete', snapshotId: snapshot.snapshotId, consentEventId: snapshot.consent.eventId, completedAtMs: at, leaseUntil: 0 }, { merge: true });
        });
        const releaseEligibility = await checkEligibility(db, { teamId: input.teamId, athleteId: input.athleteId, now: now() });
        if (!releaseEligibility.eligible || !consentAndScopeMatch(responseSnapshot, releaseEligibility)) throw Object.assign(new Error('consent_changed'), { statusCode: 403 });
        if (!await accessStillValid()) throw Object.assign(new Error('invalid_authentication'), { statusCode: 401 });
        // Pull is an immutable read receipt, never scheduled-delivery acknowledgement.
        return json(200, { snapshot: responseSnapshot, receipt: { requestId: input.requestId, snapshotId: snapshot.snapshotId, replayed: false } });
      } catch (error) {
        await db.runTransaction(async tx => {
          const current = await tx.get(requestRef);
          if (current.data()?.owner === owner) tx.set(requestRef, { status: 'failed', leaseUntil: 0, failureCode: error.statusCode ? error.message : 'snapshot_unavailable' }, { merge: true });
        });
        return json(error.statusCode || 503, { error: error.statusCode ? error.message : 'snapshot_unavailable' });
      }
    } catch { return json(503, { error: 'snapshot_unavailable' }); }
  };
}

// Sandbox source reads only configured program metadata, never athlete records.
async function sandboxEligibility(db, { teamId, athleteId }) {
  if (![teamId, athleteId].every(id => typeof id === 'string' && /^synthetic-[A-Za-z0-9_-]+$/.test(id))) return { eligible: false };
  const team = await db.collection('pulsecheck-teams').doc(teamId).get();
  const organizationId = team.data()?.organizationId;
  if (!team.exists || typeof organizationId !== 'string' || !organizationId.startsWith('synthetic-')) return { eligible: false };
  return { eligible: true, scope: { teamId, athleteId, organizationId, membershipId: `synthetic-${hash(`${teamId}:${athleteId}`).slice(0, 32)}` }, consent: { id: 'athleticmind-automated-processing', version: 'v1', eventId: 'synthetic-consent-event', latestEvidenceEventId: 'synthetic-consent-event', acceptedAt: '2000-01-01T00:00:00.000Z', documentHash: hash('Synthetic sandbox agreement only') } };
}
async function assembleSandboxSnapshot(db, input) {
  const eligibility = await sandboxEligibility(db, input);
  if (!eligibility.eligible) return eligibility;
  const start = new Date(input.windowStart).toISOString(), end = new Date(input.windowEnd).toISOString();
  const message = { sourceId: 'synthetic-conversation/synthetic-message', conversationId: 'synthetic-conversation', speaker: 'athlete', text: 'Synthetic example: I am planning a steady start to practice.', eventAt: start, sourceIngestedAt: start };
  message.revision = hash(JSON.stringify(message));
  const snapshot = { schemaVersion: 'athleticmind-snapshot-v1', synthetic: true, scope: eligibility.scope, window: { start, end }, consent: eligibility.consent,
    onboarding: { sourceId: 'synthetic-onboarding', formVersion: 'synthetic-v1', completedAt: '2000-01-01T00:00:00.000Z', responses: { synthetic_goal: 'Practice integration with fictional data.' } },
    checkIns: [], noraMessages: [message], supportStatus: [],
    coverage: { missing: ['synthetic_fixture_only'], optionalSourcesIncluded: [], completeFullNoraTranscript: false },
    summary: { method: 'deterministic_counts_only', checkInCount: 0, checkInLevelCounts: {}, noraMessageCount: 1, athleteMessageCount: 1, supportStatusCount: 0, latestSourceEventAt: start, sourceAgeAtWindowEndMs: Date.parse(end) - Date.parse(start) },
    ingestion: { selection: 'event_time_or_firestore_document_update_time', deduplicationKey: 'sourceId_and_revision', requiresRevisionDeduplication: true } };
  snapshot.snapshotId = hash(JSON.stringify(snapshot));
  snapshot.generatedAt = end;
  return { eligible: true, reasonCodes: [], snapshot };
}
function createDeployedSnapshotPullHandler({ getDb, env = process.env, now } = {}) {
  const sandbox = env.PARTNER_API_ENVIRONMENT === 'test' && env.ATHLETICMIND_SNAPSHOT_SANDBOX_ENABLED === 'true';
  return createSnapshotPullHandler({ getDb, env, ...(now ? { now } : {}), ...(sandbox ? { assemble: assembleSandboxSnapshot, checkEligibility: sandboxEligibility } : {}) });
}
module.exports = { createSnapshotPullHandler, createDeployedSnapshotPullHandler, authenticatePull, parsePullRequest, PATH, MAX_BYTES };
