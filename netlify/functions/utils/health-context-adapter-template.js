// =============================================================================
// Health Context Adapter Template — pattern documentation + scaffolding for
// Polar / Whoop / Garmin (and any future device family).
//
// This file is INTENTIONALLY non-functional. It documents the contract and
// provides a copy-paste skeleton for new adapter implementations. When a
// device family is brought online (e.g., the Polar OAuth + Accesslink
// integration ships), copy this template into a real adapter file at
// `netlify/functions/{family}-sync.js` and fill in the marked sections.
//
// REFERENCE IMPLEMENTATIONS:
//   - Oura adapter:       netlify/functions/oura-sync.js (live in production)
//   - Self-report shim:   netlify/functions/utils/self-report-source-record.js
//                         (shows the minimal write surface)
//
// CONTRACT (must hold for every adapter):
//
//   1. Adapter writes ONLY to `health-context-source-records` collection.
//      No vendor-specific shapes. No legacy collections.
//
//   2. Each record carries:
//      - id              : `{userId}_{family}_{domain}_{dateKey}` (deterministic)
//      - dedupeKey       : `{userId}|{family}|{domain}|{dateKey}`
//      - athleteUserId   : canonical Firebase uid
//      - sourceFamily    : one of `oura | apple_health | polar | whoop | garmin |
//                                  pulsecheck_self_report | coach_entered |
//                                  fit_with_pulse | macra`
//      - sourceType      : `{family}_{domain}` namespace
//                          (e.g., `polar_recovery`, `whoop_activity`)
//      - recordType      : `summary_input | session_input | event_input | context_input`
//      - domain          : `recovery | activity | biometrics | training | nutrition | behavioral | summary`
//      - observedAt / observedWindowStart / observedWindowEnd : unix seconds
//      - timezone        : athlete-local IANA zone
//      - status          : `active` (use `superseded` when a vendor revises)
//      - payloadVersion  : `'1.0'` until the contract bumps
//      - payload         : domain-normalized fields (see oura-sync.js for examples)
//      - sourceMetadata  : { syncOrigin, writer, upstreamRevision?, notes? }
//      - provenance      : { mode, sourceSystem, rawDay?, confidenceLabel?, notes? }
//
//   3. Adapter ALSO updates `health-context-source-status` for the athlete
//      so the snapshot assembler knows the source family is live.
//
//   4. Adapter is IDEMPOTENT — re-running for the same window writes the
//      same doc id, overwriting (`{ merge: true }`). The snapshot assembler
//      relies on this for clean reproducibility.
//
//   5. Adapter NEVER writes consumer-facing copy. The snapshot assembler
//      and the inference engine produce coach-facing strings; the adapter
//      only normalizes raw vendor data.
//
//   6. Self-report and coach-entered families cap their `provenance.confidenceLabel`
//      at `emerging` per spec rule. Device families may write `stable` or
//      `high_confidence` only when the adapter has high signal quality.
//
//   7. Vendor-leakage rule: NO sport intelligence consumer reads vendor
//      SDKs directly. All reads go through the snapshot or HCSR records.
//
// BUILD ORDER WHEN A NEW DEVICE ARRIVES:
//   1. Copy this template to `netlify/functions/{family}-sync.js`.
//   2. Implement OAuth (mirror `oura-utils.js`'s OAuth state pattern).
//   3. Fill in `fetchVendorData()` with the vendor API call.
//   4. Map the vendor's units into the canonical normalized payload
//      (see PulseCheckHealthContextSourceRecordSpecTab for canonical fields).
//   5. Update `HealthContextSourceFamily` in `src/api/firebase/healthContextSourceRecord.ts`
//      if it isn't already declared — Polar / Whoop / Garmin already are.
//   6. Wire the adapter into the snapshot assembler's DOMAIN_PRECEDENCE
//      in `src/api/firebase/healthContextSnapshotAssembler.ts` so the new
//      family takes the right precedence per domain.
//   7. Write a `tests/api/pulsecheck/{family}-sync.runtime.test.cjs` with
//      a fake vendor payload + assert the source-record write shape.
//   8. Add the new family to `health-context-source-status` doc structure
//      so the source-status query in `self-report-source-record.js`
//      `WEARABLE_SOURCE_FAMILIES` picks it up — that's how Nora knows to
//      stop asking self-report questions for a now-connected device.
//
// =============================================================================

// ──────────────────────────────────────────────────────────────────────────────
// Copy from here when implementing a real adapter
// ──────────────────────────────────────────────────────────────────────────────

/* eslint-disable no-unused-vars */

const HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION = 'health-context-source-records';
const HEALTH_CONTEXT_SOURCE_STATUS_COLLECTION = 'health-context-source-status';
const SOURCE_RECORD_CONTRACT_VERSION = '1.0';

/**
 * Build a deterministic record id. Match exactly the Oura adapter pattern
 * so the snapshot assembler can reason about ids without family-specific
 * branching.
 */
function buildRecordId(userId, family, domain, dateKey) {
  return `${userId}_${family}_${domain}_${dateKey}`;
}

function buildDedupeKey(userId, family, domain, dateKey) {
  return `${userId}|${family}|${domain}|${dateKey}`;
}

function nowSeconds() {
  return Math.round(Date.now() / 1000);
}

/**
 * Reference shape — pure shape illustration. Real adapters fill these in
 * from their vendor API responses.
 */
function REFERENCE_buildSourceRecord({
  userId,
  family,           // 'polar' | 'whoop' | 'garmin' | ...
  sourceType,       // e.g., 'polar_recovery'
  domain,           // 'recovery' | 'activity' | ...
  dateKey,          // 'YYYY-MM-DD'
  payload,          // canonical normalized fields per domain
  observationTime,  // unix seconds when the vendor produced the data
  windowStart,
  windowEnd,
  timezone,
  rawVendorRevision,
  vendorMode,       // 'direct' for live device sync; 'inferred' if extrapolated
  vendorSystem,     // e.g., 'polar_accesslink_api'
  confidenceLabel,  // 'directional' | 'emerging' | 'stable' | 'high_confidence'
}) {
  const id = buildRecordId(userId, family, domain, dateKey);
  return {
    id,
    athleteUserId: userId,
    sourceFamily: family,
    sourceType,
    recordType: 'summary_input',
    domain,
    observedAt: observationTime,
    observedWindowStart: windowStart,
    observedWindowEnd: windowEnd,
    ingestedAt: nowSeconds(),
    timezone,
    status: 'active',
    dedupeKey: buildDedupeKey(userId, family, domain, dateKey),
    payloadVersion: SOURCE_RECORD_CONTRACT_VERSION,
    payload,
    sourceMetadata: {
      syncOrigin: `pulsecheck_${family}_refresh`,
      writer: `${family}-sync.js`,
      upstreamRevision: rawVendorRevision,
    },
    provenance: {
      mode: vendorMode,
      sourceSystem: vendorSystem,
      rawDay: dateKey,
      confidenceLabel,
    },
  };
}

/**
 * Reference shape for the source-status doc update. Adapters MUST keep
 * `health-context-source-status/{userId}.{family}` in sync with the
 * lifecycle state so consumers (Nora, the assembler, the dashboard)
 * know when a source is live vs. stale.
 */
function REFERENCE_buildSourceStatusUpdate({ family, lifecycleState, lastSyncedAt }) {
  // lifecycleState: 'not_connected' | 'permission_denied' | 'connected_waiting_for_data' |
  //                 'connected_synced' | 'connected_stale' | 'error'
  return {
    sourceStatuses: {
      [family]: {
        status: lifecycleState,
        lastSyncedAt: lastSyncedAt || nowSeconds(),
      },
    },
    updatedAt: lastSyncedAt || nowSeconds(),
  };
}

module.exports = {
  HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION,
  HEALTH_CONTEXT_SOURCE_STATUS_COLLECTION,
  SOURCE_RECORD_CONTRACT_VERSION,
  buildRecordId,
  buildDedupeKey,
  REFERENCE_buildSourceRecord,
  REFERENCE_buildSourceStatusUpdate,
};
