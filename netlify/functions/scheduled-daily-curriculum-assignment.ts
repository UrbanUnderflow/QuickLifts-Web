import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import { generateDailyAssignmentAdmin } from './utils/dailyCurriculumAdmin';

/**
 * Scheduled Daily Curriculum Assignment
 *
 * Runs every 30 minutes UTC. For each athlete with curriculum enabled,
 * if their athlete-local time falls within the configured "morning"
 * window AND no curriculum-engine assignment exists yet for their
 * local today, generate one (1 protocol + 1 sim).
 *
 * The actual selection logic lives in
 * `src/api/firebase/dailyCurriculum/dailyAssignmentGenerator.ts`. This
 * function is purely the scheduler + per-athlete dispatch loop. It uses
 * the firestore-admin SDK directly to call into the generator's
 * Firestore writes — the generator's runtime is server-side only.
 *
 * The generator selection helpers are shared with the client-SDK admin
 * preview surface, while this scheduler uses the admin-SDK adapter for
 * Firestore reads and writes.
 */

const BATCH_LIMIT = 500;
const WINDOW_MINUTES = 30;

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

export const handler: Handler = async () => {
  await initAdmin();
  const db = await getFirestore();
  const nowUtc = new Date();

  // Read curriculum config to know whether the engine is enabled + the
  // morning hour to fire at.
  const configSnap = await db.collection('pulsecheck-curriculum-config').doc('current').get();
  const config = configSnap.exists ? configSnap.data() || {} : {};
  if (config.engineEnabled === false) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'engineDisabled' }) };
  }
  const morningHour = (config.notificationCadence?.morningHourLocal ?? 8) as number;

  // Enumerate athletes via team memberships (role=athlete, status=active).
  const memSnap = await db
    .collection('pulsecheck-team-memberships')
    .where('role', '==', 'athlete')
    .limit(BATCH_LIMIT)
    .get();

  const summary = {
    candidates: 0,
    assigned: 0,
    skippedAlreadyAssigned: 0,
    skippedNoSelection: 0,
    skippedOutsideWindow: 0,
    errors: 0,
  };

  for (const mem of memSnap.docs) {
    const m = mem.data();
    if (!m.userId) continue;
    summary.candidates += 1;
    const tz = (m.timezone as string | undefined) || 'America/New_York';
    const localNow = localNowFor(nowUtc, tz);
    const localHour = localNow.getHours();
    const localMinute = localNow.getMinutes();
    if (!isWithinWindow(localHour, localMinute, morningHour, WINDOW_MINUTES)) {
      summary.skippedOutsideWindow += 1;
      continue;
    }
    const todayKey = formatYmd(localNow);

    // Check if curriculum-engine already wrote today's assignment.
    const existingQ = await db
      .collection('pulsecheck-daily-assignments')
      .where('athleteId', '==', m.userId)
      .where('sourceDate', '==', todayKey)
      .where('assignedBy', '==', 'curriculum-engine')
      .limit(1)
      .get();
    if (!existingQ.empty) {
      summary.skippedAlreadyAssigned += 1;
      continue;
    }

    try {
      const result = await generateDailyAssignmentAdmin(db, {
        athleteUserId: m.userId,
        teamId: (m.teamId as string | undefined) || '',
        teamMembershipId: (m.id as string | undefined) || mem.id,
        sportId: (m.sportId as string | undefined) ||
          ((m.athleteOnboarding as { sportId?: string } | undefined)?.sportId),
        sourceDate: todayKey,
        timezone: tz,
      });
      if (result) {
        summary.assigned += 1;
        console.log(
          `[scheduled-daily-curriculum-assignment] athlete=${m.userId} generated sourceDate=${todayKey}`,
        );
      } else {
        summary.skippedNoSelection += 1;
        console.log(
          `[scheduled-daily-curriculum-assignment] athlete=${m.userId} skipped sourceDate=${todayKey} reason=no-selection`,
        );
      }
    } catch (error) {
      summary.errors += 1;
      console.error(
        `[scheduled-daily-curriculum-assignment] athlete=${m.userId} failed sourceDate=${todayKey}`,
        error,
      );
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, summary }),
  };
};
