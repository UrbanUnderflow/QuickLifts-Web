const test = require('node:test');
const assert = require('node:assert/strict');
const {buildNoraChatActions}=require('../../netlify/functions/utils/noraChatActions');
test('supported clients receive shared meal and practice proposals',()=>{
  assert.deepEqual(buildNoraChatActions({message:'I ate rice.',reply:'Use the card.',enabled:true}).map(a=>a.type),['meal']);
  const actions=buildNoraChatActions({message:'A focus cue please.',reply:'Try this mental cue.',enabled:true});
  assert.equal(actions[0].exerciseId,'focus-cue-word');
  assert.equal(actions[0].type,'practice');
});
test('clinical context and unsupported clients never get practice or meal shortcuts',()=>{
  for(const extra of [{enabled:false},{escalationTier:2},{recentMessages:[{content:'I am having chest pain.'}]}]) assert.deepEqual(buildNoraChatActions({message:'I ate rice.',reply:'Try a breathing practice.',enabled:true,...extra}),[]);
  assert.deepEqual(buildNoraChatActions({message:'I ate food and feel guilty about my body image.',reply:'Try breathing.',enabled:true}),[]);
});
