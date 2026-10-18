const {test,before,after,beforeEach}=require('node:test');
const fs=require('node:fs'),path=require('node:path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,updateDoc,getDoc,getDocs,query,collection,where,serverTimestamp,deleteDoc,setLogLevel}=require('firebase/firestore');
setLogLevel('silent');let env;
const rulesPath=process.env.CONSENT_RULES_FILE||path.resolve('firestore.rules');
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-consent-remediation',firestore:{host:'127.0.0.1',port:8197,rules:fs.readFileSync(rulesPath,'utf8')}})});
after(async()=>{await env?.cleanup()});
const auth=u=>env.authenticatedContext(u,{email:u+'@example.test'}).firestore();
const member=(db,id)=>doc(db,'pulsecheck-team-memberships',id);
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await Promise.all([
 setDoc(doc(db,'admin','platform@example.test'),{role:'admin'}),
 ...['a','b'].map(id=>setDoc(doc(db,'pulsecheck-organizations',id),{status:'active'})),
 ...['a','b'].map(id=>setDoc(doc(db,'pulsecheck-teams',id),{status:'active',organizationId:id})),
 ...[
 ['a_athlete','athlete','a','athlete',{}],['a_peer','peer','a','athlete',{}],['b_other','other','b','athlete',{}],
 ['a_coach','coach','a','coach',{staffCapabilities:['coaching'],rosterVisibilityScope:'team'}],
 ['a_assigned','assigned','a','coach',{staffCapabilities:['coaching'],rosterVisibilityScope:'assigned',allowedAthleteIds:['athlete']}],
 ['a_revoked','revoked','a','coach',{revokedAt:1,staffCapabilities:['coaching']}],
 ['a_empty','empty','a','coach',{staffCapabilities:[]}],
 ['a_manager','manager','a','team-admin',{staffCapabilities:['admin']}],
 ['b_coachb','coachb','b','coach',{staffCapabilities:['coaching']}]
 ].map(([id,userId,teamId,role,extra])=>setDoc(member(db,id),{userId,teamId,organizationId:teamId,role,status:'active',athleteOnboarding:{consentDecisions:{participation:{decision:'accepted',signedName:'Synthetic Signer'}}},...extra}))
]);});});
test('owner discovers all own memberships and reads own consent summary',async()=>{const db=auth('athlete');await assertSucceeds(getDocs(query(collection(db,'pulsecheck-team-memberships'),where('userId','==','athlete'))));await assertSucceeds(getDoc(member(db,'a_athlete')))});
test('unrelated and peer athletes cannot read consent summaries or query team roster',async()=>{for(const u of ['stranger','peer']){const db=auth(u);await assertFails(getDoc(member(db,'a_athlete')));await assertFails(getDocs(query(collection(db,'pulsecheck-team-memberships'),where('teamId','==','a'))));}});
test('team staff retains own team discovery but cannot read another team',async()=>{const db=auth('coach');await assertSucceeds(getDocs(query(collection(db,'pulsecheck-team-memberships'),where('teamId','==','a'))));await assertFails(getDoc(member(db,'b_other')))});
test('assigned staff reads only assigned athlete and own record',async()=>{const db=auth('assigned');await assertSucceeds(getDoc(member(db,'a_athlete')));await assertSucceeds(getDoc(member(db,'a_assigned')));await assertSucceeds(getDocs(query(collection(db,'pulsecheck-team-memberships'),where('teamId','==','a'),where('userId','in',['athlete']))));await assertFails(getDoc(member(db,'a_peer')));await assertFails(getDocs(query(collection(db,'pulsecheck-team-memberships'),where('teamId','==','a'))));});
test('revoked and empty-capability staff cannot read athlete summaries',async()=>{for(const u of ['revoked','empty'])await assertFails(getDoc(member(auth(u),'a_athlete')))});
test('archived team and inactive organization deny staff reads',async()=>{await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'pulsecheck-teams','a'),{archivedAt:1}));await assertFails(getDoc(member(auth('coach'),'a_athlete')));await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore(),'pulsecheck-teams','a'),{archivedAt:null});await updateDoc(doc(c.firestore(),'pulsecheck-organizations','a'),{status:'inactive'})});await assertFails(getDoc(member(auth('coach'),'a_athlete')));await assertSucceeds(getDoc(member(auth('athlete'),'a_athlete')))});
test('staff organization mismatch denies access',async()=>{await env.withSecurityRulesDisabled(c=>updateDoc(member(c.firestore(),'a_coach'),{organizationId:'b'}));await assertFails(getDoc(member(auth('coach'),'a_athlete')))});
test('platform admin retains scoped provisioning inventory',async()=>{await assertSucceeds(getDocs(collection(auth('platform'),'pulsecheck-team-memberships')))});
test('self cannot create a staff membership or promote existing membership',async()=>{const db=auth('athlete');await assertFails(setDoc(member(db,'b_athlete'),{userId:'athlete',teamId:'b',organizationId:'b',role:'team-admin',status:'active'}));await assertFails(updateDoc(member(db,'a_athlete'),{role:'coach',staffCapabilities:['coaching']}));await assertFails(updateDoc(member(db,'a_athlete'),{userId:'peer'}));});
test('owner can save consent summary, reread it, and keep optional refusal',async()=>{const db=auth('athlete');await assertSucceeds(updateDoc(member(db,'a_athlete'),{athleteOnboarding:{consentDecisions:{health:{decision:'declined',version:'v1-pulsecheck'}}},onboardingStatus:'complete',updatedAt:serverTimestamp()}));const reread=await assertSucceeds(getDoc(member(auth('athlete'),'a_athlete')));require('node:assert/strict').equal(reread.data().athleteOnboarding.consentDecisions.health.decision,'declined')});
test('consent evidence remains signer-owned append-only',async()=>{const db=auth('athlete');const p='pulsecheck-team-memberships/a_athlete/consent-events/fixture';await assertSucceeds(setDoc(doc(db,p),{actorUserId:'athlete',decisions:{health:{decision:'declined'}},recordedAt:serverTimestamp()}));await assertSucceeds(getDoc(doc(db,p)));await assertFails(updateDoc(doc(db,p),{decisions:{}}));await assertFails(deleteDoc(doc(db,p)));await assertFails(getDoc(doc(auth('coach'),p)));await assertFails(setDoc(doc(auth('coach'),p+'2'),{actorUserId:'athlete',decisions:{},recordedAt:serverTimestamp()}));});
test('active team manager provisions membership, revoked manager cannot',async()=>{const payload={userId:'new-athlete',teamId:'a',organizationId:'a',role:'athlete',status:'active'};await assertSucceeds(setDoc(member(auth('manager'),'a_new-athlete'),payload));await env.withSecurityRulesDisabled(c=>updateDoc(member(c.firestore(),'a_manager'),{revokedAt:1}));await assertFails(setDoc(member(auth('manager'),'a_newer'),{...payload,userId:'newer'}))});

test('staff owner can finish profile setup without changing access grants',async()=>{const db=auth('coach');await assertSucceeds(updateDoc(member(db,'a_coach'),{title:'Coach',notificationPreferences:{email:true},onboardingStatus:'complete',updatedAt:serverTimestamp()}));await assertFails(updateDoc(member(db,'a_coach'),{title:'Coach',staffCapabilities:['admin']}))});

test('migrated consent cannot be rewritten or downgraded by a legacy client; baseline remains writable',async()=>{
 await env.withSecurityRulesDisabled(c=>updateDoc(member(c.firestore(),'a_athlete'),{'athleteOnboarding.consentPersistenceVersion':2,'athleteOnboarding.targetPilotId':'p'}));
 const db=auth('athlete');
 await assertFails(updateDoc(member(db,'a_athlete'),{'athleteOnboarding.consentDecisions':{}}));
 await assertFails(updateDoc(member(db,'a_athlete'),{'athleteOnboarding.consentPersistenceVersion':0}));
 await assertFails(updateDoc(member(db,'a_athlete'),{'athleteOnboarding.targetPilotId':'foreign'}));
 await assertSucceeds(updateDoc(member(db,'a_athlete'),{'athleteOnboarding.baselinePathStatus':'complete'}));
});
test('closure tombstone stops stale token membership and generic writes',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'account-closure-jobs','athlete'),{status:'queued'}));
 await assertFails(getDoc(member(auth('athlete'),'a_athlete')));
 await assertFails(updateDoc(member(auth('athlete'),'a_athlete'),{phone:'+12025550123'}));
 await assertFails(setDoc(doc(auth('athlete'),'arbitrary-legacy-data','fixture'),{userId:'athlete'}));
});
test('private outbox and closure and privacy markers cannot fall through generic access',async()=>{
 for(const collectionName of ['account-closure-jobs','pulsecheck-invite-accepted-outbox','pulsecheck-private-users']){
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),collectionName,'athlete'),{userId:'athlete'}));
  await assertFails(getDoc(doc(auth('stranger'),collectionName,'athlete')));
  await assertFails(setDoc(doc(auth('stranger'),collectionName,'forged'),{userId:'stranger'}));
 }
});
test('protected root profile is owner/admin only; unrelated public profile behavior stays unchanged',async()=>{
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,'users','athlete'),{displayName:'Synthetic',fcmToken:'private-fixture'});await setDoc(doc(db,'pulsecheck-private-users','athlete'),{userId:'athlete'});await setDoc(doc(db,'users','public-fixture'),{displayName:'Public Fixture'});});
 await assertSucceeds(getDoc(doc(auth('athlete'),'users','athlete')));
 await assertSucceeds(getDoc(doc(auth('platform'),'users','athlete')));
 await assertFails(getDoc(doc(auth('peer'),'users','athlete')));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'users','athlete')));
 await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'users','public-fixture')));
});
test('raw clinical records deny clients; athlete acknowledgement is append-only and own safety state readable',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'pulsecheck-clinical-escalations','incident'),{athleteUserId:'athlete',teamId:'a',tier:3});await setDoc(doc(c.firestore(),'pulsecheck-athlete-safety-state','athlete'),{active:true});});
 for(const user of ['athlete','coach','platform','stranger']) await assertFails(getDoc(doc(auth(user),'pulsecheck-clinical-escalations','incident')));
 const ack=doc(auth('athlete'),'pulsecheck-clinical-escalations/incident/athleteAcknowledgements/fixture');
 await assertSucceeds(setDoc(ack,{athleteUserId:'athlete',acknowledgedAt:serverTimestamp()}));await assertFails(updateDoc(ack,{athleteUserId:'other'}));
 await assertFails(setDoc(doc(auth('peer'),'pulsecheck-clinical-escalations/incident/athleteAcknowledgements/foreign'),{athleteUserId:'peer',acknowledgedAt:serverTimestamp()}));
 await assertSucceeds(getDoc(doc(auth('athlete'),'pulsecheck-athlete-safety-state','athlete')));await assertFails(getDoc(doc(auth('coach'),'pulsecheck-athlete-safety-state','athlete')));
});
test('canonical push token account switch blocks old owner read/delete and other users listing',async()=>{
 const id='synthetic-installation-123456';const claim=user=>({ownerUserId:user,installationId:id,token:'synthetic-token-'+user,sourceApp:'pulsecheck',platform:'android',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 await assertSucceeds(setDoc(doc(auth('athlete'),'pulsecheck-push-installations',id),claim('athlete')));
 await assertSucceeds(setDoc(doc(auth('peer'),'pulsecheck-push-installations',id),claim('peer')));
 await assertFails(deleteDoc(doc(auth('athlete'),'pulsecheck-push-installations',id)));
 await assertFails(getDoc(doc(auth('athlete'),'pulsecheck-push-installations',id)));
 await assertSucceeds(getDoc(doc(auth('peer'),'pulsecheck-push-installations',id)));
 await assertFails(getDocs(collection(auth('stranger'),'pulsecheck-push-installations')));
 await assertFails(setDoc(doc(auth('stranger'),'users/athlete/pulsecheckPushTokens/'+id),claim('athlete')));
});
test('pilot consent summaries deny peers and migrated records deny direct overwrite',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'pulsecheck-pilot-enrollments','p_athlete'),{userId:'athlete',teamId:'a',organizationId:'a',pilotId:'p',cohortId:'',teamMembershipId:'a_athlete',status:'active',consentPersistenceVersion:2}));
 await assertSucceeds(getDoc(doc(auth('athlete'),'pulsecheck-pilot-enrollments','p_athlete')));
 await assertFails(getDoc(doc(auth('peer'),'pulsecheck-pilot-enrollments','p_athlete')));
 await assertFails(updateDoc(doc(auth('athlete'),'pulsecheck-pilot-enrollments','p_athlete'),{consentDecisions:{}}));
});

test('sparse legacy profile permits own preferences but blocks peers and protected fields',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'users','athlete'),{displayName:'Synthetic'});await setDoc(doc(c.firestore(),'pulsecheck-private-users','athlete'),{userId:'athlete'});});
 await assertSucceeds(updateDoc(doc(auth('athlete'),'users','athlete'),{preferredName:'Fixture',dailyReflectionPreferences:{enabled:false},pulseCheckPushTokenModelVersion:2}));
 await assertFails(updateDoc(doc(auth('peer'),'users','athlete'),{preferredName:'Forged'}));
 for(const patch of [{pulseCheckOnboardingComplete:true},{creator:true},{lifetimePulsePoints:100},{crisisWallActive:false},{email:'forged@example.test'}]) await assertFails(updateDoc(doc(auth('athlete'),'users','athlete'),patch));
});
