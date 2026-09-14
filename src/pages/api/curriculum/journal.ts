import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeLinearAthlete } from './runtime';
import { linearCollection, linearRuntimeEnabled } from '../../../api/firebase/dailyCurriculum/linearRuntimeAdmin';
export const createLinearJournalHandler = (deps: { authorize?: typeof authorizeLinearAthlete; enabled?: () => boolean; now?: () => number } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET','POST'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' });
  if (!(deps.enabled || linearRuntimeEnabled)()) return res.status(409).json({ error: 'Versioned skill journals are disabled.' });
  let identity;
  try { identity = await (deps.authorize || authorizeLinearAthlete)(req); } catch { return res.status(401).json({ error: 'Sign in to open your journal.' }); }
  const assignmentId = req.method === 'GET' ? req.query.assignmentId : req.body?.assignmentId;
  if (typeof assignmentId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(assignmentId)) return res.status(400).json({ error: 'Choose a valid assignment.' });
  const text = req.body?.text;
  if (req.method === 'POST' && (typeof text !== 'string' || !text.trim() || text.length > 4000)) return res.status(400).json({ error: 'Write an optional reflection of at most 4,000 characters.' });
  const expectedRevision = req.body?.expectedRevision;
  if (req.method === 'POST' && expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) return res.status(400).json({ error: 'Provide the loaded journal revision.' });
  try {
    const state = linearCollection(identity.db, 'states').doc(identity.uid);
    const journal = state.collection('journals').doc(assignmentId);
    const result = await identity.db.runTransaction(async tx => {
      const [assignment, existing] = await Promise.all([tx.get(state.collection('assignments').doc(assignmentId)), tx.get(journal)]);
      if (!assignment.exists || assignment.data()?.athleteId !== identity.uid || assignment.data()?.phase !== 'use_it') return null;
      if (req.method === 'GET') return { status: 'loaded', text: existing.data()?.text || '', revision: existing.data()?.revision || 0 };
      if (existing.data()?.text === text.trim()) return { status: 'saved', revision: existing.data()?.revision };
      if (expectedRevision !== undefined && expectedRevision !== (existing.data()?.revision || 0)) return { status: 'conflict', text: existing.data()?.text || '', revision: existing.data()?.revision || 0 };
      const revision = (existing.data()?.revision || 0) + 1;
      const record = { text: text.trim(), revision, assignmentId, athleteId: identity.uid, versionId: assignment.data()!.versionId, skillId: assignment.data()!.skillId, updatedAt: (deps.now || Date.now)() };
      tx.create(journal.collection('revisions').doc(String(revision)), record);
      tx.set(journal, record);
      return { status: 'saved', revision };
    });
    if (!result) return res.status(404).json({ error: 'This reflection is unavailable for this account.' });
    if (result.status === 'conflict') return res.status(409).json({ ...result, error: 'This journal changed on another device. Keep your draft and review the saved version before retrying.' });
    return res.status(200).json(result);
  } catch { return res.status(503).json({ error: 'Your reflection could not be saved. Keep your text and retry.' }); }
};
export default createLinearJournalHandler();
