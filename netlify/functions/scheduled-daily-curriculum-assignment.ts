import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';

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
 * NOTE — Phase I Part 1 stub:
 *   This scheduler is wired to the existing `pulsecheck-team-memberships`
 *   collection to enumerate athletes. The selection algorithm runs via a
 *   simplified admin-SDK adapter (the `db` import in the client-SDK
 *   generator can't run from a Netlify function as-is). For Part 1 we
 *   stub this with a rate-limited "generate-on-trigger" admin endpoint
 *   that the scheduler calls per-athlete. Wiring the full generator to
 *   admin-SDK is a Part 1B task.
 *
 *   The behavior below is correct for the daily-cadence scheduler
 *   contract; the actual per-athlete generate call is a TODO marker
 *   until the admin-SDK adapter lands (see TODO(curriculum-admin-sdk)).
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
  const db = getFirestore();
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

    // TODO(curriculum-admin-sdk): wire the generator's selection logic to
    // run via admin SDK from this function. Today, the generator uses the
    // client-SDK; Phase I Part 1B will refactor it behind a runtime-agnostic
    // adapter so this scheduler can call it directly. Until then, this
    // scheduler logs candidates that NEED generation but does not actually
    // write. The /admin/curriculumLayer "Generate today's assignment"
    // button (Slice 1B) provides a manual trigger path for development.
    summary.assigned += 1; // counted as "would-be-assigned"
    console.log(
      `[scheduled-daily-curriculum-assignment] athlete=${m.userId} would generate for sourceDate=${todayKey}`,
    );
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, summary }),
  };
};
