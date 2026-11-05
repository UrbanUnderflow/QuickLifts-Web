const {test,before,after,beforeEach}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-pipelists-write-protocol',firestore:{rules:fs.readFileSync('firestore.simpbudget.rules','utf8')}})});
after(async()=>{await env?.cleanup()});
const list={id:'grants',name:'Grants',templateKey:'grant',items:[{id:'one',stage:'submitted',updatedAt:'2026-10-22'}]};
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
 const db=c.firestore();
 await setDoc(doc(db,'simpbudget-users/owner/pipeLists/state'),{lists:[list],writeProtocol:2,revision:7});
 await setDoc(doc(db,'simpbudget-users/other/pipeLists/state'),{lists:[list]});
 for(const id of ['owner-grants','owner-unrelated']){
  const retired=id==='owner-grants';
  await setDoc(doc(db,'pipeListShares',id),{ownerUid:'owner',ownerEmail:'owner@example.test',list,publicRead:false,viewerEmails:[],editorEmails:['member@example.test'],inviteStatuses:{},protectedDetails:true,...(retired?{retired:true}:{})});
  await setDoc(doc(db,'pipeListProtectedShares',id),{ownerUid:'owner',ownerEmail:'owner@example.test',listId:'grants',list,...(retired?{retired:true}:{})});
 }
 await setDoc(doc(db,'pipeLeadShares/owner-grants-one'),{ownerUid:'owner',publicRead:false,list,retired:true});
})});
const owner=()=>env.authenticatedContext('owner',{email:'owner@example.test'}).firestore();
test('legacy omission and newer-timestamp regression fail at the server',async()=>{
 const ref=doc(owner(),'simpbudget-users/owner/pipeLists/state');
 await assertFails(updateDoc(ref,{lists:[{...list,items:[]}]}));
 await assertFails(updateDoc(ref,{lists:[{...list,items:[{...list.items[0],stage:'identified',updatedAt:'2099-01-01'}]}]}));
 await assertFails(updateDoc(ref,{lists:[],revision:7}));
 await assertFails(updateDoc(ref,{lists:[],revision:6}));
});
test('current revision permits intentional downgrades and explicit tombstones, then rejects replay',async()=>{
 const ref=doc(owner(),'simpbudget-users/owner/pipeLists/state');
 await assertSucceeds(updateDoc(ref,{lists:[{...list,items:[{...list.items[0],stage:'identified'}]}],revision:8}));
 await assertFails(updateDoc(ref,{lists:[list],revision:8}));
 await assertSucceeds(updateDoc(ref,{lists:[{...list,items:[{...list.items[0],deletedAt:'2026-10-31'}]}],revision:9}));
});
test('clients cannot disable protection, reset by delete, or self-activate a protocol',async()=>{
 const ref=doc(owner(),'simpbudget-users/owner/pipeLists/state');
 await assertFails(updateDoc(ref,{writeProtocol:0,lists:[]}));
 await assertFails(deleteDoc(ref));
 await assertFails(setDoc(doc(env.authenticatedContext('new-owner').firestore(),'simpbudget-users/new-owner/pipeLists/state'),{writeProtocol:2,revision:1}));
});
test('retired source shares and lead links cannot be rewritten, reopened or deleted by old clients',async()=>{
 const db=owner();
 for(const path of ['pipeListShares/owner-grants','pipeListProtectedShares/owner-grants','pipeLeadShares/owner-grants-one']){
  await assertFails(updateDoc(doc(db,path),{list,publicRead:true,retired:false}));
  await assertFails(deleteDoc(doc(db,path)));
 }
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'pipeLeadShares/owner-grants-one')));
});
test('unrelated lists and non-PipeLists personal data retain existing access',async()=>{
 const db=owner();
 await assertSucceeds(updateDoc(doc(db,'pipeListShares/owner-unrelated'),{publicRead:false}));
 await assertSucceeds(setDoc(doc(db,'simpbudget-users/owner/budgets/sample'),{amount:3}));
 const other=env.authenticatedContext('other').firestore();
 await assertSucceeds(updateDoc(doc(other,'simpbudget-users/other/pipeLists/state'),{lists:[]}));
 await assertFails(getDoc(doc(db,'simpbudget-users/other/pipeLists/state')));
});
test('enabled public and protected shares require revisions while keeping member permissions',async()=>{
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  await updateDoc(doc(db,'pipeListShares/owner-unrelated'),{writeProtocol:2,revision:3});
  await updateDoc(doc(db,'pipeListProtectedShares/owner-unrelated'),{writeProtocol:2,revision:3});
 });
 const db=owner(); const ref=doc(db,'pipeListShares/owner-unrelated');
 const revised={...list,items:[{...list.items[0],stage:'identified'}]};
 await assertFails(updateDoc(ref,{list:revised}));
 await assertSucceeds(updateDoc(ref,{list:revised,revision:4}));
 const member=env.authenticatedContext('member',{email:'member@example.test'}).firestore();
 const protectedRef=doc(member,'pipeListProtectedShares/owner-unrelated');
 const actor={uid:'member',email:'member@example.test'};
 await assertFails(updateDoc(protectedRef,{list:revised,lastEditedBy:actor}));
 await assertSucceeds(updateDoc(protectedRef,{list:revised,lastEditedBy:actor,revision:4}));
 await assertFails(updateDoc(protectedRef,{ownerUid:'member',revision:5,lastEditedBy:actor}));
 await assertFails(updateDoc(doc(member,'pipeListShares/owner-unrelated'),{editorEmails:['outsider@example.test']}));
});
