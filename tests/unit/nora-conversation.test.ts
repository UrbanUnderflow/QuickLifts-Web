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
  const orchestrator = await import('../../src/api/firebase/noraConversation/orchestrator');
  const types = await import('../../src/api/firebase/noraConversation/types');
  return { orchestrator, types };
};

test('id builders — buildConversationId concatenates athleteUserId + triggerFireId', async () => {
  const { orchestrator } = await loadModules();
  const id = orchestrator.__internal.buildConversationId('athlete-1', 'fire-2026-04-30');
  assert.equal(id, 'athlete-1_fire-2026-04-30');
});

test('id builders — buildTurnId follows {conversationId}_t{index} format', async () => {
  const { orchestrator } = await loadModules();
  const id = orchestrator.__internal.buildTurnId('athlete-1_fire', 3);
  assert.equal(id, 'athlete-1_fire_t3');
});

test('id builders — buildTriggerFireId combines athleteUserId + trigger + dayKey', async () => {
  const { orchestrator } = await loadModules();
  const id = orchestrator.__internal.buildTriggerFireId('athlete-1', 'hcsr-delta-detected', '2026-04-30');
  assert.equal(id, 'athlete-1_hcsr-delta-detected_2026-04-30');
});

test('keywordFallback — sleep domain maps fatigue keywords to deficit', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('I feel exhausted', 'sleep');
  assert.equal(result, 'deficit');
});

test('keywordFallback — sleep domain maps positive keywords to strong', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('Slept great, deep sleep all night', 'sleep');
  assert.equal(result, 'strong');
});

test('keywordFallback — sleep domain default to adequate', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('It was fine', 'sleep');
  assert.equal(result, 'adequate');
});

test('keywordFallback — autonomic domain detects sympathetic-dominant from stress keywords', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('feeling really tense and on edge', 'autonomic');
  assert.equal(result, 'sympathetic-dominant');
});

test('keywordFallback — circadian domain detects jetlag-significant', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('jet lag is brutal still', 'circadian');
  assert.equal(result, 'jetlag-significant');
});

test('keywordFallback — load domain detects climbing from soreness', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('legs are wrecked today', 'load');
  assert.equal(result, 'climbing');
});

test('keywordFallback — travel domain identifies day-of-arrival', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('just landed', 'travel');
  assert.equal(result, 'day-of-arrival');
});

test('types — HCSR_DELTA_THRESHOLDS includes travel_signature + jetlag_significant', async () => {
  const { types } = await loadModules();
  assert.ok((types.HCSR_DELTA_THRESHOLDS.circadianBands as readonly string[]).includes('travel_signature'));
  assert.ok((types.HCSR_DELTA_THRESHOLDS.circadianBands as readonly string[]).includes('jetlag_significant'));
});

test('types — autonomic load threshold matches doctrine (360 minutes)', async () => {
  const { types } = await loadModules();
  assert.equal(types.HCSR_DELTA_THRESHOLDS.autonomicLoadMinutes, 360);
});

test('types — sleep-efficiency drop threshold is 15%', async () => {
  const { types } = await loadModules();
  assert.equal(types.HCSR_DELTA_THRESHOLDS.sleepEfficiencyDropPct, 0.15);
});

test('types — behavioral drift fires at 5 days', async () => {
  const { types } = await loadModules();
  assert.equal(types.BEHAVIORAL_DRIFT_DAYS, 5);
});

test('types — calendar event window is 36 hours', async () => {
  const { types } = await loadModules();
  assert.equal(types.CALENDAR_EVENT_WINDOW_HOURS, 36);
});
