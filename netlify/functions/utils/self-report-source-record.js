// =============================================================================
// Self-Report Source Record helper for Netlify functions (CJS).
//
// Mirrors the TS-side `athleteSelfReport.ingestSelfReportSubmission` side
// effect in CommonJS so the existing PulseCheck check-in handler can call
// it after persisting a check-in. When an athlete has no connected
// wearable, their structured check-in answers (energyLevel, stressLevel,
// sleepQuality, etc.) get rewritten as canonical Health Context Source
// Records under `sourceFamily: 'pulsecheck_self_report'`. The snapshot
// assembler then treats self-report as a first-class lane.
//
// Confidence policy honors the spec rule: self-reported data caps at
// `emerging` (no wearable) or `directional` (when a wearable is also
// present and self-report is supplementing).
// =============================================================================

const HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION = 'health-context-source-records';
const HEALTH_CONTEXT_SOURCE_STATUS_COLLECTION = 'health-context-source-status';
const SOURCE_RECORD_CONTRACT_VERSION = '1.0';

// Wearable source families that, when `connected_synced`, should
// downgrade the self-report record to `directional` confidence.
const WEARABLE_SOURCE_FAMILIES = ['oura', 'apple_health', 'polar', 'whoop', 'garmin'];

const nowSeconds = () => Math.round(Date.now() / 1000);

const dayWindowSeconds = (sourceDate) => {
  const start = new Date(`${sourceDate}T00:00:00Z`).getTime();
  const end = new Date(`${sourceDate}T23:59:59Z`).getTime();
  return {
    startSec: Math.round((Number.isFinite(start) ? start : Date.now()) / 1000),
    endSec: Math.round((Number.isFinite(end) ? end : Date.now()) / 1000),
  };
};

const clampNumber = (value, min, max) => {
  if (value === undefined || value === null) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(min, Math.min(max, numeric));
};

const buildRecordId = (userId, family, domain, dateKey) =>
  `${userId}_${family}_${domain}_${dateKey}`;

const buildDedupeKey = (userId, family, domain, dateKey) =>
  `${userId}|${family}|${domain}|${dateKey}`;

const compactPayload = (entries) => {
  const result = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null) continue;
    result[key] = value;
  }
  return result;
};

/**
 * Checks `health-context-source-status/{userId}` for any wearable family
 * with status `connected_synced`. Returns `false` (no wearable) when the
 * status doc is missing or no wearable is connected.
 */
async function athleteHasConnectedWearable(db, userId) {
  if (!db || !userId) return false;
  try {
    const snap = await db.collection(HEALTH_CONTEXT_SOURCE_STATUS_COLLECTION).doc(userId).get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    const sourceStatuses = data.sourceStatuses || data;
    return WEARABLE_SOURCE_FAMILIES.some((family) => {
      const status = sourceStatuses?.[family];
      if (typeof status === 'string') return status === 'connected_synced';
      if (status && typeof status === 'object') return status.status === 'connected_synced';
      return false;
    });
  } catch (error) {
    console.warn('[self-report-source-record] athleteHasConnectedWearable failed:', error?.message || error);
    return false;
  }
}

/**
 * Build the recovery + behavioral domain payloads from check-in answers.
 * Returns an object keyed by HCSR domain id whose values are payloads
 * suitable for the source-record writer.
 */
function buildSelfReportPayloads({ readinessScore, energyLevel, stressLevel, sleepQuality, perceivedRpe }) {
  // sleepQuality 1–5 → sleepEfficiencyProxy 0–1
  const sleepEfficiencyProxy =
    sleepQuality !== undefined && Number.isFinite(Number(sleepQuality))
      ? clampNumber((Number(sleepQuality) - 1) / 4, 0, 1)
      : undefined;

  // readinessScore 0–100 OR energyLevel 1–5 → readinessScoreProxy 0–100
  let readinessScoreProxy;
  if (readinessScore !== undefined && Number.isFinite(Number(readinessScore))) {
    readinessScoreProxy = clampNumber(Number(readinessScore), 0, 100);
  } else if (energyLevel !== undefined && Number.isFinite(Number(energyLevel))) {
    readinessScoreProxy = clampNumber(((Number(energyLevel) - 1) / 4) * 100, 0, 100);
  }

  const recoveryPayload = compactPayload({
    sleepEfficiencyProxy,
    sleepQualityScore: clampNumber(sleepQuality, 1, 5),
  });

  const behavioralPayload = compactPayload({
    readinessScoreProxy,
    energyScore: clampNumber(energyLevel, 1, 5),
    stressScore: clampNumber(stressLevel, 1, 5),
    perceivedRpeYesterday: clampNumber(perceivedRpe, 1, 10),
  });

  return { recoveryPayload, behavioralPayload };
}

/**
 * Persist the canonical self-report source records. Idempotent at the
 * (userId, sourceFamily, domain, dateKey) level via deterministic ids.
 *
 * @returns {Promise<{written: string[], skipped: string[]}>}
 */
async function writeSelfReportSourceRecords(db, params) {
  const {
    userId,
    sourceDate,
    timezone = 'UTC',
    confidenceLabel,
    answers,
  } = params;

  if (!db || !userId || !sourceDate) {
    return { written: [], skipped: ['missing_required_fields'] };
  }

  const { recoveryPayload, behavioralPayload } = buildSelfReportPayloads(answers || {});
  const window = dayWindowSeconds(sourceDate);
  const observedAt = nowSeconds();

  const baseMetadata = {
    syncOrigin: 'pulsecheck_self_report',
    writer: 'submit-pulsecheck-checkin.js',
  };
  const baseProvenance = {
    mode: 'self_reported',
    sourceSystem: 'pulsecheck_self_report',
    confidenceLabel: confidenceLabel || 'emerging',
  };

  const writes = [];
  const written = [];
  const skipped = [];

  if (Object.keys(recoveryPayload).length > 0) {
    const id = buildRecordId(userId, 'pulsecheck_self_report', 'recovery', sourceDate);
    writes.push(
      db.collection(HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION).doc(id).set({
        id,
        athleteUserId: userId,
        sourceFamily: 'pulsecheck_self_report',
        sourceType: 'pulsecheck_self_report_recovery',
        recordType: 'summary_input',
        domain: 'recovery',
        observedAt,
        observedWindowStart: window.startSec,
        observedWindowEnd: window.endSec,
        ingestedAt: observedAt,
        timezone,
        status: 'active',
        dedupeKey: buildDedupeKey(userId, 'pulsecheck_self_report', 'recovery', sourceDate),
        payloadVersion: SOURCE_RECORD_CONTRACT_VERSION,
        payload: recoveryPayload,
        sourceMetadata: baseMetadata,
        provenance: baseProvenance,
      }, { merge: true }),
    );
    written.push(id);
  } else {
    skipped.push('recovery_no_data');
  }

  if (Object.keys(behavioralPayload).length > 0) {
    const id = buildRecordId(userId, 'pulsecheck_self_report', 'behavioral', sourceDate);
    writes.push(
      db.collection(HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION).doc(id).set({
        id,
        athleteUserId: userId,
        sourceFamily: 'pulsecheck_self_report',
        sourceType: 'pulsecheck_self_report_behavioral',
        recordType: 'summary_input',
        domain: 'behavioral',
        observedAt,
        observedWindowStart: window.startSec,
        observedWindowEnd: window.endSec,
        ingestedAt: observedAt,
        timezone,
        status: 'active',
        dedupeKey: buildDedupeKey(userId, 'pulsecheck_self_report', 'behavioral', sourceDate),
        payloadVersion: SOURCE_RECORD_CONTRACT_VERSION,
        payload: behavioralPayload,
        sourceMetadata: baseMetadata,
        provenance: baseProvenance,
      }, { merge: true }),
    );
    written.push(id);
  } else {
    skipped.push('behavioral_no_data');
  }

  await Promise.all(writes);
  return { written, skipped };
}

/**
 * Top-level helper called by the check-in handler. Decides confidence
 * based on whether the athlete has a connected wearable, then writes
 * source records. Always returns gracefully — the check-in flow should
 * NOT fail if the side effect fails.
 */
async function syncSelfReportFromCheckin(db, params) {
  if (!db || !params?.userId || !params?.sourceDate) {
    return { written: [], skipped: ['missing_required_fields'], hasWearable: false };
  }

  try {
    const hasWearable = await athleteHasConnectedWearable(db, params.userId);
    const confidenceLabel = hasWearable ? 'directional' : 'emerging';
    const result = await writeSelfReportSourceRecords(db, {
      userId: params.userId,
      sourceDate: params.sourceDate,
      timezone: params.timezone || 'UTC',
      confidenceLabel,
      answers: {
        readinessScore: params.readinessScore,
        energyLevel: params.energyLevel,
        stressLevel: params.stressLevel,
        sleepQuality: params.sleepQuality,
        perceivedRpe: params.perceivedRpe,
      },
    });
    return { ...result, hasWearable, confidenceLabel };
  } catch (error) {
    console.warn(
      '[self-report-source-record] syncSelfReportFromCheckin failed (non-blocking):',
      error?.message || error,
    );
    return { written: [], skipped: ['error'], hasWearable: false, error: String(error?.message || error) };
  }
}

module.exports = {
  athleteHasConnectedWearable,
  buildSelfReportPayloads,
  writeSelfReportSourceRecords,
  syncSelfReportFromCheckin,
  WEARABLE_SOURCE_FAMILIES,
  HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION,
  HEALTH_CONTEXT_SOURCE_STATUS_COLLECTION,
};
