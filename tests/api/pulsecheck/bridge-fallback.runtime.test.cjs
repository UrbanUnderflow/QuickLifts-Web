// Runtime smoke for the openai-bridge dual-path flow.
//
// Exercises the same code path the bridge uses for `pulsecheckSportIntelligence`:
// 1) translate OpenAI body → Anthropic Messages
// 2) Anthropic call returns 503 (synthetic failure)
// 3) callWithFallback fires OpenAI proxy as fallback
// 4) Logger records a fallback entry with migrationModeId
// 5) Final response carries the OpenAI-shaped payload
//
// This is the minimum smoke that proves dual-path actually works under failure.

const test = require('node:test');
const assert = require('node:assert/strict');

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
    if (!process.env[key]) process.env[key] = value;
  }
};

const loadModules = async () => {
  installFirebaseEnv();
  const [routing, fallback, translation] = await Promise.all([
    import('../../../src/api/anthropic/featureRouting.ts'),
    import('../../../src/api/anthropic/callWithFallback.ts'),
    import('../../../src/api/anthropic/bridgeTranslation.ts'),
  ]);
  return { routing, fallback, translation };
};

const buildSportIntelligenceBody = () => ({
  model: 'gpt-4o',
  temperature: 0.25,
  max_tokens: 6500,
  response_format: { type: 'json_object' },
  messages: [
    {
      role: 'system',
      content:
        'You are PulseCheck Sports Intelligence architect. Return exactly one JSON object only.',
    },
    {
      role: 'user',
      content: 'Build a basketball sport configuration with positions, attributes, and metrics.',
    },
  ],
});

const okOpenAIResponse = (jsonText) => ({
  ok: true,
  status: 200,
  json: async () => ({
    id: 'chatcmpl-test',
    choices: [{ index: 0, message: { role: 'assistant', content: jsonText }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  }),
  text: async () => '',
});

const failingAnthropicResponse = () => ({
  ok: false,
  status: 503,
  text: async () => '{"type":"error","error":{"type":"overloaded_error","message":"upstream busy"}}',
  json: async () => ({ type: 'error' }),
});

test('dual-path — Anthropic 503 falls back to OpenAI and logs migrationModeId', async () => {
  const { routing, fallback, translation } = await loadModules();

  const feature = routing.PULSECHECK_SPORT_INTELLIGENCE;
  assert.equal(feature.fallbackProvider, 'openai');
  assert.equal(feature.migrationModeId, 'pulsecheck-dual-path-v1');

  const sportPayload = JSON.stringify({ sport: { positions: [], attributes: [], metrics: [] } });

  // Capture every fetch call made by the dual-path flow.
  const fetchCalls = [];
  const fakeFetch = async (url, init) => {
    fetchCalls.push({ url: String(url), method: init?.method || 'GET', body: init?.body });
    if (String(url).includes('api.anthropic.com')) {
      return failingAnthropicResponse();
    }
    if (String(url).includes('api.openai.com')) {
      return okOpenAIResponse(sportPayload);
    }
    throw new Error(`Unexpected fetch target in test: ${url}`);
  };

  // Capture fallback log writes (mirrors what buildAdminFallbackLogger would do).
  const loggedEntries = [];
  const logger = {
    async logFallback(entry) {
      loggedEntries.push(entry);
    },
  };

  // Invoke the same shape the bridge uses internally.
  const openaiBody = buildSportIntelligenceBody();
  const fallbackResult = await fallback.callWithFallback({
    feature,
    anthropicCall: async () => {
      const { request, usesForcedTool } = translation.translateOpenAIToAnthropic(openaiBody, feature.model);
      const resp = await fakeFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'fake-anthropic-key',
          'anthropic-version': translation.ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify(request),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Anthropic upstream ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const data = await resp.json();
      return translation.translateAnthropicToOpenAI(data, usesForcedTool);
    },
    openaiCall: async () => {
      const resp = await fakeFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer fake-openai-key',
        },
        body: JSON.stringify(openaiBody),
      });
      if (!resp.ok) throw new Error(`OpenAI upstream ${resp.status}`);
      return resp.json();
    },
    logger,
    uid: 'test-admin-uid',
  });

  // 1. Both providers were attempted in order: Anthropic first, then OpenAI.
  assert.equal(fetchCalls.length, 2);
  assert.match(fetchCalls[0].url, /api\.anthropic\.com/);
  assert.match(fetchCalls[1].url, /api\.openai\.com/);

  // 2. Anthropic request body was correctly translated (system extracted, model swapped).
  const anthropicRequest = JSON.parse(fetchCalls[0].body);
  assert.equal(anthropicRequest.model, feature.model);
  assert.equal(anthropicRequest.max_tokens, 6500);
  assert.match(anthropicRequest.system, /Sports Intelligence architect/);
  assert.equal(anthropicRequest.messages.length, 1);
  assert.equal(anthropicRequest.messages[0].role, 'user');
  assert.ok(Array.isArray(anthropicRequest.tools), 'forced tool-use because response_format was json_object');
  assert.equal(anthropicRequest.tool_choice.name, 'submit_response');

  // 3. Fallback fired and result came from OpenAI in OpenAI-shaped envelope.
  assert.equal(fallbackResult.providerUsed, 'openai');
  assert.equal(fallbackResult.fallbackTriggered, true);
  assert.match(fallbackResult.errorReason || '', /Anthropic upstream 503/);
  assert.equal(fallbackResult.result.choices[0].message.content, sportPayload);

  // 4. Fallback log was written with the right featureId + migrationModeId.
  assert.equal(loggedEntries.length, 1);
  const entry = loggedEntries[0];
  assert.equal(entry.featureId, 'pulsecheckSportIntelligence');
  assert.equal(entry.migrationModeId, 'pulsecheck-dual-path-v1');
  assert.equal(entry.uid, 'test-admin-uid');
  assert.match(entry.errorReason, /Anthropic upstream 503/);
  assert.ok(typeof entry.timestamp === 'number');
});

test('dual-path — Anthropic happy path returns OpenAI-shaped JSON without fallback', async () => {
  const { routing, fallback, translation } = await loadModules();

  const feature = routing.PULSECHECK_SPORT_INTELLIGENCE;
  const expectedJson = JSON.stringify({ sport: { id: 'soccer', positions: ['gk', 'cb'] } });

  const fakeFetch = async (url) => {
    if (String(url).includes('api.anthropic.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'msg_test',
          model: feature.model,
          stop_reason: 'tool_use',
          content: [
            { type: 'tool_use', name: 'submit_response', input: JSON.parse(expectedJson) },
          ],
          usage: { input_tokens: 50, output_tokens: 80 },
        }),
        text: async () => '',
      };
    }
    throw new Error(`OpenAI should not be called on happy path: ${url}`);
  };

  const loggedEntries = [];
  const logger = { async logFallback(entry) { loggedEntries.push(entry); } };

  const openaiBody = buildSportIntelligenceBody();
  const result = await fallback.callWithFallback({
    feature,
    anthropicCall: async () => {
      const { request, usesForcedTool } = translation.translateOpenAIToAnthropic(openaiBody, feature.model);
      const resp = await fakeFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      if (!resp.ok) throw new Error('should not happen');
      return translation.translateAnthropicToOpenAI(await resp.json(), usesForcedTool);
    },
    openaiCall: async () => { throw new Error('should not be called'); },
    logger,
    uid: 'test-admin-uid',
  });

  assert.equal(result.providerUsed, 'anthropic');
  assert.equal(result.fallbackTriggered, false);
  // Forced tool-use payload is JSON-stringified into choices[0].message.content
  // exactly the way Sport Intelligence callers expect.
  assert.equal(result.result.choices[0].message.content, expectedJson);
  assert.equal(result.result.choices[0].finish_reason, 'tool_use');
  // No fallback log should have been written on the happy path.
  assert.equal(loggedEntries.length, 0);
});
