import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import { validateClinicalStaff } from '../../../../lib/pulsecheck/designatedClinicalStaff';

/** Explicit activation enables minimal staff alerts; it never grants access to athlete records. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'PUT'].includes(req.method || '')) { res.setHeader('Allow', 'GET, PUT'); return res.status(405).json({ error: 'GET or PUT required.' }); }
  if (!req.headers.authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in as a provisioning administrator.' });
  const app = getFirebaseAdminApp(req.headers['x-pulsecheck-firebase-mode'] === 'dev');
  let actor;
  try { actor = await app.auth().verifyIdToken(req.headers.authorization.slice(7), true); }
  catch { return res.status(401).json({ error: 'Sign in again to manage clinical staff.' }); }
  try {
    const db = app.firestore();
    const email = typeof actor.email === 'string' ? actor.email.trim() : '';
    const admins = email ? await Promise.all([...new Set([email, email.toLowerCase(), email.toUpperCase()])].map(e => db.collection('admin').doc(e).get())) : [];
    if (!admins.some(d => d.exists) || (await db.collection('account-closure-jobs').doc(actor.uid).get()).exists) return res.status(403).json({ error: 'Provisioning administrator access required.' });
    const teamId = req.method === 'GET' ? req.query.teamId : req.body?.teamId;
    if (typeof teamId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(teamId)) return res.status(400).json({ error: 'A valid team is required.' });
    const teamRef = db.collection('pulsecheck-teams').doc(teamId);
    const ref = db.collection('pulsecheck-team-escalation-settings').doc(teamId);
    const team = await teamRef.get();
    if (!team.exists) return res.status(404).json({ error: 'Team not found.' });
    const delivery = { email: Boolean(process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY),
      sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) };
    if (req.method === 'GET') return res.status(200).json({ config: (await ref.get()).data() || null, delivery, currentRoute: team.data()?.defaultEscalationRoute || 'hotline' });
    if (Object.keys(req.body || {}).some(k => !['teamId', 'configuration', 'expectedRevision', 'action'].includes(k))) return res.status(400).json({ error: 'Unsupported setting.' });
    const action = req.body.action || 'save';
    if (!['save', 'activate', 'deactivate'].includes(action)) return res.status(400).json({ error: 'Choose a valid contact action.' });
    if (action === 'activate' && !delivery.email) return res.status(400).json({ error: 'Configure email delivery before activating clinical staff alerts.' });
    // Stopping alerts must not depend on unsaved or incomplete contact edits.
    const config = action === 'deactivate' ? null : validateClinicalStaff(req.body.configuration);
    const expected = req.body.expectedRevision;
    if (!Number.isInteger(expected) || expected < 0) return res.status(400).json({ error: 'Reload these settings before saving.' });
    const saved = await db.runTransaction(async tx => {
      const currentTeam = await tx.get(teamRef);
      const org = await tx.get(db.collection('pulsecheck-organizations').doc(currentTeam.data()?.organizationId || '_missing'));
      const prior = await tx.get(ref);
      if (!currentTeam.exists || !org.exists || [currentTeam.data(), org.data()].some(d => d?.lifecycleState || d?.deletedAt || ['archived', 'decommissioned'].includes(d?.status))) throw new Error('Restore this program before changing its clinical staff settings.');
      if ((prior.data()?.revision || 0) !== expected) throw Object.assign(new Error('These settings changed in another session. Reload before saving.'), { statusCode: 409 });
      if (action === 'deactivate' && !prior.exists) throw new Error('No saved clinical staff settings were found.');
      if (action === 'activate' && [currentTeam.data(), org.data()].some(d => d?.status !== 'active')) throw new Error('Activate this program before enabling clinical staff alerts.');
      if (action === 'save' && prior.data()?.status === 'active') throw new Error('Deactivate alerts before saving a draft, or explicitly activate the updated contacts.');
      const next = { ...(action === 'deactivate' ? prior.data() : config), status: action === 'activate' ? 'active' : 'draft', revision: expected + 1, organizationId: org.id, teamId, updatedBy: actor.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      tx.set(ref, next);
      if (action === 'activate') tx.set(teamRef, { defaultEscalationRoute: 'clinician', clinicalDeliveryMode: 'designated_staff' }, { merge: true });
      if (action === 'deactivate' && currentTeam.data()?.clinicalDeliveryMode === 'designated_staff') tx.set(teamRef, { defaultEscalationRoute: 'hotline', clinicalDeliveryMode: 'resources_only' }, { merge: true });
      tx.set(ref.collection('audit').doc(), { action, revision: next.revision, actorUserId: actor.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      const currentRoute = action === 'activate' ? 'clinician'
        : action === 'deactivate' && currentTeam.data()?.clinicalDeliveryMode === 'designated_staff' ? 'hotline'
          : currentTeam.data()?.defaultEscalationRoute || 'hotline';
      return { config: next, currentRoute };
    });
    return res.status(200).json(saved);
  } catch (error) {
    return res.status((error as { statusCode?: number }).statusCode === 409 ? 409 : 400).json({ error: error instanceof Error ? error.message : 'Unable to save clinical staff settings.' });
  }
}
