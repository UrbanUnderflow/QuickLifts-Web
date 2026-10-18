const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const guards=require('../lib/account-closure-guard');
const source=fs.readFileSync(path.join(__dirname,'../pulsecheck-chat.js'),'utf8');
const helperSource=source.slice(source.indexOf('function getRequestHeader('),source.indexOf('// Escalation Tier enum values'));
const verifyPulseCheckCaller=new Function('assertAccountOpen',`${helperSource};return verifyPulseCheckCaller;`)(guards.assertAccountOpen);
function fixture(){
 const records=new Map(), checks=[];let writes=0;
 const ref=p=>({id:p.split('/').at(-1),collection:n=>collection(p+'/'+n),get:async()=>snap(p),set:async value=>{writes++;records.set(p,value)}});
 const snap=p=>({exists:records.has(p),data:()=>records.get(p)});
 const collection=name=>({doc:id=>ref(name+'/'+(id||'generated'))});
 const db={collection,runTransaction:async body=>body({get:r=>r.get(),set:(r,...args)=>r.set(...args)})};
 const app={firestore:()=>db,auth:()=>({verifyIdToken:async(token,checkRevoked)=>{checks.push(checkRevoked);return {uid:'A'}}})};
 return {records,app,db,checks,get writes(){return writes}};
}
const event=body=>({httpMethod:'POST',headers:{authorization:'Bearer synthetic'},body:JSON.stringify(body)});
function endpoint(name,f,onAssess=()=>{}){
 const exports={};
 const dependencies={
  './config/firebase':{getFirebaseAdminApp:()=>f.app,headers:{}},
  './pulsecheck-chat':{runtimeHelpers:{verifyPulseCheckCaller}},
  './utils/noraStoragePolicy':{assessNoraStorage:async()=>{onAssess();return {restricted:false}},safeTranscript:messages=>messages},
  './lib/account-closure-guard':guards,
 };
 new Function('require','exports',fs.readFileSync(path.join(__dirname,'..',name),'utf8'))(key=>{assert.ok(key in dependencies,key);return dependencies[key]},exports);
 return exports.handler;
}
test('Nora caller checks token revocation and rejects durable closure before any write',async()=>{
 for(const name of ['nora-save-conversation.js','nora-save-derived.js']){
  const f=fixture();f.records.set('account-closure-jobs/A',{status:'queued'});
  const response=await endpoint(name,f)(event({id:'c',messages:[],kind:'note',data:{text:'synthetic'}}));
  assert.equal(response.statusCode,401);assert.deepEqual(f.checks,[true]);assert.equal(f.writes,0);
 }
});
test('closure during classification prevents each endpoint from recreating cleaned records',async()=>{
 for(const name of ['nora-save-conversation.js','nora-save-derived.js']){
  const f=fixture();f.records.set('conversations/B',{userId:'B'});
  const response=await endpoint(name,f,()=>f.records.set('account-closure-jobs/A',{status:'queued'}))(event({id:'c',messages:[{content:'synthetic'}],kind:'note',data:{text:'synthetic'}}));
  assert.equal(response.statusCode,403);assert.equal(f.writes,0);assert.equal(f.records.get('conversations/B').userId,'B');
 }
});
test('open owner writes continue and cannot overwrite another user conversation',async()=>{
 const f=fixture();f.records.set('conversations/B',{userId:'B'});
 assert.equal((await endpoint('nora-save-conversation.js',f)(event({id:'B',messages:[]}))).statusCode,403);
 assert.equal((await endpoint('nora-save-conversation.js',f)(event({id:'A',messages:[{content:'synthetic'}]}))).statusCode,200);
 assert.equal((await endpoint('nora-save-derived.js',f)(event({kind:'note',id:'note',data:{text:'synthetic'}}))).statusCode,200);
 assert.equal(f.records.get('conversations/B').userId,'B');assert.equal(f.records.get('conversations/A').userId,'A');assert.equal(f.records.get('user-mental-notes/A/notes/note').userId,'A');
});
