import { normalizeSignInPolicy } from '../../../../lib/pulsecheck/signInPolicy';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../_auth';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import { validateProductBrand, normalizeAppBranding } from '../../../../lib/pulsecheck/productConfig';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
  if (!await requireAdminRequest(req)) return res.status(401).json({ error: 'Admin authentication required.' });
  try {
    const app = getFirebaseAdminApp(req.headers['x-pulsecheck-firebase-mode'] === 'dev' || req.headers['x-force-dev-firebase'] === 'true');
    const actor = await app.auth().verifyIdToken((req.headers.authorization || '').slice(7), true);
    const adminEmail = typeof actor.email === 'string' ? actor.email.trim() : '';
    const adminRecords = adminEmail ? await Promise.all([...new Set([adminEmail, adminEmail.toLowerCase(), adminEmail.toUpperCase()])].map(email => app.firestore().collection('admin').doc(email).get())) : [];
    if (!adminRecords.some(record => record.exists)) return res.status(403).json({ error: 'Admin authentication required.' });
    const { organizationId, configuration } = req.body || {};
    if (typeof organizationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)) throw new Error('Organization id is required.');
    const patch = {
      productBrand: validateProductBrand(configuration?.productBrand),
      ...(configuration.signInPolicy !== undefined ? { signInPolicy: normalizeSignInPolicy(configuration.signInPolicy) } : {}),
      ...(configuration.appBranding !== undefined ? { appBranding: normalizeAppBranding(configuration.appBranding) } : {}),
      productConfigurationUpdatedBy: actor.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const db = app.firestore();
    await db.runTransaction(async tx => {
      const ref = db.collection('pulsecheck-organizations').doc(organizationId);
      const [organization, closure] = await Promise.all([tx.get(ref), tx.get(db.collection('account-closure-jobs').doc(actor.uid))]);
      if (!organization.exists || closure.exists) throw new Error('Organization configuration is not available.');
      if (organization.data()?.lifecycleState || organization.data()?.deletedAt) throw new Error('Restore this organization before changing its configuration.');
      tx.update(ref, patch);
    });
    return res.status(200).json({ success: true });
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save configuration.' }); }
}
