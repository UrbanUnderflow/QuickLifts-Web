const test = require('node:test');
const assert = require('node:assert/strict');
const { createFirestoreAdminMock } = require('../firebase-admin/_runtimeHarness.cjs');
const { loadAppBranding, createHandler } = require('../../../netlify/functions/get-pulsecheck-app-branding');
const defaults = {appExperience:{ios:'standard',android:'standard'},appBranding:{pulsecheck:'pulsecheck',athleticmind:'athleticmind'}};
function fixture({members,teams,orgs} = {}) {
  return createFirestoreAdminMock({collections:{
    'pulsecheck-team-memberships': members || [{id:'m',data:{userId:'user',teamId:'team',organizationId:'org',status:'active'}}],
    'pulsecheck-teams': teams || [{id:'team',data:{organizationId:'org',status:'active'}}],
    'pulsecheck-organizations': orgs || [{id:'org',data:{status:'active',productBrand:'pulsecheck',appBranding:{pulsecheck:'athleticmind'}}}],
  }}).db;
}
test('active organization app override is returned without product or clinical fields', async () => {
  assert.deepEqual(await loadAppBranding(fixture(),'user'),{appExperience:{ios:'standard',android:'standard'},appBranding:{pulsecheck:'athleticmind',athleticmind:'athleticmind'}});
});
test('product profile alone never changes app identity', async () => {
  assert.deepEqual(await loadAppBranding(fixture({orgs:[{id:'org',data:{status:'active',productBrand:'athleticmind'}}]}),'user'),defaults);
});
test('no membership and revoked membership retain app defaults; explicit foreign team is forbidden',async () => {
  assert.deepEqual(await loadAppBranding(fixture(),'other'),defaults);
  assert.deepEqual(await loadAppBranding(fixture({members:[{id:'m',data:{userId:'user',teamId:'team',organizationId:'org',status:'active',revokedAt:1}}]}),'user'),defaults);
  await assert.rejects(loadAppBranding(fixture(),'user','foreign'),e=>e.statusCode===403);
});
test('inactive or mismatched team and inactive org cannot supply overrides',async () => {
  for(const args of [{teams:[{id:'team',data:{organizationId:'other',status:'active'}}]},{teams:[{id:'team',data:{organizationId:'org',status:'archived'}}]},{orgs:[{id:'org',data:{status:'inactive',appBranding:{pulsecheck:'athleticmind'}}}]}]) {
    assert.deepEqual(await loadAppBranding(fixture(args),'user'),defaults);
  }
});
test('multiple organizations default unless selected team establishes authorized context',async () => {
  const db=fixture({members:[{id:'m',data:{userId:'user',teamId:'team',organizationId:'org',status:'active'}},{id:'m2',data:{userId:'user',teamId:'team2',organizationId:'org2',status:'active'}}],teams:[{id:'team',data:{organizationId:'org',status:'active'}},{id:'team2',data:{organizationId:'org2',status:'active'}}],orgs:[{id:'org',data:{status:'active',appBranding:{pulsecheck:'athleticmind'}}},{id:'org2',data:{status:'active'}}]});
  assert.deepEqual(await loadAppBranding(db,'user'),defaults);
  assert.equal((await loadAppBranding(db,'user','team')).appBranding.pulsecheck,'athleticmind');
});
test('endpoint requires auth, validates context and returns private no-store response',async () => {
  const handler=createHandler({authorize:async()=>({uid:'user',db:fixture()})});
  assert.equal((await handler({httpMethod:'GET'})).statusCode,401);
  assert.equal((await handler({httpMethod:'POST'})).statusCode,405);
  const event={httpMethod:'GET',headers:{authorization:'Bearer test'}};
  assert.equal((await handler({...event,queryStringParameters:{teamId:'../other'}})).statusCode,400);
  assert.equal((await handler({...event,queryStringParameters:{teamId:'foreign'}})).statusCode,403);
  const response=await handler(event);
  assert.equal(response.statusCode,200);
  assert.equal(response.headers['Cache-Control'],'no-store');
  assert.deepEqual(JSON.parse(response.body),{appExperience:{ios:'standard',android:'standard'},appBranding:{pulsecheck:'athleticmind',athleticmind:'athleticmind'}});
  assert.equal((await createHandler({authorize:async()=>{throw Error('expired')}})(event)).statusCode,401);
});

test('Clay appearance is independent of branding and requires one verified organization',async()=>{
 const orgs=[{id:'org',data:{status:'active',productBrand:'pulsecheck',appExperience:{ios:'clay',android:'standard'}}}];
 assert.deepEqual((await loadAppBranding(fixture({orgs}),'user','team')).appExperience,{ios:'clay',android:'standard'});
 for(const value of [undefined,{ios:'unknown'},null])assert.deepEqual((await loadAppBranding(fixture({orgs:[{id:'org',data:{status:'active',appExperience:value}}]}),'user')).appExperience,{ios:'standard',android:'standard'});
 const db=fixture({members:[{id:'m',data:{userId:'user',teamId:'team',organizationId:'org',status:'active'}},{id:'n',data:{userId:'user',teamId:'team2',organizationId:'org2',status:'active'}}],teams:[{id:'team',data:{organizationId:'org',status:'active'}},{id:'team2',data:{organizationId:'org2',status:'active'}}],orgs:[...orgs,{id:'org2',data:{status:'active'}}]});
 assert.deepEqual((await loadAppBranding(db,'user')).appExperience,{ios:'standard',android:'standard'});
 assert.deepEqual((await loadAppBranding(db,'user','team')).appExperience,{ios:'clay',android:'standard'});
 await db.collection('account-closure-jobs').doc('user').set({status:'pending'});
 await assert.rejects(loadAppBranding(db,'user','team'),e=>e.statusCode===403);
});
function primaryFixture(coachMembers=[{teamId:'team',organizationId:'org',role:'coach'}],primaryCoachUserId='coach'){
 const f=createFirestoreAdminMock({collections:{users:[{id:'user',data:{primaryCoachUserId}}],
 'pulsecheck-team-memberships':[{id:'a',data:{userId:'user',teamId:'team',organizationId:'org',role:'athlete',status:'active'}},{id:'b',data:{userId:'user',teamId:'team2',organizationId:'org2',role:'athlete',status:'active'}},...coachMembers.map((m,i)=>({id:`coach-${i}`,data:{userId:'coach',status:'active',...m}}))],
 'pulsecheck-teams':[{id:'team',data:{organizationId:'org',status:'active'}},{id:'team2',data:{organizationId:'org2',status:'active'}}],
 'pulsecheck-organizations':[{id:'org',data:{status:'active',appExperience:{ios:'clay',android:'standard'},appBranding:{pulsecheck:'athleticmind'}}},{id:'org2',data:{status:'active',appExperience:{ios:'standard',android:'standard'}}}]}});return f;
}
test('saved primary coach resolves appearance only across multiple organizations',async()=>{
 const result=await loadAppBranding(primaryFixture().db,'user');assert.deepEqual(result.appExperience,{ios:'clay',android:'standard'});assert.deepEqual(result.appBranding,defaults.appBranding);
 const selected=await loadAppBranding(primaryFixture().db,'user','team2');assert.deepEqual(selected.appExperience,{ios:'standard',android:'standard'});
 const titled=primaryFixture([{teamId:'team',organizationId:'org',role:'performance-staff',title:'Head Coach'}]);assert.equal((await loadAppBranding(titled.db,'user')).appExperience.ios,'clay');
});
test('missing foreign revoked inactive mismatched or ambiguous primary coach defaults to standard',async()=>{
 for(const f of [primaryFixture([],'' ),primaryFixture(undefined,'foreign'),primaryFixture([{teamId:'team',organizationId:'org',role:'coach',revokedAt:1}]),primaryFixture([{teamId:'team',organizationId:'org',role:'coach',status:'inactive'}]),primaryFixture([{teamId:'team',organizationId:'org2',role:'coach'}]),primaryFixture([{teamId:'team',organizationId:'org',role:'athlete',title:'Coach'}]),primaryFixture([{teamId:'team',organizationId:'org',role:'coach'},{teamId:'team2',organizationId:'org2',role:'coach'}])])assert.equal((await loadAppBranding(f.db,'user')).appExperience.ios,'standard');
 const closed=primaryFixture();await closed.db.collection('account-closure-jobs').doc('coach').set({status:'pending'});assert.equal((await loadAppBranding(closed.db,'user')).appExperience.ios,'standard');
});
test('multiple verified shared teams in one organization remain unambiguous',async()=>{
 const f=primaryFixture([{teamId:'team',organizationId:'org',role:'coach'},{teamId:'team3',organizationId:'org',role:'coach'}]);
 await f.db.collection('pulsecheck-teams').doc('team3').set({organizationId:'org',status:'active'});await f.db.collection('pulsecheck-team-memberships').doc('c').set({userId:'user',teamId:'team3',organizationId:'org',role:'athlete',status:'active'});
 assert.equal((await loadAppBranding(f.db,'user')).appExperience.ios,'clay');
 await f.db.collection('pulsecheck-teams').doc('team').set({status:'archived'},{merge:true});await f.db.collection('pulsecheck-teams').doc('team3').set({status:'archived'},{merge:true});assert.equal((await loadAppBranding(f.db,'user')).appExperience.ios,'standard');
});

test('authorized Android appearance is independent of iOS and defaults for missing data',async()=>{
 const orgs=[{id:'org',data:{status:'active',productBrand:'pulsecheck',appExperience:{ios:'standard',android:'clay'}}}];
 assert.deepEqual((await loadAppBranding(fixture({orgs}),'user','team')).appExperience,{ios:'standard',android:'clay'});
 const legacy=[{id:'org',data:{status:'active',appExperience:{ios:'clay'}}}];
 assert.deepEqual((await loadAppBranding(fixture({orgs:legacy}),'user')).appExperience,{ios:'clay',android:'standard'});
});
