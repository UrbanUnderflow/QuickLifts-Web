import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import { getBaseSiteUrl } from './utils/emailSequenceHelpers';

/**
 * Safety-net sweeper for the Macra welcome email.
 *
 * The iOS client calls `send-macra-welcome-email` directly once the user
 * finishes the notification preferences onboarding step — but if the app
 * is killed mid-flow, the HTTP call may never land. This sweeper finds
 * users with `hasCompletedMacraOnboarding === true` and no
 * `macraWelcomeEmailSentAt` and dispatches the welcome. The downstream
 * function is idempotent (server-side checks `macraWelcomeEmailSentAt`),
 * so running alongside the client trigger is safe.
 *
 * Schedule: see netlify.toml — runs hourly.
 */

const BATCH_LIMIT = 200;

async function sendWelcome(args: { userId: string }): Promise<{ skipped: boolean }> {
  const resp = await fetch(`${getBaseSiteUrl()}/.netlify/functions/send-macra-welcome-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: args.userId }),
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
      if (data.macraWelcomeEmailSentAt) {
        skipped++;
        continue;
      }
      if (!data.email) {
        skipped++;
        continue;
      }

      try {
        const result = await sendWelcome({ userId: doc.id });
        if (result.skipped) {
          skipped++;
        } else {
          sent++;
        }
      } catch (err: any) {
        console.warn('[schedule-macra-welcome-email] failed for user', doc.id, err?.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, scanned, sent, skipped }),
    };
  } catch (error: any) {
    console.error('[schedule-macra-welcome-email] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }) };
  }
};
