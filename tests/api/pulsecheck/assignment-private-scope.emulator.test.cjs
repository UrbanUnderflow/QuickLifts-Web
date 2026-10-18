const {test}=require('node:test'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,setLogLevel}=require('firebase/firestore');setLogLevel('silent');
for(const [i,file]of ['firestore.rules','docs/deliverables/cohort-readiness-2026-10-18/remediation/launch-production.rules'].entries())test(`assignment privacy ${file}`,async()=>{
 const env=await initializeTestEnvironment({projectId:`demo-assignment-private-${i}`,firestore:{host:'127.0.0.1',port:8188,rules:fs.readFileSync(file,'utf8')}});
 const collections={'pulsecheck-daily-assignments':'athleteId','pulsecheck-training-plans':'athleteId','sim-assignments':'athleteUserId','mental-exercise-assignments':'athleteUserId'};
 try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{for(const [name,field]of Object.entries(collections))await setDoc(doc(c.firestore(),name,'owner_existing'),{[field]:'owner',status:'pending'});});
 const owner=env.authenticatedContext('owner').firestore(),peer=env.authenticatedContext('peer').firestore();
 for(const [name,field]of Object.entries(collections)){
  await assertSucceeds(getDoc(doc(owner,name,'owner_existing')));await assertFails(getDoc(doc(peer,name,'owner_existing')));await assertFails(updateDoc(doc(peer,name,'owner_existing'),{status:'started'}));await assertFails(updateDoc(doc(owner,name,'owner_existing'),{[field]:'peer'}));
  if(name!=='pulsecheck-daily-assignments'){await assertSucceeds(setDoc(doc(owner,name,'owner_new'),{[field]:'owner',status:'pending'}));await assertSucceeds(updateDoc(doc(owner,name,'owner_existing'),{status:'started'}));}
 }
 await assertSucceeds(getDoc(doc(owner,'pulsecheck-daily-assignments','owner_missing')));
 await assertSucceeds(updateDoc(doc(owner,'pulsecheck-daily-assignments','owner_existing'),{protocolPracticeSession:{status:'active'},updatedAt:1}));
 await assertFails(updateDoc(doc(owner,'pulsecheck-daily-assignments','owner_existing'),{status:'started'}));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'pulsecheck-linear-curriculum/states/items/owner'),{athleteId:'owner'}));
 await assertFails(updateDoc(doc(owner,'sim-assignments','owner_existing'),{status:'in_progress'}));
 await assertFails(updateDoc(doc(owner,'pulsecheck-daily-assignments','owner_existing'),{protocolPracticeSession:{status:'complete'}}));
 }finally{await env.cleanup();}
});
