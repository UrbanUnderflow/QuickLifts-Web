import { db } from '../config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION,
  PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION,
  PULSECHECK_PROTOCOL_FAMILIES_COLLECTION,
  PULSECHECK_PROTOCOL_HISTORY_SUBCOLLECTION,
  PULSECHECK_PROTOCOL_VARIANTS_COLLECTION,
  PULSECHECK_PROTOCOLS_COLLECTION,
} from './collections';
import {
  ExerciseCategory,
  type PulseCheckAssignmentEvent,
  type PulseCheckDailyAssignment,
  type PulseCheckProtocolDefinition,
  type PulseCheckProtocolEvidenceStatus,
  type PulseCheckProtocolDownstreamImpactSummary,
  type PulseCheckProtocolEvidenceFreshness,
  type PulseCheckProtocolEvidenceSummary,
  type PulseCheckProtocolFamily,
  type PulseCheckProtocolFamilyHistoryEntry,
  type PulseCheckProtocolFamilyStatus,
  type PulseCheckProtocolGovernanceStage,
  type PulseCheckProtocolHistoryAction,
  type PulseCheckProtocolHistoryEntry,
  type PulseCheckProtocolReviewGate,
  type PulseCheckProtocolReviewStatus,
  type PulseCheckProtocolVariant,
  type PulseCheckProtocolVariantHistoryEntry,
  pulseCheckDailyAssignmentFromFirestore,
  pulseCheckProtocolDefinitionFromFirestore,
  pulseCheckProtocolDefinitionToFirestore,
  pulseCheckProtocolFamilyFromFirestore,
  pulseCheckProtocolFamilyToFirestore,
  pulseCheckProtocolVariantFromFirestore,
  pulseCheckProtocolVariantToFirestore,
} from './types';
import protocolSeed from './pulsecheckProtocolRegistry.json';
import { getSeededProtocolFamilySpecById } from './pulsecheckProtocolFamilySpecs';
import { getSeededProtocolVariantSpecById } from './pulsecheckProtocolVariantSpecs';

export interface ProtocolRegistryWorkspaceBundle {
  families: PulseCheckProtocolFamily[];
  variants: PulseCheckProtocolVariant[];
  runtimeRecords: PulseCheckProtocolDefinition[];
}

const sortByLabel = <T extends { label: string }>(left: T, right: T) => left.label.localeCompare(right.label);

const sortProtocols = (left: PulseCheckProtocolDefinition, right: PulseCheckProtocolDefinition) => {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  return left.label.localeCompare(right.label);
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeStringArray(values: string[] | undefined, fallback: string[] = []) {
  const source = Array.isArray(values) ? values : fallback;
  return Array.from(new Set(source.map((value) => value.trim()).filter(Boolean)));
}

const EVIDENCE_CURRENT_WINDOW_DAYS = 21;
const EVIDENCE_DEGRADED_WINDOW_DAYS = 45;

function defaultExpectedStateShift(protocolClass: PulseCheckProtocolDefinition['protocolClass']) {
  switch (protocolClass) {
    case 'priming':
      return 'Increase focus readiness, activation, or execution confidence before the next rep.';
    case 'recovery':
      return 'Downregulate post-load stress and help the athlete exit the session in a cleaner recovery posture.';
    case 'regulation':
    default:
      return 'Reduce activation spillover or emotional noise so the athlete can return to useful execution.';
  }
}

function defaultAvoidWindowTags(protocolClass: PulseCheckProtocolDefinition['protocolClass']) {
  switch (protocolClass) {
    case 'priming':
      return ['late_evening', 'sleep_window'];
    case 'recovery':
      return ['immediate_pre_competition', 'pre_max_effort'];
    case 'regulation':
    default:
      return [];
  }
}

function derivePublishedRevisionId(protocolId: string, publishedAt?: number) {
  if (!protocolId || typeof publishedAt !== 'number' || !Number.isFinite(publishedAt)) return undefined;
  return `${protocolId}@${publishedAt}`;
}

function deriveResponseDirection(
  positiveSignals: number,
  negativeSignals: number
): PulseCheckProtocolEvidenceSummary['responseDirection'] {
  if (negativeSignals > positiveSignals && negativeSignals > 0) return 'negative';
  if (positiveSignals > negativeSignals && positiveSignals > 0) return 'positive';
  if (positiveSignals > 0 && negativeSignals > 0) return 'mixed';
  return 'neutral';
}

function deriveConfidence(sampleSize: number, positiveSignals: number, negativeSignals: number) {
  const decisiveSignals = positiveSignals + negativeSignals;
  const dominance = decisiveSignals > 0 ? Math.max(positiveSignals, negativeSignals) / decisiveSignals : 0;

  if (sampleSize >= 6 && decisiveSignals >= 4 && dominance >= 0.66) return 'high' as const;
  if (sampleSize >= 3 && decisiveSignals >= 2) return 'medium' as const;
  return 'low' as const;
}

function deriveEvidenceFreshness(lastObservedAt?: number, lastConfirmedAt?: number): PulseCheckProtocolEvidenceFreshness | undefined {
  const anchor = lastConfirmedAt || lastObservedAt;
  if (!anchor) return undefined;

  const ageDays = (Date.now() - anchor) / (24 * 60 * 60 * 1000);
  const freshness =
    ageDays <= EVIDENCE_CURRENT_WINDOW_DAYS
      ? 'current'
      : ageDays <= EVIDENCE_DEGRADED_WINDOW_DAYS
        ? 'degraded'
        : 'refresh_required';

  return {
    freshness,
    lastObservedAt,
    lastConfirmedAt,
    ageDays: Number(ageDays.toFixed(1)),
    staleAt: lastObservedAt ? lastObservedAt + EVIDENCE_DEGRADED_WINDOW_DAYS * 24 * 60 * 60 * 1000 : undefined,
    explanation:
      freshness === 'current'
        ? 'Evidence is still within the current freshness window.'
        : freshness === 'degraded'
          ? 'Evidence is getting older and should be refreshed soon.'
          : 'Evidence is stale enough that launch confidence should be downgraded until refreshed.',
  };
}

function normalizeEvidenceFreshness(
  freshness: Partial<PulseCheckProtocolEvidenceFreshness> | undefined,
  lastObservedAt?: number,
  lastConfirmedAt?: number
): PulseCheckProtocolEvidenceFreshness | undefined {
  if (!freshness) {
    return deriveEvidenceFreshness(lastObservedAt, lastConfirmedAt);
  }

  const derived = deriveEvidenceFreshness(
    typeof freshness.lastObservedAt === 'number' ? freshness.lastObservedAt : lastObservedAt,
    typeof freshness.lastConfirmedAt === 'number' ? freshness.lastConfirmedAt : lastConfirmedAt
  );

  return {
    freshness: freshness.freshness || derived?.freshness || 'degraded',
    lastObservedAt: typeof freshness.lastObservedAt === 'number' ? freshness.lastObservedAt : derived?.lastObservedAt,
    lastConfirmedAt: typeof freshness.lastConfirmedAt === 'number' ? freshness.lastConfirmedAt : derived?.lastConfirmedAt,
    ageDays: typeof freshness.ageDays === 'number' ? freshness.ageDays : derived?.ageDays,
    staleAt: typeof freshness.staleAt === 'number' ? freshness.staleAt : derived?.staleAt,
    explanation: freshness.explanation?.trim() || derived?.explanation,
  };
}

function normalizeDownstreamImpactSummary(
  summary: Partial<PulseCheckProtocolDownstreamImpactSummary> | undefined
): PulseCheckProtocolDownstreamImpactSummary | undefined {
  if (!summary) return undefined;
  const sampleSize = typeof summary.sampleSize === 'number' ? summary.sampleSize : 0;
  const positiveSignals = typeof summary.positiveSignals === 'number' ? summary.positiveSignals : 0;
  const neutralSignals = typeof summary.neutralSignals === 'number' ? summary.neutralSignals : 0;
  const negativeSignals = typeof summary.negativeSignals === 'number' ? summary.negativeSignals : 0;
  const totalSignals = positiveSignals + neutralSignals + negativeSignals;
  const inferredSampleSize = Math.max(sampleSize, totalSignals);

  return {
    sampleSize: inferredSampleSize,
    positiveSignals,
    neutralSignals,
    negativeSignals,
    responseDirection:
      summary.responseDirection || deriveResponseDirection(positiveSignals, negativeSignals),
    confidence: summary.confidence || deriveConfidence(inferredSampleSize, positiveSignals, negativeSignals),
    lastObservedAt: typeof summary.lastObservedAt === 'number' ? summary.lastObservedAt : undefined,
    lastConfirmedAt: typeof summary.lastConfirmedAt === 'number' ? summary.lastConfirmedAt : undefined,
    explanation: summary.explanation?.trim() || undefined,
  };
}

function normalizeEvidencePanel(
  panel: Partial<PulseCheckProtocolEvidenceSummary> | undefined,
): PulseCheckProtocolEvidenceSummary | undefined {
  if (!panel) return undefined;
  const sampleSize = typeof panel.sampleSize === 'number' ? panel.sampleSize : 0;
  const positiveSignals = typeof panel.positiveSignals === 'number' ? panel.positiveSignals : 0;
  const neutralSignals = typeof panel.neutralSignals === 'number' ? panel.neutralSignals : 0;
  const negativeSignals = typeof panel.negativeSignals === 'number' ? panel.negativeSignals : 0;
  const totalSignals = positiveSignals + neutralSignals + negativeSignals;
  const inferredSampleSize = Math.max(sampleSize, totalSignals);
  const lastObservedAt = typeof panel.lastObservedAt === 'number' ? panel.lastObservedAt : undefined;
  const freshness = normalizeEvidenceFreshness(panel.freshness, lastObservedAt);
  const downstreamImpact = normalizeDownstreamImpactSummary(panel.downstreamImpact);

  return {
    sampleSize: inferredSampleSize,
    positiveSignals,
    neutralSignals,
    negativeSignals,
    responseDirection: panel.responseDirection || deriveResponseDirection(positiveSignals, negativeSignals),
    confidence: panel.confidence || deriveConfidence(inferredSampleSize, positiveSignals, negativeSignals),
    lastObservedAt,
    freshness,
    downstreamImpact,
    explanation: panel.explanation?.trim() || undefined,
  };
}

function deriveEvidenceStatus(
  panel: PulseCheckProtocolEvidenceSummary | undefined
): PulseCheckProtocolEvidenceStatus {
  if (!panel || panel.sampleSize <= 0) return 'insufficient';
  if (panel.freshness?.freshness === 'refresh_required') {
    return panel.sampleSize >= 3 ? 'watch' : 'developing';
  }
  if (panel.responseDirection === 'negative' || panel.negativeSignals >= panel.positiveSignals) return 'watch';
  if (panel.downstreamImpact?.responseDirection === 'negative') return 'watch';
  if (panel.sampleSize >= 6 && panel.positiveSignals > panel.negativeSignals) return 'credible';
  return 'developing';
}

function classifyAssignmentDownstreamImpact(
  assignment: PulseCheckDailyAssignment,
  downstreamAssignments: PulseCheckDailyAssignment[]
): {
  responseDirection: PulseCheckProtocolDownstreamImpactSummary['responseDirection'];
  positiveSignals: number;
  neutralSignals: number;
  negativeSignals: number;
  lastObservedAt: number;
  lastConfirmedAt?: number;
  explanation: string;
} {
  const orderedDownstream = downstreamAssignments
    .filter((candidate) => candidate.actionType === 'sim' || candidate.actionType === 'lighter_sim')
    .slice()
    .sort((left, right) => (right.updatedAt || right.createdAt || 0) - (left.updatedAt || left.createdAt || 0));

  if (!orderedDownstream.length) {
    return {
      responseDirection: 'neutral',
      positiveSignals: 0,
      neutralSignals: 1,
      negativeSignals: 0,
      lastObservedAt: assignment.updatedAt || assignment.createdAt || 0,
      explanation: 'No downstream sim or lighter-sim assignment was observed on the same day.',
    };
  }

  const latest = orderedDownstream[0];
  const latestEvent = latest.completedAt
    ? { type: 'completed' as const, at: latest.completedAt }
    : latest.status === 'completed'
      ? { type: 'completed' as const, at: latest.updatedAt || latest.createdAt || 0 }
      : latest.status === 'deferred' || latest.status === 'overridden'
        ? { type: latest.status as 'deferred' | 'overridden', at: latest.updatedAt || latest.createdAt || 0 }
        : undefined;

  if (latestEvent?.type === 'completed') {
    return {
      responseDirection: 'positive',
      positiveSignals: 1,
      neutralSignals: 0,
      negativeSignals: 0,
      lastObservedAt: latest.updatedAt || latest.createdAt || assignment.updatedAt || assignment.createdAt || 0,
      lastConfirmedAt: latestEvent.at,
      explanation: `Downstream ${latest.actionType === 'lighter_sim' ? 'lighter sim' : 'sim'} completed after the protocol.`,
    };
  }

  if (latestEvent?.type === 'deferred' || latestEvent?.type === 'overridden') {
    return {
      responseDirection: 'negative',
      positiveSignals: 0,
      neutralSignals: 0,
      negativeSignals: 1,
      lastObservedAt: latest.updatedAt || latest.createdAt || assignment.updatedAt || assignment.createdAt || 0,
      lastConfirmedAt: latestEvent.at,
      explanation: `Downstream ${latest.actionType === 'lighter_sim' ? 'lighter sim' : 'sim'} was deferred or overridden.`,
    };
  }

  return {
    responseDirection: 'neutral',
    positiveSignals: 0,
    neutralSignals: 1,
    negativeSignals: 0,
    lastObservedAt: latest.updatedAt || latest.createdAt || assignment.updatedAt || assignment.createdAt || 0,
    explanation: `Downstream ${latest.actionType === 'lighter_sim' ? 'lighter sim' : 'sim'} is still in-flight or inconclusive.`,
  };
}

function summarizeDownstreamSignals(
  assignments: PulseCheckDailyAssignment[],
  downstreamAssignmentsByKey: Map<string, PulseCheckDailyAssignment[]>
): PulseCheckProtocolDownstreamImpactSummary | undefined {
  if (!assignments.length) return undefined;

  let positiveSignals = 0;
  let neutralSignals = 0;
  let negativeSignals = 0;
  let lastObservedAt = 0;
  let lastConfirmedAt = 0;
  const evidence: string[] = [];

  assignments.forEach((assignment) => {
    const key = `${assignment.athleteId}::${assignment.sourceDate}`;
    const downstreamSummary = classifyAssignmentDownstreamImpact(assignment, downstreamAssignmentsByKey.get(key) || []);

    positiveSignals += downstreamSummary.responseDirection === 'positive' ? 1 : 0;
    neutralSignals += downstreamSummary.responseDirection === 'neutral' ? 1 : 0;
    negativeSignals += downstreamSummary.responseDirection === 'negative' ? 1 : 0;
    lastObservedAt = Math.max(lastObservedAt, downstreamSummary.lastObservedAt || 0);
    if (downstreamSummary.lastConfirmedAt) {
      lastConfirmedAt = Math.max(lastConfirmedAt, downstreamSummary.lastConfirmedAt);
    }
    evidence.push(downstreamSummary.explanation);
  });

  const sampleSize = assignments.length;
  return {
    sampleSize,
    positiveSignals,
    neutralSignals,
    negativeSignals,
    responseDirection: deriveResponseDirection(positiveSignals, negativeSignals),
    confidence: deriveConfidence(sampleSize, positiveSignals, negativeSignals),
    lastObservedAt: lastObservedAt || undefined,
    lastConfirmedAt: lastConfirmedAt || undefined,
    explanation: evidence.slice(0, 3).join(' '),
  };
}

function summarizeEvidenceFreshness(
  sampleLastObservedAt?: number,
  sampleLastConfirmedAt?: number
): PulseCheckProtocolEvidenceFreshness | undefined {
  return deriveEvidenceFreshness(sampleLastObservedAt, sampleLastConfirmedAt);
}

function summarizeReviewStatus(gates: PulseCheckProtocolReviewGate[]): PulseCheckProtocolReviewStatus {
  if (!gates.length) return 'not_started';
  if (gates.some((gate) => gate.status === 'blocked')) return 'blocked';
  if (gates.every((gate) => gate.status === 'passed')) return 'approved';
  if (gates.some((gate) => gate.status === 'passed')) return 'in_review';
  return 'not_started';
}

function buildGate(
  key: string,
  label: string,
  condition: boolean,
  blockedWhenMissing = false,
  note?: string
): PulseCheckProtocolReviewGate {
  return {
    key,
    label,
    status: condition ? 'passed' : blockedWhenMissing ? 'blocked' : 'pending',
    note,
  };
}

function deriveFamilyReviewChecklist(record: Partial<PulseCheckProtocolFamily>): PulseCheckProtocolReviewGate[] {
  return [
    buildGate('mechanism', 'Mechanism is clearly defined', Boolean(record.mechanismSummary?.trim()), true),
    buildGate('state_shift', 'Expected state shift is explicit', Boolean(record.expectedStateShift?.trim()), true),
    buildGate('bottleneck', 'Target bottleneck is named', Boolean(record.targetBottleneck?.trim())),
    buildGate('use_window', 'Use window tags are defined', Boolean(record.useWindowTags?.length)),
    buildGate('contraindications', 'Contraindications or avoid windows reviewed', Boolean(record.contraindicationTags?.length || record.avoidWindowTags?.length)),
    buildGate('evidence', 'Evidence rationale is recorded', Boolean(record.evidenceSummary?.trim() || record.sourceReferences?.length)),
  ];
}

function deriveVariantReviewChecklist(record: Partial<PulseCheckProtocolVariant>): PulseCheckProtocolReviewGate[] {
  return [
    buildGate('delivery', 'Delivery mode is specified', Boolean(record.deliveryMode), true),
    buildGate('asset', 'Underlying source asset is bound', Boolean(record.legacyExerciseId?.trim()), true),
    buildGate('script', 'Script or prompting summary is recorded', Boolean(record.scriptSummary?.trim())),
    buildGate('trigger', 'Trigger tags are defined', Boolean(record.triggerTags?.length)),
    buildGate('window', 'Context or use-window tags are defined', Boolean(record.preferredContextTags?.length || record.useWindowTags?.length)),
    buildGate('evidence', 'Scientific basis is attached', Boolean(record.evidenceSummary?.trim() || record.sourceReferences?.length)),
    buildGate('misuse', 'Misuse risk reviewed', Boolean(record.contraindicationTags?.length || record.reviewNotes?.trim())),
  ];
}

function deriveRuntimeReviewChecklist(record: Partial<PulseCheckProtocolDefinition>): PulseCheckProtocolReviewGate[] {
  return [
    buildGate('runtime_label', 'Runtime label is defined', Boolean(record.label?.trim()), true),
    buildGate('family_link', 'Family and variant links are valid', Boolean(record.familyId?.trim() && record.variantId?.trim()), true),
    buildGate('planner_metadata', 'Planner metadata is bounded', Boolean(record.protocolClass && record.responseFamily && record.deliveryMode), true),
    buildGate('trigger_logic', 'Trigger and context tags are present', Boolean(record.triggerTags?.length && (record.preferredContextTags?.length || record.useWindowTags?.length))),
    buildGate('review_notes', 'Review notes or evidence summary exist', Boolean(record.reviewNotes?.trim() || record.evidenceSummary?.trim())),
    buildGate('cadence', 'Review cadence is configured', Boolean((record.reviewCadenceDays || 0) > 0)),
  ];
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function pulseCheckAssignmentEventFromFirestore(
  id: string,
  data: Record<string, any>
): PulseCheckAssignmentEvent {
  return {
    id,
    assignmentId: data.assignmentId || '',
    athleteId: data.athleteId || '',
    teamId: data.teamId || '',
    sourceDate: data.sourceDate || '',
    eventType: data.eventType || 'viewed',
    actorType: data.actorType || 'system',
    actorUserId: data.actorUserId || '',
    eventAt: data.eventAt || data.createdAt || Date.now(),
    metadata: data.metadata || undefined,
    createdAt: data.createdAt || Date.now(),
  };
}

function buildLiveEvidencePanel(
  assignments: PulseCheckDailyAssignment[],
  eventsByAssignmentId: Map<string, PulseCheckAssignmentEvent[]>,
  label: string,
  downstreamAssignmentsByKey: Map<string, PulseCheckDailyAssignment[]>
): PulseCheckProtocolEvidenceSummary | undefined {
  if (!assignments.length) {
    return undefined;
  }

  let positiveSignals = 0;
  let neutralSignals = 0;
  let negativeSignals = 0;
  let lastObservedAt = 0;
  let lastConfirmedAt = 0;
  const evidenceNarrative: string[] = [];

  assignments.forEach((assignment) => {
    const events = (eventsByAssignmentId.get(assignment.id) || []).slice().sort((left, right) => right.eventAt - left.eventAt);
    const latestMeaningfulEvent = events.find((event) => event.eventType === 'completed' || event.eventType === 'deferred' || event.eventType === 'overridden');
    const latestObservedAt = latestMeaningfulEvent?.eventAt || assignment.updatedAt || assignment.createdAt || 0;
    lastObservedAt = Math.max(lastObservedAt, latestObservedAt);

    if (latestMeaningfulEvent?.eventType === 'completed' || assignment.status === 'completed') {
      positiveSignals += 1;
      lastConfirmedAt = Math.max(lastConfirmedAt, latestMeaningfulEvent?.eventAt || assignment.completedAt || assignment.updatedAt || assignment.createdAt || 0);
      evidenceNarrative.push('Observed a completed protocol assignment.');
      return;
    }

    if (
      latestMeaningfulEvent?.eventType === 'deferred' ||
      latestMeaningfulEvent?.eventType === 'overridden' ||
      assignment.status === 'deferred' ||
      assignment.status === 'overridden'
    ) {
      negativeSignals += 1;
      lastConfirmedAt = Math.max(lastConfirmedAt, latestMeaningfulEvent?.eventAt || assignment.updatedAt || assignment.createdAt || 0);
      evidenceNarrative.push('Observed a deferred or overridden protocol assignment.');
      return;
    }

    neutralSignals += 1;
    evidenceNarrative.push('Protocol assignment is still in-flight or inconclusive.');
  });

  const sampleSize = assignments.length;
  const downstreamImpact = summarizeDownstreamSignals(assignments, downstreamAssignmentsByKey);
  const derivedFreshness = summarizeEvidenceFreshness(lastObservedAt, lastConfirmedAt || downstreamImpact?.lastConfirmedAt);
  const freshness = normalizeEvidenceFreshness(derivedFreshness, lastObservedAt, lastConfirmedAt || downstreamImpact?.lastConfirmedAt);
  const signalMix = `${positiveSignals} completed, ${negativeSignals} deferred or overridden, ${neutralSignals} still in-flight or inconclusive.`;
  const freshnessLine = freshness
    ? `Freshness is ${freshness.freshness}${typeof freshness.ageDays === 'number' ? ` (${freshness.ageDays} days old)` : ''}.`
    : 'Freshness could not be derived yet.';
  const downstreamLine = downstreamImpact
    ? `Downstream impact trends ${downstreamImpact.responseDirection} with ${downstreamImpact.positiveSignals} positive, ${downstreamImpact.negativeSignals} negative, and ${downstreamImpact.neutralSignals} neutral downstream outcomes.`
    : 'No downstream impact signal has been captured yet.';

  const responseDirection =
    negativeSignals > positiveSignals && negativeSignals > 0
      ? 'negative'
      : positiveSignals > negativeSignals && positiveSignals > 0
        ? 'positive'
        : positiveSignals > 0 && negativeSignals > 0
          ? 'mixed'
          : 'neutral';
  const confidence = sampleSize >= 6 ? 'high' : sampleSize >= 3 ? 'medium' : 'low';

  return {
    sampleSize,
    positiveSignals,
    neutralSignals,
    negativeSignals,
    responseDirection,
    confidence,
    lastObservedAt: lastObservedAt || undefined,
    freshness,
    downstreamImpact,
    explanation: `Live runtime evidence for ${label}: ${signalMix} ${downstreamLine} ${freshnessLine} ${evidenceNarrative.slice(0, 4).join(' ')}`.trim(),
  };
}

function deriveGovernanceStageFromPublishStatus(
  publishStatus: PulseCheckProtocolDefinition['publishStatus'],
  explicitStage?: PulseCheckProtocolGovernanceStage
): PulseCheckProtocolGovernanceStage {
  if (explicitStage) return explicitStage;
  if (publishStatus === 'published') return 'published';
  if (publishStatus === 'archived') return 'archived';
  return 'structured';
}

function deriveFamilyStatus(
  publishStatus: PulseCheckProtocolDefinition['publishStatus'],
  explicitStatus?: PulseCheckProtocolFamilyStatus
): PulseCheckProtocolFamilyStatus {
  if (explicitStatus) return explicitStatus;
  return publishStatus === 'published' ? 'locked' : 'candidate';
}

function buildDefaultFamilyId(
  protocolClass: PulseCheckProtocolDefinition['protocolClass'],
  responseFamily: PulseCheckProtocolDefinition['responseFamily']
) {
  return `${protocolClass}-${responseFamily}`;
}

function buildDefaultVariantId(familyId: string, variantKey: string) {
  return `${familyId}--${variantKey}`;
}

function normalizeFamilyRecord(
  record: Partial<PulseCheckProtocolFamily>,
  now = Date.now()
): PulseCheckProtocolFamily {
  const label = record.label?.trim() || 'New Protocol Family';
  const protocolClass = record.protocolClass || 'regulation';
  const responseFamily = record.responseFamily || 'steady_regulation';
  const reviewChecklist = Array.isArray(record.reviewChecklist) && record.reviewChecklist.length
    ? record.reviewChecklist
    : deriveFamilyReviewChecklist(record);
  const reviewStatus = record.reviewStatus || summarizeReviewStatus(reviewChecklist);
  const evidencePanel = normalizeEvidencePanel(record.evidencePanel);
  const evidenceStatus = record.evidenceStatus || deriveEvidenceStatus(evidencePanel);
  const reviewCadenceDays = typeof record.reviewCadenceDays === 'number' ? record.reviewCadenceDays : 30;
  return {
    id: record.id?.trim() || buildDefaultFamilyId(protocolClass, responseFamily),
    label,
    protocolClass,
    responseFamily,
    familyStatus: record.familyStatus || 'candidate',
    governanceStage: record.governanceStage || 'structured',
    mechanismSummary: record.mechanismSummary?.trim() || '',
    targetBottleneck: record.targetBottleneck?.trim() || '',
    expectedStateShift: record.expectedStateShift?.trim() || defaultExpectedStateShift(protocolClass),
    useWindowTags: normalizeStringArray(record.useWindowTags),
    avoidWindowTags: normalizeStringArray(record.avoidWindowTags, defaultAvoidWindowTags(protocolClass)),
    contraindicationTags: normalizeStringArray(record.contraindicationTags),
    evidenceSummary: record.evidenceSummary?.trim() || undefined,
    sourceReferences: normalizeStringArray(record.sourceReferences),
    reviewNotes: record.reviewNotes?.trim() || undefined,
    reviewStatus,
    reviewChecklist,
    evidenceStatus,
    evidencePanel,
    reviewCadenceDays,
    lastReviewedAt: typeof record.lastReviewedAt === 'number' ? record.lastReviewedAt : undefined,
    nextReviewAt: typeof record.nextReviewAt === 'number' ? record.nextReviewAt : undefined,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : now,
  };
}

function normalizeVariantRecord(
  record: Partial<PulseCheckProtocolVariant>,
  family?: PulseCheckProtocolFamily | null,
  now = Date.now()
): PulseCheckProtocolVariant {
  const label = record.label?.trim() || 'New Protocol Variant';
  const familyId = record.familyId?.trim() || family?.id || 'unassigned-family';
  const variantKey = record.variantKey?.trim() || slugify(label || 'variant');
  const reviewChecklist = Array.isArray(record.reviewChecklist) && record.reviewChecklist.length
    ? record.reviewChecklist
    : deriveVariantReviewChecklist(record);
  const approvalStatus = record.approvalStatus || summarizeReviewStatus(reviewChecklist);
  const evidencePanel = normalizeEvidencePanel(record.evidencePanel);
  const evidenceStatus = record.evidenceStatus || deriveEvidenceStatus(evidencePanel);
  const reviewCadenceDays = typeof record.reviewCadenceDays === 'number' ? record.reviewCadenceDays : 30;
  return {
    id: record.id?.trim() || buildDefaultVariantId(familyId, variantKey),
    familyId,
    label,
    variantKey,
    variantVersion: record.variantVersion?.trim() || 'v1',
    category: record.category || ExerciseCategory.Breathing,
    deliveryMode: record.deliveryMode || 'guided_breathing',
    legacyExerciseId: record.legacyExerciseId?.trim() || '',
    rationale: record.rationale?.trim() || '',
    scriptSummary: record.scriptSummary?.trim() || '',
    durationSeconds: typeof record.durationSeconds === 'number' ? record.durationSeconds : 180,
    triggerTags: normalizeStringArray(record.triggerTags),
    preferredContextTags: normalizeStringArray(record.preferredContextTags),
    useWindowTags: normalizeStringArray(record.useWindowTags, family?.useWindowTags || record.preferredContextTags || []),
    avoidWindowTags: normalizeStringArray(record.avoidWindowTags, family?.avoidWindowTags || []),
    contraindicationTags: normalizeStringArray(record.contraindicationTags, family?.contraindicationTags || []),
    evidenceSummary: record.evidenceSummary?.trim() || undefined,
    sourceReferences: normalizeStringArray(record.sourceReferences),
    reviewNotes: record.reviewNotes?.trim() || undefined,
    approvalStatus,
    reviewChecklist,
    evidenceStatus,
    evidencePanel,
    reviewCadenceDays,
    lastReviewedAt: typeof record.lastReviewedAt === 'number' ? record.lastReviewedAt : undefined,
    nextReviewAt: typeof record.nextReviewAt === 'number' ? record.nextReviewAt : undefined,
    governanceStage: record.governanceStage || family?.governanceStage || 'structured',
    isActive: record.isActive ?? true,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : now,
  };
}

function normalizeRuntimeRecord(
  record: Partial<PulseCheckProtocolDefinition>,
  family?: PulseCheckProtocolFamily | null,
  variant?: PulseCheckProtocolVariant | null,
  now = Date.now(),
  fallbackSortOrder = 999
): PulseCheckProtocolDefinition {
  const label = record.label?.trim() || variant?.label || 'New Protocol';
  const protocolClass = record.protocolClass || family?.protocolClass || 'regulation';
  const responseFamily = record.responseFamily || family?.responseFamily || 'steady_regulation';
  const familyId = record.familyId?.trim() || family?.id || buildDefaultFamilyId(protocolClass, responseFamily);
  const variantKey = record.variantKey?.trim() || variant?.variantKey || slugify(label || 'protocol');
  const publishStatus = record.publishStatus || 'draft';
  const preferredContextTags = normalizeStringArray(record.preferredContextTags, variant?.preferredContextTags || []);
  const reviewChecklist = Array.isArray(record.reviewChecklist) && record.reviewChecklist.length
    ? record.reviewChecklist
    : deriveRuntimeReviewChecklist(record);
  const reviewStatus = record.reviewStatus || summarizeReviewStatus(reviewChecklist);
  const evidencePanel = normalizeEvidencePanel(record.evidencePanel);
  const evidenceStatus = record.evidenceStatus || deriveEvidenceStatus(evidencePanel);
  const reviewCadenceDays = typeof record.reviewCadenceDays === 'number' ? record.reviewCadenceDays : 30;
  const publishedAt = typeof record.publishedAt === 'number' ? record.publishedAt : undefined;
  const normalizedId = record.id?.trim() || `protocol-${variantKey || Date.now()}`;
  return {
    id: normalizedId,
    label,
    familyId,
    familyLabel: record.familyLabel?.trim() || family?.label || toTitleCase(responseFamily),
    familyStatus: deriveFamilyStatus(publishStatus, record.familyStatus || family?.familyStatus),
    variantId: record.variantId?.trim() || variant?.id || buildDefaultVariantId(familyId, variantKey),
    variantKey,
    variantLabel: record.variantLabel?.trim() || variant?.label || label,
    variantVersion: record.variantVersion?.trim() || variant?.variantVersion || 'v1',
    publishedRevisionId: record.publishedRevisionId || derivePublishedRevisionId(normalizedId, publishedAt),
    governanceStage: deriveGovernanceStageFromPublishStatus(publishStatus, record.governanceStage || variant?.governanceStage || family?.governanceStage),
    legacyExerciseId: record.legacyExerciseId?.trim() || variant?.legacyExerciseId || '',
    protocolClass,
    category: record.category || variant?.category || ExerciseCategory.Breathing,
    responseFamily,
    deliveryMode: record.deliveryMode || variant?.deliveryMode || 'guided_breathing',
    triggerTags: normalizeStringArray(record.triggerTags, variant?.triggerTags || []),
    preferredContextTags,
    useWindowTags: normalizeStringArray(record.useWindowTags, variant?.useWindowTags || family?.useWindowTags || preferredContextTags),
    avoidWindowTags: normalizeStringArray(record.avoidWindowTags, variant?.avoidWindowTags || family?.avoidWindowTags || defaultAvoidWindowTags(protocolClass)),
    contraindicationTags: normalizeStringArray(record.contraindicationTags, variant?.contraindicationTags || family?.contraindicationTags || []),
    rationale: record.rationale?.trim() || variant?.rationale?.trim() || '',
    mechanism: record.mechanism?.trim() || family?.mechanismSummary?.trim() || variant?.scriptSummary?.trim() || '',
    expectedStateShift: record.expectedStateShift?.trim() || family?.expectedStateShift || defaultExpectedStateShift(protocolClass),
    reviewNotes: record.reviewNotes?.trim() || variant?.reviewNotes?.trim() || family?.reviewNotes?.trim() || undefined,
    evidenceSummary: record.evidenceSummary?.trim() || variant?.evidenceSummary?.trim() || family?.evidenceSummary?.trim() || undefined,
    durationSeconds: typeof record.durationSeconds === 'number' ? record.durationSeconds : variant?.durationSeconds || 180,
    sortOrder: typeof record.sortOrder === 'number' ? record.sortOrder : fallbackSortOrder,
    publishStatus,
    isActive: record.isActive ?? publishStatus !== 'archived',
    reviewStatus,
    reviewChecklist,
    evidenceStatus,
    evidencePanel,
    reviewCadenceDays,
    lastReviewedAt: typeof record.lastReviewedAt === 'number' ? record.lastReviewedAt : undefined,
    nextReviewAt: typeof record.nextReviewAt === 'number' ? record.nextReviewAt : undefined,
    publishedAt,
    archivedAt: typeof record.archivedAt === 'number' ? record.archivedAt : undefined,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : now,
  };
}

function buildSeedWorkspace(now = Date.now()): ProtocolRegistryWorkspaceBundle {
  const runtimeRecords = (protocolSeed as Partial<PulseCheckProtocolDefinition>[])
    .map((record, index) => {
      const protocolClass = record.protocolClass || 'regulation';
      const responseFamily = record.responseFamily || 'steady_regulation';
      const familyId = buildDefaultFamilyId(protocolClass, responseFamily);
      const variantKey = record.variantKey || slugify(record.variantLabel || record.label || record.id || 'protocol');
      const variantId = buildDefaultVariantId(familyId, variantKey);
      return normalizeRuntimeRecord(
        {
          ...record,
          familyId,
          familyLabel: record.familyLabel || toTitleCase(responseFamily),
          familyStatus: record.familyStatus || 'locked',
          variantId,
          variantKey,
          variantLabel: record.variantLabel || record.label,
          variantVersion: record.variantVersion || 'v1',
          governanceStage: record.governanceStage || 'published',
          sortOrder: typeof record.sortOrder === 'number' ? record.sortOrder : (index + 1) * 10,
          createdAt: now,
          updatedAt: now,
          publishedAt: record.publishStatus === 'published' ? now : undefined,
        },
        null,
        null,
        now,
        (index + 1) * 10
      );
    })
    .sort(sortProtocols);

  const families = Array.from(
    runtimeRecords.reduce<Map<string, PulseCheckProtocolFamily>>((acc, record) => {
      if (acc.has(record.familyId)) return acc;
      const familySpec = getSeededProtocolFamilySpecById(record.familyId);
      acc.set(
        record.familyId,
        normalizeFamilyRecord(
          {
            id: record.familyId,
            label: record.familyLabel,
            protocolClass: record.protocolClass,
            responseFamily: record.responseFamily,
            familyStatus: record.familyStatus,
            governanceStage: record.governanceStage === 'published' ? 'published' : record.governanceStage,
            mechanismSummary: record.mechanism,
            targetBottleneck: record.rationale,
            expectedStateShift: record.expectedStateShift,
            useWindowTags: record.useWindowTags,
            avoidWindowTags: record.avoidWindowTags,
            contraindicationTags: record.contraindicationTags,
            evidenceSummary: record.evidenceSummary,
            sourceReferences: [],
            reviewNotes: record.reviewNotes,
            ...familySpec,
            createdAt: now,
            updatedAt: now,
          },
          now
        )
      );
      return acc;
    }, new Map()).values()
  ).sort(sortByLabel);

  const familyById = new Map(families.map((family) => [family.id, family]));

  const variants = runtimeRecords
    .map((record) =>
      {
        const variantSpec = getSeededProtocolVariantSpecById(record.variantId);
        return normalizeVariantRecord(
          {
            id: record.variantId,
            familyId: record.familyId,
            label: record.variantLabel,
            variantKey: record.variantKey,
            variantVersion: record.variantVersion,
            category: record.category,
            deliveryMode: record.deliveryMode,
            legacyExerciseId: record.legacyExerciseId,
            rationale: record.rationale,
            scriptSummary: record.mechanism,
            durationSeconds: record.durationSeconds,
            triggerTags: record.triggerTags,
            preferredContextTags: record.preferredContextTags,
            useWindowTags: record.useWindowTags,
            avoidWindowTags: record.avoidWindowTags,
            contraindicationTags: record.contraindicationTags,
            evidenceSummary: record.evidenceSummary,
            sourceReferences: [],
            reviewNotes: record.reviewNotes,
            governanceStage: record.governanceStage === 'published' ? 'pilot' : record.governanceStage,
            isActive: true,
            ...variantSpec,
            createdAt: now,
            updatedAt: now,
          },
          familyById.get(record.familyId),
          now
        );
      }
    )
    .sort(sortByLabel);

  return { families, variants, runtimeRecords };
}

function buildCollectionRef(
  collectionName:
    | typeof PULSECHECK_PROTOCOL_FAMILIES_COLLECTION
    | typeof PULSECHECK_PROTOCOL_VARIANTS_COLLECTION
    | typeof PULSECHECK_PROTOCOLS_COLLECTION
) {
  return collection(db, collectionName);
}

function buildHistoryRef(
  collectionName:
    | typeof PULSECHECK_PROTOCOL_FAMILIES_COLLECTION
    | typeof PULSECHECK_PROTOCOL_VARIANTS_COLLECTION
    | typeof PULSECHECK_PROTOCOLS_COLLECTION,
  id: string
) {
  return collection(db, collectionName, id, PULSECHECK_PROTOCOL_HISTORY_SUBCOLLECTION);
}

function familyHistorySummary(action: Exclude<PulseCheckProtocolHistoryAction, 'published' | 'archived'>, record: PulseCheckProtocolFamily) {
  switch (action) {
    case 'created':
      return `Created family ${record.label}.`;
    case 'saved':
      return `Saved family ${record.label}.`;
    case 'seeded':
      return `Seeded family ${record.label} from the starter registry.`;
    default:
      return `${record.label} updated.`;
  }
}

function variantHistorySummary(action: Exclude<PulseCheckProtocolHistoryAction, 'published' | 'archived'>, record: PulseCheckProtocolVariant) {
  switch (action) {
    case 'created':
      return `Created variant ${record.label}.`;
    case 'saved':
      return `Saved variant ${record.label}.`;
    case 'seeded':
      return `Seeded variant ${record.label} from the starter registry.`;
    default:
      return `${record.label} updated.`;
  }
}

function runtimeHistorySummary(action: PulseCheckProtocolHistoryAction, record: PulseCheckProtocolDefinition) {
  switch (action) {
    case 'created':
      return `Created runtime record ${record.label}.`;
    case 'saved':
      return `Saved runtime record ${record.label}.`;
    case 'published':
      return `Published ${record.label} to Nora's bounded protocol inventory.`;
    case 'archived':
      return `Archived ${record.label} from active planning eligibility.`;
    case 'seeded':
      return `Seeded runtime record ${record.label} from the starter registry.`;
    default:
      return `${record.label} updated.`;
  }
}

function writeFamilyHistory(
  batch: ReturnType<typeof writeBatch>,
  record: PulseCheckProtocolFamily,
  action: Exclude<PulseCheckProtocolHistoryAction, 'published' | 'archived'>
) {
  const historyDoc = doc(buildHistoryRef(PULSECHECK_PROTOCOL_FAMILIES_COLLECTION, record.id));
  batch.set(historyDoc, {
    familyId: record.id,
    action,
    summary: familyHistorySummary(action, record),
    createdAt: Date.now(),
    snapshot: pulseCheckProtocolFamilyToFirestore(record),
  });
}

function writeVariantHistory(
  batch: ReturnType<typeof writeBatch>,
  record: PulseCheckProtocolVariant,
  action: Exclude<PulseCheckProtocolHistoryAction, 'published' | 'archived'>
) {
  const historyDoc = doc(buildHistoryRef(PULSECHECK_PROTOCOL_VARIANTS_COLLECTION, record.id));
  batch.set(historyDoc, {
    variantId: record.id,
    action,
    summary: variantHistorySummary(action, record),
    createdAt: Date.now(),
    snapshot: pulseCheckProtocolVariantToFirestore(record),
  });
}

function writeRuntimeHistory(
  batch: ReturnType<typeof writeBatch>,
  record: PulseCheckProtocolDefinition,
  action: PulseCheckProtocolHistoryAction
) {
  const historyDoc = doc(buildHistoryRef(PULSECHECK_PROTOCOLS_COLLECTION, record.id));
  batch.set(historyDoc, {
    protocolId: record.id,
    action,
    summary: runtimeHistorySummary(action, record),
    createdAt: Date.now(),
    snapshot: pulseCheckProtocolDefinitionToFirestore(record),
  });
}

async function listFamilies() {
  const snap = await getDocs(buildCollectionRef(PULSECHECK_PROTOCOL_FAMILIES_COLLECTION));
  return snap.docs.map((entry) => pulseCheckProtocolFamilyFromFirestore(entry.id, entry.data())).sort(sortByLabel);
}

async function listVariants() {
  const snap = await getDocs(buildCollectionRef(PULSECHECK_PROTOCOL_VARIANTS_COLLECTION));
  return snap.docs.map((entry) => pulseCheckProtocolVariantFromFirestore(entry.id, entry.data())).sort(sortByLabel);
}

async function listRuntimeRecords() {
  const snap = await getDocs(buildCollectionRef(PULSECHECK_PROTOCOLS_COLLECTION));
  return snap.docs.map((entry) => pulseCheckProtocolDefinitionFromFirestore(entry.id, entry.data())).sort(sortProtocols);
}

async function listProtocolAssignments() {
  const snap = await getDocs(query(collection(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION), where('actionType', '==', 'protocol')));
  return snap.docs
    .map((entry) => pulseCheckDailyAssignmentFromFirestore(entry.id, entry.data() as Record<string, any>))
    .filter((assignment) => Boolean(assignment.protocolId));
}

async function listAssignmentsForAthletes(athleteIds: string[]) {
  const assignments: PulseCheckDailyAssignment[] = [];
  const chunks = chunkArray(Array.from(new Set(athleteIds.filter(Boolean))), 10);

  for (const chunk of chunks) {
    if (!chunk.length) continue;
    const snap = await getDocs(query(collection(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION), where('athleteId', 'in', chunk)));
    snap.docs.forEach((entry) => {
      assignments.push(pulseCheckDailyAssignmentFromFirestore(entry.id, entry.data() as Record<string, any>));
    });
  }

  return assignments;
}

async function listAssignmentEventsForAssignments(assignmentIds: string[]) {
  const events: PulseCheckAssignmentEvent[] = [];
  const chunks = chunkArray(assignmentIds.filter(Boolean), 10);
  for (const chunk of chunks) {
    if (!chunk.length) continue;
    const snap = await getDocs(query(collection(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION), where('assignmentId', 'in', chunk)));
    snap.docs.forEach((entry) => {
      events.push(pulseCheckAssignmentEventFromFirestore(entry.id, entry.data() as Record<string, any>));
    });
  }
  return events;
}

async function hydrateWorkspaceWithRuntimeEvidence(
  workspace: ProtocolRegistryWorkspaceBundle
): Promise<ProtocolRegistryWorkspaceBundle> {
  if (!workspace.runtimeRecords.length) {
    return workspace;
  }

  const assignments = await listProtocolAssignments();
  const relevantAssignments = assignments.filter((assignment) =>
    assignment.protocolId && workspace.runtimeRecords.some((runtime) => runtime.id === assignment.protocolId)
  );

  if (!relevantAssignments.length) {
    return workspace;
  }

  const events = await listAssignmentEventsForAssignments(relevantAssignments.map((assignment) => assignment.id));
  const downstreamAssignments = await listAssignmentsForAthletes(relevantAssignments.map((assignment) => assignment.athleteId));
  const eventsByAssignmentId = new Map<string, PulseCheckAssignmentEvent[]>();
  events.forEach((event) => {
    const existing = eventsByAssignmentId.get(event.assignmentId) || [];
    existing.push(event);
    eventsByAssignmentId.set(event.assignmentId, existing);
  });

  const downstreamAssignmentsByKey = new Map<string, PulseCheckDailyAssignment[]>();
  downstreamAssignments.forEach((assignment) => {
    const key = `${assignment.athleteId}::${assignment.sourceDate}`;
    const existing = downstreamAssignmentsByKey.get(key) || [];
    existing.push(assignment);
    downstreamAssignmentsByKey.set(key, existing);
  });

  const assignmentsByRuntimeId = new Map<string, PulseCheckDailyAssignment[]>();
  relevantAssignments.forEach((assignment) => {
    if (!assignment.protocolId) return;
    const existing = assignmentsByRuntimeId.get(assignment.protocolId) || [];
    existing.push(assignment);
    assignmentsByRuntimeId.set(assignment.protocolId, existing);
  });

  const runtimeRecords = workspace.runtimeRecords.map((runtime) => {
    const liveEvidence = buildLiveEvidencePanel(
      assignmentsByRuntimeId.get(runtime.id) || [],
      eventsByAssignmentId,
      runtime.label,
      downstreamAssignmentsByKey
    );
    return liveEvidence
      ? normalizeRuntimeRecord(
          {
            ...runtime,
            evidencePanel: liveEvidence,
            evidenceStatus: deriveEvidenceStatus(liveEvidence),
          },
          null,
          null,
          runtime.updatedAt,
          runtime.sortOrder
        )
      : runtime;
  });

  const variants = workspace.variants.map((variant) => {
    const variantAssignments = runtimeRecords
      .filter((runtime) => runtime.variantId === variant.id)
      .flatMap((runtime) => assignmentsByRuntimeId.get(runtime.id) || []);
    const liveEvidence = buildLiveEvidencePanel(
      variantAssignments,
      eventsByAssignmentId,
      variant.label,
      downstreamAssignmentsByKey
    );
    return liveEvidence
      ? normalizeVariantRecord(
          {
            ...variant,
            evidencePanel: liveEvidence,
            evidenceStatus: deriveEvidenceStatus(liveEvidence),
          },
          workspace.families.find((family) => family.id === variant.familyId) || null,
          variant.updatedAt
        )
      : variant;
  });

  const families = workspace.families.map((family) => {
    const familyAssignments = runtimeRecords
      .filter((runtime) => runtime.familyId === family.id)
      .flatMap((runtime) => assignmentsByRuntimeId.get(runtime.id) || []);
    const liveEvidence = buildLiveEvidencePanel(
      familyAssignments,
      eventsByAssignmentId,
      family.label,
      downstreamAssignmentsByKey
    );
    return liveEvidence
      ? normalizeFamilyRecord(
          {
            ...family,
            evidencePanel: liveEvidence,
            evidenceStatus: deriveEvidenceStatus(liveEvidence),
          },
          family.updatedAt
        )
      : family;
  });

  return { families, variants, runtimeRecords };
}

async function listHistoryEntries<T>(
  collectionName:
    | typeof PULSECHECK_PROTOCOL_FAMILIES_COLLECTION
    | typeof PULSECHECK_PROTOCOL_VARIANTS_COLLECTION
    | typeof PULSECHECK_PROTOCOLS_COLLECTION,
  id: string,
  transform: (entryId: string, data: Record<string, any>) => T
): Promise<T[]> {
  const snap = await getDocs(query(buildHistoryRef(collectionName, id), orderBy('createdAt', 'desc')));
  return snap.docs.map((entry) => transform(entry.id, entry.data()));
}

function familyHistoryFromFirestore(id: string, data: Record<string, any>): PulseCheckProtocolFamilyHistoryEntry {
  return {
    id,
    familyId: data.familyId || '',
    action: data.action || 'saved',
    summary: data.summary || '',
    createdAt: data.createdAt || Date.now(),
    snapshot: pulseCheckProtocolFamilyFromFirestore(data.familyId || '', data.snapshot || {}),
  };
}

function variantHistoryFromFirestore(id: string, data: Record<string, any>): PulseCheckProtocolVariantHistoryEntry {
  return {
    id,
    variantId: data.variantId || '',
    action: data.action || 'saved',
    summary: data.summary || '',
    createdAt: data.createdAt || Date.now(),
    snapshot: pulseCheckProtocolVariantFromFirestore(data.variantId || '', data.snapshot || {}),
  };
}

function runtimeHistoryFromFirestore(id: string, data: Record<string, any>): PulseCheckProtocolHistoryEntry {
  return {
    id,
    protocolId: data.protocolId || '',
    action: data.action || 'saved',
    summary: data.summary || '',
    createdAt: data.createdAt || Date.now(),
    snapshot: pulseCheckProtocolDefinitionFromFirestore(data.protocolId || '', data.snapshot || {}),
  };
}

export const protocolRegistryService = {
  seedRecords(now = Date.now()): PulseCheckProtocolDefinition[] {
    return buildSeedWorkspace(now).runtimeRecords;
  },

  buildFamilyDraft(overrides: Partial<PulseCheckProtocolFamily> = {}, now = Date.now()): PulseCheckProtocolFamily {
    return normalizeFamilyRecord(
      {
        id: overrides.id || buildDefaultFamilyId(overrides.protocolClass || 'regulation', overrides.responseFamily || 'steady_regulation'),
        label: overrides.label || 'New Protocol Family',
        protocolClass: overrides.protocolClass || 'regulation',
        responseFamily: overrides.responseFamily || 'steady_regulation',
        familyStatus: overrides.familyStatus || 'candidate',
        governanceStage: overrides.governanceStage || 'nominated',
        useWindowTags: overrides.useWindowTags || [],
        avoidWindowTags: overrides.avoidWindowTags || [],
        contraindicationTags: overrides.contraindicationTags || [],
        sourceReferences: overrides.sourceReferences || [],
        createdAt: overrides.createdAt || now,
        updatedAt: now,
        mechanismSummary: overrides.mechanismSummary || '',
        targetBottleneck: overrides.targetBottleneck || '',
        expectedStateShift: overrides.expectedStateShift || '',
        evidenceSummary: overrides.evidenceSummary,
        reviewNotes: overrides.reviewNotes,
      },
      now
    );
  },

  buildVariantDraft(family: PulseCheckProtocolFamily, overrides: Partial<PulseCheckProtocolVariant> = {}, now = Date.now()): PulseCheckProtocolVariant {
    return normalizeVariantRecord(
      {
        id: overrides.id || buildDefaultVariantId(family.id, overrides.variantKey || slugify(overrides.label || 'new-variant')),
        familyId: family.id,
        label: overrides.label || 'New Protocol Variant',
        variantKey: overrides.variantKey || slugify(overrides.label || 'new-variant'),
        variantVersion: overrides.variantVersion || 'v1',
        category: overrides.category || ExerciseCategory.Breathing,
        deliveryMode: overrides.deliveryMode || 'guided_breathing',
        legacyExerciseId: overrides.legacyExerciseId || '',
        rationale: overrides.rationale || '',
        scriptSummary: overrides.scriptSummary || '',
        durationSeconds: overrides.durationSeconds || 180,
        triggerTags: overrides.triggerTags || [],
        preferredContextTags: overrides.preferredContextTags || [],
        useWindowTags: overrides.useWindowTags || [],
        avoidWindowTags: overrides.avoidWindowTags || [],
        contraindicationTags: overrides.contraindicationTags || [],
        governanceStage: overrides.governanceStage || family.governanceStage || 'structured',
        isActive: overrides.isActive ?? true,
        evidenceSummary: overrides.evidenceSummary,
        sourceReferences: overrides.sourceReferences || [],
        reviewNotes: overrides.reviewNotes,
        createdAt: overrides.createdAt || now,
        updatedAt: now,
      },
      family,
      now
    );
  },

  buildRuntimeDraft(
    family: PulseCheckProtocolFamily,
    variant: PulseCheckProtocolVariant,
    overrides: Partial<PulseCheckProtocolDefinition> = {},
    now = Date.now()
  ): PulseCheckProtocolDefinition {
    return normalizeRuntimeRecord(
      {
        id: overrides.id || `protocol-${variant.variantKey}`,
        label: overrides.label || variant.label,
        familyId: family.id,
        familyLabel: family.label,
        familyStatus: family.familyStatus,
        variantId: variant.id,
        variantKey: variant.variantKey,
        variantLabel: variant.label,
        variantVersion: variant.variantVersion,
        governanceStage: overrides.governanceStage || variant.governanceStage || family.governanceStage,
        legacyExerciseId: overrides.legacyExerciseId || variant.legacyExerciseId,
        protocolClass: overrides.protocolClass || family.protocolClass,
        category: overrides.category || variant.category,
        responseFamily: overrides.responseFamily || family.responseFamily,
        deliveryMode: overrides.deliveryMode || variant.deliveryMode,
        triggerTags: overrides.triggerTags || variant.triggerTags,
        preferredContextTags: overrides.preferredContextTags || variant.preferredContextTags,
        useWindowTags: overrides.useWindowTags || variant.useWindowTags,
        avoidWindowTags: overrides.avoidWindowTags || variant.avoidWindowTags,
        contraindicationTags: overrides.contraindicationTags || variant.contraindicationTags,
        rationale: overrides.rationale || variant.rationale,
        mechanism: overrides.mechanism || family.mechanismSummary,
        expectedStateShift: overrides.expectedStateShift || family.expectedStateShift,
        reviewNotes: overrides.reviewNotes || variant.reviewNotes || family.reviewNotes,
        evidenceSummary: overrides.evidenceSummary || variant.evidenceSummary || family.evidenceSummary,
        durationSeconds: overrides.durationSeconds || variant.durationSeconds,
        publishStatus: overrides.publishStatus || 'draft',
        isActive: overrides.isActive ?? true,
        sortOrder: overrides.sortOrder || 999,
        createdAt: overrides.createdAt || now,
        updatedAt: now,
      },
      family,
      variant,
      now
    );
  },

  async listWorkspace(): Promise<ProtocolRegistryWorkspaceBundle> {
    const [families, variants, runtimeRecords] = await Promise.all([listFamilies(), listVariants(), listRuntimeRecords()]);
    return hydrateWorkspaceWithRuntimeEvidence({ families, variants, runtimeRecords });
  },

  async listFamilies(): Promise<PulseCheckProtocolFamily[]> {
    return listFamilies();
  },

  async listVariants(): Promise<PulseCheckProtocolVariant[]> {
    return listVariants();
  },

  async list(): Promise<PulseCheckProtocolDefinition[]> {
    return listRuntimeRecords();
  },

  async listPublished(): Promise<PulseCheckProtocolDefinition[]> {
    const records = await this.list();
    return records.filter((record) => record.isActive && record.publishStatus === 'published');
  },

  async getFamilyById(id: string): Promise<PulseCheckProtocolFamily | null> {
    const snap = await getDoc(doc(db, PULSECHECK_PROTOCOL_FAMILIES_COLLECTION, id));
    if (!snap.exists()) return null;
    return pulseCheckProtocolFamilyFromFirestore(snap.id, snap.data());
  },

  async getVariantById(id: string): Promise<PulseCheckProtocolVariant | null> {
    const snap = await getDoc(doc(db, PULSECHECK_PROTOCOL_VARIANTS_COLLECTION, id));
    if (!snap.exists()) return null;
    return pulseCheckProtocolVariantFromFirestore(snap.id, snap.data());
  },

  async getById(id: string): Promise<PulseCheckProtocolDefinition | null> {
    const snap = await getDoc(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, id));
    if (!snap.exists()) return null;
    return pulseCheckProtocolDefinitionFromFirestore(snap.id, snap.data());
  },

  async listFamilyHistory(id: string): Promise<PulseCheckProtocolFamilyHistoryEntry[]> {
    return listHistoryEntries(PULSECHECK_PROTOCOL_FAMILIES_COLLECTION, id, familyHistoryFromFirestore);
  },

  async listVariantHistory(id: string): Promise<PulseCheckProtocolVariantHistoryEntry[]> {
    return listHistoryEntries(PULSECHECK_PROTOCOL_VARIANTS_COLLECTION, id, variantHistoryFromFirestore);
  },

  async listHistory(id: string): Promise<PulseCheckProtocolHistoryEntry[]> {
    return listHistoryEntries(PULSECHECK_PROTOCOLS_COLLECTION, id, runtimeHistoryFromFirestore);
  },

  async createFamilyDraft(overrides: Partial<PulseCheckProtocolFamily> = {}): Promise<PulseCheckProtocolFamily> {
    let record = this.buildFamilyDraft(overrides);
    const existing = await this.getFamilyById(record.id);
    if (existing) {
      record = this.buildFamilyDraft({ ...overrides, id: `${record.id}-${Date.now()}` });
    }
    const batch = writeBatch(db);
    batch.set(doc(db, PULSECHECK_PROTOCOL_FAMILIES_COLLECTION, record.id), pulseCheckProtocolFamilyToFirestore(record), { merge: true });
    writeFamilyHistory(batch, record, 'created');
    await batch.commit();
    return record;
  },

  async createVariantDraft(family: PulseCheckProtocolFamily, overrides: Partial<PulseCheckProtocolVariant> = {}): Promise<PulseCheckProtocolVariant> {
    let record = this.buildVariantDraft(family, overrides);
    const existing = await this.getVariantById(record.id);
    if (existing) {
      record = this.buildVariantDraft(family, { ...overrides, id: `${record.id}-${Date.now()}` });
    }
    const batch = writeBatch(db);
    batch.set(doc(db, PULSECHECK_PROTOCOL_VARIANTS_COLLECTION, record.id), pulseCheckProtocolVariantToFirestore(record), { merge: true });
    writeVariantHistory(batch, record, 'created');
    await batch.commit();
    return record;
  },

  async createRuntimeDraft(
    family: PulseCheckProtocolFamily,
    variant: PulseCheckProtocolVariant,
    overrides: Partial<PulseCheckProtocolDefinition> = {}
  ): Promise<PulseCheckProtocolDefinition> {
    let record = this.buildRuntimeDraft(family, variant, overrides);
    const existing = await this.getById(record.id);
    if (existing) {
      record = this.buildRuntimeDraft(family, variant, { ...overrides, id: `${record.id}-${Date.now()}` });
    }
    const batch = writeBatch(db);
    batch.set(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, record.id), pulseCheckProtocolDefinitionToFirestore(record), { merge: true });
    writeRuntimeHistory(batch, record, 'created');
    await batch.commit();
    return record;
  },

  async saveFamily(record: PulseCheckProtocolFamily): Promise<PulseCheckProtocolFamily> {
    const existing = await this.getFamilyById(record.id);
    const now = Date.now();
    const nextRecord = normalizeFamilyRecord(
      { ...(existing || {}), ...record, createdAt: existing?.createdAt || record.createdAt || now, updatedAt: now },
      now
    );
    const batch = writeBatch(db);
    batch.set(doc(db, PULSECHECK_PROTOCOL_FAMILIES_COLLECTION, nextRecord.id), pulseCheckProtocolFamilyToFirestore(nextRecord), { merge: true });
    writeFamilyHistory(batch, nextRecord, existing ? 'saved' : 'created');
    await batch.commit();
    return nextRecord;
  },

  async saveVariant(record: PulseCheckProtocolVariant): Promise<PulseCheckProtocolVariant> {
    const existing = await this.getVariantById(record.id);
    const family = await this.getFamilyById(record.familyId);
    const now = Date.now();
    const nextRecord = normalizeVariantRecord(
      { ...(existing || {}), ...record, createdAt: existing?.createdAt || record.createdAt || now, updatedAt: now },
      family,
      now
    );
    const batch = writeBatch(db);
    batch.set(doc(db, PULSECHECK_PROTOCOL_VARIANTS_COLLECTION, nextRecord.id), pulseCheckProtocolVariantToFirestore(nextRecord), { merge: true });
    writeVariantHistory(batch, nextRecord, existing ? 'saved' : 'created');
    await batch.commit();
    return nextRecord;
  },

  async save(record: PulseCheckProtocolDefinition): Promise<PulseCheckProtocolDefinition> {
    const existing = await this.getById(record.id);
    const family = await this.getFamilyById(record.familyId);
    const variant = await this.getVariantById(record.variantId);
    const now = Date.now();
    const protectedPublishStatus = existing?.publishStatus || 'draft';
    const nextRecord = normalizeRuntimeRecord(
      {
        ...(existing || {}),
        ...record,
        publishStatus: protectedPublishStatus,
        isActive: protectedPublishStatus === 'archived' ? false : (existing?.isActive ?? record.isActive),
        governanceStage:
          protectedPublishStatus === 'published'
            ? 'published'
            : protectedPublishStatus === 'archived'
              ? 'archived'
              : (record.governanceStage || existing?.governanceStage),
        publishedRevisionId: existing?.publishedRevisionId,
        publishedAt: existing?.publishedAt,
        archivedAt: existing?.archivedAt,
        createdAt: existing?.createdAt || record.createdAt || now,
        updatedAt: now,
      },
      family,
      variant,
      now,
      record.sortOrder
    );
    const batch = writeBatch(db);
    batch.set(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, nextRecord.id), pulseCheckProtocolDefinitionToFirestore(nextRecord), { merge: true });
    writeRuntimeHistory(batch, nextRecord, existing ? 'saved' : 'created');
    await batch.commit();
    return nextRecord;
  },

  async publish(record: PulseCheckProtocolDefinition): Promise<PulseCheckProtocolDefinition> {
    const publishedAt = Date.now();
    const family = await this.getFamilyById(record.familyId);
    const variant = await this.getVariantById(record.variantId);
    if (!family || !variant) {
      throw new Error('Cannot publish runtime record without linked family and variant.');
    }
    if (family.reviewStatus !== 'approved') {
      throw new Error(`Family review is not approved for ${family.label}.`);
    }
    if (variant.approvalStatus !== 'approved') {
      throw new Error(`Variant approval is not complete for ${variant.label}.`);
    }
    if (record.reviewStatus !== 'approved') {
      throw new Error(`Runtime publish gates are not complete for ${record.label}.`);
    }
    const nextRecord = normalizeRuntimeRecord(
      {
        ...record,
        publishStatus: 'published',
        governanceStage: 'published',
        familyStatus: 'locked',
        isActive: true,
        reviewStatus: 'approved',
        publishedRevisionId: derivePublishedRevisionId(record.id, publishedAt),
        publishedAt,
        lastReviewedAt: record.lastReviewedAt || publishedAt,
        nextReviewAt: record.nextReviewAt || (publishedAt + (record.reviewCadenceDays || 30) * 24 * 60 * 60 * 1000),
        archivedAt: undefined,
        updatedAt: publishedAt,
      },
      family,
      variant,
      publishedAt,
      record.sortOrder
    );

    const batch = writeBatch(db);
    batch.set(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, nextRecord.id), pulseCheckProtocolDefinitionToFirestore(nextRecord), { merge: true });
    writeRuntimeHistory(batch, nextRecord, 'published');
    await batch.commit();
    return nextRecord;
  },

  async archive(record: PulseCheckProtocolDefinition): Promise<PulseCheckProtocolDefinition> {
    const archivedAt = Date.now();
    const family = await this.getFamilyById(record.familyId);
    const variant = await this.getVariantById(record.variantId);
    const nextRecord = normalizeRuntimeRecord(
      {
        ...record,
        publishStatus: 'archived',
        governanceStage: 'archived',
        isActive: false,
        publishedRevisionId: record.publishedRevisionId,
        archivedAt,
        updatedAt: archivedAt,
      },
      family,
      variant,
      archivedAt,
      record.sortOrder
    );

    const batch = writeBatch(db);
    batch.set(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, nextRecord.id), pulseCheckProtocolDefinitionToFirestore(nextRecord), { merge: true });
    writeRuntimeHistory(batch, nextRecord, 'archived');
    await batch.commit();
    return nextRecord;
  },

  async syncSeedProtocols(): Promise<{ created: number; updated: number }> {
    const seedWorkspace = buildSeedWorkspace();
    const existingWorkspace = await this.listWorkspace();

    const existingFamilies = new Map(existingWorkspace.families.map((family) => [family.id, family]));
    const existingVariants = new Map(existingWorkspace.variants.map((variant) => [variant.id, variant]));
    const existingRuntimeRecords = new Map(existingWorkspace.runtimeRecords.map((record) => [record.id, record]));

    let created = 0;
    let updated = 0;

    for (const family of seedWorkspace.families) {
      const existing = existingFamilies.get(family.id);
      const nextRecord = normalizeFamilyRecord(
        {
          ...existing,
          ...family,
          evidencePanel: existing?.evidencePanel || family.evidencePanel,
          reviewNotes: existing?.reviewNotes || family.reviewNotes,
          reviewStatus: existing?.reviewStatus || family.reviewStatus,
          reviewChecklist: existing?.reviewChecklist?.length ? existing.reviewChecklist : family.reviewChecklist,
          evidenceStatus: existing?.evidenceStatus || family.evidenceStatus,
          lastReviewedAt: existing?.lastReviewedAt || family.lastReviewedAt,
          nextReviewAt: existing?.nextReviewAt || family.nextReviewAt,
          reviewCadenceDays: existing?.reviewCadenceDays || family.reviewCadenceDays,
          createdAt: existing?.createdAt || family.createdAt,
          updatedAt: Date.now(),
        },
        Date.now()
      );
      const changed = !existing || JSON.stringify(pulseCheckProtocolFamilyToFirestore(existing)) !== JSON.stringify(pulseCheckProtocolFamilyToFirestore(nextRecord));
      if (changed) {
        const batch = writeBatch(db);
        batch.set(doc(db, PULSECHECK_PROTOCOL_FAMILIES_COLLECTION, nextRecord.id), pulseCheckProtocolFamilyToFirestore(nextRecord), { merge: true });
        writeFamilyHistory(batch, nextRecord, 'seeded');
        await batch.commit();
        existing ? updated++ : created++;
      }
    }

    for (const variant of seedWorkspace.variants) {
      const existing = existingVariants.get(variant.id);
      const family = existingWorkspace.families.find((entry) => entry.id === variant.familyId) || seedWorkspace.families.find((entry) => entry.id === variant.familyId) || null;
      const nextRecord = normalizeVariantRecord(
        {
          ...existing,
          ...variant,
          evidencePanel: existing?.evidencePanel || variant.evidencePanel,
          reviewNotes: existing?.reviewNotes || variant.reviewNotes,
          approvalStatus: existing?.approvalStatus || variant.approvalStatus,
          reviewChecklist: existing?.reviewChecklist?.length ? existing.reviewChecklist : variant.reviewChecklist,
          evidenceStatus: existing?.evidenceStatus || variant.evidenceStatus,
          lastReviewedAt: existing?.lastReviewedAt || variant.lastReviewedAt,
          nextReviewAt: existing?.nextReviewAt || variant.nextReviewAt,
          reviewCadenceDays: existing?.reviewCadenceDays || variant.reviewCadenceDays,
          createdAt: existing?.createdAt || variant.createdAt,
          updatedAt: Date.now(),
        },
        family,
        Date.now()
      );
      const changed = !existing || JSON.stringify(pulseCheckProtocolVariantToFirestore(existing)) !== JSON.stringify(pulseCheckProtocolVariantToFirestore(nextRecord));
      if (changed) {
        const batch = writeBatch(db);
        batch.set(doc(db, PULSECHECK_PROTOCOL_VARIANTS_COLLECTION, nextRecord.id), pulseCheckProtocolVariantToFirestore(nextRecord), { merge: true });
        writeVariantHistory(batch, nextRecord, 'seeded');
        await batch.commit();
        existing ? updated++ : created++;
      }
    }

    for (const runtimeRecord of seedWorkspace.runtimeRecords) {
      const existing = existingRuntimeRecords.get(runtimeRecord.id);
      const family = existingWorkspace.families.find((entry) => entry.id === runtimeRecord.familyId) || seedWorkspace.families.find((entry) => entry.id === runtimeRecord.familyId) || null;
      const variant = existingWorkspace.variants.find((entry) => entry.id === runtimeRecord.variantId) || seedWorkspace.variants.find((entry) => entry.id === runtimeRecord.variantId) || null;
      const nextRecord = normalizeRuntimeRecord(
        { ...runtimeRecord, ...existing, createdAt: existing?.createdAt || runtimeRecord.createdAt, updatedAt: Date.now() },
        family,
        variant,
        Date.now(),
        runtimeRecord.sortOrder
      );
      const changed = !existing || JSON.stringify(pulseCheckProtocolDefinitionToFirestore(existing)) !== JSON.stringify(pulseCheckProtocolDefinitionToFirestore(nextRecord));
      if (changed) {
        const batch = writeBatch(db);
        batch.set(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, nextRecord.id), pulseCheckProtocolDefinitionToFirestore(nextRecord), { merge: true });
        writeRuntimeHistory(batch, nextRecord, 'seeded');
        await batch.commit();
        existing ? updated++ : created++;
      }
    }

    return { created, updated };
  },
};
