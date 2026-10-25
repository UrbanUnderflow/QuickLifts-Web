import type { NextApiRequest, NextApiResponse } from 'next';
import { isSurveyKind, contentApproved } from '../../../../lib/coachSurveys/questionnaire';
import { processSurvey, validToken, SurveyError } from '../../../../lib/coachSurveys/service';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!['GET', 'POST'].includes(req.method || '')) { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }
  if (!isSurveyKind(req.query.kind)) return res.status(404).end();
  // Closed by default. No runtime Firebase import, collection access or writes
  // until the storage/issuance review and explicit release configuration.
  if (!contentApproved[req.query.kind] || process.env.COACH_SURVEY_COLLECTION_ENABLED !== 'true') {
    return res.status(503).json({ error: 'This questionnaire is not open yet. Please contact your program team.' });
  }
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  if (!validToken(token)) return res.status(401).json({ error: 'Open the complete survey link from your program contact.' });
  if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json')) return res.status(415).end();
  try {
    const { default: admin, getFirebaseAdminApp } = await import('../../../../lib/firebase-admin');
    // Environment is server-controlled; never accept client environment switches.
    const app = getFirebaseAdminApp(process.env.COACH_SURVEY_FIREBASE_MODE === 'dev');
    const result = await processSurvey(admin.firestore(app), token, req.query.kind, req.method === 'POST' ? req.body : undefined);
    return res.json(result);
  } catch (error) {
    if (error instanceof SurveyError) return res.status(error.status).json({ error: error.message });
    // Never log the token or answer payload.
    return res.status(503).json({ error: 'We could not confirm your response. Your answers are still on this page. Please try again.' });
  }
}
