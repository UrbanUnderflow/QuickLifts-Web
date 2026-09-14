import type { NextApiRequest } from 'next';
import type { app, firestore } from 'firebase-admin';

export class CurriculumApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}
export type CurriculumAdminIdentity = { uid: string; email: string; db: firestore.Firestore; projectId: string };
/** Dependency injection keeps auth tests entirely separate from real Firebase. */
export const createCurriculumAdminAuthorizer = (getApp: (dev: boolean) => Promise<app.App> | app.App) => async (req: Pick<NextApiRequest, 'headers'>): Promise<CurriculumAdminIdentity> => {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer\s+\S+$/i.test(authorization)) throw new CurriculumApiError(401, 'unauthenticated', 'Sign in with a verified admin account.');
  const mode = req.headers['x-pulsecheck-firebase-mode'];
  if (mode !== undefined && mode !== 'dev' && mode !== 'prod') throw new CurriculumApiError(400, 'invalid_project', 'Choose a valid Firebase environment.');
  const selected = await getApp(mode === 'dev');
  let decoded;
  try { decoded = await selected.auth().verifyIdToken(authorization.replace(/^Bearer\s+/i, ''), true); }
  catch { throw new CurriculumApiError(401, 'invalid_token', 'Your sign-in could not be verified.'); }
  const email = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : '';
  if (!decoded.uid || !email || decoded.email_verified !== true || email.includes('/')) throw new CurriculumApiError(403, 'admin_required', 'A verified admin email is required.');
  const db = selected.firestore();
  const registry = await db.collection('admin').doc(email).get();
  if (!registry.exists || registry.data()?.disabled === true || registry.data()?.isActive === false) throw new CurriculumApiError(403, 'admin_required', 'Admin access is required in this Firebase environment.');
  return { uid: decoded.uid, email, db, projectId: selected.options.projectId || '' };
};
export const requireCurriculumAdmin = createCurriculumAdminAuthorizer(async dev => {
  const { getFirebaseAdminApp } = await import('../../../../lib/firebase-admin');
  return getFirebaseAdminApp(dev);
});
