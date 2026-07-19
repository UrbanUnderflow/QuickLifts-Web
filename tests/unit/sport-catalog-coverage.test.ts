import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// CI gate for the Sports Intelligence catalog as the central sport
// configuration: every sport in the code-default catalog must have full
// scenario-archetype coverage, and the TS/Swift code-owned maps must not
// drift. Adding a sport to DEFAULT_PULSECHECK_SPORTS without updating the
// attached configurations fails here with instructions, instead of shipping
// a sport with silent generic fallbacks.
//
// Spec: PulseCheck/docs/specs/sport-scenario-packs-spec.md §3

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
  const [coverage, archetypes, insight, config] = await Promise.all([
    import('../../src/api/firebase/pulsecheckSportCoverage'),
    import('../../src/api/firebase/mentaltraining/sportScenarioArchetypes'),
    import('../../src/api/firebase/sportsInsightArchetypes'),
    import('../../src/api/firebase/pulsecheckSportConfig'),
  ]);
  return { coverage, archetypes, insight, config };
};

test('every code-default sport has deliberate scenario archetype coverage', async () => {
  const { coverage } = await loadModules();
  const report = coverage.buildSportCoverageReport();

  assert.ok(report.length > 0, 'catalog has sports');

  const uncovered = report.filter(
    (row: any) => row.scenarioSource === 'none' || row.scenarioSource === 'keywords',
  );
  assert.deepEqual(
    uncovered.map((row: any) => row.id),
    [],
    'Sports without deliberate scenario coverage: '
      + uncovered.map((row: any) => `${row.id} (${row.scenarioSource})`).join(', ')
      + '. Fix: add the sport id to SPORT_SCENARIO_ARCHETYPE_BY_SPORT_ID in '
      + 'sportScenarioArchetypes.ts AND to catalogScenarioDefaults in '
      + 'PulseCheck/Services/SportsIntelligenceReasoningLayer.swift (Swift mirror), '
      + 'or set scenarioArchetype on the catalog entry.',
  );
});

test('every code-default sport has deliberate insight archetype coverage', async () => {
  const { coverage } = await loadModules();
  const uncovered = coverage.buildSportCoverageReport().filter(
    (row: any) => row.insightSource === 'none' || row.insightSource === 'keywords',
  );
  assert.deepEqual(
    uncovered.map((row: any) => row.id),
    [],
    'Sports without deliberate insight coverage: '
      + uncovered.map((row: any) => `${row.id} (${row.insightSource})`).join(', ')
      + '. Fix: add the sport id to SPORT_INSIGHT_ARCHETYPE_BY_SPORT_ID in '
      + 'sportsInsightArchetypes.ts AND to catalogInsightDefaults in '
      + 'PulseCheck/Services/SportsIntelligenceReasoningLayer.swift (Swift mirror), '
      + 'or set insightArchetype on the catalog entry.',
  );
});

test('every code-default sport has positions and a name/emoji', async () => {
  const { coverage } = await loadModules();
  for (const row of coverage.buildSportCoverageReport()) {
    assert.ok(row.hasPositions, `sport ${row.id} has no positions`);
    assert.ok(row.name.trim().length > 0, `sport ${row.id} has no name`);
  }
});

test('code-owned maps have no orphan ids (every key exists in the catalog)', async () => {
  const { archetypes, insight, config } = await loadModules();
  const catalogIds = new Set(config.getDefaultPulseCheckSports().map((sport: any) => sport.id));
  for (const [label, map] of [
    ['scenario', archetypes.SPORT_SCENARIO_ARCHETYPE_BY_SPORT_ID],
    ['insight', insight.SPORT_INSIGHT_ARCHETYPE_BY_SPORT_ID],
  ] as const) {
    const orphans = Object.keys(map).filter((id) => !catalogIds.has(id));
    assert.deepEqual(orphans, [], `${label} map ids missing from catalog: ${orphans.join(', ')}`);
  }
});

test('coverage report enumerates known catalog-wide gaps without regressing', async () => {
  const { coverage } = await loadModules();
  const report = coverage.buildSportCoverageReport();
  // Not all attachments are complete today (e.g. some sports lack training
  // nuance). This test pins the CURRENT gap count so new sports cannot add
  // gaps unnoticed: if this fails with a higher number, a sport was added
  // without its attachments; if lower, update the number downward — progress.
  // Baseline as of 2026-07-18: 15 sports lack trainingNuance (all except
  // basketball, soccer, bodybuilding-physique). Ratchet this DOWN as nuance
  // is authored; never up.
  const gapCount = report.reduce((sum: number, row: any) => sum + row.gaps.length, 0);
  const sportsWithGaps = report.filter((row: any) => row.gaps.length > 0);
  assert.ok(
    gapCount <= 15,
    `catalog gap count grew to ${gapCount} (allowed 15). New/changed sports must ship `
      + 'with their attachments. Current gaps: '
      + sportsWithGaps.map((row: any) => `${row.id}: [${row.gaps.join('; ')}]`).join(' | '),
  );
});

test('TS and Swift code-owned archetype maps stay in sync', async (t) => {
  const { archetypes, insight } = await loadModules();
  const swiftPath = path.resolve(
    __dirname,
    '../../../PulseCheck/PulseCheck/Services/SportsIntelligenceReasoningLayer.swift',
  );
  if (!fs.existsSync(swiftPath)) {
    t.skip('PulseCheck repo not checked out beside QuickLifts-Web');
    return;
  }

  const swift = fs.readFileSync(swiftPath, 'utf8');
  const camelToRaw: Record<string, string> = { netRacket: 'net_racket' };

  const compareMap = (swiftName: string, swiftType: string, tsMap: Record<string, string>) => {
    const blockMatch = swift.match(new RegExp(
      `${swiftName}:\\s*\\[String:\\s*${swiftType}\\]\\s*=\\s*\\[([\\s\\S]*?)\\n\\s*\\]`,
    ));
    assert.ok(blockMatch, `${swiftName} block found in Swift mirror`);

    const swiftEntries = new Map<string, string>();
    for (const match of blockMatch![1].matchAll(/"([a-z0-9-]+)":\s*\.([a-zA-Z]+)/g)) {
      swiftEntries.set(match[1], match[2]);
    }

    assert.deepEqual(
      [...swiftEntries.keys()].sort(),
      Object.keys(tsMap).sort(),
      `${swiftName}: sport ids differ between TS map and Swift mirror`,
    );

    for (const [id, swiftCase] of swiftEntries) {
      const swiftRaw = camelToRaw[swiftCase] ?? swiftCase;
      assert.equal(
        swiftRaw,
        tsMap[id],
        `${swiftName}: archetype for '${id}' differs: Swift .${swiftCase} vs TS '${tsMap[id]}'`,
      );
    }
  };

  compareMap(
    'catalogScenarioDefaults',
    'SportScenarioArchetype',
    archetypes.SPORT_SCENARIO_ARCHETYPE_BY_SPORT_ID as Record<string, string>,
  );
  compareMap(
    'catalogInsightDefaults',
    'SportsInsightArchetype',
    insight.SPORT_INSIGHT_ARCHETYPE_BY_SPORT_ID as Record<string, string>,
  );
});
