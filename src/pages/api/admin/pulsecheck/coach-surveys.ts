import { previewBaselineEmail, sendBaselineEmail } from '../../../../lib/coachSurveys/manualEmail';
import type { NextApiRequest, NextApiResponse } from 'next';
import { assertSurveyAdmin, manageCoachSurvey, readCoachSurveys, readCoachSurveyUserTest } from '../../../../lib/coachSurveys/admin';
export const config = { api: { bodyParser: { sizeLimit: '12kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET','POST'].includes(req.method || '')) { res.setHeader('Allow','GET, POST'); return res.status(405).end(); }
  if (process.env.COACH_SURVEY_COLLECTION_ENABLED !== 'true') return res.status(503).json({error:'Coach survey collection is disabled pending release review.'});
  const bearer=req.headers.authorization;
  if (!bearer?.startsWith('Bearer ')) return res.status(401).json({error:'Admin sign-in required.'});
  let identity;
  try {
    const { getFirebaseAdminApp }=await import('../../../../lib/firebase-admin');
    // Same-environment revoked-token and existing admin-document checks. No local
    // bypass, cross-project fallback or new permission grant.
    identity=await assertSurveyAdmin(getFirebaseAdminApp(process.env.COACH_SURVEY_FIREBASE_MODE==='dev'),bearer.slice(7));
  } catch { return res.status(403).json({error:'Admin access is required in the selected survey environment.'}); }
  try {
    if(req.method==='POST'){
      if(process.env.COACH_SURVEY_ADMIN_WRITES_ENABLED!=='true')return res.status(503).json({error:'Administration writes are disabled pending release review.'});
      if (['preview-baseline-email','send-baseline-email'].includes(req.body?.action)) {
        const action=req.body.action==='preview-baseline-email'?previewBaselineEmail:sendBaselineEmail;
        return res.json(await action(identity.db,identity.uid,req.body,process.env.COACH_SURVEY_ORIGIN || ''));
      }
      return res.json(await manageCoachSurvey(identity.db,identity.uid,req.body));
    }
    if (req.query.userTest === '1') {
      if (process.env.COACH_SURVEY_FIREBASE_MODE !== 'dev') return res.status(404).end();
      return res.json(await readCoachSurveyUserTest(identity.db));
    }
    return res.json(await readCoachSurveys(identity.db,String(req.query.teamId||'')));
  } catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Unable to manage coach surveys.'});}
}
