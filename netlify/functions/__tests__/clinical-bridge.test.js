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

test('resolveClinicalBridgeConfig defaults to the AuntEdna partner API and mock mode without a key', () => {
  withEnv({
    CLINICAL_BRIDGE_PROVIDER: undefined,
    CLINICAL_PROVIDER: undefined,
    CLINICAL_BRIDGE_BASE_URL: undefined,
    AUNTEDNA_PARTNER_API_URL: undefined,
    AUNTEDNA_API_URL: undefined,
    CLINICAL_BRIDGE_API_KEY: undefined,
    AUNTEDNA_API_KEY: undefined,
    CLINICAL_BRIDGE_MOCK: undefined,
    AUNTEDNA_MOCK: undefined,
  }, () => {
    const config = resolveClinicalBridgeConfig();
    assert.equal(config.provider, 'auntedna');
    assert.equal(config.baseUrl, DEFAULT_AUNTEDNA_BASE_URL);
    assert.equal(config.mock, true);
    assert.equal(config.hasApiKey, false);
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
    mock: true,
    explicitMock: true,
    hasApiKey: false,
  });
  assert.equal(bridge instanceof AuntEdnaClinicalBridge, true);
});

test('mock createEscalation normalizes provider-specific ids into the bridge contract', async () => {
  const bridge = new AuntEdnaClinicalBridge({
    provider: 'auntedna',
    baseUrl: DEFAULT_AUNTEDNA_BASE_URL,
    apiKey: '',
    mock: true,
    explicitMock: true,
    hasApiKey: false,
  });

  const result = await bridge.createEscalation({
    escalationRecordId: 'pulse-escalation-12345',
    tier: 3,
  });

  assert.equal(result.success, true);
  assert.equal(result.mock, true);
  assert.equal(result.escalationId, 'ae-pulse-escala');
  assert.equal(result.status, 'assigned');
});

test('normalizeCreateEscalationResult accepts caseId and fallback ids', () => {
  const normalized = normalizeCreateEscalationResult({
    success: true,
    data: { caseId: 'ae-case-42', escalationStatus: 'received' },
  }, 'fallback-id');

  assert.equal(normalized.escalationId, 'ae-case-42');
  assert.equal(normalized.status, 'received');
});
