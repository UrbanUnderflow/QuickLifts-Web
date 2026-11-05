#!/usr/bin/env node
'use strict';
// Links a reserved fictional phone only to an existing isolated emulator identity.
const fs=require('node:fs');
const {client,assertManifest}=require('./emulator-fixtures.cjs');
(async()=>{
 const path=process.argv[2];if(!path)throw Error('Isolated fixture manifest required.');
 const m=assertManifest(JSON.parse(fs.readFileSync(path,'utf8')));
 if(!['existing-member','no-membership'].includes(m.scenario))throw Error('Phone confirmation needs an existing-member or no-membership fixture.');
 const {auth,db}=await client();const phoneNumber=m.scenario==='existing-member'?'+12025550197':'+12025550196';
 const user=await auth.getUser(m.accounts.athlete.uid);
 const profile=(await db.doc('users/'+user.uid).get()).data();
 const ownedEmail=user.email===m.accounts.athlete.email&&user.email.endsWith('@example.test');
 const ownedPhoneOnly=m.phoneLab?.phoneOnly===true&&!user.email&&profile?.email===m.accounts.athlete.email&&user.uid===m.namespace+'-athlete';
 if(!ownedEmail&&!ownedPhoneOnly)throw Error('Synthetic account ownership mismatch.');
 if(process.argv[3]==='release'){
  if(user.phoneNumber&&user.phoneNumber!==phoneNumber)throw Error('Synthetic phone release ownership mismatch.');
  if(user.phoneNumber)await auth.updateUser(user.uid,{phoneNumber:null});
  console.log(JSON.stringify({status:'released',projectId:m.projectId,namespace:m.namespace,scenario:m.scenario}));return;
 }
 let owner=null;try{owner=await auth.getUserByPhoneNumber(phoneNumber);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
 if(owner&&owner.uid!==user.uid)throw Error('Reserved synthetic phone belongs to another fixture. Clean up that owned fixture first.');
 const phoneOnly=process.argv[3]==='phone-only';
 if(phoneOnly){
  // The isolated fixture owns this exact UID and profile. Recreate only its
  // emulator Auth record to represent a real phone-only account without email.
  await auth.deleteUser(user.uid);
  await auth.createUser({uid:user.uid,phoneNumber,displayName:user.displayName||'Synthetic Athlete'});
 }else await auth.updateUser(user.uid,{phoneNumber});
 m.phoneLab={phoneNumber,uid:user.uid,scenario:m.scenario,phoneOnly};fs.writeFileSync(path,JSON.stringify(m,null,2),{mode:0o600});
 console.log(JSON.stringify({status:'prepared',projectId:m.projectId,namespace:m.namespace,scenario:m.scenario}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
