const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hasMeasuredPayload,
  measuredFieldNames,
  measuredFieldSources,
} = require('../lib/health-context-measurements');

test('metadata-only wearable payloads are not treated as observations', () => {
  const metadataOnly = {
    sourceFamily: 'fitbit',
    connected: true,
    lastSyncTimestamp: 1_787_400_000,
    cardioLoad: -1,
    steps: 0,
    workouts: [],
  };

  assert.equal(hasMeasuredPayload('activity', metadataOnly), false);
  assert.equal(hasMeasuredPayload('training', metadataOnly), false);
  assert.deepEqual(measuredFieldNames('activity', metadataOnly), []);
});

test('real metrics create field-level attribution for their actual provider', () => {
  const payload = { steps: 5_115, activeMinutes: 41, sourceFamily: 'polar' };

  assert.equal(hasMeasuredPayload('activity', payload), true);
  assert.deepEqual(measuredFieldSources('activity', payload, 'polar'), {
    steps: 'polar',
    activeMinutes: 'polar',
  });
});

test('WHOOP total workout duration is measured training evidence', () => {
  const payload = { totalDurationMinutes: 41, workoutCount: 1 };

  assert.equal(hasMeasuredPayload('training', payload), true);
  assert.deepEqual(measuredFieldSources('training', payload, 'whoop'), {
    workoutCount: 'whoop',
    totalDurationMinutes: 'whoop',
  });
});

test('zero temperature deviation is a measured value while placeholder zero metrics are not', () => {
  assert.equal(
    hasMeasuredPayload('recovery', { sleepTemperatureDeviationCelsius: 0 }),
    true
  );
  assert.equal(hasMeasuredPayload('recovery', { sleepDuration: 0, heartRateResting: 0 }), false);
});
