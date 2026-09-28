import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeLinearAthlete } from '../curriculum/runtime';
import { coachSummary, connectedSessions, isCoachOfAthlete, recordsFor, settingsRef } from '../../../lib/activity-records';

const MAX_RANGE_MS = 31 * 86_400_000;

/**
 * A coach's view of one athlete's workouts. Only for staff on the athlete's team, only when the athlete turned sharing
 * on, and only the summary: no effort words, exercise details, food, or journal writing.
 */
export const createCoachSummaryHandler = (deps: { authorize?: typeof authorizeLinearAthlete } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  let identity;
  try { identity = await (deps.authorize || authorizeLinearAthlete)(req); if (!identity.uid) throw Error(); }
  catch { return res.status(401).json({ error: 'Sign in to see athlete summaries.' }); }
  const athleteId = typeof req.query.athleteId === 'string' ? req.query.athleteId : '';
  const from = Number(req.query.from);
  const to = Number(req.query.to);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(athleteId) || !Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > MAX_RANGE_MS) {
    return res.status(400).json({ error: 'Choose an athlete and a range of up to 31 days.' });
  }
  try {
    const { db, uid } = identity;
    if (!(await isCoachOfAthlete(db, uid, athleteId))) return res.status(403).json({ error: 'This athlete is not on your team.' });
    const settings = await settingsRef(db, athleteId).get();
    if (settings.data()?.shareWorkoutSummaryWithCoach !== true) return res.status(200).json({ shared: false });
    const [workouts, sessions] = await Promise.all([
      recordsFor(db, athleteId, 'workout').where('startedAt', '>=', from).where('startedAt', '<=', to).get(),
      connectedSessions(db, athleteId, from, to).catch(() => []),
    ]);
    return res.status(200).json({ shared: true, ...coachSummary(workouts.docs.map((doc) => doc.data()), sessions) });
  } catch {
    return res.status(503).json({ error: 'This summary is unavailable right now. Please try again.' });
  }
};
export default createCoachSummaryHandler();
