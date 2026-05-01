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

const loadModule = async () => {
  installFirebaseEnv();
  return import('../../src/api/anthropic/serverBridge');
};

const buildMockClient = (response: any, opts: { onCall?: (params: any) => void; throwError?: Error } = {}) => ({
  messages: {
    create: async (params: any) => {
      opts.onCall?.(params);
      if (opts.throwError) throw opts.throwError;
      return response;
    },
  },
});

const buildSuccessResponse = (text: string) => ({
  id: 'msg_test',
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 20 },
});

const buildToolUseResponse = (toolName: string, input: unknown) => ({
  id: 'msg_test',
  content: [{ type: 'tool_use', name: toolName, input }],
  stop_reason: 'tool_use',
  usage: { input_tokens: 10, output_tokens: 20 },
});

// ──────────────────────────────────────────────────────────────────────────────
// Validation gate
// ──────────────────────────────────────────────────────────────────────────────

test('callAnthropic — rejects unknown featureId', async () => {
  const mod = await loadModule();
  await assert.rejects(
    mod.callAnthropic(
      { featureId: 'doesNotExist', system: 's', messages: [{ role: 'user', content: 'hi' }] },
      { client: buildMockClient(buildSuccessResponse('ok')) },
    ),
    (err) => err instanceof mod.ServerBridgeFeatureNotRegisteredError,
  );
});

test('callAnthropic — rejects forbidden model (e.g. gpt-* attempted on anthropic feature)', async () => {
  const mod = await loadModule();
  await assert.rejects(
    mod.callAnthropic(
      {
        featureId: 'noraAthleteTranslation',
        model: 'gpt-4o',
        system: 's',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { client: buildMockClient(buildSuccessResponse('ok')) },
    ),
    (err) => err instanceof mod.ServerBridgeForbiddenModelError,
  );
});

test('callAnthropic — accepts current Sonnet 4.6 + Haiku 4.5 model ids', async () => {
  const mod = await loadModule();
  for (const model of ['claude-sonnet-4-6', 'claude-haiku-4-5']) {
    const result = await mod.callAnthropic(
      {
        featureId: 'noraAthleteTranslation',
        model,
        system: 's',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { client: buildMockClient(buildSuccessResponse('ok')) },
    );
    assert.equal(result.text, 'ok');
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Token cap enforcement
// ──────────────────────────────────────────────────────────────────────────────

test('resolveEffectiveMaxTokens — caller request capped at feature.maxTokens', async () => {
  const mod = await loadModule();
  const feature = mod.NORA_ATHLETE_TRANSLATION ?? null;
  assert.ok(feature || true); // feature import optional in this test

  // Re-import via featureRouting since serverBridge doesn't re-export it.
  const routing = await import('../../src/api/anthropic/featureRouting');
  const featureCfg = routing.NORA_ATHLETE_TRANSLATION;
  // featureCfg.maxTokens is 400. Caller asks for 99999. Should be clamped.
  const clamped = mod.resolveEffectiveMaxTokens(featureCfg, 99999);
  assert.equal(clamped, featureCfg.maxTokens);
});

test('resolveEffectiveMaxTokens — undefined caller defaults to feature.maxTokens', async () => {
  const mod = await loadModule();
  const routing = await import('../../src/api/anthropic/featureRouting');
  const featureCfg = routing.MACRA_MEAL_PLAN;
  const v = mod.resolveEffectiveMaxTokens(featureCfg, undefined);
  assert.equal(v, featureCfg.maxTokens);
});

test('callAnthropic — sends max_tokens capped at feature limit when caller exceeds', async () => {
  const mod = await loadModule();
  let observedMaxTokens = -1;
  const client = buildMockClient(buildSuccessResponse('ok'), {
    onCall: (params) => { observedMaxTokens = params.max_tokens; },
  });
  await mod.callAnthropic(
    {
      featureId: 'noraAthleteTranslation',
      maxTokens: 99999, // way above feature cap of 400
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
    },
    { client },
  );
  assert.equal(observedMaxTokens, 400);
});

// ──────────────────────────────────────────────────────────────────────────────
// Content extraction
// ──────────────────────────────────────────────────────────────────────────────

test('callAnthropic — concatenates all text blocks', async () => {
  const mod = await loadModule();
  const client = buildMockClient({
    id: 'msg_test',
    content: [
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'world' },
    ],
    stop_reason: 'end_turn',
    usage: { input_tokens: 5, output_tokens: 5 },
  });
  const result = await mod.callAnthropic(
    {
      featureId: 'noraAthleteTranslation',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
    },
    { client },
  );
  assert.equal(result.text, 'Hello world');
});

test('callAnthropic — extracts forced tool_use input by name', async () => {
  const mod = await loadModule();
  const expected = { meals: [{ title: 'M1', items: [] }] };
  const client = buildMockClient(buildToolUseResponse('submit_meal_plan', expected));
  const result = await mod.callAnthropic(
    {
      featureId: 'macraMealPlan',
      system: 's',
      messages: [{ role: 'user', content: 'plan' }],
      tools: [{ name: 'submit_meal_plan', description: 'd', input_schema: { type: 'object', properties: {} } as any }],
      toolChoice: { type: 'tool', name: 'submit_meal_plan' },
    },
    { client },
  );
  assert.deepEqual(result.toolUseInput, expected);
});

test('callAnthropic — toolUseInput undefined when no toolChoice given', async () => {
  const mod = await loadModule();
  const client = buildMockClient(buildSuccessResponse('plain'));
  const result = await mod.callAnthropic(
    {
      featureId: 'noraAthleteTranslation',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
    },
    { client },
  );
  assert.equal(result.toolUseInput, undefined);
});

// ──────────────────────────────────────────────────────────────────────────────
// Audit log
// ──────────────────────────────────────────────────────────────────────────────

test('callAnthropic — audit logger captures success entry', async () => {
  const mod = await loadModule();
  const entries: any[] = [];
  const auditLogger = { recordCall: async (e: any) => { entries.push(e); } };
  const client = buildMockClient(buildSuccessResponse('ok'));
  await mod.callAnthropic(
    {
      featureId: 'noraAthleteTranslation',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      callerContext: { caller: 'test' },
    },
    { client, auditLogger },
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].success, true);
  assert.equal(entries[0].featureId, 'noraAthleteTranslation');
  assert.equal(entries[0].model, 'claude-sonnet-4-6');
  assert.equal(entries[0].resolvedMaxTokens, 400);
  assert.equal(entries[0].stopReason, 'end_turn');
  assert.equal(entries[0].inputTokens, 10);
  assert.equal(entries[0].outputTokens, 20);
  assert.equal(entries[0].callerContext.caller, 'test');
});

test('callAnthropic — audit logger captures failure entry and rethrows', async () => {
  const mod = await loadModule();
  const entries: any[] = [];
  const auditLogger = { recordCall: async (e: any) => { entries.push(e); } };
  const client = buildMockClient(null, { throwError: new Error('upstream 503') });
  await assert.rejects(
    mod.callAnthropic(
      {
        featureId: 'noraAthleteTranslation',
        system: 's',
        messages: [{ role: 'user', content: 'hi' }],
      },
      { client, auditLogger },
    ),
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].success, false);
  assert.equal(entries[0].errorReasonExcerpt, 'upstream 503');
});

test('callAnthropic — audit logger errors are swallowed (do not shadow upstream errors)', async () => {
  const mod = await loadModule();
  const auditLogger = { recordCall: async () => { throw new Error('audit failed'); } };
  const client = buildMockClient(buildSuccessResponse('ok'));
  // Should not throw despite audit failure.
  const result = await mod.callAnthropic(
    {
      featureId: 'noraAthleteTranslation',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
    },
    { client, auditLogger },
  );
  assert.equal(result.text, 'ok');
});

// ──────────────────────────────────────────────────────────────────────────────
// buildAdminAuditLogger fallthrough
// ──────────────────────────────────────────────────────────────────────────────

test('buildAdminAuditLogger — writes shape includes recordedAt ISO', async () => {
  const mod = await loadModule();
  const recorded: any[] = [];
  const fakeFirestore = {
    collection: (name: string) => {
      assert.equal(name, mod.SERVER_BRIDGE_AUDIT_LOG_COLLECTION);
      return { add: async (doc: any) => { recorded.push(doc); return {}; } };
    },
  };
  const logger = mod.buildAdminAuditLogger(fakeFirestore);
  await logger.recordCall({
    featureId: 'noraAthleteTranslation',
    model: 'claude-sonnet-4-6',
    resolvedMaxTokens: 400,
    success: true,
    stopReason: 'end_turn',
    inputTokens: 10,
    outputTokens: 20,
    timestamp: 1700000000000,
  });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].featureId, 'noraAthleteTranslation');
  assert.equal(typeof recorded[0].recordedAt, 'string');
  assert.match(recorded[0].recordedAt, /^\d{4}-\d{2}-\d{2}T/);
});
