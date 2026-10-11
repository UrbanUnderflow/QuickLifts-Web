import type { NextApiRequest, NextApiResponse } from 'next';
import { consumeDeveloperDocsAttempt, ensureDeveloperDocsRuntimeConfig, developerDocsConfig, developerDocsCookie, developerDocsPasswordValid, isDeveloperDocSlug } from '../../../../../lib/developerDocsServer';
export const createDeveloperDocsUnlockHandler = (dependencies: { db?: any } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const slug = req.query.slug;
  if (!isDeveloperDocSlug(slug)) return res.status(404).json({ error: 'Documentation not found.' });
  try { await ensureDeveloperDocsRuntimeConfig(); } catch { return res.status(503).json({ error: 'Documentation access is temporarily unavailable.' }); }
  if (!developerDocsConfig()) return res.status(503).json({ error: 'Documentation access is not available yet.' });
  if (typeof req.body?.password !== 'string' || !req.body.password || req.body.password.length > 256) return res.status(400).json({ error: 'Enter the document password.' });
  try {
    const db = dependencies.db || (await import('../../../../../lib/firebase-admin')).default.firestore();
    const address = String((process.env.NETLIFY ? req.headers['x-nf-client-connection-ip'] : undefined) || req.socket.remoteAddress || 'unknown');
    if (!await consumeDeveloperDocsAttempt(db, slug, address)) { res.setHeader('Retry-After', '900'); return res.status(429).json({ error: 'Too many attempts. Try again later.' }); }
    if (!developerDocsPasswordValid(req.body.password)) return res.status(401).json({ error: 'Incorrect password.' });
    res.setHeader('Set-Cookie', developerDocsCookie(slug));
    return res.status(200).json({ success: true });
  } catch { return res.status(503).json({ error: 'Documentation access is temporarily unavailable.' }); }
};
export default createDeveloperDocsUnlockHandler();
