import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SPORTS_INTELLIGENCE_FIXTURE_SCENARIOS,
  SPORTS_INTELLIGENCE_GOLDEN_FIXTURES,
  type SportsIntelligenceFixtureSportId,
  getSportsIntelligenceFixture,
  listSportsIntelligenceFixtures,
} from '../../src/api/firebase/pulsecheckSportTestFixtures';

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

const PILOT_SPORTS: SportsIntelligenceFixtureSportId[] = [
  'basketball',
  'golf',
  'bowling',
  'track-field',
];

const COACH_SURFACE_BANNED_TERMS = [
  'ACWR',
  'acwr',
  'load_au',
  'high_confidence',
  'degraded',
  'clinical threshold',
  'directional',
  'stable confidence',
  'emerging confidence',
  'simEvidenceCount',
  'confidenceTier',
  'sourceProvenance',
  'thresholdTrace',
  'missingInputs',
  'rmssdMs',
  'externalLoadAU',
];

test('golden fixtures cover the four pilot sports and eight reviewer scenarios each', () => {
  assert.deepEqual(Object.keys(SPORTS_INTELLIGENCE_GOLDEN_FIXTURES).sort(), [...PILOT_SPORTS].sort());
  assert.equal(SPORTS_INTELLIGENCE_FIXTURE_SCENARIOS.length, 8);

  for (const sportId of PILOT_SPORTS) {
    assert.deepEqual(
      Object.keys(SPORTS_INTELLIGENCE_GOLDEN_FIXTURES[sportId]).sort(),
      [...SPORTS_INTELLIGENCE_FIXTURE_SCENARIOS].sort()
    );
  }

  assert.equal(listSportsIntelligenceFixtures().length, PILOT_SPORTS.length * SPORTS_INTELLIGENCE_FIXTURE_SCENARIOS.length);
});

test('each fixture is a fully shaped stored coach report with coach and reviewer halves', () => {
  for (const fixture of listSportsIntelligenceFixtures()) {
    assert.equal(fixture.id.length > 0, true);
    assert.equal(fixture.teamId.length > 0, true);
    assert.equal(fixture.reportKind, 'weekly');
    assert.equal(fixture.source, 'golden_fixture');
    assert.ok(fixture.coachSurface.meta);
    assert.ok(fixture.coachSurface.topLine.whatChanged);
    assert.ok(fixture.coachSurface.topLine.who);
    assert.ok(fixture.coachSurface.topLine.firstAction);
    assert.ok(fixture.coachSurface.dimensionState.focus);
    assert.ok(fixture.coachSurface.dimensionState.composure);
    assert.ok(fixture.coachSurface.dimensionState.decisioning);
    assert.ok(Array.isArray(fixture.coachSurface.watchlist));
    assert.ok(Array.isArray(fixture.coachSurface.coachActions));
    assert.ok(Array.isArray(fixture.coachSurface.gameDayLookFors));
    assert.ok(fixture.coachSurface.adherence.confidenceLabel);
    assert.ok(fixture.reviewerOnly.evidence);
    assert.ok(Array.isArray(fixture.reviewerOnly.evidence.athleteEvidenceRefs));
    assert.ok(Array.isArray(fixture.reviewerOnly.evidence.sourceProvenance));
    assert.ok(Array.isArray(fixture.reviewerOnly.evidence.missingInputs));
    assert.ok(Array.isArray(fixture.reviewerOnly.evidence.thresholdTrace));
    assert.ok(Array.isArray(fixture.reviewerOnly.auditTrace.suppressionReasons));
  }
});

test('coach surfaces stay in coach voice and do not leak reviewer-only terms', () => {
  for (const fixture of listSportsIntelligenceFixtures()) {
    const coachSurfaceJson = JSON.stringify(fixture.coachSurface);
    for (const term of COACH_SURFACE_BANNED_TERMS) {
      assert.equal(
        coachSurfaceJson.includes(term),
        false,
        `${fixture.id} leaked banned coach-surface term: ${term}`
      );
    }
  }
});

test('coach surfaces pass each sport language posture policy', async () => {
  installFirebaseEnv();
  const { enforceLanguagePosture, getDefaultPulseCheckSports } = await import(
    '../../src/api/firebase/pulsecheckSportConfig'
  );
  const sportsById = new Map(getDefaultPulseCheckSports().map((sport) => [sport.id, sport]));

  for (const fixture of listSportsIntelligenceFixtures()) {
    const sport = sportsById.get(fixture.sportId);
    assert.ok(sport, `${fixture.id} needs a matching sport configuration`);

    const audit = enforceLanguagePosture(fixture, sport);
    assert.equal(
      audit.passed,
      true,
      `${fixture.id} failed language posture audit: ${audit.violations.map((violation) => `${violation.source}:${violation.phrase}`).join(', ')}`
    );
  }
});

test('scenario-specific fixtures demonstrate suppression and caveat behavior', () => {
  for (const sportId of PILOT_SPORTS) {
    const thin = getSportsIntelligenceFixture(sportId, 'thin-data');
    assert.ok(thin);
    assert.equal(thin.coachSurface.watchlist.length, 0);
    assert.equal(thin.coachSurface.adherence.confidenceLabel, 'Thin read');
    assert.ok(thin.reviewerOnly.auditTrace.suppressedWatchlistEntries.length > 0);

    const missingSchedule = getSportsIntelligenceFixture(sportId, 'missing-schedule');
    assert.ok(missingSchedule);
    assert.ok(missingSchedule.reviewerOnly.evidence.missingInputs.includes('team schedule artifact'));
    assert.match(missingSchedule.coachSurface.noteOpener, /schedule|tee sheet|travel window|tournament block/i);

    const missingPracticePlan = getSportsIntelligenceFixture(sportId, 'missing-practice-plan');
    assert.ok(missingPracticePlan);
    assert.ok(missingPracticePlan.reviewerOnly.evidence.missingInputs.includes('prescribed practice plan'));
    assert.match(missingPracticePlan.coachSurface.noteOpener, /plan/i);

    const deviceGap = getSportsIntelligenceFixture(sportId, 'device-gap');
    assert.ok(deviceGap);
    assert.ok(deviceGap.reviewerOnly.auditTrace.suppressionReasons.some((reason) => reason.includes('device coverage')));
    assert.match(deviceGap.coachSurface.topLine.secondaryThread || '', /leaning on the days they wore it/i);

    const boundary = getSportsIntelligenceFixture(sportId, 'clinical-boundary-signal');
    assert.ok(boundary);
    assert.equal(boundary.reviewStatus, 'held');
    assert.equal(boundary.coachSurface.watchlist.length, 0);
    assert.ok(boundary.reviewerOnly.auditTrace.suppressionReasons.some((reason) => reason.includes('escalation path')));

    const highLoad = getSportsIntelligenceFixture(sportId, 'high-load-stable-cognition');
    assert.ok(highLoad);
    assert.equal(highLoad.coachSurface.adherence.confidenceLabel, 'Strong read');
    assert.match(highLoad.coachSurface.topLine.secondaryThread || '', /not a readiness scare/i);

    const lowRecovery = getSportsIntelligenceFixture(sportId, 'low-recovery-unstable-sentiment');
    assert.ok(lowRecovery);
    assert.equal(lowRecovery.coachSurface.watchlist.length, 2);
    assert.match(lowRecovery.coachSurface.topLine.firstAction, /short check-in/i);
  }
});

test('fixture lookup returns clones so reviewer seed mode can edit safely', () => {
  const first = getSportsIntelligenceFixture('basketball', 'good-data');
  const second = getSportsIntelligenceFixture('basketball', 'good-data');

  assert.ok(first);
  assert.ok(second);
  first.coachSurface.topLine.whatChanged = 'mutated in a test';

  assert.notEqual(first.coachSurface.topLine.whatChanged, second.coachSurface.topLine.whatChanged);
  assert.notEqual(
    first.coachSurface.topLine.whatChanged,
    SPORTS_INTELLIGENCE_GOLDEN_FIXTURES.basketball['good-data'].coachSurface.topLine.whatChanged
  );
});
