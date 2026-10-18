import type { NextApiRequest, NextApiResponse } from 'next';
const { revealPartnerKey, approvePartnerAccessRequest, rotatePartnerKey, revokePartnerKey, updatePartnerKeyGrants, listPartnerAccess } = require('../../../../../netlify/functions/lib/partner-api-keys');
type Dependencies = { getDb?: () => Promise<any>; authorize?: (req: NextApiRequest) => Promise<{ email: string } | null> };
export const createPartnerKeyAdminHandler = (dependencies: Dependencies = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ error: 'method_not_allowed' });
  try {
    await require('../../../../../netlify/functions/lib/partner-runtime-config').ensurePartnerRuntimeConfig();
    const authorize = dependencies.authorize || (await import('../../../../lib/partnerApiAdminAuth')).requirePartnerApiAdmin;
    const actor = await authorize(req); if (!actor) return res.status(401).json({ error: 'unauthorized' });
    const db = dependencies.getDb ? await dependencies.getDb() : (await import('../../../../lib/firebase-admin')).default.firestore();
    if (req.method === 'GET') return res.status(200).json(await listPartnerAccess(db, { cursors: { requests: req.query.requestsCursor, keys: req.query.keysCursor, organizations: req.query.organizationsCursor, teams: req.query.teamsCursor } }));
    const input = req.body || {}, actorEmail = actor.email;
    if (input.action === 'approve') {
      const { requestId, partnerId, partnerName, scopeMode, grants, scopes, environment, expiresAt, maxRequestsPerMinute } = input;
      return res.status(201).json(await approvePartnerAccessRequest(db, { requestId, partnerId, partnerName, scopeMode, grants, scopes, environment, expiresAt, maxRequestsPerMinute, actorEmail }));
    }
    if (input.action === 'reveal') return res.status(200).json(await revealPartnerKey(db, { keyId: input.keyId, actorEmail }));
    if (input.action === 'update-grants') return res.status(200).json(await updatePartnerKeyGrants(db, { keyId: input.keyId, scopeMode: input.scopeMode, grants: input.grants, actorEmail }));
    if (input.action === 'rotate') return res.status(201).json(await rotatePartnerKey(db, { keyId: input.keyId, overlapMinutes: input.overlapMinutes, actorEmail }));
    if (input.action === 'revoke') return res.status(200).json(await revokePartnerKey(db, { keyId: input.keyId, actorEmail }));
    return res.status(400).json({ error: 'invalid_action' });
  } catch (error: any) { return res.status(error.statusCode || 503).json({ error: error.code || 'key_management_unavailable' }); }
};
export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
export default createPartnerKeyAdminHandler();
