// =============================================================================
// HCSR Record Writer - shared web/client-side boundary for adapters that emit
// canonical Health Context Source Records.
//
// This layer normalizes source-adapter samples into the existing
// `healthContextSourceRecord` contract. Persistence still flows through the
// established Firebase client writer so current Firestore behavior remains
// centralized in one adapter.
// =============================================================================

import {
  HEALTH_CONTEXT_SOURCE_RECORD_CONTRACT_VERSION,
  buildSourceRecordDedupeKey,
  buildSourceRecordId,
  type HealthContextDomain,
  type HealthContextProvenanceMode,
  type HealthContextRecordType,
  type HealthContextSourceFamily,
  type HealthContextSourceMetadata,
  type HealthContextSourceProvenance,
  type HealthContextSourceRecord,
  type HealthContextSourceType,
  type UpsertSourceRecordInput,
  upsertHealthContextSourceRecord,
} from './healthContextSourceRecord';

export type HCSRNormalizedPrimitive = string | number | boolean | null;
export type HCSRNormalizedValue =
  | HCSRNormalizedPrimitive
  | HCSRNormalizedValue[]
  | { [key: string]: HCSRNormalizedValue };

export type HCSRNormalizedPayload = Record<string, HCSRNormalizedValue>;

export interface HCSRObservationWindow {
  /** Stable source date key, usually YYYY-MM-DD. */
  dateKey: string;
  /** Unix seconds when this source sample was observed. Defaults to window end. */
  observedAt?: number;
  /** Unix seconds for the start of the source observation window. */
  observedWindowStart: number;
  /** Unix seconds for the end of the source observation window. */
  observedWindowEnd: number;
  timezone?: string;
}

export interface HCSRCanonicalMetadataInput {
  syncOrigin?: string;
  writer?: string;
  upstreamRevision?: string;
  notes?: string[];
}

export interface HCSRSourceMetadataBuilderInput extends HCSRCanonicalMetadataInput {
  sourceFamily: HealthContextSourceFamily;
}

export interface HCSRCanonicalProvenanceInput {
  mode?: HealthContextProvenanceMode;
  sourceSystem: string;
  rawDay?: string;
  confidenceLabel?: HealthContextSourceProvenance['confidenceLabel'];
  notes?: string[];
}

export interface HCSRNormalizedSample<TPayload extends HCSRNormalizedPayload = HCSRNormalizedPayload> {
  sourceType: HealthContextSourceType;
  recordType?: HealthContextRecordType;
  domain: HealthContextDomain;
  window: HCSRObservationWindow;
  payload: TPayload;
  sourceMetadata?: Partial<HealthContextSourceMetadata>;
  provenance?: Partial<HealthContextSourceProvenance>;
  /** Optional custom segment for ids like `{athlete}_{family}_{segment}_{dateKey}`. */
  recordIdSegment?: string;
  /** Full override when an adapter needs finer segmentation than date/domain. */
  recordIdOverride?: string;
}

export interface HCSRRecordWriterInput<TPayload extends HCSRNormalizedPayload = HCSRNormalizedPayload> {
  athleteUserId: string;
  sourceFamily: HealthContextSourceFamily;
  sample: HCSRNormalizedSample<TPayload>;
  sourceMetadata?: HCSRCanonicalMetadataInput;
  provenance: HCSRCanonicalProvenanceInput;
}

export interface HCSRRecordIdentityInput {
  athleteUserId: string;
  sourceFamily: HealthContextSourceFamily;
  domain: HealthContextDomain;
  dateKey: string;
  recordIdSegment?: string;
}

const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_PROVENANCE_MODE: HealthContextProvenanceMode = 'direct';

const nowSeconds = () => Math.round(Date.now() / 1000);

const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as T;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    output[key] = stripUndefinedDeep(entry);
  }
  return output as T;
};

const requireString = (value: unknown, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[HCSRRecordWriter] ${label} is required.`);
  }
  return normalized;
};

const requireFiniteSeconds = (value: unknown, label: string): number => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    throw new Error(`[HCSRRecordWriter] ${label} must be a finite Unix seconds value.`);
  }
  return Math.round(normalized);
};

export const buildHCSRRecordId = ({
  athleteUserId,
  sourceFamily,
  domain,
  dateKey,
  recordIdSegment,
}: HCSRRecordIdentityInput): string => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const scopedFamily = requireString(sourceFamily, 'sourceFamily') as HealthContextSourceFamily;
  const scopedDateKey = requireString(dateKey, 'dateKey');
  const segment = typeof recordIdSegment === 'string' ? recordIdSegment.trim() : '';

  if (segment) {
    return `${scopedAthleteId}_${scopedFamily}_${segment}_${scopedDateKey}`;
  }

  return buildSourceRecordId(scopedAthleteId, scopedFamily, domain, scopedDateKey);
};

export const buildHCSRRecordDedupeKey = ({
  athleteUserId,
  sourceFamily,
  domain,
  dateKey,
}: HCSRRecordIdentityInput): string => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const scopedFamily = requireString(sourceFamily, 'sourceFamily') as HealthContextSourceFamily;
  const scopedDateKey = requireString(dateKey, 'dateKey');
  return buildSourceRecordDedupeKey(scopedAthleteId, scopedFamily, domain, scopedDateKey);
};

export const buildHCSRSourceMetadata = ({
  sourceFamily,
  syncOrigin,
  writer,
  upstreamRevision,
  notes,
}: HCSRSourceMetadataBuilderInput): HealthContextSourceMetadata => stripUndefinedDeep({
  syncOrigin: syncOrigin || `pulsecheck_${sourceFamily}_refresh`,
  writer: writer || 'hcsrRecordWriter.ts',
  upstreamRevision,
  notes,
});

export const buildHCSRProvenance = ({
  mode = DEFAULT_PROVENANCE_MODE,
  sourceSystem,
  rawDay,
  confidenceLabel,
  notes,
}: HCSRCanonicalProvenanceInput): HealthContextSourceProvenance => stripUndefinedDeep({
  mode,
  sourceSystem: requireString(sourceSystem, 'provenance.sourceSystem'),
  rawDay,
  confidenceLabel,
  notes,
});

export const normalizeHCSRRecordWriterInput = <TPayload extends HCSRNormalizedPayload>(
  input: HCSRRecordWriterInput<TPayload>,
): UpsertSourceRecordInput<TPayload> => {
  const athleteUserId = requireString(input.athleteUserId, 'athleteUserId');
  const sourceFamily = requireString(input.sourceFamily, 'sourceFamily') as HealthContextSourceFamily;
  const sourceType = requireString(input.sample.sourceType, 'sample.sourceType');
  const dateKey = requireString(input.sample.window.dateKey, 'sample.window.dateKey');
  const observedWindowStart = requireFiniteSeconds(
    input.sample.window.observedWindowStart,
    'sample.window.observedWindowStart',
  );
  const observedWindowEnd = requireFiniteSeconds(
    input.sample.window.observedWindowEnd,
    'sample.window.observedWindowEnd',
  );
  const observedAt = requireFiniteSeconds(
    input.sample.window.observedAt ?? observedWindowEnd,
    'sample.window.observedAt',
  );

  const recordIdOverride = input.sample.recordIdOverride || buildHCSRRecordId({
    athleteUserId,
    sourceFamily,
    domain: input.sample.domain,
    dateKey,
    recordIdSegment: input.sample.recordIdSegment,
  });

  return stripUndefinedDeep({
    athleteUserId,
    sourceFamily,
    sourceType,
    recordType: input.sample.recordType || 'summary_input',
    domain: input.sample.domain,
    observedAt,
    observedWindowStart,
    observedWindowEnd,
    timezone: input.sample.window.timezone || DEFAULT_TIMEZONE,
    dateKey,
    payload: input.sample.payload,
    sourceMetadata: {
      ...buildHCSRSourceMetadata({
        ...input.sourceMetadata,
        sourceFamily,
      }),
      ...input.sample.sourceMetadata,
    },
    provenance: {
      ...buildHCSRProvenance({
        rawDay: dateKey,
        ...input.provenance,
      }),
      ...input.sample.provenance,
    },
    recordIdOverride,
  });
};

export const buildHCSRSourceRecord = <TPayload extends HCSRNormalizedPayload>(
  input: HCSRRecordWriterInput<TPayload>,
): HealthContextSourceRecord<TPayload> => {
  const normalized = normalizeHCSRRecordWriterInput(input);
  const recordId = normalized.recordIdOverride
    || buildHCSRRecordId({
      athleteUserId: normalized.athleteUserId,
      sourceFamily: normalized.sourceFamily,
      domain: normalized.domain,
      dateKey: normalized.dateKey,
    });

  return {
    id: recordId,
    athleteUserId: normalized.athleteUserId,
    sourceFamily: normalized.sourceFamily,
    sourceType: normalized.sourceType,
    recordType: normalized.recordType || 'summary_input',
    domain: normalized.domain,
    observedAt: normalized.observedAt,
    observedWindowStart: normalized.observedWindowStart,
    observedWindowEnd: normalized.observedWindowEnd,
    ingestedAt: nowSeconds(),
    timezone: normalized.timezone,
    status: 'active',
    dedupeKey: buildHCSRRecordDedupeKey({
      athleteUserId: normalized.athleteUserId,
      sourceFamily: normalized.sourceFamily,
      domain: normalized.domain,
      dateKey: normalized.dateKey,
    }),
    payloadVersion: HEALTH_CONTEXT_SOURCE_RECORD_CONTRACT_VERSION,
    payload: normalized.payload,
    sourceMetadata: normalized.sourceMetadata,
    provenance: normalized.provenance,
  };
};

export const upsertHCSRRecord = async <TPayload extends HCSRNormalizedPayload>(
  input: HCSRRecordWriterInput<TPayload>,
): Promise<HealthContextSourceRecord<TPayload>> => upsertHealthContextSourceRecord(
  normalizeHCSRRecordWriterInput(input),
);

export const upsertHealthContextSourceRecordWithClient = upsertHCSRRecord;

export const hcsrRecordWriter = {
  normalize: normalizeHCSRRecordWriterInput,
  buildSourceRecord: buildHCSRSourceRecord,
  upsert: upsertHCSRRecord,
  upsertWithClient: upsertHealthContextSourceRecordWithClient,
  buildRecordId: buildHCSRRecordId,
  buildDedupeKey: buildHCSRRecordDedupeKey,
  buildSourceMetadata: buildHCSRSourceMetadata,
  buildProvenance: buildHCSRProvenance,
};
