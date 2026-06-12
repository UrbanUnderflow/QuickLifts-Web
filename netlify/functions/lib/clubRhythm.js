// Shared helpers for the FitClub "club rhythm" — the daily drop, the
// nightly recap, and the host-megaphone broadcast. Pure data + push
// plumbing so the scheduled functions and the HTTP fan-out stay small.

const { admin, db } = require('../config/firebase');

const START_OF_DAY_MS = 24 * 60 * 60 * 1000;

/** Clubs whose host opted into the daily drop + nightly recap. */
async function getRecapEnabledClubs() {
  // `capabilities.recapEnabled` is the host opt-in toggle (default OFF).
  const snap = await db
    .collection('clubs')
    .where('capabilities.recapEnabled', '==', true)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Active member userIds for a club. */
async function getClubMemberUserIds(clubId) {
  const snap = await db
    .collection('clubMembers')
    .where('clubId', '==', clubId)
    .where('isActive', '==', true)
    .get();
  return snap.docs
    .map((d) => d.data())
    .map((m) => m.userId)
    .filter(Boolean);
}

/**
 * Resolve fresh FCM tokens for a set of userIds (tokens stored on
 * member docs go stale — always read the live user doc). Returns
 * [{ userId, token }] for users that have a token, in batches of 10
 * (Firestore `in` limit).
 */
async function resolveTokens(userIds) {
  const unique = [...new Set(userIds)];
  const out = [];
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
    const snap = await db
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', batch)
      .get();
    snap.docs.forEach((doc) => {
      const token = doc.data()?.fcmToken;
      if (typeof token === 'string' && token.trim()) {
        out.push({ userId: doc.id, token: token.trim() });
      }
    });
  }
  return out;
}

/**
 * Send one push per token. Honors a global dry-run so a freshly
 * deployed cron never spams before it's verified. Set
 * FITCLUB_RHYTHM_LIVE=true to actually deliver. Returns counts.
 */
async function sendPushes(targets, { title, body, data = {}, dryRun }) {
  const messaging = admin.messaging();
  let sent = 0;
  let failed = 0;
  for (const t of targets) {
    if (dryRun) {
      console.log(`[clubRhythm][DRY-RUN] would push to ${t.userId}: "${title}" — "${body}"`);
      continue;
    }
    try {
      await messaging.send({
        token: t.token,
        notification: { title, body },
        data: { ...data },
        apns: { payload: { aps: { alert: { title, body }, badge: 1 } } },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.warn(`[clubRhythm] push failed for ${t.userId}: ${err?.message || err}`);
    }
  }
  return { sent, failed, dryRun: !!dryRun };
}

/** Whether the rhythm is live (vs dry-run). Default: dry-run. */
function rhythmIsLive() {
  return String(process.env.FITCLUB_RHYTHM_LIVE || '').toLowerCase() === 'true';
}

/** Epoch (ms) bounds of "today" in a given IANA timezone (best-effort). */
function dayBoundsForTimezone(timezoneId) {
  // Server runs UTC; we approximate the club's local day by offsetting.
  // Good enough for a daily cadence; per-second precision isn't needed.
  try {
    const now = new Date();
    const localNow = new Date(now.toLocaleString('en-US', { timeZone: timezoneId || 'America/New_York' }));
    const offset = now.getTime() - localNow.getTime();
    const startLocal = new Date(localNow);
    startLocal.setHours(0, 0, 0, 0);
    const startUtcMs = startLocal.getTime() + offset;
    return { startMs: startUtcMs, endMs: startUtcMs + START_OF_DAY_MS };
  } catch {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: start.getTime() + START_OF_DAY_MS };
  }
}

module.exports = {
  getRecapEnabledClubs,
  getClubMemberUserIds,
  resolveTokens,
  sendPushes,
  rhythmIsLive,
  dayBoundsForTimezone,
  db,
  admin,
};
