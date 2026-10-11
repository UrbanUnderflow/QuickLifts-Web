const { createHash, randomUUID } = require('node:crypto');
const { createClinicalBridge, resolveClinicalBridgeConfig } = require('./clinical-bridge');

const DELIVERY_COLLECTION = 'athleticmind-snapshot-deliveries';
const WATERMARK_COLLECTION = 'athleticmind-snapshot-watermarks';
const LEASE_MS = 120000;
const MAX_ENVELOPE_BYTES = 512 * 1024;
const SCHEMA_VERSION = 'athleticmind-snapshot-v1';
const hash = value => createHash('sha256').update(value).digest('hex');
const iso = value => new Date(value).toISOString();
function millis(value) {
  const result = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(result)) throw new Error('Invalid snapshot timestamp.');
  return result;
}
function scheduleConfig(input = {}) {
  if (typeof input.timeZone !== 'string' || !input.timeZone.trim()) throw new Error('An explicit program IANA time zone is required.');
  const timeZone = input.timeZone.trim();
  if (/^[+-]/.test(timeZone)) throw new Error('An IANA time zone, not a fixed offset, is required.');
  new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
  const cutoff = input.cutoff || '00:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)) throw new Error('Daily cutoff must be HH:mm.');
  const lookbackHours = input.lookbackHours ?? 48;
  if (!Number.isInteger(lookbackHours) || lookbackHours < 0 || lookbackHours > 168) throw new Error('Lookback must be an integer between 0 and 168 hours.');
  return { timeZone, cutoff, lookbackHours };
}
function dateParts(formatter, instant) {
  return Object.fromEntries(formatter.formatToParts(instant).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
function previousDate(date) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day - 1)).toISOString().slice(0, 10);
}
function localCutoff(date, cutoff, formatter) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = cutoff.split(':').map(Number);
  const approximate = Date.UTC(year, month - 1, day, hour, minute);
  let nextWallMinute = Infinity;
  let nextInstant;
  // Minute precision deliberately covers 23/25-hour days and non-hour offsets.
  // Fold: first occurrence. Gap: first available local minute after the cutoff.
  for (let instant = approximate - 18 * 3600000; instant <= approximate + 18 * 3600000; instant += 60000) {
    const p = dateParts(formatter, instant);
    if (p.year !== year || p.month !== month || p.day !== day) continue;
    const wallMinute = p.hour * 60 + p.minute;
    if (wallMinute === hour * 60 + minute) return instant;
    if (wallMinute > hour * 60 + minute && wallMinute < nextWallMinute) {
      nextWallMinute = wallMinute;
      nextInstant = instant;
    }
  }
  if (nextInstant === undefined) throw new Error('Program local date has no supported cutoff.');
  return nextInstant;
}
function getDailySnapshotWindow(input, now = Date.now()) {
  const config = scheduleConfig(input);
  const instant = millis(now);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const current = dateParts(formatter, instant);
  let date = `${current.year}-${String(current.month).padStart(2, '0')}-${String(current.day).padStart(2, '0')}`;
  let end = localCutoff(date, config.cutoff, formatter);
  if (end > instant) {
    date = previousDate(current);
    end = localCutoff(date, config.cutoff, formatter);
  }
  const [year, month, day] = date.split('-').map(Number);
  const start = localCutoff(previousDate({ year, month, day }), config.cutoff, formatter);
  return { windowStart: iso(start), windowEnd: iso(end), timeZone: config.timeZone, cutoff: config.cutoff, lookbackHours: config.lookbackHours };
}
function verifiedDestination(teamConfig, bridgeConfig, env) {
  const receiver = teamConfig.receiver || {};
  const path = env.CLINICAL_BRIDGE_SNAPSHOT_PATH;
  if (env.ATHLETICMIND_SNAPSHOT_PUSH_ENABLED !== 'true' || teamConfig.enabled !== true) return null;
  if (bridgeConfig.provider !== 'auntedna' || bridgeConfig.credentialMode !== 'live' || !bridgeConfig.apiKey) return null;
  if (receiver.status !== 'verified' || receiver.contractVersion !== SCHEMA_VERSION || !receiver.verifiedAt || !receiver.verifiedBy) return null;
  if (!path || !/^\/[a-zA-Z0-9/_-]+$/.test(path) || receiver.path !== path || receiver.baseUrl !== bridgeConfig.baseUrl) return null;
  let url;
  try { url = new URL(bridgeConfig.baseUrl); } catch { return null; }
  if (url.protocol !== 'https:' || /^\[|^[\d.]+$/.test(url.hostname) || url.username || url.password || url.search || url.hash || /(^|\.)(localhost|invalid|test|example)(\.|$)/i.test(url.hostname)) return null;
  return { path, baseUrl: bridgeConfig.baseUrl, contractVersion: receiver.contractVersion };
}
function verifiedReceipt(response, snapshotId, mode) {
  const data = response?.data;
  return mode === 'live' && response?.success === true && response?.ok === true
    && response.httpStatus >= 200 && response.httpStatus < 300
    && data?.snapshotId === snapshotId && typeof data.receiptId === 'string' && data.receiptId.trim().length > 0
    && ['accepted', 'stored'].includes(data.status);
}

function consentAndScopeMatch(snapshot, current) {
  return current?.eligible !== false
    && ['teamId', 'organizationId', 'athleteId', 'membershipId'].every(key => snapshot.scope?.[key] && snapshot.scope[key] === current.scope?.[key])
    && ['id', 'version', 'eventId', 'acceptedAt', 'documentHash'].every(key => snapshot.consent?.[key] && snapshot.consent[key] === current.consent?.[key]);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function isSnapshotReplayPermitted(frozen, current) {
  if (!frozen || !current || frozen.schemaVersion !== SCHEMA_VERSION || current.schemaVersion !== SCHEMA_VERSION
    || frozen.window?.start !== current.window?.start || frozen.window?.end !== current.window?.end
    || !consentAndScopeMatch(frozen, current)) return false;
  // Replaying a frozen payload may omit newly available items, but may never
  // resurrect a removed/restricted source or an outdated source revision.
  for (const field of ['checkIns', 'noraMessages', 'supportStatus']) {
    if (!Array.isArray(frozen[field]) || !Array.isArray(current[field])) return false;
    const permitted = new Set(current[field].map(item => `${item.sourceId}\n${item.revision}`));
    if (frozen[field].some(item => !item.sourceId || !item.revision || !permitted.has(`${item.sourceId}\n${item.revision}`))) return false;
  }
  return JSON.stringify(canonical(frozen.onboarding)) === JSON.stringify(canonical(current.onboarding));
}

async function deliverAthleticMindSnapshot(db, input, dependencies = {}) {
  const env = dependencies.env || process.env;
  const clock = dependencies.clock || Date.now;
  const now = input.now ?? clock();
  const teamSnapshot = await db.collection('pulsecheck-teams').doc(input.teamId).get();
  const team = teamSnapshot.exists ? teamSnapshot.data() : null;
  if (!team?.organizationId) return { status: 'blocked', reason: 'program_scope_missing' };
  const orgSnapshot = await db.collection('pulsecheck-organizations').doc(team.organizationId).get();
  if (!orgSnapshot.exists || orgSnapshot.data()?.productBrand !== 'athleticmind') return { status: 'blocked', reason: 'athleticmind_program_required' };
  const config = team.snapshotDelivery || {};
  const mode = dependencies.mode === 'synthetic' ? 'synthetic' : 'live';
  const bridgeConfig = dependencies.bridgeConfig || resolveClinicalBridgeConfig();
  const destination = verifiedDestination(config, bridgeConfig, env);
  if (mode === 'live' && !destination) return { status: 'disabled', reason: 'verified_snapshot_destination_required' };
  if (mode === 'synthetic' && (!/^synthetic[-_]/.test(input.teamId) || !/^synthetic[-_]/.test(input.athleteId) || typeof dependencies.assemble !== 'function' || typeof dependencies.checkEligibility !== 'function' || typeof dependencies.syntheticTransport !== 'function')) {
    throw new Error('Synthetic delivery requires synthetic scope, assembler, and isolated transport.');
  }
  const checkEligibility = dependencies.checkEligibility || require('./athleticmind-snapshot').checkAthleticMindSnapshotEligibility;
  const eligibility = await checkEligibility(db, { teamId: input.teamId, athleteId: input.athleteId, now });
  if (eligibility?.eligible !== true || !eligibility.consent?.acceptedAt || !eligibility.consent?.eventId) return { status: 'blocked', reason: 'snapshot_not_eligible', reasonCodes: eligibility?.reasonCodes || [] };
  const acceptedAt = millis(eligibility.consent.acceptedAt);
  const daily = getDailySnapshotWindow(config, now);
  const end = input.windowEnd === undefined ? millis(daily.windowEnd) : millis(input.windowEnd);
  const scopeId = hash(`${input.teamId}\n${input.athleteId}`);
  const watermarkRef = db.collection(WATERMARK_COLLECTION).doc(scopeId);
  const priorWatermark = mode === 'live' ? await watermarkRef.get() : null;
  const previousWatermark = priorWatermark?.exists ? priorWatermark.data() : null;
  if (previousWatermark && (previousWatermark.organizationId !== team.organizationId || previousWatermark.teamId !== input.teamId || previousWatermark.athleteId !== input.athleteId)) return { status: 'blocked', reason: 'watermark_scope_changed' };
  const deliveredThrough = previousWatermark?.consentEventId === eligibility.consent.eventId ? millis(previousWatermark.deliveredThrough) : null;
  if (acceptedAt >= end) return { status: 'not_due', reason: 'acceptance_after_latest_cutoff' };
  if (input.windowStart === undefined && deliveredThrough !== null && deliveredThrough >= end) return { status: 'already_current', deliveredThrough: iso(deliveredThrough) };
  const start = input.windowStart === undefined ? deliveredThrough ?? acceptedAt : millis(input.windowStart);
  if (start >= end || end > millis(now)) throw new Error('Snapshot window must be closed and end no later than now.');
  if (end - start > 7 * 86400000 || (deliveredThrough !== null && start > deliveredThrough)) return { status: 'blocked', reason: 'operator_backfill_required', gapStart: deliveredThrough === null ? iso(start) : iso(deliveredThrough), gapEnd: iso(end) };
  const scanStart = Math.max(acceptedAt, start - daily.lookbackHours * 3600000, end - 7 * 86400000);
  const jobId = hash(`${mode}\n${scopeId}\n${iso(start)}\n${iso(end)}`);
  const jobRef = db.collection(DELIVERY_COLLECTION).doc(jobId);
  const leaseOwner = randomUUID();
  const claimed = await db.runTransaction(async transaction => {
    const previous = await transaction.get(jobRef);
    const data = previous.exists ? previous.data() : {};
    if (data.status === 'delivered') return { status: 'already_delivered', snapshotId: data.snapshotId };
    if (data.leaseUntil > clock()) return { status: 'busy' };
    transaction.set(jobRef, {
      teamId: input.teamId, athleteId: input.athleteId, organizationId: team.organizationId, mode,
      windowStart: iso(start), windowEnd: iso(end), scanStart: iso(scanStart), reconciliationRequired: true, status: 'assembling', leaseOwner, leaseUntil: clock() + LEASE_MS,
      attempts: (data.attempts || 0) + 1, updatedAt: iso(clock()),
    }, { merge: true });
    return { status: 'claimed', envelope: data.envelope || null };
  });
  if (claimed.status !== 'claimed') return claimed;
  try {
    let envelope = claimed.envelope;
    let currentSnapshot;
    {
      // Eligibility is rechecked even when replaying an immutable outbox payload.
      // A revoked or outdated consent must block a retry after an outage.
      const assemble = dependencies.assemble || require('./athleticmind-snapshot').assembleAthleticMindSnapshot;
      const assembled = await assemble(db, {
        teamId: input.teamId, athleteId: input.athleteId,
        windowStart: iso(scanStart), windowEnd: iso(end), now,
      });
      if (assembled?.eligible !== true || !assembled.snapshot) {
        await db.runTransaction(async transaction => {
          const job = await transaction.get(jobRef);
          if (job.data()?.leaseOwner === leaseOwner) transaction.set(jobRef, { status: 'blocked', leaseUntil: 0, failureReason: 'snapshot_not_eligible' }, { merge: true });
        });
        return { status: 'blocked', reason: 'snapshot_not_eligible', reasonCodes: assembled?.reasonCodes || [] };
      }
      currentSnapshot = assembled.snapshot;
      if (!envelope) envelope = currentSnapshot;
    }
    if (!envelope || typeof envelope.snapshotId !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.snapshotId)) throw new Error('Assembler did not provide a stable snapshot ID.');
    if (mode === 'live' && envelope.synthetic !== false) throw new Error('Live delivery requires a real, eligible snapshot envelope.');
    if (mode === 'synthetic' && envelope.synthetic !== true) throw new Error('Synthetic transport requires an explicitly synthetic envelope.');
    if (envelope.schemaVersion !== SCHEMA_VERSION
      || envelope.scope?.teamId !== input.teamId || envelope.scope?.athleteId !== input.athleteId
      || envelope.scope?.organizationId !== team.organizationId || !envelope.scope?.membershipId
      || envelope.window?.start !== iso(scanStart) || envelope.window?.end !== iso(end)) {
      throw new Error('Snapshot envelope does not match the verified dispatch scope and window.');
    }
    if (!envelope.consent?.eventId || !envelope.consent?.documentHash
      || ['id', 'version', 'eventId', 'acceptedAt', 'documentHash'].some(key => envelope.consent[key] !== currentSnapshot.consent?.[key])) {
      throw Object.assign(new Error('Snapshot consent changed.'), { snapshotFailure: 'consent_changed' });
    }
    if (!isSnapshotReplayPermitted(envelope, currentSnapshot)) throw Object.assign(new Error('Snapshot sources changed.'), { snapshotFailure: 'snapshot_sources_changed' });
    if (Buffer.byteLength(JSON.stringify(envelope)) > MAX_ENVELOPE_BYTES) throw new Error('Snapshot exceeds durable outbox limit; pagination is required before delivery.');
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(jobRef);
      if (snapshot.data()?.leaseOwner !== leaseOwner) throw new Error('Snapshot delivery lease was lost.');
      transaction.set(jobRef, { envelope, snapshotId: envelope.snapshotId, status: 'sending', leaseUntil: clock() + LEASE_MS }, { merge: true });
    });
    const finalEligibility = await checkEligibility(db, { teamId: input.teamId, athleteId: input.athleteId, now: clock() });
    if (finalEligibility?.eligible !== true || !consentAndScopeMatch(envelope, finalEligibility)) throw Object.assign(new Error('Snapshot consent changed.'), { snapshotFailure: 'consent_changed' });
    const response = mode === 'synthetic'
      ? await dependencies.syntheticTransport(envelope, { idempotencyKey: envelope.snapshotId })
      : await (dependencies.bridgeFactory || createClinicalBridge)(bridgeConfig).request('POST', destination.path, envelope, {
        headers: { 'Idempotency-Key': envelope.snapshotId, 'X-Snapshot-Contract': destination.contractVersion },
      });
    const delivered = verifiedReceipt(response, envelope.snapshotId, mode);
    await db.runTransaction(async transaction => {
      const job = await transaction.get(jobRef);
      const watermark = delivered ? await transaction.get(watermarkRef) : null;
      if (job.data()?.leaseOwner !== leaseOwner) throw new Error('Snapshot delivery lease was lost after transport.');
      transaction.set(jobRef, {
        status: delivered ? 'delivered' : mode === 'synthetic' ? 'simulated' : 'failed',
        leaseUntil: 0, updatedAt: iso(clock()),
        receipt: delivered ? { snapshotId: envelope.snapshotId, receiptId: response.data.receiptId, status: response.data.status, verifiedAt: iso(clock()) } : null,
        failureReason: delivered ? null : mode === 'synthetic' ? 'simulation_only' : 'unverified_receiver_receipt',
      }, { merge: true });
      if (delivered) {
        const previousEnd = watermark?.exists && watermark.data().consentEventId === envelope.consent.eventId ? millis(watermark.data().deliveredThrough) : -Infinity;
        if (end > previousEnd) transaction.set(watermarkRef, {
          teamId: input.teamId, athleteId: input.athleteId, organizationId: team.organizationId,
          deliveredThrough: iso(end), consentEventId: envelope.consent.eventId, snapshotId: envelope.snapshotId, receiptId: response.data.receiptId, updatedAt: iso(clock()),
        });
      }
    });
    return { status: delivered ? 'delivered' : mode === 'synthetic' ? 'simulated' : 'failed', snapshotId: envelope.snapshotId, jobId };
  } catch (error) {
    const blockedReason = ['snapshot_sources_changed', 'consent_changed'].includes(error?.snapshotFailure) ? error.snapshotFailure : null;
    await db.runTransaction(async transaction => {
      const job = await transaction.get(jobRef);
      if (job.data()?.leaseOwner === leaseOwner) transaction.set(jobRef, { status: blockedReason ? 'blocked' : 'failed', leaseUntil: 0, updatedAt: iso(clock()), failureReason: blockedReason || 'delivery_attempt_failed' }, { merge: true });
    });
    // Do not log partner errors or payloads: they can contain private data.
    return { status: blockedReason ? 'blocked' : 'failed', reason: blockedReason || 'delivery_attempt_failed', jobId };
  }
}
module.exports = { consentAndScopeMatch, isSnapshotReplayPermitted, DELIVERY_COLLECTION, WATERMARK_COLLECTION, MAX_ENVELOPE_BYTES, getDailySnapshotWindow, verifiedDestination, verifiedReceipt, deliverAthleticMindSnapshot };
