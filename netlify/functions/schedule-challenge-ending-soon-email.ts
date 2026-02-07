import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import { getBaseSiteUrl, toMillis } from './utils/emailSequenceHelpers';

const HOURS_24 = 24;
const HOURS_72 = 72;
const HOUR_MS = 60 * 60 * 1000;
const BATCH_LIMIT = 700;

function getChallengeTitle(data: Record<string, any>): string {
  const c = data?.challenge || {};
  return (
    (typeof c.title === 'string' && c.title.trim()) ||
    (typeof c.challengeTitle === 'string' && c.challengeTitle.trim()) ||
    (typeof c.name === 'string' && c.name.trim()) ||
    'your Pulse Round'
  );
}

function getChallengeEndMs(data: Record<string, any>): number | null {
  const c = data?.challenge || {};
  return toMillis(c.endDate ?? data.challengeEndDate ?? data.endDate);
}

function getCompletedCount(data: Record<string, any>): number {
  return Array.isArray(data?.completedWorkouts) ? data.completedWorkouts.length : 0;
}

function getTotalPlanned(data: Record<string, any>): number {
  const c = data?.challenge || {};
  if (Array.isArray(c.roundWorkouts)) return c.roundWorkouts.length;
  if (Array.isArray(c.workouts)) return c.workouts.length;
  if (Array.isArray(c.challengeWorkouts)) return c.challengeWorkouts.length;
  const count = Number(c.numberOfWorkouts || c.workoutCount || c.totalWorkouts || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function getBucketHours(hoursRemaining: number): number | null {
  if (hoursRemaining > 0 && hoursRemaining <= HOURS_24) return HOURS_24;
  if (hoursRemaining > HOURS_24 && hoursRemaining <= HOURS_72) return HOURS_72;
  return null;
}

async function sendChallengeEndingSoon(args: {
  userId?: string;
  challengeId?: string;
  challengeTitle: string;
  hoursRemaining: number;
  completedCount: number;
  totalPlanned: number;
}): Promise<{ skipped: boolean }> {
  const resp = await fetch(`${getBaseSiteUrl()}/.netlify/functions/send-challenge-ending-soon-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: args.userId,
      challengeId: args.challengeId,
      challengeTitle: args.challengeTitle,
      hoursRemaining: args.hoursRemaining,
      completedCount: args.completedCount,
      totalPlanned: args.totalPlanned,
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
    const nowSec = Math.floor(nowMs / 1000);
    const horizonSec = nowSec + HOURS_72 * 60 * 60 + 60 * 60; // +1h buffer

    const querySnap = await db
      .collection('user-challenge')
      .where('challenge.endDate', '>=', nowSec)
      .where('challenge.endDate', '<=', horizonSec)
      .orderBy('challenge.endDate', 'asc')
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
      if (data.isCompleted === true) {
        skipped++;
        continue;
      }

      const endMs = getChallengeEndMs(data);
      if (!endMs) {
        skipped++;
        continue;
      }

      const hoursRemaining = (endMs - nowMs) / HOUR_MS;
      const bucket = getBucketHours(hoursRemaining);
      if (!bucket) {
        skipped++;
        continue;
      }

      const state = (data.emailSequenceState || {}) as Record<string, any>;
      const sentField = bucket === HOURS_72 ? 'challengeEndingSoon72hSentAt' : 'challengeEndingSoon24hSentAt';
      const skippedField = bucket === HOURS_72 ? 'challengeEndingSoon72hSkippedAt' : 'challengeEndingSoon24hSkippedAt';
      if (state[sentField] || state[skippedField]) {
        skipped++;
        continue;
      }

      try {
        const sendResult = await sendChallengeEndingSoon({
          userId: data.userId,
          challengeId: data.challengeId,
          challengeTitle: getChallengeTitle(data),
          hoursRemaining: bucket,
          completedCount: getCompletedCount(data),
          totalPlanned: getTotalPlanned(data),
        });

        const stateField = sendResult.skipped
          ? `emailSequenceState.${skippedField}`
          : `emailSequenceState.${sentField}`;

        await doc.ref.set(
          {
            [stateField]: new Date(),
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
        console.warn('[schedule-challenge-ending-soon-email] Failed for doc:', doc.id, error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, scanned, sent, skipped }),
    };
  } catch (error: any) {
    console.error('[schedule-challenge-ending-soon-email] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }) };
  }
};
