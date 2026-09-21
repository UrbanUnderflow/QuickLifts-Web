import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeLinearAthlete } from '../curriculum/runtime';
import { evidenceJournalEnabled, EvidenceError, evidenceEntries, parseEvidence, saveEvidence, validEvidenceId } from '../../../lib/evidence-journal';

export const createEvidenceJournalHandler = (deps: { authorize?: typeof authorizeLinearAthlete; now?: () => number; enabled?: () => boolean } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' });
  if (!(deps.enabled || evidenceJournalEnabled)()) return res.status(503).json({ error: 'Your evidence journal is not available yet. Please try again later.' });
  let identity;
  try { identity = await (deps.authorize || authorizeLinearAthlete)(req); if (!identity.uid) throw Error(); }
  catch { return res.status(401).json({ error: 'Sign in to open your evidence.' }); }
  try {
    const entries = evidenceEntries(identity.db, identity.uid);
    if (req.method === 'POST') {
      const result = await saveEvidence(identity.db, identity.uid, parseEvidence(req.body), (deps.now || Date.now)());
      return res.status(200).json(result);
    }
    if (req.method === 'DELETE') {
      if (!validEvidenceId(req.query.entryId)) throw new EvidenceError(400, 'Choose a valid entry.');
      // Recursive deletion also removes private event deduplication records.
      await identity.db.recursiveDelete(entries.doc(req.query.entryId.toLowerCase()));
      return res.status(200).json({ deleted: true });
    }
    const rawLimit = req.query.limit;
    if (rawLimit !== undefined && (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50)) throw new EvidenceError(400, 'Choose a page size between 1 and 50.');
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    let query = entries.orderBy('createdAt', 'desc').orderBy('__name__', 'desc').limit(limit + 1);
    if (req.query.cursor !== undefined) {
      if (!validEvidenceId(req.query.cursor)) throw new EvidenceError(400, 'Invalid page cursor.');
      const cursor = await entries.doc(req.query.cursor.toLowerCase()).get();
      if (!cursor.exists) throw new EvidenceError(400, 'That page changed. Refresh your evidence.');
      query = query.startAfter(cursor);
    }
    const page = await query.get();
    const docs = page.docs.slice(0, limit);
    return res.status(200).json({ entries: docs.map(doc => doc.data()), nextCursor: page.docs.length > limit ? docs[docs.length - 1].id : null });
  } catch (error) {
    return res.status(error instanceof EvidenceError ? error.status : 503).json({ error: error instanceof EvidenceError ? error.message : 'Your evidence is unavailable right now. Keep any draft and try again.' });
  }
};
export default createEvidenceJournalHandler();
