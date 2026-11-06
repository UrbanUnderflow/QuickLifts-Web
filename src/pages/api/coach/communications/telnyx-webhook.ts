import { communicationSetting } from '../../../../lib/coach-communications/config';
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyTelnyxEvent, telnyxIncomingForm, telnyxDeliveryForm } from '../../../../lib/coach-communications/provider';
import { receiveSms } from '../../../../lib/coach-communications/service';
import { recordDelivery } from '../../../../lib/coach-communications/queue';
export const config = { api: { bodyParser: false } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  // Continue accepting STOP while outbound sending/worker is disabled.
  if (communicationSetting('COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED') !== 'true' || communicationSetting('COACH_COMMUNICATIONS_FIREBASE_MODE') !== 'prod') return res.status(503).end();
  if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).end();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for await (const chunk of req) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += bytes.length; if (size > 32768) return res.status(413).end(); chunks.push(Uint8Array.from(bytes)); }
  } catch { return res.status(400).end(); }
  const event = verifyTelnyxEvent(Buffer.concat(chunks), req.headers['telnyx-signature-ed25519'], req.headers['telnyx-timestamp']);
  if (!event) return res.status(403).end();
  const incoming = telnyxIncomingForm(event), delivery = telnyxDeliveryForm(event, req.query.job);
  if (!incoming && !delivery) return res.status(204).end();
  try {
    const { getFirebaseAdminApp } = await import('../../../../lib/firebase-admin');
    const db = getFirebaseAdminApp(false).firestore();
    if (incoming) await receiveSms(db, incoming);
    else if (delivery) await recordDelivery(db, String(req.query.job), delivery, 'telnyx');
    return res.status(204).end();
  } catch { return res.status(503).end(); }
}
