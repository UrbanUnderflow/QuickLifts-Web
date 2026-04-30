import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import {
  loadPulseCheckNudgeSuppressionState,
  resolvePulseCheckPushTarget,
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

// TODO(phase-c-voice): replace these static strings with calls into
// `translateForAthlete({ domain: 'curriculum', state: '...' })` once
// Phase C lands. The seed strings here become the row-level fallback.
const NORA_TEMPLATES = {
  midday: {
    sim: 'Quick rep — sharpen your edge for 5 minutes.',
  },
  evening: {
    protocol: "End of day — knock out today's protocol before bed?",
    sim: "Got 5 minutes? Today's sim is still waiting.",
  },
} as const;

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
  return Math.abs(current - target) <= windowMinutes;
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
      notification: { title, body },
      data,
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    };
    const messageId = await messaging.send(message);
    return { success: true, messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
};

export const handler: Handler = async () => {
  await initAdmin();
  const db = getFirestore();
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
    failed: 0,
  };

  for (const mem of memSnap.docs) {
    const m = mem.data();
    if (!m.userId) continue;
    summary.candidates += 1;
    const tz = (m.timezone as string | undefined) || 'America/New_York';
    const localNow = localNowFor(nowUtc, tz);
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
      suppression = (await loadPulseCheckNudgeSuppressionState(db, m.userId)) || { suppressed: false };
    } catch {
      /* tolerate */
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
        .map((d) => d.data())
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
    const target = resolvePulseCheckPushTarget(userData);
    if (!target?.fcmToken) continue;

    if (isMiddayWindow) {
      const simAssignment = openAssignments.find((a) => a.actionType === 'simulation');
      if (simAssignment) {
        const result = await sendNotification(
          messaging,
          target.fcmToken,
          'Pulse',
          NORA_TEMPLATES.midday.sim,
          {
            type: 'curriculum_reminder',
            cadence: 'midday',
            assignmentId: String(simAssignment.id || ''),
          },
        );
        if (result.success) summary.sentMidday += 1;
        else summary.failed += 1;
      }
    } else if (isEveningWindow) {
      // Prefer to nudge the protocol if uncompleted, else the sim.
      const protocolAssignment = openAssignments.find((a) => a.actionType === 'protocol');
      const simAssignment = openAssignments.find((a) => a.actionType === 'simulation');
      const target1 = protocolAssignment || simAssignment;
      if (target1) {
        const isProtocol = target1.actionType === 'protocol';
        const result = await sendNotification(
          messaging,
          target.fcmToken,
          'Pulse',
          isProtocol ? NORA_TEMPLATES.evening.protocol : NORA_TEMPLATES.evening.sim,
          {
            type: 'curriculum_reminder',
            cadence: 'evening',
            assignmentId: String(target1.id || ''),
          },
        );
        if (result.success) summary.sentEvening += 1;
        else summary.failed += 1;
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, summary }),
  };
};
