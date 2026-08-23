import assert from 'node:assert/strict';
import test from 'node:test';

import {
  derivePulseCheckMoodEvidence,
  pulseCheckMoodLabel,
} from '../../src/utils/pulsecheckMoodEvidence';

test('history sentiment explains Mixed and explicitly excludes wearable influence', () => {
  const evidence = derivePulseCheckMoodEvidence({
    hasEvidence: true,
    historySentimentScore: 0,
    historyMessageCount: 3,
    historySources: [
      { label: 'Morning check-in', sentimentScore: 0.45, messageCount: 1 },
      { label: 'Nora conversation', sentimentScore: -0.45, messageCount: 2 },
    ],
  });

  assert.equal(evidence.label, 'Mixed');
  assert.equal(evidence.sourceLabel, 'PulseCheck history · 2 inputs');
  assert.match(evidence.sourceReadingLabel, /\+0\.00.*Mixed range/);
  assert.match(evidence.explanation, /Morning check-in \(\+0\.45\)/);
  assert.match(evidence.explanation, /Nora conversation \(-0\.45\)/);
  assert.match(evidence.wearableRole, /not used/i);
});

test('self-report wins the Mood label and names the selected period', () => {
  const evidence = derivePulseCheckMoodEvidence({
    hasEvidence: true,
    selfReportLevel: 'solid',
    selfReportPeriod: 'Evening',
    noraSentimentScore: -0.8,
    noraMessageCount: 4,
    historySentimentScore: -0.8,
    historyMessageCount: 4,
  });

  assert.equal(evidence.label, 'Good');
  assert.equal(evidence.sourceLabel, 'Evening self-report');
  assert.match(evidence.explanation, /selected "Solid"/);
});

test('Nora sentiment requires a real message before it can become the source', () => {
  const evidence = derivePulseCheckMoodEvidence({
    hasEvidence: true,
    noraSentimentScore: 0.8,
    noraMessageCount: 0,
    historySentimentScore: 0,
    historyMessageCount: 1,
    historySources: [{ label: 'Mood check-in', sentimentScore: 0 }],
  });

  assert.equal(evidence.label, 'Mixed');
  assert.equal(evidence.sourceLabel, 'PulseCheck history · Mood check-in');
});

test('Mood thresholds disclose the exact source range', () => {
  assert.equal(pulseCheckMoodLabel(0.3), 'Good');
  assert.equal(pulseCheckMoodLabel(0.299), 'Mixed');
  assert.equal(pulseCheckMoodLabel(-0.3), 'Mixed');
  assert.equal(pulseCheckMoodLabel(-0.301), 'Low');
});

test('days without evidence do not imply that a neutral fallback was measured', () => {
  const evidence = derivePulseCheckMoodEvidence({ hasEvidence: false });

  assert.equal(evidence.sourceLabel, 'No mood evidence');
  assert.equal(evidence.sourceReadingLabel, 'No source reading');
  assert.doesNotMatch(evidence.explanation, /Mixed range/);
});
