import type { NextApiRequest, NextApiResponse } from 'next';
const { partnerPortalAction } = require('../../../../../../netlify/functions/lib/partner-portal');
const { ensurePartnerRuntimeConfig } = require('../../../../../../netlify/functions/lib/partner-runtime-config');
import { developerDocsCookie, developerDocsCookieName } from '../../../../../lib/developerDocsServer';
type Dependencies = { getDb?: () => Promise<any>; ensureConfig?: () => Promise<void>; trustedOrigin?: string; now?: () => number };
export const createPartnerPortalHandler = (dependencies: Dependencies = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const action = req.query.action;
  if (typeof action !== 'string' || !['login', 'session', 'secret', 'logout', 'rotate'].includes(action)) return res.status(404).json({ error: 'not_found' });
  const method = action === 'session' ? 'GET' : 'POST';
  if (req.method !== method) return res.status(405).json({ error: 'method_not_allowed' });
  const trustedOrigin = dependencies.trustedOrigin || 'https://fitwithpulse.ai';
  if ((method === 'POST' && req.headers.origin !== trustedOrigin) || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))) return res.status(403).json({ error: 'origin_not_allowed' });
  try {
    await (dependencies.ensureConfig || ensurePartnerRuntimeConfig)();
    const db = dependencies.getDb ? await dependencies.getDb() : (await import('../../../../../lib/firebase-admin')).default.firestore();
    const address = String((process.env.NETLIFY ? req.headers['x-nf-client-connection-ip'] : undefined) || req.socket?.remoteAddress || 'unknown');
    const result = await partnerPortalAction(db, { action, password: req.body?.password, expectedKeyId: req.body?.expectedKeyId, overlapMinutes: req.body?.overlapMinutes, cookieHeader: req.headers.cookie, address, now: dependencies.now?.() });
    const cookies = result.cookie ? [result.cookie] : [];
    if (action === 'login') for (const slug of ['athleticmind-snapshots', 'clinical-bridge'] as const) cookies.push(developerDocsCookie(slug));
    if (action === 'logout') for (const slug of ['athleticmind-snapshots', 'clinical-bridge'] as const) cookies.push(`${developerDocsCookieName(slug)}=; Path=/developer/api; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    return res.status(200).json(result.body);
  } catch (error: any) {
    const allowed = ['invalid_authentication', 'rate_limited', 'partner_secret_unavailable', 'partner_runtime_config_unavailable', 'credential_changed', 'invalid_rotation', 'key_not_active', 'invalid_saved_organization_or_team_scope', 'key_encryption_unavailable'];
    const code = allowed.includes(error?.code) ? error.code : 'partner_portal_unavailable';
    if (code === 'rate_limited') res.setHeader('Retry-After', ['secret', 'rotate'].includes(action) ? '60' : '900');
    return res.status(allowed.includes(error?.code) ? error.statusCode || 503 : 503).json({ error: code });
  }
};
export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
export default createPartnerPortalHandler();
