import type { NextApiRequest, NextApiResponse } from 'next';
import type { firestore } from 'firebase-admin';
import { runLinearRuntime, linearRuntimeEnabled } from '../../../api/firebase/dailyCurriculum/linearRuntimeAdmin';
export async function authorizeLinearAthlete(req: NextApiRequest): Promise<{ uid: string; db: firestore.Firestore }> {
  const mode = req.headers['x-pulsecheck-firebase-mode'];
  if (mode !== undefined && mode !== 'dev' && mode !== 'prod') throw new Error('Invalid environment');
  if (typeof req.headers.authorization !== 'string' || !req.headers.authorization.startsWith('Bearer ')) throw new Error('Missing sign-in');
  const { getFirebaseAdminApp } = await import('../../../lib/firebase-admin');
  const app = getFirebaseAdminApp(mode === 'dev');
  const token = await app.auth().verifyIdToken(req.headers.authorization.slice(7), true);
  if (!token.uid) throw new Error('Missing identity');
  return { uid: token.uid, db: app.firestore() };
}
export const createLinearRuntimeHandler = (deps: { enabled?: () => boolean; authorize?: (req: NextApiRequest) => Promise<{ uid: string; db: firestore.Firestore }>; run?: typeof runLinearRuntime } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(deps.enabled || linearRuntimeEnabled)()) return res.status(200).json({ status: 'legacy' });
  const mode = req.headers['x-pulsecheck-firebase-mode'];
  if (mode !== undefined && mode !== 'dev' && mode !== 'prod') return res.status(400).json({ error: 'Invalid environment' });
  if (typeof req.headers.authorization !== 'string' || !req.headers.authorization.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in to continue' });
  let identity: { uid: string; db: firestore.Firestore };
  try {
    identity = await (deps.authorize || authorizeLinearAthlete)(req);
    if (!identity.uid) throw new Error('Missing identity');
  } catch { return res.status(401).json({ error: 'Your sign-in could not be verified.' }); }
  const { action, assignmentId, outcome } = req.body || {};
  if (!['today','start','complete'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  try {
    return res.status(200).json(await (deps.run || runLinearRuntime)(identity.db, { athleteId: identity.uid, action, assignmentId, outcome }, { enabled: true }));
  } catch { return res.status(503).json({ status: 'blocked', reason: 'The assignment could not be verified. Your progress has not been reset.' }); }
};
export default createLinearRuntimeHandler();
