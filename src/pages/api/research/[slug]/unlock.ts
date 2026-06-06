import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import {
  createResearchArticleAccessCookieValue,
  getResearchArticleAccessConfig,
  serializeResearchArticleAccessCookie,
  verifyStoredResearchArticlePassword,
  verifyResearchArticlePassword,
} from '../../../../lib/researchArticleAccess';

const ACCESS_COLLECTION = 'researchArticleAccess';

const fetchStoredAccessConfig = async (slug: string, forceDevFirebase = false) => {
  try {
    const app = getFirebaseAdminApp(forceDevFirebase);
    const accessDoc = await app.firestore().collection(ACCESS_COLLECTION).doc(slug).get();
    if (!accessDoc.exists) return null;
    return accessDoc.data() || null;
  } catch (error) {
    console.warn('[research-unlock] Failed to fetch stored access config:', error);
    return null;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

  if (!slug || !password) {
    return res.status(400).json({ error: 'White paper and password are required.' });
  }

  const host = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host || '';
  const shouldTryDevFirebase = host.includes('localhost') || host.includes('127.0.0.1');
  const storedAccessConfig =
    (await fetchStoredAccessConfig(slug, false)) ||
    (shouldTryDevFirebase ? await fetchStoredAccessConfig(slug, true) : null);
  const hasStaticAccessConfig = Boolean(getResearchArticleAccessConfig(slug));

  if (!storedAccessConfig && !hasStaticAccessConfig) {
    return res.status(404).json({ error: 'Protected white paper not found.' });
  }

  const isValidPassword =
    verifyStoredResearchArticlePassword(password, storedAccessConfig) ||
    verifyResearchArticlePassword(slug, password);

  if (!isValidPassword) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const cookieSecretSeed =
    typeof storedAccessConfig?.passwordHash === 'string' ? storedAccessConfig.passwordHash : undefined;
  const cookieValue = createResearchArticleAccessCookieValue(slug, cookieSecretSeed);
  if (!cookieValue) {
    return res.status(500).json({ error: 'Protected white paper access is not configured.' });
  }

  res.setHeader('Set-Cookie', serializeResearchArticleAccessCookie(slug, cookieValue));
  return res.status(200).json({ success: true });
}
