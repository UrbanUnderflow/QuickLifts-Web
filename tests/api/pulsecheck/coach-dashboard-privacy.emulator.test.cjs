const {test,before,after}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc}=require('firebase/firestore');
let env;
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-coach-dashboard-privacy',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  await Promise.all([
   setDoc(doc(db,'pulsecheck-teams/t'),{status:'active',organizationId:'o'}),
   setDoc(doc(db,'pulsecheck-organizations/o'),{status:'active'}),
   ...['coach','trainer','admin'].map(id=>setDoc(doc(db,`pulsecheck-team-memberships/t_${id}`),{userId:id,teamId:'t',organizationId:'o',status:'active',role:'coach',staffCapabilities:[id==='trainer'?'athletic_trainer':id==='admin'?'admin':'coaching']})),
   setDoc(doc(db,'pulsecheck-team-memberships/t_a'),{userId:'a',teamId:'t',organizationId:'o',status:'active',role:'athlete'}),
   ...['pulsecheck-morning-checkins','dailySentimentAnalysis','health-context-source-records','health-context-snapshots'].map(name=>setDoc(doc(db,`${name}/record`),{athleteUserId:'a',userId:'a',teamId:'t',organizationId:'o',privateText:'not for staff'})),
   setDoc(doc(db,'mental-check-ins/a/check-ins/record'),{notes:'private'}),
   setDoc(doc(db,'pulsecheck-trainer-sharing/t_a'),{athleteId:'a',teamId:'t',choices:{mood:true}}),
  ]);
 });
});
after(async()=>env?.cleanup());
test('coach, team admin, and trainer cannot bypass aggregates by reading raw documents',async()=>{
 for(const uid of ['coach','trainer','admin'])for(const path of ['pulsecheck-morning-checkins/record','dailySentimentAnalysis/record','health-context-source-records/record','health-context-snapshots/record','mental-check-ins/a/check-ins/record'])await assertFails(getDoc(doc(env.authenticatedContext(uid,{email:`${uid}@example.test`}).firestore(),path)));
});
test('athlete still reads own records; grant cannot be forged by any browser role',async()=>{
 for(const path of ['pulsecheck-morning-checkins/record','dailySentimentAnalysis/record','health-context-source-records/record','health-context-snapshots/record','mental-check-ins/a/check-ins/record'])await assertSucceeds(getDoc(doc(env.authenticatedContext('a',{email:'a@example.test'}).firestore(),path)));
 for(const uid of ['a','coach','trainer','admin'])await assertFails(setDoc(doc(env.authenticatedContext(uid,{email:`${uid}@example.test`}).firestore(),'pulsecheck-trainer-sharing/t_a'),{choices:{mood:true}}));
});

test('athletes and coaches cannot grant themselves trainer capabilities',async()=>{
 for(const uid of ['a','coach','trainer']) await assertFails(updateDoc(doc(env.authenticatedContext(uid,{email:`${uid}@example.test`}).firestore(),`pulsecheck-team-memberships/t_${uid}`),{staffCapabilities:['admin','athletic_trainer']}));
});

test('team admin may explicitly assign trainer permission through membership management',async()=>{
 await assertSucceeds(updateDoc(doc(env.authenticatedContext('admin',{email:'admin@example.test'}).firestore(),'pulsecheck-team-memberships/t_coach'),{staffCapabilities:['coaching','athletic_trainer']}));
});
