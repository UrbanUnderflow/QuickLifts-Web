const {test,before,after}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-nora-storage',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});await env.withSecurityRulesDisabled(async c=>{for(const p of ['conversations/example','conversationSummaries/example','user-mental-notes/athlete/notes/example']) await setDoc(doc(c.firestore(),p),{userId:'athlete',content:'synthetic'});});});
after(async()=>env?.cleanup());
test('owner reads pass and other-account reads fail',async()=>{for(const p of ['conversations/example','conversationSummaries/example','user-mental-notes/athlete/notes/example']){await assertSucceeds(getDoc(doc(env.authenticatedContext('athlete').firestore(),p)));await assertFails(getDoc(doc(env.authenticatedContext('other').firestore(),p)));}});
test('authenticated clients cannot bypass protected persistence',async()=>{for(const p of ['conversations/example','conversationSummaries/example','user-mental-notes/athlete/notes/example'])await assertFails(setDoc(doc(env.authenticatedContext('athlete').firestore(),p),{userId:'athlete',content:'synthetic restricted fixture'}));});
