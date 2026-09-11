export const UNIVERSITY_CUSTOMER_SUCCESS_SCHEMA_VERSION = 1 as const;

export type PilotPhase =
  | 'not-started'
  | 'onboarding'
  | 'launch-ready'
  | 'active'
  | 'midpoint-review'
  | 'final-review'
  | 'complete'
  | 'ongoing'
  | 'renewal'
  | 'paused';

export type CustomerHealthStatus = 'unknown' | 'on-track' | 'watch' | 'at-risk';
export type LaunchChecklistStatus = 'pending' | 'in-progress' | 'complete' | 'not-applicable';
export type NextActionStatus = 'open' | 'complete';
export type RenewalOutcome = 'unknown' | 'pending' | 'renewed' | 'expanded' | 'non-renewed' | 'paused';
export type SuccessEvidenceSourceKind = 'manual' | 'connected' | 'unconnected';
export type MetricMeasurementState = 'missing' | 'measured';
export type CustomerSuccessReportingScope = 'selected-list' | 'workspace';

export type MetricMeasurement = {
  state: MetricMeasurementState;
  value: number | null;
  asOf: string;
  periodStart: string;
  periodEnd: string;
};

export type UniversityLaunchChecklistItem = {
  id: string;
  label: string;
  status: LaunchChecklistStatus;
  required: boolean;
  owner: string;
  dueDate: string;
  completedAt: string;
};

export type UniversitySuccessMeasure = {
  id: string;
  label: string;
  unit: string;
  baseline: MetricMeasurement;
  target: MetricMeasurement;
  latestResult: MetricMeasurement;
  source: string;
  sourceKind: SuccessEvidenceSourceKind;
  owner: string;
  deadline: string;
  notes: string;
};

export type CustomerSuccessNextAction = {
  summary: string;
  owner: string;
  dueDate: string;
  status: NextActionStatus;
};

export type UniversityCustomerSuccess = {
  schemaVersion: typeof UNIVERSITY_CUSTOMER_SUCCESS_SCHEMA_VERSION;
  pilotPhase: PilotPhase;
  health: {
    status: CustomerHealthStatus;
    reason: string;
    updatedAt: string;
    updatedBy: string;
  };
  ownership: {
    accountOwner: string;
    customerSuccessOwner: string;
    executiveSponsor: string;
    champion: string;
  };
  pilot: {
    startDate: string;
    endDate: string;
  };
  launchChecklist: UniversityLaunchChecklistItem[];
  successMeasures: UniversitySuccessMeasure[];
  nextAction: CustomerSuccessNextAction;
  lastSuccessUpdateAt: string;
  nextReviewDate: string;
  renewal: {
    contractStartDate: string;
    contractEndDate: string;
    decisionDate: string;
    owner: string;
    outcome: RenewalOutcome;
    outcomeDate: string;
    notes: string;
  };
  linkage: {
    organizationId: string;
    teamId: string;
    pilotId: string;
    customerAccountId: string;
  };
};

export type LegacyUniversitySuccessContext = {
  stage?: unknown;
  owner?: unknown;
  nextStep?: unknown;
  dueDate?: unknown;
  pilotStart?: unknown;
  pilotEnd?: unknown;
};

export type CustomerSuccessMetricRecord = {
  id: string;
  listId: string;
  itemId: string;
  measureId: string;
  measureLabel: string;
  measurement: MetricMeasurement;
  recordedAt: string;
  source: string;
  sourceKind: SuccessEvidenceSourceKind;
};

export type CustomerSuccessReportingPeriod = {
  startDate: string;
  endDate: string;
};

export type MeasuredAggregate = {
  state: MetricMeasurementState;
  measuredCount: number;
  missingCount: number;
  sum: number | null;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
};

export type CustomerSuccessAttentionCode =
  | 'overdue-next-action'
  | 'next-action-missing'
  | 'next-action-owner-missing'
  | 'overdue-launch-item'
  | 'incomplete-onboarding'
  | 'success-measures-missing'
  | 'success-update-missing'
  | 'success-update-stale'
  | 'health-unknown'
  | 'review-overdue'
  | 'renewal-decision-overdue'
  | 'renewal-decision-upcoming'
  | 'renewal-decision-date-missing';

export type CustomerSuccessAttentionReason = {
  code: CustomerSuccessAttentionCode;
  severity: 'high' | 'medium' | 'low';
  label: string;
  detail: string;
  dueDate: string;
};

const PILOT_PHASES = new Set<PilotPhase>([
  'not-started',
  'onboarding',
  'launch-ready',
  'active',
  'midpoint-review',
  'final-review',
  'complete',
  'ongoing',
  'renewal',
  'paused',
]);
const HEALTH_STATUSES = new Set<CustomerHealthStatus>(['unknown', 'on-track', 'watch', 'at-risk']);
const CHECKLIST_STATUSES = new Set<LaunchChecklistStatus>(['pending', 'in-progress', 'complete', 'not-applicable']);
const RENEWAL_OUTCOMES = new Set<RenewalOutcome>(['unknown', 'pending', 'renewed', 'expanded', 'non-renewed', 'paused']);
const SOURCE_KINDS = new Set<SuccessEvidenceSourceKind>(['manual', 'connected', 'unconnected']);

const DEFAULT_LAUNCH_STEPS = [
  'Confirm kickoff date and working team',
  'Confirm pilot scope and participant access plan',
  'Complete staff onboarding',
  'Share athlete access instructions',
  'Agree on baseline and success measures',
  'Verify the first reporting cycle',
  'Schedule midpoint and final reviews',
] as const;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeKey = (value: unknown) =>
  asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeDateOnly = (value: unknown) => {
  const text = asText(value);
  if (!text) return '';
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const dateKey = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateKey ? '' : dateKey;
};

const normalizeTimestamp = (value: unknown) => {
  const text = asText(value);
  if (!text) return '';
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

const normalizeTimestampOrDate = (value: unknown) => normalizeTimestamp(value) || normalizeDateOnly(value);

const finiteMetricNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = asText(value);
  if (!text) return null;
  const cleaned = text.replace(/[$,%\s]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const stableId = (value: unknown, fallback: string) => normalizeKey(value) || fallback;

export const pilotPhaseFromPipelineStage = (stage: unknown): PilotPhase => {
  switch (normalizeKey(stage)) {
    case 'pilot-agreed':
      return 'onboarding';
    case 'pilot-active':
      return 'active';
    case 'pilot-complete':
      return 'final-review';
    case 'proposal-sent':
    case 'negotiating':
      return 'final-review';
    case 'closed-lost-paused':
    case 'paused':
      return 'paused';
    default:
      return 'not-started';
  }
};

export const isUniversityCustomerSuccessStage = (stage: unknown) =>
  new Set([
    'contract-signed',
    'pilot-agreed',
    'pilot-active',
    'pilot-complete',
    'proposal-sent',
    'negotiating',
    'closed-won',
    'closed-lost-paused',
  ]).has(normalizeKey(stage));

export const createDefaultUniversityLaunchChecklist = (): UniversityLaunchChecklistItem[] =>
  DEFAULT_LAUNCH_STEPS.map((label, index) => ({
    id: `launch-step-${index + 1}`,
    label,
    status: 'pending',
    required: true,
    owner: '',
    dueDate: '',
    completedAt: '',
  }));

export const normalizeMetricMeasurement = (value: unknown): MetricMeasurement => {
  const input = asRecord(value);
  const isObjectInput = Object.keys(input).length > 0;
  const rawValue = isObjectInput ? input.value : value;
  const numericValue = finiteMetricNumber(rawValue);
  const requestedState = asText(input.state);
  const state: MetricMeasurementState =
    requestedState === 'missing' || numericValue === null ? 'missing' : 'measured';

  return {
    state,
    value: state === 'measured' ? numericValue : null,
    asOf: normalizeTimestampOrDate(input.asOf),
    periodStart: normalizeDateOnly(input.periodStart),
    periodEnd: normalizeDateOnly(input.periodEnd),
  };
};

const normalizeLaunchChecklist = (value: unknown): UniversityLaunchChecklistItem[] => {
  if (!Array.isArray(value)) return createDefaultUniversityLaunchChecklist();

  const usedIds = new Set<string>();
  return value.flatMap((candidate, index) => {
    const input = asRecord(candidate);
    const label = asText(input.label);
    if (!label) return [];
    const requestedId = stableId(input.id, `launch-step-${index + 1}`);
    const id = usedIds.has(requestedId) ? `${requestedId}-${index + 1}` : requestedId;
    usedIds.add(id);
    const rawStatus = asText(input.status) as LaunchChecklistStatus;
    const status = CHECKLIST_STATUSES.has(rawStatus) ? rawStatus : 'pending';
    return [{
      id,
      label,
      status,
      required: input.required !== false,
      owner: asText(input.owner),
      dueDate: normalizeDateOnly(input.dueDate),
      completedAt: status === 'complete' ? normalizeTimestampOrDate(input.completedAt) : '',
    }];
  });
};

const normalizeSuccessMeasures = (value: unknown): UniversitySuccessMeasure[] => {
  if (!Array.isArray(value)) return [];

  const usedIds = new Set<string>();
  return value.flatMap((candidate, index) => {
    const input = asRecord(candidate);
    const label = asText(input.label);
    if (!label) return [];
    const requestedId = stableId(input.id, `success-measure-${index + 1}`);
    const id = usedIds.has(requestedId) ? `${requestedId}-${index + 1}` : requestedId;
    usedIds.add(id);
    const rawSourceKind = asText(input.sourceKind) as SuccessEvidenceSourceKind;
    return [{
      id,
      label,
      unit: asText(input.unit),
      baseline: normalizeMetricMeasurement(input.baseline),
      target: normalizeMetricMeasurement(input.target),
      latestResult: normalizeMetricMeasurement(input.latestResult),
      source: asText(input.source),
      sourceKind: SOURCE_KINDS.has(rawSourceKind) ? rawSourceKind : 'manual',
      owner: asText(input.owner),
      deadline: normalizeDateOnly(input.deadline),
      notes: asText(input.notes),
    }];
  });
};

const latestSuccessEvidenceAt = (measures: UniversitySuccessMeasure[]) =>
  measures
    .map((measure) => measure.latestResult.asOf)
    .filter(Boolean)
    .sort()
    .at(-1) || '';

export const normalizeUniversityCustomerSuccess = (
  value: unknown,
  legacy: LegacyUniversitySuccessContext = {},
): UniversityCustomerSuccess => {
  const input = asRecord(value);
  const health = asRecord(input.health);
  const ownership = asRecord(input.ownership);
  const pilot = asRecord(input.pilot);
  const nextAction = asRecord(input.nextAction);
  const renewal = asRecord(input.renewal);
  const linkage = asRecord(input.linkage);
  const rawPilotPhase = asText(input.pilotPhase) as PilotPhase;
  const rawHealth = asText(health.status) as CustomerHealthStatus;
  const rawRenewalOutcome = asText(renewal.outcome) as RenewalOutcome;
  const successMeasures = normalizeSuccessMeasures(input.successMeasures);

  return {
    schemaVersion: UNIVERSITY_CUSTOMER_SUCCESS_SCHEMA_VERSION,
    pilotPhase: PILOT_PHASES.has(rawPilotPhase) ? rawPilotPhase : pilotPhaseFromPipelineStage(legacy.stage),
    health: {
      status: HEALTH_STATUSES.has(rawHealth) ? rawHealth : 'unknown',
      reason: asText(health.reason),
      updatedAt: normalizeTimestampOrDate(health.updatedAt),
      updatedBy: asText(health.updatedBy),
    },
    ownership: {
      accountOwner: asText(ownership.accountOwner) || asText(legacy.owner),
      customerSuccessOwner: asText(ownership.customerSuccessOwner),
      executiveSponsor: asText(ownership.executiveSponsor),
      champion: asText(ownership.champion),
    },
    pilot: {
      startDate: normalizeDateOnly(pilot.startDate) || normalizeDateOnly(legacy.pilotStart),
      endDate: normalizeDateOnly(pilot.endDate) || normalizeDateOnly(legacy.pilotEnd),
    },
    launchChecklist: normalizeLaunchChecklist(input.launchChecklist),
    successMeasures,
    nextAction: {
      summary: asText(nextAction.summary) || asText(legacy.nextStep),
      owner: asText(nextAction.owner) || asText(legacy.owner),
      dueDate: normalizeDateOnly(nextAction.dueDate) || normalizeDateOnly(legacy.dueDate),
      status: asText(nextAction.status) === 'complete' ? 'complete' : 'open',
    },
    lastSuccessUpdateAt:
      normalizeTimestampOrDate(input.lastSuccessUpdateAt) || latestSuccessEvidenceAt(successMeasures),
    nextReviewDate: normalizeDateOnly(input.nextReviewDate),
    renewal: {
      contractStartDate: normalizeDateOnly(renewal.contractStartDate),
      contractEndDate: normalizeDateOnly(renewal.contractEndDate),
      decisionDate: normalizeDateOnly(renewal.decisionDate),
      owner: asText(renewal.owner),
      outcome: RENEWAL_OUTCOMES.has(rawRenewalOutcome) ? rawRenewalOutcome : 'unknown',
      outcomeDate: normalizeDateOnly(renewal.outcomeDate),
      notes: asText(renewal.notes),
    },
    linkage: {
      organizationId: asText(linkage.organizationId),
      teamId: asText(linkage.teamId),
      pilotId: asText(linkage.pilotId),
      customerAccountId: asText(linkage.customerAccountId),
    },
  };
};

export const normalizeCustomerSuccessMetricRecord = (
  value: unknown,
  index = 0,
): CustomerSuccessMetricRecord | null => {
  const input = asRecord(value);
  const measureId = asText(input.measureId);
  const measureLabel = asText(input.measureLabel);
  if (!measureId && !measureLabel) return null;
  const rawSourceKind = asText(input.sourceKind) as SuccessEvidenceSourceKind;
  return {
    id: stableId(input.id, `success-evidence-${index + 1}`),
    listId: asText(input.listId),
    itemId: asText(input.itemId),
    measureId: measureId || normalizeKey(measureLabel),
    measureLabel,
    measurement: normalizeMetricMeasurement(input.measurement),
    recordedAt: normalizeTimestampOrDate(input.recordedAt),
    source: asText(input.source),
    sourceKind: SOURCE_KINDS.has(rawSourceKind) ? rawSourceKind : 'manual',
  };
};

const dateKeyFromUnknown = (value: unknown) => normalizeDateOnly(value) || normalizeTimestamp(value).slice(0, 10);

const recordDateRange = (record: CustomerSuccessMetricRecord) => {
  const pointDate = dateKeyFromUnknown(record.measurement.asOf || record.recordedAt);
  const startDate = record.measurement.periodStart || pointDate;
  const endDate = record.measurement.periodEnd || startDate;
  return { startDate, endDate };
};

export const normalizeCustomerSuccessReportingPeriod = (value: unknown): CustomerSuccessReportingPeriod | null => {
  const input = asRecord(value);
  const startDate = normalizeDateOnly(input.startDate);
  const endDate = normalizeDateOnly(input.endDate);
  if (!startDate || !endDate || startDate > endDate) return null;
  return { startDate, endDate };
};

export const filterCustomerSuccessMetricRecords = (
  records: CustomerSuccessMetricRecord[],
  options: {
    selectedListId: string;
    scope?: CustomerSuccessReportingScope;
    reportingPeriod?: CustomerSuccessReportingPeriod | null;
  },
) => {
  const scope = options.scope || 'selected-list';
  return records.filter((record) => {
    if (scope === 'selected-list' && record.listId !== options.selectedListId) return false;
    if (!options.reportingPeriod) return true;
    const range = recordDateRange(record);
    if (!range.startDate || !range.endDate) return false;
    return range.endDate >= options.reportingPeriod.startDate && range.startDate <= options.reportingPeriod.endDate;
  });
};

export const summarizeMeasuredValues = (values: unknown[]): MeasuredAggregate => {
  const measurements = values.map(normalizeMetricMeasurement);
  const measuredValues = measurements.flatMap((measurement) =>
    measurement.state === 'measured' && measurement.value !== null ? [measurement.value] : [],
  );
  const missingCount = measurements.length - measuredValues.length;
  if (measuredValues.length === 0) {
    return {
      state: 'missing',
      measuredCount: 0,
      missingCount,
      sum: null,
      average: null,
      minimum: null,
      maximum: null,
    };
  }

  const sum = measuredValues.reduce((total, value) => total + value, 0);
  return {
    state: 'measured',
    measuredCount: measuredValues.length,
    missingCount,
    sum,
    average: sum / measuredValues.length,
    minimum: Math.min(...measuredValues),
    maximum: Math.max(...measuredValues),
  };
};

export const aggregateCustomerSuccessMetricRecords = (records: CustomerSuccessMetricRecord[]) => {
  const grouped = new Map<string, CustomerSuccessMetricRecord[]>();
  records.forEach((record) => {
    const current = grouped.get(record.measureId) || [];
    current.push(record);
    grouped.set(record.measureId, current);
  });

  return Array.from(grouped.entries()).map(([measureId, entries]) => ({
    measureId,
    measureLabel: entries.find((entry) => entry.measureLabel)?.measureLabel || measureId,
    ...summarizeMeasuredValues(entries.map((entry) => entry.measurement)),
  }));
};

const dateKeyFromToday = (today: string | Date | undefined) => {
  if (today instanceof Date && !Number.isNaN(today.getTime())) return today.toISOString().slice(0, 10);
  return normalizeDateOnly(today) || new Date().toISOString().slice(0, 10);
};

const daysFrom = (fromDate: string, toDate: string) => {
  const from = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const to = new Date(`${toDate}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / 86_400_000);
};

const updatesExpectedForPhase = (phase: PilotPhase) =>
  new Set<PilotPhase>(['active', 'midpoint-review', 'final-review', 'ongoing', 'renewal']).has(phase);

const onboardingAppliesToPhase = (phase: PilotPhase) =>
  new Set<PilotPhase>(['not-started', 'onboarding', 'launch-ready', 'active']).has(phase);

const renewalIsDecided = (outcome: RenewalOutcome) =>
  new Set<RenewalOutcome>(['renewed', 'expanded', 'non-renewed', 'paused']).has(outcome);

const attentionRank: Record<CustomerSuccessAttentionReason['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const calculateCustomerSuccessAttention = (
  success: UniversityCustomerSuccess,
  options: {
    today?: string | Date;
    staleAfterDays?: number;
    renewalWindowDays?: number;
    includeMissingNextAction?: boolean;
  } = {},
): CustomerSuccessAttentionReason[] => {
  const today = dateKeyFromToday(options.today);
  const staleAfterDays = Math.max(1, options.staleAfterDays ?? 14);
  const renewalWindowDays = Math.max(1, options.renewalWindowDays ?? 60);
  const reasons: CustomerSuccessAttentionReason[] = [];
  const add = (reason: CustomerSuccessAttentionReason) => reasons.push(reason);

  if (success.nextAction.status === 'open') {
    if (success.nextAction.dueDate && success.nextAction.dueDate < today) {
      add({
        code: 'overdue-next-action',
        severity: 'high',
        label: 'Next action overdue',
        detail: success.nextAction.summary || 'The next customer action has passed its due date.',
        dueDate: success.nextAction.dueDate,
      });
    }
    if (
      success.pilotPhase !== 'paused' &&
      options.includeMissingNextAction !== false &&
      !success.nextAction.summary
    ) {
      add({
        code: 'next-action-missing',
        severity: 'medium',
        label: 'Next action needed',
        detail: 'Add the next customer action and a due date.',
        dueDate: '',
      });
    }
    if (success.nextAction.summary && !success.nextAction.owner) {
      add({
        code: 'next-action-owner-missing',
        severity: 'medium',
        label: 'Next action needs an owner',
        detail: 'Assign one person to move the next action forward.',
        dueDate: success.nextAction.dueDate,
      });
    }
  }

  const requiredLaunchItems = success.launchChecklist.filter((item) => item.required);
  const incompleteLaunchItems = requiredLaunchItems.filter(
    (item) => item.status !== 'complete' && item.status !== 'not-applicable',
  );
  incompleteLaunchItems
    .filter((item) => item.dueDate && item.dueDate < today)
    .forEach((item) => add({
      code: 'overdue-launch-item',
      severity: 'high',
      label: 'Launch task overdue',
      detail: item.label,
      dueDate: item.dueDate,
    }));

  if (onboardingAppliesToPhase(success.pilotPhase) && incompleteLaunchItems.length > 0) {
    add({
      code: 'incomplete-onboarding',
      severity: success.pilotPhase === 'active' ? 'high' : 'medium',
      label: 'Onboarding incomplete',
      detail: `${incompleteLaunchItems.length} required launch ${incompleteLaunchItems.length === 1 ? 'task remains' : 'tasks remain'}.`,
      dueDate: incompleteLaunchItems.map((item) => item.dueDate).filter(Boolean).sort()[0] || '',
    });
  }

  if (success.successMeasures.length === 0 && success.pilotPhase !== 'paused') {
    add({
      code: 'success-measures-missing',
      severity: 'medium',
      label: 'Success measures needed',
      detail: 'Record the agreed outcomes, targets, evidence source, and owner.',
      dueDate: '',
    });
  }

  if (updatesExpectedForPhase(success.pilotPhase)) {
    const lastUpdateDate = dateKeyFromUnknown(success.lastSuccessUpdateAt);
    if (!lastUpdateDate) {
      add({
        code: 'success-update-missing',
        severity: 'high',
        label: 'Success update needed',
        detail: 'Add the first product use or outcome update.',
        dueDate: '',
      });
    } else if (daysFrom(lastUpdateDate, today) > staleAfterDays) {
      add({
        code: 'success-update-stale',
        severity: 'high',
        label: 'Success update is stale',
        detail: `The latest success evidence is more than ${staleAfterDays} days old.`,
        dueDate: lastUpdateDate,
      });
    }
  }

  if (success.pilotPhase !== 'paused' && success.health.status === 'unknown') {
    add({
      code: 'health-unknown',
      severity: 'low',
      label: 'Health has not been assessed',
      detail: 'Choose a health state after reviewing current evidence with the customer.',
      dueDate: '',
    });
  }

  if (success.nextReviewDate && success.nextReviewDate < today) {
    add({
      code: 'review-overdue',
      severity: 'high',
      label: 'Customer review overdue',
      detail: 'Schedule or record the next customer review.',
      dueDate: success.nextReviewDate,
    });
  }

  if (!renewalIsDecided(success.renewal.outcome)) {
    if (success.renewal.decisionDate) {
      const daysUntilDecision = daysFrom(today, success.renewal.decisionDate);
      if (daysUntilDecision < 0) {
        add({
          code: 'renewal-decision-overdue',
          severity: 'high',
          label: 'Renewal decision overdue',
          detail: 'Record the decision or update the decision date.',
          dueDate: success.renewal.decisionDate,
        });
      } else if (daysUntilDecision <= renewalWindowDays) {
        add({
          code: 'renewal-decision-upcoming',
          severity: daysUntilDecision <= 30 ? 'high' : 'medium',
          label: 'Renewal decision coming up',
          detail: `${daysUntilDecision} ${daysUntilDecision === 1 ? 'day' : 'days'} until the planned decision.`,
          dueDate: success.renewal.decisionDate,
        });
      }
    } else if (success.renewal.contractEndDate) {
      const daysUntilEnd = daysFrom(today, success.renewal.contractEndDate);
      if (daysUntilEnd <= renewalWindowDays) {
        add({
          code: 'renewal-decision-date-missing',
          severity: daysUntilEnd <= 30 ? 'high' : 'medium',
          label: 'Renewal decision date needed',
          detail: 'Set the internal decision date before the contract ends.',
          dueDate: success.renewal.contractEndDate,
        });
      }
    }
  }

  return reasons.sort((left, right) => {
    const severityDifference = attentionRank[left.severity] - attentionRank[right.severity];
    if (severityDifference !== 0) return severityDifference;
    if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) return left.dueDate.localeCompare(right.dueDate);
    if (left.dueDate !== right.dueDate) return left.dueDate ? -1 : 1;
    return left.code.localeCompare(right.code);
  });
};
