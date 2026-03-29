import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import {
  buildEmailDedupeKey,
  claimScheduledSequenceSend,
  finalizeScheduledSequenceSend,
  getBaseSiteUrl,
  releaseScheduledSequenceSend,
  toMillis,
} from './utils/emailSequenceHelpers';

const LOOKBACK_DAYS = 7;
const FIRST_WORKOUT_RECENCY_HOURS = 72;
const BATCH_LIMIT = 600;

type CompletedWorkout = {
  completedAt?: any;
};

function getChallengeTitle(data: Record<string, any>): string {
  const c = data?.challenge || {};
  return (
    (typeof c.title === 'string' && c.title.trim()) ||
    (typeof c.challengeTitle === 'string' && c.challengeTitle.trim()) ||
    (typeof c.name === 'string' && c.name.trim()) ||
    'your Pulse Round'
  );
}

function getCompletedWorkouts(data: Record<string, any>): CompletedWorkout[] {
  return Array.isArray(data?.completedWorkouts) ? data.completedWorkouts : [];
}

function getFirstCompletionMs(completedWorkouts: CompletedWorkout[]): number | null {
  let minMs: number | null = null;
  for (const cw of completedWorkouts) {
    const ms = toMillis(cw?.completedAt);
    if (!ms) continue;
    minMs = minMs === null ? ms : Math.min(minMs, ms);
  }
  return minMs;
}

async function sendFirstWorkoutCelebration(args: {
  userId?: string;
  challengeId?: string;
  challengeTitle: string;
  currentStreak: number;
}): Promise<{ skipped: boolean }> {
  const resp = await fetch(`${getBaseSiteUrl()}/.netlify/functions/send-first-workout-celebration-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: args.userId,
      challengeId: args.challengeId,
      challengeTitle: args.challengeTitle,
      currentStreak: args.currentStreak,
    }),
  });

  const json = await resp.json().catch(() => ({} as any));
  if (!resp.ok || json?.success === false) {
    throw new Error(json?.error || `HTTP ${resp.status}`);
  }

  return { skipped: Boolean(json?.skipped) };
}

export const handler: Handler = async () => {
  try {
    const db = await getFirestore();
    const nowMs = Date.now();
    const runId = `first-workout-${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
    const lookbackSec = Math.floor((nowMs - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000);
    const claimedDedupeKeys = new Set<string>();

    const querySnap = await db
      .collection('user-challenge')
      .where('updatedAt', '>=', lookbackSec)
      .orderBy('updatedAt', 'desc')
      .limit(BATCH_LIMIT)
      .get();

    if (querySnap.empty) {
      return { statusCode: 200, body: JSON.stringify({ success: true, scanned: 0, sent: 0, skipped: 0 }) };
    }

    let scanned = 0;
    let sent = 0;
    let skipped = 0;

    for (const doc of querySnap.docs) {
      scanned++;
      const data = (doc.data() || {}) as Record<string, any>;
      const state = (data.emailSequenceState || {}) as Record<string, any>;

      if (state.firstWorkoutCelebrationSentAt || state.firstWorkoutCelebrationSkippedAt) {
        skipped++;
        continue;
      }

      const completedWorkouts = getCompletedWorkouts(data);
      if (completedWorkouts.length !== 1) {
        skipped++;
        continue;
      }

      const firstCompletionMs = getFirstCompletionMs(completedWorkouts);
      if (!firstCompletionMs) {
        skipped++;
        continue;
      }

      const ageHours = (nowMs - firstCompletionMs) / (60 * 60 * 1000);
      if (ageHours < 0 || ageHours > FIRST_WORKOUT_RECENCY_HOURS) {
        skipped++;
        continue;
      }

      const pendingField = 'emailSequenceState.firstWorkoutCelebrationPending';
      const dedupeKey = buildEmailDedupeKey(['first-workout-celebration-v1', data.userId || doc.id, data.challengeId || doc.id]);
      if (claimedDedupeKeys.has(dedupeKey)) {
        skipped++;
        continue;
      }

      const claimed = await claimScheduledSequenceSend({
        docRef: doc.ref,
        pendingField,
        completionFields: [
          'emailSequenceState.firstWorkoutCelebrationSentAt',
          'emailSequenceState.firstWorkoutCelebrationSkippedAt',
        ],
        dedupeKey,
        runId,
        nowMs,
        metadata: {
          sequence: 'first-workout-celebration-v1',
          userId: data.userId || null,
          challengeId: data.challengeId || null,
        },
      });

      if (!claimed) {
        skipped++;
        continue;
      }

      claimedDedupeKeys.add(dedupeKey);

      try {
        const sendResult = await sendFirstWorkoutCelebration({
          userId: data.userId,
          challengeId: data.challengeId,
          challengeTitle: getChallengeTitle(data),
          currentStreak: Number(data.currentStreak || 0) || 0,
        });

        const field = sendResult.skipped
          ? 'emailSequenceState.firstWorkoutCelebrationSkippedAt'
          : 'emailSequenceState.firstWorkoutCelebrationSentAt';

        await finalizeScheduledSequenceSend({
          docRef: doc.ref,
          pendingField,
          resultField: field,
          dedupeKey,
          runId,
          markSent: !sendResult.skipped,
          updateFields: {
            updatedAt: Math.floor(Date.now() / 1000),
          },
        });

        if (sendResult.skipped) {
          skipped++;
        } else {
          sent++;
        }
      } catch (error) {
        claimedDedupeKeys.delete(dedupeKey);
        await releaseScheduledSequenceSend({
          docRef: doc.ref,
          pendingField,
          dedupeKey,
          runId,
        }).catch((releaseError) => {
          console.warn('[schedule-first-workout-celebration-email] Failed to release claim:', doc.id, releaseError);
        });
        console.warn('[schedule-first-workout-celebration-email] Failed for doc:', doc.id, error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, scanned, sent, skipped }),
    };
  } catch (error: any) {
    console.error('[schedule-first-workout-celebration-email] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }) };
  }
};
