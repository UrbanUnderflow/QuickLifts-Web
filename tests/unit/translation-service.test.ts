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
  const [service, seed] = await Promise.all([
    import('../../src/api/firebase/adaptiveFramingLayer/translationService'),
    import('../../src/api/firebase/adaptiveFramingLayer/seed'),
  ]);
  return { service, seed };
};

// ---------------------------------------------------------------------------
// Fakes — minimal Firestore admin shape that translationService needs.
// ---------------------------------------------------------------------------

interface FakeDoc {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
  id: string;
}

interface FakeCollection {
  doc: (id: string) => { get: () => Promise<FakeDoc> };
  add: (entry: Record<string, unknown>) => Promise<{ id: string }>;
}

interface FakeFirestoreOptions {
  translationRows?: Record<string, Record<string, unknown>>;
  offLimits?: Record<string, unknown> | null;
  recordedLogs?: Array<Record<string, unknown>>;
}

const buildFakeFirestore = (opts: FakeFirestoreOptions) => {
  const logs = opts.recordedLogs ?? [];
  const collections: Record<string, FakeCollection> = {
    'pulsecheck-translation-table': {
      doc: (id: string) => ({
        get: async (): Promise<FakeDoc> => ({
          id,
          exists: !!opts.translationRows?.[id],
          data: () => opts.translationRows?.[id],
        }),
      }),
      add: async () => ({ id: 'unused' }),
    },
    'pulsecheck-off-limits-config': {
      doc: (id: string) => ({
        get: async (): Promise<FakeDoc> => ({
          id,
          exists: !!opts.offLimits,
          data: () => opts.offLimits ?? undefined,
        }),
      }),
      add: async () => ({ id: 'unused' }),
    },
    'pulsecheck-nora-translation-log': {
      doc: () => ({
        get: async () => ({ id: '', exists: false, data: () => undefined }),
      }),
      add: async (entry: Record<string, unknown>) => {
        logs.push(entry);
        return { id: `log-${logs.length}` };
      },
    },
  };

  return {
    collection: (name: string) => {
      const col = collections[name];
      if (!col) throw new Error(`Unexpected collection access: ${name}`);
      return col;
    },
    __logs: logs,
  } as any;
};

// Fake Anthropic SDK shape matching AnthropicLike.
const buildFakeAnthropic = (
  outcome:
    | { type: 'text'; text: string }
    | { type: 'error'; error: Error },
) => ({
  messages: {
    create: async () => {
      if (outcome.type === 'error') throw outcome.error;
      return { content: [{ type: 'text', text: outcome.text }] };
    },
  },
});

// Build a row that matches the seed for circadian / travel_signature.
const seedRowFor = async (state: string) => {
  const { seed } = await loadModules();
  const row = seed.SEED_TRANSLATION_ROWS.find((r) => r.state === state);
  if (!row) throw new Error(`No seed row for state ${state}`);
  return row;
};

const seedAsFirestoreData = (row: Awaited<ReturnType<typeof seedRowFor>>) => ({
  domain: row.domain,
  state: row.state,
  athletePhrasing: row.athletePhrasing,
  requiredActionVerbs: row.requiredActionVerbs,
  forbiddenTokens: row.forbiddenTokens,
  voiceReviewStatus: row.voiceReviewStatus,
  revisionId: row.revisionId,
  createdBy: row.createdBy,
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test('translateForAthlete — happy path: Claude clean, returns athletePhrasing, log written', async () => {
  const { service, seed } = await loadModules();
  const row = await seedRowFor('travel_signature');
  const recordedLogs: Array<Record<string, unknown>> = [];

  const firestore = buildFakeFirestore({
    translationRows: {
      [`${row.domain}-${row.state}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')]: seedAsFirestoreData(row),
    },
    offLimits: seed.SEED_OFF_LIMITS_CONFIG,
    recordedLogs,
  });

  // Clean Claude reply that satisfies all guardrails for this row's
  // requiredActionVerbs ['Walk', 'Eat', 'box-breathe'].
  const anthropicClient = buildFakeAnthropic({
    type: 'text',
    text: 'Walk in daylight after waking. Eat on local time and box-breathe before your hardest set.',
  });

  const result = await service.translateForAthlete(
    {
      athleteUserId: 'user-1',
      signal: { band: 'travel_signature', sleepMidpointShiftMinutes: 90 },
      domain: row.domain,
      state: row.state,
    },
    { firestore, anthropicClient },
  );

  assert.ok(result, 'expected a result');
  assert.equal(result.providerUsed, 'anthropic');
  assert.equal(result.fallbackTriggered, false);
  assert.equal(result.guardrailViolations.length, 0);
  assert.equal(result.voiceReviewStatus, row.voiceReviewStatus);
  assert.equal(result.translationRowRevision, row.revisionId);
  // claudeOutputRaw is omitted on production happy path (persistLog default = true).
  assert.equal(result.claudeOutputRaw, undefined);

  // Allow microtask queue to drain so void-logTranslation completes.
  await new Promise((r) => setImmediate(r));
  assert.equal(recordedLogs.length, 1, 'expected exactly one log entry');
  assert.equal(recordedLogs[0].providerUsed, 'anthropic');
  assert.equal(recordedLogs[0].fallbackTriggered, false);
  assert.equal(recordedLogs[0].finalPhrasing, result.phrasing);
  assert.equal(recordedLogs[0].claudeOutputRaw, result.phrasing);
});

// ---------------------------------------------------------------------------
// Guardrail rejection
// ---------------------------------------------------------------------------

test('translateForAthlete — guardrail rejection: returns seed, log captures violations + raw output', async () => {
  const { service, seed } = await loadModules();
  const row = await seedRowFor('travel_signature');
  const recordedLogs: Array<Record<string, unknown>> = [];

  const firestore = buildFakeFirestore({
    translationRows: {
      [`${row.domain}-${row.state}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')]: seedAsFirestoreData(row),
    },
    offLimits: seed.SEED_OFF_LIMITS_CONFIG,
    recordedLogs,
  });

  const badOutput = 'Your HRV came in at 42 ms — walk in daylight, eat local, box-breathe.';
  const anthropicClient = buildFakeAnthropic({ type: 'text', text: badOutput });

  const result = await service.translateForAthlete(
    {
      athleteUserId: 'user-1',
      signal: { band: 'travel_signature' },
      domain: row.domain,
      state: row.state,
    },
    { firestore, anthropicClient },
  );

  assert.ok(result);
  assert.equal(result.providerUsed, 'fallback-seed');
  assert.equal(result.fallbackTriggered, true);
  assert.equal(result.fallbackReason, 'guardrail-violation');
  assert.equal(result.phrasing, row.athletePhrasing);
  assert.ok(result.guardrailViolations.length > 0);
  assert.equal(result.claudeOutputRaw, badOutput);

  await new Promise((r) => setImmediate(r));
  assert.equal(recordedLogs.length, 1);
  assert.equal(recordedLogs[0].fallbackTriggered, true);
  assert.equal(recordedLogs[0].fallbackReason, 'guardrail-violation');
  assert.equal(recordedLogs[0].claudeOutputRaw, badOutput);
  assert.equal(recordedLogs[0].finalPhrasing, row.athletePhrasing);
});

// ---------------------------------------------------------------------------
// Anthropic error
// ---------------------------------------------------------------------------

test('translateForAthlete — anthropic-error: returns seed, log captures error reason', async () => {
  const { service, seed } = await loadModules();
  const row = await seedRowFor('travel_signature');
  const recordedLogs: Array<Record<string, unknown>> = [];

  const firestore = buildFakeFirestore({
    translationRows: {
      [`${row.domain}-${row.state}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')]: seedAsFirestoreData(row),
    },
    offLimits: seed.SEED_OFF_LIMITS_CONFIG,
    recordedLogs,
  });

  const anthropicClient = buildFakeAnthropic({ type: 'error', error: new Error('429 rate-limited') });

  const result = await service.translateForAthlete(
    {
      athleteUserId: 'user-1',
      signal: {},
      domain: row.domain,
      state: row.state,
    },
    { firestore, anthropicClient },
  );

  assert.ok(result);
  assert.equal(result.providerUsed, 'fallback-seed');
  assert.equal(result.fallbackTriggered, true);
  assert.equal(result.fallbackReason, 'anthropic-error');
  assert.equal(result.phrasing, row.athletePhrasing);
  assert.equal(result.guardrailViolations.length, 0);

  await new Promise((r) => setImmediate(r));
  assert.equal(recordedLogs.length, 1);
  assert.equal(recordedLogs[0].fallbackReason, 'anthropic-error');
  assert.equal(recordedLogs[0].errorMessage, '429 rate-limited');
});

// ---------------------------------------------------------------------------
// Missing row
// ---------------------------------------------------------------------------

test('translateForAthlete — row-missing: returns null with explanatory log', async () => {
  const { service, seed } = await loadModules();
  const recordedLogs: Array<Record<string, unknown>> = [];

  const firestore = buildFakeFirestore({
    translationRows: {}, // no rows
    offLimits: seed.SEED_OFF_LIMITS_CONFIG,
    recordedLogs,
  });

  const anthropicClient = buildFakeAnthropic({ type: 'text', text: 'should never be called' });

  const result = await service.translateForAthlete(
    {
      athleteUserId: 'user-1',
      signal: {},
      domain: 'circadian',
      state: 'unknown-state',
    },
    { firestore, anthropicClient },
  );

  assert.equal(result, null);

  await new Promise((r) => setImmediate(r));
  assert.equal(recordedLogs.length, 1);
  assert.equal(recordedLogs[0].fallbackReason, 'row-missing');
  assert.equal(recordedLogs[0].providerUsed, 'fallback-seed');
});

// ---------------------------------------------------------------------------
// Dry-run preview
// ---------------------------------------------------------------------------

test('translateForAthlete — persistLog:false skips Firestore write but still returns full result with claudeOutputRaw', async () => {
  const { service, seed } = await loadModules();
  const row = await seedRowFor('travel_signature');
  const recordedLogs: Array<Record<string, unknown>> = [];

  const firestore = buildFakeFirestore({
    translationRows: {
      [`${row.domain}-${row.state}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')]: seedAsFirestoreData(row),
    },
    offLimits: seed.SEED_OFF_LIMITS_CONFIG,
    recordedLogs,
  });

  const cleanText = 'Walk in sunlight after waking. Eat on local time and box-breathe before your warm-up.';
  const anthropicClient = buildFakeAnthropic({ type: 'text', text: cleanText });

  const result = await service.translateForAthlete(
    {
      athleteUserId: 'admin-preview',
      signal: { band: 'travel_signature' },
      domain: row.domain,
      state: row.state,
      persistLog: false,
    },
    { firestore, anthropicClient },
  );

  assert.ok(result);
  assert.equal(result.providerUsed, 'anthropic');
  assert.equal(result.fallbackTriggered, false);
  assert.equal(result.claudeOutputRaw, cleanText);
  assert.equal(result.phrasing, cleanText);

  await new Promise((r) => setImmediate(r));
  assert.equal(recordedLogs.length, 0, 'dry-run must not write any log entries');
});

// ---------------------------------------------------------------------------
// Off-limits config missing — guardrails still enforce hardcoded checks
// ---------------------------------------------------------------------------

test('translateForAthlete — works with missing off-limits doc; hardcoded guardrails still fire', async () => {
  const { service } = await loadModules();
  const row = await seedRowFor('travel_signature');
  const recordedLogs: Array<Record<string, unknown>> = [];

  const firestore = buildFakeFirestore({
    translationRows: {
      [`${row.domain}-${row.state}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')]: seedAsFirestoreData(row),
    },
    offLimits: null,
    recordedLogs,
  });

  // Bad output triggers hardcoded numeric+unit and negative-priming guardrails
  // even with no off-limits config loaded.
  const anthropicClient = buildFakeAnthropic({
    type: 'text',
    text: 'Your recovery is low — walk in daylight, eat local, box-breathe through the warm-up.',
  });

  const result = await service.translateForAthlete(
    {
      athleteUserId: 'user-1',
      signal: {},
      domain: row.domain,
      state: row.state,
    },
    { firestore, anthropicClient },
  );

  assert.ok(result);
  assert.equal(result.fallbackTriggered, true);
  assert.equal(result.fallbackReason, 'guardrail-violation');
});
