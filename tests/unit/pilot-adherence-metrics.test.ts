import test from 'node:test';
import assert from 'node:assert/strict';

const installFirebaseEnv = () => {
  const required = {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quicklifts-test',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'quicklifts-test.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:test',
  };
  for (const [key, value] of Object.entries(required)) {
    process.env[key] ||= value;
  }
};

const loadModules = async () => {
  installFirebaseEnv();
  return import('../../src/api/firebase/pilotAdherenceMetrics');
};

test('pilotAdherenceMetrics — buildSevenDayWindow spans 7 days inclusive', async () => {
  const { buildSevenDayWindow } = await loadModules();
  const window = buildSevenDayWindow('2026-04-25');
  assert.equal(window.endDateKey, '2026-04-25');
  assert.equal(window.startDateKey, '2026-04-19');
  assert.equal(window.expectedDays, 7);
});

test('pilotAdherenceMetrics — buildSevenDayWindow rejects invalid date keys', async () => {
  const { buildSevenDayWindow } = await loadModules();
  assert.throws(() => buildSevenDayWindow('not-a-date'));
  assert.throws(() => buildSevenDayWindow(''));
});

test('pilotAdherenceMetrics — ratioReady passes at exactly 0.7 threshold', async () => {
  const { ratioReady } = await loadModules();
  assert.equal(ratioReady(0.6999), false);
  assert.equal(ratioReady(0.7), true);
  assert.equal(ratioReady(0.99), true);
  assert.equal(ratioReady(0), false);
});

test('pilotAdherenceMetrics — countReadyCategories counts each category at >=0.7', async () => {
  const { countReadyCategories } = await loadModules();
  const allReady = countReadyCategories({
    wearRate: 0.85,
    noraCheckinCompletion: 0.71,
    protocolOrSimCompletion: 0.95,
    trainingOrNutritionCoverage: 0.75,
  });
  assert.equal(allReady, 4);

  const noneReady = countReadyCategories({
    wearRate: 0.5,
    noraCheckinCompletion: 0.4,
    protocolOrSimCompletion: 0.6,
    trainingOrNutritionCoverage: 0.0,
  });
  assert.equal(noneReady, 0);

  const twoReady = countReadyCategories({
    wearRate: 0.8,
    noraCheckinCompletion: 0.65,
    protocolOrSimCompletion: 0.9,
    trainingOrNutritionCoverage: 0.5,
  });
  assert.equal(twoReady, 2);
});

test('pilotAdherenceMetrics — confidence label policy matches the spec ladder', async () => {
  const { confidenceLabelFromAdherence } = await loadModules();
  assert.equal(confidenceLabelFromAdherence(4), 'Strong read');
  assert.equal(confidenceLabelFromAdherence(3), 'Strong read');
  assert.equal(confidenceLabelFromAdherence(2), 'Usable read');
  assert.equal(confidenceLabelFromAdherence(1), 'Thin read');
  assert.equal(confidenceLabelFromAdherence(0), 'Insufficient');
});

test('pilotAdherenceMetrics — meanRatio averages and tolerates non-finite entries', async () => {
  const { meanRatio } = await loadModules();
  assert.ok(Math.abs(meanRatio([0.8, 0.9, 0.7]) - 0.8) < 1e-9);
  assert.equal(meanRatio([]), 0);
  assert.ok(Math.abs(meanRatio([0.5, NaN, 0.5]) - 1 / 3) < 1e-9);
});

test('pilotAdherenceMetrics — full lifecycle: 4-category breakdown produces Strong read', async () => {
  const { countReadyCategories, confidenceLabelFromAdherence } = await loadModules();
  const adherence = {
    wearRate: 0.85,
    noraCheckinCompletion: 0.85,
    protocolOrSimCompletion: 0.71,
    trainingOrNutritionCoverage: 0.71,
  };
  const ready = countReadyCategories(adherence);
  const label = confidenceLabelFromAdherence(ready);
  assert.equal(ready, 4);
  assert.equal(label, 'Strong read');
});

test('pilotAdherenceMetrics — tolerates 0 wear days (full non-coverage)', async () => {
  const { countReadyCategories, confidenceLabelFromAdherence } = await loadModules();
  const adherence = {
    wearRate: 0,
    noraCheckinCompletion: 0,
    protocolOrSimCompletion: 0,
    trainingOrNutritionCoverage: 0,
  };
  assert.equal(countReadyCategories(adherence), 0);
  assert.equal(confidenceLabelFromAdherence(0), 'Insufficient');
});

test('pilotAdherenceMetrics — usable-read threshold sits at 2 ready categories', async () => {
  const { countReadyCategories, confidenceLabelFromAdherence } = await loadModules();
  const adherence = {
    wearRate: 0.8,
    noraCheckinCompletion: 0.7,
    protocolOrSimCompletion: 0.5,
    trainingOrNutritionCoverage: 0.4,
  };
  assert.equal(countReadyCategories(adherence), 2);
  assert.equal(confidenceLabelFromAdherence(2), 'Usable read');
});
