import test from 'node:test';
import assert from 'node:assert/strict';
import { getExpectedTwilioSignature } from 'twilio';
import { canCommunicate, consentAllows, digest, loadInbox, receiveSms, rootFor, transportReady, validateSend } from '../../src/lib/coach-communications/service';
import { enqueueBatch, processJob, processQueue, recordDelivery, verifyStatusWebhook, sendQueuedSms } from '../../src/lib/coach-communications/queue';
import { ownPreferences, pauseContact, setOwnConsent, recentPhoneProof } from '../../src/lib/coach-communications/consent';
import { verifySmsWebhook } from '../../src/lib/coachSurveys/smsOptOut';
import { COLLECTION, ROOT, tokenDigest } from '../../src/lib/coachSurveys/service';
class MemoryDB {
  data = new Map<string, any>();
  queue = Promise.resolve();
  collection(path: string): any {
    const db = this;
    const query = (filters: any[] = [], sort?: string, max = Infinity): any => ({
      doc: (id: string) => db.doc(`${path}/${id}`),
      where: (key: string, op: string, value: unknown) => query([...filters, [key,value]], sort,max),
      orderBy: (key: string) => query(filters,key,max), limit: (n: number) => query(filters,sort,n),
      get: async () => ({ docs: [...db.data.entries()].filter(([p,d]) => p.startsWith(path+'/') && p.split('/').length === path.split('/').length+1 && filters.every(([k,v])=>d[k]===v)).sort((a,b)=>sort?b[1][sort]-a[1][sort]:0).slice(0,max).map(([p])=>db.snapshot(p)) }),
    }); return query();
  }
  snapshot(path: string) { return { id:path.split('/').pop(), exists:this.data.has(path), data:()=>this.data.get(path) }; }
  doc(path: string): any { return { path, id:path.split('/').pop(), collection:(name: string)=>this.collection(path+'/'+name), get:async()=>this.snapshot(path), update:async(value:any)=>this.data.set(path,{...this.data.get(path),...value}) }; }
  async runTransaction(fn: any) {
    const task = this.queue.then(async()=>{
      const writes: any[]=[];
      const result=await fn({get:async(ref:any)=>this.snapshot(ref.path),create:(ref:any,value:any)=>{assert.ok(!this.data.has(ref.path));writes.push([ref.path,value]);},set:(ref:any,value:any,opts:any)=>writes.push([ref.path,opts?.merge?{...this.data.get(ref.path),...value}:value])});
      for(const [p,v] of writes)this.data.set(p,v); return result;
    }); this.queue=task.then(()=>{},()=>{}); return task;
  }
}
function fixture() {
  const db=new MemoryDB();
  for (const uid of ['coach','a','b']) db.data.set('users/'+uid,{displayName:'Synthetic'});
  db.data.set('pulsecheck-organizations/org',{status:'active'});
  db.data.set('pulsecheck-teams/team',{status:'active',organizationId:'org'});
  db.data.set('pulsecheck-team-memberships/team_coach',{userId:'coach',teamId:'team',organizationId:'org',role:'coach',status:'active',staffCapabilities:['coaching']});
  for(const [i,id] of ['a','b'].entries()) {
    db.data.set(`pulsecheck-team-memberships/team_${id}`,{userId:id,teamId:'team',organizationId:'org',role:'athlete',status:'active'});
    db.data.set(`${COLLECTION}/coach-communications-v1/contacts/team_${id}`,{teamId:'team',athleteId:id,displayName:'Synthetic '+id,phone:`+1202555010${i}`,enabled:true,consent:{purpose:'team-communications',status:'granted',grantedAtMs:1,evidenceId:'synthetic'}});
  }return db;
}
const payload={requestId:'request-1',athleteIds:['a','b'],text:'Install the app: https://example.test/app'};
const providerId='SM'+'a'.repeat(32);
const sender=async()=>({state:'accepted' as const,providerId});
const jobs=(db:MemoryDB)=>[...db.data.entries()].filter(([p])=>p.includes('/jobs/')).map(([p,j])=>({...j,path:p}));
process.env.TWILIO_FROM_NUMBER='+12025559999';
test('strict capabilities, explicit consent and payload validation',()=>{
 assert.equal(canCommunicate({role:'coach',staffCapabilities:[]}),false);assert.equal(canCommunicate({role:'performance-staff'}),false);assert.equal(canCommunicate({role:'coach'}),true);
 assert.equal(consentAllows({phone:'+12025550100',notificationPreferences:{sms:true},smsConsentAt:1},'team','a'),false);
 for(const body of [{...payload,athleteIds:['a','a']},{...payload,text:'x'.repeat(1201)},{...payload,athleteIds:Array.from({length:26},(_,i)=>String(i))}])assert.throws(()=>validateSend(body));
});
test('enqueue is durable, atomic and makes no provider request',async()=>{
 const db=fixture(),result=await enqueueBatch(db as any,'coach','team',payload);
 assert.equal(jobs(db).length,2);assert.ok(jobs(db).every(j=>j.state==='queued'));
 const inbox=await loadInbox(db as any,'coach','team','prod');assert.equal(inbox.batches[0].id,result.batchId);assert.deepEqual(inbox.batches[0].counts,{queued:2});
});
test('concurrent enqueue and browser reload with a new request ID reuse the group',async()=>{
 const db=fixture();const result=await Promise.all([enqueueBatch(db as any,'coach','team',payload),enqueueBatch(db as any,'coach','team',{...payload,requestId:'new-after-reload'})]);
 assert.equal(result[0].batchId,result[1].batchId);assert.equal(jobs(db).length,2);
 await assert.rejects(enqueueBatch(db as any,'coach','team',{...payload,text:'Changed'}),/different message/);
});
test('concurrent workers claim each recipient only once',async()=>{
 const db=fixture();await enqueueBatch(db as any,'coach','team',payload);let calls=0;
 const send=async()=>{calls++;return sender();};await Promise.all([processQueue(db as any,send),processQueue(db as any,send)]);
 assert.equal(calls,2);assert.ok(jobs(db).every(j=>j.state==='accepted'));
});
test('unknown sends are held across retries and repeated intent after ten minutes',async()=>{
 const db=fixture();await enqueueBatch(db as any,'coach','team',payload);let calls=0;
 await processQueue(db as any,async()=>{calls++;throw Error('network');});await processQueue(db as any,sender);
 assert.ok(jobs(db).every(j=>j.state==='unknown'));assert.equal(calls,2);
 await enqueueBatch(db as any,'coach','team',{...payload,requestId:'again'},Date.now()+700000);assert.equal(jobs(db).length,2);
});
test('expired worker claims become unknown and never return to queued',async()=>{
 const db=fixture();await enqueueBatch(db as any,'coach','team',payload);
 for(const j of jobs(db)){db.data.set(j.path,{...j,state:'sending',claimedAtMs:Date.now()-180000});}
 let calls=0;await processQueue(db as any,async()=>{calls++;return sender();});assert.equal(calls,0);assert.ok(jobs(db).every(j=>j.state==='unknown'));
});
test('cross-team and restricted-roster access fail before enqueue',async()=>{
 const db=fixture();await assert.rejects(enqueueBatch(db as any,'stranger','team',payload));
 db.data.get('pulsecheck-team-memberships/team_coach').rosterVisibilityScope='assigned';db.data.get('pulsecheck-team-memberships/team_coach').allowedAthleteIds=['a'];
 await assert.rejects(enqueueBatch(db as any,'coach','team',payload),/consent|roster/);assert.equal(jobs(db).length,0);
});
test('revocation, contact change and STOP after enqueue block queued jobs',async()=>{
 for(const change of ['stop','phone','revoked']){
  const db=fixture();await enqueueBatch(db as any,'coach','team',payload);
  if(change==='stop')await receiveSms(db as any,{From:'+12025550100',To:process.env.TWILIO_FROM_NUMBER!,MessageSid:'SM'+'b'.repeat(32),Body:'STOP'});
  if(change==='phone')db.data.get(`${COLLECTION}/coach-communications-v1/contacts/team_a`).phone='+12025550199';
  if(change==='revoked')db.data.get('pulsecheck-team-memberships/team_coach').status='removed';
  let calls=0;await processQueue(db as any,async()=>{calls++;return sender();});assert.equal(calls,change==='revoked'?0:1);
 }
});
test('consent is rechecked between recipients',async()=>{
 const db=fixture();await enqueueBatch(db as any,'coach','team',payload);let calls=0;
 await processQueue(db as any,async()=>{calls++;for(const num of ['+12025550100','+12025550101'])db.data.set(`${COLLECTION}/${ROOT}/sms-suppressions/${tokenDigest(num)}`,{suppressed:true});return sender();});assert.equal(calls,1);
});
test('rate limit rejects a sixth distinct group and preserves existing groups',async()=>{
 const db=fixture(),now=Date.now();for(let i=0;i<5;i++)await enqueueBatch(db as any,'coach','team',{...payload,requestId:'r'+i,text:'message '+i},now);
 await assert.rejects(enqueueBatch(db as any,'coach','team',{...payload,requestId:'six',text:'six'},now),/Wait a minute/);assert.equal(jobs(db).length,10);
});
test('shared numbers and cross-team reply routes fail before creating jobs',async()=>{
 const db=fixture();db.data.get(`${COLLECTION}/coach-communications-v1/contacts/team_b`).phone='+12025550100';await assert.rejects(enqueueBatch(db as any,'coach','team',payload),/share/);assert.equal(jobs(db).length,0);
 const second=fixture();second.data.set(rootFor(second as any).collection('routes').doc(digest([process.env.TWILIO_FROM_NUMBER,'+12025550100'])).path,{teamId:'other',athleteId:'a'});await assert.rejects(enqueueBatch(second as any,'coach','team',payload),/another team/);
});
test('delivery callback can arrive before provider response and cannot regress delivered',async()=>{
 const db=fixture();await enqueueBatch(db as any,'coach','team',{...payload,athleteIds:['a']});const job=jobs(db)[0];
 await processJob(db as any,job.id,async()=>{await recordDelivery(db as any,job.id,{To:'+12025550100',From:process.env.TWILIO_FROM_NUMBER!,MessageSid:providerId,MessageStatus:'delivered'});return sender();});
 await recordDelivery(db as any,job.id,{To:'+12025550100',From:process.env.TWILIO_FROM_NUMBER!,MessageSid:providerId,MessageStatus:'sent'});assert.equal(jobs(db)[0].state,'delivered');
 assert.deepEqual((await loadInbox(db as any,'coach','team','prod')).batches[0].counts,{delivered:1});
});
test('callback with wrong phone or mismatched SID cannot attach delivery',async()=>{
 const db=fixture();await enqueueBatch(db as any,'coach','team',{...payload,athleteIds:['a']});await processQueue(db as any,sender);const j=jobs(db)[0];
 await recordDelivery(db as any,j.id,{To:'+12025550199',From:process.env.TWILIO_FROM_NUMBER!,MessageSid:providerId,MessageStatus:'delivered'});
 await recordDelivery(db as any,j.id,{To:'+12025550100',From:process.env.TWILIO_FROM_NUMBER!,MessageSid:'SM'+'c'.repeat(32),MessageStatus:'delivered'});assert.equal(jobs(db)[0].state,'accepted');
});
test('signed status callbacks bind URL, job, account and fields',()=>{
 process.env.COACH_COMMUNICATIONS_STATUS_WEBHOOK_URL='https://example.test/status';process.env.TWILIO_AUTH_TOKEN='synthetic';process.env.TWILIO_ACCOUNT_SID='ACsynthetic';
 const form={AccountSid:'ACsynthetic',To:'+12025550100',From:process.env.TWILIO_FROM_NUMBER!,MessageSid:providerId,MessageStatus:'delivered'};
 const signature=getExpectedTwilioSignature('synthetic','https://example.test/status?job=job-1',form);
 assert.equal(verifyStatusWebhook('job-1',form,signature),true);assert.equal(verifyStatusWebhook('job-2',form,signature),false);assert.equal(verifyStatusWebhook('job-1',{...form,MessageStatus:'failed'},signature),false);
});
test('incoming reply dedupe and visibility exclude other athletes',async()=>{
 const db=fixture();await enqueueBatch(db as any,'coach','team',payload);await processQueue(db as any,sender);
 const form={From:'+12025550100',To:process.env.TWILIO_FROM_NUMBER!,MessageSid:'SM'+'d'.repeat(32),Body:'Thanks!'};await receiveSms(db as any,form);await receiveSms(db as any,form);
 const inbox=await loadInbox(db as any,'coach','team','prod');assert.equal(inbox.messages.filter(m=>m.direction==='incoming').length,1);assert.ok(!JSON.stringify(inbox).includes('+1202555'));
 db.data.get('pulsecheck-team-memberships/team_coach').rosterVisibilityScope='assigned';db.data.get('pulsecheck-team-memberships/team_coach').allowedAthleteIds=['b'];const filtered=await loadInbox(db as any,'coach','team','prod');assert.ok(filtered.messages.every(m=>m.athleteId==='b'));assert.equal(filtered.batches.length,0);
});
test('athlete self-consent requires trusted phone proof; coaches cannot grant it',async()=>{
 const db=fixture();await assert.rejects(setOwnConsent(db as any,'coach','team',true,'+12025550100'),/athlete/);await assert.rejects(setOwnConsent(db as any,'a','team',true),/Verify/);
 await setOwnConsent(db as any,'a','team',false);assert.equal((await ownPreferences(db as any,'a','team')).enabled,false);
 await setOwnConsent(db as any,'a','team',true,'+12025550100');assert.equal((await ownPreferences(db as any,'a','team')).enabled,true);
 assert.ok([...db.data.keys()].some(k=>k.includes('/consent-events/')));
});
test('coach pause blocks queued work; START never removes STOP',async()=>{
 const db=fixture();await enqueueBatch(db as any,'coach','team',payload);await pauseContact(db as any,'coach','team','a');let calls=0;await processQueue(db as any,async()=>{calls++;return sender();});assert.equal(calls,1);
 const f={From:'+12025550100',To:process.env.TWILIO_FROM_NUMBER!,MessageSid:'SM'+'e'.repeat(32),Body:'STOP'};await receiveSms(db as any,f);await receiveSms(db as any,{...f,MessageSid:'SM'+'f'.repeat(32),Body:'START'});await assert.rejects(setOwnConsent(db as any,'a','team',true,'+12025550100'),/STOP/);
});
test('provider transport includes callback; uncertain errors do not become retryable failures',async()=>{
 const original=globalThis.fetch;try{
  globalThis.fetch=(async(_url:any,options:any)=>{assert.ok(String(options.body).includes('StatusCallback='));return{ok:true,status:201,json:async()=>({sid:providerId})};}) as any;
  assert.equal((await sendQueuedSms({to:'+12025550100',body:'Synthetic',jobId:'job-1'})).state,'accepted');
  globalThis.fetch=(async()=>{throw Error('timeout');}) as any;assert.equal((await sendQueuedSms({to:'+12025550100',body:'Synthetic',jobId:'job-1'})).state,'unknown');
 }finally{globalThis.fetch=original;}
});
test('transport remains off until worker, webhook and environment gates agree',()=>{
 process.env.COACH_COMMUNICATIONS_SMS_ENABLED='true';process.env.COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED='true';process.env.COACH_COMMUNICATIONS_FIREBASE_MODE='prod';process.env.COACH_COMMUNICATIONS_SMS_WEBHOOK_URL='https://example.test/incoming';delete process.env.COACH_COMMUNICATIONS_WORKER_ENABLED;
 assert.equal(transportReady('prod'),false);process.env.COACH_COMMUNICATIONS_WORKER_ENABLED='true';assert.equal(transportReady('prod'),true);assert.equal(transportReady('dev'),false);
});

test('phone consent proof rejects stale, email-only, mismatched and disabled identities',()=>{
 const now=Date.now(),token={uid:'a',firebase:{sign_in_provider:'phone'},auth_time:now/1000,phone_number:'+12025550100'},account={uid:'a',phoneNumber:'+12025550100',providerData:[{providerId:'phone'}]};
 assert.equal(recentPhoneProof(token,account,'a',now),'+12025550100');
 for(const bad of [{...token,auth_time:now/1000-601},{...token,firebase:{sign_in_provider:'password'}},{...token,uid:'b'}])assert.throws(()=>recentPhoneProof(bad,account,'a',now));
 assert.throws(()=>recentPhoneProof(token,{...account,disabled:true},'a',now));assert.throws(()=>recentPhoneProof(token,{...account,phoneNumber:'+12025550101'},'a',now));
});
test('closure tombstones stop queued sends, inbox visibility, incoming storage and consent changes',async()=>{
 for(const who of ['coach','a']) {
  const db=fixture();await enqueueBatch(db as any,'coach','team',payload);
  db.data.set('account-closure-jobs/'+who,{status:'queued'});
  let calls=0;await processQueue(db as any,async()=>{calls++;return sender();});assert.equal(calls,who==='coach'?0:1);
  if(who==='coach') await assert.rejects(loadInbox(db as any,'coach','team','prod'),/closing/);
  else {
   assert.equal((await loadInbox(db as any,'coach','team','prod')).recipients.some(r=>r.id==='a'),false);
   await assert.rejects(setOwnConsent(db as any,'a','team',false),/closing/);
   db.data.set(`${COLLECTION}/coach-communications-v1/routes/${digest([process.env.TWILIO_FROM_NUMBER,'+12025550100'])}`,{teamId:'team',athleteId:'a'});
   const sid='SM'+'c'.repeat(32);await receiveSms(db as any,{From:'+12025550100',To:process.env.TWILIO_FROM_NUMBER!,MessageSid:sid,Body:'Private synthetic reply'});
   assert.equal(db.data.has(`${COLLECTION}/coach-communications-v1/teams/team/messages/${sid}`),false);
  }
 }
});

test('closed and legacy-deleted recipients drain out of the bounded queue without starving healthy recipients',async()=>{
 for(const mode of ['closure','missing-profile']) {
  const db=fixture();
  for(let i=0;i<3;i++)await enqueueBatch(db as any,'coach','team',{requestId:'closed-'+i,athleteIds:['a'],text:'Synthetic '+i});
  await enqueueBatch(db as any,'coach','team',{requestId:'healthy',athleteIds:['b'],text:'Healthy synthetic'});
  if(mode==='closure')db.data.set('account-closure-jobs/a',{status:'queued'});else db.data.delete('users/a');
  const destinations:string[]=[];const send=async({to}:any)=>{destinations.push(to);return sender();};
  await processQueue(db as any,send);assert.equal(destinations.length,0);assert.equal(jobs(db).filter(j=>j.state==='blocked').length,3);
  await processQueue(db as any,send);assert.deepEqual(destinations,['+12025550101']);assert.equal(jobs(db).filter(j=>j.state==='queued').length,0);
 }
});
test('orphan queued jobs become blocked without recreating deleted conversation documents',async()=>{
 for(const removed of ['message','batch','both']) {
  const db=fixture(),group=await enqueueBatch(db as any,'coach','team',{...payload,athleteIds:['a']}),job=jobs(db)[0];
  const messagePath=`${COLLECTION}/coach-communications-v1/teams/team/messages/${job.id}`,batchPath=`${COLLECTION}/coach-communications-v1/teams/team/batches/${group.batchId}`;
  if(removed!=='batch')db.data.delete(messagePath);if(removed!=='message')db.data.delete(batchPath);
  let calls=0;await processQueue(db as any,async()=>{calls++;return sender();});
  assert.equal(calls,0);assert.equal(jobs(db)[0].state,'blocked');
  if(removed!=='batch')assert.equal(db.data.has(messagePath),false);if(removed!=='message')assert.equal(db.data.has(batchPath),false);
  await processQueue(db as any,async()=>{calls++;return sender();});assert.equal(calls,0);
 }
});

test('stale sending jobs for closed accounts free recovery slots without resending or recreating content',async()=>{
 const db=fixture(),now=Date.now(),root=`${COLLECTION}/coach-communications-v1`;
 // Synthetic claimed jobs represent sends whose provider outcome is unknown.
 for(let i=0;i<6;i++)db.data.set(`${root}/jobs/stale-${i}`,{id:`stale-${i}`,uid:'coach',athleteId:i<5?'a':'b',teamId:'team',batchId:`batch-${i}`,state:'sending',claimedAtMs:now-180000,phoneHash:digest(i<5?'+12025550100':'+12025550101'),sender:process.env.TWILIO_FROM_NUMBER,text:'Synthetic'});
 db.data.set('account-closure-jobs/a',{status:'queued'});
 let calls=0;const send=async()=>{calls++;return sender();};
 await processQueue(db as any,send,now);
 assert.equal(jobs(db).filter(j=>j.state==='unknown').length,5);assert.equal(jobs(db).filter(j=>j.state==='sending').length,1);
 await processQueue(db as any,send,now);
 assert.ok(jobs(db).every(j=>j.state==='unknown'));assert.equal(calls,0);
 assert.equal([...db.data.keys()].some(p=>p.includes('/messages/')||p.includes('/batches/')),false);
 await processQueue(db as any,send,now);assert.equal(calls,0);
});
