const { test } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
test('private emergency records stay owner-only across brands; routine PulseCheck access remains', async () => {
 const env = await initializeTestEnvironment({ projectId: 'demo-pulse-private-emergency', firestore: { host:'127.0.0.1', port:8188, rules:fs.readFileSync('firestore.rules','utf8') } });
 try {
  await env.withSecurityRulesDisabled(async ctx => {
   const db=ctx.firestore(); await setDoc(doc(db,'admin','admin@synthetic.example'),{role:'admin'});
   for(const [brand,config] of [['am',{productBrand:'athleticmind'}],['pc',{productBrand:'pulsecheck'}],['unknown',{}]]) {
    await setDoc(doc(db,'pulsecheck-organizations',brand),{status:'active',...config});
    await setDoc(doc(db,'pulsecheck-teams',brand),{organizationId:brand,status:'active'});
    for(const [uid,role,capabilities] of [['athlete','athlete',[]],['coach','coach',['coaching']],['clinician','clinician',['athletic_trainer']]]) await setDoc(doc(db,'pulsecheck-team-memberships',`${brand}_${uid}`),{userId:uid,teamId:brand,organizationId:brand,status:'active',role,staffCapabilities:capabilities,rosterVisibilityScope:'team'});
    for(const tier of [2,3]) {
     const value={userId:'athlete',athleteUserId:'athlete',teamId:brand,organizationId:brand,tier,deliveryStatus:'pending',status:'active',consentStatus:'accepted',supportSelectionKind:'staff',supportSelectionUserId:'clinician',supportSelectionTeamId:brand,supportRoute:'selected_staff',triggerContent:'PRIVATE'};
     await setDoc(doc(db,'escalation-records',`${brand}-${tier}`),value);
     await setDoc(doc(db,'pulsecheck-clinical-escalations',`${brand}-${tier}`),value);
    }
   }
   await setDoc(doc(db,'pulsecheck-athlete-safety-state','athlete'),{athleteUserId:'athlete',teamId:'pc',organizationId:'pc',crisisWallActive:true});
  });
  const owner=env.authenticatedContext('athlete').firestore();
  for(const role of ['coach','clinician','admin','anonymous']) {
   const db=role==='anonymous'?env.unauthenticatedContext().firestore():env.authenticatedContext(role,role==='admin'?{email:'admin@synthetic.example'}:{}).firestore();
   for(const brand of ['am','pc','unknown']) for(const collection of ['escalation-records','pulsecheck-clinical-escalations']) {
    await assertFails(getDoc(doc(db,collection,`${brand}-3`)));
    if(brand==='am') await assertFails(getDoc(doc(db,collection,'am-2')));
   }
   await assertFails(getDoc(doc(db,'pulsecheck-athlete-safety-state','athlete')));
  }
  for(const brand of ['am','pc','unknown']) for(const collection of ['escalation-records','pulsecheck-clinical-escalations']) await assertSucceeds(getDoc(doc(owner,collection,`${brand}-3`)));
  await assertSucceeds(getDoc(doc(owner,'escalation-records','am-2')));
  await assertSucceeds(getDoc(doc(owner,'pulsecheck-clinical-escalations','am-2')));
  await assertSucceeds(getDoc(doc(owner,'pulsecheck-athlete-safety-state','athlete')));
  const clinician=env.authenticatedContext('clinician').firestore();
  await assertSucceeds(getDoc(doc(clinician,'pulsecheck-clinical-escalations','pc-2')));
  await assertSucceeds(getDoc(doc(clinician,'escalation-records','pc-2')));
  const admin=env.authenticatedContext('admin',{email:'admin@synthetic.example'}).firestore();
  await assertFails(updateDoc(doc(admin,'escalation-records','am-2'),{teamId:'pc',organizationId:'pc'}));
  await assertFails(updateDoc(doc(admin,'escalation-records','pc-3'),{tier:2}));
 } finally { await env.cleanup(); }
});
