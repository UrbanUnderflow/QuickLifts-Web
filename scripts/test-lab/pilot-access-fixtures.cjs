#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const{build}=require('esbuild');const{client,assertManifest}=require('./emulator-fixtures.cjs');
(async()=>{
 const file=process.argv[2],m=assertManifest(JSON.parse(fs.readFileSync(file,'utf8'))),{db,admin}=await client();
 if(m.scenario!=='baseline-required'||m.schoolLab?.mode!=='baseline-ready')throw Error('A private pending-baseline school fixture is required.');
 const uid=m.accounts.athlete.uid,org=m.namespace+'-org',team=m.namespace+'-team-a',mid=team+'_'+uid,pilot=m.namespace+'-pilot';
 const ref=db.doc('users/'+uid),user=(await ref.get()).data();if(user?.testLabRun!==m.namespace)throw Error('Synthetic profile ownership required.');
 const output=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'pilot-access-fixture-')),'consents.cjs');await build({stdin:{contents:"export{resolveAtomicConsentDocuments}from'./src/lib/server/pulsecheck/atomicConsent';",resolveDir:path.resolve(__dirname,'../..'),loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:output});const{resolveAtomicConsentDocuments}=require(output);
 const inactive={commercialModel:'team-plan',teamPlanStatus:'inactive',teamPlanBypassesPaywall:false,youthTrack:'pro',experienceAudience:'athletes'};
 await ref.update({subscriptionType:'none',subscriptionPlatform:admin.firestore.FieldValue.delete(),pulseCheckTeamId:team,pulseCheckTeamCommercialAccess:inactive});
 await db.doc('pulsecheck-teams/'+team).update({commercialConfig:inactive,commercialAccess:inactive});
 const p={status:'active',organizationId:org,teamId:team,studyMode:'pilot',startAt:'2099-01-01',endAt:'2099-12-31',testLabRun:m.namespace};
 await db.doc('pulsecheck-pilots/'+pilot).set(p);
 const t=(await db.doc('pulsecheck-teams/'+team).get()).data(),o=(await db.doc('pulsecheck-organizations/'+org).get()).data(),docs=resolveAtomicConsentDocuments(t,p,'athleticmind',o);
 const decisions=Object.fromEntries(docs.map(d=>[d.id,{decision:d.category==='health_authorization'?'declined':'accepted',signedName:'Synthetic Athlete',version:d.version,document:d}]));
 await db.doc('pulsecheck-team-memberships/'+mid).update({commercialAccess:inactive,'athleteOnboarding.targetPilotId':pilot,'athleteOnboarding.targetCohortId':'','athleteOnboarding.requiredConsents':docs,'athleteOnboarding.consentDecisions':decisions,'athleteOnboarding.completedConsentIds':docs.filter(d=>decisions[d.id].decision==='accepted').map(d=>d.id),'athleteOnboarding.completedConsentVersions':Object.fromEntries(docs.filter(d=>decisions[d.id].decision==='accepted').map(d=>[d.id,d.version]))});
 const enrollment='pulsecheck-pilot-enrollments/'+pilot+'_'+uid;await db.doc(enrollment).set({status:'active',userId:uid,organizationId:org,teamId:team,pilotId:pilot,teamMembershipId:mid,enrollmentMode:'pilot',testLabRun:m.namespace});
 m.documentPaths.push('pulsecheck-pilots/'+pilot,enrollment);m.pilotAccessLab={noIndividualSubscription:true,paidTeamPlanStatus:'inactive',pilotId:pilot};fs.writeFileSync(file,JSON.stringify(m,null,2),{mode:0o600});console.log(JSON.stringify({prepared:true,namespace:m.namespace,consents:docs.length}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
