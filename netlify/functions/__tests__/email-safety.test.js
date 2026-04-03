const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_EMAIL_LOCK_STALE_MS,
  buildEmailDedupeKey,
  buildRecipientDailyQuotaKey,
  buildStreakMilestoneDedupeKey,
  findSiblingSentStreakMilestone,
  getUtcDateKey,
  normalizeEmailAddress,
  shouldBlockRecipientDailyQuota,
} = require('../utils/emailSafety');

test('buildRecipientDailyQuotaKey normalizes recipient email and uses UTC day boundaries', () => {
  const key = buildRecipientDailyQuotaKey({
    toEmail: ' Tre@FitWithPulse.AI ',
    scheduledAt: '2026-03-29T23:30:00-04:00',
  });

  assert.equal(key, 'tre@fitwithpulse.ai::2026-03-30');
  assert.equal(normalizeEmailAddress(' Tre@FitWithPulse.AI '), 'tre@fitwithpulse.ai');
  assert.equal(getUtcDateKey('2026-03-29T23:30:00-04:00'), '2026-03-30');
});

test('shouldBlockRecipientDailyQuota blocks when the daily limit is already reached', () => {
  const blocked = shouldBlockRecipientDailyQuota({
    state: { sentCount: 1 },
    runId: 'run-1',
    nowMs: Date.now(),
    dailyLimit: 1,
  });

  assert.equal(blocked, true);
});

test('shouldBlockRecipientDailyQuota blocks overlapping fresh claims from another run', () => {
  const nowMs = Date.now();
  const blocked = shouldBlockRecipientDailyQuota({
    state: {
      sentCount: 0,
      runId: 'run-1',
      claimedAt: new Date(nowMs - 5 * 60 * 1000),
    },
    runId: 'run-2',
    nowMs,
    dailyLimit: 1,
  });

  assert.equal(blocked, true);
});

test('shouldBlockRecipientDailyQuota ignores stale claims so retries can recover', () => {
  const nowMs = Date.now();
  const blocked = shouldBlockRecipientDailyQuota({
    state: {
      sentCount: 0,
      runId: 'run-1',
      claimedAt: new Date(nowMs - DEFAULT_EMAIL_LOCK_STALE_MS - 1000),
    },
    runId: 'run-2',
    nowMs,
    dailyLimit: 1,
  });

  assert.equal(blocked, false);
});

test('buildStreakMilestoneDedupeKey is stable per user and milestone across duplicate challenge docs', () => {
  const roundOneKey = buildStreakMilestoneDedupeKey({
    userId: 'user_123',
    email: 'first@example.com',
    docId: 'challenge_doc_a',
    milestone: 7,
  });
  const roundTwoKey = buildStreakMilestoneDedupeKey({
    userId: 'user_123',
    email: 'second@example.com',
    docId: 'challenge_doc_b',
    milestone: 7,
  });

  assert.equal(roundOneKey, 'user_123::7');
  assert.equal(roundOneKey, roundTwoKey);
});

test('findSiblingSentStreakMilestone finds historical sibling state so cron reruns cannot leak another send', () => {
  const siblingSentAt = new Date('2026-03-29T18:31:00.000Z');
  const sibling = {
    id: 'challenge_doc_old',
    data() {
      return {
        emailSequenceState: {
          streakMilestonesSent: {
            7: siblingSentAt,
          },
        },
      };
    },
  };
  const current = {
    id: 'challenge_doc_current',
    data() {
      return {
        emailSequenceState: {
          streakMilestonesSent: {},
        },
      };
    },
  };

  const recovered = findSiblingSentStreakMilestone({
    candidates: [current, sibling],
    currentDocId: 'challenge_doc_current',
    milestone: 7,
  });

  assert.deepEqual(recovered, {
    sourceDocId: 'challenge_doc_old',
    sentAt: siblingSentAt,
  });
});

test('buildEmailDedupeKey filters blanks and normalizes case', () => {
  assert.equal(
    buildEmailDedupeKey([' Streak-Email ', null, 'User_ABC ', 7]),
    'streak-email::user_abc::7'
  );
});

test('buildEmailDedupeKey escapes forward slashes so URL-based keys are Firestore-safe', () => {
  assert.equal(
    buildEmailDedupeKey([
      'group-meet-invite-v1',
      'https://fitwithpulse.ai/group-meet/abc123',
      'tre@fitwithpulse.ai',
      'preview',
    ]),
    'group-meet-invite-v1::https:%2f%2ffitwithpulse.ai%2fgroup-meet%2fabc123::tre@fitwithpulse.ai::preview'
  );
});
