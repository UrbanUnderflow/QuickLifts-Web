const test = require('node:test');
const assert = require('node:assert/strict');
const { createFirestoreAdminMock } = require('../firebase-admin/_runtimeHarness.cjs');
const { loadAppBranding, createHandler } = require('../../../netlify/functions/get-pulsecheck-app-branding');
const defaults = {appBranding:{pulsecheck:'pulsecheck',athleticmind:'athleticmind'}};
function fixture({members,teams,orgs} = {}) {
  return createFirestoreAdminMock({collections:{
    'pulsecheck-team-memberships': members || [{id:'m',data:{userId:'user',teamId:'team',organizationId:'org',status:'active'}}],
    'pulsecheck-teams': teams || [{id:'team',data:{organizationId:'org',status:'active'}}],
    'pulsecheck-organizations': orgs || [{id:'org',data:{status:'active',productBrand:'pulsecheck',appBranding:{pulsecheck:'athleticmind'}}}],
  }}).db;
}
test('active organization app override is returned without product or clinical fields', async () => {
  assert.deepEqual(await loadAppBranding(fixture(),'user'),{appBranding:{pulsecheck:'athleticmind',athleticmind:'athleticmind'}});
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
  assert.deepEqual(JSON.parse(response.body),{appBranding:{pulsecheck:'athleticmind',athleticmind:'athleticmind'}});
  assert.equal((await createHandler({authorize:async()=>{throw Error('expired')}})(event)).statusCode,401);
});
