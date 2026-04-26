// =============================================================================
// Health Context Snapshot Assembler — merges source records into a canonical
// `AthleteHealthContextSnapshot`.
//
// This module implements the spec at:
//   src/components/admin/system-overview/PulseCheckHealthContextSnapshotAssemblerSpecTab.tsx
//
// It reads source records produced by adapters (Oura sync, self-report
// from check-in, future HealthKit / Polar / Whoop / Garmin) and merges
// them into the canonical snapshot the spec defines, applying:
//   - source-precedence rules per domain
//   - freshness propagation per domain
//   - confidence rollup per domain
//   - missing-data behavior (omit, never fabricate)
//   - mergeNotes for QA / debugging
//
// What this DOESN'T do (yet — Slice 3 work):
//   - Compute the actual inference fields (load score, ACWR, readiness band)
//     beyond what individual source records carry. Those values come from
//     the inference engine that runs ON TOP of this snapshot.
//   - Write back to the source-status collection. Adapters own that.
//   - Run on a schedule. Callers (or a scheduled function in a follow-up
//     pass) invoke `assembleAthleteContextSnapshot()` directly.
// =============================================================================

import {
  type AthleteHealthContextSnapshot,
  type DataConfidence,
  type DomainBlock,
  type DomainKey,
  type DomainProvenance,
  type FreshnessTier,
  type IdentityContext,
  type SnapshotProvenanceTop,
  type SnapshotSourceId,
  type SnapshotSourceWindow,
  type SnapshotType,
  type SourceStatus,
  type SummaryContext,
  type SummaryMode,
  athleteContextSnapshotService,
} from './athleteContextSnapshot';
import {
  type HealthContextDomain,
  type HealthContextSourceFamily,
  type HealthContextSourceRecord,
  healthContextSourceRecordService,
} from './healthContextSourceRecord';

// ──────────────────────────────────────────────────────────────────────────────
// Source-family → canonical snapshot source id mapping
//
// HCSR adapters write under a `sourceFamily` (e.g. `oura`, `apple_health`,
// `pulsecheck_self_report`). The canonical snapshot uses a slightly
// different id space (`SnapshotSourceId`) — this map keeps them
// bidirectional and explicit.
// ──────────────────────────────────────────────────────────────────────────────

const FAMILY_TO_SNAPSHOT_SOURCE: Record<HealthContextSourceFamily, SnapshotSourceId> = {
  oura: 'oura',
  apple_health: 'health_kit',
  polar: 'polar',
  whoop: 'whoop',
  garmin: 'garmin',
  pulsecheck_self_report: 'pulsecheck_self_report',
  coach_entered: 'coach_entered',
  fit_with_pulse: 'fit_with_pulse',
  macra: 'macra',
};

const familyToSnapshotSource = (family: HealthContextSourceFamily): SnapshotSourceId =>
  FAMILY_TO_SNAPSHOT_SOURCE[family] || 'coach_entered';

// ──────────────────────────────────────────────────────────────────────────────
// Per-domain source precedence (matches the spec's merge rules)
//
// Ordered from highest to lowest precedence. The first source family that
// produced a record for the window wins for that domain.
// ──────────────────────────────────────────────────────────────────────────────

const DOMAIN_PRECEDENCE: Record<HealthContextDomain, HealthContextSourceFamily[]> = {
  identity: ['fit_with_pulse', 'macra', 'coach_entered'],
  training: ['fit_with_pulse', 'apple_health', 'oura'],
  recovery: ['oura', 'apple_health', 'pulsecheck_self_report'],
  activity: ['apple_health', 'oura', 'pulsecheck_self_report'],
  nutrition: ['macra', 'pulsecheck_self_report', 'fit_with_pulse'],
  biometrics: ['apple_health', 'oura', 'coach_entered'],
  behavioral: ['pulsecheck_self_report', 'macra', 'coach_entered'],
  summary: ['oura', 'apple_health', 'fit_with_pulse', 'macra'],
};

// ──────────────────────────────────────────────────────────────────────────────
// Confidence rollup: how a record's provenance.confidenceLabel maps into a
// domain block's dataConfidence. Self-report caps at `emerging` per the
// spec rule even if the adapter writes a higher label.
// ──────────────────────────────────────────────────────────────────────────────

const CONFIDENCE_RANK: Record<DataConfidence, number> = {
  degraded: 0,
  directional: 1,
  emerging: 2,
  stable: 3,
  high_confidence: 4,
};

const SELF_REPORT_CONFIDENCE_CAP: DataConfidence = 'emerging';

const clampConfidence = (
  label: DataConfidence | undefined,
  family: HealthContextSourceFamily,
): DataConfidence | undefined => {
  if (!label) return undefined;
  if (family !== 'pulsecheck_self_report') return label;
  return CONFIDENCE_RANK[label] > CONFIDENCE_RANK[SELF_REPORT_CONFIDENCE_CAP]
    ? SELF_REPORT_CONFIDENCE_CAP
    : label;
};

// ──────────────────────────────────────────────────────────────────────────────
// Freshness rollup based on observation timestamps relative to the
// snapshot window.
// ──────────────────────────────────────────────────────────────────────────────

const SECONDS_PER_DAY = 24 * 60 * 60;

const classifyFreshness = (
  observedAt: number,
  windowEnd: number,
): FreshnessTier => {
  const ageSec = Math.max(0, windowEnd - observedAt);
  if (ageSec <= SECONDS_PER_DAY * 1.5) return 'fresh';
  if (ageSec <= SECONDS_PER_DAY * 7) return 'recent';
  if (ageSec <= SECONDS_PER_DAY * 28) return 'historical_only';
  return 'stale';
};

// ──────────────────────────────────────────────────────────────────────────────
// Assembler input + result shapes
// ──────────────────────────────────────────────────────────────────────────────

export interface AssembleSnapshotInput {
  athleteUserId: string;
  /** YYYY-MM-DD athlete-local. */
  snapshotDate: string;
  snapshotType: SnapshotType;
  sourceWindow: SnapshotSourceWindow;
  /** Optional pre-fetched records. If omitted, the assembler queries Firestore. */
  records?: HealthContextSourceRecord[];
  /** Identity context — the assembler doesn't fabricate identity fields. */
  identity?: Partial<IdentityContext>;
  /** Whether to write the resulting snapshot to Firestore. Defaults to true. */
  persist?: boolean;
}

export interface AssembleSnapshotResult {
  snapshot: AthleteHealthContextSnapshot;
  /** Domains where no record was found and the block was omitted. */
  omittedDomains: DomainKey[];
  /** Notes the merger emitted for QA / reviewer-screen consumption. */
  mergeNotes: string[];
  /** Whether the snapshot was written to Firestore. */
  persisted: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Core merging
// ──────────────────────────────────────────────────────────────────────────────

interface DomainAssembly<T> {
  block: DomainBlock<T>;
  winnerFamily: HealthContextSourceFamily;
  contributorIds: string[];
}

const buildDomainBlock = <T extends Record<string, unknown>>(
  domain: HealthContextDomain,
  records: HealthContextSourceRecord[],
  windowEnd: number,
  notes: string[],
): DomainAssembly<T> | null => {
  if (records.length === 0) return null;

  const precedence = DOMAIN_PRECEDENCE[domain] || [];
  const domainRecords = records
    .filter((record) => record.domain === domain && record.status === 'active')
    .sort((a, b) => b.observedAt - a.observedAt);

  if (domainRecords.length === 0) return null;

  const byFamily = new Map<HealthContextSourceFamily, HealthContextSourceRecord[]>();
  for (const record of domainRecords) {
    const list = byFamily.get(record.sourceFamily) || [];
    list.push(record);
    byFamily.set(record.sourceFamily, list);
  }

  let winnerFamily: HealthContextSourceFamily | null = null;
  for (const family of precedence) {
    if (byFamily.has(family)) {
      winnerFamily = family;
      break;
    }
  }
  if (!winnerFamily) {
    winnerFamily = domainRecords[0].sourceFamily;
    notes.push(
      `[${domain}] no precedence-listed family produced data; fell back to most recent record from "${winnerFamily}".`,
    );
  }

  const winnerRecords = byFamily.get(winnerFamily) || [];
  const winnerRecord = winnerRecords[0];

  const contributingFamilies = Array.from(byFamily.keys()).filter((f) => f !== winnerFamily);

  // Merge payloads: winner's fields take precedence, contributing sources fill
  // gaps for fields the winner didn't carry.
  const mergedPayload: Record<string, unknown> = { ...(winnerRecord.payload as Record<string, unknown>) };
  for (const family of contributingFamilies) {
    const familyRecord = (byFamily.get(family) || [])[0];
    if (!familyRecord) continue;
    for (const [key, value] of Object.entries(familyRecord.payload as Record<string, unknown>)) {
      if (mergedPayload[key] === undefined && value !== undefined) {
        mergedPayload[key] = value;
        notes.push(`[${domain}] field "${key}" filled from "${family}" (winner "${winnerFamily}" had no value).`);
      }
    }
  }

  const observationTimes: Partial<Record<SnapshotSourceId, string>> = {};
  for (const family of byFamily.keys()) {
    const familyRecord = (byFamily.get(family) || [])[0];
    if (familyRecord) {
      observationTimes[familyToSnapshotSource(family)] = new Date(familyRecord.observedAt * 1000).toISOString();
    }
  }

  const sourceStatus: Partial<Record<SnapshotSourceId, SourceStatus>> = {};
  for (const family of byFamily.keys()) {
    sourceStatus[familyToSnapshotSource(family)] = 'connected_synced';
  }

  const dataConfidence = clampConfidence(winnerRecord.provenance.confidenceLabel, winnerFamily);

  const provenance: DomainProvenance = {
    primarySource: familyToSnapshotSource(winnerFamily),
    contributingSources: Array.from(byFamily.keys()).map(familyToSnapshotSource),
    observationTimes,
    notes: contributingFamilies.length > 0
      ? [`Merged ${contributingFamilies.length} additional source(s) under "${winnerFamily}".`]
      : undefined,
    dataConfidence,
  };

  return {
    winnerFamily,
    contributorIds: domainRecords.map((record) => record.id),
    block: {
      freshness: classifyFreshness(winnerRecord.observedAt, windowEnd),
      data: mergedPayload as T,
      provenance,
      sourceStatus,
    },
  };
};

const buildSummaryBlock = (
  domains: Partial<Record<DomainKey, DomainAssembly<unknown>>>,
  totalRecords: number,
  notes: string[],
): { block: DomainBlock<SummaryContext>; summaryMode: SummaryMode } => {
  const presentDomains = (Object.keys(domains) as DomainKey[]).filter((key) => key !== 'summary' && key !== 'identity' && domains[key]);
  const driverDomains = presentDomains.filter((key) => {
    const block = domains[key]?.block;
    return block && (block.freshness === 'fresh' || block.freshness === 'recent');
  });

  let summaryMode: SummaryMode = 'empty';
  if (totalRecords === 0) {
    summaryMode = 'empty';
  } else if (driverDomains.length === 0) {
    summaryMode = 'historical_contextual';
  } else if (driverDomains.length === 1) {
    summaryMode = 'direct';
  } else {
    summaryMode = 'merged_direct';
  }

  const surfacedFlags: string[] = [];
  if (totalRecords === 0) {
    surfacedFlags.push('snapshot_empty');
  }
  for (const key of ['recovery', 'training', 'activity'] as DomainKey[]) {
    const block = domains[key]?.block;
    if (block && block.freshness === 'stale') {
      surfacedFlags.push(`${key}_stale`);
    }
  }

  const block: DomainBlock<SummaryContext> = {
    freshness: driverDomains.length > 0 ? 'fresh' : (totalRecords === 0 ? 'missing' : 'historical_only'),
    data: {
      surfacedFlags,
      driverDomains,
    },
    provenance: {
      contributingSources: Array.from(
        new Set(
          presentDomains.flatMap((key) => domains[key]?.block.provenance.contributingSources || []),
        ),
      ),
      notes: notes.length > 0 ? notes.slice(0, 8) : undefined,
    },
    sourceStatus: {},
  };

  return { block, summaryMode };
};

// ──────────────────────────────────────────────────────────────────────────────
// Public assembler
// ──────────────────────────────────────────────────────────────────────────────

export const assembleAthleteContextSnapshot = async (
  input: AssembleSnapshotInput,
): Promise<AssembleSnapshotResult> => {
  const athleteUserId = String(input.athleteUserId || '').trim();
  if (!athleteUserId) {
    throw new Error('[HealthContextSnapshotAssembler] athleteUserId is required.');
  }
  const snapshotDate = String(input.snapshotDate || '').trim();
  if (!snapshotDate) {
    throw new Error('[HealthContextSnapshotAssembler] snapshotDate is required.');
  }

  const windowStartSec = Math.round(new Date(input.sourceWindow.startsAt).getTime() / 1000);
  const windowEndSec = Math.round(new Date(input.sourceWindow.endsAt).getTime() / 1000);

  const records = input.records
    ?? (await healthContextSourceRecordService.listForWindow(
      athleteUserId,
      windowStartSec,
      windowEndSec,
    ));

  const notes: string[] = [];
  const omittedDomains: DomainKey[] = [];

  const assemblies: Partial<Record<DomainKey, DomainAssembly<unknown>>> = {};
  const allDomains: HealthContextDomain[] = [
    'training',
    'recovery',
    'activity',
    'nutrition',
    'biometrics',
    'behavioral',
  ];

  for (const domain of allDomains) {
    const result = buildDomainBlock(domain, records, windowEndSec, notes);
    if (result) {
      assemblies[domain as DomainKey] = result;
    } else {
      omittedDomains.push(domain as DomainKey);
    }
  }

  // Build identity block from input (assembler does not fabricate identity).
  const identityBlock: DomainBlock<IdentityContext> = {
    freshness: 'fresh',
    data: {
      athleteUserId,
      teamIds: input.identity?.teamIds || [],
      organizationIds: input.identity?.organizationIds || [],
      pilotIds: input.identity?.pilotIds,
      timezone: input.identity?.timezone || input.sourceWindow.timezone,
      ageBand: input.identity?.ageBand,
      competitiveLevel: input.identity?.competitiveLevel,
      seasonPhase: input.identity?.seasonPhase,
      athleteSport: input.identity?.athleteSport,
      athleteSportName: input.identity?.athleteSportName,
      athleteSportPosition: input.identity?.athleteSportPosition,
    },
    provenance: { contributingSources: [] },
    sourceStatus: {},
  };

  const summary = buildSummaryBlock(assemblies, records.length, notes);

  // Aggregate top-level provenance + freshness.
  const sourcesUsed = Array.from(
    new Set(records.map((record) => familyToSnapshotSource(record.sourceFamily))),
  );
  const domainWinners: Partial<Record<DomainKey, SnapshotSourceId>> = {};
  for (const key of Object.keys(assemblies) as DomainKey[]) {
    const winner = assemblies[key]?.winnerFamily;
    if (winner) {
      domainWinners[key] = familyToSnapshotSource(winner);
    }
  }

  const sourceObservationTimes: Partial<Record<SnapshotSourceId, string>> = {};
  for (const record of records) {
    const sid = familyToSnapshotSource(record.sourceFamily);
    const iso = new Date(record.observedAt * 1000).toISOString();
    if (!sourceObservationTimes[sid] || sourceObservationTimes[sid]! < iso) {
      sourceObservationTimes[sid] = iso;
    }
  }

  const dataConfidence: Partial<Record<DomainKey, DataConfidence>> = {};
  for (const key of Object.keys(assemblies) as DomainKey[]) {
    const conf = assemblies[key]?.block.provenance.dataConfidence;
    if (conf) dataConfidence[key] = conf;
  }

  const overallFreshness: FreshnessTier = (() => {
    const blocks = Object.values(assemblies)
      .map((a) => a?.block.freshness)
      .filter((f): f is FreshnessTier => Boolean(f));
    if (blocks.length === 0) return 'missing';
    const order: FreshnessTier[] = ['fresh', 'recent', 'inferred', 'historical_only', 'stale', 'missing'];
    for (const tier of order) {
      if (blocks.includes(tier)) return tier;
    }
    return 'missing';
  })();

  const perDomainFreshness: Partial<Record<DomainKey, FreshnessTier>> = {};
  for (const key of Object.keys(assemblies) as DomainKey[]) {
    const f = assemblies[key]?.block.freshness;
    if (f) perDomainFreshness[key] = f;
  }

  const sourceStatusTop: Partial<Record<SnapshotSourceId, SourceStatus>> = {};
  for (const sid of sourcesUsed) {
    sourceStatusTop[sid] = 'connected_synced';
  }

  const provenance: SnapshotProvenanceTop = {
    sourcesUsed,
    domainWinners,
    summaryMode: summary.summaryMode,
    sourceObservationTimes,
    mergeNotes: notes.length > 0 ? notes : undefined,
    dataConfidence,
  };

  const persistInput = {
    athleteUserId,
    snapshotDate,
    snapshotType: input.snapshotType,
    generatedAt: new Date().toISOString(),
    sourceWindow: input.sourceWindow,
    permissions: {
      productConsent: true,
      consentVersionIds: [],
      scopedConsumers: [],
    },
    sourceStatus: sourceStatusTop,
    freshness: { overall: overallFreshness, perDomain: perDomainFreshness },
    provenance,
    domains: {
      identity: identityBlock,
      training: assemblies.training?.block as DomainBlock<any> | undefined,
      recovery: assemblies.recovery?.block as DomainBlock<any> | undefined,
      activity: assemblies.activity?.block as DomainBlock<any> | undefined,
      nutrition: assemblies.nutrition?.block as DomainBlock<any> | undefined,
      biometrics: assemblies.biometrics?.block as DomainBlock<any> | undefined,
      behavioral: assemblies.behavioral?.block as DomainBlock<any> | undefined,
      summary: summary.block,
    },
    audit: {
      assemblyNotes: notes,
      missingDomains: omittedDomains,
    },
  };

  let persisted = false;
  let snapshot: AthleteHealthContextSnapshot;
  if (input.persist === false) {
    snapshot = {
      snapshotId: `${athleteUserId}__${input.snapshotType}__${snapshotDate}`,
      revision: 0,
      ...persistInput,
    } as AthleteHealthContextSnapshot;
  } else {
    snapshot = await athleteContextSnapshotService.upsert(persistInput as any);
    persisted = true;
  }

  return { snapshot, omittedDomains, mergeNotes: notes, persisted };
};

export const healthContextSnapshotAssembler = {
  assemble: assembleAthleteContextSnapshot,
};
