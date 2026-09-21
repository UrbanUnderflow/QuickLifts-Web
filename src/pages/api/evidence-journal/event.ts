import type { NextApiRequest, NextApiResponse } from 'next';
import { authorizeLinearAthlete } from '../curriculum/runtime';
import { evidenceJournalEnabled, EvidenceError, evidenceEntries, validEvidenceId } from '../../../lib/evidence-journal';

export const createEvidenceEventHandler = (deps: { authorize?: typeof authorizeLinearAthlete; now?: () => number; enabled?: () => boolean } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(deps.enabled || evidenceJournalEnabled)()) return res.status(503).json({ error: 'Your evidence journal is not available yet. Please try again later.' });
  let identity;
  try { identity = await (deps.authorize || authorizeLinearAthlete)(req); if (!identity.uid) throw Error(); }
  catch { return res.status(401).json({ error: 'Sign in to open your evidence.' }); }
  const { entryId, eventId, event } = req.body || {};
  if (!validEvidenceId(entryId) || !validEvidenceId(eventId) || !['revisited', 'used'].includes(event)) return res.status(400).json({ error: 'Invalid evidence event.' });
  try {
    const entry = evidenceEntries(identity.db, identity.uid).doc(entryId.toLowerCase());
    const eventRef = entry.collection('events').doc(eventId.toLowerCase());
    await identity.db.runTransaction(async tx => {
      const [saved, previousEvent] = await Promise.all([tx.get(entry), tx.get(eventRef)]);
      if (!saved.exists) throw new EvidenceError(404, 'This entry is unavailable for this account.');
      if (previousEvent.exists) {
        if (previousEvent.data()?.event !== event) throw new EvidenceError(409, 'This event ID has already been used.');
        return;
      }
      const now = (deps.now || Date.now)();
      const countField = event === 'used' ? 'useCount' : 'revisitCount';
      tx.update(entry, { [countField]: (saved.data()?.[countField] || 0) + 1, [event === 'used' ? 'lastUsedAt' : 'lastRevisitedAt']: now });
      // No journal text, user traits, or content analysis enters event records.
      tx.create(eventRef, { event, createdAt: now });
    });
    return res.status(200).json({ recorded: true });
  } catch (error) {
    return res.status(error instanceof EvidenceError ? error.status : 503).json({ error: error instanceof EvidenceError ? error.message : 'This action could not be recorded. Try again.' });
  }
};
export default createEvidenceEventHandler();
