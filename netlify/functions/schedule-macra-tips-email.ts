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
 * Scheduled Macra Tips Series
 *
 * Dispatches Nora tip emails on day 2, 4, and 7 after Macra onboarding.
 * Anchor: `users.macraWelcomeEmailSentAt` (or `users.updatedAt` fallback).
 * Respects `users.macraEmailPreferences.tipsSeries`.
 *
 * State lives under `macraEmailSequenceState.tipsSent.<tipId>`.
 */

type TipId = 'day2' | 'day4' | 'day7';

const TIPS: Array<{ dayOffset: number; tipId: TipId }> = [
  { dayOffset: 2, tipId: 'day2' },
  { dayOffset: 4, tipId: 'day4' },
  { dayOffset: 7, tipId: 'day7' },
];

const BATCH_LIMIT = 500;

async function sendTip(args: { userId: string; tipId: TipId }): Promise<{ skipped: boolean }> {
  const resp = await fetch(`${getBaseSiteUrl()}/.netlify/functions/send-macra-tips-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: args.userId, tipId: args.tipId }),
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
    const runId = `macra-tips-${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
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
      if (prefs.tipsSeries === false) {
        skipped++;
        continue;
      }

      const anchorMs = toMillis(data.macraWelcomeEmailSentAt) ?? toMillis(data.updatedAt);
      if (!anchorMs) {
        skipped++;
        continue;
      }

      const daysSinceAnchor = Math.floor((nowMs - anchorMs) / (24 * 60 * 60 * 1000));
      const state = (data.macraEmailSequenceState || {}) as Record<string, any>;
      const tipsSent = ((state.tipsSent || {}) as Record<string, any>) || {};
      const eligible = TIPS
        .filter((t) => daysSinceAnchor >= t.dayOffset && !tipsSent[t.tipId])
        .sort((a, b) => b.dayOffset - a.dayOffset)[0];
      if (!eligible) {
        skipped++;
        continue;
      }

      const pendingField = `macraEmailSequenceState.tipsPending.${eligible.tipId}`;
      const dedupeKey = buildEmailDedupeKey(['macra-tips-v1', doc.id, eligible.tipId]);
      if (claimedDedupeKeys.has(dedupeKey)) {
        skipped++;
        continue;
      }

      const claimed = await claimScheduledSequenceSend({
        docRef: doc.ref,
        pendingField,
        completionFields: [
          `macraEmailSequenceState.tipsSent.${eligible.tipId}`,
          `macraEmailSequenceState.tipsSkipped.${eligible.tipId}`,
        ],
        dedupeKey,
        runId,
        nowMs,
        metadata: {
          sequence: 'macra-tips-v1',
          userId: doc.id,
          tipId: eligible.tipId,
        },
      });
      if (!claimed) {
        skipped++;
        continue;
      }
      claimedDedupeKeys.add(dedupeKey);

      try {
        const sendResult = await sendTip({ userId: doc.id, tipId: eligible.tipId });
        const stateField = sendResult.skipped
          ? `macraEmailSequenceState.tipsSkipped.${eligible.tipId}`
          : `macraEmailSequenceState.tipsSent.${eligible.tipId}`;

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
          console.warn('[schedule-macra-tips-email] Failed to release claim:', doc.id, releaseError);
        });
        console.warn('[schedule-macra-tips-email] Failed for doc:', doc.id, error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, scanned, sent, skipped }),
    };
  } catch (error: any) {
    console.error('[schedule-macra-tips-email] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }) };
  }
};
