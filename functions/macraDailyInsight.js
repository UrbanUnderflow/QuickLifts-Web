/**
 * Scheduled Macra Daily Insight
 *
 * Hourly: finds Macra users whose local evening window matches the
 * current UTC hour, calls the netlify generate-macra-daily-insight
 * function with an internal token, and pushes a notification with the
 * generated insight title/body.
 *
 * The netlify function pulls the rich context (14d meals, FWP training,
 * weight trend, sport, distribution, frequent foods) and persists the
 * insight to users/{uid}/macraInsights/{dayKey} so the iOS app reads it
 * directly from Firestore instead of generating on-device.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

const INSIGHT_TOKEN = defineSecret('MACRA_INSIGHT_INTERNAL_TOKEN');

const NETLIFY_FUNCTION_URL =
  process.env.MACRA_INSIGHT_FUNCTION_URL ||
  'https://fitwithpulse.ai/.netlify/functions/generate-macra-daily-insight';

const DEFAULT_EVENING_HOUR = 19;

function resolveTimezone(userData = {}) {
  const candidates = [
    userData?.macraNotificationPreferences?.timezone,
    userData?.dailyReflectionPreferences?.timezone,
    userData?.timezone,
  ];
  return candidates.find((tz) => typeof tz === 'string' && tz.trim().length > 0) || 'America/New_York';
}

function resolveEveningHour(userData = {}) {
  const macraHour = userData?.macraNotificationPreferences?.endOfDayReminderTime?.hour;
  if (typeof macraHour === 'number' && macraHour >= 0 && macraHour <= 23) return macraHour;
  return DEFAULT_EVENING_HOUR;
}

function resolveMacraFcmToken(userData = {}) {
  const candidates = [
    userData?.macraFcmToken,
    userData?.fcmToken,
    userData?.pushTokens?.macra,
  ];
  return candidates.find((token) => typeof token === 'string' && token.trim().length > 0) || '';
}

function localHourInTz(date, timezone) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', hour12: false });
    const part = fmt.formatToParts(date).find((p) => p.type === 'hour');
    return part ? parseInt(part.value, 10) : null;
  } catch (err) {
    console.warn(`Timezone parse failed for ${timezone}: ${err.message}`);
    return null;
  }
}

async function selectUsersForCurrentHour(now) {
  const usersSnap = await db.collection('users')
    .where('hasCompletedMacraOnboarding', '==', true)
    .limit(2000)
    .get();

  const targets = [];
  for (const doc of usersSnap.docs) {
    const data = doc.data() || {};
    const tz = resolveTimezone(data);
    const evening = resolveEveningHour(data);
    const localHour = localHourInTz(now, tz);
    if (localHour === null) continue;
    if (localHour !== evening) continue;

    const fcmToken = resolveMacraFcmToken(data);
    targets.push({ userId: doc.id, timezone: tz, fcmToken });
  }
  return targets;
}

async function generateInsight(userId, timezone, internalToken) {
  const response = await fetch(NETLIFY_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-macra-internal-token': internalToken,
    },
    body: JSON.stringify({ userId, timezone, persist: true }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`[macraDailyInsight] generate failed for ${userId}: ${response.status} ${text.slice(0, 200)}`);
    return null;
  }
  try {
    const json = JSON.parse(text);
    if (json.skipped) {
      return null;
    }
    return json.insight || null;
  } catch {
    return null;
  }
}

async function sendInsightPush(userId, fcmToken, insight) {
  if (!fcmToken || !insight) return { success: false, reason: 'missing_token_or_insight' };

  const message = {
    token: fcmToken,
    notification: {
      title: insight.title || "Today's read from Nora",
      body: insight.response?.slice(0, 180) || 'Open Macra to see your daily insight.',
    },
    data: {
      type: 'MACRA_DAILY_INSIGHT',
      insightType: insight.type || 'pattern',
      dayKey: new Date().toISOString().slice(0, 10),
      timestamp: String(Math.floor(Date.now() / 1000)),
      screen: 'macra_journal',
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: insight.title || "Today's read from Nora",
            body: insight.response?.slice(0, 180) || '',
          },
          sound: 'default',
          'content-available': 1,
        },
      },
    },
  };

  try {
    const response = await messaging.send(message);
    console.log(`✅ Macra insight push sent to ${userId}: ${response}`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Macra insight push failed for ${userId}: ${err.message}`);
    return { success: false, reason: err.message };
  }
}

exports.scheduledMacraDailyInsight = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: [INSIGHT_TOKEN],
  },
  async () => {
    const now = new Date();
    console.log('🥗 Running Macra daily insight at', now.toISOString());

    const internalToken = INSIGHT_TOKEN.value();
    if (!internalToken) {
      console.error('MACRA_INSIGHT_INTERNAL_TOKEN missing — skipping run');
      return null;
    }

    const targets = await selectUsersForCurrentHour(now);
    if (targets.length === 0) {
      console.log('No Macra users in evening window this hour');
      return null;
    }
    console.log(`Found ${targets.length} Macra users for this evening window`);

    let generated = 0;
    let pushed = 0;
    for (const target of targets) {
      const insight = await generateInsight(target.userId, target.timezone, internalToken);
      if (!insight) continue;
      generated += 1;
      const result = await sendInsightPush(target.userId, target.fcmToken, insight);
      if (result.success) pushed += 1;
    }

    await db.collection('notification-batch-logs').add({
      type: 'MACRA_DAILY_INSIGHT',
      totalTargeted: targets.length,
      insightsGenerated: generated,
      pushSucceeded: pushed,
      runAt: admin.firestore.FieldValue.serverTimestamp(),
      utcHour: now.getUTCHours(),
    });

    return null;
  }
);

module.exports = exports;
