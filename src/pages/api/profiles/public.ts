import type { NextApiRequest, NextApiResponse } from 'next';
import { loadPublicProfile } from '../../../lib/profiles/publicProjection';
export const createPublicProfileHandler = (load = loadPublicProfile, database?: () => Promise<any>) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const ids: unknown = req.method === 'POST' ? req.body?.userIds : [req.query.userId];
  const mode = req.headers['x-pulsecheck-firebase-mode'];
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 30 || ids.some(userId => typeof userId !== 'string' || !userId || userId.length > 128 || userId.includes('/')) || (mode !== undefined && mode !== 'dev' && mode !== 'prod')) return res.status(400).json({ error: 'Invalid profile request' });
  try {
    const db = database ? await database() : (await import('../../../lib/firebase-admin')).getFirebaseAdminApp(mode === 'dev').firestore();
    const profiles = (await Promise.all((ids as string[]).map(id => load(db, id)))).filter(Boolean);
    if (req.method === 'POST') return res.status(200).json({ profiles });
    const profile = profiles[0] || null;
    return res.status(profile ? 200 : 404).json({ profile });
  } catch { return res.status(503).json({ error: 'Could not load profile' }); }
};
export default createPublicProfileHandler();
