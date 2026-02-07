import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import { getBaseSiteUrl, toMillis } from './utils/emailSequenceHelpers';

const REMINDER_AFTER_HOURS = 24;
const MAX_DELAY_HOURS = 24 * 7;
const LOOKBACK_DAYS = 14;
const BATCH_LIMIT = 600;

function getChallengeTitle(data: Record<string, any>): string {
  const c = data?.challenge || {};
  return (
    (typeof c.title === 'string' && c.title.trim()) ||
    (typeof c.challengeTitle === 'string' && c.challengeTitle.trim()) ||
    (typeof c.name === 'string' && c.name.trim()) ||
    'your Pulse Round'
  );
}

function getCompletedCount(data: Record<string, any>): number {
  return Array.isArray(data?.completedWorkouts) ? data.completedWorkouts.length : 0;
}

async function sendJoinedRoundNoWorkoutEmail(args: {
  userId?: string;
  challengeId?: string;
  challengeTitle: string;
  userChallengeId: string;
}): Promise<{ skipped: boolean }> {
  const resp = await fetch(`${getBaseSiteUrl()}/.netlify/functions/send-joined-round-no-workout-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: args.userId,
      challengeId: args.challengeId,
      challengeTitle: args.challengeTitle,
      userChallengeId: args.userChallengeId,
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
    const lookbackSec = Math.floor((nowMs - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000);

    const querySnap = await db
      .collection('user-challenge')
      .where('createdAt', '>=', lookbackSec)
      .orderBy('createdAt', 'desc')
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

      if (data.isCompleted === true) {
        skipped++;
        continue;
      }
      if (state.joinedRoundNoWorkoutSentAt || state.joinedRoundNoWorkoutSkippedAt) {
        skipped++;
        continue;
      }

      const createdAtMs = toMillis(data.createdAt ?? data.joinDate);
      if (!createdAtMs) {
        skipped++;
        continue;
      }

      const ageHours = (nowMs - createdAtMs) / (60 * 60 * 1000);
      if (ageHours < REMINDER_AFTER_HOURS || ageHours > MAX_DELAY_HOURS) {
        skipped++;
        continue;
      }

      if (getCompletedCount(data) > 0) {
        skipped++;
        continue;
      }

      try {
        const sendResult = await sendJoinedRoundNoWorkoutEmail({
          userId: data.userId,
          challengeId: data.challengeId,
          challengeTitle: getChallengeTitle(data),
          userChallengeId: doc.id,
        });

        const field = sendResult.skipped
          ? 'emailSequenceState.joinedRoundNoWorkoutSkippedAt'
          : 'emailSequenceState.joinedRoundNoWorkoutSentAt';

        await doc.ref.set(
          {
            [field]: new Date(),
            updatedAt: Math.floor(Date.now() / 1000),
          } as any,
          { merge: true } as any
        );

        if (sendResult.skipped) {
          skipped++;
        } else {
          sent++;
        }
      } catch (error) {
        console.warn('[schedule-joined-round-no-workout-email] Failed for doc:', doc.id, error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, scanned, sent, skipped }),
    };
  } catch (error: any) {
    console.error('[schedule-joined-round-no-workout-email] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }) };
  }
};
