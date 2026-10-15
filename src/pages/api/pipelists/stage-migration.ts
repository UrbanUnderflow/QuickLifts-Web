import type { NextApiRequest, NextApiResponse } from 'next';
import { guardPipeListsApiRequest } from '../../../utils/pipelistsRuntime';
import { universityStageMigration, UniversityMigrationError } from '../../../utils/pipelistsUniversityMigration';

// No call to this endpoint is made by the normal workspace/read lifecycle.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!guardPipeListsApiRequest(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed.' });
  try {
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return res.status(401).json({ success: false, error: 'Please sign in again.' });
    const { getSimpBudgetAuth, getSimpBudgetFirestore } = await import('../../../../netlify/functions/utils/getSimpBudgetServiceAccount');
    const user = await (await getSimpBudgetAuth()).verifyIdToken(token).catch(() => null);
    if (!user) return res.status(401).json({ success: false, error: 'Please sign in again.' });
    if (user.email?.toLowerCase() !== 'tremaine.grant@gmail.com') return res.status(403).json({ success: false, error: 'Only the existing PipeLists owner can approve a stage migration.' });
    const result = await universityStageMigration(await getSimpBudgetFirestore(), user.uid, req.body || {});
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(error instanceof UniversityMigrationError ? error.status : 500).json({ success: false, error: error instanceof UniversityMigrationError ? error.message : 'Unable to prepare or apply the migration. Check saved state before retrying.' });
  }
}
