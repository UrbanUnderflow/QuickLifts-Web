import { randomBytes, createHash } from 'node:crypto';
import type { firestore } from 'firebase-admin';
import { assertReportAudience, resolveReportRecipients, validateDeliveryConfig } from './reportDelivery';
const root=(db:firestore.Firestore)=>db.collection('coach-team-insight-reports').doc('delivery');
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
/** Bearer grants are limited to one already-authorized report; only their digest is stored. */
export async function issueReportLink(db:firestore.Firestore,reportId:string,recipientEmail:string,now=Date.now()){
 const token=randomBytes(32).toString('base64url');
 await root(db).collection('report-links').doc(digest(token)).set({reportId,recipientEmail:recipientEmail.toLowerCase(),createdAt:now,expiresAt:now+7*86400000,revoked:false});
 return `https://fitwithpulse.ai/reports/participation?token=${token}`;
}
export async function readLinkedReport(db:firestore.Firestore,token:string,now=Date.now()){
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Invalid link');
 const grant=(await root(db).collection('report-links').doc(digest(token)).get()).data();
 if(!grant||grant.revoked||!(grant.expiresAt>now))throw new Error('Expired link');
 const report=(await root(db).collection('reports').doc(grant.reportId).get()).data();
 if(!report||report.status!=='sent'||report.revoked===true||!report.contentHtml)throw new Error('Unavailable report');
 const config=validateDeliveryConfig((await root(db).collection('configs').doc(report.teamId).get()).data());
 if(!config.recipientUids.includes(report.uid))throw new Error('Recipient removed');
 const [primary]=await resolveReportRecipients(db,report.teamId,[report.uid]);
 const email=grant.recipientEmail;
 if(email!==primary.email.toLowerCase()&&(!report.cc?.some((p:{email:string})=>p.email.toLowerCase()===email)||!config.recipientCc?.[report.uid]?.some(p=>p.email.toLowerCase()===email)))throw new Error('Recipient removed');
 await assertReportAudience(db,report.uid,report.teamId,report.athleteIds||[]);
 return {subject:report.subject,contentHtml:report.contentHtml};
}
