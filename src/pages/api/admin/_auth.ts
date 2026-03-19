import type { NextApiRequest } from 'next';
import admin from '../../../lib/firebase-admin';

const ADMIN_COLLECTION = 'admin';

export async function requireAdminRequest(req: NextApiRequest): Promise<{ email: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    const email = decoded.email as string | undefined;
    if (!email) return null;

    const adminDoc = await admin.firestore().doc(`${ADMIN_COLLECTION}/${email}`).get();
    if (!adminDoc.exists) return null;

    return { email };
  } catch (error) {
    console.error('[admin-api-auth] Failed to verify admin token:', error);
    return null;
  }
}

