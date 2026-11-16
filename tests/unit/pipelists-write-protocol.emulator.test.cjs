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

test('owner and editor transactions converge after concurrent typing, scalar edits and offline changes', async () => {
  require('tsx/cjs');
  const assert = require('node:assert/strict');
  const { runTransaction, disableNetwork, enableNetwork, getDocFromServer } = require('firebase/firestore');
  const { stampPipeListTextChanges } = require('../../src/utils/pipelistsText.ts');
  const { mergePipeListSnapshotsThreeWay } = require('../../src/utils/pipelistsCollaboration.ts');
  const { assertPipeListWriteSafe, nextPipeListsRevision } = require('../../src/utils/pipelistsWriteProtocol.ts');
  const ownerDb = owner();
  const editorDb = env.authenticatedContext('member', { email: 'member@example.test' }).firestore();
  const path = 'pipeListProtectedShares/owner-unrelated';
  const initial = { ...list, items: [{ ...list.items[0], notes: 'Call Sam', owner: '', weeklyLogs: [] }] };
  await env.withSecurityRulesDisabled(async c => {
    await updateDoc(doc(c.firestore(), path), { list: initial, revision: 1, writeProtocol: 2 });
  });

  const read = async db => (await getDocFromServer(doc(db, path))).data().list;
  async function save(db, uid, base, local) {
    const { runPipeListSaveWithRetry, rethrowPipeListTransactionError } = require('../../src/utils/pipelistsAutosave.ts');
    let revision;
    await runPipeListSaveWithRetry(() => runTransaction(db, async tx => {
      const ref = doc(db, path);
      const data = (await tx.get(ref)).data();
      revision = data.revision;
      assertPipeListWriteSafe(base, data.list, local);
      tx.update(ref, {
        ...nextPipeListsRevision(data),
        list: mergePipeListSnapshotsThreeWay(base, data.list, local, true),
        lastEditedBy: { uid, email: uid + '@example.test' },
      });
    }).catch(error => rethrowPipeListTransactionError(error, revision, async () =>
      (await getDocFromServer(doc(db, path))).data()?.revision,
    )), () => true);
  }
  function edit(base, changes, uid) {
    const item = base.items[0];
    return { ...base, items: [stampPipeListTextChanges(item, {
      ...item, ...changes, weeklyLogs: [...item.weeklyLogs, { id: uid, summary: uid + ' assigned ' + changes.owner }],
    })] };
  }
  const [ownerBase, editorBase] = await Promise.all([read(ownerDb), read(editorDb)]);
  const left = edit(ownerBase, { notes: 'Please Call Sam', owner: 'Casey', stage: 'ready' }, 'owner');
  const right = edit(editorBase, { notes: 'Call Sam today', owner: 'Avery', title: 'Meeting' }, 'member');
  await Promise.all([save(ownerDb, 'owner', ownerBase, left), save(editorDb, 'member', editorBase, right)]);
  const [first, second] = await Promise.all([read(ownerDb), read(editorDb)]);
  assert.deepEqual(first, second);
  assert.equal(first.items[0].notes, 'Please Call Sam today');
  assert.equal(first.items[0].owner, 'Casey');
  assert.equal(first.items[0].stage, 'ready');
  assert.equal(first.items[0].title, 'Meeting');
  assert.deepEqual(first.items[0].weeklyLogs.map(log => log.id).sort(), ['member', 'owner']);

  await disableNetwork(editorDb);
  const offline = edit(second, { notes: 'Please Call Sam today!' }, 'offline');
  await save(ownerDb, 'owner', first, edit(first, { notes: 'Please Call Dr. Sam today' }, 'connected'));
  await enableNetwork(editorDb);
  await save(editorDb, 'member', second, offline);
  assert.equal((await read(ownerDb)).items[0].notes, 'Please Call Dr. Sam today!');
  assert.deepEqual(await read(ownerDb), await read(editorDb));
});
