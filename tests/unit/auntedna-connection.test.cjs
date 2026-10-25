const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const prior=require.extensions['.ts'];require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);
const {resolveBaselineConnection}=require(path.resolve('src/lib/questionnaires/auntedna-connection.ts'));require.extensions['.ts']=prior;
const configuration=()=>({universityCode:'FICTIONAL_CLINIC',auntEdnaBaselineConnection:{organizationId:'org',teamIds:['team'],environment:'live',universityCode:'FICTIONAL_CLINIC',credentialEnv:'AUNTEDNA_PARTNER_LIVE_KEY_SYNTHETIC',approvalReference:'synthetic approval fixture'}});
const env={AUNTEDNA_PARTNER_LIVE_KEY_SYNTHETIC:'ae_pk_live_fake'};
test('a provider connection is absent by default and never inferred from branding or assignment code',()=>{
 for(const org of [undefined,{}, {productBrand:'athleticmind',universityCode:'CAU'}])assert.equal(resolveBaselineConnection('org','team',org,{environment:'live',universityCode:'CAU'},env),null);
});
test('live connection requires exact persisted organization, team, approved code, credential scope and environment',()=>{
 const org=configuration();const result=resolveBaselineConnection('org','team',org,{universityCode:'CALLER_OVERRIDE'},env);
 assert.equal(result.universityCode,'FICTIONAL_CLINIC');assert.equal(result.apiKey,'ae_pk_live_fake');
 assert.equal(resolveBaselineConnection('foreign','team',org,{},env),null);assert.equal(resolveBaselineConnection('org','foreign',org,{},env),null);
 for(const patch of [{organizationId:'foreign'},{teamIds:[]},{approvalReference:''},{credentialEnv:'SNAPSHOT_SIGNING_KEY'},{environment:'test'},{universityCode:'SANDBOX'},{universityCode:'A'.repeat(21)}]){
  const value=configuration();Object.assign(value.auntEdnaBaselineConnection,patch);assert.equal(resolveBaselineConnection('org','team',value,{},env),null);
 }
 assert.equal(resolveBaselineConnection('org','team',org,{},{}),null);
 assert.equal(resolveBaselineConnection('org','team',org,{}, {...env,AUNTEDNA_PARTNER_LIVE_KEY_SYNTHETIC:'ae_pk_test_fake'}),null);
});
test('explicit test assignments stay isolated to SANDBOX',()=>{
 assert.equal(resolveBaselineConnection('org','team',configuration(),{environment:'test',universityCode:'SANDBOX'},{AUNTEDNA_PARTNER_TEST_KEY:'ae_pk_test_fake'}).universityCode,'SANDBOX');
 assert.equal(resolveBaselineConnection('org','team',null,{environment:'test',universityCode:'CAU'},{AUNTEDNA_PARTNER_TEST_KEY:'ae_pk_test_fake'}),null);
});
