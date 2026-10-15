const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../../public/RunOfShow/runner.js');
const fixture=()=>({planned:0,segments:[{id:'a',minutes:1},{id:'b',minutes:2},{id:'c',minutes:1}],completed:[],active:null});
test('expiry stops at the deadline and waits for a manual start',()=>{
 let state=R.start(fixture(),1000);
 state=R.normalize(state,70000);
 assert.equal(state.active,null);
 assert.equal(state.completed[0].end,61000);
 assert.equal(R.timeline(state,70000)[1].start,70000);
 assert.equal(R.timeline(state,90000)[1].start,90000);
 state=R.start(state,90000);
 assert.equal(state.active.start,90000);
 assert.equal(state.active.end,210000);
});
test('ending early pulls the remaining schedule forward',()=>{
 const state=R.finish(R.start(fixture(),1000),11000);
 const rows=R.timeline(state,11000);
 assert.equal(rows[0].end,11000);
 assert.equal(rows[1].start,11000);
 assert.equal(rows[2].end,191000);
});
test('refresh recovery uses wall time and never skips unstarted segments',()=>{
 const restored=JSON.parse(JSON.stringify(R.start(fixture(),1000)));
 const state=R.normalize(restored,900000);
 assert.equal(state.completed.length,1);
 assert.equal(state.active,null);
 assert.equal(R.timeline(state,900000)[1].start,900000);
});
test('repeated start does not restart the active countdown',()=>{
 assert.equal(R.start(R.start(fixture(),1000),2000).active.start,1000);
});
test('finishing the last segment preserves its actual finish',()=>{
 let state={...fixture(),segments:[{id:'a',minutes:1}]};
 state=R.normalize(R.start(state,1000),100000);
 assert.equal(R.timeline(state,200000)[0].end,61000);
 assert.equal(R.start(state,200000).active,null);
});
test('reordering shifts planned times and preserves segment content',()=>{
 const state=R.reorder(fixture(),'c',0);assert.deepEqual(state.segments.map(s=>s.id),['c','a','b']);assert.deepEqual(R.timeline(state,0).map(s=>s.start),[0,60000,120000]);
});
test('completed and active segments cannot be moved or displaced',()=>{
 const state=R.start(fixture(),1000);assert.equal(R.reorder(state,'a',1),state);assert.equal(R.reorder(state,'b',0),state);assert.deepEqual(R.reorder(state,'c',1).segments.map(s=>s.id),['a','c','b']);
 const done=R.finish(state,10000);assert.equal(R.reorder(done,'a',2),done);assert.equal(R.reorder(done,'c',0),done);
});
