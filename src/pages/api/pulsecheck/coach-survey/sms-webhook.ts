import type {NextApiRequest,NextApiResponse} from 'next';
import {verifySmsWebhook,recordSmsOptOut} from '../../../../lib/coachSurveys/smsOptOut';
export const config={api:{bodyParser:{sizeLimit:'16kb'}}};
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end();}
 // Separate from collection/delivery gates: once released, opt-out reception must
 // continue during a campaign pause. This switch defaults off before registration.
 if(process.env.COACH_SURVEY_SMS_WEBHOOK_ENABLED!=='true')return res.status(503).end();
 if(!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))return res.status(415).end();
 const signature=req.headers['x-twilio-signature'];
 const settings={authToken:process.env.TWILIO_AUTH_TOKEN||'',url:process.env.COACH_SURVEY_TWILIO_WEBHOOK_URL||'',accountSid:process.env.TWILIO_ACCOUNT_SID||'',to:process.env.TWILIO_FROM_NUMBER||''};
 if(typeof signature!=='string'||!verifySmsWebhook(req.body,signature,settings))return res.status(403).end();
 try{
  const {default:admin,getFirebaseAdminApp}=await import('../../../../lib/firebase-admin');
  await recordSmsOptOut(admin.firestore(getFirebaseAdminApp(process.env.COACH_SURVEY_FIREBASE_MODE==='dev')),req.body);
  // Empty TwiML sends no reply. Provider opt-out confirmations remain provider-owned.
  res.setHeader('Content-Type','text/xml');return res.status(200).send('<Response/>');
 }catch{return res.status(503).end();}
}
