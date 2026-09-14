import test from 'node:test';
import assert from 'node:assert/strict';
import { runLinearRuntime, type LinearRuntimeAssignment } from '../../src/api/firebase/dailyCurriculum/linearRuntimeAdmin';
import { buildLinearVersion } from '../../src/api/firebase/dailyCurriculum/linearPublication';
import { createLinearRuntimeHandler } from '../../src/pages/api/curriculum/runtime';
import { createLinearEnrollmentHandler } from '../../src/pages/api/admin/curriculum/enrollment';
const ROOT = 'pulsecheck-linear-curriculum';
const copy = (x: any) => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
function store() {
  const data = new Map<string, any>(); let queue = Promise.resolve(); let failCommit = false;
  class Ref {
    constructor(public path: string, public cap?: number) {}
    get id() { return this.path.split('/').pop()!; }
    doc(id: string) { return new Ref(`${this.path}/${id}`); }
    collection(id: string) { return new Ref(`${this.path}/${id}`); }
    limit(cap: number) { return new Ref(this.path, cap); }
  }
  const snap = (ref: Ref) => ({ id: ref.id, exists: data.has(ref.path), data: () => copy(data.get(ref.path)) });
  const db: any = { collection: (id: string) => new Ref(id), runTransaction: (fn: any) => {
    const next = queue.then(async () => {
      const writes: Array<() => void> = [];
      const tx = { get: async (ref: Ref) => { assert.equal(writes.length, 0, 'all reads precede writes'); if (ref.cap) { const docs = [...data.keys()].filter(k => k.startsWith(ref.path + '/') && k.split('/').length === ref.path.split('/').length + 1).slice(0,ref.cap).map(k => snap(new Ref(k))); return { size: docs.length, docs }; } return snap(ref); },
        create: (ref: Ref, value: any) => writes.push(() => { assert(!data.has(ref.path)); data.set(ref.path,copy(value)); }),
        update: (ref: Ref, value: any) => writes.push(() => { assert(data.has(ref.path)); data.set(ref.path,{...data.get(ref.path),...copy(value)}); }),
        set: (ref: Ref, value: any) => writes.push(() => data.set(ref.path,copy(value))) };
      const result = await fn(tx); if (failCommit) throw new Error('injected commit failure'); writes.forEach(w => w()); return result;
    }); queue = next.catch(() => {}); return next;
  } }; return { db, data, fail: () => { failCommit = true; } };
}
const skill = (id: string) => ({ id, name: id, type: 'protocol' as const, readiness: '', rationale: '', sourceRefs: [], aliases: [], catalogType: 'protocol' as const, classificationReason: '' });
const first = 'protocol-478-breathing', second = 'second';
const makeVersion = (id: string) => ({ ...buildLinearVersion({ id, publishedAt: '2026-09-01', draft: { orderedIds: [first,second], rationales: {}, audience: { mode:'explicit_athlete_ids', confirmed:true }, progressionBasis:'five_days_in_fourteen', protocolDays:[5,5,5], simulationDays:null }, active:[skill(first),skill(second)], runtimeReadySkillIds:[first,second] }), contentSnapshots: { [first]:{id:first,name:'Original content'}, [second]:{id:second,name:'Next content'} } });
const time = (day: number) => Date.parse(`2026-09-${String(day).padStart(2,'0')}T12:00:00Z`);
function setup() { const s = store(); for (let day=1;day<=30;day++) { const dayKey=`2026-09-${String(day).padStart(2,'0')}`; s.data.set(`pulsecheck-morning-checkins/a_${dayKey}`,{athleteUserId:'a',dayKey,level:'okay'}); } s.data.set(`${ROOT}/versions/items/v1`,makeVersion('v1')); s.data.set(`${ROOT}/versions/items/v2`,makeVersion('v2')); s.data.set(`${ROOT}/audiences/items/team`,{versionId:'v2',athleteIds:['a'],revision:1}); s.data.set(`${ROOT}/states/items/a`,{athleteId:'a',optedIn:true,audienceId:'team',revision:1,enrollment:{athleteId:'a',versionId:'v1',optedIn:true,startedOn:'2026-09-01',timezone:'America/New_York',historyPolicy:'preserve'},currentSkill:{skillId:first,versionId:'v1',startedOn:'2026-09-01'},completedSkillIds:[]}); return s; }
const call = async (s: ReturnType<typeof setup>, action: 'today'|'start'|'complete', day: number, extra: any = {}) => runLinearRuntime(s.db,{athleteId:'a',action,...extra},{enabled:true,now:time(day)});
async function issued(s: ReturnType<typeof setup>,day:number) { const r = await call(s,'today',day); assert.equal(r.status,'assignment'); return (r as {assignment:LinearRuntimeAssignment}).assignment; }
test('disabled runtime performs no reads or writes and unknown athlete remains legacy',async()=>{ assert.deepEqual(await runLinearRuntime({} as any,{athleteId:'a',action:'today'},{enabled:false}),{status:'legacy'}); const s=store(); assert.deepEqual(await runLinearRuntime(s.db,{athleteId:'a',action:'today'},{enabled:true}),{status:'legacy'}); });
test('durable issued/start/completion chain owns athlete, phase, date; duplicates create one ledger record',async()=>{ const s=setup();const a=await issued(s,1); assert.equal(a.versionId,'v1'); assert.equal((await call(s,'complete',1,{assignmentId:a.id})).status,'blocked'); await call(s,'start',1,{assignmentId:a.id}); const both=await Promise.all([call(s,'complete',1,{assignmentId:a.id}),call(s,'complete',1,{assignmentId:a.id})]); assert.deepEqual(both.map(x=>(x as any).duplicate),[false,true]); assert.equal([...s.data.keys()].filter(k=>k.includes('/completions/')).length,1); const other=await runLinearRuntime(s.db,{athleteId:'attacker',action:'complete',assignmentId:a.id},{enabled:true,now:time(1)}); assert.equal(other.status,'blocked'); assert.equal((await issued(s,1)).completedDayCount,1); });
test('expired windows reject old assignments and preserve old ledger',async()=>{const s=setup();const a=await issued(s,1);await call(s,'start',1,{assignmentId:a.id});await call(s,'complete',1,{assignmentId:a.id});const pending=await issued(s,2);await call(s,'start',2,{assignmentId:pending.id});assert.equal((await call(s,'complete',15,{assignmentId:pending.id})).status,'blocked');const current=await issued(s,15);assert.equal(current.windowStart,'2026-09-15');assert.equal(current.completedDayCount,0);assert.equal([...s.data.keys()].filter(k=>k.includes('/completions/')).length,1);});
test('whole skill remains pinned through release; atomic boundary records completion and next pin idempotently',async()=>{const s=setup();for(let d=1;d<=15;d++){const a=await issued(s,d);assert.equal(a.versionId,'v1');await call(s,'start',d,{assignmentId:a.id});await call(s,'complete',d,{assignmentId:a.id,outcome:'used'});}const responses=await Promise.all([issued(s,16),issued(s,16)]);assert.equal(responses[0].id,responses[1].id);assert.equal(responses[0].versionId,'v2');assert.equal(responses[0].skillId,second);const state=s.data.get(`${ROOT}/states/items/a`);assert.equal(state.revision,2);assert.deepEqual(state.completedSkillIds,[first]);assert.equal([...s.data.keys()].filter(k=>k.includes('/completions/')).length,15);});
test('failed transaction leaves pin/history/assignment state unchanged; preview writes nothing',async()=>{const s=setup();const before=JSON.stringify([...s.data]);await runLinearRuntime(s.db,{athleteId:'a',action:'today'},{enabled:true,now:time(1),dryRun:true});assert.equal(JSON.stringify([...s.data]),before);s.fail();await assert.rejects(()=>issued(s,1),/injected/);assert.equal(JSON.stringify([...s.data]),before);});
const response=()=>{const r:any={code:0,body:null,setHeader(){},status(n:number){r.code=n;return r;},json(body:any){r.body=body;return r;}};return r;};
test('athlete API ignores requested identity and rejects missing authentication',async()=>{const s=setup();const handler=createLinearRuntimeHandler({enabled:()=>true,authorize:async()=>({uid:'a',db:s.db})});let r=response();await handler({method:'POST',headers:{},body:{action:'today'}} as any,r);assert.equal(r.code,401);r=response();await handler({method:'POST',headers:{authorization:'Bearer test'},body:{action:'today',athleteId:'other'}} as any,r);assert.equal(r.body.assignment.athleteId,'a');});
test('enrollment is explicit, default gated, immutable and retry-safe without touching legacy history',async()=>{const s=setup();s.data.delete(`${ROOT}/states/items/a`);s.data.set('users/a',{name:'Athlete'});s.data.set('legacy/a',{keep:true});const handler=createLinearEnrollmentHandler({enabled:()=>true,now:()=>time(1),authorize:async()=>({uid:'admin',email:'admin@example.test',db:s.db,projectId:'test'})});const body={action:'enroll',audienceId:'team',athleteId:'a',confirmOptIn:true,preserveHistory:true,timezone:'America/New_York',expectedStateRevision:null};let r=response();await handler({method:'POST',headers:{},body} as any,r);assert.equal(r.code,200);r=response();await handler({method:'POST',headers:{},body} as any,r);assert.equal(r.body.state.revision,1);assert.deepEqual(s.data.get('legacy/a'),{keep:true});});
test('private journals are owner-only, optional, revisioned and excluded from completion ledger',async()=>{
  const { createLinearJournalHandler } = await import('../../src/pages/api/curriculum/journal'); const s=setup(); const id='journal-assignment';
  s.data.set(`${ROOT}/states/items/a/assignments/${id}`,{id,athleteId:'a',phase:'use_it',versionId:'v1',skillId:first});
  const handler=createLinearJournalHandler({enabled:()=>true,authorize:async()=>({uid:'a',db:s.db}),now:()=>time(1)});
  for(const text of ['Private reflection','Private reflection','Updated reflection']){const r=response();await handler({method:'POST',headers:{},body:{assignmentId:id,text}} as any,r);assert.equal(r.code,200);assert.equal(r.body.text,undefined);}
  assert.equal(s.data.get(`${ROOT}/states/items/a/journals/${id}`).revision,2);
  assert.equal([...s.data.keys()].filter(k=>k.includes('/completions/')).length,0);
  const other=createLinearJournalHandler({enabled:()=>true,authorize:async()=>({uid:'other',db:s.db})});const r=response();await other({method:'GET',headers:{},query:{assignmentId:id}} as any,r);assert.equal(r.code,404);assert(!JSON.stringify(r.body).includes('reflection text'));
});

test('daily check-in gates start and completion, while today shows a locked assignment',async()=>{
 const s=setup();s.data.delete('pulsecheck-morning-checkins/a_2026-09-01');const a=await issued(s,1);
 assert.equal(a.requiresCheckIn,true);assert.equal((await call(s,'start',1,{assignmentId:a.id})).status,'blocked');
 s.data.set('pulsecheck-morning-checkins/a_2026-09-01',{athleteUserId:'a',dayKey:'2026-09-01',level:'solid'});
 assert.equal((await call(s,'start',1,{assignmentId:a.id})).status,'recorded');
 s.data.delete('pulsecheck-morning-checkins/a_2026-09-01');assert.equal((await call(s,'complete',1,{assignmentId:a.id})).status,'blocked');
 assert.equal([...s.data.keys()].filter(k=>k.includes('/completions/')).length,0);
});
test('evening-only canonical check-in unlocks without top-level createdAt and duplicate remains idempotent',async()=>{
 const s=setup();s.data.set('pulsecheck-morning-checkins/a_2026-09-01',{athleteUserId:'a',dayKey:'2026-09-01',eveningCheckIn:{level:'low',createdAt:time(1)}});
 const a=await issued(s,1);assert.equal(a.requiresCheckIn,false);await call(s,'start',1,{assignmentId:a.id});await call(s,'complete',1,{assignmentId:a.id});
 s.data.delete('pulsecheck-morning-checkins/a_2026-09-01');s.data.delete('pulsecheck-morning-checkins/a_2026-09-02');const replay=await call(s,'complete',2,{assignmentId:a.id});assert.equal((replay as any).duplicate,true);
});
test('wrong owner, wrong date and malformed check-in do not unlock',async()=>{
 for(const record of [{athleteUserId:'other',dayKey:'2026-09-01',level:'okay'},{athleteUserId:'a',dayKey:'2026-08-31',level:'okay'},{athleteUserId:'a',dayKey:'2026-09-01',eveningCheckIn:{reflection:'not evidence'}}]) {
 const s=setup();s.data.set('pulsecheck-morning-checkins/a_2026-09-01',record);const a=await issued(s,1);assert.equal((await call(s,'start',1,{assignmentId:a.id})).status,'blocked');
 }
});
test('check-in lookup uses pinned local day rather than UTC or assignment source date',async()=>{
 const s=setup();s.data.delete('pulsecheck-morning-checkins/a_2026-09-02');
 const now=Date.parse('2026-09-02T02:00:00Z');const r=await runLinearRuntime(s.db,{athleteId:'a',action:'today'},{enabled:true,now});
 assert.equal((r as any).assignment.sourceDate,'2026-09-01');assert.equal((r as any).assignment.requiresCheckIn,false);
});
