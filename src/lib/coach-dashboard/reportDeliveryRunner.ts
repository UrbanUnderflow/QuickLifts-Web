import { issueReportLink } from './reportLinks';
import type { firestore } from 'firebase-admin';
import { randomUUID } from 'node:crypto';
import { validateDeliveryConfig, dueReports, deliveryId, resolveReportRecipients, prepareParticipationReport, assertReportAudience, reportRunDue, type ReportRun } from './reportDelivery';
import { sendBrevoTransactionalEmail } from '../../../netlify/functions/utils/emailSequenceHelpers';
export async function runReportDeliveries(db:firestore.Firestore,now=new Date(),deps:{send?:typeof sendBrevoTransactionalEmail;prepare?:typeof prepareParticipationReport;budgetMs?:number;run?:ReportRun}={}){
 const started=Date.now(), result={sent:0,failed:0,skipped:0};
 const configs=await db.collection('coach-team-insight-reports').doc('delivery').collection('configs').get();
 for(const doc of configs.docs){
  let config;try{config=validateDeliveryConfig(doc.data());if(config.teamId!==doc.id)continue;}catch{continue;}
  for(const due of reportRunDue(config,now,deps.run))for(const uid of config.recipientUids.filter(uid=>!deps.run||uid===deps.run.uid)){
   if(Date.now()-started>(deps.budgetMs??20000))return result;
   const id=deliveryId(config.teamId,uid,due.kind,due.reportDate),ref=db.collection('coach-team-insight-reports').doc('delivery').collection('reports').doc(id),runId=randomUUID();
   const claimed=await db.runTransaction(async tx=>{const old=(await tx.get(ref)).data();if(old?.status==='sent'||old?.status==='suppressed'||(old?.leaseUntil||0)>Date.now())return false;
    tx.set(ref,{teamId:config.teamId,uid,kind:due.kind,reportDate:due.reportDate,status:'preparing',runId,leaseUntil:Date.now()+5*60000,updatedAt:Date.now()},{merge:true});return true;});
   if(!claimed){result.skipped++;continue;}
   try{
    // Check saved settings again, so a paused schedule or removed recipient stops retries.
    const current=validateDeliveryConfig((await doc.ref.get()).data());
    if(!current.recipientUids.includes(uid)||!reportRunDue(current,now,deps.run).some(d=>d.kind===due.kind&&d.reportDate===due.reportDate))throw new Error('Delivery settings changed.');
    const [recipient]=await resolveReportRecipients(db,config.teamId,[uid]);
    const report=await(deps.prepare||prepareParticipationReport)(db,uid,config.teamId,due.kind,due.reportDate,id);
    // Verify authorization and destination again after data preparation.
    const [verified]=await resolveReportRecipients(db,config.teamId,[uid]);
    await assertReportAudience(db,uid,config.teamId,report.athleteIds);
    if(verified.email!==recipient.email)throw new Error('Recipient email changed during preparation.');
    const latest=validateDeliveryConfig((await doc.ref.get()).data());
    if(!latest.recipientUids.includes(uid)||!reportRunDue(latest,now,deps.run).some(d=>d.kind===due.kind&&d.reportDate===due.reportDate))throw new Error('Delivery settings changed.');
    const cc=(latest.recipientCc?.[uid]||[]).filter(person=>person.email!==recipient.email);
    await ref.set({senderName:report.senderName||null,cc,subject:report.subject,contentHtml:report.contentHtml,athleteIds:report.athleteIds,from:report.from,to:report.to,recipientEmail:recipient.email,status:'sending',updatedAt:Date.now()},{merge:true});
    const sent=await(deps.send||sendBrevoTransactionalEmail)({sender:report.senderName?{name:report.senderName}:undefined,toEmail:recipient.email,toName:recipient.name,cc,checkAllRecipientSuppression:true,subject:report.subject,htmlContent:report.html.replaceAll(`https://fitwithpulse.ai/coach/participation-report?id=${id}`,await issueReportLink(db,id,recipient.email)),tags:['coach-participation-report',due.kind],bypassDailyRecipientLimit:true,idempotencyKey:'coach-participation-'+id,idempotencyMetadata:{teamId:config.teamId,uid,kind:due.kind,reportDate:due.reportDate},failClosedOnSuppressionError:true});
    if(!sent.success||sent.skipped&&!sent.messageId&&!sent.suppressed)throw new Error(sent.error||'Delivery deferred by email limits or an active send lock.');
    await ref.set({status:sent.suppressed?'suppressed':'sent',messageId:sent.messageId||null,sentAt:sent.suppressed?null:Date.now(),lastError:sent.suppressionReason||null,leaseUntil:0,updatedAt:Date.now()},{merge:true});
    if(sent.suppressed)result.skipped++;else result.sent++;
   }catch(error){await ref.set({status:'failed',lastError:error instanceof Error?error.message:'Report delivery failed.',leaseUntil:0,updatedAt:Date.now()},{merge:true});result.failed++;}
  }
 }
 return result;
}
