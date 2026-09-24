const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const library = require('./load-ts.cjs')(path.join(__dirname,'../../../src/lib/equityEmailDelivery.ts'));
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../../netlify/functions/check-equity-email-status.ts'),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
const base = {equityDocumentId:'doc',recipientEmail:'person@example.test',documentType:'board_consent',status:'sent',emailStatus:'sent',messageId:'<message@brevo>',lastSentAt:'2026-09-23T22:00:00Z'};
const event = (type, extra = {}) => ({event:type,messageId:'message@brevo',email:'person@example.test',date:'2026-09-23T22:01:00Z',...extra});
function setup(options = {}) {
  const writes=[], fetches=[];
  const records = {req:{...base,...options.saved},...(options.records||{})};
  const snapshot = id => ({exists:Boolean(records[id]),data:()=>records[id]});
  const ref = id => ({id,get:async()=>snapshot(id)});
  const db = {collection:name=>({doc:id=> name==='admin'?{get:async()=>({exists:options.admin!==false})}:ref(id)}),runTransaction:async callback => callback({get:async r=>{if(options.race)records[r.id]={...records[r.id],...options.race};return snapshot(r.id);},set:(r,value)=>{writes.push({id:r.id,...value});records[r.id]={...records[r.id],...value};}})};
  const firebase = {getFirebaseAdminApp:()=>({}),admin:{firestore:()=>db,auth:()=>({verifyIdToken:async()=>{if(options.badToken)throw Error('bad');return {email:'admin@example.test'};}})}};
  const module={exports:{}};
  vm.runInNewContext(source,{exports:module.exports,module,require:name=>name==='./config/firebase'?firebase:name==='../../src/lib/equityEmailDelivery'?library:require(name),process:{env:options.noKey?{}:{BREVO_API_KEY:'test-key'}},URLSearchParams,AbortController,setTimeout,clearTimeout,Date,Map,Set,fetch:async(url,args)=>{fetches.push({url,args});if(options.networkError)throw Error('private-key-in-network-error');return {ok:!options.status,status:options.status||200,json:async()=>options.response||{events:options.events||[]}};}});
  return {writes,fetches,records,invoke:async(body={requestIds:['req']},method='POST')=>{const result=await module.exports.handler({httpMethod:method,headers:options.noToken?{}:{authorization:'Bearer token'},body:typeof body==='string'?body:JSON.stringify(body)},{});return {...result,json:JSON.parse(result.body)};}};
}
for (const [name,options,code] of [['missing auth',{noToken:true},401],['expired auth',{badToken:true},401],['non-admin',{admin:false},403]]) test(`rejects ${name} before records or provider calls`,async()=>{const s=setup(options);assert.equal((await s.invoke()).statusCode,code);assert.equal(s.fetches.length,0);assert.equal(s.writes.length,0);});
test('requires POST and a bounded valid request-ID list',async()=>{const s=setup();assert.equal((await s.invoke({},'GET')).statusCode,405);for(const body of [{requestIds:[]},{requestIds:['../bad']},{requestIds:Array(21).fill('req')},'{'])assert.equal((await s.invoke(body)).statusCode,400);assert.equal(s.fetches.length,0);});
test('checks exact saved message and recipient and persists failure separately from signature status',async()=>{
 const s=setup({events:[event('error',{reason:'IP is not authorized to send'})]});const result=await s.invoke();assert.equal(result.statusCode,200);assert.equal(result.json.results[0].emailDelivery.status,'failed');assert.equal(s.writes[0].emailDelivery.reason,'IP is not authorized to send');assert.equal(s.writes[0].status,undefined);assert.equal(s.records.req.status,'sent');
 const url=new URL(s.fetches[0].url);assert.equal(url.origin,'https://api.brevo.com');assert.equal(url.searchParams.get('messageId'),'<message@brevo>');assert.equal(url.searchParams.get('email'),'person@example.test');assert.equal(url.searchParams.get('days'),'90');assert.equal(s.fetches[0].args.headers['api-key'],'test-key');
});
test('already signed requests retain signing status while delivery checks run',async()=>{const s=setup({saved:{status:'signed',signatureData:{typedName:'Person'}},events:[event('delivered')]});await s.invoke();assert.equal(s.records.req.status,'signed');assert.equal(s.records.req.signatureData.typedName,'Person');assert.equal(s.records.req.emailDelivery.status,'delivered');});
test('out-of-order provider results are reduced chronologically and match both recipient and message',async()=>{
 const s=setup({events:[event('delivered',{date:'2026-09-23T22:03:00Z'}),event('error'),event('request',{date:'2026-09-23T22:02:00Z'}),event('error',{messageId:'old@brevo',date:'2026-09-23T22:04:00Z'}),event('error',{email:'other@example.test',date:'2026-09-23T22:05:00Z'})]});await s.invoke();assert.equal(s.records.req.emailDelivery.status,'delivered');assert.equal(s.records.req.emailDelivery.unresolvedFailure,null);
});
for(const [name,options] of [['network',{networkError:true}],['rate limit',{status:429}],['permission',{status:401}],['missing configuration',{noKey:true}],['malformed response',{response:{events:'wrong'}}]])test(`${name} error preserves sticky failure and records checking problem`,async()=>{
 const s=setup({...options,saved:{emailDelivery:{status:'failed',messageId:'<message@brevo>',recipientEmail:'person@example.test',reason:'Original block',eventAt:'2026-09-23T22:01:00Z',unresolvedFailure:{reason:'Original block',at:'2026-09-23T22:01:00Z'}}}});const result=await s.invoke();assert.equal(result.json.results[0].emailDelivery.status,'failed');assert.equal(result.json.results[0].emailDelivery.reason,'Original block');assert.ok(result.json.results[0].emailDelivery.checkError);assert.ok(result.json.results[0].emailDelivery.checkedAt);assert.doesNotMatch(JSON.stringify(result.json),/private-key/);
});
test('an empty report cannot convert provider acceptance into delivery',async()=>{const s=setup();await s.invoke();assert.equal(s.records.req.emailDelivery.status,'accepted');assert.equal(s.records.req.emailDelivery.checkError,null);});
test('Brevo may omit the optional events field for no matching events',async()=>{const s=setup({response:{}});await s.invoke();assert.equal(s.records.req.emailDelivery.status,'accepted');assert.equal(s.records.req.emailDelivery.checkError,null);});
test('a missing provider message cannot be guessed from the recipient',async()=>{const s=setup({saved:{messageId:null,emailStatus:'failed'}});await s.invoke();assert.equal(s.fetches.length,0);assert.equal(s.records.req.emailDelivery.status,'failed');assert.match(s.records.req.emailDelivery.checkError,/no Brevo message ID/);});
test('a new attempt racing the provider response is not overwritten',async()=>{const newer={status:'accepted',messageId:'new@brevo',attemptId:'new',recipientEmail:'person@example.test'};const s=setup({race:{emailDelivery:newer},events:[event('error')]});const result=await s.invoke();assert.equal(s.writes.length,0);assert.equal(result.json.results[0].emailDelivery.messageId,'new@brevo');assert.match(result.json.results[0].skipped,/newer/);});
test('new attempt with same message ID still cannot be overwritten',async()=>{const newer={status:'accepted',messageId:'<message@brevo>',attemptId:'new',recipientEmail:'person@example.test'};const s=setup({race:{emailDelivery:newer},events:[event('error')]});await s.invoke();assert.equal(s.writes.length,0);});
test('duplicate requests deduplicate provider queries and non-equity/missing requests never query',async()=>{const s=setup({records:{second:{...base},other:{documentType:'rental',messageId:'other'}}});const result=await s.invoke({requestIds:['req','req','second','other','missing']});assert.equal(s.fetches.length,1);assert.equal(result.json.results.length,4);assert.equal(s.writes.length,2);assert.ok(result.json.results[2].error);assert.ok(result.json.results[3].error);});
