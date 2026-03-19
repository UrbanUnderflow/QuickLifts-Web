import type { NextApiRequest } from 'next';
import admin, { getFirebaseAdminApp } from '../../../lib/firebase-admin';

const ADMIN_COLLECTION = 'admin';

export async function requireAdminRequest(req: NextApiRequest): Promise<{ email: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const forceDevFirebase =
    req.headers['x-force-dev-firebase'] === 'true' ||
    req.headers['x-force-dev-firebase'] === '1';
  const adminApp = forceDevFirebase ? getFirebaseAdminApp(true) : admin.app();
  const adminAuth = adminApp.auth();
  const adminDb = adminApp.firestore();

  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    const email = decoded.email as string | undefined;
    if (!email) return null;

    const adminDoc = await adminDb.doc(`${ADMIN_COLLECTION}/${email}`).get();
    if (!adminDoc.exists) return null;

    return { email };
  } catch (error) {
    console.error('[admin-api-auth] Failed to verify admin token:', error);
    return null;
  }
}
