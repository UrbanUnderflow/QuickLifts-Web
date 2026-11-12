import type { NextApiRequest, NextApiResponse } from 'next';
import type { firestore } from 'firebase-admin';

const OWNER = 'RI6D2h6ygab46uxxxZwVkYpWU6B2';
const TEAM = 'athleticmind-internal-test-team';
const EXPIRES = Date.parse('2026-11-13T00:00:00Z');
type Dependencies = {
  authorize: (req: NextApiRequest) => Promise<{uid: string; db: firestore.Firestore}>;
  scope: (db: firestore.Firestore, uid: string, team: string) => Promise<unknown>;
  key: () => string | undefined;
  fetch: typeof fetch;
  now: () => number;
};
/** Temporary owner-only, read-only probe. Never return credential material or provider prose. */
export function runtimeDiagnostic(deps: Dependencies) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (deps.now() >= EXPIRES) return res.status(404).end();
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
    if (req.headers.origin !== 'https://fitwithpulse.ai' || req.headers['x-pulsecheck-firebase-mode'] !== 'prod') return res.status(403).end();
    let identity;
    try { identity = await deps.authorize(req); } catch { return res.status(401).end(); }
    if (identity.uid !== OWNER) return res.status(403).end();
    try { await deps.scope(identity.db, identity.uid, TEAM); } catch { return res.status(403).end(); }
    const key = deps.key() || '';
    const shape = {
      present: !!key,
      placeholder: /^[*•]+$/.test(key) || /^(undefined|null|your[_ -].*|<.*>)$/i.test(key),
      whitespace: /\s/.test(key),
      quoted: /^["']|["']$/.test(key),
      keyPrefix: key.startsWith('KEY_'),
      bearerPrefix: /^Bearer\s/i.test(key),
    };
    if (!shape.present || shape.placeholder || shape.whitespace || shape.quoted || shape.bearerPrefix) return res.json({shape});
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await deps.fetch('https://api.telnyx.com/v2/balance', {
        method: 'GET', redirect: 'error', signal: controller.signal,
        headers: {Authorization: `Bearer ${key}`, Accept: 'application/json'},
      });
      let code: unknown;
      if (!response.ok) { const data = await response.json().catch(() => null); code = data?.errors?.[0]?.code; }
      else await response.body?.cancel();
      return res.json({shape, auth: {httpStatus: response.status, ...(typeof code === 'string' && /^\d{1,8}$/.test(code) ? {providerErrorCode: code} : {})}});
    } catch { return res.status(503).json({shape}); }
    finally { clearTimeout(timeout); }
  };
}
