import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import { getBaseSiteUrl, toMillis } from './utils/emailSequenceHelpers';

const STREAK_MILESTONES = [3, 7, 14, 30];
const LOOKBACK_DAYS = 31;
const RECENT_COMPLETION_HOURS = 48;
const BATCH_LIMIT = 700;
const CLAIM_STALE_MS = 2 * 60 * 60 * 1000;
const LOCK_COLLECTION = 'email-sequence-streak-milestones';

type CompletedWorkout = {
  completedAt?: any;
};

type ClaimState = {
  runId?: string;
  claimedAt?: any;
  dedupeKey?: string;
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

function normalizeKeyPart(value: any): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildMilestoneDedupeKey(data: Record<string, any>, docId: string, milestone: number): string {
  const userId = normalizeKeyPart(data.userId);
  const email = normalizeKeyPart(data.email);
  const docKey = normalizeKeyPart(docId);

  return [userId || email || docKey || 'unknown-user', String(milestone)].join('::');
}

async function claimMilestoneSend(args: {
  docRef: any;
  milestone: number;
  runId: string;
  dedupeKey: string;
  nowMs: number;
}): Promise<boolean> {
  const db = await getFirestore();
  const lockRef = db.collection(LOCK_COLLECTION).doc(args.dedupeKey);

  return db.runTransaction(async (tx) => {
    const snap = (await tx.get(args.docRef)) as any;
    const lockSnap = (await tx.get(lockRef)) as any;
    if (!snap.exists) return false;

    const data = (snap.data() || {}) as Record<string, any>;
    const state = (data.emailSequenceState || {}) as Record<string, any>;
    const sentMilestones = ((state.streakMilestonesSent || {}) as Record<string, any>) || {};
    if (sentMilestones[String(args.milestone)]) {
      return false;
    }

    const pendingMilestones = ((state.streakMilestonesPending || {}) as Record<string, ClaimState>) || {};
    const existingClaim = pendingMilestones[String(args.milestone)];
    if (existingClaim?.runId && existingClaim.runId !== args.runId) {
      const claimedAtMs = toMillis(existingClaim.claimedAt);
      const isFreshClaim = claimedAtMs !== null && args.nowMs - claimedAtMs < CLAIM_STALE_MS;
      if (isFreshClaim) {
        return false;
      }
    }

    const lockData = (lockSnap.data() || {}) as Record<string, any>;
    if (lockData.sentAt) {
      return false;
    }
    if (lockData.runId && lockData.runId !== args.runId) {
      const claimedAtMs = toMillis(lockData.claimedAt);
      const isFreshClaim = claimedAtMs !== null && args.nowMs - claimedAtMs < CLAIM_STALE_MS;
      if (isFreshClaim) {
        return false;
      }
    }

    tx.set(
      args.docRef,
      {
        [`emailSequenceState.streakMilestonesPending.${args.milestone}`]: {
          runId: args.runId,
          claimedAt: new Date(args.nowMs),
          dedupeKey: args.dedupeKey,
        },
      } as any,
      { merge: true } as any
    );
    tx.set(
      lockRef,
      {
        runId: args.runId,
        claimedAt: new Date(args.nowMs),
        dedupeKey: args.dedupeKey,
        milestone: args.milestone,
        sourceDocId: args.docRef.id,
        updatedAt: new Date(args.nowMs),
      } as any,
      { merge: true } as any
    );

    return true;
  });
}

async function finalizeMilestoneSend(args: {
  docRef: any;
  milestone: number;
  runId: string;
  dedupeKey: string;
  skipped: boolean;
}): Promise<void> {
  const db = await getFirestore();
  const FieldValue = initAdmin().firestore.FieldValue;
  const sentField = args.skipped
    ? `emailSequenceState.streakMilestonesSkipped.${args.milestone}`
    : `emailSequenceState.streakMilestonesSent.${args.milestone}`;
  const pendingField = `emailSequenceState.streakMilestonesPending.${args.milestone}`;
  const lockRef = db.collection(LOCK_COLLECTION).doc(args.dedupeKey);

  await db.runTransaction(async (tx) => {
    const snap = (await tx.get(args.docRef)) as any;
    const lockSnap = (await tx.get(lockRef)) as any;
    if (!snap.exists) return;

    const data = (snap.data() || {}) as Record<string, any>;
    const state = (data.emailSequenceState || {}) as Record<string, any>;
    const pendingMilestones = ((state.streakMilestonesPending || {}) as Record<string, ClaimState>) || {};
    const activeClaim = pendingMilestones[String(args.milestone)];

    if (activeClaim?.runId && activeClaim.runId !== args.runId) {
      return;
    }

    const lockData = (lockSnap.data() || {}) as Record<string, any>;
    if (lockData.runId && lockData.runId !== args.runId) {
      return;
    }

    tx.set(
      args.docRef,
      {
        [sentField]: new Date(),
        [pendingField]: FieldValue.delete(),
        updatedAt: Math.floor(Date.now() / 1000),
      } as any,
      { merge: true } as any
    );
    tx.set(
      lockRef,
      args.skipped
        ? {
            lastSkippedAt: new Date(),
            runId: FieldValue.delete(),
            claimedAt: FieldValue.delete(),
            updatedAt: new Date(),
          }
        : {
            sentAt: new Date(),
            runId: FieldValue.delete(),
            claimedAt: FieldValue.delete(),
            updatedAt: new Date(),
          },
      { merge: true } as any
    );
  });
}

async function releaseMilestoneClaim(args: {
  docRef: any;
  milestone: number;
  runId: string;
  dedupeKey: string;
}): Promise<void> {
  const db = await getFirestore();
  const FieldValue = initAdmin().firestore.FieldValue;
  const pendingField = `emailSequenceState.streakMilestonesPending.${args.milestone}`;
  const lockRef = db.collection(LOCK_COLLECTION).doc(args.dedupeKey);

  await db.runTransaction(async (tx) => {
    const snap = (await tx.get(args.docRef)) as any;
    const lockSnap = (await tx.get(lockRef)) as any;
    if (!snap.exists) return;

    const data = (snap.data() || {}) as Record<string, any>;
    const state = (data.emailSequenceState || {}) as Record<string, any>;
    const pendingMilestones = ((state.streakMilestonesPending || {}) as Record<string, ClaimState>) || {};
    const activeClaim = pendingMilestones[String(args.milestone)];

    if (!activeClaim?.runId || activeClaim.runId !== args.runId) {
      return;
    }

    tx.set(
      args.docRef,
      {
        [pendingField]: FieldValue.delete(),
      } as any,
      { merge: true } as any
    );

    const lockData = (lockSnap.data() || {}) as Record<string, any>;
    if (lockData.runId && lockData.runId === args.runId) {
      tx.set(
        lockRef,
        {
          runId: FieldValue.delete(),
          claimedAt: FieldValue.delete(),
          updatedAt: new Date(),
        } as any,
        { merge: true } as any
      );
    }
  });
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
    const runId = `streak-${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
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

      const dedupeKey = buildMilestoneDedupeKey(data, doc.id, milestone);
      if (claimedDedupeKeys.has(dedupeKey)) {
        skipped++;
        continue;
      }

      const claimed = await claimMilestoneSend({
        docRef: doc.ref,
        milestone,
        runId,
        dedupeKey,
        nowMs,
      });

      if (!claimed) {
        skipped++;
        continue;
      }

      claimedDedupeKeys.add(dedupeKey);

      try {
        const sendResult = await sendStreakMilestone({
          userId: data.userId,
          challengeId: data.challengeId,
          challengeTitle: getChallengeTitle(data),
          milestone,
          currentStreak,
        });

        await finalizeMilestoneSend({
          docRef: doc.ref,
          milestone,
          runId,
          dedupeKey,
          skipped: sendResult.skipped,
        });

        if (sendResult.skipped) {
          skipped++;
        } else {
          sent++;
        }
      } catch (error) {
        claimedDedupeKeys.delete(dedupeKey);
        await releaseMilestoneClaim({
          docRef: doc.ref,
          milestone,
          runId,
          dedupeKey,
        }).catch((releaseError) => {
          console.warn('[schedule-streak-milestone-email] Failed to release claim:', doc.id, releaseError);
        });
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
