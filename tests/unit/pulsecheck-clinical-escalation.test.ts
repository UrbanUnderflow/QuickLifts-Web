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

const loadModules = async () => {
  installFirebaseEnv();
  const [escalation, types] = await Promise.all([
    import('../../src/api/firebase/pulsecheckClinicalEscalation'),
    import('../../src/api/firebase/pulsecheckProvisioning/types'),
  ]);
  return { escalation, types };
};

test('clinical escalation — exposes 988 / 911 / Crisis Text Line in canonical resources', async () => {
  const { escalation } = await loadModules();
  const ids = escalation.CANONICAL_CRISIS_RESOURCES.map((entry) => entry.id);
  assert.ok(ids.includes('us_988'), '988 must be present in canonical resources');
  assert.ok(ids.includes('us_911'), '911 must be present');
  assert.ok(ids.includes('us_crisis_text_line'), 'Crisis Text Line must be present');
});

test('clinical escalation — 988 entry has both call and text affordances', async () => {
  const { escalation } = await loadModules();
  const entry = escalation.CANONICAL_CRISIS_RESOURCES.find((r) => r.id === 'us_988');
  assert.ok(entry, '988 entry not found');
  assert.equal(entry?.phone, '988');
  assert.equal(entry?.smsNumber, '988');
});

test('clinical escalation — Crisis Text Line entry uses HOME body', async () => {
  const { escalation } = await loadModules();
  const entry = escalation.CANONICAL_CRISIS_RESOURCES.find((r) => r.id === 'us_crisis_text_line');
  assert.ok(entry);
  assert.equal(entry?.smsNumber, '741741');
  assert.equal(entry?.smsBody, 'HOME');
});

test('clinical escalation — service exports expected public surface', async () => {
  const { escalation } = await loadModules();
  const svc = escalation.pulsecheckClinicalEscalationService;
  for (const fn of [
    'recordClinicalEscalation',
    'acknowledgeClinicalEscalation',
    'resolveClinicalEscalation',
    'resolveDesignatedClinician',
    'teamHasOperationalEscalationContact',
    'setAthleteCrisisWallActive',
    'clearAthleteCrisisWall',
  ]) {
    assert.equal(typeof (svc as any)[fn], 'function', `service.${fn} must be a function`);
  }
});

test('clinical escalation — preview mode skips Firestore writes', async () => {
  const { escalation } = await loadModules();
  const result = await escalation.recordClinicalEscalation({
    athleteUserId: 'athlete-1',
    teamId: 'team-1',
    tier: 3,
    signalSource: 'pulsecheck_chat_classifier',
    evidence: [
      { label: 'pattern matched', confidence: 'stable' },
    ],
    triggeredBySource: 'service:pulsecheck_inference_engine',
    preview: true,
  });
  assert.equal(result.recorded, false);
  assert.equal(result.record.id, 'preview');
  assert.equal(result.record.tier, 3);
  assert.equal(result.record.athleteUserId, 'athlete-1');
});

test('clinical escalation — required fields are validated', async () => {
  const { escalation } = await loadModules();
  await assert.rejects(
    escalation.recordClinicalEscalation({
      athleteUserId: '',
      teamId: 'team-1',
      tier: 3,
      signalSource: 'pulsecheck_chat_classifier',
      evidence: [],
      triggeredBySource: 'service:engine',
      preview: true,
    } as any),
    /athleteUserId is required/,
  );
  await assert.rejects(
    escalation.recordClinicalEscalation({
      athleteUserId: 'athlete-1',
      teamId: '',
      tier: 3,
      signalSource: 'pulsecheck_chat_classifier',
      evidence: [],
      triggeredBySource: 'service:engine',
      preview: true,
    } as any),
    /teamId is required/,
  );
});

test('default pilot consent doc — bumped to v5 with crisis-handoff language', async () => {
  const { types } = await loadModules();
  const pilotConsents = types.getDefaultPulseCheckRequiredConsents('pilot');
  const participation = pilotConsents.find((c) => c.id === 'pulsecheck-pilot-participation-notice-v1');
  assert.ok(participation, 'participation notice must be present');
  assert.equal(participation?.version, 'v5', 'participation notice version must be bumped to v5');
  assert.ok(
    participation?.body.includes('critical-tier'),
    'participation notice must mention critical-tier',
  );
  assert.ok(
    participation?.body.includes('988'),
    'participation notice must explicitly call out 988',
  );
  assert.ok(
    participation?.body.includes('clinician staff member'),
    'participation notice must reference the team clinician staff member',
  );
  assert.ok(
    participation?.body.toLowerCase().includes('not initiate contact'),
    'participation notice must clarify Pulse does not initiate emergency contact',
  );
});

test('default pilot consent doc — privacy notice bumped to v5 with crisis-tier sharing language', async () => {
  const { types } = await loadModules();
  const pilotConsents = types.getDefaultPulseCheckRequiredConsents('pilot');
  const privacy = pilotConsents.find((c) => c.id === 'pulsecheck-pilot-privacy-and-data-use-v1');
  assert.ok(privacy);
  assert.equal(privacy?.version, 'v5');
  assert.ok(privacy?.body.includes('Crisis-tier escalation sharing'));
  assert.ok(privacy?.body.includes('clinician staff member'));
});
