import assert from 'node:assert/strict';
import test from 'node:test';
import { __internal } from '../../netlify/functions/ingest-health-connect-recovery';

test('normalizes Health Connect RMSSD without converting it into Apple SDNN', () => {
  const observation = __internal.normalizeObservation({
    dateKey: '2026-08-15',
    sourcePackage: 'com.whoop.android',
    observedAt: '2026-08-15T11:00:00.000Z',
    freshness: 'fresh',
    hrvRmssdMs: 61.4,
    hrvMethod: 'sdnn',
    hrvMeasurementWindow: 'spot',
  });
  assert.ok(observation);
  assert.equal(observation.hrvMethod, 'rmssd');
  assert.equal(observation.hrvRmssdMs, 61.4);
  assert.equal(observation.sourcePackage, 'com.whoop.android');
});

test('rejects observations with no eligible recovery evidence', () => {
  assert.equal(__internal.normalizeObservation({
    dateKey: '2026-08-15',
    sourcePackage: 'com.example',
    observedAt: '2026-08-15T11:00:00.000Z',
  }), null);
});

test('bounds impossible physiology instead of persisting it', () => {
  assert.equal(__internal.normalizeObservation({
    dateKey: '2026-08-15',
    sourcePackage: 'com.example',
    observedAt: '2026-08-15T11:00:00.000Z',
    hrvRmssdMs: 5_000,
    restingHeartRateBpm: 500,
    sleepDurationMinutes: 2_000,
  }), null);
});

test('direct vendor snapshots take priority over Health Connect aggregation', () => {
  assert.equal(__internal.isDirectWearableSource('whoop'), true);
  assert.equal(__internal.isDirectWearableSource('oura'), true);
  assert.equal(__internal.isDirectWearableSource('health_connect:com.whoop.android'), false);
  assert.equal(__internal.isDirectWearableSource('healthkit'), false);
});

test('recovery payload preserves source identity and method metadata', () => {
  const observation = __internal.normalizeObservation({
    dateKey: '2026-08-15',
    sourcePackage: 'com.ouraring.oura',
    observedAt: '2026-08-15T11:00:00.000Z',
    freshness: 'fresh',
    hrvRmssdMs: 48,
    restingHeartRateBpm: 52,
    sleepDurationMinutes: 455,
    sleepTimingDeviationMinutes: 22,
  });
  assert.ok(observation);
  const recovery = __internal.recoveryDataFor(observation);
  assert.equal(recovery.heartRateVariabilityMethod, 'rmssd');
  assert.equal(recovery.rawDeviceId, 'com.ouraring.oura');
  assert.equal(recovery.restingHeartRateMeasurementWindow, 'full_day');
  assert.equal(recovery.sleepMidpointShiftMinutes, 22);
});
