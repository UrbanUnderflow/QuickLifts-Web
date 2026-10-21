const {test,before,after}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,deleteDoc,serverTimestamp,setLogLevel}=require('firebase/firestore');
setLogLevel('silent');let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-athleticmind-brands',firestore:{host:'127.0.0.1',port:8198,rules:fs.readFileSync('firestore.rules','utf8')}})});
after(async()=>{await env?.cleanup()});
const auth=u=>env.authenticatedContext(u,{email:u+'@example.test'}).firestore();
test('both app brands register owned installations; unknown brands and forged owners fail',async()=>{
 for(const brand of ['pulsecheck','athleticmind']) {
  const id='synthetic-installation-'+brand;
  const claim=user=>({ownerUserId:user,installationId:id,token:'synthetic-token',sourceApp:brand,platform:'ios',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await assertSucceeds(setDoc(doc(auth('first'),'pulsecheck-push-installations',id),claim('first')));
  await assertFails(setDoc(doc(auth('second'),'pulsecheck-push-installations',id),claim('first')));
  await assertSucceeds(setDoc(doc(auth('second'),'pulsecheck-push-installations',id),claim('second')));
  await assertFails(getDoc(doc(auth('first'),'pulsecheck-push-installations',id)));
  await assertFails(deleteDoc(doc(auth('first'),'pulsecheck-push-installations',id)));
  await assertSucceeds(getDoc(doc(auth('second'),'pulsecheck-push-installations',id)));
  await assertFails(setDoc(doc(auth('second'),'pulsecheck-push-installations',id),{...claim('second'),sourceApp:'other'}));
 }
});
test('brand release feeds are public read and cannot be published by ordinary users',async()=>{
 for(const collection of ['pulsecheck-version','pulsecheck-versions','athleticmind-version','athleticmind-versions']) {
  const ref=doc(auth('first'),collection,'ios');
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),collection,'ios')));
  await assertFails(setDoc(ref,{version:'9.0',userId:'first'}));
 }
});
