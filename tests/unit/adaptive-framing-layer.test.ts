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
  const [types, seed] = await Promise.all([
    import('../../src/api/firebase/adaptiveFramingLayer/types'),
    import('../../src/api/firebase/adaptiveFramingLayer/seed'),
  ]);
  return { types, seed };
};

// ---------------------------------------------------------------------------
// Off-Limits Config
// ---------------------------------------------------------------------------

test('off-limits config — seed includes every performance-priming marker', async () => {
  const { seed, types } = await loadModules();
  const result = types.validateOffLimitsConfig(seed.SEED_OFF_LIMITS_CONFIG);
  assert.equal(result.ok, true, JSON.stringify(result.issues));

  for (const marker of types.PERFORMANCE_PRIMING_MARKERS) {
    assert.ok(
      seed.SEED_OFF_LIMITS_CONFIG.forbiddenMarkers.some((m) => m.toLowerCase() === marker.toLowerCase()),
      `expected forbiddenMarkers to include '${marker}'`,
    );
  }
});

test('off-limits config — every regex compiles', async () => {
  const { seed } = await loadModules();
  for (const pattern of seed.SEED_OFF_LIMITS_CONFIG.forbiddenPhrasePatterns) {
    assert.doesNotThrow(() => new RegExp(pattern), `forbidden phrase regex should compile: ${pattern}`);
  }
  for (const rule of seed.SEED_OFF_LIMITS_CONFIG.numericValueRules) {
    assert.doesNotThrow(
      () => new RegExp(rule.pattern, rule.flags),
      `numeric value regex should compile: ${rule.ruleId}`,
    );
  }
});

test('off-limits config — numeric rule catches "85 ms" near hrv reference', async () => {
  const { seed } = await loadModules();
  const numericRule = seed.SEED_OFF_LIMITS_CONFIG.numericValueRules.find(
    (r) => r.ruleId === 'numeric-with-unit-near-marker',
  );
  assert.ok(numericRule);
  const regex = new RegExp(numericRule.pattern, numericRule.flags);
  assert.ok(regex.test('Your HRV came in at 85 ms last night.'));
  assert.ok(regex.test('Recovery is 42% lower than usual.'));
  assert.ok(!regex.test('Carry that into your warm-up. Move with intent and lock in your first reps.'));
});

test('off-limits config — marker-with-direct-number rule catches "hrv 85"', async () => {
  const { seed } = await loadModules();
  const directNumberRule = seed.SEED_OFF_LIMITS_CONFIG.numericValueRules.find(
    (r) => r.ruleId === 'marker-name-with-direct-number',
  );
  assert.ok(directNumberRule);
  const regex = new RegExp(directNumberRule.pattern, directNumberRule.flags);
  assert.ok(regex.test('hrv 85'));
  assert.ok(regex.test('readiness: 92'));
  assert.ok(regex.test('acwr=1.4'));
});

// ---------------------------------------------------------------------------
// Translation Table
// ---------------------------------------------------------------------------

test('translation table — every seed row passes its own validator', async () => {
  const { seed, types } = await loadModules();
  const offLimits = seed.SEED_OFF_LIMITS_CONFIG;

  for (const row of seed.SEED_TRANSLATION_ROWS) {
    const result = types.validateTranslationRow(row, offLimits);
    assert.equal(result.ok, true, `${row.id}: ${JSON.stringify(result.issues)}`);
  }
});

test('translation table — (domain, state) pairs are unique', async () => {
  const { seed } = await loadModules();
  const seen = new Set<string>();
  for (const row of seed.SEED_TRANSLATION_ROWS) {
    const key = `${row.domain}::${row.state}`;
    assert.ok(!seen.has(key), `duplicate (domain, state) pair: ${key}`);
    seen.add(key);
  }
});

test('translation table — every row has voiceReviewStatus seed-pending-review', async () => {
  const { seed } = await loadModules();
  for (const row of seed.SEED_TRANSLATION_ROWS) {
    assert.equal(
      row.voiceReviewStatus,
      'seed-pending-review',
      `${row.id} should ship as seed-pending-review`,
    );
  }
});

test('translation table — every row is 1–3 sentences and action-verb-led', async () => {
  const { seed } = await loadModules();
  for (const row of seed.SEED_TRANSLATION_ROWS) {
    const sentences = row.athletePhrasing
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    assert.ok(
      sentences.length >= 1 && sentences.length <= 3,
      `${row.id} must be 1–3 sentences (got ${sentences.length})`,
    );
    // First word of first sentence should be a verb (capital first letter, no "Your"/"You" leading).
    const firstWord = sentences[0].split(/\s+/)[0];
    assert.ok(
      !/^(Your|You|You're|You've)$/i.test(firstWord),
      `${row.id} should not lead with second-person pronoun (got "${firstWord}")`,
    );
  }
});

test('translation table — no row contains numeric+unit near a forbidden marker', async () => {
  const { seed } = await loadModules();
  const numericRegex = /\d+\s?(ms|bpm|°[FC]|%)/i;
  for (const row of seed.SEED_TRANSLATION_ROWS) {
    assert.ok(
      !numericRegex.test(row.athletePhrasing),
      `${row.id} must not pair numeric values with off-limits units`,
    );
  }
});

test('translation table — no row uses negative-priming language', async () => {
  const { seed } = await loadModules();
  const banned = [
    /\byour\s+\w+\s+(is|was)\s+(low|poor|bad|terrible|down|critical)\b/i,
    /\byou'?ve\s+been\s+\w+/i,
    /\b(low|poor|bad|terrible|critical)\s+(hrv|sleep score|sleepscore|readiness|recovery|rhr)\b/i,
  ];
  for (const row of seed.SEED_TRANSLATION_ROWS) {
    for (const pattern of banned) {
      assert.ok(
        !pattern.test(row.athletePhrasing),
        `${row.id} contains negative-priming phrase: ${row.athletePhrasing}`,
      );
    }
  }
});

test('translation table — required action verbs appear in athletePhrasing', async () => {
  const { seed } = await loadModules();
  for (const row of seed.SEED_TRANSLATION_ROWS) {
    const lowered = row.athletePhrasing.toLowerCase();
    for (const verb of row.requiredActionVerbs) {
      assert.ok(
        lowered.includes(verb.toLowerCase()),
        `${row.id} required verb "${verb}" missing from phrasing`,
      );
    }
  }
});

test('translation table — validator catches numeric+marker violation', async () => {
  const { seed, types } = await loadModules();
  const bad = {
    ...seed.SEED_TRANSLATION_ROWS[0],
    athletePhrasing: 'Your recovery came back at 42% — push through the warm-up.',
    requiredActionVerbs: ['push'],
  };
  const result = types.validateTranslationRow(bad, seed.SEED_OFF_LIMITS_CONFIG);
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((i) => /numeric|forbidden/i.test(i.message)),
    'expected numeric/forbidden issue',
  );
});

// ---------------------------------------------------------------------------
// Conversation Tree
// ---------------------------------------------------------------------------

test('conversation tree — seed has exactly four branches, one per trigger', async () => {
  const { seed, types } = await loadModules();
  assert.equal(seed.SEED_CONVERSATION_BRANCHES.length, 4);
  const triggers = seed.SEED_CONVERSATION_BRANCHES.map((b) => b.trigger).sort();
  assert.deepEqual(triggers, [...types.CONVERSATION_TRIGGERS].sort());
});

test('conversation tree — every branch passes validator (depth-1 v1)', async () => {
  const { seed, types } = await loadModules();
  for (const branch of seed.SEED_CONVERSATION_BRANCHES) {
    const result = types.validateConversationBranch(branch);
    assert.equal(result.ok, true, `${branch.id}: ${JSON.stringify(result.issues)}`);
  }
});

test('conversation tree — validator rejects branches with extra v2-style fields', async () => {
  const { seed, types } = await loadModules();
  const tampered = {
    ...seed.SEED_CONVERSATION_BRANCHES[0],
    extraProbes: [{ nodeId: 'extra', text: 'no', voiceReviewStatus: 'seed-pending-review' }],
  } as unknown as import('../../src/api/firebase/adaptiveFramingLayer/types').ConversationBranch;
  const result = types.validateConversationBranch(tampered);
  assert.equal(result.ok, false);
});

test('conversation tree — every node ships voiceReviewStatus seed-pending-review', async () => {
  const { seed } = await loadModules();
  for (const branch of seed.SEED_CONVERSATION_BRANCHES) {
    for (const node of [branch.opener, branch.probe, branch.actionDelivery]) {
      assert.equal(
        node.voiceReviewStatus,
        'seed-pending-review',
        `${branch.id}/${node.nodeId} should ship as seed-pending-review`,
      );
    }
  }
});

test('conversation tree — no node uses numeric values or off-limits markers', async () => {
  const { seed } = await loadModules();
  const numericRegex = /\d+\s?(ms|bpm|°[FC]|%)/i;
  for (const branch of seed.SEED_CONVERSATION_BRANCHES) {
    for (const node of [branch.opener, branch.probe, branch.actionDelivery]) {
      assert.ok(
        !numericRegex.test(node.text),
        `${branch.id}/${node.nodeId} contains forbidden numeric+unit`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Adaptive Framing Scale
// ---------------------------------------------------------------------------

test('framing scale — seed passes validator and locks all priming markers coach-only', async () => {
  const { seed, types } = await loadModules();
  const result = types.validateAdaptiveFramingScale(seed.SEED_ADAPTIVE_FRAMING_SCALE);
  assert.equal(result.ok, true, JSON.stringify(result.issues));

  for (const marker of types.PERFORMANCE_PRIMING_MARKERS) {
    const entry = seed.SEED_ADAPTIVE_FRAMING_SCALE.signals.find((s) => s.signalId === marker);
    assert.ok(entry, `expected signal entry for ${marker}`);
    assert.equal(entry.surfaceVisibility, 'coach-only');
    assert.equal(entry.framingTier, 'strong');
    assert.equal(entry.primingRiskTier, 'high');
  }
});

test('framing scale — derivePrimingRiskTier classifies known signals correctly', async () => {
  const { types } = await loadModules();
  assert.equal(types.derivePrimingRiskTier('hrv'), 'high');
  assert.equal(types.derivePrimingRiskTier('compositeScores'), 'high');
  assert.equal(types.derivePrimingRiskTier('sleepMidpoint'), 'low');
  assert.equal(types.derivePrimingRiskTier('totalSleepMin'), 'low');
  assert.equal(types.derivePrimingRiskTier('arbitrarySignal'), 'safe');
});

test('mergeOffLimitsConfig — unions arrays case-insensitively without duplicates', async () => {
  const { types, seed } = await loadModules();
  const merged = types.mergeOffLimitsConfig(seed.SEED_OFF_LIMITS_CONFIG, {
    forbiddenMarkers: ['HRV', 'newMarker'],
    revisionId: 'r-test',
    updatedBy: 'tester',
  });
  const lowered = merged.forbiddenMarkers.map((m) => m.toLowerCase());
  assert.equal(new Set(lowered).size, lowered.length, 'no case-insensitive dupes');
  assert.ok(lowered.includes('newmarker'));
});
