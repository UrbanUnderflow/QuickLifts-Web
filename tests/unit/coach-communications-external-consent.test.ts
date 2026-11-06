import test from 'node:test';
import assert from 'node:assert/strict';
import {consentAllows, resolveTextContact, eligible, receiveSms, digest} from '../../src/lib/coach-communications/service';
import {enqueueBatch,processQueue} from '../../src/lib/coach-communications/queue';
import {COLLECTION, ROOT, tokenDigest} from '../../src/lib/coachSurveys/service';
import { ownPreferences, ownTextTeams, setOwnConsent, SMS_CONSENT_VERSION } from '../../src/lib/coach-communications/consent';
import { createTextPreferencesHandler } from '../../src/pages/api/pulsecheck/text-preferences';
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

const contactPath=(id='a')=>`${COLLECTION}/coach-communications-v1/contacts/team_${id}`;
process.env.TWILIO_FROM_NUMBER='+12025559999';
test('existing scoped phone works with no in-app evidence or enabled flag',async()=>{const db=fixture();db.data.set(contactPath(),{teamId:'team',athleteId:'a',phone:'+12025550100'});assert.equal((await eligible(db as any,'coach','team','a')).eligible,true)});
test('server profile fallback requires exact unambiguous E164 and preserves disabled/withdrawn/paused',async()=>{
 for(const profile of [{phoneNumber:'+12025550100'},{phone:'+12025550100'},{phoneNumber:'+12025550100',phone:'+12025550100'}])assert.equal(consentAllows(resolveTextContact(undefined,profile,'team','a'),'team','a'),true);
 for(const profile of [{phoneNumber:'2025550100'},{phoneNumber:' +12025550100'},{phoneNumber:'+12025550100',phone:'+12025550101'}])assert.equal(consentAllows(resolveTextContact(undefined,profile,'team','a'),'team','a'),false);
 for(const patch of [{enabled:false},{consent:{status:'withdrawn'}},{status:'paused'},{paused:true}])assert.equal(consentAllows(resolveTextContact({teamId:'team',athleteId:'a',...patch},{phoneNumber:'+12025550100'},'team','a'),'team','a'),false);
 assert.equal(resolveTextContact({teamId:'team',athleteId:'a',phone:'invalid'},{phoneNumber:'+12025550100'},'team','a').phone,'invalid');
});
test('fallback obeys STOP and team authorization',async()=>{const db=fixture();db.data.delete(contactPath());db.data.set('users/a',{phoneNumber:'+12025550100'});assert.equal((await eligible(db as any,'coach','team','a')).eligible,true);db.data.set(`${COLLECTION}/${ROOT}/sms-suppressions/${tokenDigest('+12025550100')}`,{suppressed:true});assert.equal((await eligible(db as any,'coach','team','a')).eligible,false);db.data.get('pulsecheck-team-memberships/team_coach').staffCapabilities=[];await assert.rejects(eligible(db as any,'coach','team','a'))});
test('queue claim rechecks fallback phone and STOP without provider calls',async()=>{for(const change of ['phone','STOP']){const db=fixture();db.data.delete(contactPath());db.data.set('users/a',{phoneNumber:'+12025550100'});await enqueueBatch(db as any,'coach','team',{requestId:'external',athleteIds:['a'],text:'Synthetic'});if(change==='phone')db.data.get('users/a').phoneNumber='+12025550101';else db.data.set(`${COLLECTION}/${ROOT}/sms-suppressions/${tokenDigest('+12025550100')}`,{suppressed:true});let calls=0;await processQueue(db as any,async()=>{calls++;throw Error('Must not call provider')});assert.equal(calls,0);assert.equal([...db.data.entries()].find(([p])=>p.includes('/jobs/'))?.[1].state,'blocked')}});
test('existing reply route recognizes fallback without saving contact or changing opt-out',async()=>{const db=fixture();db.data.delete(contactPath());db.data.set('users/a',{phoneNumber:'+12025550100'});db.data.set(`${COLLECTION}/coach-communications-v1/routes/${digest(['+12025559999','+12025550100'])}`,{teamId:'team',athleteId:'a'});await receiveSms(db as any,{From:'+12025550100',To:'+12025559999',Body:'Synthetic reply',MessageSid:'SMsynthetic'} as any);assert.equal(db.data.has(`${COLLECTION}/coach-communications-v1/teams/team/messages/SMsynthetic`),true);assert.equal(db.data.has(contactPath()),false)});

test('preferences use fallback; coach pause creates scoped denial without clearing STOP',async()=>{
 const {ownPreferences,pauseContact}=await import('../../src/lib/coach-communications/consent');
 const db=fixture();db.data.delete(contactPath());db.data.set('users/a',{phoneNumber:'+12025550100'});
 assert.equal((await ownPreferences(db as any,'a','team')).enabled,true);
 const stop=`${COLLECTION}/${ROOT}/sms-suppressions/${tokenDigest('+12025550100')}`;db.data.set(stop,{suppressed:true});
 assert.equal((await ownPreferences(db as any,'a','team')).suppressed,true);
 await pauseContact(db as any,'coach','team','a');
 assert.deepEqual(db.data.get(contactPath()),{teamId:'team',athleteId:'a',enabled:false});
 assert.equal(db.data.get(stop).suppressed,true);assert.equal((await ownPreferences(db as any,'a','team')).enabled,false);
});
test('pause preserves withdrawal and refuses inactive or foreign athlete memberships',async()=>{
 const {pauseContact}=await import('../../src/lib/coach-communications/consent');
 const db=fixture();db.data.get(contactPath()).consent={status:'withdrawn',withdrawnAtMs:1};await pauseContact(db as any,'coach','team','a');assert.equal(db.data.get(contactPath()).consent.status,'withdrawn');
 for(const patch of [{status:'transferred'},{role:'coach'},{organizationId:'foreign'}]){const other=fixture();other.data.delete(contactPath());Object.assign(other.data.get('pulsecheck-team-memberships/team_a'),patch);await assert.rejects(pauseContact(other as any,'coach','team','a'));assert.equal(other.data.has(contactPath()),false)}
});

test('external delivery permission is separate from this page\'s explicit current consent evidence',async()=>{
 const db=fixture();db.data.delete(contactPath());db.data.set('users/a',{phoneNumber:'+12025550100'});
 let prefs=await ownPreferences(db as any,'a','team');
 assert.equal(prefs.enabled,true);assert.equal(prefs.explicitConsentRecorded,false);
 prefs=await setOwnConsent(db as any,'a','team',true,'+12025550100');
 assert.equal(prefs.explicitConsentRecorded,true);assert.equal(prefs.version,SMS_CONSENT_VERSION);
 const saved=db.data.get(contactPath()), eventPath=`${COLLECTION}/coach-communications-v1/consent-events/${saved.consent.evidenceId}`;
 const event={...db.data.get(eventPath)};
 for(const patch of [{uid:'b'},{teamId:'another'},{accepted:false},{version:'team-texts-v1'},{phoneHash:tokenDigest('+12025550101')},{text:'Different terms'}]){
  db.data.set(eventPath,{...event,...patch});
  assert.equal((await ownPreferences(db as any,'a','team')).explicitConsentRecorded,false);
 }
 db.data.set(eventPath,event);db.data.set(`${COLLECTION}/${ROOT}/sms-suppressions/${tokenDigest('+12025550100')}`,{suppressed:true});
 prefs=await ownPreferences(db as any,'a','team');assert.equal(prefs.enabled,false);assert.equal(prefs.explicitConsentRecorded,true);assert.equal(prefs.suppressed,true);
 prefs=await setOwnConsent(db as any,'a','team',false);assert.equal(prefs.explicitConsentRecorded,false);assert.equal(prefs.enabled,false);
});

test('team choices include only canonical active athlete memberships in active organizations',async()=>{
 const db=fixture();db.data.get('pulsecheck-teams/team').name='Synthetic team';
 for(const [id,memberPatch,teamPatch] of [
  ['staff',{role:'coach'},{}],['removed',{status:'removed'},{}],['closed',{}, {status:'archived'}],['foreign',{organizationId:'wrong'},{}],
 ] as [string,Record<string,unknown>,Record<string,unknown>][]){
  db.data.set(`pulsecheck-teams/${id}`,{status:'active',organizationId:'org',...teamPatch});
  db.data.set(`pulsecheck-team-memberships/${id}_a`,{userId:'a',teamId:id,organizationId:'org',role:'athlete',status:'active',...memberPatch});
 }
 db.data.set('pulsecheck-team-memberships/duplicate',{userId:'a',teamId:'team',organizationId:'org',role:'athlete',status:'active'});
 assert.deepEqual(await ownTextTeams(db as any,'a'),[{teamId:'team',displayName:'Synthetic team'}]);
 db.data.get('pulsecheck-organizations/org').status='archived';assert.deepEqual(await ownTextTeams(db as any,'a'),[]);
 db.data.get('users/a').accountStatus='closed';await assert.rejects(ownTextTeams(db as any,'a'),/closing or closed/);
});

test('text preferences route authenticates team listing, returns only team labels, and requires a scoped team for writes',async()=>{
 const db=fixture();const handler=createTextPreferencesHandler({authorize:async()=>({uid:'a',db:db as any})});
 async function request(method:string,query:any={},body:any={},chosen=handler){
  const result:any={statusCode:200,headers:{}};
  const res:any={setHeader:(k:string,v:string)=>{result.headers[k]=v;},status:(n:number)=>{result.statusCode=n;return res;},json:(v:any)=>{result.body=v;return res;},end:()=>res};
  await chosen({method,query,body,headers:{}} as any,res);return result;
 }
 assert.deepEqual((await request('GET')).body,{teams:[{teamId:'team',displayName:'Team'}]});
 assert.equal((await request('GET',{teamId:['team']})).statusCode,400);
 assert.equal((await request('POST',{}, {accepted:true,version:SMS_CONSENT_VERSION})).statusCode,400);
 assert.equal((await request('GET',{teamId:'unknown'})).statusCode,403);
 assert.equal((await request('POST',{teamId:'team'},{accepted:true,version:'team-texts-v1'})).statusCode,400);
 const signedOut=createTextPreferencesHandler({authorize:async()=>{throw Error('signed out');}});
 assert.equal((await request('GET',{}, {},signedOut)).statusCode,401);
 assert.equal((await request('GET')).headers['Cache-Control'],'private, no-store');
});

function requireRecordedConsent(t: any) {
 const key='COACH_COMMUNICATIONS_REQUIRE_RECORDED_CONSENT', prior=process.env[key];
 process.env[key]='true';
 t.after(()=>{if(prior===undefined)delete process.env[key];else process.env[key]=prior;});
}

test('recorded rollout blocks roster phones and stale or mismatched evidence before enqueue',async t=>{
 requireRecordedConsent(t);
 const db=fixture();db.data.delete(contactPath());db.data.set('users/a',{phoneNumber:'+12025550100'});
 assert.equal((await eligible(db as any,'coach','team','a')).eligible,false);
 assert.equal((await ownPreferences(db as any,'a','team')).enabled,false);
 await assert.rejects(enqueueBatch(db as any,'coach','team',{requestId:'no-evidence',athleteIds:['a'],text:'Synthetic'}));
 assert.equal([...db.data.keys()].some(p=>p.includes('/jobs/')),false);
 await setOwnConsent(db as any,'a','team',true,'+12025550100');
 assert.equal((await eligible(db as any,'coach','team','a')).eligible,true);
 assert.equal((await ownPreferences(db as any,'a','team')).enabled,true);
 const contact=db.data.get(contactPath()), eventPath=`${COLLECTION}/coach-communications-v1/consent-events/${contact.consent.evidenceId}`;
 const event={...db.data.get(eventPath)};
 for(const patch of [{version:'team-texts-v1'},{uid:'b'},{teamId:'foreign'},{phoneHash:tokenDigest('+12025550101')},{accepted:false},{text:'Changed disclosure'}]){
  db.data.set(eventPath,{...event,...patch});
  assert.equal((await eligible(db as any,'coach','team','a')).eligible,false);
  assert.equal((await ownPreferences(db as any,'a','team')).enabled,false);
 }
 db.data.delete(eventPath);assert.equal((await eligible(db as any,'coach','team','a')).eligible,false);
});

test('recorded rollout blocks old queued work and rechecks evidence inside the claim transaction',async t=>{
 requireRecordedConsent(t);
 for(const scenario of ['legacy-queue','evidence-removed-before-claim','withdrawn']){
  const db=fixture();
  if(scenario==='legacy-queue')process.env.COACH_COMMUNICATIONS_REQUIRE_RECORDED_CONSENT='false';
  else await setOwnConsent(db as any,'a','team',true,'+12025550100');
  await enqueueBatch(db as any,'coach','team',{requestId:scenario,athleteIds:['a'],text:'Synthetic'});
  process.env.COACH_COMMUNICATIONS_REQUIRE_RECORDED_CONSENT='true';
  if(scenario==='withdrawn')await setOwnConsent(db as any,'a','team',false);
  if(scenario==='evidence-removed-before-claim'){
   const eventPath=`${COLLECTION}/coach-communications-v1/consent-events/${db.data.get(contactPath()).consent.evidenceId}`;
   const transact=db.runTransaction.bind(db);let first=true;
   db.runTransaction=async(fn:any)=>{if(first){first=false;db.data.delete(eventPath);}return transact(fn);};
  }
  let sends=0;await processQueue(db as any,async()=>{sends++;return {state:'accepted',providerId:'SM'+'a'.repeat(32)};});
  assert.equal(sends,0,scenario);
  assert.equal([...db.data.entries()].find(([p])=>p.includes('/jobs/'))?.[1].state,'blocked',scenario);
 }
});

test('recorded rollout allows valid opt-in while STOP still blocks and START never resumes',async t=>{
 requireRecordedConsent(t);const db=fixture();
 await setOwnConsent(db as any,'a','team',true,'+12025550100');
 await enqueueBatch(db as any,'coach','team',{requestId:'accepted-evidence',athleteIds:['a'],text:'Synthetic'});
 let sends=0;await processQueue(db as any,async()=>{sends++;return {state:'accepted',providerId:'SM'+'a'.repeat(32)};});assert.equal(sends,1);
 for(const [i,body]of ['STOP','START'].entries()){
  await receiveSms(db as any,{From:'+12025550100',To:process.env.TWILIO_FROM_NUMBER!,Body:body,MessageSid:'SM'+String(i).repeat(32)});
  assert.equal((await eligible(db as any,'coach','team','a')).eligible,false);
  const prefs=await ownPreferences(db as any,'a','team');assert.equal(prefs.explicitConsentRecorded,true);assert.equal(prefs.suppressed,true);assert.equal(prefs.enabled,false);
 }
});
