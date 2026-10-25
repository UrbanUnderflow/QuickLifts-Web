import type { NextApiRequest, NextApiResponse } from 'next';

// Same-account sign-in for the embedded baseline. Credentials never enter a URL.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const { default: admin, getFirebaseAdminApp } = await import('../../../lib/firebase-admin');
    const app = getFirebaseAdminApp(req.headers['x-pulsecheck-firebase-mode'] === 'dev');
    const user = await admin.auth(app).verifyIdToken(token, true);
    const customToken = await admin.auth(app).createCustomToken(user.uid);
    return res.json({ customToken, userID: user.uid });
  } catch { return res.status(401).json({ error: 'Your session could not be confirmed. Try signing in again.' }); }
}
