const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
function load(relative, stubs, extras = {}) {
 const module={exports:{}};
 new Function('require','module','exports','fetch','process',fs.readFileSync(path.join(root,relative),'utf8'))(name=>Object.hasOwn(stubs,name)?stubs[name]:require(name),module,module.exports,extras.fetch,extras.process||process);
 return module.exports;
}
test('classifier authorizes owner before conditions/history reads; internal chat classifier is separate', async () => {
 let reads=0, modelCalls=0;
 const query={where(){return this;},orderBy(){return this;},limit(){return this;},async get(){reads++;return {docs:[]};}};
 const handler=load('netlify/functions/classify-escalation.js',{'./config/firebase':{headers:{},initializeFirebaseAdmin(){},db:{collection(){return query;}},admin:{auth(){return {async verifyIdToken(token){if(token==='owner')return {uid:'athlete'};if(token==='other')return {uid:'other'};throw new Error('invalid');}};}}}},{process:{env:{OPEN_AI_SECRET_KEY:'synthetic-test-key'}},fetch:async()=>{modelCalls++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({tier:0,category:'general',reason:'synthetic',confidence:1,shouldEscalate:false})}}]})};}}).handler;
 const request=token=>({httpMethod:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:JSON.stringify({userId:'athlete',message:'Synthetic test'})});
 assert.equal((await handler(request())).statusCode,401);
 assert.equal((await handler(request('bad'))).statusCode,401);
 assert.equal((await handler(request('other'))).statusCode,403);
 assert.equal(reads,0);assert.equal(modelCalls,0);
 assert.equal((await handler(request('owner'))).statusCode,200);
 assert.equal(reads,2);assert.equal(modelCalls,1);
});
test('Vision Pro preserves safety block without revealing emergency tier or private incident identifier', () => {
 const utils=load('netlify/functions/vision-pro-trials-utils.js',{'./config/firebase':{},'./pulsecheck-notification-utils':{},'../../src/api/firebase/mentaltraining/profileSnapshotRuntime.js':{PROFILE_VERSION:'test'}});
 const issues=utils.buildVisionProProtocolIssues({protocolContext:{membership:{},onboarding:{productConsentAccepted:true,baselinePathStatus:'complete'},enrollmentMode:'product-only',activeEscalation:{tier:3,id:'private-incident'}}});
 assert.ok(issues.includes('This athlete is not currently eligible to start a Vision Pro session.'));
 assert.ok(!JSON.stringify(issues).includes('Tier 3'));assert.ok(!JSON.stringify(issues).includes('private-incident'));
 const output=utils.sanitizeSession('synthetic-session',{protocolContext:{activeEscalationTier:3,activeEscalationRecordId:'private-incident'}});
 assert.equal(output.protocolContext.activeEscalationTier,undefined);
 assert.equal(output.protocolContext.activeEscalationRecordId,undefined);
});
