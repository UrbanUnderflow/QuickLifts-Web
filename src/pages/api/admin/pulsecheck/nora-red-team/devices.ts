import type { NextApiRequest, NextApiResponse } from 'next';
import { requireNoraTestingRequest } from '../../../../../lib/nora-red-team/access';
import { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import { NoraScenarioLibrary } from '../../../../../lib/nora-red-team/library';
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method || ''))
    return res.status(405).json({ error: 'Method not allowed.' });
  const identity = await requireNoraTestingRequest(req);
  if (!identity)
    return res.status(401).json({ error: 'Admin authorization is required.' });
  const db = getFirebaseAdminApp(false).firestore();
  if (req.method === 'GET') {
    const rows = await db
      .collection('nora-red-team-device-evidence')
      .orderBy('reviewedAt', 'desc')
      .limit(20)
      .get();
    return res.json({ evidence: rows.docs.map((d) => d.data()) });
  }
  const owners = await new NoraScenarioLibrary(db).owners();
  if (!owners.includes(identity.email.toLowerCase()))
    return res.status(403).json({
      error: 'The designated production review owner records device evidence.',
    });
  const { build, platform, passed, note } = req.body || {};
  if (
    !/^[a-f0-9]{40}$/i.test(build) ||
    !['ios', 'android'].includes(platform) ||
    typeof passed !== 'boolean' ||
    typeof note !== 'string' ||
    note.trim().length < 20 ||
    note.length > 4000
  )
    return res.status(400).json({
      error:
        'Include the exact release commit, platform, result and evidence notes (20–4,000 characters).',
    });
  const evidence = {
    build,
    platform,
    passed,
    note,
    reviewerEmail: identity.email,
    reviewedAt: new Date().toISOString(),
  };
  await db.collection('nora-red-team-device-evidence').add(evidence);
  return res.json({ evidence });
}
