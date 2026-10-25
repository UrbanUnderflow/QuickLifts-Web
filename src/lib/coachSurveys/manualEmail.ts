import { manageCoachSurvey, verifyCoach } from './admin';
import { coachEmail } from './messages';
import { tokenDigest } from './service';
export async function previewBaselineEmail(db:FirebaseFirestore.Firestore,actor:string,request:any,origin:string) {
  if(!/^https:\/\/[a-z0-9.-]+$/i.test(origin)) throw Error('A configured HTTPS survey origin is required.');
  const coach=await verifyCoach(db,request.participantId,request.teamId);
  if(!coach.email) throw Error('This coach has no verified account email.');
  const invitation=await manageCoachSurvey(db,actor,{...request,action:'baseline-link'}) as {path:string;managePath:string};
  const message=coachEmail('baseline',origin+invitation.path,origin+invitation.managePath);
  const confirmationId=tokenDigest(JSON.stringify([coach.uid,request.teamId,request.programId,coach.email,message]));
  return {recipient:coach.email,...message,confirmationId};
}
export async function sendBaselineEmail(db:FirebaseFirestore.Firestore,actor:string,request:any,origin:string) {
  if(process.env.COACH_SURVEY_MANUAL_EMAIL_ENABLED!=='true') throw Error('Manual email delivery is held for release approval.');
  const preview=await previewBaselineEmail(db,actor,request,origin);
  if(request.confirmationId!==preview.confirmationId) throw Error('The recipient or invitation changed. Review the email again before sending.');
  const {sendBrevoTransactionalEmail}=await import('../../../netlify/functions/utils/emailSequenceHelpers');
  const result=await sendBrevoTransactionalEmail({toEmail:preview.recipient,subject:preview.subject,htmlContent:preview.html,textContent:preview.text,idempotencyKey:`coach-baseline-${preview.confirmationId}`,failClosedOnSuppressionError:true,tags:['coach-baseline']});
  if(result.suppressed||result.skipped)return {status:'held'};
  if(result.success&&result.messageId)return {status:'accepted'};
  return {status:'unconfirmed'}; // Do not imply delivery or invite a blind retry.
}
