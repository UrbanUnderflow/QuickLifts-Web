import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import { createStoredResearchArticlePasswordConfig } from '../../../../lib/researchArticleAccess';
import { requireAdminRequest } from '../_auth';

const ACCESS_COLLECTION = 'researchArticleAccess';

const isValidResearchSlug = (slug: string) => /^[a-z0-9][a-z0-9-]{1,180}[a-z0-9]$/.test(slug);

const shouldUseDevFirebase = (req: NextApiRequest) => {
  const firebaseMode = Array.isArray(req.headers['x-pulsecheck-firebase-mode'])
    ? req.headers['x-pulsecheck-firebase-mode'][0]
    : req.headers['x-pulsecheck-firebase-mode'];
  const pulsecheckDevFirebase = Array.isArray(req.headers['x-pulsecheck-dev-firebase'])
    ? req.headers['x-pulsecheck-dev-firebase'][0]
    : req.headers['x-pulsecheck-dev-firebase'];

  return (
    firebaseMode === 'dev' ||
    pulsecheckDevFirebase === 'true' ||
    pulsecheckDevFirebase === '1' ||
    req.headers['x-force-dev-firebase'] === 'true' ||
    req.headers['x-force-dev-firebase'] === '1'
  );
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Admin access is required.' });
  }

  const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : '';
  const passwordProtected = req.body?.passwordProtected === true;
  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

  if (!isValidResearchSlug(slug)) {
    return res.status(400).json({ error: 'A valid article slug is required.' });
  }

  const app = getFirebaseAdminApp(shouldUseDevFirebase(req));
  const db = app.firestore();
  const accessRef = db.collection(ACCESS_COLLECTION).doc(slug);

  if (!passwordProtected) {
    await accessRef.delete();
    return res.status(200).json({ success: true, passwordProtected: false });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const passwordConfig = createStoredResearchArticlePasswordConfig(password);
  await accessRef.set(
    {
      ...passwordConfig,
      slug,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: adminUser.email,
    },
    { merge: true },
  );

  return res.status(200).json({ success: true, passwordProtected: true });
}
