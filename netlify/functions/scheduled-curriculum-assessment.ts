import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import { runCurriculumAssessmentAdmin } from './utils/dailyCurriculumAdmin';

/**
 * Scheduled Curriculum Assessment (monthly)
 *
 * Runs once per day at 03:00 UTC. On the 1st of each month it computes
 * curriculum assessments for every athlete for the prior month and
 * persists them to `pulsecheck-curriculum-assessments`.
 *
 * Doctrine: assessments inform coach reports + admin dashboards. Athletes
 * never see the raw doc — only translated summaries via Phase C voice.
 *
 * Selection of cadence: this is a daily-firing function so we have a
 * cheap retry surface if the 1st-of-month run fails. We also allow a
 * forced dev/admin smoke run with `?force=1`.
 *
 * The rollup logic mirrors the client-SDK service, but this scheduler uses
 * the admin-SDK adapter for Firestore reads and writes.
 */

const BATCH_LIMIT = 500;

const lastMonthYearMonthUtc = (now: Date): string => {
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const y = last.getUTCFullYear();
  const m = String(last.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const handler: Handler = async (event) => {
  await initAdmin();
  const db = await getFirestore();
  const nowUtc = new Date();
  const dayOfMonth = nowUtc.getUTCDate();

  // Only run the rollup on the 1st of the month UTC, OR when forced via
  // query param (admin backfill).
  const force = event.queryStringParameters?.force === '1';
  const backfillMonths = parseInt(event.queryStringParameters?.backfillMonths || '0', 10) || 0;
  if (dayOfMonth !== 1 && !force && backfillMonths === 0) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'notFirstOfMonth' }) };
  }

  const yearMonth = lastMonthYearMonthUtc(nowUtc);

  // Enumerate athletes.
  const memSnap = await db
    .collection('pulsecheck-team-memberships')
    .where('role', '==', 'athlete')
    .limit(BATCH_LIMIT)
    .get();

  const summary = {
    candidates: 0,
    assessed: 0,
    errors: 0,
    yearMonth,
  };

  for (const mem of memSnap.docs) {
    const m = mem.data();
    if (!m.userId) continue;
    summary.candidates += 1;
    try {
      const assessment = await runCurriculumAssessmentAdmin(db, {
        athleteUserId: m.userId,
        yearMonth,
      });
      if (assessment) {
        summary.assessed += 1;
        console.log(`[scheduled-curriculum-assessment] athlete=${m.userId} yearMonth=${yearMonth} assessed`);
      }
    } catch (error) {
      summary.errors += 1;
      console.error(`[scheduled-curriculum-assessment] athlete=${m.userId} yearMonth=${yearMonth} failed`, error);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, summary }),
  };
};
