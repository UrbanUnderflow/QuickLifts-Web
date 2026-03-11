import type { NextApiRequest } from 'next';
import admin from '../../../../../lib/firebase-admin';

const ADMIN_COLLECTION = 'admin';

export async function requireAdminRequest(req: NextApiRequest): Promise<{ email: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const idToken = authHeader.slice(7);

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email as string | undefined;
    if (!email) return null;

    const adminDoc = await admin.firestore().doc(`${ADMIN_COLLECTION}/${email}`).get();
    if (!adminDoc.exists) return null;

    return { email };
  } catch (error) {
    console.error('[system-overview-share] Admin auth failed:', error);
    return null;
  }
}
