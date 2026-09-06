import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import {
  NORA_OWNER_ADMIN_EMAIL,
  requireNoraTestingRequest,
  getNoraTestingTeam,
  updateNoraTestingTeam,
} from '../../../../../lib/nora-red-team/access';
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'PUT'].includes(req.method || ''))
    return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const identity = await requireNoraTestingRequest(req);
    if (!identity)
      return res
        .status(403)
        .json({
          error:
            'Nora testing access is required. Sign in with a verified email added by an owner.',
        });
    if (req.method === 'GET')
      return res.json({ ...(await getNoraTestingTeam()), identity, canManageOwners: identity.email === NORA_OWNER_ADMIN_EMAIL });
    const team = await updateNoraTestingTeam(
      getFirebaseAdminApp(false).firestore(),
      {
        members: req.body?.members,
        revision: req.body?.revision,
        email: identity.email,
        isGlobalAdmin: identity.isGlobalAdmin,
      },
    );
    return res.json({
      members: team.members,
      revision: team.revision,
      identity,
    });
  } catch (error) {
    return res
      .status(409)
      .json({
        error:
          error instanceof Error
            ? error.message
            : 'Team access could not be saved.',
      });
  }
}
