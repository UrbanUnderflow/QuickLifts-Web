import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { communicationSetting } from '../../src/lib/coach-communications/config';
import { providerConfigured, smsProvider, smsSender, telnyxWebhookUrl, verifyTelnyxEvent, telnyxIncomingForm } from '../../src/lib/coach-communications/provider';
import { transportReady } from '../../src/lib/coach-communications/service';
import { athleticMindTelnyxProfile } from '../../src/lib/coach-communications/account-profile';

const keyPair = generateKeyPairSync('ed25519');
const config = { p: 'telnyx', m: 'prod', h: true, n: '+12025550123', id: '4001a1ad-6b2f-48b5-a63c-217fa1ae9d74',
  k: keyPair.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64'), u: 'https://example.test/api/coach/communications/telnyx-webhook' };
function environment(t: any) {
  const keys = Object.keys(process.env).filter(key => /^(COACH_COMMUNICATIONS_|COACH_SMS_CONFIG$|TELNYX_)/.test(key));
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  t.after(() => {
    for (const key of Object.keys(process.env).filter(key => /^(COACH_COMMUNICATIONS_|COACH_SMS_CONFIG$|TELNYX_)/.test(key))) delete process.env[key];
    Object.assign(process.env, before);
  });
  process.env.TELNYX_API_KEY = 'synthetic';
  process.env.COACH_SMS_CONFIG = JSON.stringify(config);
}

test('compact config preserves Telnyx validation and keeps sending paused by default', t => {
  environment(t);
  assert.equal(smsProvider(), 'telnyx'); assert.equal(smsSender(), config.n); assert.equal(telnyxWebhookUrl(), config.u);
  assert.equal(providerConfigured(), true); assert.equal(transportReady('prod'), false);
  process.env.COACH_SMS_CONFIG = JSON.stringify({...config, s: true});
  assert.equal(transportReady('prod'), false);
  process.env.COACH_SMS_CONFIG = JSON.stringify({...config, s: true, w: true});
  assert.equal(transportReady('prod'), true); assert.equal(transportReady('dev'), false);
  delete process.env.TELNYX_API_KEY;
  assert.equal(providerConfigured(), false);
});

test('malformed, missing, wrong-type compact gates fail closed', t => {
  environment(t);
  for (const value of ['{', 'null', '[]', JSON.stringify({...config,s:'true',w:true}), JSON.stringify({...config,s:true,w:true,h:'true'})]) {
    process.env.COACH_SMS_CONFIG = value;
    assert.equal(transportReady('prod'), false, value);
  }
});

test('legacy explicit settings always override compact settings, including paused or empty values', t => {
  environment(t);
  process.env.COACH_SMS_CONFIG = JSON.stringify({...config,s:true,w:true});
  process.env.COACH_COMMUNICATIONS_SMS_ENABLED = 'false';
  assert.equal(transportReady('prod'), false);
  process.env.COACH_COMMUNICATIONS_SMS_ENABLED = '';
  assert.equal(communicationSetting('COACH_COMMUNICATIONS_SMS_ENABLED'), '');
  assert.equal(transportReady('prod'), false);
  process.env.TELNYX_MESSAGING_PROFILE_ID = 'wrong-profile';
  assert.equal(providerConfigured(), false);
});

test('compact public key and profile verify real synthetic signatures and bind sender', t => {
  environment(t);
  const timestamp = String(Math.floor(Date.now()/1000));
  const event = { id: '86f58db9-0fe3-4adc-9d1f-46e66e6e9323', event_type: 'message.received',
    payload: { id:'40385f64-5717-4562-b3fc-2c963f66afa6',type:'SMS',direction:'inbound',messaging_profile_id:config.id,
      from:{phone_number:'+12025550999'},to:[{phone_number:config.n}],text:'STOP' } };
  const raw = Buffer.from(JSON.stringify({data:event}));
  const signature = sign(null,Buffer.concat([Buffer.from(timestamp+'|'),raw]),keyPair.privateKey).toString('base64');
  assert.deepEqual(verifyTelnyxEvent(raw,signature,timestamp), event);
  assert.equal(telnyxIncomingForm(event)?.To, config.n);
  process.env.TELNYX_FROM_NUMBER = '+12025550777';
  assert.equal(telnyxIncomingForm(event), null);
  process.env.TELNYX_MESSAGING_PROFILE_ID = '00000000-0000-0000-0000-000000000000';
  assert.equal(verifyTelnyxEvent(raw,signature,timestamp), null);
});

test('named public profile never supplies activation gates and supports explicit overrides', t => {
  environment(t);
  process.env.COACH_SMS_CONFIG = JSON.stringify({ account: 'athleticmind' });
  assert.equal(communicationSetting('TELNYX_FROM_NUMBER'), athleticMindTelnyxProfile.n);
  assert.equal(communicationSetting('COACH_COMMUNICATIONS_SMS_PROVIDER'), undefined);
  assert.equal(communicationSetting('COACH_COMMUNICATIONS_FIREBASE_MODE'), undefined);
  assert.equal(transportReady('prod'), false);
  process.env.COACH_SMS_CONFIG = JSON.stringify({p:'telnyx',m:'prod',h:true,account:'athleticmind'});
  assert.equal(providerConfigured(), true);
  assert.equal(transportReady('prod'), false);
  process.env.COACH_SMS_CONFIG = JSON.stringify({p:'telnyx',m:'prod',h:true,s:true,w:true,account:'unknown'});
  assert.equal(providerConfigured(), false);
  assert.equal(transportReady('prod'), false);
  process.env.COACH_SMS_CONFIG = JSON.stringify({p:'telnyx',m:'prod',h:true,account:'athleticmind',n:''});
  assert.equal(smsSender(), '');
  assert.equal(providerConfigured(), false);
});

test('recorded-consent rollout uses compact boolean c and explicit legacy precedence', t => {
  environment(t);
  const key = 'COACH_COMMUNICATIONS_REQUIRE_RECORDED_CONSENT';
  assert.equal(communicationSetting(key), undefined);
  for (const value of [true, false, 'true', 1, null]) {
    process.env.COACH_SMS_CONFIG = JSON.stringify({ ...config, c: value });
    assert.equal(communicationSetting(key), value === true ? 'true' : value === false ? 'false' : undefined);
  }
  process.env.COACH_SMS_CONFIG = JSON.stringify({ ...config, c: true });
  process.env[key] = 'false'; assert.equal(communicationSetting(key), 'false');
  process.env[key] = ''; assert.equal(communicationSetting(key), '');
  process.env[key] = 'true'; assert.equal(communicationSetting(key), 'true');
  assert.equal(transportReady('prod'), false); // This policy never activates delivery.
});
