const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('src/pages/api/admin/pulsecheck/baseline-backups.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
async function call({token='admin',method='GET',body,query={},mode='prod',closed=false,helperError=false,emailVerified=true,adminRecord={}}={}){
 const calls=[];const module={exports:{}};class BackupError extends Error{constructor(message,statusCode=409){super(message);this.statusCode=statusCode}}
 const db={collection:name=>({doc:id=>({get:async()=>({exists:name==='admin'?token==='admin':name==='account-closure-jobs'&&closed,data:()=>adminRecord})})})};
 const mocks={
  '../../../../lib/questionnaires/cau-backups':{BackupError,listHealthBackups:async(...args)=>{calls.push(['list',...args.slice(1)]);if(helperError)throw Error('sensitive provider body');return{backups:[],nextCursor:null}},processHealthBackup:async(...args)=>{calls.push(['retry',...args.slice(1)]);return{id:args[1],deliveryStatus:'blocked'}},deleteVerifiedHealthBackup:async(...args)=>{calls.push(['delete',...args.slice(1)]);return{id:args[1],backupRetained:false}}},
  '../../../../lib/firebase-admin':{getFirebaseAdminApp:dev=>{calls.push(['environment',dev]);return{auth:()=>({verifyIdToken:async(value,revoked)=>{assert.equal(revoked,true);if(value==='invalid')throw Error('invalid');return{uid:token,email:token+'@example.test',email_verified:emailVerified}}}),firestore:()=>db}}},
 };
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>mocks[name],Object,Set,Number,Promise,Error});
 const result={status:200};const res={setHeader(){},status(n){result.status=n;return this},json(value){result.body=JSON.parse(JSON.stringify(value));return this},end(){return this}};
 await module.exports.default({method,headers:{...(token?{authorization:'Bearer '+token}:{}),'x-pulsecheck-firebase-mode':mode},query,body},res);
 return{...result,calls};
}
test('backups require verified current-environment admin identity; coach and closed actor cannot list',async()=>{
 assert.equal((await call({token:null})).status,401);
 assert.equal((await call({token:'invalid'})).status,401);
 assert.equal((await call({token:'coach'})).status,403);
 assert.equal((await call({closed:true})).status,403);
 assert.equal((await call({emailVerified:false})).status,403);
 for(const adminRecord of [{disabled:true},{status:'disabled'},{status:'revoked'},{revoked:true},{revokedAt:'today'},{uid:'another'}])assert.equal((await call({adminRecord})).status,403);
 assert.equal((await call({adminRecord:{uid:'admin'}})).status,200);
 const result=await call({mode:'dev',query:{limit:'25',cursor:'cursor'}});assert.equal(result.status,200);assert.deepEqual(result.calls,[['environment',true],['list',25,'cursor']]);
});
test('browser cannot submit verification receipts, change actors, or mark backups verified',async()=>{
 const backupId='health_backup_'+'a'.repeat(64);
 for(const body of [{action:'verified',backupId},{action:'retry',backupId,receipt:{success:true}},{action:'delete',backupId,actorUid:'other'},{action:'delete',backupId:'../../other'}]){
  const result=await call({method:'POST',body});assert.equal(result.status,400);assert.equal(result.calls.length,1);
 }
 assert.deepEqual((await call({method:'POST',body:{action:'retry',backupId}})).calls,[['environment',false],['retry',backupId,'admin']]);
});
test('unexpected server/provider errors never disclose sensitive bodies',async()=>{
 const result=await call({helperError:true});assert.equal(result.status,503);assert.equal(JSON.stringify(result.body).includes('sensitive'),false);
});
