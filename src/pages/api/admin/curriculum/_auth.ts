import type { NextApiRequest } from 'next';
import type { app, firestore } from 'firebase-admin';

export class CurriculumApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}
export type CurriculumAdminIdentity = { uid: string; email: string; displayName?: string; db: firestore.Firestore; projectId: string };
export const ATHLETIC_MIND_STAFF_PROJECT = 'theathleticmind-77954';
const CURRICULUM_PRODUCTION_PROJECT = 'quicklifts-dd3f1';
/** Dependency injection keeps auth tests entirely separate from real Firebase. */
export const createCurriculumAdminAuthorizer = (
  getApp: (dev: boolean) => Promise<app.App> | app.App,
  getStaffApp?: () => Promise<app.App> | app.App,
) => async (req: Pick<NextApiRequest, 'headers'>): Promise<CurriculumAdminIdentity> => {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer\s+\S+$/i.test(authorization)) throw new CurriculumApiError(401, 'unauthenticated', 'Sign in with a verified admin account.');
  const internal = req.headers['x-athleticmind-internal'];
  if (internal !== undefined && internal !== 'skill-curriculum') throw new CurriculumApiError(400, 'invalid_identity_source', 'Choose a supported sign-in source.');
  const isStaff = internal === 'skill-curriculum';
  const mode = req.headers['x-pulsecheck-firebase-mode'];
  if ((mode !== undefined && mode !== 'dev' && mode !== 'prod') || (isStaff && mode === 'dev')) throw new CurriculumApiError(400, 'invalid_project', 'Choose a valid Firebase environment.');
  const selected = await getApp(mode === 'dev');
  // Internal staff sessions operate on the existing production curriculum. A
  // local dev override must never silently turn that into another environment.
  if (isStaff && selected.options.projectId !== CURRICULUM_PRODUCTION_PROJECT) throw new CurriculumApiError(503, 'project_unavailable', 'The production curriculum is unavailable.');
  let decoded;
  try {
    const verifier = isStaff ? await getStaffApp?.() : selected;
    if (!verifier || (isStaff && verifier.options.projectId !== ATHLETIC_MIND_STAFF_PROJECT)) throw new Error('Unexpected identity project.');
    // Staff sessions use the same short-lived Google ID token as /internal.
    // Its issuer, signature and expiry are verified by the staff-project SDK.
    // Existing QuickLifts sessions retain their revocation check.
    decoded = await verifier.auth().verifyIdToken(authorization.replace(/^Bearer\s+/i, ''), !isStaff);
  }
  catch { throw new CurriculumApiError(401, 'invalid_token', 'Your sign-in could not be verified.'); }
  if (isStaff && (decoded.aud !== ATHLETIC_MIND_STAFF_PROJECT || decoded.iss !== `https://securetoken.google.com/${ATHLETIC_MIND_STAFF_PROJECT}` || decoded.firebase?.sign_in_provider !== 'google.com')) throw new CurriculumApiError(403, 'admin_required', 'A verified Google staff sign-in is required.');
  const email = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : '';
  if (!decoded.uid || !email || decoded.email_verified !== true || email.includes('/')) throw new CurriculumApiError(403, 'admin_required', 'A verified admin email is required.');
  const db = selected.firestore();
  const registry = await db.collection('admin').doc(email).get();
  if (!registry.exists || registry.data()?.disabled === true || registry.data()?.isActive === false) throw new CurriculumApiError(403, 'admin_required', 'Admin access is required in this Firebase environment.');
  // Namespace the verified external actor for audit fields; never impersonate
  // or mint a session for a QuickLifts user with a matching email.
  return { uid: isStaff ? `athleticmind:${decoded.uid}` : decoded.uid, email, ...(typeof decoded.name === 'string' ? { displayName: decoded.name.slice(0, 200) } : {}), db, projectId: selected.options.projectId || '' };
};
export const requireCurriculumAdmin = createCurriculumAdminAuthorizer(async dev => {
  const { getFirebaseAdminApp } = await import('../../../../lib/firebase-admin');
  return getFirebaseAdminApp(dev);
}, async () => {
  const { default: admin } = await import('firebase-admin');
  return admin.apps.find(candidate => candidate?.name === 'curriculum-athleticmind-staff')
    || admin.initializeApp({ projectId: ATHLETIC_MIND_STAFF_PROJECT }, 'curriculum-athleticmind-staff');
});
