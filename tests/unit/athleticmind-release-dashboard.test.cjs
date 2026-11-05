const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseReleaseSettings:parse}=require('../../netlify/functions/athleticmind-release-dashboard');
const base={brand:'pulsecheck',platform:'ios',version:'2.32',build:'2',mode:'off',storeURL:'https://apps.apple.com/us/app/pulsecheck/id6747253393',title:'Skill Training',notes:'Your current skill includes the phase name.'};
test('each app accepts only its own platform listing and confirmed prompts',()=>{
  assert.equal(parse(base).enabled,false);
  assert.throws(()=>parse({...base,mode:'optional'}));
  assert.throws(()=>parse({...base,brand:'athleticmind'}));
  assert.throws(()=>parse({...base,platform:'android'}));
  for(const brand of ['pulsecheck','athleticmind']){
    const url='https://play.google.com/store/apps/details?id=com.fitwithpulse.'+brand;
    assert.equal(parse({...base,platform:'android',brand,storeURL:url}).storeURL,url);
  }
  assert.throws(()=>parse({...base,mode:'required',storeReady:true,minimumVersion:'2.33',minimumBuild:'1'}));
  assert.equal(parse({...base,mode:'required',storeReady:true,minimumVersion:'2.32',minimumBuild:'1'}).minimumBuild,'1');
});
