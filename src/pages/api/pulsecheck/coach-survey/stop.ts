import type { NextApiRequest, NextApiResponse } from 'next';
import { COLLECTION, ROOT, tokenDigest, validToken } from '../../../../lib/coachSurveys/service';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  if (!validToken(token)) return res.status(401).json({ error: 'Open your complete stop link.' });
  try {
    const { default: admin, getFirebaseAdminApp } = await import('../../../../lib/firebase-admin');
    const db = admin.firestore(getFirebaseAdminApp(process.env.COACH_SURVEY_FIREBASE_MODE === 'dev'));
    const root = db.collection(COLLECTION).doc(ROOT);
    await db.runTransaction(async tx => {
      const stop = (await tx.get(root.collection('stop-tokens').doc(tokenDigest(token)))).data();
      if (!stop && process.env.COACH_SURVEY_FIREBASE_MODE === 'dev') {
        // One-time test links have no enrollment to stop. Their existing capability
        // may confirm reminders are already off, without creating any records.
        const invite = (await tx.get(root.collection('invitations').doc(tokenDigest(token)))).data();
        if (invite?.testOnly === true && invite.enabled === true && invite.expiresAtMs > Date.now() && invite.programId === 'coach-user-test-20261025') return;
      }
      if (!stop || !/^[A-Za-z0-9_-]{1,128}$/.test(stop.enrollmentId)) throw Error('unavailable');
      const ref = root.collection('enrollments').doc(stop.enrollmentId);
      if (!(await tx.get(ref)).exists) throw Error('unavailable');
      tx.update(ref, { enabled: false, stoppedAtMs: Date.now() });
    });
    return res.json({ stopped: true });
  } catch { return res.status(503).json({ error: 'We could not confirm that check-ins stopped. Please retry or contact your program team.' }); }
}
