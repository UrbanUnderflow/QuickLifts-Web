import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import {
  detectTriggers,
  type TriggerCandidate,
} from '../../src/api/firebase/noraConversation/triggerDetector';
import {
  openConversationFromTrigger,
} from '../../src/api/firebase/noraConversation/orchestrator';
import { getConversationBranch } from '../../src/api/firebase/adaptiveFramingLayer/service';
import {
  loadPulseCheckNudgeSuppressionState,
  resolvePulseCheckPushTarget,
} from './pulsecheck-notification-utils';

/**
 * Scheduled Nora Conversation Trigger Sweep (Phase D)
 *
 * Runs every 30 minutes UTC. For each enrolled athlete:
 *   1. Compute their athlete-local dayKey
 *   2. detectTriggers() → returns 0..N candidates
 *   3. For each candidate, look up matching ConversationBranch from
 *      pulsecheck-conversation-tree
 *   4. openConversationFromTrigger() — dedupes via pulsecheck-nora-trigger-fires
 *   5. Send the opener as a push notification via FCM
 *
 * Out of scope here: athlete reply ingestion (separate endpoint
 * `nora-athlete-reply`), action-delivery generation (server-driven
 * once reply lands).
 */

const BATCH_LIMIT = 500;

const formatYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const localNowFor = (nowUtc: Date, timeZone: string): Date =>
  new Date(nowUtc.toLocaleString('en-US', { timeZone }));

const sendPush = async (
  messaging: any,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const messageId = await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data,
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    return { success: true, messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
};

const triggerToBranchId = (trigger: string): string => trigger;

export const handler: Handler = async () => {
  await initAdmin();
  const db = getFirestore();
  const messaging = (await import('firebase-admin')).messaging();
  const nowUtc = new Date();

  // Enumerate athletes via team memberships.
  const memSnap = await db
    .collection('pulsecheck-team-memberships')
    .where('role', '==', 'athlete')
    .limit(BATCH_LIMIT)
    .get();

  const summary = {
    candidates: 0,
    triggersFired: 0,
    conversationsOpened: 0,
    pushesSent: 0,
    skippedSuppressed: 0,
    skippedDeduped: 0,
    errors: 0,
  };

  for (const mem of memSnap.docs) {
    const m = mem.data();
    if (!m.userId) continue;
    summary.candidates += 1;
    const tz = (m.timezone as string | undefined) || 'America/New_York';
    const localNow = localNowFor(nowUtc, tz);
    const dayKey = formatYmd(localNow);

    // Suppression check.
    let suppression: { suppressed: boolean } = { suppressed: false };
    try {
      suppression = (await loadPulseCheckNudgeSuppressionState(db, m.userId)) || { suppressed: false };
    } catch {
      /* tolerate */
    }
    if (suppression.suppressed) {
      summary.skippedSuppressed += 1;
      continue;
    }

    let candidates: TriggerCandidate[] = [];
    try {
      candidates = await detectTriggers({ athleteUserId: m.userId, dayKey }, db);
    } catch (err) {
      summary.errors += 1;
      continue;
    }
    if (candidates.length === 0) continue;

    summary.triggersFired += candidates.length;

    for (const candidate of candidates) {
      const branchId = triggerToBranchId(candidate.trigger);
      let branch = await getConversationBranch(branchId).catch(() => null);
      if (!branch) {
        // Fallback: try a trigger-only branch id.
        branch = await getConversationBranch(candidate.trigger).catch(() => null);
      }
      if (!branch) continue;

      let conversation;
      try {
        conversation = await openConversationFromTrigger(
          {
            athleteUserId: m.userId,
            teamId: m.teamId,
            trigger: candidate.trigger,
            branch,
            actionDomain: candidate.actionDomain,
            evidence: candidate.evidence,
            dayKey,
            treeRevisionId: branch.revisionId,
          },
          { firestore: db },
        );
      } catch (err) {
        summary.errors += 1;
        continue;
      }

      // openConversationFromTrigger dedupes — if it returned a pre-existing
      // conversation, skip the opener push.
      const isFreshOpen =
        conversation.turns.length === 1 &&
        Math.abs((conversation.openedAt as number) - Date.now()) < 60_000;
      if (!isFreshOpen) {
        summary.skippedDeduped += 1;
        continue;
      }
      summary.conversationsOpened += 1;

      // Send opener push.
      const userSnap = await db.collection('users').doc(m.userId).get();
      if (!userSnap.exists) continue;
      const userData = userSnap.data() as Record<string, unknown> | undefined;
      if (!userData) continue;
      const target = resolvePulseCheckPushTarget(userData);
      if (!target?.fcmToken) continue;
      const opener = conversation.turns[0];
      const result = await sendPush(messaging, target.fcmToken, 'Pulse', opener.text, {
        type: 'nora_conversation',
        conversationId: conversation.id,
        trigger: candidate.trigger,
      });
      if (result.success) summary.pushesSent += 1;
      else summary.errors += 1;
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, summary }) };
};

export const __internal = {
  triggerToBranchId,
};
