const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('/test exposes one protected EDNA Integration Test tile', () => {
  const source = read('src/pages/test/index.tsx');

  assert.match(source, /<AdminRouteGuard>/);
  assert.equal((source.match(/<TestToolCard/g) || []).length, 1);
  assert.match(source, /title="EDNA Integration Test"/);
  assert.match(source, /href="\/test\/edna-integration"/);
});

test('EDNA harness has chat scenarios, manual endpoints, and an initially empty log', () => {
  const route = read('src/pages/test/edna-integration.tsx');
  const source = read('src/pages/admin/clinicalTestUnit.tsx');

  assert.match(route, /clinicalTestUnit/);
  assert.match(source, /Chat Scenarios/);
  assert.match(source, /Manual Endpoints/);
  assert.match(source, /Tier 2: persistent distress/);
  assert.match(source, /Tier 3: immediate safety/);
  assert.match(source, /useState<ManualLogEntry\[\]>\(\[\]\)/);

  for (const endpoint of [
    'GET /health',
    'POST /athletes',
    'POST /escalations',
    'GET /athletes/{id}/status',
    'POST /escalations/{id}/resolve',
    'GET /athletes/{id}/care-state',
  ]) {
    assert.ok(source.includes(`endpoint: '${endpoint}'`), `missing endpoint button: ${endpoint}`);
  }
});

test('harness response paths do not expose a mock-mode branch', () => {
  const clientSource = read('src/api/clinical-bridge/index.ts');
  const pageSource = read('src/pages/admin/clinicalTestUnit.tsx');
  const bridgeSource = read('netlify/functions/lib/clinical-bridge.js');
  const smokeSource = read('netlify/functions/clinical-bridge-smoke-test.js');

  assert.match(clientSource, /Authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(pageSource, /mock mode|mock response|fallback response/i);
  assert.doesNotMatch(bridgeSource, /CLINICAL_BRIDGE_MOCK|AUNTEDNA_MOCK/);
  assert.doesNotMatch(smokeSource, /CLINICAL_BRIDGE_MOCK|AUNTEDNA_MOCK/);
  assert.match(smokeSource, /Configure a MANAS test key before running synthetic writes/);
});
