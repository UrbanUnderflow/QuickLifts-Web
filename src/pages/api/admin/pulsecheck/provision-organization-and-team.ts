import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../_auth';
import { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { provisionPulseCheckOrganizationAndTeam } = require('../../../../lib/server/pulsecheck/provisionOrganizationAndTeam');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const adminRequest = await requireAdminRequest(req);
  if (!adminRequest) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }

  const payload = req.body && typeof req.body === 'object' ? req.body : null;
  if (!payload?.organization || !payload?.team) {
    return res.status(400).json({ error: 'organization and team payloads are required.' });
  }

  const forceDevFirebase =
    req.headers['x-force-dev-firebase'] === 'true' ||
    req.headers['x-force-dev-firebase'] === '1' ||
    payload.forceDevFirebase === true;

  try {
    const adminApp = getFirebaseAdminApp(forceDevFirebase);
    const result = await provisionPulseCheckOrganizationAndTeam({
      adminApp,
      input: {
        actorLabel: `api/admin/pulsecheck/provision-organization-and-team (${adminRequest.email})`,
        organization: payload.organization,
        team: payload.team,
      },
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[pulsecheck-admin-provision] Failed to provision organization/team:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to provision PulseCheck organization/team.',
    });
  }
}
