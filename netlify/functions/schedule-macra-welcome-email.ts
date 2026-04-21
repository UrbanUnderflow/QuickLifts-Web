import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import { getBaseSiteUrl } from './utils/emailSequenceHelpers';

/**
 * Safety-net sweeper for the Macra welcome email.
 *
 * Only emails users who completed onboarding recently (within FRESHNESS_WINDOW_MS)
 * via the iOS flow, which writes `macraOnboardingCompletedAt`. Legacy users who
 * have `hasCompletedMacraOnboarding: true` but no timestamp (i.e. completed
 * onboarding before the email feature existed) are intentionally skipped — this
 * is a new-signup sequence, not a retroactive backfill.
 *
 * Schedule: see netlify.toml — runs hourly.
 */

const BATCH_LIMIT = 200;
const FRESHNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function toEpochMs(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'object' && value !== null) {
    const anyVal = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof anyVal.toDate === 'function') {
      try { return anyVal.toDate().getTime(); } catch { /* fallthrough */ }
    }
    const secs = anyVal._seconds ?? anyVal.seconds;
    if (typeof secs === 'number') return secs * 1000;
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

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

    const now = Date.now();
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

      const completedAtMs = toEpochMs(data.macraOnboardingCompletedAt);
      if (completedAtMs === null) {
        skipped++;
        continue;
      }
      if (now - completedAtMs > FRESHNESS_WINDOW_MS) {
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
