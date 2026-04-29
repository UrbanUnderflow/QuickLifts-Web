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
  const [routing, fallback] = await Promise.all([
    import('../../src/api/anthropic/featureRouting'),
    import('../../src/api/anthropic/callWithFallback'),
  ]);
  return { routing, fallback };
};

// ---------------------------------------------------------------------------
// Feature Routing
// ---------------------------------------------------------------------------

test('featureRouting — every feature id is unique', async () => {
  const { routing } = await loadModules();
  const ids = routing.FEATURE_ROUTING_CONFIGS.map((c) => c.featureId);
  assert.equal(new Set(ids).size, ids.length, 'duplicate featureId in routing config');
});

test('featureRouting — every model matches the bridge gate pattern', async () => {
  const { routing } = await loadModules();
  for (const config of routing.FEATURE_ROUTING_CONFIGS) {
    assert.ok(
      routing.ANTHROPIC_MODEL_PATTERN.test(config.model),
      `${config.featureId} model '${config.model}' does not match ANTHROPIC_MODEL_PATTERN`,
    );
  }
});

test('featureRouting — model gate rejects forbidden / OpenAI models', async () => {
  const { routing } = await loadModules();
  const forbidden = ['gpt-4o', 'gpt-4o-mini', 'gpt-5', 'claude-3-5-sonnet-20240620', 'claude-2.1'];
  for (const id of forbidden) {
    assert.equal(
      routing.ANTHROPIC_MODEL_PATTERN.test(id),
      false,
      `bridge gate must reject '${id}'`,
    );
  }
});

test('featureRouting — model gate accepts current Sonnet 4.6 + Haiku 4.5 ids', async () => {
  const { routing } = await loadModules();
  for (const id of [
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-haiku-4-5-20251001',
    'claude-opus-4-7',
  ]) {
    assert.ok(routing.ANTHROPIC_MODEL_PATTERN.test(id), `${id} should be allowed`);
  }
});

test('featureRouting — every featureId has a matching FEATURE_LIMITS entry', async () => {
  const { routing } = await loadModules();
  for (const config of routing.FEATURE_ROUTING_CONFIGS) {
    const limit = routing.ANTHROPIC_FEATURE_LIMITS[config.featureId];
    assert.ok(limit, `ANTHROPIC_FEATURE_LIMITS missing entry for ${config.featureId}`);
    assert.equal(
      limit.maxTokens,
      config.maxTokens,
      `${config.featureId} maxTokens drift between routing config and FEATURE_LIMITS`,
    );
  }
});

test('featureRouting — Macra full-cutover features have no fallbackProvider', async () => {
  const { routing } = await loadModules();
  for (const featureId of ['noraNutritionChat', 'macraMealPlan', 'macraDailyInsight']) {
    const config = routing.getFeatureRouting(featureId);
    assert.ok(config);
    assert.equal(config.fallbackProvider, undefined, `${featureId} must not have fallbackProvider`);
    assert.equal(config.migrationModeId, 'macra-full-cutover-v1');
  }
});

test('featureRouting — PulseCheck dual-path features fall back to OpenAI', async () => {
  const { routing } = await loadModules();
  for (const featureId of [
    'pulsecheckProtocolPracticeEval',
    'pulsecheckSportIntelligence',
    'generateCaption',
  ]) {
    const config = routing.getFeatureRouting(featureId);
    assert.ok(config);
    assert.equal(config.fallbackProvider, 'openai', `${featureId} should fall back to openai`);
    assert.equal(config.migrationModeId, 'pulsecheck-dual-path-v1');
  }
});

// ---------------------------------------------------------------------------
// callWithFallback
// ---------------------------------------------------------------------------

test('callWithFallback — happy path uses anthropic, no fallback fired', async () => {
  const { routing, fallback } = await loadModules();
  const feature = routing.PULSECHECK_PROTOCOL_PRACTICE_EVAL;

  const result = await fallback.callWithFallback({
    feature,
    anthropicCall: async () => 'anthropic-result',
    openaiCall: async () => {
      throw new Error('should not be called');
    },
  });

  assert.equal(result.providerUsed, 'anthropic');
  assert.equal(result.fallbackTriggered, false);
  assert.equal(result.result, 'anthropic-result');
});

test('callWithFallback — anthropic error triggers OpenAI fallback and logs migrationModeId', async () => {
  const { routing, fallback } = await loadModules();
  const feature = routing.PULSECHECK_PROTOCOL_PRACTICE_EVAL;

  const logged: any[] = [];
  const logger = { logFallback: async (entry: any) => { logged.push(entry); } };

  const result = await fallback.callWithFallback({
    feature,
    anthropicCall: async () => { throw new Error('anthropic upstream 500'); },
    openaiCall: async () => 'openai-fallback-result',
    logger,
    uid: 'test-uid',
  });

  assert.equal(result.providerUsed, 'openai');
  assert.equal(result.fallbackTriggered, true);
  assert.equal(result.result, 'openai-fallback-result');
  assert.match(result.errorReason || '', /anthropic upstream 500/);

  assert.equal(logged.length, 1);
  assert.equal(logged[0].featureId, 'pulsecheckProtocolPracticeEval');
  assert.equal(logged[0].migrationModeId, 'pulsecheck-dual-path-v1');
  assert.equal(logged[0].uid, 'test-uid');
  assert.match(logged[0].errorReason, /anthropic upstream 500/);
  assert.ok(typeof logged[0].timestamp === 'number');
});

test('callWithFallback — feature without fallbackProvider rethrows anthropic error', async () => {
  const { routing, fallback } = await loadModules();
  const feature = routing.MACRA_MEAL_PLAN;

  await assert.rejects(
    fallback.callWithFallback({
      feature,
      anthropicCall: async () => { throw new Error('hard failure'); },
      openaiCall: async () => 'never-called',
    }),
    /hard failure/,
  );
});

test('callWithFallback — rejects misconfigured feature where provider is not anthropic', async () => {
  const { routing, fallback } = await loadModules();
  const badFeature = { ...routing.PULSECHECK_PROTOCOL_PRACTICE_EVAL, provider: 'openai' as const };

  await assert.rejects(
    fallback.callWithFallback({
      feature: badFeature,
      anthropicCall: async () => 'a',
      openaiCall: async () => 'b',
    }),
    /provider === 'anthropic'/,
  );
});

test('callWithFallback — does not log when no logger is passed', async () => {
  const { routing, fallback } = await loadModules();
  const feature = routing.PULSECHECK_PROTOCOL_PRACTICE_EVAL;

  const result = await fallback.callWithFallback({
    feature,
    anthropicCall: async () => { throw new Error('boom'); },
    openaiCall: async () => 'fallback-ok',
  });
  assert.equal(result.providerUsed, 'openai');
  assert.equal(result.fallbackTriggered, true);
});

test('buildAdminFallbackLogger — swallows logging errors', async () => {
  const { fallback } = await loadModules();
  const broken = {
    collection: () => ({
      add: async () => { throw new Error('firestore unavailable'); },
    }),
  };
  const logger = fallback.buildAdminFallbackLogger(broken);
  // Should not throw despite the underlying firestore failure.
  await logger.logFallback({
    featureId: 'pulsecheckProtocolPracticeEval',
    migrationModeId: 'pulsecheck-dual-path-v1',
    errorReason: 'test',
    timestamp: Date.now(),
  });
});
