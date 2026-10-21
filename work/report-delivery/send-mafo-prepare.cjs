const admin=require('firebase-admin');
const {resolveAdminCredential}=require('../../scripts/lib/resolveAdminCredential');
const {prepareParticipationReport,deliveryId,resolveReportRecipients}=require('./helper.cjs');
(async()=>{
const db=admin.initializeApp({credential:resolveAdminCredential({quiet:true}),projectId:'quicklifts-dd3f1'}).firestore();
const teamId='GlKi00GszJxnSnY8eh80',uid='5KSFovpFbvgb1tT8q467Jt86zxg1',kind='weekly',reportDate='2026-10-18';
const recipients=await resolveReportRecipients(db,teamId,[uid]);
if(recipients.length!==1||recipients[0].email.toLowerCase()!=='jmafo@cau.edu')throw Error('Recipient mismatch');
const id=deliveryId(teamId,uid,kind,reportDate),ref=db.collection('coach-team-insight-reports').doc('delivery').collection('reports').doc(id);
if((await ref.get()).exists)throw Error('Report already exists; inspect before sending');
const report=await prepareParticipationReport(db,uid,teamId,kind,reportDate,id);
await ref.create({teamId,uid,kind,reportDate,status:'preparing',recipientEmail:recipients[0].email,subject:report.subject,contentHtml:report.contentHtml,athleteIds:report.athleteIds,from:report.from,to:report.to,deliveryProvider:'gmail-manual',updatedAt:Date.now()});
console.log(JSON.stringify({id,to:recipients[0].email,...report}));await admin.app().delete();
})().catch(e=>{console.error(e.message);process.exit(1)});
