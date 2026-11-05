#!/usr/bin/env node
'use strict';
// Synthetic school activation configuration only. Never reads a real project.
const fs=require('node:fs');
const{client,assertManifest}=require('./emulator-fixtures.cjs');
(async()=>{
 const path=process.argv[2],mode=process.argv[3]||'agreements';
 if(!path||!['agreements','baseline-ready'].includes(mode))throw Error('Private fixture and recognized school mode required.');
 const m=assertManifest(JSON.parse(fs.readFileSync(path,'utf8'))),{auth,db,admin}=await client();
 if(mode==='baseline-ready'&&m.scenario!=='baseline-required')throw Error('Baseline-ready requires the pending-baseline fixture.');
 const uid=m.accounts.athlete.uid,org=m.namespace+'-org',team=m.namespace+'-team-a';
 const profile=(await db.doc('users/'+uid).get()).data();if(profile?.testLabRun!==m.namespace)throw Error('School fixture profile ownership mismatch.');
 const user=await auth.getUser(uid);if(user.email!==m.accounts.athlete.email&&!(m.phoneLab?.phoneOnly&&!user.email))throw Error('School fixture account ownership mismatch.');
 await db.doc('users/'+uid).update({pulseCheckOnboardingComplete:false,registrationComplete:false,sport:admin.firestore.FieldValue.delete()});
 await db.doc('pulsecheck-organizations/'+org).update({productBrand:'athleticmind'});
 const questions=Array.from({length:8},(_,i)=>({id:'legacy-optional-'+(i+1),type:'text',question:'Optional legacy school question '+(i+1),required:false}));
 await db.doc('pulsecheck-teams/'+team).update({'intake.athlete':{version:'synthetic-school-intake-v1',questions}});
 const ref=db.doc('pulsecheck-team-memberships/'+team+'_'+uid),member=(await ref.get()).data();
 if(member){
  if(member.userId!==uid||member.organizationId!==org||member.teamId!==team)throw Error('School membership ownership mismatch.');
  await ref.update({'athleteOnboarding.intakeResponses':{'legacy-optional-1':'Preserve this saved synthetic answer'},'athleteOnboarding.intakeFormVersion':'synthetic-old-intake-v1',...(mode==='baseline-ready'?{'athleteOnboarding.flowVersion':'school-activation-v1','athleteOnboarding.baselinePathStatus':'pending'}:{'athleteOnboarding.entryOnboardingName':''})});
 }
 m.schoolLab={mode,optionalQuestionCount:8,preservedAnswer:'Preserve this saved synthetic answer'};fs.writeFileSync(path,JSON.stringify(m,null,2),{mode:0o600});
 console.log(JSON.stringify({status:'prepared',namespace:m.namespace,mode}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
