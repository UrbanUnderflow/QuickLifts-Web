const {test}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,setLogLevel}=require('firebase/firestore');
setLogLevel('silent');
for(const [index,file] of ['firestore.rules','docs/deliverables/cohort-readiness-2026-10-18/remediation/launch-production.rules'].entries()) test(`escalation private scope ${file}`,async()=>{
 const env=await initializeTestEnvironment({projectId:`demo-escalation-scope-${index}`,firestore:{host:'127.0.0.1',port:8188,rules:fs.readFileSync(file,'utf8')}});
 try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'pulsecheck-organizations','org'),{status:'active',productBrand:'pulsecheck'});
  await setDoc(doc(db,'pulsecheck-organizations','am'),{status:'active',productBrand:'athleticmind'});
  for(const org of ['org','am'])await setDoc(doc(db,'pulsecheck-teams',org),{status:'active',organizationId:org});
  for(const [uid,extra] of [['athlete',{role:'athlete'}],['coach',{role:'coach'}],['empty',{role:'coach',staffCapabilities:[]}],['restricted',{role:'team-admin',staffCapabilities:['administrative']}],['care',{role:'coach',staffCapabilities:['coaching']}],['revoked',{role:'coach',revokedAt:1}],['assigned',{role:'coach',rosterVisibilityScope:'assigned',allowedAthleteIds:[]}],['wrong',{role:'coach',organizationId:'other'}]])await setDoc(doc(db,'pulsecheck-team-memberships',`org_${uid}`),{status:'active',userId:uid,teamId:'org',organizationId:'org',...extra});
  for(const [id,extra] of [['ordinary',{}],['tier3',{tier:3}],['string3',{tier:'3'}],['critical',{classificationFamily:'critical_safety'}],['frozen',{productBrand:'athleticmind'}],['am',{teamId:'am',organizationId:'am'}],['mismatch',{organizationId:'am'}]])await setDoc(doc(db,'escalation-records',id),{userId:'athlete',teamId:'org',organizationId:'org',tier:2,...extra});
 });
 const owner=env.authenticatedContext('athlete').firestore(),coach=env.authenticatedContext('coach').firestore();
 for(const id of ['ordinary','tier3','string3','critical','frozen','am','mismatch']){
  await assertSucceeds(getDoc(doc(owner,'escalation-records',id)));
  if(id==='ordinary')await assertSucceeds(getDoc(doc(coach,'escalation-records',id)));else await assertFails(getDoc(doc(coach,'escalation-records',id)));
 }
 for(const uid of ['revoked','assigned','wrong','stranger','empty','restricted'])await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(),'escalation-records','ordinary')));
 await assertSucceeds(getDoc(doc(env.authenticatedContext('care').firestore(),'escalation-records','ordinary')));
 await assertFails(updateDoc(doc(owner,'escalation-records','ordinary'),{tier:3}));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'escalation-records','ordinary')));
 }finally{await env.cleanup();}
});
