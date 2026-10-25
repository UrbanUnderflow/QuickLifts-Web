const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);
const {defaultInstitutionPolicy,validateInstitutionPolicy,policyApplies,enforceInstitutionPolicy}=require('../../src/lib/institutionOnboarding/policy.ts');
const {readActiveInstitutionPolicy}=require('../../src/lib/institutionOnboarding/server.ts');
const policy={institutionalEmailRequired:true,approvedEmailDomains:['school.edu'],audience:'coaches'};
const claims={email:'coach@school.edu',email_verified:true,phone_number:'+12025550123',firebase:{sign_in_provider:'phone'}};
test('absent policy preserves existing onboarding',()=>assert.doesNotThrow(()=>enforceInstitutionPolicy(defaultInstitutionPolicy,'coach',{})));
test('exact normalized domains; reject wildcard, URL, empty enabled domain and unknown keys',()=>{
 assert.deepEqual(validateInstitutionPolicy({...policy,approvedEmailDomains:[' School.EDU ','school.edu']}),policy);
 for(const domains of [[],['*.school.edu'],['https://school.edu'],['@school.edu'],['school.edu/path']])assert.throws(()=>validateInstitutionPolicy({...policy,approvedEmailDomains:domains}));
 assert.throws(()=>validateInstitutionPolicy({...policy,active:true}));
});
test('matching domain does not prove mailbox ownership',()=>assert.throws(()=>enforceInstitutionPolicy(policy,'coach',{...claims,email_verified:false})));
test('lookalike and unlisted subdomain cannot match institutional domain',()=>{for(const email of ['coach@school.edu.evil.com','coach@athletics.school.edu','coach@other.edu'])assert.throws(()=>enforceInstitutionPolicy(policy,'coach',{...claims,email}));});
test('require verified phone claim, not a contact-profile phone',()=>{for(const phone_number of [undefined,'2025550123','+0123456789'])assert.throws(()=>enforceInstitutionPolicy(policy,'coach',{...claims,phone_number}));});
test('Google session cannot bypass restricted join; linked account can use phone',()=>{assert.throws(()=>enforceInstitutionPolicy(policy,'coach',{...claims,firebase:{sign_in_provider:'google.com'}}));assert.doesNotThrow(()=>enforceInstitutionPolicy(policy,'coach',claims));});
test('coach rollout preserves athlete behavior; broader audience is explicit',()=>{assert.equal(policyApplies(policy,'athlete'),false);assert.equal(policyApplies({...policy,audience:'coaches-and-athletes'},'athlete'),true);});
test('disabled enforcement performs no database operations',async()=>{const prior=process.env.INSTITUTION_ONBOARDING_ENFORCEMENT_ENABLED;delete process.env.INSTITUTION_ONBOARDING_ENFORCEMENT_ENABLED;assert.deepEqual(await readActiveInstitutionPolicy({collection(){throw Error('unexpected read')}},'org'),defaultInstitutionPolicy);if(prior)process.env.INSTITUTION_ONBOARDING_ENFORCEMENT_ENABLED=prior;});
test('active lookup is isolated by organization and ignores draft collection', async () => {
  const prior=process.env.INSTITUTION_ONBOARDING_ENFORCEMENT_ENABLED;
  process.env.INSTITUTION_ONBOARDING_ENFORCEMENT_ENABLED='true';
  const calls=[];
  function reference(path=[]) { return {
    collection(name) { calls.push(name); return reference([...path,name]); },
    doc(id) { calls.push(id); return reference([...path,id]); },
    async get() { return {exists:path.at(-1)==='school-a',data:()=>({policy})}; }
  }; }
  try {
    assert.deepEqual(await readActiveInstitutionPolicy(reference(),'school-a'),policy);
    assert.deepEqual(await readActiveInstitutionPolicy(reference(),'school-b'),defaultInstitutionPolicy);
    assert.ok(!calls.includes('drafts'));
    await assert.rejects(()=>readActiveInstitutionPolicy(reference(),'../school-a'));
  } finally {
    if(prior) process.env.INSTITUTION_ONBOARDING_ENFORCEMENT_ENABLED=prior;
    else delete process.env.INSTITUTION_ONBOARDING_ENFORCEMENT_ENABLED;
  }
});
test('draft API denies anonymous requests without initializing Firebase',async()=>{
 const handler=require('../../src/pages/api/admin/pulsecheck/institution-onboarding.ts').default;
 const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){return this;}};
 await handler({method:'GET',headers:{},query:{organizationId:'school-a'}},res);
 assert.equal(res.code,401);
});
test('draft saving is off by default and never writes active policy',async()=>{
 const auth=require('../../src/pages/api/admin/curriculum/_auth.ts');const original=auth.requireCurriculumAdmin;
 const paths=[],writes=[];function ref(path=[]){return {collection(v){return ref([...path,v]);},doc(v){return ref([...path,v]);},async get(){return{exists:true,data:()=>({status:'active'})};},async set(data){paths.push(path.join('/'));writes.push(data);}};}
 auth.requireCurriculumAdmin=async()=>({db:ref(),uid:'approved-admin'});
 const handler=require('../../src/pages/api/admin/pulsecheck/institution-onboarding.ts').default;
 const req={method:'POST',headers:{},body:{organizationId:'school-a',policy}};
 const response=()=>({code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;},end(){return this;}});
 const prior=process.env.INSTITUTION_ONBOARDING_DRAFT_WRITES_ENABLED;
 try {
   delete process.env.INSTITUTION_ONBOARDING_DRAFT_WRITES_ENABLED;let res=response();await handler(req,res);assert.equal(res.code,503);assert.equal(writes.length,0);
   process.env.INSTITUTION_ONBOARDING_DRAFT_WRITES_ENABLED='true';res=response();await handler(req,res);assert.equal(res.code,200);assert.equal(res.body.status,'draft');assert.equal(paths[0],'pulsecheck-restricted-questionnaire-submissions/institution-onboarding-v1/drafts/school-a');assert.equal(writes[0].updatedBy,'approved-admin');
 }finally{auth.requireCurriculumAdmin=original;if(prior)process.env.INSTITUTION_ONBOARDING_DRAFT_WRITES_ENABLED=prior;else delete process.env.INSTITUTION_ONBOARDING_DRAFT_WRITES_ENABLED;}
});
