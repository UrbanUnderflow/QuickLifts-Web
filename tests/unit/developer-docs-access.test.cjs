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
