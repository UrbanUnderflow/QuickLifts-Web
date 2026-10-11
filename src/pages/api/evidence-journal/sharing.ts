import type {NextApiRequest, NextApiResponse} from 'next';
import {authorizeLinearAthlete} from '../curriculum/runtime';
const {journalSharingState, setJournalSharing, authorizedJournalAnalysis} = require('../../../../netlify/functions/lib/journal-sharing');

export const createJournalSharingHandler = (deps: {authorize?: typeof authorizeLinearAthlete; fetch?: typeof fetch; now?: () => number} = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({error: 'Method not allowed.'});
  let identity;
  try {identity = await (deps.authorize || authorizeLinearAthlete)(req);} catch {return res.status(401).json({error: 'Sign in to manage your journal sharing.'});}
  try {
    const now = (deps.now || Date.now)();
    if (req.method === 'GET') return res.status(200).json(await journalSharingState(identity.db, identity.uid, req.query.entryId, now));
    const input = req.body || {};
    if (input.action === 'analyze') {
      await authorizedJournalAnalysis(identity.db, identity.uid, input.entryId, now);
      const response = await (deps.fetch || fetch)('https://fitwithpulse.ai/.netlify/functions/pulsecheck-chat', {
        method: 'POST', headers: {'Content-Type': 'application/json', Authorization: String(req.headers.authorization), 'x-pulsecheck-firebase-mode': String(req.headers['x-pulsecheck-firebase-mode'] || 'prod')},
        body: JSON.stringify({journalEntryId: input.entryId}), signal: AbortSignal.timeout(55000),
      });
      const result = await response.json();
      if (!response.ok) return res.status(response.status).json({error: typeof result.error === 'string' ? result.error : 'Nora could not reply. Your sharing choice is saved.', errorCode: result.errorCode});
      return res.status(200).json({...result, message: result.assistantMessage || result.message});
    }
    // Allowlist the public fields. Internal future-entry guards cannot be selected by a caller.
    const {action, entryId, entryRevision, teamId, disclosureVersion, accepted, enabled} = input;
    return res.status(200).json(await setJournalSharing(identity.db, identity.uid, {action, entryId, entryRevision, teamId, disclosureVersion, accepted, enabled}, now));
  } catch (error: any) {
    const status = [400, 403, 404, 409].includes(error?.status) ? error.status : 503;
    return res.status(status).json({error: status === 503 ? 'Journal sharing is unavailable. Your saved entry is still private unless you previously shared it.' : error.message});
  }
};
export const config = {api: {bodyParser: {sizeLimit: '16kb'}}};
export default createJournalSharingHandler();
