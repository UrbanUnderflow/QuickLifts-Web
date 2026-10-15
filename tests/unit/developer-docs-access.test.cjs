const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const root=path.resolve(__dirname,'../..');
function harness(runtimeLoader){const cache={};const rows={};const db={collection(name){return {doc(id){return {key:`${name}/${id}`};}};},async runTransaction(fn){return fn({get:async ref=>({data:()=>rows[ref.key]}),set:(ref,value)=>{rows[ref.key]=value;}});}};
 function load(relative){const file=path.resolve(root,relative);if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.React}}).outputText;const req=name=>{if(runtimeLoader&&name.endsWith('/partner-runtime-config'))return {ensurePartnerRuntimeConfig:runtimeLoader};if(name.includes('/components/developer/DeveloperDocumentPage'))return ()=>null;if(name.startsWith('.')){const next=path.resolve(path.dirname(file),name);return load(fs.existsSync(next)?next:fs.existsSync(`${next}.js`)?`${next}.js`:`${next}.ts`);}return require(name);};new Function('require','module','exports',code)(req,mod,mod.exports);return mod.exports;}
 const response=()=>({code:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.body=value;return this;},end(value){this.body=value;},set statusCode(code){this.code=code;}});return {load,db,response};}
async function configured(fn){const names=['DEVELOPER_DOCS_PASSWORD_HASH','DEVELOPER_DOCS_PASSWORD_SALT','DEVELOPER_DOCS_COOKIE_SECRET'];const old=Object.fromEntries(names.map(key=>[key,process.env[key]]));const h=harness();const access=h.load('src/lib/systemOverviewShareAccess.ts');const pass=access.createPasscodeHash('SyntheticDeveloperPassword');process.env.DEVELOPER_DOCS_PASSWORD_HASH=pass.hash;process.env.DEVELOPER_DOCS_PASSWORD_SALT=pass.salt;process.env.DEVELOPER_DOCS_COOKIE_SECRET='synthetic-developer-test-signing-secret-only';try{await fn(h);}finally{for(const key of names)if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}

test('developer routes protect SSR bytes and downloads with same no-account password cookie',async()=>configured(async h=>{
 const helper=h.load('src/lib/developerDocsServer.ts'),slug='athleticmind-snapshots';
 const page=h.load('src/pages/developer/api/athleticmind-snapshots.tsx').getServerSideProps;
 const locked=await page({req:{cookies:{}},res:h.response()});assert.equal(locked.props.locked,true);assert.deepEqual(locked.props.artifacts,[]);
 const handler=h.load('src/pages/api/developer/docs/[slug]/unlock.ts').createDeveloperDocsUnlockHandler({db:h.db});
 const req=password=>({method:'POST',query:{slug},headers:{},socket:{remoteAddress:'synthetic-ip'},body:{password}});
 let res=h.response();await handler(req('wrong'),res);assert.equal(res.code,401);assert.equal(res.headers['Set-Cookie'],undefined);
 res=h.response();await handler(req('SyntheticDeveloperPassword'),res);assert.equal(res.code,200);assert.match(res.headers['Set-Cookie'],/HttpOnly/);
 const value=res.headers['Set-Cookie'].split(';')[0].split('=')[1],cookies={[helper.developerDocsCookieName(slug)]:value};
 const unlocked=await page({req:{cookies},res:h.response()});assert.equal(unlocked.props.locked,false);assert.equal(unlocked.props.artifacts.length,6);
 assert.equal(helper.developerDocsAuthorized('clinical-bridge',value),false);
 const route=h.load('src/pages/developer/api/[slug]/artifacts/[...filename].tsx').getServerSideProps;
 let ctx={params:{slug,filename:['README.md']},req:{cookies:{}},res:h.response()};await route(ctx);assert.equal(ctx.res.code,401);assert.ok(!ctx.res.body.includes('#'));
 ctx={...ctx,req:{cookies},res:h.response()};await route(ctx);assert.equal(ctx.res.code,200);assert.equal(ctx.res.body,unlocked.props.artifacts.find(a=>a.name==='README.md').content);assert.match(ctx.res.headers['Cache-Control'],/no-store/);
 assert.deepEqual(await route({...ctx,params:{slug,filename:['..','..','integrations','auntedna-snapshot','README.md']}}),{notFound:true});
}));
test('unconfigured, expired, modified and rotated credentials deny access',async()=>configured(async h=>{
 const helper=h.load('src/lib/developerDocsServer.ts'),slug='athleticmind-snapshots';const cookie=helper.developerDocsCookie(slug).split(';')[0].split('=')[1];
 assert.equal(helper.developerDocsAuthorized(slug,`${cookie}bad`),false);
 assert.equal(helper.developerDocsAuthorized(slug,cookie,Date.now()+13*3600000),false);
 process.env.DEVELOPER_DOCS_COOKIE_SECRET='rotated-synthetic-test-signing-secret';assert.equal(helper.developerDocsAuthorized(slug,cookie),false);
 delete process.env.DEVELOPER_DOCS_PASSWORD_HASH;
 const props=await helper.getDeveloperDocumentPageProps(slug,{req:{cookies:{}},res:h.response()});assert.equal(props.props.available,false);assert.equal(props.props.artifacts.length,0);
 const handler=h.load('src/pages/api/developer/docs/[slug]/unlock.ts').createDeveloperDocsUnlockHandler({db:h.db});const res=h.response();await handler({method:'POST',query:{slug},headers:{},socket:{},body:{password:'SyntheticDeveloperPassword'}},res);assert.equal(res.code,503);
}));
test('developer password attempts are persistently limited and arbitrary slugs denied',async()=>configured(async h=>{
 const handler=h.load('src/pages/api/developer/docs/[slug]/unlock.ts').createDeveloperDocsUnlockHandler({db:h.db});let res;
 for(let index=0;index<11;index++){res=h.response();await handler({method:'POST',query:{slug:'athleticmind-snapshots'},headers:{},socket:{remoteAddress:'same-ip'},body:{password:'wrong'}},res);}
 assert.equal(res.code,429);assert.equal(res.headers['Retry-After'],'900');
 res=h.response();await handler({method:'POST',query:{slug:'internal-system-overview'},headers:{},socket:{},body:{password:'SyntheticDeveloperPassword'}},res);assert.equal(res.code,404);
}));

 test('runtime configuration failure blocks SSR, unlock, and download even with old valid credentials',async()=>configured(async base=>{
 const baseHelper=base.load('src/lib/developerDocsServer.ts'),slug='athleticmind-snapshots';
 const cookie=baseHelper.developerDocsCookie(slug).split(';')[0].split('=')[1];
 let calls=0;const h=harness(async()=>{calls++;throw new Error('Synthetic runtime config unavailable');});
 const helper=h.load('src/lib/developerDocsServer.ts'),cookies={[helper.developerDocsCookieName(slug)]:cookie};
 const res=h.response();const props=await helper.getDeveloperDocumentPageProps(slug,{req:{cookies},res});
 assert.equal(res.code,503);assert.equal(props.props.available,false);assert.equal(props.props.locked,true);assert.deepEqual(props.props.artifacts,[]);
 const unlock=h.load('src/pages/api/developer/docs/[slug]/unlock.ts').createDeveloperDocsUnlockHandler({db:h.db});const unlockRes=h.response();await unlock({method:'POST',query:{slug},body:{password:'SyntheticDeveloperPassword'}},unlockRes);assert.equal(unlockRes.code,503);assert.equal(unlockRes.headers['Set-Cookie'],undefined);
 const download=h.load('src/pages/developer/api/[slug]/artifacts/[...filename].tsx').getServerSideProps;const downloadRes=h.response();await download({params:{slug,filename:['README.md']},req:{cookies},res:downloadRes});assert.equal(downloadRes.code,503);assert.ok(!downloadRes.body.includes('# Athletic'));assert.equal(calls,3);
 }));

test('AuntEdna guide and artifacts use the existing protected access boundary',async()=>configured(async()=>{
 const h=harness(async()=>{}),helper=h.load('src/lib/developerDocsServer.ts'),slug='auntedna';
 const page=h.load('src/pages/developer/api/auntedna.tsx');
 const locked=await page.getServerSideProps({req:{cookies:{}},res:h.response()});
 assert.equal(locked.props.locked,true);assert.deepEqual(locked.props.artifacts,[]);
 const cookie=helper.developerDocsCookie(slug).split(';')[0].split('=')[1];
 const unlocked=await page.getServerSideProps({req:{cookies:{[helper.developerDocsCookieName(slug)]:cookie}},res:h.response()});
 assert.equal(unlocked.props.locked,false);assert.equal(unlocked.props.artifacts.length,6);
 assert.ok(unlocked.props.artifacts.find(a=>a.name==='README.md').content.includes('cau-starting-point-v2'));
 assert.equal(helper.developerArtifactAllowed(slug,'../../secrets'),false);
 const download=h.load('src/pages/developer/api/[slug]/artifacts/[...filename].tsx').getServerSideProps;
 const res=h.response();await download({params:{slug,filename:['examples','baseline.synthetic.json']},req:{cookies:{}},res});
 assert.equal(res.code,401);assert.ok(!res.body.includes('Synthetic Athlete'));
}));

test('published baseline artifacts match canonical questions, routing and protected wire fields',()=>{
 const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const base='docs/developer/auntedna/';
 const questions=read('src/content/questionnaires/cau-operational.json'),routing=read('src/content/questionnaires/cau-routing.json');
 assert.deepEqual(read(base+'questionnaire.json'),questions);assert.deepEqual(read(base+'routing.json'),routing);
 assert.equal(questions.questions.length+24,48);
 const payload=read(base+'examples/baseline.synthetic.json'),schema=read(base+'baseline.schema.json');
 const protectedIds=routing.questions.filter(q=>q.custodian==='auntEDNA').map(q=>q.questionId).sort();
 assert.equal(protectedIds.length,19);assert.deepEqual(Object.keys(payload.fields).sort(),protectedIds);
 assert.deepEqual(schema.properties.fields.required.sort(),protectedIds);
 assert.equal(payload.version,questions.version);assert.equal(payload.ownershipVersion,routing.version);
 for(const q of questions.questions.filter(q=>protectedIds.includes(q.id))){
  const field=payload.fields[q.id],spec=schema.properties.fields.properties[q.id].oneOf[0].properties.value;
  assert.equal(field.questionId,q.id);
  assert.deepEqual(q.type==='multi_select'?spec.items.enum:spec.enum,q.choices);
  if(field.state==='local')for(const choice of Array.isArray(field.value)?field.value:[field.value])assert.ok(q.choices.includes(choice));
 }
 const receipt=read(base+'examples/receipt.synthetic.json');assert.equal(receipt.data.submissionId,payload.submissionId);
});

test('baseline request schema accepts the example and rejects wrong versions, ownership and options',()=>{
 const Ajv=require('ajv'),ajv=new Ajv({allErrors:true});
 const schema=JSON.parse(fs.readFileSync(path.join(root,'docs/developer/auntedna/baseline.schema.json'),'utf8'));
 const example=JSON.parse(fs.readFileSync(path.join(root,'docs/developer/auntedna/examples/baseline.synthetic.json'),'utf8'));
 const validate=ajv.compile(schema);assert.equal(validate(example),true,JSON.stringify(validate.errors));
 for(const mutate of [x=>x.version='cau-operational-web-v1',x=>x.fields['cau-starting-point-01']={questionId:'cau-starting-point-01',state:'local',value:'Yes'},x=>x.fields['cau-starting-point-35'].value='Often',x=>x.fields['cau-starting-point-40'].value=['Academics','Volleyball performance','Family','Finances'],x=>x.fields['cau-starting-point-40'].value=['Nothing significant','Academics']]){
  const changed=JSON.parse(JSON.stringify(example));mutate(changed);assert.equal(validate(changed),false);
 }
});
