import { communicationSetting } from '../../../../lib/coach-communications/config';
import type { NextApiRequest, NextApiResponse } from 'next';
import { recordDelivery, verifyStatusWebhook } from '../../../../lib/coach-communications/queue';
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  if (communicationSetting('COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED') !== 'true' || !['dev','prod'].includes(communicationSetting('COACH_COMMUNICATIONS_FIREBASE_MODE') || '')) return res.status(503).end();
  if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) return res.status(415).end();
  if (!verifyStatusWebhook(req.query.job, req.body, req.headers['x-twilio-signature'])) return res.status(403).end();
  try {
    const { getFirebaseAdminApp } = await import('../../../../lib/firebase-admin');
    await recordDelivery(getFirebaseAdminApp(communicationSetting('COACH_COMMUNICATIONS_FIREBASE_MODE') === 'dev').firestore(), String(req.query.job), req.body);
    return res.status(204).end();
  } catch { return res.status(503).end(); }
}
