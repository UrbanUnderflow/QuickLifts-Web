const {test}=require('node:test');const assert=require('node:assert/strict');
const {requestClosure,runClosureJob}=require('../lib/account-closure');
function fixture(){
 const records=new Map();let deletes=0;
 const ref=path=>({path,collection:name=>db.collection(`${path}/${name}`),id:path.split('/').at(-1),get:async()=>snap(path),delete:async()=>records.delete(path),set:async(data,opt)=>records.set(path,opt?.merge?{...records.get(path),...data}:data)});
 const snap=path=>({exists:records.has(path),id:path.split('/').at(-1),ref:ref(path),data:()=>records.get(path)});
 const db={collection(name){return {doc:id=>ref(`${name}/${id}`),where(field,op,uid){let limit=Infinity;return {limit(n){limit=n;return this},async get(){const docs=[...records.keys()].filter(k=>k.startsWith(name+'/')&&k.split('/').length===name.split('/').length+1&&(op==='array-contains'?records.get(k)[field]?.includes(uid):records.get(k)[field]===uid)).slice(0,limit).map(snap);return {docs,empty:!docs.length}}}}}},async runTransaction(fn){return fn({get:r=>r.get(),set:(r,v,opt)=>r.set(v,opt),delete:r=>r.delete()})},async recursiveDelete(r){deletes++;for(const key of records.keys())if(key===r.path||key.startsWith(r.path+'/'))records.delete(key)}};
 const auth={updateUser:async()=>{},revokeRefreshTokens:async()=>{},deleteUser:async()=>{}};
 return {db,auth,records,get deletes(){return deletes}};
}
test('request is durable and idempotent before auth failure',async()=>{const f=fixture();f.auth.updateUser=async()=>{throw Error('offline')};await assert.rejects(requestClosure({...f,uid:'A',now:1}));assert.equal(f.records.get('account-closure-jobs/A').status,'queued');f.auth.updateUser=async()=>{};await requestClosure({...f,uid:'A',now:2});assert.equal(f.records.get('account-closure-jobs/A').requestedAt,1)});
test('more than 500 records resume after interruption; nested cleanup preserves evidence and tombstone',async()=>{const f=fixture();await requestClosure({...f,uid:'A',now:1});for(let i=0;i<601;i++)f.records.set(`conversations/${i}`,{userId:'A'});f.records.set('conversations/0/messages/1',{text:'synthetic'});f.records.set('conversations/other',{userId:'B'});f.records.set('pulsecheck-team-memberships/m',{userId:'A'});f.records.set('pulsecheck-team-memberships/m/consent-events/e',{actorUserId:'A'});await runClosureJob({...f,uid:'A',now:2,maxPages:2});assert.equal(f.records.get('account-closure-jobs/A').status,'processing');assert.equal(f.records.has('conversations/0/messages/1'),false);for(let i=0;i<25 && f.records.get('account-closure-jobs/A').status!=='retention_review';i++)await runClosureJob({...f,uid:'A',now:3,maxPages:3});assert.equal(f.records.get('account-closure-jobs/A').status,'retention_review');assert.equal(f.records.get('users/A').accountStatus,'closed');assert.equal(f.records.has('conversations/other'),true);assert.equal(f.records.has('pulsecheck-team-memberships/m/consent-events/e'),true);assert.equal(f.records.get('pulsecheck-team-memberships/m').status,'revoked')});

test('closure removes local Polar Google Health tokens OAuth and derived records',async()=>{const f=fixture();await requestClosure({...f,uid:'A',now:1});for(const name of ['pulsecheck-polar-connections','health-provider-connections','pulsecheck-oauth-states'])f.records.set(name+'/credential',{userId:'A',accessToken:'synthetic'});for(const name of ['health-context-source-records','health-context-snapshot-revisions','health-context-assembly-traces','health-context-jobs'])f.records.set(name+'/record',{athleteUserId:'A'});for(let i=0;i<5;i++)await runClosureJob({...f,uid:'A',now:2});assert.equal([...f.records.values()].some(v=>v.accessToken==='synthetic'),false);assert.equal([...f.records.values()].some(v=>v.athleteUserId==='A'),false);});
test('provider sync guard blocks durable closure even without user tombstone',async()=>{const {assertAccountOpen}=require('../lib/account-closure-guard');const f=fixture();f.records.set('account-closure-jobs/A',{status:'queued'});await assert.rejects(assertAccountOpen(f.db,'A'),{code:'account_closing'});await assertAccountOpen(f.db,'B');});

test('provider persistence rechecks closure transactionally after fetch',async()=>{const {accountOpenBatch}=require('../lib/account-closure-guard');const f=fixture();const pending=accountOpenBatch(f.db,'A').set(f.db.collection('health-provider-connections').doc('A_google_health'),{accessToken:'synthetic'});f.records.set('account-closure-jobs/A',{status:'queued'});await assert.rejects(pending.commit(),{code:'account_closing'});assert.equal(f.records.has('health-provider-connections/A_google_health'),false);await accountOpenBatch(f.db,'B').set(f.db.collection('health-provider-connections').doc('B_google_health'),{userId:'B'}).commit();assert.equal(f.records.has('health-provider-connections/B_google_health'),true);});

test('current personal collection inventory is erased without touching other users or retained clinical evidence',async()=>{const f=fixture();await requestClosure({...f,uid:'A',now:1});for(const [name,field] of [['conversationSummaries','userId'],['dailySentimentAnalysis','userId'],['state-snapshots','athleteId'],['conversation-derived-signal-events','athleteId'],['pulsecheck-morning-checkins','athleteUserId'],['mental-exercise-assignments','athleteUserId'],['sim-assignments','athleteUserId'],['pulsecheck-training-plans','athleteId']]){f.records.set(name+'/A',{[field]:'A'});f.records.set(name+'/B',{[field]:'B'});}for(const name of ['mental-check-ins','user-mental-notes']){f.records.set(name+'/A/items/1',{private:'synthetic'});f.records.set(name+'/B/items/1',{private:'other'});}f.records.set('escalation-records/retained',{userId:'A'});for(let i=0;i<5;i++)await runClosureJob({...f,uid:'A',now:2});assert.equal(f.records.get('account-closure-jobs/A').status,'retention_review');for(const name of ['conversationSummaries','dailySentimentAnalysis','state-snapshots','conversation-derived-signal-events','pulsecheck-morning-checkins','mental-exercise-assignments','sim-assignments','pulsecheck-training-plans']){assert.equal(f.records.has(name+'/A'),false);assert.equal(f.records.has(name+'/B'),true);}for(const name of ['mental-check-ins','user-mental-notes']){assert.equal(f.records.has(name+'/A/items/1'),false);assert.equal(f.records.has(name+'/B/items/1'),true);}assert.equal(f.records.has('escalation-records/retained'),true);});

 test('existing queued step retains its original cleanup target', async () => {
  const f=fixture(); await requestClosure({...f,uid:'A',now:1});
  f.records.get('account-closure-jobs/A').step=1;
  f.records.set('mentalNotes/owned',{userId:'A'}); f.records.set('mentalNotes/other',{userId:'B'});
  await runClosureJob({...f,uid:'A',now:2,maxPages:1});
  assert.equal(f.records.has('mentalNotes/owned'),false); assert.equal(f.records.has('mentalNotes/other'),true);
  const {QUERY_TARGETS}=require('../lib/account-closure');
  assert.deepEqual(QUERY_TARGETS[1],['mentalNotes','userId']);
 });
 test('scoped rematerialization adapter blocks delayed direct and batch writes after closure', async () => {
  const f=fixture(); const {accountOpenDatabase}=require('../lib/account-closure-guard');
  const scoped=accountOpenDatabase(f.db,'A'); const ref=scoped.collection('pulsecheck-training-plans').doc('A');
  const pending=scoped.batch().set(ref,{athleteId:'A'});
  f.records.set('account-closure-jobs/A',{status:'queued'});
  await assert.rejects(ref.set({athleteId:'A'}),{code:'account_closing'});
  await assert.rejects(pending.commit(),{code:'account_closing'});
  await assert.rejects(scoped.runTransaction(tx=>tx.set(ref,{athleteId:'A'})),{code:'account_closing'});
  assert.equal(f.records.has('pulsecheck-training-plans/A'),false);
  const other=accountOpenDatabase(f.db,'B'); await other.collection('pulsecheck-training-plans').doc('B').set({athleteId:'B'});
  assert.equal(f.records.get('pulsecheck-training-plans/B').athleteId,'B');
 });

test('communication closure drains personal texts and queued jobs, preserves other recipients and consent evidence',async()=>{
 const f=fixture(),root='pulsecheck-restricted-questionnaire-submissions/coach-communications-v1';
 await requestClosure({...f,uid:'A',now:1});
 f.records.set(`${root}/contacts/team_A`,{teamId:'team',athleteId:'A',phone:'synthetic'});
 f.records.set(`${root}/contacts/team_B`,{teamId:'team',athleteId:'B',phone:'other'});
 f.records.set(`${root}/routes/a`,{teamId:'team',athleteId:'A'});
 f.records.set(`${root}/jobs/a`,{teamId:'team',athleteId:'A',uid:'coach',batchId:'batch',state:'queued',text:'synthetic'});
 f.records.set(`${root}/jobs/b`,{teamId:'team',athleteId:'B',uid:'coach',batchId:'batch',state:'queued',text:'other'});
 f.records.set(`${root}/teams/team/messages/a`,{athleteId:'A',text:'synthetic',senderId:'coach'});
 f.records.set(`${root}/teams/team/messages/incoming`,{athleteId:'A',text:'synthetic'});
 f.records.set(`${root}/teams/team/messages/b`,{athleteId:'B',text:'other',senderId:'coach'});
 f.records.set(`${root}/teams/team/batches/batch`,{uid:'coach',athleteIds:['A','B'],states:{a:'queued',b:'queued'},fingerprint:'old'});
 f.records.set(`${root}/teams/team/send-intents/intent`,{batchId:'batch'});
 f.records.set(`${root}/consent-events/evidence`,{uid:'A',accepted:true});
 const suppression='pulsecheck-restricted-questionnaire-submissions/coach-surveys-v1/sms-suppressions/hash';
 f.records.set(suppression,{suppressed:true});
 for(let i=0;i<30&&f.records.get('account-closure-jobs/A').status!=='retention_review';i++) await runClosureJob({...f,uid:'A',now:2});
 assert.equal(f.records.get('account-closure-jobs/A').status,'retention_review');
 for(const p of ['contacts/team_A','routes/a','jobs/a','teams/team/messages/a','teams/team/messages/incoming','teams/team/send-intents/intent'])assert.equal(f.records.has(`${root}/${p}`),false,p);
 for(const p of ['contacts/team_B','jobs/b','teams/team/messages/b','consent-events/evidence'])assert.equal(f.records.has(`${root}/${p}`),true,p);
 assert.equal(f.records.has(suppression),true);
 assert.deepEqual(f.records.get(`${root}/teams/team/batches/batch`).athleteIds,['B']);
 assert.deepEqual(f.records.get(`${root}/teams/team/batches/batch`).states,{b:'queued'});
 assert.equal(f.records.get(`${root}/teams/team/batches/batch`).fingerprint,undefined);
});
test('coach closure removes their queued content and group metadata without erasing athlete preferences',async()=>{
 const f=fixture(),root='pulsecheck-restricted-questionnaire-submissions/coach-communications-v1';await requestClosure({...f,uid:'coach',now:1});
 f.records.set(`${root}/contacts/team_A`,{teamId:'team',athleteId:'A'});
 f.records.set(`${root}/jobs/job`,{teamId:'team',athleteId:'A',uid:'coach',batchId:'batch',state:'queued'});
 f.records.set(`${root}/teams/team/messages/job`,{athleteId:'A',senderId:'coach',text:'synthetic'});
 f.records.set(`${root}/teams/team/batches/batch`,{uid:'coach',athleteIds:['A'],states:{job:'queued'}});
 f.records.set(`${root}/teams/team/send-intents/intent`,{batchId:'batch'});
 for(let i=0;i<12&&f.records.get('account-closure-jobs/coach').status!=='retention_review';i++)await runClosureJob({...f,uid:'coach',now:2});
 assert.equal(f.records.get('account-closure-jobs/coach').status,'retention_review');
 for(const p of ['jobs/job','teams/team/messages/job','teams/team/batches/batch','teams/team/send-intents/intent'])assert.equal(f.records.has(`${root}/${p}`),false);
 assert.equal(f.records.has(`${root}/contacts/team_A`),true);
});
test('communication cleanup uses bounded pages and resumes before deleting its contact anchor',async()=>{
 const f=fixture(),root='pulsecheck-restricted-questionnaire-submissions/coach-communications-v1';
 const {eraseAccountCommunicationBatch}=require('../lib/communication-retention');
 f.records.set(`${root}/contacts/team_A`,{teamId:'team',athleteId:'A'});
 for(let i=0;i<121;i++)f.records.set(`${root}/teams/team/messages/m${i}`,{athleteId:'A',text:'synthetic'});
 f.records.set(`${root}/teams/team/messages/other`,{athleteId:'B',text:'other'});
 assert.equal((await eraseAccountCommunicationBatch({db:f.db,uid:'A'})).pending,true);
 assert.equal([...f.records.keys()].filter(p=>p.includes('/messages/')&&f.records.get(p).athleteId==='A').length,71);
 assert.equal(f.records.has(`${root}/contacts/team_A`),true);
 for(let i=0;i<5;i++)await eraseAccountCommunicationBatch({db:f.db,uid:'A'});
 assert.equal((await eraseAccountCommunicationBatch({db:f.db,uid:'A'})).pending,false);
 assert.equal(f.records.has(`${root}/contacts/team_A`),false);assert.equal(f.records.has(`${root}/teams/team/messages/other`),true);
});
