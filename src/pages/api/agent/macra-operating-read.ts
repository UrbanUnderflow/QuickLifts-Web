import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const { buildMacraOperatingRead } = require('../../../../scripts/lib/macraOpsRead');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const dateKey = typeof req.query.date === 'string' ? req.query.date : undefined;
    const read = await buildMacraOperatingRead(admin.firestore(), { dateKey });
    return res.status(200).json({ read });
  } catch (error: any) {
    console.error('[macra-operating-read] failed', error);
    return res.status(500).json({ error: error?.message || 'Failed to build Macra operating read' });
  }
}
