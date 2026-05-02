// =============================================================================
// HCSR Record Writer - dependency-light CommonJS boundary for Netlify functions.
//
// Functions pass an initialized Firestore Admin db into
// `upsertHealthContextSourceRecordWithAdmin(db, input)`. This file has no
// firebase-admin dependency of its own so it can be reused by sync handlers and
// runtime tests with small in-memory db mocks.
// =============================================================================

'use strict';

const HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION = 'health-context-source-records';
const SOURCE_RECORD_CONTRACT_VERSION = '1.0';
const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_PROVENANCE_MODE = 'direct';

function nowSeconds() {
  return Math.round(Date.now() / 1000);
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    output[key] = stripUndefinedDeep(entry);
  }
  return output;
}

function requireString(value, label) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[hcsr-record-writer] ${label} is required.`);
  }
  return normalized;
}

function requireFiniteSeconds(value, label) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    throw new Error(`[hcsr-record-writer] ${label} must be a finite Unix seconds value.`);
  }
  return Math.round(normalized);
}

function buildRecordId({ athleteUserId, sourceFamily, domain, dateKey, recordIdSegment }) {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const scopedFamily = requireString(sourceFamily, 'sourceFamily');
  const scopedDateKey = requireString(dateKey, 'dateKey');
  const segment = typeof recordIdSegment === 'string' ? recordIdSegment.trim() : '';
  return `${scopedAthleteId}_${scopedFamily}_${segment || domain}_${scopedDateKey}`;
}

function buildDedupeKey({ athleteUserId, sourceFamily, domain, dateKey }) {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const scopedFamily = requireString(sourceFamily, 'sourceFamily');
  const scopedDomain = requireString(domain, 'domain');
  const scopedDateKey = requireString(dateKey, 'dateKey');
  return `${scopedAthleteId}|${scopedFamily}|${scopedDomain}|${scopedDateKey}`;
}

function buildSourceMetadata({ sourceFamily, syncOrigin, writer, upstreamRevision, notes }) {
  const scopedFamily = requireString(sourceFamily, 'sourceFamily');
  return stripUndefinedDeep({
    syncOrigin: syncOrigin || `pulsecheck_${scopedFamily}_refresh`,
    writer: writer || 'hcsr-record-writer.js',
    upstreamRevision,
    notes,
  });
}

function buildProvenance({ mode = DEFAULT_PROVENANCE_MODE, sourceSystem, rawDay, confidenceLabel, notes }) {
  return stripUndefinedDeep({
    mode,
    sourceSystem: requireString(sourceSystem, 'provenance.sourceSystem'),
    rawDay,
    confidenceLabel,
    notes,
  });
}

function normalize(input) {
  const athleteUserId = requireString(input?.athleteUserId || input?.userId, 'athleteUserId');
  const sourceFamily = requireString(input?.sourceFamily || input?.family, 'sourceFamily');
  const sample = input?.sample || input || {};
  const sourceType = requireString(sample.sourceType, 'sample.sourceType');
  const domain = requireString(sample.domain, 'sample.domain');
  const window = sample.window || {};
  const dateKey = requireString(window.dateKey || sample.dateKey || input?.dateKey, 'sample.window.dateKey');
  const observedWindowStart = requireFiniteSeconds(
    window.observedWindowStart ?? sample.observedWindowStart ?? sample.windowStart,
    'sample.window.observedWindowStart',
  );
  const observedWindowEnd = requireFiniteSeconds(
    window.observedWindowEnd ?? sample.observedWindowEnd ?? sample.windowEnd,
    'sample.window.observedWindowEnd',
  );
  const observedAt = requireFiniteSeconds(
    window.observedAt ?? sample.observedAt ?? sample.observationTime ?? observedWindowEnd,
    'sample.window.observedAt',
  );
  const sourceMetadata = {
    ...buildSourceMetadata({
      sourceFamily,
      ...(input?.sourceMetadata || {}),
    }),
    ...(sample.sourceMetadata || {}),
  };
  const provenance = {
    ...buildProvenance({
      rawDay: dateKey,
      ...(input?.provenance || {}),
    }),
    ...(sample.provenance || {}),
  };

  return stripUndefinedDeep({
    athleteUserId,
    sourceFamily,
    sourceType,
    recordType: sample.recordType || 'summary_input',
    domain,
    observedAt,
    observedWindowStart,
    observedWindowEnd,
    timezone: window.timezone || sample.timezone || input?.timezone || DEFAULT_TIMEZONE,
    dateKey,
    payload: sample.payload || {},
    sourceMetadata,
    provenance,
    recordIdOverride: sample.recordIdOverride || input?.recordIdOverride || buildRecordId({
      athleteUserId,
      sourceFamily,
      domain,
      dateKey,
      recordIdSegment: sample.recordIdSegment || input?.recordIdSegment,
    }),
  });
}

function buildSourceRecord(input) {
  const normalized = normalize(input);
  const id = normalized.recordIdOverride || buildRecordId(normalized);
  return {
    id,
    athleteUserId: normalized.athleteUserId,
    sourceFamily: normalized.sourceFamily,
    sourceType: normalized.sourceType,
    recordType: normalized.recordType,
    domain: normalized.domain,
    observedAt: normalized.observedAt,
    observedWindowStart: normalized.observedWindowStart,
    observedWindowEnd: normalized.observedWindowEnd,
    ingestedAt: nowSeconds(),
    timezone: normalized.timezone,
    status: 'active',
    dedupeKey: buildDedupeKey(normalized),
    payloadVersion: SOURCE_RECORD_CONTRACT_VERSION,
    payload: normalized.payload,
    sourceMetadata: normalized.sourceMetadata,
    provenance: normalized.provenance,
  };
}

async function upsertHealthContextSourceRecordWithAdmin(db, input) {
  if (!db || typeof db.collection !== 'function') {
    throw new Error('[hcsr-record-writer] Firestore Admin db is required.');
  }
  const record = buildSourceRecord(input);
  await db
    .collection(HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION)
    .doc(record.id)
    .set(stripUndefinedDeep(record), { merge: true });
  return record;
}

module.exports = {
  HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION,
  SOURCE_RECORD_CONTRACT_VERSION,
  normalize,
  buildSourceRecord,
  buildRecordId,
  buildDedupeKey,
  buildSourceMetadata,
  buildProvenance,
  upsertHealthContextSourceRecordWithAdmin,
};
