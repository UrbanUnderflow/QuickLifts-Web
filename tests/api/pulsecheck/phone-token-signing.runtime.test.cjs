const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTokenSigner } = require('../../../src/lib/server/firebase/custom-token');
const config = { source: 'dev:service-account-impersonation', projectId: 'dev-project', clientEmail: 'target@dev-project.iam.gserviceaccount.com', sourceCredential: { projectId: 'source-project', clientEmail: 'source@source-project.iam.gserviceaccount.com', privateKey: 'synthetic-test-only' } };
test('production uses the existing project signer', async () => {
  const calls=[];const sign=createTokenSigner({ resolveCredential:()=>({source:'prod:service-account'}),findApp:()=>{throw Error('unexpected secondary signer')} });
  assert.equal(await sign({auth:()=>({createCustomToken:async uid=>{calls.push(uid);return 'test-token'}})},'verified-owner','prod'),'test-token');assert.deepEqual(calls,['verified-owner']);
});
test('development IAM signing stays in the verified project and reuses existing impersonation authority', async () => {
  let options;let requestedUID;
  const sign=createTokenSigner({resolveCredential:()=>config,findApp:()=>null,firebaseAdmin:{credential:{cert:source=>{assert.equal(source.clientEmail,config.sourceCredential.clientEmail);return {getAccessToken:async()=>({access_token:'source-access',expires_in:60})}}},initializeApp:(input,name)=>{options=input;assert.equal(name,'phone-token-signer-dev-project');return {auth:()=>({createCustomToken:async uid=>{requestedUID=uid;return 'dev-token'}})}}}});
  assert.equal(await sign({options:{projectId:'dev-project'}},'verified-owner','dev'),'dev-token');
  assert.equal(options.projectId,'dev-project');assert.equal(options.serviceAccountId,config.clientEmail);assert.equal(requestedUID,'verified-owner');assert.equal((await options.credential.getAccessToken()).access_token,'source-access');
});
test('mismatched projects fail closed before minting a token', async () => {
  const sign=createTokenSigner({resolveCredential:()=>config,findApp:()=>{throw Error('must not reach signer')}});
  await assert.rejects(sign({options:{projectId:'production-project'}},'verified-owner','dev'),/does not match/);
});
test('existing dev signer is reused without private-key creation or credential reconstruction', async () => {
  const sign=createTokenSigner({resolveCredential:()=>config,findApp:()=>({auth:()=>({createCustomToken:async uid=>'token:'+uid})}),firebaseAdmin:{}});
  assert.equal(await sign({options:{projectId:'dev-project'}},'verified-owner','dev'),'token:verified-owner');
});
