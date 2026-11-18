import { createHash } from 'node:crypto';
import type { firestore } from 'firebase-admin';
import { assertReportAudience, deliveryId, dueReports, resolveReportRecipients, validateDeliveryConfig, reportRunDue, type ReportRun } from './reportDelivery';
import { sendQueuedSms, type Transport } from '../coach-communications/queue';
import { consentAllows, rootFor, transportReady } from '../coach-communications/service';
import { smsSender } from '../coach-communications/provider';
import { COLLECTION, ROOT, tokenDigest } from '../coachSurveys/service';

const root = (db:firestore.Firestore) => db.collection('coach-team-insight-reports').doc('delivery');
export const reportSmsId = (reportId:string,ccEmail='') => createHash('sha256').update(`coach-report-sms:${reportId}${ccEmail?':'+ccEmail:''}`).digest('hex');
export async function resolveReportSmsRecipient(db:firestore.Firestore,teamId:string,uid:string,overridePhone?:string){
 await resolveReportRecipients(db,teamId,[uid]);
 const profile=(await db.collection('users').doc(uid).get()).data()||{};
 const contact=(await rootFor(db).collection('contacts').doc(`${teamId}_${uid}`).get()).data?.()||{};
 const phone=String(overridePhone||contact.phone||profile.phoneNumber||profile.phone||'').trim();
 if(!/^\+[1-9]\d{9,14}$/.test(phone))throw new Error('Report recipient has no valid phone number.');
 if(!consentAllows({...contact,teamId,athleteId:uid,phone},teamId,uid))throw new Error('Report recipient has paused or disabled texts.');
 const suppression=await db.collection(COLLECTION).doc(ROOT).collection('sms-suppressions').doc(tokenDigest(phone)).get();
 if(suppression.data?.()?.suppressed===true)throw new Error('Report recipient has opted out of texts.');
 return phone;
}

/** Separate durable channel record: email retries never resend an accepted text.
 * Only a generic notification/link crosses SMS; report content requires sign-in. */
export async function runReportSmsDeliveries(db:firestore.Firestore,now=new Date(),deps:{send?:Transport;ready?:()=>boolean;budgetMs?:number;run?:ReportRun}={}){
 const started=Date.now(),result={accepted:0,failed:0,skipped:0};
 if(!(deps.ready||(()=>transportReady('prod')))())return result;
 const configs=await root(db).collection('configs').get();
 for(const configDoc of configs.docs){
  let config;try{config=validateDeliveryConfig(configDoc.data());if(config.teamId!==configDoc.id)continue;}catch{continue;}
  for(const due of reportRunDue(config,now,deps.run))for(const uid of config.recipientUids.filter(uid=>!deps.run||uid===deps.run.uid))for(const target of [...(config.smsRecipientUids?.includes(uid)?[{email:''}]:[]),...(config.recipientSmsCc?.[uid]||[])]){
   if(Date.now()-started>(deps.budgetMs??12000))return result;
   const reportId=deliveryId(config.teamId,uid,due.kind,due.reportDate),id=reportSmsId(reportId,target.email),ref=root(db).collection('sms-deliveries').doc(id);
   const prior=(await ref.get()).data?.();
   // A lost response or interrupted send may already have reached the provider.
   // Never automatically resend these records, including after a worker restart.
   if(prior&&['sending','unknown','accepted','sent','delivered','undelivered','failed'].includes(prior.status)){result.skipped++;continue;}
   const report=(await root(db).collection('reports').doc(reportId).get()).data?.();
   if(!report||report.status!=='sent'){result.skipped++;continue;}
   const configured=(c:ReturnType<typeof validateDeliveryConfig>)=>target.email?c.recipientSmsCc?.[uid]?.find(p=>p.email===target.email)?.phone:(c.smsRecipientUids?.includes(uid)?c.recipientSmsPhones?.[uid]||'profile':undefined);
   let claimed=false;
   try{
    const latest=validateDeliveryConfig((await configDoc.ref.get()).data());
    if(!configured(latest)||!reportRunDue(latest,now,deps.run).some(d=>d.kind===due.kind&&d.reportDate===due.reportDate))throw new Error('Report text delivery settings changed.');
    let phone:string;
    if(target.email){
     await resolveReportRecipients(db,config.teamId,[uid]);
     if(!report.cc?.some((p:{email:string})=>p.email===target.email))throw new Error('Text CC recipient did not receive this report.');
     phone=configured(latest)!;
     if((await db.collection(COLLECTION).doc(ROOT).collection('sms-suppressions').doc(tokenDigest(phone)).get()).data?.()?.suppressed===true)throw new Error('Report recipient has opted out of texts.');
    }else phone=await resolveReportSmsRecipient(db,config.teamId,uid,latest.recipientSmsPhones?.[uid]);
    await assertReportAudience(db,uid,config.teamId,report.athleteIds||[]);
    // Read recipient and settings again immediately before reserving the send.
    const fresh=validateDeliveryConfig((await configDoc.ref.get()).data());
    if(!configured(fresh)||!reportRunDue(fresh,now,deps.run).some(d=>d.kind===due.kind&&d.reportDate===due.reportDate)||(target.email?configured(fresh)!==phone:await resolveReportSmsRecipient(db,config.teamId,uid,fresh.recipientSmsPhones?.[uid])!==phone))throw new Error('Report recipient or settings changed.');
    if((await db.collection(COLLECTION).doc(ROOT).collection('sms-suppressions').doc(tokenDigest(phone)).get()).data?.()?.suppressed===true)throw new Error('Report recipient has opted out of texts.');
    claimed=await db.runTransaction(async tx=>{const old=(await tx.get(ref)).data();if(old&&old.status!=='blocked')return false;
     tx.set(ref,{reportId,teamId:config.teamId,uid,ccEmail:target.email||null,kind:due.kind,reportDate:due.reportDate,status:'sending',phoneHash:tokenDigest(phone),sender:smsSender(),claimedAt:Date.now(),updatedAt:Date.now()});return true;});
    if(!claimed){result.skipped++;continue;}
    const body=target.email?`AthleticMind: Your ${due.kind} team participation report is ready. Check your email for the report.\nReply STOP to opt out.`:`AthleticMind: Your ${due.kind} team participation report is ready. Sign in to view it: https://fitwithpulse.ai/coach/participation-report?id=${reportId}\nReply STOP to opt out.`;
    let sent;try{sent=await(deps.send||sendQueuedSms)({to:phone,body,jobId:id});}catch{sent={state:'unknown' as const};}
    await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(current?.status!=='sending')return;
     tx.set(ref,{status:sent.state,providerId:sent.providerId||null,diagnostics:sent.diagnostics||null,updatedAt:Date.now()},{merge:true});});
    if(sent.state==='accepted')result.accepted++;else result.failed++;
   }catch(error){
    if(claimed)await ref.set({status:'unknown',updatedAt:Date.now()},{merge:true});
    else await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(current&&current.status!=='blocked')return;tx.set(ref,{reportId,teamId:config.teamId,uid,ccEmail:target.email||null,kind:due.kind,reportDate:due.reportDate,status:'blocked',lastError:error instanceof Error?error.message:'Report text unavailable.',updatedAt:Date.now()},{merge:true});});
    result.failed++;
   }
  }
 }
 return result;
}

/** Input has already passed Telnyx signature/profile validation in the webhook. */
export async function recordReportSmsDelivery(db:firestore.Firestore,id:string,form:Record<string,string>){
 if(!/^[a-f0-9]{64}$/.test(id))return;
 const ref=root(db).collection('sms-deliveries').doc(id);
 await db.runTransaction(async tx=>{const record=(await tx.get(ref)).data();
  if(!record||record.phoneHash!==tokenDigest(form.To||'')||record.sender!==form.From||record.providerId&&record.providerId!==form.MessageSid)return;
  if(['delivered','undelivered','failed'].includes(record.status)||!['sent','delivered','undelivered','failed'].includes(form.MessageStatus))return;
  tx.set(ref,{status:form.MessageStatus,providerId:form.MessageSid,updatedAt:Date.now()},{merge:true});
 });
}

