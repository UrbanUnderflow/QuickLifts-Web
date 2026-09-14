import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintLegacyAssignment, validateLegacyHandoffReview, evaluateLegacyHandoffCompletion, prepareLegacyHandoff } from '../../src/api/firebase/dailyCurriculum/linearLegacyHandoff';
const now=Date.parse('2026-09-14T17:00:00Z');
function fixture() {
 const data={athleteId:'athlete',status:'started',protocolId:'protocol-478-breathing',legacyExerciseId:'breathing-478',sourceDate:'2026-09-14',timezone:'America/New_York',startedAt:now-1000,updatedAt:now-500};
 const active=Array.from({length:24},(_,i)=>({collection:'pulsecheck-daily-assignments' as const,assignmentId:`assignment-${i}`,data:{...data,sourceDate:i===23?'2026-09-14':'2026-08-20'}}));
 return {active,review:{records:active.map(r=>({collection:r.collection,assignmentId:r.assignmentId,fingerprint:fingerprintLegacyAssignment(r.collection,r.assignmentId,r.data)})),linkedAssignmentId:'assignment-23'},athleteId:'athlete',today:'2026-09-14',timezone:'America/New_York',versionId:'version',now};
}
test('review preserves all 24 records, separates historical23 and links current Learn without credit',()=>{
 const input=fixture(),before=JSON.stringify(input);const result=validateLegacyHandoffReview(input);
 assert.equal(result.legacyReconciliation.historicalActiveAssignments.length,23);assert.equal(result.legacyReconciliation.importedCompletionCount,0);
 assert.equal(result.legacyHandoff.status,'pending');assert.equal(result.legacyHandoff.phase,'learn');assert.equal(JSON.stringify(input),before);
 assert.deepEqual(evaluateLegacyHandoffCompletion(result.legacyHandoff,input.active[23].data,'athlete',now),{kind:'pending'});
 assert.deepEqual(validateLegacyHandoffReview({...input,active:[...input.active].reverse()}),result);
});
test('exact active-set/fingerprint match rejects missing, duplicate, new, changed and conflicting-owner work',()=>{
 const input=fixture();
 for(const active of [input.active.slice(1),[...input.active,input.active[0]],input.active.map((r,i)=>i? r:{...r,data:{...r.data,updatedAt:now}}),input.active.map((r,i)=>i?r:{...r,data:{...r.data,userId:'other'}})]) assert.throws(()=>validateLegacyHandoffReview({...input,active}));
 assert.throws(()=>validateLegacyHandoffReview({...input,review:{...input.review,records:input.review.records.slice(1)}}));
 assert.throws(()=>validateLegacyHandoffReview({...input,review:{...input.review,records:[...input.review.records,input.review.records[0]]}}));
});
test('today link must prove started478, local date/timezone, no preexisting completion',()=>{
 for(const changed of [{status:'completed',completedAt:now-1},{sourceDate:'2026-09-13'},{timezone:'UTC'},{protocolId:'another'},{legacyExerciseId:'another'},{startedAt:now+1}]) {
  const input=fixture();Object.assign(input.active[23].data,changed);
  input.review.records[23].fingerprint=fingerprintLegacyAssignment(input.active[23].collection,input.active[23].assignmentId,input.active[23].data);
  assert.throws(()=>validateLegacyHandoffReview(input));
 }
});
test('full-content fingerprint covers completion additions and stable serialized Firestore timestamps',()=>{
 assert.equal(fingerprintLegacyAssignment('x','id',{stamp:{seconds:123,nanoseconds:456},a:1}),fingerprintLegacyAssignment('x','id',{a:1,stamp:{_seconds:123,_nanoseconds:456}}));
 assert.notEqual(fingerprintLegacyAssignment('x','id',{status:'started'}),fingerprintLegacyAssignment('x','id',{status:'started',completionSummary:{completed:true}}));
});
test('bridge accepts only actual later canonical completion, is deterministic and never mutates history',()=>{
 const input=fixture(),link=validateLegacyHandoffReview(input).legacyHandoff;
 const completed={...input.active[23].data,status:'completed',completedAt:now+1000},before=JSON.stringify(completed);
 const result=evaluateLegacyHandoffCompletion(link,completed,'athlete',now+2000);
 assert.deepEqual(result,{kind:'completed',completedAt:now+1000,ledgerId:link.ledgerId});
 assert.deepEqual(evaluateLegacyHandoffCompletion(link,completed,'athlete',now+2000),result);assert.equal(JSON.stringify(completed),before);
 for(const data of [undefined,{...completed,completedAt:now},{...completed,completedAt:now+3000},{...completed,status:'started'},{...completed,athleteId:'other'},{...completed,startedAt:now-2000},{...completed,completedAt:NaN}]) assert.equal(evaluateLegacyHandoffCompletion(link,data,'athlete',now+2000).kind,'pending');
});
test('transaction scanner covers all roots/owner aliases, deduplicates aliases and does no writes',async()=>{
 const input=fixture();let calls=0;
 const db:any={collection:(collection:string)=>({where:(owner:string,_op:string,value:string)=>({limit:(limit:number)=>({collection,owner,value,limit})})})};
 const tx:any={get:async(q:any)=>{calls++;const docs=input.active.filter(r=>r.collection===q.collection&&(r.data as any)[q.owner]===q.value).map(r=>({id:r.assignmentId,data:()=>r.data}));return {size:docs.length,docs};}};
 const result=await prepareLegacyHandoff(tx,db,input);assert.equal(calls,9);assert.equal(result.legacyReconciliation.historicalActiveAssignments.length,23);
 await assert.rejects(()=>prepareLegacyHandoff({get:async()=>({size:1001,docs:[]})} as any,db,input),/limit/);
});
test('enrollment atomically stores approved link with zero credit and leaves all legacy assignments unchanged',async()=>{
 const {createLinearEnrollmentHandler}=await import('../../src/pages/api/admin/curriculum/enrollment');const input=fixture();
 const data=new Map<string,any>(input.active.map(r=>[`${r.collection}/${r.assignmentId}`,structuredClone(r.data)]));
 data.set('users/athlete',{});data.set('pulsecheck-linear-curriculum/audiences/items/review',{athleteIds:['athlete'],versionId:'version'});
 data.set('pulsecheck-linear-curriculum/versions/items/version',{id:'version',status:'published',content:{progressionBasis:'five_days_in_fourteen',orderedIds:['protocol-478-breathing']},runtimeReadySkillIds:['protocol-478-breathing']});
 data.set('pulsecheck-linear-curriculum/versions/items/version/content/protocol-478-breathing',{contentSnapshot:{id:'breathing-478'}});
 class Ref {constructor(public path:string,public filter?:[string,string],public cap?:number){} doc(id:string){return new Ref(`${this.path}/${id}`)} collection(id:string){return new Ref(`${this.path}/${id}`)} where(key:string,_op:string,value:string){return new Ref(this.path,[key,value])} limit(cap:number){return new Ref(this.path,this.filter,cap)}}
 const snap=(path:string)=>({id:path.split('/').pop(),exists:data.has(path),data:()=>structuredClone(data.get(path))});
 const db:any={collection:(id:string)=>new Ref(id),runTransaction:async(fn:any)=>fn({get:async(ref:Ref)=>ref.cap?{size:[...data].filter(([p,v])=>p.startsWith(ref.path+'/')&&v[ref.filter![0]]===ref.filter![1]).length,docs:[...data].filter(([p,v])=>p.startsWith(ref.path+'/')&&v[ref.filter![0]]===ref.filter![1]).map(([p])=>snap(p))}:snap(ref.path),create:(ref:Ref,value:unknown)=>{assert(!data.has(ref.path));data.set(ref.path,structuredClone(value));}})};
 const handler=createLinearEnrollmentHandler({enabled:()=>true,now:()=>now,authorize:async()=>({uid:'admin',email:'admin@example.test',projectId:'test',db})});
 const body={action:'enroll',audienceId:'review',athleteId:'athlete',confirmOptIn:true,preserveHistory:true,timezone:'America/New_York',expectedStateRevision:null,reviewedLegacyHandoff:input.review};
 const legacyBefore=JSON.stringify([...data].filter(([path])=>path.startsWith('pulsecheck-daily-assignments/')));
 const invoke=async()=>{const res:any={statusCode:0,body:null,setHeader(){},status(n:number){this.statusCode=n;return this},json(b:any){this.body=b;return this}};await handler({method:'POST',body} as any,res);return res;};
 let response=await invoke();assert.equal(response.statusCode,200);assert.equal(response.body.state.legacyHandoff.status,'pending');assert.deepEqual(response.body.state.completedSkillIds,[]);
 assert.equal([...data.keys()].filter(path=>path.includes('/completions/')).length,0);assert.equal(JSON.stringify([...data].filter(([path])=>path.startsWith('pulsecheck-daily-assignments/'))),legacyBefore);
 const before=JSON.stringify([...data]);response=await invoke();assert.equal(response.statusCode,200);assert.equal(JSON.stringify([...data]),before,'idempotent retry must not recreate pin or handoff');
});
test('a link resolved by journey completion cannot import a later legacy completion again',()=>{
 const input=fixture(),link=validateLegacyHandoffReview(input).legacyHandoff;
 const completed={...input.active[23].data,status:'completed',completedAt:now+1000};
 for(const status of ['completed_in_journey','completed_from_legacy'] as const) assert.deepEqual(evaluateLegacyHandoffCompletion({...link,status},completed,'athlete',now+2000),{kind:'pending'});
});
