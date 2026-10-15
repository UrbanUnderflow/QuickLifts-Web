const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../../public/RunOfShow/preview.js');
const state={title:'Stakeholder day 🌿',planned:1791824400000,timeZone:'America/New_York',segments:[{id:'a',title:'Welcome',description:'Introductions\nGoals & questions 🌿',minutes:15,color:'teal'}],active:{id:'a',start:1,end:2},completed:[]};
test('shared snapshot preserves descriptions and time zone and excludes runner state',()=>{
 const snapshot=P.decode(P.encode(state));
 assert.equal(snapshot.title,state.title);
 assert.equal(snapshot.segments[0].description,state.segments[0].description);
 assert.equal(snapshot.timeZone,state.timeZone);
 assert.equal(snapshot.active,null);
 assert.deepEqual(snapshot.completed,[]);
 assert.equal(state.active.start,1);
});
test('invalid links and invalid segment durations are rejected',()=>{
 assert.throws(()=>P.decode('invalid'));
 assert.throws(()=>P.decode(P.encode({...state,segments:[{...state.segments[0],minutes:-1}]})));
});
