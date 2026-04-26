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

const loadSportsIntelligenceModules = async () => {
  installFirebaseEnv();
  const [coachReports, sportConfig] = await Promise.all([
    import('../../src/api/firebase/pulsecheckCoachReports'),
    import('../../src/api/firebase/pulsecheckSportConfig'),
  ]);
  return { coachReports, sportConfig };
};

test('enforceLanguagePosture catches universal and sport-localized banned phrases', async () => {
  const { coachReports, sportConfig } = await loadSportsIntelligenceModules();
  const basketball = sportConfig.getDefaultPulseCheckSports().find((sport) => sport.id === 'basketball');
  assert.ok(basketball);

  const result = coachReports.enforceLanguagePosture(
    {
      topLine: {
        whatChanged: 'ACWR is high this week.',
        firstAction: 'Avoid Generic hustle advice and use possession-level reset language.',
      },
    },
    basketball
  );

  assert.equal(result.passed, false);
  assert.ok(result.violations.some((violation) => violation.phrase === 'ACWR' && violation.source === 'universal'));
  assert.ok(
    result.violations.some(
      (violation) => violation.phrase === 'Generic hustle advice' && violation.source === 'sport'
    )
  );
});

test('enforceLanguagePosture catches every universal coach-surface banned term', async () => {
  const { coachReports, sportConfig } = await loadSportsIntelligenceModules();
  const basketball = sportConfig.getDefaultPulseCheckSports().find((sport) => sport.id === 'basketball');
  assert.ok(basketball);

  for (const phrase of coachReports.PULSECHECK_COACH_LANGUAGE_UNIVERSAL_BANLIST) {
    const result = coachReports.enforceLanguagePosture(
      {
        topLine: {
          whatChanged: `Internal reviewer term leaked: ${phrase}.`,
          who: 'Test athlete',
          firstAction: 'Keep this out of the coach report.',
        },
      },
      basketball
    );

    assert.equal(result.passed, false, `${phrase} should fail the language audit`);
    assert.ok(
      result.violations.some(
        (violation) => violation.phrase.toLowerCase() === String(phrase).toLowerCase() && violation.source === 'universal'
      ),
      `${phrase} should be reported as a universal violation`
    );
  }
});

test('enforceLanguagePosture audits coachSurface only when reviewerOnly evidence is present', async () => {
  const { coachReports, sportConfig } = await loadSportsIntelligenceModules();
  const basketball = sportConfig.getDefaultPulseCheckSports().find((sport) => sport.id === 'basketball');
  assert.ok(basketball);

  const result = coachReports.enforceLanguagePosture(
    {
      coachSurface: {
        topLine: 'Keep the walkthrough short and use possession-level reset language.',
      },
      reviewerOnly: {
        evidence: {
          confidenceTier: 'high_confidence',
          thresholdTrace: ['rmssdMs crossed the internal threshold'],
        },
      },
    },
    basketball
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.violations, []);
});

test('createEmptyCoachReportSurface keeps adherence coach-facing and plain-language', async () => {
  const { coachReports } = await loadSportsIntelligenceModules();

  const surface = coachReports.createEmptyCoachReportSurface({
    teamId: 'team_123',
    sportId: 'basketball',
    weekStart: '2026-04-20',
  });

  assert.equal(surface.meta.teamId, 'team_123');
  assert.equal(surface.meta.weekLabel, 'Week of Apr 20, 2026');
  assert.deepEqual(Object.keys(surface.adherence).sort(), [
    'confidenceLabel',
    'deviceCoveragePct',
    'noraCheckinCompletion7d',
    'noraCompletionPct',
    'protocolOrSimCompletion7d',
    'protocolSimulationCompletionPct',
    'summary',
    'trainingNutritionCoveragePct',
    'trainingOrNutritionCoverage7d',
    'wearRate7d',
  ]);
  assert.equal(surface.adherence.confidenceLabel, 'Thin read');
  assert.equal(surface.adherence.wearRate7d, 0);
  assert.equal(surface.watchlist.length, 0);
});

test('coach report service rejects unscoped reader calls before Firestore access', async () => {
  const { coachReports } = await loadSportsIntelligenceModules();

  await assert.rejects(
    () => coachReports.getReport('', 'report_123'),
    /teamId is required/
  );
  await assert.rejects(
    () => coachReports.listDrafts({ teamId: '' }),
    /teamId is required/
  );
  await assert.rejects(
    () => coachReports.listSentForTeam(''),
    /teamId is required/
  );
});
