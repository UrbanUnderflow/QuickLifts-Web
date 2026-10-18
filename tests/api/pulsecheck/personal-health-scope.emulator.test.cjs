const {test}=require('node:test'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,setLogLevel}=require('firebase/firestore');setLogLevel('silent');
for(const [index,file]of ['firestore.rules','docs/deliverables/cohort-readiness-2026-10-18/remediation/launch-production.rules'].entries())test(`personal health privacy ${file}`,async()=>{
 const env=await initializeTestEnvironment({projectId:`demo-health-scope-${index}`,firestore:{host:'127.0.0.1',port:8188,rules:fs.readFileSync(file,'utf8')}});
 const paths=['mental-check-ins/owner/check-ins/day','pulsecheck-morning-checkins/owner_day','dailySentimentAnalysis/owner_day',...['source-records','source-status','snapshots','snapshot-revisions','assembly-traces'].map(s=>`health-context-${s}/owner_day`)];
 try{
 await env.withSecurityRulesDisabled(async c=>{for(const p of paths)await setDoc(doc(c.firestore(),p),{id:'owner_day',athleteUserId:'owner',userId:'owner',sourceFamily:'day',sourceType:'device',payload:'synthetic-private'});});
 const owner=env.authenticatedContext('owner').firestore(),other=env.authenticatedContext('other').firestore();
 for(const p of paths){await assertSucceeds(getDoc(doc(owner,p)));await assertFails(getDoc(doc(other,p)));await assertFails(updateDoc(doc(other,p),{payload:'forged'}));}
 await assertSucceeds(updateDoc(doc(owner,'pulsecheck-morning-checkins/owner_day'),{energyReset:{completed:true}}));
 await assertFails(updateDoc(doc(owner,'pulsecheck-morning-checkins/owner_day'),{payload:'forged'}));
 await assertFails(updateDoc(doc(owner,'dailySentimentAnalysis/owner_day'),{payload:'forged'}));
 await assertSucceeds(setDoc(doc(owner,'health-context-source-records/owner_new'),{id:'owner_new',athleteUserId:'owner',sourceFamily:'device',sourceType:'sleep'}));
 await assertFails(setDoc(doc(other,'health-context-source-records/other_new'),{id:'other_new',athleteUserId:'owner',sourceFamily:'device',sourceType:'sleep'}));
 await assertFails(updateDoc(doc(owner,'health-context-source-records/owner_day'),{athleteUserId:'other'}));
 await assertSucceeds(setDoc(doc(owner,'mental-check-ins/owner/check-ins/new'),{mood:'synthetic'}));
 }finally{await env.cleanup();}
});
