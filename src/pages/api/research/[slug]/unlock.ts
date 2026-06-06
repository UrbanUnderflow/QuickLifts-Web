import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createResearchArticleAccessCookieValue,
  getResearchArticleAccessConfig,
  serializeResearchArticleAccessCookie,
  verifyResearchArticlePassword,
} from '../../../../lib/researchArticleAccess';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

  if (!slug || !password) {
    return res.status(400).json({ error: 'White paper and password are required.' });
  }

  if (!getResearchArticleAccessConfig(slug)) {
    return res.status(404).json({ error: 'Protected white paper not found.' });
  }

  if (!verifyResearchArticlePassword(slug, password)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const cookieValue = createResearchArticleAccessCookieValue(slug);
  if (!cookieValue) {
    return res.status(500).json({ error: 'Protected white paper access is not configured.' });
  }

  res.setHeader('Set-Cookie', serializeResearchArticleAccessCookie(slug, cookieValue));
  return res.status(200).json({ success: true });
}
