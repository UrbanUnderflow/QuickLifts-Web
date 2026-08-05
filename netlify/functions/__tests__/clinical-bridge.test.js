const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AuntEdnaClinicalBridge,
  DEFAULT_AUNTEDNA_BASE_URL,
  buildPulseCallbackUrl,
  createClinicalBridge,
  normalizeCreateEscalationResult,
  resolveClinicalBridgeConfig,
} = require('../lib/clinical-bridge');

function withEnv(overrides, fn) {
  const original = {};
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('resolveClinicalBridgeConfig defaults to the partner API and fails closed without a key', () => {
  withEnv({
    CLINICAL_BRIDGE_PROVIDER: undefined,
    CLINICAL_PROVIDER: undefined,
    CLINICAL_BRIDGE_BASE_URL: undefined,
    AUNTEDNA_PARTNER_API_URL: undefined,
    AUNTEDNA_API_URL: undefined,
    CLINICAL_BRIDGE_API_KEY: undefined,
    AUNTEDNA_API_KEY: undefined,
  }, () => {
    const config = resolveClinicalBridgeConfig();
    assert.equal(config.provider, 'auntedna');
    assert.equal(config.baseUrl, DEFAULT_AUNTEDNA_BASE_URL);
    assert.equal(config.hasApiKey, false);
    assert.equal(config.credentialMode, 'missing');
  });
});

test('buildPulseCallbackUrl prefers explicit clinical callback URL', () => {
  withEnv({
    CLINICAL_BRIDGE_CALLBACK_URL: 'https://example.test/.netlify/functions/clinical-callback',
    PULSE_DEFAULT_CALLBACK_URL: undefined,
  }, () => {
    assert.equal(buildPulseCallbackUrl(), 'https://example.test/.netlify/functions/clinical-callback');
  });
});

test('createClinicalBridge returns the AuntEdna bridge for the current provider', () => {
  const bridge = createClinicalBridge({
    provider: 'auntedna',
    baseUrl: DEFAULT_AUNTEDNA_BASE_URL,
    apiKey: '',
    hasApiKey: false,
    timeoutMs: 1000,
  });
  assert.equal(bridge instanceof AuntEdnaClinicalBridge, true);
});

test('createEscalation rejects a missing credential instead of returning simulated success', async () => {
  const bridge = new AuntEdnaClinicalBridge({
    provider: 'auntedna',
    baseUrl: DEFAULT_AUNTEDNA_BASE_URL,
    apiKey: '',
    hasApiKey: false,
    credentialMode: 'missing',
    timeoutMs: 1000,
  });

  await assert.rejects(
    bridge.createEscalation({ escalationRecordId: 'pulse-escalation-12345', tier: 3 }),
    (error) => error?.code === 'CLINICAL_BRIDGE_API_KEY_MISSING',
  );
});

test('createEscalation returns a real provider response and sends required headers', async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({
      success: true,
      data: { escalationId: 'ae-case-real-1', status: 'received' },
      requestId: 'req-real-1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const bridge = new AuntEdnaClinicalBridge({
      provider: 'auntedna',
      baseUrl: DEFAULT_AUNTEDNA_BASE_URL,
      apiKey: 'ae_pk_test_example',
      hasApiKey: true,
      credentialMode: 'test',
      timeoutMs: 1000,
    });
    const result = await bridge.createEscalation({
      escalationRecordId: 'pulse-escalation-12345',
      tier: 3,
    });

    assert.equal(result.success, true);
    assert.equal(result.escalationId, 'ae-case-real-1');
    assert.equal(result.status, 'received');
    assert.equal(captured.url, `${DEFAULT_AUNTEDNA_BASE_URL}/escalations`);
    assert.equal(captured.options.headers.Authorization, 'Bearer ae_pk_test_example');
    assert.equal(captured.options.headers['X-Pulse-Integration'], 'true');
  } finally {
    global.fetch = originalFetch;
  }
});

test('HTTP failures cannot be normalized into clinical success', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    success: true,
    data: { status: 'received' },
  }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  try {
    const bridge = new AuntEdnaClinicalBridge({
      provider: 'auntedna',
      baseUrl: DEFAULT_AUNTEDNA_BASE_URL,
      apiKey: 'ae_pk_test_example',
      hasApiKey: true,
      credentialMode: 'test',
      timeoutMs: 1000,
    });
    const result = await bridge.createEscalation({ escalationRecordId: 'esc-500', tier: 3 });
    assert.equal(result.success, false);
    assert.equal(result.ok, false);
    assert.equal(result.httpStatus, 500);
  } finally {
    global.fetch = originalFetch;
  }
});

test('an error-only provider envelope cannot be normalized into clinical success', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    error: { code: 'PARTNER_REJECTED', message: 'Request rejected.' },
    requestId: 'req-rejected-1',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const bridge = new AuntEdnaClinicalBridge({
      provider: 'auntedna',
      baseUrl: DEFAULT_AUNTEDNA_BASE_URL,
      apiKey: 'ae_pk_test_example',
      hasApiKey: true,
      credentialMode: 'test',
      timeoutMs: 1000,
    });
    const result = await bridge.createEscalation({ escalationRecordId: 'esc-error-envelope', tier: 3 });
    assert.equal(result.success, false);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PARTNER_REJECTED');
  } finally {
    global.fetch = originalFetch;
  }
});

test('a bare 2xx object outside the provider envelope cannot become clinical success', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  try {
    const bridge = new AuntEdnaClinicalBridge({
      provider: 'auntedna',
      baseUrl: DEFAULT_AUNTEDNA_BASE_URL,
      apiKey: 'ae_pk_test_example',
      hasApiKey: true,
      credentialMode: 'test',
      timeoutMs: 1000,
    });
    const result = await bridge.upsertAthlete({ externalId: 'athlete-envelope-check' });
    assert.equal(result.success, false);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'INVALID_RESPONSE_ENVELOPE');
  } finally {
    global.fetch = originalFetch;
  }
});

test('normalizeCreateEscalationResult accepts a real provider caseId', () => {
  const normalized = normalizeCreateEscalationResult({
    success: true,
    data: { caseId: 'ae-case-42', escalationStatus: 'received' },
  });

  assert.equal(normalized.escalationId, 'ae-case-42');
  assert.equal(normalized.status, 'received');
});
