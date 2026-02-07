import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import { getBaseSiteUrl, toMillis } from './utils/emailSequenceHelpers';

const INACTIVITY_MILESTONES = [3, 7, 14];
const LOOKBACK_DAYS = 45;
const BATCH_LIMIT = 900;

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

function getChallengeEndMs(data: Record<string, any>): number | null {
  const c = data?.challenge || {};
  return toMillis(c.endDate ?? data.challengeEndDate ?? data.endDate);
}

function getLatestCompletionMs(data: Record<string, any>): number | null {
  const workouts = (Array.isArray(data?.completedWorkouts) ? data.completedWorkouts : []) as CompletedWorkout[];
  let maxMs: number | null = null;
  for (const cw of workouts) {
    const ms = toMillis(cw?.completedAt);
    if (!ms) continue;
    maxMs = maxMs === null ? ms : Math.max(maxMs, ms);
  }
  return maxMs;
}

function getLastMeaningfulActivityMs(data: Record<string, any>): number | null {
  const fromLastActive = toMillis(data.lastActive);
  if (fromLastActive) return fromLastActive;

  const fromCompletedWorkouts = getLatestCompletionMs(data);
  if (fromCompletedWorkouts) return fromCompletedWorkouts;

  const fromUpdatedAt = toMillis(data.updatedAt);
  if (fromUpdatedAt) return fromUpdatedAt;

  return toMillis(data.createdAt ?? data.joinDate);
}

function chooseMilestone(daysInactive: number, sentState: Record<string, any>): number | null {
  const candidates = INACTIVITY_MILESTONES.filter((m) => daysInactive >= m && !sentState[String(m)]);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

async function sendInactivityWinback(args: {
  userId?: string;
  challengeId?: string;
  challengeTitle: string;
  daysInactive: number;
}): Promise<{ skipped: boolean }> {
  const resp = await fetch(`${getBaseSiteUrl()}/.netlify/functions/send-inactivity-winback-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: args.userId,
      challengeId: args.challengeId,
      challengeTitle: args.challengeTitle,
      daysInactive: args.daysInactive,
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
      if (data.isCompleted === true) {
        skipped++;
        continue;
      }

      const endMs = getChallengeEndMs(data);
      if (endMs && endMs < nowMs - 24 * 60 * 60 * 1000) {
        skipped++;
        continue;
      }

      const activityMs = getLastMeaningfulActivityMs(data);
      if (!activityMs) {
        skipped++;
        continue;
      }

      const inactivityDays = Math.floor((nowMs - activityMs) / (24 * 60 * 60 * 1000));
      if (inactivityDays < INACTIVITY_MILESTONES[0]) {
        skipped++;
        continue;
      }

      const state = (data.emailSequenceState || {}) as Record<string, any>;
      const sentMilestones = ((state.inactivityWinbackSent || {}) as Record<string, any>) || {};
      const milestone = chooseMilestone(inactivityDays, sentMilestones);
      if (!milestone) {
        skipped++;
        continue;
      }

      try {
        const sendResult = await sendInactivityWinback({
          userId: data.userId,
          challengeId: data.challengeId,
          challengeTitle: getChallengeTitle(data),
          daysInactive: milestone,
        });

        const stateField = sendResult.skipped
          ? `emailSequenceState.inactivityWinbackSkipped.${milestone}`
          : `emailSequenceState.inactivityWinbackSent.${milestone}`;

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
        console.warn('[schedule-inactivity-winback-email] Failed for doc:', doc.id, error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, scanned, sent, skipped }),
    };
  } catch (error: any) {
    console.error('[schedule-inactivity-winback-email] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }) };
  }
};
