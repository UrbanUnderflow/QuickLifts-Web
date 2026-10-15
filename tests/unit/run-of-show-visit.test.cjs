const {test}=require('node:test');
const assert=require('node:assert/strict');
const V=require('../../public/RunOfShow/visit.js');
const P=require('../../public/RunOfShow/preview.js');
const R=require('../../public/RunOfShow/runner.js');
test('visit preserves four days and the requested session totals with updated dates and confirmed Eastern start times',()=>{
 const visit=V.initial();assert.deepEqual(visit.days.map(d=>d.dayNumber),[25,26,27,28]);
 assert.deepEqual(visit.days.map(d=>d.segments.reduce((n,s)=>n+s.minutes,0)),[0,60,90,0]);
 assert.deepEqual(visit.days.map(d=>d.segments.length),[0,8,7,0]);
 assert.deepEqual(visit.days.map(d=>d.date),['2026-10-25','2026-10-26','2026-10-27','2026-10-28']);assert.deepEqual(visit.days.map(d=>d.startTime),['','18:00','18:00','']);assert.equal(new Date(visit.days[1].planned).toISOString(),'2026-10-26T22:00:00.000Z');
 assert.match(visit.notes,/26/);assert.match(visit.notes,/Two hotel rooms for three nights/);
});
test('multi-day preview preserves every day and removes runner state without changing the owner event',()=>{
 const v=V.initial();v.days[1]=R.start(v.days[1],1000);const p=P.decode(P.encode(v));
 assert.equal(p.days.length,4);assert.equal(p.days[2].segments.length,7);assert.equal(p.days[1].active,null);assert.equal(v.days[1].active.start,1000);assert.equal(p.days[3].notes,v.days[3].notes);
});
test('running one day leaves other day schedules and progress intact',()=>{
 const v=V.initial(),athletes=JSON.stringify(v.days[2]);v.days[1]=R.finish(R.start(v.days[1],1000),10000);assert.equal(v.days[1].completed.length,1);assert.equal(JSON.stringify(v.days[2]),athletes);
});
test('wall-clock schedules use the organizer time zone including daylight saving',()=>{
 assert.equal(new Date(V.timestamp('2026-11-14','09:00','America/New_York')).toISOString(),'2026-11-14T14:00:00.000Z');
 assert.equal(new Date(V.timestamp('2026-10-14','09:00','America/New_York')).toISOString(),'2026-10-14T13:00:00.000Z');
});
test('legacy preview links can become a one-day visit',()=>{
 const old={title:'Old event',planned:1791982800000,timeZone:'America/New_York',segments:[{id:'a',title:'Welcome',description:'Hello',minutes:10,color:'lime'}],completed:[],active:null};const d=P.decode(P.encode(old)),v=V.fromLegacy(d);assert.equal(v.days.length,1);assert.equal(v.days[0].segments[0].title,'Welcome');assert.equal(P.decode(P.encode(v)).days.length,1);
});

test('deck alignment preserves dates, start times, logistics, and later edits',()=>{
 const old=V.initial();delete old.agendaRevision;old.days[1].startTime='09:30';old.days[1].planned=123;old.days[1].segments=[{id:'old',title:'Old agenda',minutes:60}];old.notes='Keep logistics';
 const aligned=V.alignSessionDecks(old);assert.equal(aligned.days[1].segments.length,8);assert.equal(aligned.days[2].segments.length,7);assert.equal(aligned.days[1].planned,123);assert.equal(aligned.days[1].startTime,'09:30');assert.equal(aligned.notes,old.notes);assert.deepEqual(aligned.days[0],old.days[0]);assert.equal(old.days[1].segments.length,1);
 aligned.days[1].segments[0].title='User edit';assert.equal(V.alignSessionDecks(aligned),aligned);
});
test('deck alignment does not overwrite a running session',()=>{const old=V.initial();delete old.agendaRevision;old.days[1]=R.start(old.days[1],1000);assert.equal(V.alignSessionDecks(old),old);});
test('deck agendas follow the exact timing boundaries from slide 2',()=>{
 const v=V.initial();assert.deepEqual(R.timeline(v.days[1],0).map(s=>(s.start-v.days[1].planned)/60000),[0,5,12,20,25,35,45,55]);assert.deepEqual(R.timeline(v.days[2],0).map(s=>(s.start-v.days[2].planned)/60000),[0,10,25,45,65,75,80]);
});

test('baseline and onboarding merge preserves duration and does not duplicate',()=>{
 const v=V.initial(),d=v.days[2],onboard=d.segments[3];onboard.title='Get set up on PulseCheck';onboard.minutes=15;d.segments.splice(3,0,{id:'baseline-assessment',title:'Baseline assessment',minutes:5});
 const merged=V.mergeBaseline(v);assert.equal(merged.days[2].segments.length,7);assert.equal(merged.days[2].segments[3].minutes,20);assert.equal(merged.days[2].segments[3].id,onboard.id);assert.equal(merged.days[2].segments.reduce((n,s)=>n+s.minutes,0),90);assert.deepEqual(V.mergeBaseline(merged),merged);
});
