#!/usr/bin/env node
'use strict';
// Extends an existing isolated fixture; never accepts a real project or user.
const fs=require('fs'),crypto=require('crypto');
const {client,assertManifest}=require('./emulator-fixtures.cjs');
(async()=>{
 const path=process.argv[2];if(!path)throw Error('Fixture manifest required');
 const m=assertManifest(JSON.parse(fs.readFileSync(path,'utf8'))),{db,auth}=await client();
 const ns=m.namespace,organizationId=ns+'-org',teamId=ns+'-team-a';
 if(process.argv[3]==='cleanup') {
  const lab=m.onboardingLab;if(!lab){console.log(JSON.stringify({status:'cleaned',namespace:ns,dynamicAccounts:0}));return;}
  if(m.scenario==='no-membership'){
   const originalUid=m.accounts.athlete.uid;
   for(const row of (await db.collection('pulsecheck-team-memberships').where('userId','==',originalUid).get()).docs){
    const value=row.data();if(value.userId!==originalUid||value.teamId!==teamId||value.organizationId!==organizationId)throw Error('Original invited membership cleanup ownership mismatch.');
    for(const event of (await row.ref.collection('consent-events').get()).docs){if(event.data().actorUserId!==originalUid)throw Error('Original invite consent actor mismatch.');await erase(event.ref);}
    await erase(row.ref);
   }
  }
  const reservationRef=db.collection('test-lab-signup-reservations').doc(lab.reservationId),reservation=(await reservationRef.get()).data();
  if(!reservation){console.log(JSON.stringify({status:'cleaned',namespace:ns,dynamicAccounts:0}));return;}
  if(reservation.testLabRun!==ns||reservation.namespace!==ns||reservation.email!==lab.signupEmail||!lab.signupEmail.endsWith('@example.test'))throw Error('Signup reservation cleanup ownership mismatch.');
  async function erase(ref){try{await ref.delete();}catch(e){if((await ref.get()).exists)throw e;}}
  const uid=reservation.observedUid;
  if(uid){
   const account=await auth.getUser(uid).catch(e=>{if(e.code==='auth/user-not-found')return null;throw e;});
   if(account&&account.email!==reservation.email)throw Error('Signup Auth ownership mismatch.');
   for(const row of (await db.collection('pulsecheck-team-memberships').where('userId','==',uid).get()).docs){
    const value=row.data();if(value.userId!==uid||!String(value.teamId||'').startsWith(ns+'-')||!String(value.organizationId||'').startsWith(ns+'-'))throw Error('Signup membership ownership mismatch.');
    for(const event of (await row.ref.collection('consent-events').get()).docs){if(event.data().actorUserId!==uid)throw Error('Signup consent actor mismatch.');await erase(event.ref);}
    await erase(row.ref);
   }
   const privateRef=db.collection('pulsecheck-private-users').doc(uid),privateData=(await privateRef.get()).data();
   if(privateData&&privateData.userId!==uid)throw Error('Signup private record ownership mismatch.');
   await erase(privateRef);
   const userRef=db.collection('users').doc(uid),user=(await userRef.get()).data();
   if(user&&user.email!==reservation.email){const invite=user.onboardInvite;if(user.email||invite?.organizationId!==organizationId||invite?.teamId!==teamId||invite?.token!==lab.token)throw Error('Signup profile ownership mismatch.');}
   await erase(userRef);
   await auth.deleteUser(uid).catch(e=>{if(e.code!=='auth/user-not-found')throw e;});
  }
  await erase(reservationRef);
  console.log(JSON.stringify({status:'cleaned',namespace:ns,dynamicAccounts:uid?1:0}));return;
 }

 const activationCode='LAB'+crypto.createHash('sha256').update(ns).digest('hex').slice(0,8).toUpperCase();
 const token=ns+'-invite',revokedToken=ns+'-revoked';
 const participation=(await db.doc('pulsecheck-teams/'+teamId).get()).data().requiredConsents[0];
 const health={id:'synthetic-health',title:'Synthetic health sharing choice',body:'Synthetic local test authorization. No real health data is shared.',version:'synthetic-v1',category:'health_authorization',required:false};
 await db.doc('pulsecheck-organizations/'+organizationId).update({healthBaselineEnabled:true});
 await db.doc('pulsecheck-teams/'+teamId).update({healthBaselineEnabled:true,requiredConsents:[participation,health]});
 const membership=db.doc('pulsecheck-team-memberships/'+teamId+'_'+m.accounts.athlete.uid);
 if((await membership.get()).exists)await membership.update({phone:'','athleteOnboarding.baselinePathStatus':'pending','athleteOnboarding.requiredConsents':[participation,health]});
 const invitation={inviteType:'team-access',teamMembershipRole:'athlete',organizationId,teamId,status:'active',redemptionMode:'general',activationCode,maxUses:0,redemptionCount:0,targetEmail:'',notifyCoachOnAccept:false,createdAt:new Date(),testLabRun:ns};
 for(const [id,value] of [[token,invitation],[revokedToken,{...invitation,status:'revoked',activationCode:activationCode+'R'}]]) {
  const p='pulsecheck-invite-links/'+id;await db.doc(p).set(value);if(!m.documentPaths.includes(p))m.documentPaths.push(p);
 }
 const email=`qa-new-${ns}@example.test`,reservationId=ns+'-'+crypto.createHash('sha256').update(email).digest('hex');
 await db.collection('test-lab-signup-reservations').doc(reservationId).set({namespace:ns,email,status:'reserved',createdAt:new Date(),testLabRun:ns});
 if(!m.documentPaths.includes('test-lab-signup-reservations/'+reservationId))m.documentPaths.push('test-lab-signup-reservations/'+reservationId);
 m.onboardingLab={activationCode,token,revokedCode:activationCode+'R',signupEmail:email,reservationId};
 fs.writeFileSync(path,JSON.stringify(m,null,2),{mode:0o600});
 console.log(JSON.stringify({status:'prepared',namespace:ns,activationCode}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
