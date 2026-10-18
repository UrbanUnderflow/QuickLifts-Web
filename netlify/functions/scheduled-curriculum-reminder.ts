import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import {
  loadPulseCheckNudgeSuppressionState,
  loadPulseCheckPushTarget,
} from './pulsecheck-notification-utils';

/**
 * Scheduled Curriculum Reminder
 *
 * Runs every 30 minutes UTC. Sends midday + evening pushes to athletes
 * with a curriculum-engine-assigned protocol or sim that hasn't been
 * completed yet.
 *
 * Doctrine — voice:
 *   For Phase I Part 1 we use STATIC TEMPLATES below. They're
 *   action-verb-led, no numerics, no negative priming, athlete-friendly.
 *   They satisfy the off-limits config.
 *
 *   When Phase C ships translateForAthlete(), swap the template
 *   resolution for a call into the Adaptation Framing Layer voice
 *   service and the static text becomes the seed-fallback only.
 *
 *   See TODO(phase-c-voice) markers below.
 *
 * Doctrine — what we send:
 *   - midday push: nudge sim — "Quick decisioning rep over coffee?"
 *   - evening push: nudge whichever asset (protocol or sim) the athlete
 *     hasn't completed yet — "End of day — knock out today's [thing]?"
 */

const BATCH_LIMIT = 500;
const WINDOW_MINUTES = 30;

// TODO(phase-c-voice): replace these helpers with calls into
// `translateForAthlete({ domain: 'curriculum', state: '...' })` once
// Phase C lands. The functions here become the row-level fallback.
//
// Copy must pass the Nora voice rubric (see PulseCheck/Views/Admin/
// NoraRubricAdmin.swift). Every notification names the actual session
// (protocolLabel / simName) when available, with a generic fallback
// that still names the assignment type and next action.
const middaySimMessage = (simName?: string): { title: string; body: string } => ({
  title: 'Quick sim — 5 min',
  body: `${simName ?? "Today's sim"} is queued. Open PulseCheck and knock it out before the day fills up.`,
});

const eveningProtocolMessage = (protocolLabel?: string): { title: string; body: string } => ({
  title: "Today's protocol",
  body: `${protocolLabel ?? "Today's protocol"} is still waiting. 5 minutes before bed clears it.`,
});

const eveningSimMessage = (simName?: string): { title: string; body: string } => ({
  title: "Today's sim",
  body: `${simName ?? "Today's sim"} is still queued. 5 minutes before bed clears it.`,
});

const formatYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isWithinWindow = (
  currentHour: number,
  currentMinute: number,
  targetHour: number,
  windowMinutes: number,
): boolean => {
  const current = currentHour * 60 + currentMinute;
  const target = targetHour * 60;
  // One forward-only scheduler window: an 8 PM reminder never fires at 7:30.
  return Number.isFinite(targetHour) && targetHour >= 0 && targetHour < 24
    && current >= target && current < target + windowMinutes;
};

const localNowFor = (nowUtc: Date, timeZone: string): Date => {
  return new Date(nowUtc.toLocaleString('en-US', { timeZone }));
};

const sendNotification = async (
  messaging: any,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const message = {
      token: fcmToken,
      ...(data._pushPlatform === "android" ? {} : { notification: { title, body } }),
      data: { ...data, title, body },
      apns: {
        headers: { 'apns-collapse-id': data.reminderId },
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };
    const messageId = await messaging.send(message);
    return { success: true, messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
};

function isActiveMembership(data: Record<string, unknown>): boolean {
  const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
  return (!status || status === 'active')
    && data.revokedAt == null && data.archivedAt == null && data.deletedAt == null
    && data.revoked !== true;
}

export const handler: Handler = async () => {
  await initAdmin();
  const db = await getFirestore();
  const messaging = (await import('firebase-admin')).messaging();
  const nowUtc = new Date();

  const configSnap = await db.collection('pulsecheck-curriculum-config').doc('current').get();
  const config = configSnap.exists ? configSnap.data() || {} : {};
  if (config.engineEnabled === false) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'engineDisabled' }) };
  }
  const cadence = config.notificationCadence || {};
  const middayHour = cadence.middayHourLocal as number | null | undefined;
  const eveningHour = cadence.eveningHourLocal as number | null | undefined;

  const memSnap = await db
    .collection('pulsecheck-team-memberships')
    .where('role', '==', 'athlete')
    .limit(BATCH_LIMIT)
    .get();

  const summary = {
    candidates: 0,
    sentMidday: 0,
    sentEvening: 0,
    skippedNoOpenAssignment: 0,
    skippedSuppressed: 0,
    skippedInactiveMembership: 0,
    skippedDuplicateMembership: 0,
    skippedAlreadyClaimed: 0,
    failed: 0,
  };

  const seenAthletes = new Set<string>();
  for (const mem of memSnap.docs) {
    const m = mem.data();
    if (!m.userId) continue;
    if (!isActiveMembership(m)) {
      summary.skippedInactiveMembership += 1;
      continue;
    }
    if (seenAthletes.has(m.userId)) {
      summary.skippedDuplicateMembership += 1;
      continue;
    }
    seenAthletes.add(m.userId);
    summary.candidates += 1;
    const tz = (m.timezone as string | undefined) || 'America/New_York';
    let localNow: Date;
    try { localNow = localNowFor(nowUtc, tz); } catch { summary.failed += 1; continue; }
    const localHour = localNow.getHours();
    const localMinute = localNow.getMinutes();
    const todayKey = formatYmd(localNow);

    const isMiddayWindow =
      typeof middayHour === 'number' && isWithinWindow(localHour, localMinute, middayHour, WINDOW_MINUTES);
    const isEveningWindow =
      typeof eveningHour === 'number' && isWithinWindow(localHour, localMinute, eveningHour, WINDOW_MINUTES);
    if (!isMiddayWindow && !isEveningWindow) continue;

    // Suppression check.
    let suppression: { suppressed: boolean } = { suppressed: false };
    try {
      const suppressionOptions = { db, athleteId: m.userId, allowMembershipFallback: false };
      suppression = (await loadPulseCheckNudgeSuppressionState(suppressionOptions)) || { suppressed: false };
    } catch {
      // Do not deliver when we cannot establish the athlete's suppression state.
      summary.failed += 1;
      continue;
    }
    if (suppression.suppressed) {
      summary.skippedSuppressed += 1;
      continue;
    }

    // Find today's curriculum-engine assignments that aren't completed.
    let openAssignments: Array<Record<string, unknown>> = [];
    try {
      const snap = await db
        .collection('pulsecheck-daily-assignments')
        .where('athleteId', '==', m.userId)
        .where('sourceDate', '==', todayKey)
        .where('assignedBy', '==', 'curriculum-engine')
        .limit(5)
        .get();
      openAssignments = snap.docs
        .map((d): Record<string, unknown> => ({ ...d.data(), id: d.id }))
        .filter((a) => a.status !== 'completed' && a.status !== 'archived');
    } catch {
      /* tolerate index miss */
    }
    if (openAssignments.length === 0) {
      summary.skippedNoOpenAssignment += 1;
      continue;
    }

    const userSnap = await db.collection('users').doc(m.userId).get();
    if (!userSnap.exists) continue;
    const userData = userSnap.data() as Record<string, unknown> | undefined;
    if (!userData) continue;
    const target = await loadPulseCheckPushTarget(db, m.userId);
    if (!target?.token) continue;

    const slot = isMiddayWindow ? 'midday' : 'evening';
    const simAssignment = openAssignments.find((a) => a.actionType === 'simulation');
    const assignment = slot === 'midday'
      ? simAssignment
      : openAssignments.find((a) => a.actionType === 'protocol') || simAssignment;
    if (!assignment) continue;
    const { title, body } = slot === 'midday'
      ? middaySimMessage(assignment.simName as string | undefined)
      : assignment.actionType === 'protocol'
        ? eveningProtocolMessage(assignment.protocolLabel as string | undefined)
        : eveningSimMessage(assignment.simName as string | undefined);

    // This subtree is already server-only under the deployed Firestore rules.
    // Atomic create reserves one attempt per athlete/local day/cadence across
    // memberships, concurrent runs and retries. Never release a claim after an
    // ambiguous FCM failure or a crash: a missed nudge is preferable to a burst.
    const reminderId = `curriculum-${todayKey}-${slot}`;
    const delivery = db.collection('pulsecheck-private-users').doc(m.userId)
      .collection('curriculum-reminder-deliveries').doc(`${todayKey}_${slot}`);
    try {
      await delivery.create({
        status: 'claimed', localDate: todayKey, cadence: slot,
        assignmentId: String(assignment.id || ''), claimedAt: nowUtc,
      });
    } catch (error: any) {
      if (error?.code === 6 || error?.code === 'already-exists') {
        summary.skippedAlreadyClaimed += 1;
      } else {
        summary.failed += 1;
        console.error('Curriculum reminder claim failed', error?.code || 'unknown');
      }
      continue;
    }
    const result = await sendNotification(messaging, target.token, title, body, {
      recipientUserId: m.userId, _pushPlatform: target.platform || '',
      type: 'curriculum_reminder', cadence: slot, reminderId,
      assignmentId: String(assignment.id || ''),
    });
    if (result.success) {
      if (slot === 'midday') summary.sentMidday += 1;
      else summary.sentEvening += 1;
    } else summary.failed += 1;
    try {
      await delivery.set({
        status: result.success ? 'sent' : 'send_failed',
        messageId: result.messageId || null,
        finishedAt: new Date(),
      }, { merge: true });
    } catch {
      // The durable claim still prevents replay if outcome recording fails.
      console.error('Curriculum reminder outcome could not be recorded');
    }
  }

  console.info('Curriculum reminder summary', JSON.stringify(summary));
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, summary }),
  };
};
