const test=require('node:test'),assert=require('node:assert/strict');
const {compileTypeScriptRuntime,loadCompiledModule,createFirestoreAdminMock,createNextApiResponseRecorder}=require('../firebase-admin/_runtimeHarness.cjs');
const compiled=compileTypeScriptRuntime({cacheKey:'organization-lifecycle-admin',entryPaths:['src/pages/api/admin/pulsecheck/organization-lifecycle.ts']});
async function call(options={}){
 const f=createFirestoreAdminMock({collections:{admin:options.notAdmin?[]:[{id:'admin@example.test',data:{}}],'account-closure-jobs':options.closed?[{id:'actor',data:{}}]:[]}});
 let invoked=false;
 const handler=loadCompiledModule({compiled,fileName:'organization-lifecycle.js',mocks:{'../_auth':{requireAdminRequest:async()=>!options.denied},'/lib/firebase-admin':{getFirebaseAdminApp:()=>({firestore:()=>f.db,auth:()=>({verifyIdToken:async(_token,revoked)=>{assert.equal(revoked,true);return{uid:'actor',email:'admin@example.test'}}})})},'/lib/organization-lifecycle':{listDeletedOrganizations:async()=>[],changeOrganizationLifecycle:async input=>{invoked=true;assert.equal(input.actorUid,'actor');return{organizationId:input.organizationId}}}}}).default;
 const res=createNextApiResponseRecorder();await handler({method:options.method||'POST',headers:{authorization:'Bearer synthetic'},body:{organizationId:'org',action:'delete',confirmationName:'Example',...options.patch}},res);return{res,invoked};
}
test('lifecycle mutation requires platform admin, open account and server-owned actor',async()=>{
 for(const [opt,expected] of [[{denied:true},401],[{notAdmin:true},403],[{closed:true},403],[{patch:{actorUid:'forged'}},400],[{method:'DELETE'},405]]){const r=await call(opt);assert.equal(r.res.statusCode,expected);assert.equal(r.invoked,false)}
 const r=await call();assert.equal(r.res.statusCode,200);assert.equal(r.invoked,true);
});
