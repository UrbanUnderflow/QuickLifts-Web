import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';

const REMINDER_AFTER_MINUTES = 30;
const BATCH_LIMIT = 200;

type ScheduleConfig = {
  enabled?: boolean;
  // "HH:MM" in UTC, constrained to 30-min increments by the admin UI
  sendTimeUtc?: string;
  // "YYYY-MM-DD" in UTC; used to enforce once/day execution
  lastRunDateUtc?: string;
};

function utcDateString(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shouldRunNow(now: Date, config: ScheduleConfig): boolean {
  if (config.enabled === false) return false;
  const sendTime = (config.sendTimeUtc || '14:00').trim(); // default 14:00 UTC
  const [hhStr, mmStr] = sendTime.split(':');
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
  return now.getUTCHours() === hh && now.getUTCMinutes() === mm;
}

async function sendReminder(userId: string) {
  const resp = await fetch('https://fitwithpulse.ai/.netlify/functions/send-username-reminder-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`send-username-reminder-email failed: ${resp.status} ${txt}`);
  }
}

export const handler: Handler = async () => {
  try {
    const db = await getFirestore();

    // Admin-configurable daily schedule time (stored in Firestore)
    const scheduleRef = db.collection('email-sequence-config').doc('username-reminder-v1');
    const now = new Date();

    const scheduleSnap = await scheduleRef.get();
    const scheduleData = (scheduleSnap.exists ? (scheduleSnap.data() as ScheduleConfig) : {}) || {};

    // Only run at the configured UTC time (checked every 30 minutes via netlify.toml)
    if (!shouldRunNow(now, scheduleData)) {
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0, skipped: true, reason: 'Not scheduled time' }) };
    }

    // Enforce once/day execution
    const today = utcDateString(now);
    if (scheduleData.lastRunDateUtc === today) {
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0, skipped: true, reason: 'Already ran today' }) };
    }

    // Mark as ran for today up-front to avoid duplicates if multiple invocations happen near the boundary
    await scheduleRef.set(
      {
        enabled: scheduleData.enabled !== false,
        sendTimeUtc: (scheduleData.sendTimeUtc || '14:00').trim(),
        lastRunDateUtc: today,
        updatedAt: new Date(),
      } as any,
      { merge: true } as any
    );

    const cutoff = new Date(Date.now() - REMINDER_AFTER_MINUTES * 60 * 1000);

    // Only users who haven't completed registration and haven't been reminded yet
    const querySnap = await db
      .collection('users')
      .where('registrationComplete', '==', false)
      .where('createdAt', '<=', cutoff)
      .limit(BATCH_LIMIT)
      .get();

    if (querySnap.empty) {
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }

    let processed = 0;
    for (const doc of querySnap.docs) {
      const data = doc.data() || {};

      // Skip if already reminded
      if (data.usernameReminderEmailSentAt) continue;

      // Skip if username exists anyway
      if (typeof data.username === 'string' && data.username.trim()) continue;

      try {
        await sendReminder(doc.id);
        processed++;
      } catch (e) {
        // Keep going; best-effort batch
        console.warn('[schedule-username-reminder-email] Failed for user:', doc.id, e);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, processed }) };
  } catch (e: any) {
    console.error('[schedule-username-reminder-email] Fatal error:', e);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: e?.message || 'Internal error' }) };
  }
};

