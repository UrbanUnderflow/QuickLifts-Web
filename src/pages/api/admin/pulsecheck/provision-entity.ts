import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../_auth';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
const { provisionEntity } = require('../../../../lib/server/pulsecheck/provisionEntity');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
  const actor = await requireAdminRequest(req);
  if (!actor) return res.status(401).json({ error: 'Admin authentication required.' });
  try {
    const app = getFirebaseAdminApp(req.headers['x-pulsecheck-firebase-mode'] === 'dev' || req.headers['x-force-dev-firebase'] === 'true');
    const decoded = await app.auth().verifyIdToken((req.headers.authorization || '').slice(7), true);
    const result = await provisionEntity(app.firestore(), { ...req.body, actor: actor.email, actorUid: decoded.uid }, admin.firestore.FieldValue.serverTimestamp());
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to provision.' });
  }
}
