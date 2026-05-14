import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('System Overview documents the training-load evidence boundary', () => {
  const manifest = read('src/content/system-overview/manifest.ts');
  const trainingLoadSpec = read(
    'src/components/admin/system-overview/PulseCheckTrainingLoadDetectionSpecTab.tsx'
  );
  const sessionSpec = read(
    'src/components/admin/system-overview/PulseCheckSessionDetectionMatchingSpecTab.tsx'
  );
  const contextualSpec = read(
    'src/components/admin/system-overview/PulseCheckContextualSportsDetectionEngineSpecTab.tsx'
  );
  const plainTextBundle = read(
    'src/components/admin/system-overview/sportsIntelligencePlainTextBundle.ts'
  );

  for (const id of [
    'pulsecheck-training-load-detection-spec',
    'pulsecheck-session-detection-matching',
    'pulsecheck-contextual-sports-detection-engine',
  ]) {
    assert.match(manifest, new RegExp(`id:\\s*'${id}'`), `${id} must remain registered`);
  }

  assert.match(trainingLoadSpec, /No Timestamp, No Session Card/);
  assert.match(trainingLoadSpec, /Evidence Boundary: Daily Rollup vs\. Session Candidate/);
  assert.match(trainingLoadSpec, /Aggregate daily activity evidence can never produce a training-load card/);
  assert.match(trainingLoadSpec, /No timestamped evidence, no session card\. No fake precision\./);

  assert.match(sessionSpec, /Session-Candidate Gate/);
  assert.match(sessionSpec, /No Window, No Session/);
  assert.match(sessionSpec, /Rejected origin: daily rollup only/);

  assert.match(contextualSpec, /Evidence To Meaning Boundary/);
  assert.match(contextualSpec, /Daily Evidence Is Not Session Truth/);
  assert.match(contextualSpec, /Context clue only/);

  assert.match(plainTextBundle, /Session-Candidate Gate/);
  assert.match(plainTextBundle, /Evidence To Meaning Boundary/);
  assert.match(plainTextBundle, /daily rollups remain evidence only/i);
});
