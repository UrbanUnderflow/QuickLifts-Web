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
  const orchestrator = await import('../../src/api/firebase/noraConversation/orchestrator');
  const types = await import('../../src/api/firebase/noraConversation/types');
  const adaptiveTypes = await import('../../src/api/firebase/adaptiveFramingLayer/types');
  const seed = await import('../../src/api/firebase/adaptiveFramingLayer/seed');
  const scheduledNoraConversation = await import('../../netlify/functions/scheduled-nora-conversation');
  return { orchestrator, types, adaptiveTypes, seed, scheduledNoraConversation };
};

test('id builders — buildConversationId concatenates athleteUserId + triggerFireId', async () => {
  const { orchestrator } = await loadModules();
  const id = orchestrator.__internal.buildConversationId('athlete-1', 'fire-2026-04-30');
  assert.equal(id, 'athlete-1_fire-2026-04-30');
});

test('id builders — buildTurnId follows {conversationId}_t{index} format', async () => {
  const { orchestrator } = await loadModules();
  const id = orchestrator.__internal.buildTurnId('athlete-1_fire', 3);
  assert.equal(id, 'athlete-1_fire_t3');
});

test('id builders — buildTriggerFireId combines athleteUserId + trigger + dayKey', async () => {
  const { orchestrator } = await loadModules();
  const id = orchestrator.__internal.buildTriggerFireId('athlete-1', 'hcsr-delta-detected', '2026-04-30');
  assert.equal(id, 'athlete-1_hcsr-delta-detected_2026-04-30');
});

test('keywordFallback — sleep domain maps fatigue keywords to deficit', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('I feel exhausted', 'sleep');
  assert.equal(result, 'deficit');
});

test('keywordFallback — sleep domain maps positive keywords to strong', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('Slept great, deep sleep all night', 'sleep');
  assert.equal(result, 'strong');
});

test('keywordFallback — sleep domain default to adequate', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('It was fine', 'sleep');
  assert.equal(result, 'adequate');
});

test('keywordFallback — autonomic domain detects sympathetic-dominant from stress keywords', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('feeling really tense and on edge', 'autonomic');
  assert.equal(result, 'sympathetic-dominant');
});

test('keywordFallback — circadian domain detects jetlag-significant', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('jet lag is brutal still', 'circadian');
  assert.equal(result, 'jetlag-significant');
});

test('keywordFallback — load domain detects climbing from soreness', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('legs are wrecked today', 'load');
  assert.equal(result, 'climbing');
});

test('keywordFallback — travel domain identifies day-of-arrival', async () => {
  const { orchestrator } = await loadModules();
  const result = orchestrator.__internal.keywordFallback('just landed', 'travel');
  assert.equal(result, 'day-of-arrival');
});

test('types — HCSR_DELTA_THRESHOLDS includes travel_signature + jetlag_significant', async () => {
  const { types } = await loadModules();
  assert.ok((types.HCSR_DELTA_THRESHOLDS.circadianBands as readonly string[]).includes('travel_signature'));
  assert.ok((types.HCSR_DELTA_THRESHOLDS.circadianBands as readonly string[]).includes('jetlag_significant'));
});

test('types — autonomic load threshold matches doctrine (360 minutes)', async () => {
  const { types } = await loadModules();
  assert.equal(types.HCSR_DELTA_THRESHOLDS.autonomicLoadMinutes, 360);
});

test('types — sleep-efficiency drop threshold is 15%', async () => {
  const { types } = await loadModules();
  assert.equal(types.HCSR_DELTA_THRESHOLDS.sleepEfficiencyDropPct, 0.15);
});

test('types — behavioral drift fires at 5 days', async () => {
  const { types } = await loadModules();
  assert.equal(types.BEHAVIORAL_DRIFT_DAYS, 5);
});

test('types — calendar event window is 36 hours', async () => {
  const { types } = await loadModules();
  assert.equal(types.CALENDAR_EVENT_WINDOW_HOURS, 36);
});

const loadTimeoutSweep = async () => {
  installFirebaseEnv();
  return import('../../netlify/functions/scheduled-nora-conversation-timeout-sweep');
};

const buildFakeFirestore = (docs: Array<{ id: string; data: Record<string, unknown> }>) => {
  const docSnaps = docs.map((doc) => ({
    id: doc.id,
    data: () => doc.data,
  }));

  return {
    collection: (name: string) => {
      assert.equal(name, 'pulsecheck-nora-conversations');
      const filters: Array<{ field: string; op: string; value: unknown }> = [];
      let limitValue = docSnaps.length;
      let startAfterId: string | undefined;

      const query = {
        where(field: string, op: string, value: unknown) {
          filters.push({ field, op, value });
          return query;
        },
        orderBy(field: string, direction: string) {
          assert.equal(field, 'updatedAt');
          assert.equal(direction, 'asc');
          return query;
        },
        limit(value: number) {
          limitValue = value;
          return query;
        },
        startAfter(doc: { id: string }) {
          startAfterId = doc.id;
          return query;
        },
        async get() {
          let rows = [...docSnaps];
          for (const filter of filters) {
            if (filter.op === '==') {
              rows = rows.filter((doc) => doc.data()[filter.field] === filter.value);
            } else if (filter.op === '<') {
              rows = rows.filter((doc) => Number(doc.data()[filter.field]) < Number(filter.value));
            } else {
              throw new Error(`unsupported filter ${filter.op}`);
            }
          }
          rows.sort((a, b) => Number(a.data().updatedAt) - Number(b.data().updatedAt));
          if (startAfterId) {
            const startIndex = rows.findIndex((doc) => doc.id === startAfterId);
            rows = startIndex >= 0 ? rows.slice(startIndex + 1) : rows;
          }
          return { docs: rows.slice(0, limitValue) };
        },
      };

      return query;
    },
  };
};

test('timeout sweep — closes stale opened/awaiting-reply conversations only', async () => {
  const { sweepNoraConversationTimeouts } = await loadTimeoutSweep();
  const now = new Date('2026-04-30T04:00:00Z');
  const stale = now.getTime() - 49 * 60 * 60 * 1000;
  const fresh = now.getTime() - 6 * 60 * 60 * 1000;
  const db = buildFakeFirestore([
    { id: 'stale-opened', data: { state: 'opened', updatedAt: stale } },
    { id: 'stale-awaiting', data: { state: 'awaiting-reply', updatedAt: stale + 1 } },
    { id: 'fresh-opened', data: { state: 'opened', updatedAt: fresh } },
    { id: 'stale-action', data: { state: 'action-delivered', updatedAt: stale } },
  ]);
  const closed: string[] = [];

  const summary = await sweepNoraConversationTimeouts({
    firestore: db,
    now,
    closeConversationFn: async (input) => {
      assert.equal(input.reason, 'no-reply');
      closed.push(input.conversationId);
    },
  });

  assert.deepEqual(closed.sort(), ['stale-awaiting', 'stale-opened']);
  assert.equal(summary.closed, 2);
  assert.equal(summary.byState.opened, 1);
  assert.equal(summary.byState['awaiting-reply'], 1);
});

test('scheduled sweep — detector triggers resolve to seeded Phase B branch ids', async () => {
  const { adaptiveTypes, seed, scheduledNoraConversation } = await loadModules();
  const seededBranchIds = new Set(seed.SEED_CONVERSATION_BRANCHES.map((branch) => branch.id));

  // Some triggers intentionally use synthesized-in-memory branches
  // (no Phase B seed). The morning-checkin-tone trigger synthesizes
  // its branch in record-morning-checkin.ts so the iOS-side
  // noraResponse strings remain the single source of truth.
  const SYNTHETIC_BRANCH_TRIGGERS = new Set(['morning-checkin-tone']);

  for (const trigger of adaptiveTypes.CONVERSATION_TRIGGERS) {
    const branchId = scheduledNoraConversation.__internal.triggerToBranchId(trigger);
    assert.equal(branchId, trigger);
    if (SYNTHETIC_BRANCH_TRIGGERS.has(trigger)) {
      // Synthesized branches are not in the Phase B seed by design.
      assert.ok(
        !seededBranchIds.has(branchId),
        `${trigger} should be synthesized (not seeded) — if you've added a Phase B seed, remove it from SYNTHETIC_BRANCH_TRIGGERS.`,
      );
      continue;
    }
    assert.ok(seededBranchIds.has(branchId), `${trigger} should resolve to a seeded branch id`);
  }
});
