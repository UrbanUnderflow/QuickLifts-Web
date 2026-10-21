const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadPulseCheckPushTarget,applyPulseCheckPushOwnership}=require('../pulsecheck-notification-utils');
function db(records,closed=false){return {collection(name){return {doc(){return {get:async()=>({exists:true,data:()=>({fcmToken:'legacy',pulseCheckFcmToken:'legacy',accountClosureRequestedAt:closed})})}},where(field,op,uid){return {get:async()=>({docs:records.filter(r=>r.ownerUserId===uid).map(r=>({data:()=>r}))})}}}}}}
test('legacy tokens never authorize delivery',async()=>{assert.equal((await loadPulseCheckPushTarget(db([]),'A')).eligible,false)});
test('installation ownership changes remove previous account eligibility',async()=>{const records=[{ownerUserId:'B',token:'new',sourceApp:'pulsecheck',platform:'android'}];assert.equal((await loadPulseCheckPushTarget(db(records),'A')).eligible,false);assert.equal((await loadPulseCheckPushTarget(db(records),'B')).token,'new')});
test('closure and revoked installations suppress delivery',async()=>{const r={ownerUserId:'A',token:'t',sourceApp:'pulsecheck',platform:'ios'};assert.equal((await loadPulseCheckPushTarget(db([r],true),'A')).eligible,false);assert.equal((await loadPulseCheckPushTarget(db([{...r,revokedAt:1}]),'A')).eligible,false)});
test('Android is data only with explicit recipient, iOS preserves alert',()=>{const msg={token:'t',notification:{title:'Private',body:'Preview'},data:{route:'nora'}};const android=applyPulseCheckPushOwnership(structuredClone(msg),{platform:'android',userId:'A'});assert.equal(android.notification,undefined);assert.equal(android.data.recipientUserId,'A');assert.equal(android.data.body,'Preview');const ios=applyPulseCheckPushOwnership(structuredClone(msg),{platform:'ios',userId:'A'});assert.equal(ios.notification.body,'Preview')});

test('AthleticMind installations retain owner and closure protections', async () => {
  const record = {ownerUserId:'A', token:'athletic-token', sourceApp:'athleticmind', platform:'ios'};
  assert.equal((await loadPulseCheckPushTarget(db([record]), 'A')).token, 'athletic-token');
  assert.equal((await loadPulseCheckPushTarget(db([record]), 'B')).eligible, false);
  assert.equal((await loadPulseCheckPushTarget(db([record], true), 'A')).eligible, false);
  assert.equal((await loadPulseCheckPushTarget(db([{...record, revokedAt:1}]), 'A')).eligible, false);
  assert.equal((await loadPulseCheckPushTarget(db([{...record, sourceApp:'unrelated'}]), 'A')).eligible, false);
});
test('both apps installed retain most recently active installation delivery', async () => {
  const records = [
    {ownerUserId:'A', token:'pulse-token', sourceApp:'pulsecheck', platform:'ios', updatedAt:{toMillis:()=>1}},
    {ownerUserId:'A', token:'athletic-token', sourceApp:'athleticmind', platform:'ios', updatedAt:{toMillis:()=>2}},
  ];
  assert.equal((await loadPulseCheckPushTarget(db(records), 'A')).token, 'athletic-token');
});

test('brand-specific activation never targets the other installed app', async () => {
 const records = [
  {ownerUserId:'A', token:'pulse-token', sourceApp:'pulsecheck', updatedAt:{toMillis:()=>2}},
  {ownerUserId:'A', token:'athletic-token', sourceApp:'athleticmind', updatedAt:{toMillis:()=>1}},
 ];
 assert.equal((await loadPulseCheckPushTarget(db(records), 'A', 'athleticmind')).token, 'athletic-token');
 assert.equal((await loadPulseCheckPushTarget(db(records.slice(0,1)), 'A', 'athleticmind')).eligible, false);
 assert.equal((await loadPulseCheckPushTarget(db(records), 'A', 'unknown')).eligible, false);
});
