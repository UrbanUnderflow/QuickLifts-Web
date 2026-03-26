const test = require('node:test');
const assert = require('node:assert/strict');

const {
  dedupeRunSummaries,
  findMatchingRunSummary,
  looksLikeSameRun,
  pickPreferredRunSummary,
  runSummaryQualityScore,
} = require('../run-summary-dedupe');

function buildRun(overrides = {}) {
  return {
    id: overrides.id || 'run_base',
    userId: overrides.userId || 'user_123',
    runType: overrides.runType || 'Free Run',
    location: overrides.location || 'outdoor',
    title: overrides.title || 'Run Complete!',
    startTime: overrides.startTime || 1_700_000_000,
    completedAt: overrides.completedAt || 1_700_000_000 + 49 * 60,
    duration: overrides.duration || 49 * 60,
    distance: overrides.distance || 1.05,
    createdAt: overrides.createdAt || 1_700_000_000,
    updatedAt: overrides.updatedAt || 1_700_000_000 + 60,
    sourceFamily: overrides.sourceFamily || 'pulse_app',
    sourceSessionId: overrides.sourceSessionId || null,
  };
}

test('looksLikeSameRun treats overlapping pulse and Oura runs as the same session', () => {
  const pulseRun = buildRun({
    id: 'pulse_run',
    duration: 49 * 60,
    distance: 1.05,
    sourceFamily: 'pulse_app',
  });
  const ouraRun = buildRun({
    id: 'oura_run',
    startTime: 1_700_000_120,
    completedAt: 1_700_000_120 + 31 * 60,
    duration: 31 * 60,
    distance: 0.01,
    sourceFamily: 'oura',
  });

  assert.equal(looksLikeSameRun(pulseRun, ouraRun), true);
});

test('dedupeRunSummaries keeps the more complete overlapping run', () => {
  const pulseRun = buildRun({
    id: 'pulse_run',
    duration: 49 * 60,
    distance: 1.05,
    sourceFamily: 'pulse_app',
  });
  const ouraRun = buildRun({
    id: 'oura_run',
    startTime: 1_700_000_120,
    completedAt: 1_700_000_120 + 31 * 60,
    duration: 31 * 60,
    distance: 0.01,
    sourceFamily: 'oura',
  });

  const deduped = dedupeRunSummaries([ouraRun, pulseRun]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].id, 'pulse_run');
});

test('findMatchingRunSummary returns the best existing overlapping run', () => {
  const pulseRun = buildRun({
    id: 'pulse_run',
    duration: 49 * 60,
    distance: 1.05,
    sourceFamily: 'pulse_app',
  });
  const ouraRun = buildRun({
    id: 'oura_run',
    startTime: 1_700_000_120,
    completedAt: 1_700_000_120 + 31 * 60,
    duration: 31 * 60,
    distance: 0.01,
    sourceFamily: 'oura',
  });

  const match = findMatchingRunSummary([pulseRun], ouraRun);

  assert.equal(match?.id, 'pulse_run');
});

test('pickPreferredRunSummary favors the higher quality record', () => {
  const pulseRun = buildRun({
    id: 'pulse_run',
    duration: 49 * 60,
    distance: 1.05,
    sourceFamily: 'pulse_app',
  });
  const ouraRun = buildRun({
    id: 'oura_run',
    duration: 31 * 60,
    distance: 0.01,
    sourceFamily: 'oura',
  });

  assert.ok(runSummaryQualityScore(pulseRun) > runSummaryQualityScore(ouraRun));
  assert.equal(pickPreferredRunSummary(ouraRun, pulseRun)?.id, 'pulse_run');
});
