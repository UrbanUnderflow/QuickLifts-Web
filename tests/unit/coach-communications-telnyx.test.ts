import {Readable} from 'node:stream';
import webhookHandler from '../../src/pages/api/coach/communications/telnyx-webhook';
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'crypto';
import {providerConfigured,smsSender,verifyTelnyxEvent,telnyxIncomingForm,telnyxDeliveryForm,sendTelnyxSms} from '../../src/lib/coach-communications/provider';
import {transportReady,receiveSms} from '../../src/lib/coach-communications/service';
import {enqueueBatch,processJob,recordDelivery} from '../../src/lib/coach-communications/queue';
import {COLLECTION,ROOT,tokenDigest} from '../../src/lib/coachSurveys/service';
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
const keys = generateKeyPairSync('ed25519');
const profile = '4001a1ad-6b2f-48b5-a63c-217fa1ae9d74';
const message = '40385f64-5717-4562-b3fc-2c963f66afa6';
const eventId = '86f58db9-0fe3-4adc-9d1f-46e66e6e9323';
const jobId = 'a'.repeat(64);
const endpoint = 'https://example.test/api/coach/communications/telnyx-webhook';
const now = 1793910000000;
function settings() {
  process.env.COACH_COMMUNICATIONS_SMS_PROVIDER = 'telnyx';
  process.env.TELNYX_FROM_NUMBER = '+12025559999';
  process.env.TELNYX_MESSAGING_PROFILE_ID = profile;
  process.env.TELNYX_API_KEY = 'synthetic-test-key';
  process.env.TELNYX_PUBLIC_KEY = keys.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64');
  process.env.COACH_COMMUNICATIONS_TELNYX_WEBHOOK_URL = endpoint;
  process.env.COACH_COMMUNICATIONS_FIREBASE_MODE = 'prod';
  for (const key of ['SMS_ENABLED','SMS_WEBHOOK_ENABLED','WORKER_ENABLED']) process.env[`COACH_COMMUNICATIONS_${key}`] = 'true';
}
function event(type='message.received') {
  return {id:eventId,event_type:type,payload:{id:message,type:'SMS',direction:type==='message.received'?'inbound':'outbound',messaging_profile_id:profile,from:{phone_number:type==='message.received'?'+12025550100':'+12025559999'},to:[{phone_number:type==='message.received'?'+12025559999':'+12025550100',status:'delivered'}],text:'STOP',webhook_url:`${endpoint}?job=${jobId}`}};
}
function signed(value:any, timestamp=String(now/1000)) {
  const raw=Buffer.from(JSON.stringify({data:value},null,2));
  return {raw,timestamp,signature:sign(null,Buffer.concat([Buffer.from(timestamp+'|'),raw]),keys.privateKey).toString('base64')};
}
test('Telnyx readiness requires sender, profile, public key, API key and explicit gates',()=>{
 settings();assert.equal(providerConfigured(),true);assert.equal(transportReady('prod'),true);assert.equal(transportReady('dev'),false);
 for(const key of ['TELNYX_API_KEY','TELNYX_FROM_NUMBER','TELNYX_PUBLIC_KEY','TELNYX_MESSAGING_PROFILE_ID','COACH_COMMUNICATIONS_TELNYX_WEBHOOK_URL']) {const value=process.env[key];delete process.env[key];assert.equal(providerConfigured(),false,key);process.env[key]=value;}
 process.env.COACH_COMMUNICATIONS_SMS_PROVIDER='typo';assert.equal(providerConfigured(),false);assert.equal(smsSender(),'');settings();
});
test('raw Ed25519 signature rejects tampering, reserialization, stale/future and wrong profile events',()=>{
 settings();const s=signed(event());assert.equal(verifyTelnyxEvent(s.raw,s.signature,s.timestamp,now)?.id,eventId);
 assert.equal(verifyTelnyxEvent(Buffer.from(JSON.stringify(JSON.parse(s.raw.toString()))),s.signature,s.timestamp,now),null);
 assert.equal(verifyTelnyxEvent(Buffer.concat([s.raw,Buffer.from(' ')]),s.signature,s.timestamp,now),null);
 assert.equal(verifyTelnyxEvent(s.raw,s.signature,s.timestamp,now+301000),null);
 assert.equal(verifyTelnyxEvent(s.raw,s.signature,s.timestamp,now-301000),null);
 assert.equal(verifyTelnyxEvent(s.raw,[s.signature],s.timestamp,now),null);
 for(const mutate of [(e:any)=>e.payload.messaging_profile_id=message,(e:any)=>e.payload.to.push(e.payload.to[0]),(e:any)=>e.payload.id='../bad',(e:any)=>e.payload.type='MMS']) {const e=event();mutate(e);const bad=signed(e);assert.equal(verifyTelnyxEvent(bad.raw,bad.signature,bad.timestamp,now),null);}
});
test('incoming STOP is namespaced, idempotent and suppresses existing contacts; START does not clear it',async()=>{
 settings();const db=fixture();const e=event();const form=telnyxIncomingForm(e)!;
 assert.equal(form.MessageSid,`telnyx_${message}`);await receiveSms(db as any,form);await receiveSms(db as any,form);
 const suppression=db.data.get(`${COLLECTION}/${ROOT}/sms-suppressions/${tokenDigest(form.From)}`);assert.equal(suppression.suppressed,true);
 await receiveSms(db as any,{...form,Body:'START',MessageSid:`telnyx_${eventId}`});assert.equal(db.data.get(`${COLLECTION}/${ROOT}/sms-suppressions/${tokenDigest(form.From)}`).suppressed,true);
 e.payload.to[0].phone_number='+12025559998';assert.equal(telnyxIncomingForm(e),null);
});
test('signed outbound URL, sender and direction bind delivery to one job',()=>{
 settings();const e=event('message.finalized');const form=telnyxDeliveryForm(e,jobId)!;assert.equal(form.MessageStatus,'delivered');assert.equal(form.MessageSid,`telnyx_${message}`);
 assert.equal(telnyxDeliveryForm(e,'b'.repeat(64)),null);
 e.payload.from.phone_number='+12025559998';assert.equal(telnyxDeliveryForm(e,jobId),null);
 const unknown=event('message.finalized');unknown.payload.to[0].status='unrecognized';assert.equal(telnyxDeliveryForm(unknown,jobId),null);
 const sent=event('message.sent');sent.payload.to[0].status='sent';assert.equal(telnyxDeliveryForm(sent,jobId)?.MessageStatus,'sent');
});
test('Telnyx send uses fixed host, per-job idempotency and keeps ambiguous results unknown',async()=>{
 settings();const original=globalThis.fetch;let calls=0;
 try {
  globalThis.fetch=(async(url:any,init:any)=>{calls++;assert.equal(url,'https://api.telnyx.com/v2/messages');assert.equal(init.headers['Idempotency-Key'],jobId);const body=JSON.parse(init.body);assert.equal(body.webhook_url,`${endpoint}?job=${jobId}`);assert.equal(body.use_profile_webhooks,false);assert.equal(body.messaging_profile_id,profile);return new Response(JSON.stringify({data:{...event('message.sent').payload,id:message}}),{status:200});}) as any;
  assert.deepEqual(await sendTelnyxSms({to:'+12025550100',body:'Synthetic only',jobId}),{state:'accepted',providerId:`telnyx_${message}`});assert.equal(calls,1);
  for(const status of [409,408,500,503,200]) {globalThis.fetch=(async()=>new Response('{}',{status})) as any;assert.equal((await sendTelnyxSms({to:'+12025550100',body:'Synthetic only',jobId})).state,'unknown');}
  globalThis.fetch=(async()=>{throw new Error('lost response');}) as any;assert.equal((await sendTelnyxSms({to:'+12025550100',body:'Synthetic only',jobId})).state,'unknown');
  globalThis.fetch=(async()=>new Response('{}',{status:400})) as any;assert.equal((await sendTelnyxSms({to:'+12025550100',body:'Synthetic only',jobId})).state,'failed');
 }finally{globalThis.fetch=original;}
});
test('provider migration never sends an old job through Telnyx and callbacks cannot cross providers',async()=>{
 settings();process.env.COACH_COMMUNICATIONS_SMS_PROVIDER='twilio';process.env.TWILIO_FROM_NUMBER='+12025559999';const db=fixture();
 await enqueueBatch(db as any,'coach','team',{requestId:'migration',athleteIds:['a'],text:'Synthetic'});
 const [path,job]=[...db.data.entries()].find(([p])=>p.includes('/jobs/'))!;delete job.provider; // legacy stored record
 process.env.COACH_COMMUNICATIONS_SMS_PROVIDER='telnyx';let calls=0;await processJob(db as any,job.id,async()=>{calls++;return {state:'accepted'};});assert.equal(calls,0);assert.equal(db.data.get(path).state,'blocked');
 db.data.set(path,{...job,state:'sending',provider:'telnyx'});
 const form={From:job.sender,To:'+12025550100',MessageSid:`telnyx_${message}`,MessageStatus:'delivered'};
 await recordDelivery(db as any,job.id,form);assert.equal(db.data.get(path).state,'sending');
 await recordDelivery(db as any,job.id,form,'telnyx');assert.equal(db.data.get(path).state,'delivered');
 await recordDelivery(db as any,job.id,{...form,MessageStatus:'sent'},'telnyx');assert.equal(db.data.get(path).state,'delivered');
});

test('HTTP webhook bounds raw input, rejects invalid signatures and acknowledges unrelated signed events without DB access',async()=>{
 settings();
 async function request(raw:Buffer,headers:any={},method='POST') {
  const req=Readable.from([raw]) as any;req.method=method;req.headers={'content-type':'application/json',...headers};req.query={};
  const res:any={code:0,setHeader(){},status(code:number){this.code=code;return this;},end(){return this;}};
  await webhookHandler(req,res);return res.code;
 }
 assert.equal(await request(Buffer.alloc(32769)),413);
 assert.equal(await request(Buffer.from('{}')),403);
 assert.equal(await request(Buffer.from('{}'),{'content-type':'text/plain'}),415);
 assert.equal(await request(Buffer.from('{}'),{},'GET'),405);
 const e=event('unrelated.event'),s=signed(e,String(Math.floor(Date.now()/1000)));
 assert.equal(await request(s.raw,{'telnyx-signature-ed25519':s.signature,'telnyx-timestamp':s.timestamp}),204);
 process.env.COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED='false';assert.equal(await request(s.raw),503);settings();
});

test('Telnyx queue accepts once, routes replies privately and STOP blocks the next attempt',async()=>{
 settings();const db=fixture();await enqueueBatch(db as any,'coach','team',{requestId:'telnyx-roundtrip',athleteIds:['a'],text:'Synthetic only'});
 const [path,job]=[...db.data.entries()].find(([p])=>p.includes('/jobs/'))!;assert.equal(job.provider,'telnyx');
 let calls=0;const transport=async()=>{calls++;return {state:'accepted' as const,providerId:`telnyx_${message}`};};
 await Promise.all([processJob(db as any,job.id,transport),processJob(db as any,job.id,transport)]);assert.equal(calls,1);assert.equal(db.data.get(path).state,'accepted');
 const reply=telnyxIncomingForm(event())!;reply.Body='Synthetic reply';await receiveSms(db as any,reply);await receiveSms(db as any,reply);
 const replies=[...db.data.values()].filter(v=>v.direction==='incoming');assert.equal(replies.length,1);assert.equal(replies[0].athleteId,'a');assert.equal(replies[0].text,'Synthetic reply');
 await receiveSms(db as any,{...reply,MessageSid:`telnyx_${eventId}`,Body:'STOP'});
 await assert.rejects(enqueueBatch(db as any,'coach','team',{requestId:'blocked-after-stop',athleteIds:['a'],text:'Synthetic next message'}));assert.equal(calls,1);
});
