const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const sportsIntelligenceSections = [
  {
    id: 'pulsecheck-sports-intelligence-layer-spec',
    component: 'PulseCheckSportsIntelligenceLayerSpecTab',
    label: 'Sports Intelligence Layer',
  },
  {
    id: 'pulsecheck-sports-intelligence-aggregation-inference-contract',
    component: 'PulseCheckSportsIntelligenceAggregationInferenceContractTab',
    label: 'Aggregation + Inference Contract',
  },
  {
    id: 'pulsecheck-sports-intelligence-mock-report-baselines',
    component: 'PulseCheckSportsIntelligenceMockReportBaselinesTab',
    label: 'Report Outlines + Coach Mocks',
  },
  {
    id: 'pulsecheck-nora-context-capture',
    component: 'PulseCheckNoraContextCaptureSpecTab',
    label: 'Nora Context Capture',
  },
  {
    id: 'pulsecheck-session-detection-matching',
    component: 'PulseCheckSessionDetectionMatchingSpecTab',
    label: 'Session Detection + Matching',
  },
  {
    id: 'pulsecheck-sport-load-model',
    component: 'PulseCheckSportLoadModelSpecTab',
    label: 'Sport Load Model',
  },
];

test('Sports Intelligence companion docs are registered in the System Overview manifest', () => {
  const manifestSource = read('src/content/system-overview/manifest.ts');

  for (const section of sportsIntelligenceSections) {
    assert.match(manifestSource, new RegExp(`id:\\s*'${section.id}'`), `${section.id} must be in the manifest`);
    assert.match(manifestSource, new RegExp(`label:\\s*'${section.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), `${section.id} must keep its expected label`);
  }

  for (const section of sportsIntelligenceSections.slice(1)) {
    const sectionBlock = new RegExp(
      `id:\\s*'${section.id}'[\\s\\S]*?parentSectionId:\\s*'pulsecheck-sports-intelligence-layer-spec'`
    );
    assert.match(manifestSource, sectionBlock, `${section.id} must remain inside the Sports Intelligence layer tab family`);
  }
});

test('Sports Intelligence companion docs are wired to System Overview tabs', () => {
  const pageSource = read('src/pages/admin/systemOverview.tsx');

  for (const section of sportsIntelligenceSections) {
    assert.match(pageSource, new RegExp(`import\\s+${section.component}\\s+from`), `${section.component} must be imported`);
    assert.match(pageSource, new RegExp(`case\\s+"${section.id}"`), `${section.id} must have a switch case`);
    assert.match(pageSource, new RegExp(`return\\s+<${section.component}\\s*/>`), `${section.component} must render for ${section.id}`);
  }
});

test('system overview validator still passes with Sports Intelligence sections present', () => {
  const result = spawnSync('node', ['scripts/validate-system-overview-content.js'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(
    result.status,
    0,
    `system overview validator failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
  assert.match(result.stdout, /System overview content validation passed/);
});
