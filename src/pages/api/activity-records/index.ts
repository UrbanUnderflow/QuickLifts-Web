import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeLinearAthlete } from '../curriculum/runtime';
import { ActivityError, RECORD_KINDS, connectedSessions, legacyChatMeals, parseMeal, parseWorkout, recordsFor, saveRecord, validRecordId, type RecordKind } from '../../../lib/activity-records';

const MAX_RANGE_MS = 31 * 86_400_000;

export const createActivityRecordsHandler = (deps: { authorize?: typeof authorizeLinearAthlete; now?: () => number } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' });
  let identity;
  try { identity = await (deps.authorize || authorizeLinearAthlete)(req); if (!identity.uid) throw Error(); }
  catch { return res.status(401).json({ error: 'Sign in to see your log.' }); }
  const { db, uid } = identity;
  try {
    if (req.method === 'POST') {
      const kind = req.body?.kind;
      if (!(RECORD_KINDS as readonly string[]).includes(kind)) throw new ActivityError(400, 'Choose a workout or a meal.');
      const record = kind === 'workout' ? parseWorkout(req.body, uid) : parseMeal(req.body, uid);
      return res.status(200).json(await saveRecord(db, uid, record, (deps.now || Date.now)()));
    }
    if (req.method === 'DELETE') {
      // Removing records never touches the journal entry they came from.
      if (req.query.entryId !== undefined) {
        if (!validRecordId(req.query.entryId)) throw new ActivityError(400, 'Choose a valid entry.');
        const entryId = String(req.query.entryId).toLowerCase();
        let removed = 0;
        for (const kind of RECORD_KINDS) {
          const linked = await recordsFor(db, uid, kind).where('entryId', '==', entryId).get();
          await Promise.all(linked.docs.map((doc) => doc.ref.delete()));
          removed += linked.docs.length;
        }
        return res.status(200).json({ removed });
      }
      const kind = req.query.kind as RecordKind;
      if (!(RECORD_KINDS as readonly string[]).includes(kind) || !validRecordId(req.query.recordId)) throw new ActivityError(400, 'Choose a valid record.');
      await recordsFor(db, uid, kind).doc(String(req.query.recordId).toLowerCase()).delete();
      return res.status(200).json({ removed: 1 });
    }
    const from = Number(req.query.from);
    const to = Number(req.query.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > MAX_RANGE_MS) throw new ActivityError(400, 'Choose a range of up to 31 days.');
    const [workouts, meals] = await Promise.all([
      recordsFor(db, uid, 'workout').where('startedAt', '>=', from).where('startedAt', '<=', to).orderBy('startedAt', 'desc').get(),
      recordsFor(db, uid, 'meal').where('eatenAt', '>=', from).where('eatenAt', '<=', to).orderBy('eatenAt', 'desc').get(),
    ]);
    const workoutRecords = workouts.docs.map((doc) => doc.data());
    const mealRecords = meals.docs.map((doc) => doc.data());
    // Device sessions and older chat meals are optional extras; the athlete's own records still load if they fail.
    const [sessions, legacy] = await Promise.all([
      connectedSessions(db, uid, from, to).catch(() => []),
      legacyChatMeals(db, uid, from, to).catch(() => []),
    ]);
    const linkedBySession = new Map(workoutRecords.filter((w) => w.connectedSessionId).map((w) => [w.connectedSessionId, w.id]));
    const mirroredChatMeals = new Set(mealRecords.map((m) => m.chatMealId).filter(Boolean));
    return res.status(200).json({
      workouts: workoutRecords,
      meals: [...mealRecords, ...legacy.filter((m) => !mirroredChatMeals.has(m.id))].sort((a: any, b: any) => b.eatenAt - a.eatenAt),
      sessions: sessions.map((session) => ({ ...session, linkedRecordId: linkedBySession.get(session.id) || null })),
    });
  } catch (error) {
    return res.status(error instanceof ActivityError ? error.status : 503).json({ error: error instanceof ActivityError ? error.message : 'Your log is unavailable right now. Please try again.' });
  }
};
export default createActivityRecordsHandler();
