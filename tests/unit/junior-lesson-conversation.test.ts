import test from 'node:test';
import assert from 'node:assert/strict';

// Junior Track guided-curriculum conversation function (PulseCheck repo,
// docs/specs/junior-track-guided-curriculum-spec.md). Mirrors the stub
// conventions of nora-conversation.test.ts.

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
  const fn = await import('../../netlify/functions/junior-lesson-conversation');
  const adaptiveTypes = await import('../../src/api/firebase/adaptiveFramingLayer/types');
  return { fn, adaptiveTypes };
};

const sampleLesson = {
  pillarId: 'champion-mindset',
  unitTitle: 'Bounce-Back Basics',
  title: 'The Reset Breath',
  kind: 'lesson',
  noraOpener: 'Every great athlete makes mistakes. Today you learn the fastest reset there is: one strong breath.',
  noraProbe: 'Think of the last time a mistake stuck with you during a game. What did it feel like?',
  takeawayCue: 'One breath, then next play.',
};

test('junior triggers are registered in the CONVERSATION_TRIGGERS allowlist', async () => {
  const { adaptiveTypes } = await loadModules();
  const triggers = adaptiveTypes.CONVERSATION_TRIGGERS as readonly string[];
  assert.ok(triggers.includes('junior-lesson-open'));
  assert.ok(triggers.includes('junior-lesson-close'));
  assert.ok(triggers.includes('junior-unit-checkpoint'));
});

test('synthesizeJuniorBranch maps lesson kind to junior-lesson-open', async () => {
  const { fn } = await loadModules();
  const branch = fn.__internal.synthesizeJuniorBranch('cm-u1-l1', sampleLesson);
  assert.equal(branch.trigger, 'junior-lesson-open');
  assert.equal(branch.id, 'junior-lesson-open-cm-u1-l1');
  assert.equal(branch.opener.text, sampleLesson.noraOpener);
  assert.equal(branch.probe.text, sampleLesson.noraProbe);
  assert.ok(branch.actionDelivery.text.startsWith(sampleLesson.takeawayCue));
});

test('synthesizeJuniorBranch maps checkpoint kind to junior-unit-checkpoint', async () => {
  const { fn } = await loadModules();
  const branch = fn.__internal.synthesizeJuniorBranch('cm-u1-checkpoint', {
    ...sampleLesson,
    kind: 'checkpoint',
    title: 'Checkpoint: Bounce-Back Basics',
  });
  assert.equal(branch.trigger, 'junior-unit-checkpoint');
  assert.equal(branch.id, 'junior-unit-checkpoint-cm-u1-checkpoint');
});

test('synthesized junior branch passes validateConversationBranch', async () => {
  const { fn, adaptiveTypes } = await loadModules();
  const branch = fn.__internal.synthesizeJuniorBranch('cm-u1-l1', sampleLesson);
  const result = adaptiveTypes.validateConversationBranch(branch);
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
});

test('LESSON_ID_PATTERN accepts kebab-case ids and rejects injection shapes', async () => {
  const { fn } = await loadModules();
  const pattern = fn.__internal.LESSON_ID_PATTERN as RegExp;
  assert.ok(pattern.test('cm-u1-l1'));
  assert.ok(pattern.test('er-u2-checkpoint'));
  assert.ok(!pattern.test(''));
  assert.ok(!pattern.test('CM-U1-L1'));
  assert.ok(!pattern.test('../other-collection'));
  assert.ok(!pattern.test('a'.repeat(65)));
});

test('formatYmdInTz produces yyyy-mm-dd in the requested timezone', async () => {
  const { fn } = await loadModules();
  const ymd = fn.__internal.formatYmdInTz(new Date('2026-07-12T03:00:00Z'), 'America/New_York');
  assert.equal(ymd, '2026-07-11');
});
