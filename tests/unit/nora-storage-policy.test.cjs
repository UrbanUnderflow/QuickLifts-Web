const test = require('node:test');
const assert = require('node:assert/strict');
const {assessNoraStorage,safeTranscript,WITHHELD}=require('../../netlify/functions/utils/noraStoragePolicy');
const classify=decision=>({apiKey:'synthetic',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({decision})}}]})})});
test('mixed medication and performance context is withheld before model authorization',async()=>{
 const p=await assessNoraStorage('I take medication and want a serving cue',{apiKey:'',fetchImpl:()=>{throw Error('must not call')}});
 assert.equal(p.restricted,true);
 const saved=safeTranscript([{id:'bad',content:'private fixture',isFromUser:true,summary:'private fixture',chatActions:[{label:'private fixture'}]}],p);
 assert.equal(saved[0].content,WITHHELD);assert.deepEqual(saved[0].chatActions,[]);assert.ok(!JSON.stringify(saved).includes('private fixture'));
});
test('ordinary confirmed classification preserves useful conversation',async()=>{const p=await assessNoraStorage('I ate a banana',classify('ordinary'));assert.equal(p.restricted,false);assert.equal(safeTranscript([{content:'banana',isFromUser:true}],p)[0].content,'banana');});
test('missing key, invalid classification and provider failure withhold content',async()=>{
 for(const options of [{apiKey:''},classify('approve'),{apiKey:'synthetic',fetchImpl:async()=>{throw Error('offline')}}]) assert.equal((await assessNoraStorage('unclear fixture',options)).restricted,true);
});
test('oversized input cannot authorize ordinary storage',async()=>assert.equal((await assessNoraStorage('x'.repeat(100001),classify('ordinary'))).restricted,true));
test('classifier requests disable provider storage',async()=>{await assessNoraStorage('ordinary example',{apiKey:'synthetic',fetchImpl:async(_url,init)=>{assert.equal(JSON.parse(init.body).store,false);return {ok:false}}});});

test('unknown score meaning cannot be authorized as ordinary by model',async()=>{assert.equal((await assessNoraStorage('Someone gave me a score of 12. I do not know what the score measures.',classify('ordinary'))).restricted,true);});
test('ordinary server message IDs remain stable for action cards',()=>{assert.equal(safeTranscript([{id:'server-message-17',content:'Try this cue'}],{restricted:false})[0].id,'server-message-17');});
