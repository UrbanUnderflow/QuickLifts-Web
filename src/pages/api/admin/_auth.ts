import type { NextApiRequest } from 'next';
import admin, { getFirebaseAdminApp } from '../../../lib/firebase-admin';

const ADMIN_COLLECTION = 'admin';
const USERS_COLLECTION = 'users';

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
      const uid = decoded.uid as string | undefined;
      if (!email && !uid) {
        continue;
      }

      let userDocumentEmail: string | null = null;
      if (uid) {
        const userDoc = await adminDb.doc(`${USERS_COLLECTION}/${uid}`).get();
        if (userDoc.exists) {
          const userDocData = userDoc.data() || {};
          const candidateUserEmail = typeof userDocData.email === 'string' ? userDocData.email.trim() : '';
          if (candidateUserEmail) {
            userDocumentEmail = candidateUserEmail;
          }
        }
      }

      const emailCandidates = Array.from(
        new Set(
          [email, userDocumentEmail]
            .filter((value): value is string => Boolean(value))
            .flatMap((value) => [value, value.toLowerCase(), value.toUpperCase()])
        )
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
