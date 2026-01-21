import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';

/**
 * Scheduled Mental Assignment Reminder Notifications
 *
 * Sends a push notification if, by the user's preferred local time (default: 12:00),
 * the user has NOT completed any of their active assigned mental exercises for the day.
 *
 * Scheduling strategy:
 * - Run every 30 minutes (UTC)
 * - For each user with reminders enabled, compute their local time via timezone
 * - If within a 30-minute window of their reminder time, check completions for "today" in that timezone
 *
 * Firestore schema (additive):
 * users/{userId}.mentalTrainingPreferences.assignmentReminders = {
 *   enabled: boolean,
 *   mode: "smart" | "custom",
 *   hour: number,          // 0-23
 *   minute: number,        // 0-59
 *   timezone: string,      // IANA tz
 *   lastSentLocalDate: string, // YYYY-MM-DD (in user's local timezone)
 *   updatedAt: Timestamp
 * }
 */

const BATCH_LIMIT = 500;
const WINDOW_MINUTES = 30;

function isWithinWindow(
  currentHour: number,
  currentMinute: number,
  targetHour: number,
  targetMinute: number,
  windowMinutes: number
): boolean {
  const current = currentHour * 60 + currentMinute;
  const target = targetHour * 60 + targetMinute;
  return Math.abs(current - target) <= windowMinutes;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Convert "local day" boundaries to UTC epoch ms for querying completions.
 * Uses the same timezone conversion technique as our daily reflection scheduler.
 */
function getLocalDayRangeUtcMs(nowUtc: Date, timeZone: string): { startUtcMs: number; endUtcMs: number; localDateStr: string } {
  const userLocalNowAsDate = new Date(nowUtc.toLocaleString('en-US', { timeZone }));
  const offsetMs = nowUtc.getTime() - userLocalNowAsDate.getTime();

  const userLocalMidnightAsDate = new Date(userLocalNowAsDate);
  userLocalMidnightAsDate.setHours(0, 0, 0, 0);

  const startUtcMs = userLocalMidnightAsDate.getTime() + offsetMs;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return { startUtcMs, endUtcMs, localDateStr: formatYmd(userLocalNowAsDate) };
}

async function sendNotification(
  messaging: any,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const message = {
      token: fcmToken,
      notification: { title, body },
      data,
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            badge: 1,
            sound: 'default',
          },
        },
      },
      android: {
        priority: 'high' as const,
        notification: { sound: 'default' },
      },
    };

    const messageId = await messaging.send(message);
    return { success: true, messageId };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}

export const handler: Handler = async () => {
  const admin = initAdmin();
  const db = await getFirestore();
  const messaging = admin.messaging();

  const nowUtc = new Date();
  const runId = `${nowUtc.toISOString()}`;
  console.log('[scheduled-mental-assignment-reminder] Run start', { runId });

  // Users with tokens (filter reminder settings in code to avoid index headaches)
  const usersSnap = await db.collection('users').where('fcmToken', '!=', null).limit(BATCH_LIMIT).get();
  if (usersSnap.empty) {
    console.log('[scheduled-mental-assignment-reminder] No users with fcmToken');
    return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
  }

  let processed = 0;
  let considered = 0;
  let eligible = 0;
  let notified = 0;
  let skippedAlreadySent = 0;
  let skippedCompleted = 0;
  let skippedNoAssignments = 0;
  let failed = 0;
  const errors: Array<{ userId: string; error: string }> = [];

  for (const userDoc of usersSnap.docs) {
    processed++;
    const userId = userDoc.id;
    const userData = userDoc.data() || {};
    const fcmToken = userData.fcmToken;
    if (!fcmToken || typeof fcmToken !== 'string') continue;

    const prefs = userData.mentalTrainingPreferences?.assignmentReminders;
    const enabled = prefs?.enabled === true;
    if (!enabled) continue;

    considered++;

    const timeZone =
      prefs?.timezone ||
      userData.dailyReflectionPreferences?.timezone ||
      userData.timezone ||
      'UTC';

    const hour = Number.isFinite(prefs?.hour) ? Number(prefs.hour) : 12;
    const minute = Number.isFinite(prefs?.minute) ? Number(prefs.minute) : 0;

    let userLocalNow: Date;
    try {
      userLocalNow = new Date(nowUtc.toLocaleString('en-US', { timeZone }));
    } catch (e: any) {
      // Bad timezone stored
      failed++;
      if (errors.length < 10) errors.push({ userId, error: `Invalid timezone "${timeZone}": ${e?.message || String(e)}` });
      continue;
    }

    const localHour = userLocalNow.getHours();
    const localMinute = userLocalNow.getMinutes();

    // Only evaluate users near their reminder time
    if (!isWithinWindow(localHour, localMinute, hour, minute, WINDOW_MINUTES)) continue;

    const { startUtcMs, endUtcMs, localDateStr } = getLocalDayRangeUtcMs(nowUtc, timeZone);

    // Idempotency per-user-per-local-day
    if (prefs?.lastSentLocalDate === localDateStr) {
      skippedAlreadySent++;
      continue;
    }

    eligible++;

    // Fetch active assignments (pending or in_progress)
    const assignmentsSnap = await db
      .collection('mental-exercise-assignments')
      .where('athleteUserId', '==', userId)
      .where('status', 'in', ['pending', 'in_progress'])
      .get();

    if (assignmentsSnap.empty) {
      skippedNoAssignments++;
      continue;
    }

    const activeAssignmentIds = assignmentsSnap.docs.map((d: any) => d.id);

    // Check for any completion today tied to an active assignment
    const completionsSnap = await db
      .collection('mental-exercise-completions')
      .doc(userId)
      .collection('completions')
      .where('completedAt', '>=', startUtcMs)
      .where('completedAt', '<', endUtcMs)
      .limit(50)
      .get();

    const completedAssignmentIds = new Set<string>();
    for (const c of completionsSnap.docs) {
      const cd = c.data() || {};
      if (cd.assignmentId) completedAssignmentIds.add(String(cd.assignmentId));
    }

    const hasCompletedAnyActiveAssignment = activeAssignmentIds.some((id: string) => completedAssignmentIds.has(id));
    if (hasCompletedAnyActiveAssignment) {
      skippedCompleted++;
      continue;
    }

    const title = '🧠 Mental training reminder';
    const body = `You still have an assigned exercise to complete today.`;
    const data = {
      type: 'MENTAL_ASSIGNMENT_REMINDER',
      timestamp: String(Date.now()),
      localDate: localDateStr,
    };

    const result = await sendNotification(messaging, fcmToken, title, body, data);
    if (!result.success) {
      failed++;
      if (errors.length < 10) errors.push({ userId, error: result.error || 'Unknown error' });
      continue;
    }

    notified++;

    // Persist idempotency marker
    await db.collection('users').doc(userId).set(
      {
        mentalTrainingPreferences: {
          assignmentReminders: {
            ...prefs,
            lastSentLocalDate: localDateStr,
            updatedAt: new Date(),
          },
        },
      },
      { merge: true }
    );
  }

  await db.collection('notification-logs').add({
    type: 'MENTAL_ASSIGNMENT_REMINDER_BATCH',
    runAt: new Date(),
    runId,
    processed,
    considered,
    eligible,
    notified,
    skippedAlreadySent,
    skippedCompleted,
    skippedNoAssignments,
    failed,
    errors: errors.slice(0, 10),
  });

  console.log('[scheduled-mental-assignment-reminder] Run complete', {
    runId,
    processed,
    considered,
    eligible,
    notified,
    skippedAlreadySent,
    skippedCompleted,
    skippedNoAssignments,
    failed,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      processed,
      considered,
      eligible,
      notified,
      failed,
    }),
  };
};

