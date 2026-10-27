import type { NextApiRequest, NextApiResponse } from 'next';
import { publicProgram, registerPublicCoach } from '../../../../lib/coachSurveys/publicRegistration';
import { SurveyError } from '../../../../lib/coachSurveys/service';
import { contentApproved } from '../../../../lib/coachSurveys/questionnaire';
export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!['GET', 'POST'].includes(req.method || '')) { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }
  if (process.env.COACH_SURVEY_PUBLIC_ONBOARDING_ENABLED !== 'true' || process.env.COACH_SURVEY_COLLECTION_ENABLED !== 'true' || !contentApproved.baseline) return res.status(503).json({error:'Coach registration is not open yet. Please contact your program team.'});
  if (req.method === 'POST') {
    if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).end();
    const origin = req.headers.origin;
    let sameOrigin = false;
    try { sameOrigin = Boolean(origin && new URL(origin).host === req.headers.host); } catch {}
    if (!sameOrigin) return res.status(403).json({error:'Open this form directly to continue.'});
  }
  try {
    const {default:admin,getFirebaseAdminApp} = await import('../../../../lib/firebase-admin');
    const app = getFirebaseAdminApp(process.env.COACH_SURVEY_FIREBASE_MODE === 'dev');
    const db = admin.firestore(app);
    if (req.method === 'GET') return res.json(await publicProgram(db, req.query.organization));
    // Netlify supplies this header. Never persist raw addresses or contact data in logs.
    const address = String(req.headers['x-nf-client-connection-ip'] || req.socket.remoteAddress || 'unknown');
    return res.json(await registerPublicCoach(db, admin.auth(app), req.body, address));
  } catch (error) {
    if (error instanceof SurveyError) return res.status(error.status).json({error:error.message});
    return res.status(503).json({error:'We could not finish setup. Please try again with the same details.'});
  }
}
