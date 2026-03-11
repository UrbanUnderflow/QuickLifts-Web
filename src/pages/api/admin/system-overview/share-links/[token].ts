import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../../lib/firebase-admin';
import { requireAdminRequest } from './_auth';

const COLLECTION = 'systemOverviewShareLinks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) {
    return res.status(400).json({ error: 'Share token is required.' });
  }

  try {
    await admin.firestore().collection(COLLECTION).doc(token).set(
      {
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedByEmail: adminUser.email,
      },
      { merge: true }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[system-overview-share] Failed to revoke link:', error);
    return res.status(500).json({ error: 'Failed to revoke share link.' });
  }
}
