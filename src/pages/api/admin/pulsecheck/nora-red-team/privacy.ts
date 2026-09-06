import { PRIVACY_CASES } from '../../../../../lib/nora-red-team/privacyCatalog';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireNoraTestingRequest } from '../../../../../lib/nora-red-team/access';
import { createNoraRedTeamBridgeClient } from '../../../../../lib/nora-red-team/modelClient';
import { runPrivacySimulation } from '../../../../../lib/nora-red-team/privacySimulation';
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Use POST.' });
  try {
    if (!(await requireNoraTestingRequest(req)))
      return res
        .status(403)
        .json({ error: 'Nora testing access is required.' });
    if (
      Object.keys(req.body || {}).some((key) => key !== 'offset') ||
      (req.body?.offset !== undefined &&
        (!Number.isInteger(req.body.offset) ||
          req.body.offset < 0 ||
          req.body.offset >= PRIVACY_CASES.length))
    )
      return res.status(400).json({
        error: 'This simulator accepts built-in synthetic cases only.',
      });
    const client = createNoraRedTeamBridgeClient({
      authorization: String(req.headers.authorization || ''),
      bridgeOrigin:
        process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai',
      featureId: 'noraRedTeam',
      firebaseMode:
        req.headers['x-pulsecheck-firebase-mode'] === 'dev' ? 'dev' : 'prod',
    });
    return res.json(
      await runPrivacySimulation(client, req.body?.offset || 0, 10),
    );
  } catch {
    return res
      .status(500)
      .json({ error: 'The privacy simulation could not finish. Try again.' });
  }
}
