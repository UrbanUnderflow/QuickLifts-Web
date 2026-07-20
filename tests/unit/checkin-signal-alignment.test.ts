import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySleepSelfReportAlignment,
  extractSleepObjectiveSignals,
  normalizeSleepEfficiencyPct,
} from '../../src/api/firebase/mentaltraining/checkInSignalAlignment';
import { __internal as endpointInternal } from '../../netlify/functions/record-checkin-signal-alignment';

test('positive good-sleep report aligns with favorable current device evidence', () => {
  const result = classifySleepSelfReportAlignment('positive', {
    sleepEfficiencyPct: 91,
    readinessScore: 82,
  });
  assert.equal(result.classification, 'aligned');
  assert.equal(result.confidence, 'stable');
});

test('positive good-sleep report records a mismatch when evidence is unfavorable', () => {
  const result = classifySleepSelfReportAlignment('positive', {
    sleepEfficiencyPct: 68,
    recoveryScore: 48,
  });
  assert.equal(result.classification, 'not_aligned');
});

test('conflicting objective signals remain mixed rather than forcing an alignment', () => {
  const result = classifySleepSelfReportAlignment('positive', {
    sleepEfficiencyPct: 91,
    recoveryScore: 49,
  });
  assert.equal(result.classification, 'mixed');
});

test('duration is interpreted only against a learned personal baseline', () => {
  assert.equal(classifySleepSelfReportAlignment('positive', {
    sleepDurationHours: 7.5,
  }).classification, 'insufficient_data');
  assert.equal(classifySleepSelfReportAlignment('positive', {
    sleepDurationHours: 7.5,
    personalBaselineHours: 8,
  }).classification, 'aligned');
});

test('snapshot extraction normalizes Fitbit flat fields and efficiency scales', () => {
  const recovery = endpointInternal.mergeDomainData({
    heartRateResting: 62,
    data: { totalSleepMin: 450, sleepEfficiency: 0.91 },
  });
  const signals = extractSleepObjectiveSignals(recovery, 8);
  assert.equal(signals.sleepDurationHours, 7.5);
  assert.equal(signals.sleepEfficiencyPct, 91);
  assert.equal(normalizeSleepEfficiencyPct(88), 88);
});

test('only authored morning sleep reasons create an alignment record', () => {
  assert.equal(endpointInternal.reportDirection('solid', 'Good sleep'), 'positive');
  assert.equal(endpointInternal.reportDirection('locked', 'Good sleep'), 'positive');
  assert.equal(endpointInternal.reportDirection('low', 'Sleep'), 'negative');
  assert.equal(endpointInternal.reportDirection('solid', 'Good mood'), null);
  assert.equal(endpointInternal.reportDirection('okay', 'Sleep'), null);
});
