import type { NextApiRequest, NextApiResponse } from 'next';
import { getSimpBudgetAuth, getSimpBudgetFirestore } from '../../../../netlify/functions/utils/getSimpBudgetServiceAccount';
import { OWNER_EMAIL, SequenceError, dispatchSequence, mutateSequence, readSequences, requireId } from '../../../../netlify/functions/lib/pipelistsEmailSequences';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed.' });
  try {
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new SequenceError(401, 'Please sign in again.');
    const auth = await getSimpBudgetAuth();
    const user = await auth.verifyIdToken(token).catch(() => null);
    if (!user) throw new SequenceError(401, 'Please sign in again.');
    if (user.email?.toLowerCase() !== OWNER_EMAIL) throw new SequenceError(403, 'Email sequences are only enabled for the PipeLists owner.');
    const db = await getSimpBudgetFirestore();
    if (req.method === 'GET') {
      const listId = requireId(req.query.listId);
      const itemId = req.query.itemId === undefined ? undefined : requireId(req.query.itemId);
      const data = await readSequences(db, user.uid, listId, itemId);
      return res.status(200).json({ success: true, [itemId ? 'sequence' : 'sequences']: data });
    }
    if (req.body.action === 'refresh-tracking') {
      const listId = requireId(req.body.listId), itemId = requireId(req.body.itemId);
      const current = await readSequences(db, user.uid, listId, itemId);
      if (current) {
        const { refreshSequenceTracking } = require('../../../../netlify/functions/lib/pipelistsEmailSequenceTracking');
        try { await refreshSequenceTracking(db, current, process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY || ''); }
        catch (error) { throw new SequenceError(502, (error as Error).message || 'Unable to refresh email tracking. Try again shortly.'); }
      }
      return res.status(200).json({ success: true, sequence: await readSequences(db, user.uid, listId, itemId) });
    }
    let sequence = await mutateSequence(db, user.uid, req.body);
    if (req.body.action === 'send') {
      await dispatchSequence(db, sequence.id);
      sequence = await readSequences(db, user.uid, sequence.listId, sequence.itemId) as typeof sequence;
    }
    return res.status(200).json({ success: true, sequence });
  } catch (error) {
    if (!(error instanceof SequenceError)) console.error('[PipeLists sequences]', error);
    return res.status(error instanceof SequenceError ? error.status : 500).json({ success: false, error: error instanceof SequenceError ? error.message : 'Unable to update the sequence. Reload to check its status before trying again.' });
  }
}
