import type { NextApiRequest } from 'next';
import admin, { getFirebaseAdminApp } from '../../../lib/firebase-admin';

const ADMIN_COLLECTION = 'admin';

export async function requireAdminRequest(req: NextApiRequest): Promise<{ email: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const forceDevFirebase =
    req.headers['x-force-dev-firebase'] === 'true' ||
    req.headers['x-force-dev-firebase'] === '1';
  const candidateApps = forceDevFirebase
    ? [getFirebaseAdminApp(true), admin.app()]
    : [admin.app(), getFirebaseAdminApp(true)];
  const idToken = authHeader.slice(7);

  for (const adminApp of candidateApps) {
    const adminAuth = adminApp.auth();
    const adminDb = adminApp.firestore();

    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = decoded.email as string | undefined;
      if (!email) {
        continue;
      }

      const emailCandidates = Array.from(
        new Set([email, email.toLowerCase(), email.toUpperCase()])
      );

      for (const candidateEmail of emailCandidates) {
        const adminDoc = await adminDb.doc(`${ADMIN_COLLECTION}/${candidateEmail}`).get();
        if (adminDoc.exists) {
          return { email: candidateEmail };
        }
      }
    } catch (error) {
      console.error('[admin-api-auth] Failed to verify admin token against app:', adminApp.name, error);
    }
  }

  return null;
}
