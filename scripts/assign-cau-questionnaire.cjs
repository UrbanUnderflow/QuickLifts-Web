// Usage: node scripts/assign-cau-questionnaire.cjs --project PROJECT --uid UID --team TEAM --environment test|live --apply
// Defaults to a read-only plan. Requires application-default admin credentials.
const admin = require('firebase-admin');
const {randomUUID} = require('node:crypto');
const args = process.argv.slice(2);
const option = key => args[args.indexOf(key)+1];
(async()=>{
 for(const flag of ['--project','--uid','--team','--environment']) if(!args.includes(flag)||!option(flag)||option(flag).startsWith('--'))throw Error(`Missing ${flag}`);
 const projectId=option('--project'), uid=option('--uid'), teamId=option('--team'),environment=option('--environment');
 if(!['test','live'].includes(environment))throw Error('Environment must be test or live');
 admin.initializeApp({credential:admin.credential.applicationDefault(),projectId});
 const db=admin.firestore();
 const member=await db.collection('pulsecheck-team-memberships').doc(`${teamId}_${uid}`).get();
 if(member.data()?.status!=='active'||member.data()?.revokedAt)throw Error('Active membership required');
 const ref=db.collection('pulsecheck-restricted-questionnaire-submissions').doc(`assignment_${uid}`);
 const existing=await ref.get();
 if(existing.exists)throw Error('Assignment already exists. Review it instead of overwriting submission identity.');
 const assignment={kind:'assignment',enabled:true,version:'cau-operational-web-v1',submissionId:randomUUID(),teamId,environment,universityCode:environment==='test'?'SANDBOX':'CAU'};
 if(args.includes('--apply'))await ref.create({...assignment,createdAt:admin.firestore.FieldValue.serverTimestamp()});
 console.log(JSON.stringify({applied:args.includes('--apply'),projectId,uid,assignment},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
