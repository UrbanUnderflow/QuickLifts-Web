import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAppVersionWritePayload, normalizeAppVersionDocument, APP_VERSION_PRODUCT_CONFIGS } from '../../src/utils/appVersioning';
import { emptyInAppMessage, safeInAppMessageURL, validateInAppMessage, normalizeInAppAnnouncement, inAppAnnouncementDisablePatch } from '../../src/utils/inAppMessages';

test('CTA links accept HTTPS and internal routes, rejecting executable or ambiguous URLs',()=>{
  assert.equal(safeInAppMessageURL('/PulseCheck/baseline'),'/PulseCheck/baseline');
  assert.equal(safeInAppMessageURL('https://fitwithpulse.ai/PulseCheck/baseline'),'https://fitwithpulse.ai/PulseCheck/baseline');
  for(const url of ['javascript:alert(1)','data:text/html,<script>','http://example.com','//example.com','/\\example.com','https://user:password@example.com','/foo\nbar'])assert.equal(safeInAppMessageURL(url),null);
});
test('publishing a message requires title, body and a label for its link',()=>{
  assert.throws(()=>validateInAppMessage({...emptyInAppMessage(),isEnabled:true}),/title/);
  assert.throws(()=>validateInAppMessage({...emptyInAppMessage(),isEnabled:true,title:'Start here',markdown:'Take your baseline.',actionURL:'/PulseCheck/baseline'}),/label/);
  assert.equal(validateInAppMessage({...emptyInAppMessage(),isEnabled:true,title:' Start here ',markdown:' **Baseline** ',actionURL:'/PulseCheck/baseline',actionLabel:'Begin'}).title,'Start here');
});
test('per-release highlights persist without changing critical update or legacy fields',()=>{
  const message={...emptyInAppMessage(),isEnabled:true,title:'New tools',markdown:'## Train\n\n- One clear start'};
  const payload=buildAppVersionWritePayload(['Existing note'],true,[],'17',message);
  assert.equal(payload.isCriticalUpdate,true);assert.equal(payload['1'],'Existing note');assert.deepEqual(payload.whatsNew,message);
  assert.deepEqual(normalizeAppVersionDocument('1.2',payload).whatsNew,message);
  assert.equal(normalizeAppVersionDocument('1.1',{changeNotes:['Old note']}).whatsNew,null);
});
test('announcements retain campaign and revision identity with a closed audience vocabulary',()=>{
  const result=normalizeInAppAnnouncement({isEnabled:true,id:'campaign',revision:'r2',title:'Hello',markdown:'Body',audience:'coaches',actionURL:'javascript:bad()'});
  assert.equal(result?.id,'campaign');assert.equal(result?.revision,'r2');assert.equal(result?.audience,'coaches');assert.equal(result?.actionURL,'');
  assert.equal(normalizeInAppAnnouncement({audience:'unexpected'})?.audience,'all');
});
test('AthleticMind uses its own version and config namespace',()=>{
  assert.deepEqual(APP_VERSION_PRODUCT_CONFIGS.athleticMind.versionCollections,['athleticmind-version','athleticmind-versions']);
  assert.equal(APP_VERSION_PRODUCT_CONFIGS.athleticMind.appIdentity,'athleticmind');
});

test('turning off an announcement writes only the enabled flag, never a local draft',()=>{
  assert.deepEqual(inAppAnnouncementDisablePatch(),{isEnabled:false});
});
test('publishing a release with disabled highlights excludes unpublished Markdown and links',()=>{
  const draft={isEnabled:false,title:'PRIVATE DRAFT',markdown:'Unpublished content',actionLabel:'Draft action',actionURL:'javascript:unpublished()'};
  const payload=buildAppVersionWritePayload(['Published note'],false,[],'18',draft);
  assert.deepEqual(payload.whatsNew,emptyInAppMessage());
  assert.equal(JSON.stringify(payload).includes('PRIVATE DRAFT'),false);
  assert.equal(JSON.stringify(payload).includes('Unpublished content'),false);
});
