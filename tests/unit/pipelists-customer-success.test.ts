import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateCustomerSuccessMetricRecords,
  calculateCustomerSuccessAttention,
  filterCustomerSuccessMetricRecords,
  isUniversityCustomerSuccessStage,
  normalizeCustomerSuccessMetricRecord,
  normalizeCustomerSuccessReportingPeriod,
  normalizeMetricMeasurement,
  normalizeUniversityCustomerSuccess,
  pilotPhaseFromPipelineStage,
  summarizeMeasuredValues,
  type CustomerSuccessMetricRecord,
} from '../../src/utils/pipelistsCustomerSuccess';

test('legacy university items seed operational fields without inventing customer facts', () => {
  const success = normalizeUniversityCustomerSuccess(undefined, {
    stage: 'closed-won',
    owner: 'Tracey',
    nextStep: 'Schedule coach onboarding',
    dueDate: '2026-09-18',
    pilotStart: '2026-09-01',
    pilotEnd: '2026-10-15',
  });

  assert.equal(success.pilotPhase, 'not-started');
  assert.equal(success.health.status, 'unknown');
  assert.deepEqual(success.nextAction, {
    summary: 'Schedule coach onboarding',
    owner: 'Tracey',
    dueDate: '2026-09-18',
    status: 'open',
  });
  assert.deepEqual(success.pilot, { startDate: '2026-09-01', endDate: '2026-10-15' });
  assert.equal(success.launchChecklist.length, 7);
  assert.equal(success.successMeasures.length, 0);
  assert.equal(success.renewal.contractStartDate, '');
  assert.equal(success.renewal.contractEndDate, '');
  assert.equal(success.renewal.outcome, 'unknown');
  assert.deepEqual(success.linkage, {
    organizationId: '',
    teamId: '',
    pilotId: '',
    customerAccountId: '',
  });
  const attention = calculateCustomerSuccessAttention(success, { today: '2026-09-08' });
  assert.ok(attention.some((reason) => reason.code === 'incomplete-onboarding'));
});

test('pipeline stages map into the continuing delivery lifecycle', () => {
  assert.equal(pilotPhaseFromPipelineStage('pilot-agreed'), 'onboarding');
  assert.equal(pilotPhaseFromPipelineStage('pilot-active'), 'active');
  assert.equal(pilotPhaseFromPipelineStage('pilot-complete'), 'final-review');
  assert.equal(pilotPhaseFromPipelineStage('proposal-sent'), 'final-review');
  assert.equal(pilotPhaseFromPipelineStage('negotiating'), 'final-review');
  assert.equal(pilotPhaseFromPipelineStage('closed-won'), 'not-started');
  assert.equal(pilotPhaseFromPipelineStage('closed-lost-paused'), 'paused');
  assert.equal(pilotPhaseFromPipelineStage('identified'), 'not-started');

  assert.equal(isUniversityCustomerSuccessStage('pilot-agreed'), true);
  assert.equal(isUniversityCustomerSuccessStage('closed-won'), true);
  assert.equal(isUniversityCustomerSuccessStage('closed-lost-paused'), true);
  assert.equal(isUniversityCustomerSuccessStage('engaged'), false);
});

test('explicit success plans normalize dates, ownership, health, linkage, and measured zero', () => {
  const success = normalizeUniversityCustomerSuccess({
    pilotPhase: 'active',
    health: {
      status: 'watch',
      reason: 'Staff onboarding is one week behind.',
      updatedAt: '2026-09-08T14:30:00-04:00',
      updatedBy: 'Success Lead',
    },
    ownership: {
      accountOwner: 'Tracey',
      customerSuccessOwner: 'Will',
      executiveSponsor: 'Athletic Director',
      champion: 'Head Athletic Trainer',
    },
    pilot: { startDate: '2026-09-09', endDate: '2026-10-15' },
    launchChecklist: [
      { id: 'staff-onboarding', label: 'Complete staff onboarding', status: 'complete', completedAt: '2026-09-07' },
    ],
    successMeasures: [
      {
        id: 'weekly-check-in-rate',
        label: 'Weekly check-in rate',
        unit: '%',
        baseline: { value: 0, asOf: '2026-09-01' },
        target: { value: 75 },
        latestResult: {
          state: 'measured',
          value: 0,
          asOf: '2026-09-08',
          periodStart: '2026-09-01',
          periodEnd: '2026-09-07',
        },
        source: 'Weekly staff scorecard',
        sourceKind: 'manual',
        owner: 'Will',
        deadline: '2026-10-15',
      },
    ],
    nextAction: { summary: 'Review invite completion', owner: 'Will', dueDate: '2026-09-12' },
    nextReviewDate: '2026-09-16',
    renewal: {
      contractStartDate: '2026-11-01',
      contractEndDate: '2027-10-31',
      decisionDate: '2027-09-15',
      owner: 'Tracey',
      outcome: 'pending',
    },
    linkage: {
      organizationId: 'org_CAU',
      teamId: 'team_001',
      pilotId: 'pilot_fall_2026',
      customerAccountId: 'account_001',
    },
  });

  assert.equal(success.health.status, 'watch');
  assert.equal(success.health.updatedAt, '2026-09-08T18:30:00.000Z');
  assert.equal(success.ownership.customerSuccessOwner, 'Will');
  assert.equal(success.successMeasures[0].baseline.value, 0);
  assert.equal(success.successMeasures[0].baseline.state, 'measured');
  assert.equal(success.successMeasures[0].latestResult.value, 0);
  assert.equal(success.successMeasures[0].latestResult.state, 'measured');
  assert.equal(success.lastSuccessUpdateAt, '2026-09-08T00:00:00.000Z');
  assert.equal(success.linkage.organizationId, 'org_CAU');
  assert.equal(success.linkage.teamId, 'team_001');
  assert.deepEqual(JSON.parse(JSON.stringify(success)), success);
});

test('malformed saved values normalize into a stable JSON-compatible shape', () => {
  const success = normalizeUniversityCustomerSuccess({
    pilotPhase: 'made-up',
    health: { status: 'great', updatedAt: 'someday' },
    launchChecklist: [
      null,
      { label: '  Kickoff  ', id: 'same', status: 'complete', completedAt: '2026-09-02' },
      { label: 'Training', id: 'same', status: 'surprise', dueDate: '2026-02-31' },
    ],
    successMeasures: [
      { label: 'Active users', baseline: Number.POSITIVE_INFINITY, latestResult: 'abc' },
      { label: '' },
    ],
    renewal: { outcome: 'maybe', contractEndDate: 'October' },
  }, { stage: 'pilot-agreed' });

  assert.equal(success.pilotPhase, 'onboarding');
  assert.equal(success.health.status, 'unknown');
  assert.equal(success.health.updatedAt, '');
  assert.deepEqual(success.launchChecklist.map((item) => item.id), ['same', 'same-3']);
  assert.equal(success.launchChecklist[1].status, 'pending');
  assert.equal(success.launchChecklist[1].dueDate, '');
  assert.equal(success.successMeasures.length, 1);
  assert.equal(success.successMeasures[0].baseline.state, 'missing');
  assert.equal(success.successMeasures[0].latestResult.state, 'missing');
  assert.equal(success.renewal.outcome, 'unknown');
  assert.doesNotThrow(() => JSON.stringify(success));
});

test('attention reasons cover overdue action, incomplete launch, stale evidence, and renewal timing', () => {
  const success = normalizeUniversityCustomerSuccess({
    pilotPhase: 'active',
    health: { status: 'watch' },
    launchChecklist: [
      { id: 'kickoff', label: 'Hold kickoff', status: 'complete' },
      { id: 'staff', label: 'Complete staff onboarding', status: 'in-progress', dueDate: '2026-09-03' },
    ],
    successMeasures: [
      {
        id: 'adoption',
        label: 'Weekly adoption',
        latestResult: { value: 42, asOf: '2026-08-15' },
      },
    ],
    nextAction: {
      summary: 'Finish staff training',
      owner: 'Will',
      dueDate: '2026-09-04',
      status: 'open',
    },
    nextReviewDate: '2026-09-05',
    renewal: {
      decisionDate: '2026-09-28',
      outcome: 'pending',
    },
  });

  const reasons = calculateCustomerSuccessAttention(success, {
    today: '2026-09-08',
    staleAfterDays: 14,
    renewalWindowDays: 60,
  });
  const codes = reasons.map((reason) => reason.code);

  assert.ok(codes.includes('overdue-next-action'));
  assert.ok(codes.includes('overdue-launch-item'));
  assert.ok(codes.includes('incomplete-onboarding'));
  assert.ok(codes.includes('success-update-stale'));
  assert.ok(codes.includes('review-overdue'));
  assert.ok(codes.includes('renewal-decision-upcoming'));
  assert.equal(codes.includes('health-unknown'), false);
  assert.equal(reasons[0].severity, 'high');
});

test('missing and overdue success decisions stay distinct', () => {
  const missingUpdate = normalizeUniversityCustomerSuccess({
    pilotPhase: 'ongoing',
    health: { status: 'unknown' },
    successMeasures: [],
    nextAction: { summary: '', status: 'open' },
    renewal: { contractEndDate: '2026-10-01', outcome: 'unknown' },
  });
  const missingCodes = calculateCustomerSuccessAttention(missingUpdate, { today: '2026-09-08' }).map(
    (reason) => reason.code,
  );
  assert.ok(missingCodes.includes('success-update-missing'));
  assert.ok(missingCodes.includes('health-unknown'));
  assert.ok(missingCodes.includes('renewal-decision-date-missing'));

  const overdueDecision = normalizeUniversityCustomerSuccess({
    pilotPhase: 'renewal',
    health: { status: 'on-track' },
    successMeasures: [{ id: 'use', label: 'Weekly use', latestResult: { value: 0, asOf: '2026-09-08' } }],
    renewal: { decisionDate: '2026-09-01', outcome: 'pending' },
  });
  const overdueCodes = calculateCustomerSuccessAttention(overdueDecision, { today: '2026-09-08' }).map(
    (reason) => reason.code,
  );
  assert.ok(overdueCodes.includes('renewal-decision-overdue'));
  assert.equal(overdueCodes.includes('renewal-decision-upcoming'), false);
});

test('paused relationships stay quiet unless a concrete commitment needs attention', () => {
  const quietPaused = normalizeUniversityCustomerSuccess({
    pilotPhase: 'paused',
    health: { status: 'unknown' },
    nextAction: { summary: '', status: 'open' },
    successMeasures: [],
  });
  const quietCodes = calculateCustomerSuccessAttention(quietPaused, { today: '2026-09-08' }).map(
    (reason) => reason.code,
  );
  assert.equal(quietCodes.includes('next-action-missing'), false);
  assert.equal(quietCodes.includes('health-unknown'), false);
  assert.equal(quietCodes.includes('success-update-missing'), false);

  const committedPaused = normalizeUniversityCustomerSuccess({
    pilotPhase: 'paused',
    health: { status: 'unknown' },
    nextAction: {
      summary: 'Confirm whether to restart the pilot',
      owner: 'Will',
      dueDate: '2026-09-01',
      status: 'open',
    },
  });
  const committedCodes = calculateCustomerSuccessAttention(committedPaused, { today: '2026-09-08' }).map(
    (reason) => reason.code,
  );
  assert.ok(committedCodes.includes('overdue-next-action'));
});

test('metric aggregates preserve measured zero and count missing evidence separately', () => {
  assert.deepEqual(normalizeMetricMeasurement(0), {
    state: 'measured',
    value: 0,
    asOf: '',
    periodStart: '',
    periodEnd: '',
  });
  assert.equal(normalizeMetricMeasurement('0%').state, 'measured');

  const summary = summarizeMeasuredValues([0, '10', '', null, { state: 'missing', value: 90 }]);
  assert.deepEqual(summary, {
    state: 'measured',
    measuredCount: 2,
    missingCount: 3,
    sum: 10,
    average: 5,
    minimum: 0,
    maximum: 10,
  });

  const missing = summarizeMeasuredValues(['', null, Number.NaN]);
  assert.equal(missing.state, 'missing');
  assert.equal(missing.average, null);
  assert.equal(missing.sum, null);
  assert.equal(missing.missingCount, 3);
});

test('reporting filters default to the selected list and apply an inclusive period', () => {
  const makeRecord = (
    id: string,
    listId: string,
    value: number | null,
    periodStart: string,
    periodEnd: string,
  ) => normalizeCustomerSuccessMetricRecord({
    id,
    listId,
    itemId: 'university-1',
    measureId: 'adoption',
    measureLabel: 'Weekly adoption',
    measurement: value === null
      ? { state: 'missing', periodStart, periodEnd }
      : { state: 'measured', value, periodStart, periodEnd },
    recordedAt: `${periodEnd}T15:00:00Z`,
    source: 'Weekly scorecard',
  }) as CustomerSuccessMetricRecord;

  const records = [
    makeRecord('selected-zero', 'university-pilots', 0, '2026-09-01', '2026-09-07'),
    makeRecord('selected-old', 'university-pilots', 50, '2026-08-18', '2026-08-24'),
    makeRecord('other-list', 'vc-list', 100, '2026-09-01', '2026-09-07'),
    makeRecord('selected-missing', 'university-pilots', null, '2026-09-07', '2026-09-07'),
  ];
  const reportingPeriod = normalizeCustomerSuccessReportingPeriod({
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  });

  const selected = filterCustomerSuccessMetricRecords(records, {
    selectedListId: 'university-pilots',
    reportingPeriod,
  });
  assert.deepEqual(selected.map((record) => record.id), ['selected-zero', 'selected-missing']);

  const workspace = filterCustomerSuccessMetricRecords(records, {
    selectedListId: 'university-pilots',
    scope: 'workspace',
    reportingPeriod,
  });
  assert.deepEqual(workspace.map((record) => record.id), ['selected-zero', 'other-list', 'selected-missing']);

  const aggregate = aggregateCustomerSuccessMetricRecords(selected);
  assert.deepEqual(aggregate, [{
    measureId: 'adoption',
    measureLabel: 'Weekly adoption',
    state: 'measured',
    measuredCount: 1,
    missingCount: 1,
    sum: 0,
    average: 0,
    minimum: 0,
    maximum: 0,
  }]);
});

test('invalid or reversed reporting periods remain explicit', () => {
  assert.equal(normalizeCustomerSuccessReportingPeriod({ startDate: '', endDate: '2026-09-30' }), null);
  assert.equal(
    normalizeCustomerSuccessReportingPeriod({ startDate: '2026-10-01', endDate: '2026-09-30' }),
    null,
  );
});
