import type { NextApiRequest, NextApiResponse } from 'next';
import { loadPublicDirectory, parseDirectoryQuery } from '../../../lib/profiles/publicDirectory';
export const createPublicDirectoryHandler = (load = loadPublicDirectory, database?: () => Promise<any>) => async (req: NextApiRequest,res: NextApiResponse) => {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const input = parseDirectoryQuery(req.query);
  const mode = req.headers['x-pulsecheck-firebase-mode'];
  if(!input || (mode !== undefined && mode !== 'prod' && mode !== 'dev')) return res.status(400).json({error:'Invalid profile search'});
  try {
    const db = database ? await database() : (await import('../../../lib/firebase-admin')).getFirebaseAdminApp(mode === 'dev').firestore();
    return res.status(200).json(await load(db,input));
  } catch {return res.status(503).json({error:'Could not load profiles'});}
};
export default createPublicDirectoryHandler();
