const test=require('node:test'),assert=require('node:assert/strict');
const {compileTypeScriptRuntime,loadCompiledModule,createFirestoreAdminMock,createNextApiResponseRecorder}=require('../firebase-admin/_runtimeHarness.cjs');
const {provisionEntity}=require('../../../src/lib/server/pulsecheck/provisionEntity');
const compiled=compileTypeScriptRuntime({cacheKey:'app-experience-admin',entryPaths:['src/pages/api/admin/pulsecheck/organization-configuration.ts']});
async function call(configuration,options={}){
 const f=createFirestoreAdminMock({collections:{admin:options.notAdmin?[]:[{id:'admin@example.test',data:{role:'admin'}}],'pulsecheck-organizations':[{id:'org',data:{productBrand:'pulsecheck',appBranding:{pulsecheck:'athleticmind'},appExperience:options.experience || {ios:'clay'}}}],'account-closure-jobs':options.closed?[{id:'actor',data:{}}]:[]}});
 const app={firestore:()=>f.db,auth:()=>({verifyIdToken:async(_token,revoked)=>{assert.equal(revoked,true);return {uid:'actor',email:'admin@example.test'};}})};
 const handler=loadCompiledModule({compiled,fileName:'organization-configuration.js',mocks:{'/lib/pulsecheck/signInPolicy':require('../../../src/lib/pulsecheck/signInPolicy'),'/lib/pulsecheck/productConfig':require('../../../src/lib/pulsecheck/productConfig'),'../_auth':{requireAdminRequest:async()=>options.denied?null:{email:'admin@example.test'}},'/lib/firebase-admin':{__esModule:true,default:f.admin,getFirebaseAdminApp:()=>app}}}).default;
 const res=createNextApiResponseRecorder();await handler({method:'POST',headers:{authorization:'Bearer synthetic'},body:{organizationId:'org',configuration}},res);return {f,res};
}
test('admin configuration ignores the retired appearance setting and preserves branding',async()=>{
 const {f,res}=await call({productBrand:'pulsecheck',appExperience:{ios:'standard'}});assert.equal(res.statusCode,200);assert.deepEqual(f.getDocument('pulsecheck-organizations/org').appExperience,{ios:'clay'});assert.equal(f.getDocument('pulsecheck-organizations/org').appBranding.pulsecheck,'athleticmind');
});
test('unauthorized and closed writes fail without mutation',async()=>{
 for(const [config,options,status]of [[{productBrand:'pulsecheck'},{denied:true},401],[{productBrand:'pulsecheck'},{notAdmin:true},403],[{productBrand:'pulsecheck'},{closed:true},400]]){const {f,res}=await call(config,options);assert.equal(res.statusCode,status);assert.equal(f.getDocument('pulsecheck-organizations/org').productConfigurationUpdatedBy,undefined);}
});
test('organization provisioning no longer stores an appearance',async()=>{
 for(const appearance of [undefined,{ios:'standard'},{ios:'bad'}]){const f=createFirestoreAdminMock();const result=await provisionEntity(f.db,{kind:'organization',operationId:'appearance-operation',actor:'admin@example.test',actorUid:'actor',payload:{displayName:'Synthetic',productBrand:'pulsecheck',...(appearance?{appExperience:appearance}:{})}},1);assert.equal(f.getDocument(`pulsecheck-organizations/${result.id}`).appExperience,undefined);}
});
test('paired and organization-only reprovision leave stored appearance untouched',async()=>{
 const {provisionPulseCheckOrganizationAndTeam,upsertPulseCheckOrganization}=require('../../../src/lib/server/pulsecheck/provisionOrganizationAndTeam');
 for(const provision of [provisionPulseCheckOrganizationAndTeam,upsertPulseCheckOrganization]){
  const f=createFirestoreAdminMock({collections:{'pulsecheck-organizations':[{id:'org',data:{productBrand:'pulsecheck',appExperience:{ios:'clay'},appBranding:{pulsecheck:'athleticmind'}}}]}});
  const input={organization:{id:'org',productBrand:'pulsecheck',displayName:'Synthetic',appExperience:{ios:'standard'}},team:{id:'team',displayName:'Team',teamType:'club',sportOrProgram:'Track'}};
  await provision({adminApp:f.db,input});assert.deepEqual(f.getDocument('pulsecheck-organizations/org').appExperience,{ios:'clay'});assert.equal(f.getDocument('pulsecheck-organizations/org').appBranding.pulsecheck,'athleticmind');
 }
});
