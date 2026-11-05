import type { NextApiRequest, NextApiResponse } from 'next';
import { verifySmsWebhook } from '../../../../lib/coachSurveys/smsOptOut';
import { receiveSms } from '../../../../lib/coach-communications/service';
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).end(); }
  if (process.env.COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED !== 'true' || !['dev','prod'].includes(process.env.COACH_COMMUNICATIONS_FIREBASE_MODE || '')) return res.status(503).end();
  if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) return res.status(415).end();
  const signature = req.headers['x-twilio-signature'];
  if (typeof signature !== 'string' || !verifySmsWebhook(req.body, signature, {
    authToken: process.env.TWILIO_AUTH_TOKEN || '', accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    to: process.env.TWILIO_FROM_NUMBER || '', url: process.env.COACH_COMMUNICATIONS_SMS_WEBHOOK_URL || '',
  })) return res.status(403).end();
  try {
    const { getFirebaseAdminApp } = await import('../../../../lib/firebase-admin');
    await receiveSms(getFirebaseAdminApp(process.env.COACH_COMMUNICATIONS_FIREBASE_MODE === 'dev').firestore(), req.body);
    res.setHeader('Content-Type','text/xml'); return res.status(200).send('<Response/>');
  } catch { return res.status(503).end(); }
}
