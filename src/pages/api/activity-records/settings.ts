import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeLinearAthlete } from '../curriculum/runtime';
import { settingsRef } from '../../../lib/activity-records';

/** The athlete's own logging settings. Today: whether coaches can see a workout summary (decision F1, off by default). */
export const createActivitySettingsHandler = (deps: { authorize?: typeof authorizeLinearAthlete } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' });
  let identity;
  try { identity = await (deps.authorize || authorizeLinearAthlete)(req); if (!identity.uid) throw Error(); }
  catch { return res.status(401).json({ error: 'Sign in to change your log settings.' }); }
  try {
    const ref = settingsRef(identity.db, identity.uid);
    if (req.method === 'POST') {
      if (typeof req.body?.shareWorkoutSummaryWithCoach !== 'boolean') return res.status(400).json({ error: 'Choose on or off.' });
      await ref.set({ shareWorkoutSummaryWithCoach: req.body.shareWorkoutSummaryWithCoach, settingsUpdatedAt: Date.now() }, { merge: true });
    }
    const snapshot = await ref.get();
    return res.status(200).json({ shareWorkoutSummaryWithCoach: snapshot.data()?.shareWorkoutSummaryWithCoach === true });
  } catch {
    return res.status(503).json({ error: 'Your settings are unavailable right now. Please try again.' });
  }
};
export default createActivitySettingsHandler();
