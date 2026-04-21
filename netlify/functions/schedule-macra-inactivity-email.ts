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

/**
 * Scheduled Macra Inactivity Winback
 *
 * Sends the Macra inactivity winback email at 3/7/14 day marks since the
 * user's last food log (`users.lastMacraLogAt`, written by the iOS
 * EntryService). Respects `users.macraEmailPreferences.inactivityWinback`.
 *
 * State lives under `macraEmailSequenceState` on the user doc.
 */

const INACTIVITY_MILESTONES = [3, 7, 14];
const BATCH_LIMIT = 500;

function chooseMilestone(daysInactive: number, sentState: Record<string, any>): number | null {
  const candidates = INACTIVITY_MILESTONES.filter((m) => daysInactive >= m && !sentState[String(m)]);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

async function sendWinback(args: { userId: string; daysInactive: number }): Promise<{ skipped: boolean }> {
  const resp = await fetch(`${getBaseSiteUrl()}/.netlify/functions/send-macra-inactivity-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: args.userId, daysInactive: args.daysInactive }),
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
    const runId = `macra-inactivity-${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
    const claimedDedupeKeys = new Set<string>();

    const snap = await db
      .collection('users')
      .where('hasCompletedMacraOnboarding', '==', true)
      .limit(BATCH_LIMIT)
      .get();

    if (snap.empty) {
      return { statusCode: 200, body: JSON.stringify({ success: true, scanned: 0, sent: 0, skipped: 0 }) };
    }

    let scanned = 0;
    let sent = 0;
    let skipped = 0;

    for (const doc of snap.docs) {
      scanned++;
      const data = (doc.data() || {}) as Record<string, any>;
      const prefs = data.macraEmailPreferences || {};
      if (prefs.inactivityWinback === false) {
        skipped++;
        continue;
      }

      const lastLogMs = toMillis(data.lastMacraLogAt);
      if (!lastLogMs) {
        skipped++;
        continue;
      }

      const daysInactive = Math.floor((nowMs - lastLogMs) / (24 * 60 * 60 * 1000));
      if (daysInactive < INACTIVITY_MILESTONES[0]) {
        skipped++;
        continue;
      }

      const state = (data.macraEmailSequenceState || {}) as Record<string, any>;
      const sentMilestones = ((state.inactivityWinbackSent || {}) as Record<string, any>) || {};
      const milestone = chooseMilestone(daysInactive, sentMilestones);
      if (!milestone) {
        skipped++;
        continue;
      }

      const pendingField = `macraEmailSequenceState.inactivityWinbackPending.${milestone}`;
      const dedupeKey = buildEmailDedupeKey(['macra-inactivity-winback-v1', doc.id, milestone]);
      if (claimedDedupeKeys.has(dedupeKey)) {
        skipped++;
        continue;
      }

      const claimed = await claimScheduledSequenceSend({
        docRef: doc.ref,
        pendingField,
        completionFields: [
          `macraEmailSequenceState.inactivityWinbackSent.${milestone}`,
          `macraEmailSequenceState.inactivityWinbackSkipped.${milestone}`,
        ],
        dedupeKey,
        runId,
        nowMs,
        metadata: {
          sequence: 'macra-inactivity-winback-v1',
          userId: doc.id,
          milestone,
        },
      });
      if (!claimed) {
        skipped++;
        continue;
      }
      claimedDedupeKeys.add(dedupeKey);

      try {
        const sendResult = await sendWinback({ userId: doc.id, daysInactive: milestone });
        const stateField = sendResult.skipped
          ? `macraEmailSequenceState.inactivityWinbackSkipped.${milestone}`
          : `macraEmailSequenceState.inactivityWinbackSent.${milestone}`;

        await finalizeScheduledSequenceSend({
          docRef: doc.ref,
          pendingField,
          resultField: stateField,
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
          console.warn('[schedule-macra-inactivity-email] Failed to release claim:', doc.id, releaseError);
        });
        console.warn('[schedule-macra-inactivity-email] Failed for doc:', doc.id, error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, scanned, sent, skipped }),
    };
  } catch (error: any) {
    console.error('[schedule-macra-inactivity-email] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }) };
  }
};
