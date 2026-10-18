const {test}=require('node:test');const assert=require('node:assert/strict');
const {assertNonPulseToken,sendNonPulsePush}=require('../lib/legacy-push-ownership');
function fake({canonical=[],users=[]}={}){return {collection(name){return {where(field,op,value){const rows=(name==='users'?users:canonical).filter(row=>row[field]===value);return {limit(){return this},get:async()=>({empty:rows.length===0,docs:rows.map(row=>({data:()=>row}))})}}}}}}
test('FitWithPulse-only token remains deliverable',async()=>{let sends=0;await sendNonPulsePush(fake({users:[{fcmToken:'fwp',notificationPlatform:'android'}]}),{send:async()=>++sends},{token:'fwp'});assert.equal(sends,1)});
test('copied old Android challenge token is suppressed after account switch',async()=>{await assert.rejects(assertNonPulseToken(fake({users:[{fcmToken:'old',pulseCheckFcmToken:'old',notificationPlatform:'android'}]}),'old'),{code:'push/product-ownership-mismatch'})});
test('canonical or legacy explicit PulseCheck token cannot be sent by generic sender',async()=>{await assert.rejects(assertNonPulseToken(fake({canonical:[{token:'pc',ownerUserId:'B'}]}),'pc'));await assert.rejects(assertNonPulseToken(fake({users:[{pulseCheckFcmToken:'pc'}]}),'pc'))});
test('ownership read failure never sends',async()=>{let sent=false;await assert.rejects(sendNonPulsePush({collection(){throw Error('offline')}},{send:async()=>{sent=true}},{token:'x'}));assert.equal(sent,false)});

test('copied snapshot token with no current owner cannot authorize notification',async()=>{let sent=false;await assert.rejects(sendNonPulsePush(fake(),{send:async()=>{sent=true}},{token:'stale'}),{code:'push/ownership-unavailable'});assert.equal(sent,false)});
