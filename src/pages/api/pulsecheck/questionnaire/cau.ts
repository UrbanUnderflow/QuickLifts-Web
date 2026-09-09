import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash, timingSafeEqual } from 'crypto';
import { COLLECTION, validateSubmission } from '../../../../lib/questionnaires/cau';
export const config = { api: { bodyParser: { sizeLimit: '128kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  // Off until the receiving deployment, access rules, and privacy notice are verified.
  const secret = process.env.CAU_QUESTIONNAIRE_INVITE_KEY;
  if (process.env.CAU_QUESTIONNAIRE_COLLECTION_ENABLED !== 'true' || !secret) return res.status(503).json({ error: 'This questionnaire is not open for submissions yet.' });
  const supplied = typeof req.headers.authorization === 'string' ? req.headers.authorization.replace(/^Bearer /, '') : '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(new Uint8Array(digest(supplied)), new Uint8Array(digest(secret)))) return res.status(403).json({ error: 'Use the questionnaire link provided by your pilot team.' });
  const submissionId = req.body?.submissionId;
  if (typeof submissionId !== 'string' || !/^[a-f0-9-]{36}$/.test(submissionId)) return res.status(400).json({ error: 'Invalid submission ID.' });
  let validated;
  try { validated = validateSubmission(req.body); } catch (error) { return res.status(400).json({ error: (error as Error).message }); }
  try {
    const { default: admin } = await import('../../../../lib/firebase-admin');
    const db = admin.firestore();
    const digestValue = createHash('sha256').update(JSON.stringify(validated)).digest('hex');
    const ref = db.collection(COLLECTION).doc(submissionId);
    await db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.get('payloadDigest') !== digestValue) throw Error('CONFLICT');
        return;
      }
      tx.create(ref, { ...validated, revision: 1, payloadDigest: digestValue, submittedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    return res.status(200).json({ saved: true, submissionId });
  } catch { return res.status(500).json({ error: 'Your answers could not be saved. Please try again.' }); }
}
