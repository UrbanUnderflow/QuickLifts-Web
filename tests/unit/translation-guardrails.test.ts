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
  const [guardrails, seed, types] = await Promise.all([
    import('../../src/api/firebase/adaptiveFramingLayer/guardrails'),
    import('../../src/api/firebase/adaptiveFramingLayer/seed'),
    import('../../src/api/firebase/adaptiveFramingLayer/types'),
  ]);
  return { guardrails, seed, types };
};

// ---------------------------------------------------------------------------
// validateNumericValue
// ---------------------------------------------------------------------------

test('validateNumericValue — passes clean Nora-voice phrasing', async () => {
  const { guardrails, seed } = await loadModules();
  const issues = guardrails.validateNumericValue(
    'Carry that into your warm-up. Move with intent.',
    seed.SEED_OFF_LIMITS_CONFIG,
  );
  assert.equal(issues.length, 0);
});

test('validateNumericValue — flags numeric+unit (ms, bpm, %, °F)', async () => {
  const { guardrails, seed } = await loadModules();
  for (const bad of [
    'Your HRV came in at 85 ms last night.',
    'Resting HR was 60 bpm.',
    'Recovery dropped 42% versus baseline.',
    'Body temp climbed to 99°F.',
  ]) {
    const issues = guardrails.validateNumericValue(bad, seed.SEED_OFF_LIMITS_CONFIG);
    assert.ok(issues.length > 0, `expected violation for: ${bad}`);
  }
});

test('validateNumericValue — flags marker-with-direct-number rule', async () => {
  const { guardrails, seed } = await loadModules();
  for (const bad of ['hrv 85', 'readiness: 92', 'acwr=1.4']) {
    const issues = guardrails.validateNumericValue(bad, seed.SEED_OFF_LIMITS_CONFIG);
    assert.ok(issues.length > 0, `expected violation for: ${bad}`);
  }
});

// ---------------------------------------------------------------------------
// validateForbiddenPhrases
// ---------------------------------------------------------------------------

test('validateForbiddenPhrases — passes clean phrasing', async () => {
  const { guardrails, seed } = await loadModules();
  const issues = guardrails.validateForbiddenPhrases(
    'Get sunlight on your eyes within the first hour. Walk for ten and hydrate.',
    seed.SEED_OFF_LIMITS_CONFIG,
  );
  assert.equal(issues.length, 0);
});

test('validateForbiddenPhrases — catches "your X is low/poor"', async () => {
  const { guardrails, seed } = await loadModules();
  const issues = guardrails.validateForbiddenPhrases(
    'Your recovery is poor today.',
    seed.SEED_OFF_LIMITS_CONFIG,
  );
  assert.ok(issues.length > 0);
});

test('validateForbiddenPhrases — catches "your numbers look..."', async () => {
  const { guardrails, seed } = await loadModules();
  const issues = guardrails.validateForbiddenPhrases(
    'Your numbers look rough — take it easy.',
    seed.SEED_OFF_LIMITS_CONFIG,
  );
  assert.ok(issues.length > 0);
});

// ---------------------------------------------------------------------------
// validateNegativePriming
// ---------------------------------------------------------------------------

test('validateNegativePriming — passes clean phrasing', async () => {
  const { guardrails } = await loadModules();
  const issues = guardrails.validateNegativePriming(
    'Lean into a longer warm-up. Pick one focus and trust the work.',
  );
  assert.equal(issues.length, 0);
});

test('validateNegativePriming — flags "your X is low"', async () => {
  const { guardrails } = await loadModules();
  for (const bad of [
    'Your recovery is low today.',
    'Your readiness was poor this morning.',
    'Your scores look bad.',
  ]) {
    const issues = guardrails.validateNegativePriming(bad);
    assert.ok(issues.length > 0, `expected negative-priming flag for: ${bad}`);
  }
});

test("validateNegativePriming — flags \"you've been...\" narratives", async () => {
  const { guardrails } = await loadModules();
  for (const bad of ["You've been pushing hard.", "You\u2019ve been overreaching all week."]) {
    const issues = guardrails.validateNegativePriming(bad);
    assert.ok(issues.length > 0, `expected negative-priming flag for: ${bad}`);
  }
});

test('validateNegativePriming — flags "low/poor + marker" framings', async () => {
  const { guardrails } = await loadModules();
  for (const bad of ['Low HRV today.', 'Poor recovery this morning.']) {
    const issues = guardrails.validateNegativePriming(bad);
    assert.ok(issues.length > 0, `expected negative-priming flag for: ${bad}`);
  }
});

// ---------------------------------------------------------------------------
// validateActionPresence
// ---------------------------------------------------------------------------

test('validateActionPresence — passes when at least one required verb present', async () => {
  const { guardrails } = await loadModules();
  const issues = guardrails.validateActionPresence(
    'Walk in daylight for ten minutes after waking.',
    ['Walk', 'Eat', 'box-breathe'],
  );
  assert.equal(issues.length, 0);
});

test('validateActionPresence — flags when none of the required verbs appear', async () => {
  const { guardrails } = await loadModules();
  const issues = guardrails.validateActionPresence(
    'Take it easy and rest up today.',
    ['Walk', 'Eat', 'box-breathe'],
  );
  assert.ok(issues.length > 0);
});

test('validateActionPresence — empty required verbs list is a no-op', async () => {
  const { guardrails } = await loadModules();
  const issues = guardrails.validateActionPresence('Anything goes here.', []);
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------------------
// validateSentenceCount
// ---------------------------------------------------------------------------

test('validateSentenceCount — accepts 1, 2, or 3 sentences', async () => {
  const { guardrails } = await loadModules();
  for (const text of [
    'Walk in the sunlight.',
    'Walk in the sunlight. Hydrate before warm-up.',
    'Walk in the sunlight. Hydrate before warm-up. Box-breathe through the first round.',
  ]) {
    assert.equal(guardrails.validateSentenceCount(text).length, 0, `expected pass: ${text}`);
  }
});

test('validateSentenceCount — rejects 4+ sentences', async () => {
  const { guardrails } = await loadModules();
  const issues = guardrails.validateSentenceCount(
    'Walk now. Hydrate. Box-breathe. Then warm up slowly.',
  );
  assert.ok(issues.length > 0);
});

test('validateSentenceCount — rejects empty / zero-sentence content', async () => {
  const { guardrails } = await loadModules();
  assert.ok(guardrails.validateSentenceCount('   ...   ').length > 0);
});

// ---------------------------------------------------------------------------
// runAthletePhrasingGuardrails — bundle behavior
// ---------------------------------------------------------------------------

test('runAthletePhrasingGuardrails — every Phase B seed row passes (regression gate)', async () => {
  const { guardrails, seed } = await loadModules();
  const offLimits = seed.SEED_OFF_LIMITS_CONFIG;
  for (const row of seed.SEED_TRANSLATION_ROWS) {
    const result = guardrails.runAthletePhrasingGuardrails(row.athletePhrasing, row, offLimits);
    assert.equal(
      result.ok,
      true,
      `${row.id} seed phrasing should pass guardrails: ${JSON.stringify(result.violations)}`,
    );
  }
});

test('runAthletePhrasingGuardrails — synthetic numeric+marker violation is caught', async () => {
  const { guardrails, seed } = await loadModules();
  const offLimits = seed.SEED_OFF_LIMITS_CONFIG;
  const row = seed.SEED_TRANSLATION_ROWS[0];
  const result = guardrails.runAthletePhrasingGuardrails(
    'Your HRV came in at 85 ms — carry that into your warm-up.',
    row,
    offLimits,
  );
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => /numeric|hrv/i.test(v.message)));
});

test('runAthletePhrasingGuardrails — synthetic "your recovery is low" violation is caught', async () => {
  const { guardrails, seed } = await loadModules();
  const offLimits = seed.SEED_OFF_LIMITS_CONFIG;
  const row = seed.SEED_TRANSLATION_ROWS[0];
  const result = guardrails.runAthletePhrasingGuardrails(
    'Your recovery is low — carry that into the warm-up.',
    row,
    offLimits,
  );
  assert.equal(result.ok, false);
});

test('runAthletePhrasingGuardrails — synthetic missing-action-verb violation is caught', async () => {
  const { guardrails, seed } = await loadModules();
  const offLimits = seed.SEED_OFF_LIMITS_CONFIG;
  const row = {
    ...seed.SEED_TRANSLATION_ROWS[0],
    requiredActionVerbs: ['Walk', 'Hydrate'],
  };
  const result = guardrails.runAthletePhrasingGuardrails(
    'Take it easy and rest up today.',
    row,
    offLimits,
  );
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => /required action verbs/i.test(v.message)));
});

test('runAthletePhrasingGuardrails — synthetic 4-sentence violation is caught', async () => {
  const { guardrails, seed } = await loadModules();
  const offLimits = seed.SEED_OFF_LIMITS_CONFIG;
  const row = seed.SEED_TRANSLATION_ROWS[0];
  const result = guardrails.runAthletePhrasingGuardrails(
    'Walk now. Hydrate. Box-breathe. Then warm up slowly.',
    row,
    offLimits,
  );
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => /1\u20133 sentences/.test(v.message)));
});
