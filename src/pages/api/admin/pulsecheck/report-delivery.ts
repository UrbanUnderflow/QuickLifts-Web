import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../_auth';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import { dashboardAccess, validTeamId } from '../../../../lib/coach-dashboard/access';
import { validateDeliveryConfig, resolveReportRecipients } from '../../../../lib/coach-dashboard/reportDelivery';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method || '')) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'GET or POST required.' }); }
  if (!await requireAdminRequest(req)) return res.status(401).json({ error: 'Admin authentication required.' });
  try {
    const app = getFirebaseAdminApp(req.headers['x-pulsecheck-firebase-mode'] === 'dev' || req.headers['x-force-dev-firebase'] === 'true');
    // Verify against the same database being changed, including token revocation.
    const actor = await app.auth().verifyIdToken((req.headers.authorization || '').slice(7), true);
    const email = typeof actor.email === 'string' ? actor.email.trim() : '';
    const db = app.firestore();
    const admins = email ? await Promise.all([...new Set([email, email.toLowerCase(), email.toUpperCase()])].map(value => db.collection('admin').doc(value).get())) : [];
    if (!admins.some(record => record.exists)) return res.status(403).json({ error: 'Admin authentication required.' });
    if ((await db.collection('account-closure-jobs').doc(actor.uid).get()).exists) return res.status(403).json({ error: 'Account is unavailable.' });
    const teamId = req.method === 'POST' ? req.body?.teamId : req.query.teamId;
    if (!validTeamId(teamId)) return res.status(400).json({ error: 'A valid team is required.' });
    if (!(await db.collection('pulsecheck-teams').doc(teamId).get()).exists) return res.status(404).json({ error: 'Team not found.' });
    const configRef = db.collection('coach-team-insight-reports').doc('delivery').collection('configs').doc(teamId);
    if (req.method === 'POST') {
      const allowed = new Set(['teamId', 'dailyEnabled', 'weeklyEnabled', 'timeZone', 'sendHour', 'startDate', 'recipientUids', 'recipientCc']);
      if (Object.keys(req.body || {}).some(key => !allowed.has(key))) return res.status(400).json({ error: 'Unsupported report setting.' });
      const requested = validateDeliveryConfig(req.body);
      await resolveReportRecipients(db, teamId, requested.recipientUids);
      const config = await db.runTransaction(async transaction => {
        const saved = (await transaction.get(configRef)).data();
        // Older open dashboards omit CC settings. Preserve the latest saved mapping
        // for retained recipients; an explicit empty mapping still clears all CCs.
        const recipientCc = Object.prototype.hasOwnProperty.call(req.body, 'recipientCc')
          ? requested.recipientCc
          : Object.fromEntries(Object.entries(saved?.recipientCc || {}).filter(([uid]) => requested.recipientUids.includes(uid)));
        const next = validateDeliveryConfig({ ...requested, recipientCc });
        transaction.set(configRef, { ...next, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actor.uid });
        return next;
      });
      return res.status(200).json({ config });
    }
    const [saved, memberships, deliverySnapshot] = await Promise.all([
      configRef.get(), db.collection('pulsecheck-team-memberships').where('teamId', '==', teamId).get(),
      db.collection('coach-team-insight-reports').doc('delivery').collection('reports').where('teamId', '==', teamId).get(),
    ]);
    const candidateUids = [...new Set(memberships.docs.map(doc => doc.data()).filter(member => typeof member.userId === 'string' && dashboardAccess(member, member.userId, teamId).participation).map(member => member.userId as string))];
    // Resolve candidates individually so one unavailable account cannot hide eligible staff.
    const candidates = await Promise.all(candidateUids.map(async uid => {
      try { return await resolveReportRecipients(db, teamId, [uid]); } catch { return []; }
    }));
    const recipients = candidates.flat().sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    const stored = saved.data();
    const config = stored ? { teamId, dailyEnabled: stored.dailyEnabled === true, weeklyEnabled: stored.weeklyEnabled === true, timeZone: stored.timeZone, sendHour: stored.sendHour, startDate: stored.startDate, recipientUids: stored.recipientUids || [], recipientCc: stored.recipientCc || {} } : {
      teamId, dailyEnabled: false, weeklyEnabled: false, timeZone: 'America/New_York', sendHour: 8,
      startDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), recipientUids: [], recipientCc: {},
    };
    const iso = (value: any): string | null => value?.toDate ? value.toDate().toISOString() : typeof value === 'number' ? new Date(value).toISOString() : typeof value === 'string' ? value : null;
    const deliveries = deliverySnapshot.docs.map(doc => { const d = doc.data(); return { id: doc.id, kind: d.kind, reportDate: d.reportDate, status: d.status, recipientEmail: d.recipientEmail || null, cc: d.cc || [], lastError: d.lastError || null, sentAt: iso(d.sentAt), updatedAt: iso(d.updatedAt) }; }).sort((a, b) => (b.updatedAt || b.sentAt || '').localeCompare(a.updatedAt || a.sentAt || '')).slice(0, 10);
    return res.status(200).json({ config, recipients, deliveries });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to manage report delivery.' });
  }
}
