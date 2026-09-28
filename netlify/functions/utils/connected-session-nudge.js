/**
 * After a WHOOP sync saves a new workout, invite the athlete to add how it went (workout and food logging TDD, 7.3).
 *
 * Rules: at most one a day, only for workouts that ended in the last 12 hours, never for a session the athlete already
 * logged, never while operational restrictions suppress nudges, and the text carries no numbers or data.
 * Failures are logged and swallowed so a sync never fails because of this.
 */

const { resolvePulseCheckFcmToken, sendLoggedNoraPush, loadPulseCheckNudgeSuppressionState } = require('../pulsecheck-notification-utils');

const LEDGER_COLLECTION = 'pulsecheck-activity-records';
const RECENT_WINDOW_MS = 12 * 60 * 60 * 1000;
const DAILY_GAP_MS = 20 * 60 * 60 * 1000;
const TITLE = 'PulseCheck';
const BODY = 'Nice session. Want to add how it went?';

function newestRecentWorkout(workouts, notified, now) {
  return (Array.isArray(workouts) ? workouts : [])
    .filter((w) => w?.id && !notified.includes(`whoop:${w.id}`))
    .map((w) => ({ id: `whoop:${w.id}`, endedAt: Number(w.endAt || w.startAt) * 1000 }))
    .filter((w) => Number.isFinite(w.endedAt) && now - w.endedAt >= 0 && now - w.endedAt <= RECENT_WINDOW_MS)
    .sort((a, b) => b.endedAt - a.endedAt)[0] || null;
}

async function nudgeForNewWhoopWorkouts({ firestore, messaging, userId, workouts, now = Date.now(), send = sendLoggedNoraPush }) {
  try {
    const ledgerRef = firestore.collection(LEDGER_COLLECTION).doc(userId);
    const ledger = (await ledgerRef.get()).data()?.sessionNudges || {};
    const notified = Array.isArray(ledger.notifiedSessionIds) ? ledger.notifiedSessionIds : [];
    const candidate = newestRecentWorkout(workouts, notified, now);
    if (!candidate) return { sent: false, reason: 'no_new_workout' };

    // Every candidate is recorded, sent or not, so the same session never triggers twice.
    const remember = (extra = {}) => ledgerRef.set({
      sessionNudges: { ...ledger, ...extra, notifiedSessionIds: [...notified, candidate.id].slice(-50) },
    }, { merge: true });

    const alreadyLogged = await ledgerRef.collection('workouts').where('connectedSessionId', '==', candidate.id).limit(1).get();
    if (!alreadyLogged.empty) { await remember(); return { sent: false, reason: 'already_logged' }; }
    if (Number(ledger.lastSentAt || 0) > now - DAILY_GAP_MS) { await remember(); return { sent: false, reason: 'daily_limit' }; }

    const suppression = await loadPulseCheckNudgeSuppressionState({ db: firestore, athleteId: userId, allowMembershipFallback: true }).catch(() => null);
    if (suppression?.suppressed) { await remember(); return { sent: false, reason: 'suppressed' }; }

    const userDoc = await firestore.collection('users').doc(userId).get();
    const fcmToken = resolvePulseCheckFcmToken(userDoc.exists ? userDoc.data() : {});
    if (!fcmToken || !messaging) { await remember(); return { sent: false, reason: 'no_push_target' }; }

    const result = await send({
      messaging, db: firestore, userId, fcmToken, title: TITLE, body: BODY,
      data: { type: 'connectedSession', sessionId: candidate.id },
      notificationType: 'CONNECTED_SESSION_INVITE',
      functionName: 'netlify/utils/connected-session-nudge',
    });
    await remember(result?.success ? { lastSentAt: now } : {});
    return { sent: result?.success === true, sessionId: candidate.id };
  } catch (error) {
    console.warn('[connected-session-nudge] Skipped after an error:', error?.message || error);
    return { sent: false, reason: 'error' };
  }
}

module.exports = { nudgeForNewWhoopWorkouts, _private: { newestRecentWorkout, BODY } };
