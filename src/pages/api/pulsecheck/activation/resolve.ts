import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import { ActivationError, resolveActivation } from '../../../../lib/server/pulsecheck/activation-preview';
// Best-effort per-instance backstop; activation identifiers themselves carry high entropy.
const attempts = new Map<string, {count: number; until: number}>();
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({error: 'Method not allowed.'}); }
  const ip = String(req.headers['x-nf-client-connection-ip'] || req.socket?.remoteAddress || 'unknown');
  const now = Date.now();
  for (const [key, bucket] of attempts) if (bucket.until <= now) attempts.delete(key);
  const bucket = attempts.get(ip) || {count: 0, until: now + 60_000};
  if (++bucket.count > 300 || (attempts.size >= 10_000 && !attempts.has(ip))) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({code: 'TRY_AGAIN_LATER', error: 'Please wait a minute and try again.'});
  }
  attempts.set(ip, bucket);
  try {
    const dev = req.body?.forceDevFirebase === true || req.headers['x-pulsecheck-firebase-mode'] === 'dev';
    return res.status(200).json(await resolveActivation(admin.firestore(getFirebaseAdminApp(dev)), req.body?.code));
  } catch (error) {
    if (error instanceof ActivationError) return res.status(error.status).json({code: error.code, error: error.message});
    return res.status(503).json({code: 'PREVIEW_UNAVAILABLE', error: 'Unable to check the invitation. Please try again.'});
  }
}
