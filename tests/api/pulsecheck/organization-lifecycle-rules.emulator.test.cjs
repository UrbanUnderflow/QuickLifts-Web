const {test,before,after,beforeEach}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-organization-lifecycle',firestore:{rules:fs.readFileSync(process.env.LIFECYCLE_RULES_FILE || 'firestore.rules','utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
 const db=c.firestore();
 for(const id of ['org','other']){
  await setDoc(doc(db,'pulsecheck-organizations',id),{status:'active',displayName:id});
  await setDoc(doc(db,'pulsecheck-teams',id),{status:'active',organizationId:id});
  await setDoc(doc(db,'pulsecheck-team-memberships',`${id}_athlete`),{status:'active',userId:'athlete',organizationId:id,teamId:id,role:'athlete'});
  await setDoc(doc(db,'pulsecheck-pilots',id),{status:'active',organizationId:id,teamId:id});
  await setDoc(doc(db,'pulsecheck-pilot-cohorts',id),{status:'active',organizationId:id,teamId:id});
 }
 await setDoc(doc(db,'admin','admin@example.test'),{role:'admin'});
});});
test('decommission blocks organization, team, pilot and cohort reads; restore reopens only that organization',async()=>{
 const db=env.authenticatedContext('athlete').firestore();
 const collections=['pulsecheck-organizations','pulsecheck-teams','pulsecheck-pilots','pulsecheck-pilot-cohorts'];
 for(const collection of collections)await assertSucceeds(getDoc(doc(db,collection,'org')));
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'pulsecheck-organizations','org'),{status:'decommissioned',lifecycleState:'deleted',deletedAt:100}));
 for(const collection of collections){await assertFails(getDoc(doc(db,collection,'org')));await assertSucceeds(getDoc(doc(db,collection,'other')));}
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'pulsecheck-organizations','org'),{status:'active'}));
 for(const collection of collections)await assertSucceeds(getDoc(doc(db,collection,'org')));
});
test('platform admin cannot bypass lifecycle endpoint or manipulate purge jobs',async()=>{
 const db=env.authenticatedContext('admin',{email:'admin@example.test'}).firestore(),ref=doc(db,'pulsecheck-organizations','org');
 await assertSucceeds(updateDoc(ref,{displayName:'Updated'}));
 await assertFails(deleteDoc(ref));
 await assertFails(updateDoc(ref,{lifecycleState:'deleted',deletedAt:1,purgeAfter:2}));
 await assertFails(setDoc(doc(db,'pulsecheck-organizations','forged'),{status:'active',lifecycleState:'deleted'}));
 await assertFails(setDoc(doc(db,'pulsecheck-organizations','org','lifecycle-jobs','purge'),{leaseUntil:0}));
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'pulsecheck-organizations','org'),{status:'decommissioned',lifecycleState:'deleted',deletedAt:100}));
 await assertFails(updateDoc(ref,{status:'active'}));
 await assertFails(updateDoc(doc(db,'pulsecheck-teams','org'),{organizationId:'other'}));
 await assertFails(deleteDoc(doc(db,'pulsecheck-teams','org')));
 await assertSucceeds(getDoc(ref));
});

test('live scoped patch preserves preactivation consent reads', {skip:!process.env.LIFECYCLE_RULES_FILE}, async()=>{
 await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore(),'pulsecheck-organizations','org'),{status:'provisioning'});await updateDoc(doc(c.firestore(),'pulsecheck-teams','org'),{status:'draft'});});
 const db=env.authenticatedContext('athlete').firestore();
 await assertSucceeds(getDoc(doc(db,'pulsecheck-organizations','org')));
 await assertSucceeds(getDoc(doc(db,'pulsecheck-teams','org')));
});
