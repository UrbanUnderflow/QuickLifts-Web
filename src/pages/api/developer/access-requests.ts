import type { NextApiRequest, NextApiResponse } from 'next';
const { requestPartnerAccess } = require('../../../../netlify/functions/lib/partner-api-keys');
export const createAccessRequestHandler = (dependencies: { getDb?: () => Promise<any> } = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const db = dependencies.getDb ? await dependencies.getDb() : (await import('../../../lib/firebase-admin')).default.firestore();
    const address = String((process.env.NETLIFY ? req.headers['x-nf-client-connection-ip'] : undefined) || req.socket.remoteAddress || 'unknown');
    const { organizationName, contactName, contactEmail, intendedUse } = req.body || {};
    return res.status(201).json(await requestPartnerAccess(db, { organizationName, contactName, contactEmail, intendedUse, address }));
  } catch (error: any) { return res.status(error.statusCode || 503).json({ error: error.code || 'access_request_unavailable' }); }
};
export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
export default createAccessRequestHandler();
