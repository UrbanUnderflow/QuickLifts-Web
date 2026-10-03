import type { NextApiRequest } from 'next';
import type { firestore } from 'firebase-admin';
/** Verify the selected Firebase environment and revoked tokens on every request. */
export async function authorizeDashboardRequest(req: NextApiRequest): Promise<{ uid: string; db: firestore.Firestore }> {
  const mode = req.headers['x-pulsecheck-firebase-mode'];
  if (mode !== undefined && mode !== 'dev' && mode !== 'prod') throw new Error('Invalid environment');
  if (typeof req.headers.authorization !== 'string' || !req.headers.authorization.startsWith('Bearer ')) throw new Error('Missing sign-in');
  const { getFirebaseAdminApp } = await import('../firebase-admin');
  const app = getFirebaseAdminApp(mode === 'dev');
  const token = await app.auth().verifyIdToken(req.headers.authorization.slice(7), true);
  if (!token.uid) throw new Error('Missing identity');
  return { uid: token.uid, db: app.firestore() };
}
