import type { NextApiRequest, NextApiResponse } from 'next';
import { consumeDeveloperDocsAttempt, ensureDeveloperDocsRuntimeConfig, developerDocsConfig, developerDocsCookie, developerDocsPasswordValid, isDeveloperDocSlug } from '../../../../../lib/developerDocsServer';
export const createDeveloperDocsUnlockHandler = (dependencies: { db?: any } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const slug = req.query.slug;
  if (!isDeveloperDocSlug(slug)) return res.status(404).json({ error: 'Documentation not found.' });
  // Ordinary browser forms work even before client JavaScript loads or after autofill.
  const nativeForm = String(req.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase() === 'application/x-www-form-urlencoded';
  const respond = (status:number, error:string, code:string) => {
    if (nativeForm) { res.setHeader('Location', `/developer/api/${slug}?accessError=${code}`); res.statusCode = 303; return res.end(); }
    return res.status(status).json({ error });
  };
  try { await ensureDeveloperDocsRuntimeConfig(); } catch { return respond(503, 'Documentation access is temporarily unavailable.', 'unavailable'); }
  if (!developerDocsConfig()) return respond(503, 'Documentation access is not available yet.', 'unavailable');
  if (typeof req.body?.password !== 'string' || !req.body.password || req.body.password.length > 256) return respond(400, 'Enter the document password.', 'missing');
  try {
    const db = dependencies.db || (await import('../../../../../lib/firebase-admin')).default.firestore();
    const address = String((process.env.NETLIFY ? req.headers['x-nf-client-connection-ip'] : undefined) || req.socket.remoteAddress || 'unknown');
    if (!await consumeDeveloperDocsAttempt(db, slug, address)) { res.setHeader('Retry-After', '900'); return respond(429, 'Too many attempts. Try again later.', 'rate_limited'); }
    if (!developerDocsPasswordValid(req.body.password)) return respond(401, 'Incorrect password.', 'incorrect');
    res.setHeader('Set-Cookie', developerDocsCookie(slug));
    if (nativeForm) { res.setHeader('Location', `/developer/api/${slug}`); res.statusCode = 303; return res.end(); }
    return res.status(200).json({ success: true });
  } catch { return respond(503, 'Documentation access is temporarily unavailable.', 'unavailable'); }
};
export default createDeveloperDocsUnlockHandler();
