import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import { getBaseSiteUrl, toMillis } from './utils/emailSequenceHelpers';

const STREAK_MILESTONES = [3, 7, 14, 30];
const LOOKBACK_DAYS = 31;
const RECENT_COMPLETION_HOURS = 48;
const BATCH_LIMIT = 700;

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

function getLatestCompletionMs(completedWorkouts: CompletedWorkout[]): number | null {
  let maxMs: number | null = null;
  for (const cw of completedWorkouts) {
    const ms = toMillis(cw?.completedAt);
    if (!ms) continue;
    maxMs = maxMs === null ? ms : Math.max(maxMs, ms);
  }
  return maxMs;
}

function getNextMilestone(currentStreak: number, sentState: Record<string, any>): number | null {
  const candidates = STREAK_MILESTONES.filter((m) => currentStreak >= m && !sentState[String(m)]);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

async function sendStreakMilestone(args: {
  userId?: string;
  challengeId?: string;
  challengeTitle: string;
  milestone: number;
  currentStreak: number;
}): Promise<{ skipped: boolean }> {
  const resp = await fetch(`${getBaseSiteUrl()}/.netlify/functions/send-streak-milestone-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: args.userId,
      challengeId: args.challengeId,
      challengeTitle: args.challengeTitle,
      milestone: args.milestone,
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
    const lookbackSec = Math.floor((nowMs - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000);

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
      const currentStreak = Number(data.currentStreak || 0) || 0;
      if (currentStreak < STREAK_MILESTONES[0]) {
        skipped++;
        continue;
      }

      const completedWorkouts = getCompletedWorkouts(data);
      if (completedWorkouts.length === 0) {
        skipped++;
        continue;
      }

      const latestCompletionMs = getLatestCompletionMs(completedWorkouts);
      if (!latestCompletionMs) {
        skipped++;
        continue;
      }

      const completionAgeHours = (nowMs - latestCompletionMs) / (60 * 60 * 1000);
      if (completionAgeHours < 0 || completionAgeHours > RECENT_COMPLETION_HOURS) {
        skipped++;
        continue;
      }

      const state = (data.emailSequenceState || {}) as Record<string, any>;
      const sentMilestones = ((state.streakMilestonesSent || {}) as Record<string, any>) || {};
      const milestone = getNextMilestone(currentStreak, sentMilestones);

      if (!milestone) {
        skipped++;
        continue;
      }

      try {
        const sendResult = await sendStreakMilestone({
          userId: data.userId,
          challengeId: data.challengeId,
          challengeTitle: getChallengeTitle(data),
          milestone,
          currentStreak,
        });

        const baseField = sendResult.skipped
          ? `emailSequenceState.streakMilestonesSkipped.${milestone}`
          : `emailSequenceState.streakMilestonesSent.${milestone}`;

        await doc.ref.set(
          {
            [baseField]: new Date(),
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
        console.warn('[schedule-streak-milestone-email] Failed for doc:', doc.id, error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, scanned, sent, skipped }),
    };
  } catch (error: any) {
    console.error('[schedule-streak-milestone-email] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }) };
  }
};
