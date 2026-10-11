const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Firestore } = require('@google-cloud/firestore');
const keys = require('../../../netlify/functions/lib/partner-api-keys');
const host = process.env.FIRESTORE_EMULATOR_HOST;
const env = { PARTNER_API_KEY_ENCRYPTION_KEYS_JSON: JSON.stringify({ v1: Buffer.alloc(32, 7).toString('base64') }), PARTNER_API_KEY_ACTIVE_ENCRYPTION_VERSION: 'v1' };
const now = Date.parse('2026-10-11T12:00:00Z');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
test('encrypted partner key lifecycle, atomic scopes and quotas, revocation, rotation and one-time retrieval', { skip: host !== '127.0.0.1:8188' }, async () => {
 const db = new Firestore({ projectId: 'demo-partner-key-lifecycle' });
 try {
  for (const name of Object.values(keys.COLLECTIONS)) { const docs=await db.collection(name).get();for(const doc of docs.docs) await doc.ref.delete(); }
  for(const [id,brand] of [['synthetic-org','athleticmind'],['synthetic-other','athleticmind'],['synthetic-pc','pulsecheck']])await db.doc(`pulsecheck-organizations/${id}`).set({status:'active',productBrand:brand});
  for(const [id,org] of [['synthetic-team','synthetic-org'],['synthetic-other-team','synthetic-other'],['synthetic-pc-team','synthetic-pc']])await db.doc(`pulsecheck-teams/${id}`).set({status:'active',organizationId:org});
  const request=await keys.requestPartnerAccess(db,{organizationName:'Synthetic',contactName:'Developer',contactEmail:'dev@synthetic.example',intendedUse:'Synthetic test only',address:'local',now});
  assert.equal(request.status,'pending');assert.equal((await db.collection(keys.COLLECTIONS.keys).get()).size,0);
  const input={requestId:request.requestId,partnerId:'auntedna',partnerName:'AuntEdna',grants:[{organizationId:'synthetic-org',teamIds:['synthetic-team']}],scopes:[keys.SCOPE],environment:'test',expiresAt:new Date(now+86400000).toISOString(),maxRequestsPerMinute:2,actorEmail:'admin@synthetic.example',now,env};
  await assert.rejects(keys.approvePartnerAccessRequest(db,{...input,grants:[{organizationId:'synthetic-pc',teamIds:['synthetic-pc-team']}]}),/invalid_saved/);
  await assert.rejects(keys.approvePartnerAccessRequest(db,{...input,grants:[{organizationId:'synthetic-org',teamIds:['synthetic-other-team']}]}),/invalid_saved/);
  await assert.rejects(keys.approvePartnerAccessRequest(db,{...input,scopes:['clinical.read']}),/invalid_key_scope/);
  await assert.rejects(keys.approvePartnerAccessRequest(db,{...input,env:{}}),/key_encryption_unavailable/);
  const issued=await keys.approvePartnerAccessRequest(db,input);assert.match(issued.key.keyId,/^pk_/);assert.ok(issued.secret.length>=40);
  await assert.rejects(keys.approvePartnerAccessRequest(db,input),/request_not_pending/);
  const saved=(await db.doc(`${keys.COLLECTIONS.keys}/${hash(issued.key.keyId)}`).get()).data();assert.equal(saved.encryptedSecret.version,'v1');
  const all=await keys.listPartnerAccess(db);assert.equal(JSON.stringify(all).includes(issued.secret),false);assert.equal(JSON.stringify(all).includes('encryptedSecret'),false);
  const disk=await db.collection(keys.COLLECTIONS.keys).get();assert.equal(JSON.stringify(disk.docs.map(d=>d.data())).includes(issued.secret),false);
  function requestAuth(pair,at=now,extra={}) {const rawBody='{"synthetic":true}',path='/synthetic',t=Math.floor(at/1000);return {keyId:pair.key.keyId,signature:`t=${t},v1=${crypto.createHmac('sha256',pair.secret).update(`${t}.POST.${path}.${rawBody}`).digest('hex')}`,method:'POST',path,rawBody,scope:keys.SCOPE,environment:'test',teamId:'synthetic-team',now:at,env,...extra};}
  assert.equal((await keys.authenticatePartnerRequest(db,requestAuth(issued,now,{environment:'production'}))).ok,false);
  assert.equal((await keys.authenticatePartnerRequest(db,requestAuth(issued,now,{teamId:'synthetic-other-team'}))).ok,false);
  assert.equal((await keys.authenticatePartnerRequest(db,requestAuth(issued,now,{rawBody:'tampered'}))).ok,false);
  const checks=await Promise.all(Array.from({length:4},()=>keys.authenticatePartnerRequest(db,requestAuth(issued))));assert.equal(checks.filter(x=>x.ok).length,2);assert.equal(checks.filter(x=>x.reason==='rate_limited').length,2);
  const principal=checks.find(x=>x.ok).principal;
  assert.equal((await keys.revalidatePartnerPrincipal(db,{principal,teamId:'synthetic-team',scope:keys.SCOPE,environment:'test',now})).ok,true);
  const rotated=await keys.rotatePartnerKey(db,{keyId:issued.key.keyId,overlapMinutes:1,actorEmail:input.actorEmail,now:now+60000,env});
  assert.equal((await keys.authenticatePartnerRequest(db,requestAuth(issued,now+60001))).ok,true);
  assert.equal((await keys.authenticatePartnerRequest(db,requestAuth(issued,now+120000))).ok,false);
  assert.equal((await keys.authenticatePartnerRequest(db,requestAuth(rotated,now+120000))).ok,true);
  assert.equal((await keys.authenticatePartnerRequest(db,requestAuth(rotated,now+86400000))).ok,false);
  await keys.revokePartnerKey(db,{keyId:rotated.key.keyId,actorEmail:input.actorEmail,now:now+121000});
  assert.equal((await keys.authenticatePartnerRequest(db,requestAuth(rotated,now+122000))).ok,false);
  assert.equal((await keys.revalidatePartnerPrincipal(db,{principal:{...principal,keyId:rotated.key.keyId},teamId:'synthetic-team',scope:keys.SCOPE,environment:'test',now:now+122000})).ok,false);
  const audit=await db.collection(keys.COLLECTIONS.audit).get();assert.ok(audit.docs.some(d=>d.data().action==='key_revoked'));assert.equal(JSON.stringify(audit.docs.map(d=>d.data())).includes(issued.secret),false);
  const batch=db.batch();for(let i=0;i<201;i++)batch.set(db.collection(keys.COLLECTIONS.requests).doc(`synthetic-page-${String(i).padStart(3,'0')}`),{requestId:`synthetic-page-${i}`,status:'pending'});await batch.commit();
  const page=await keys.listPartnerAccess(db);assert.equal(page.requests.length,200);assert.equal(page.pagination.requests.hasMore,true);assert.ok(page.keys.length>0);
  const nextPage=await keys.listPartnerAccess(db,{cursors:{requests:page.pagination.requests.cursor}});assert.ok(nextPage.requests.length>0);assert.equal(nextPage.pagination.requests.hasMore,false);
  for(let i=0;i<4;i++)await keys.requestPartnerAccess(db,{organizationName:'Synthetic',contactName:'Dev',contactEmail:'dev@synthetic.example',intendedUse:'Synthetic',address:'local',now});
  await assert.rejects(keys.requestPartnerAccess(db,{organizationName:'Synthetic',contactName:'Dev',contactEmail:'dev@synthetic.example',intendedUse:'Synthetic',address:'local',now}),/rate_limited/);
 } finally {await db.terminate();}
});

test('partner zero grants, dynamic all-AM, and transactional withdrawal preserve scope', { skip: host !== '127.0.0.1:8188' }, async () => {
 const db = new Firestore({ projectId: 'demo-partner-grants-lifecycle' });
 try {
  for (const name of Object.values(keys.COLLECTIONS)) { const docs=await db.collection(name).get();for(const doc of docs.docs) await doc.ref.delete(); }
  const request = await keys.requestPartnerAccess(db, { organizationName:'Synthetic Partner',contactName:'Developer',contactEmail:'dev@example.invalid',intendedUse:'Synthetic grants',address:'scope-test',now });
  const issued = await keys.approvePartnerAccessRequest(db, {requestId:request.requestId,partnerId:'auntedna',partnerName:'AuntEdna',scopeMode:'explicit',grants:[],scopes:[keys.SCOPE],environment:'test',expiresAt:new Date(now+86400000).toISOString(),actorEmail:'admin@example.invalid',now,env});
  const auth = pair => { const rawBody='{}',path='/synthetic',t=Math.floor(now/1000);return {keyId:pair.key.keyId,signature:`t=${t},v1=${crypto.createHmac('sha256',pair.secret).update(`${t}.POST.${path}.${rawBody}`).digest('hex')}`,method:'POST',path,rawBody,scope:keys.SCOPE,environment:'test',teamId:'synthetic-team',now,env}; };
  assert.equal((await keys.authenticatePartnerRequest(db,auth(issued))).reason,'scope_not_authorized');
  await keys.updatePartnerKeyGrants(db,{keyId:issued.key.keyId,scopeMode:'all-athleticmind',grants:[],actorEmail:'admin@example.invalid',now});
  await db.doc('pulsecheck-organizations/synthetic-org').set({status:'active',productBrand:'athleticmind'});
  await db.doc('pulsecheck-teams/synthetic-team').set({status:'active',organizationId:'synthetic-org'});
  assert.equal((await keys.authenticatePartnerRequest(db,auth(issued))).ok,true);
  const replacement=await keys.rotatePartnerKey(db,{keyId:issued.key.keyId,overlapMinutes:30,actorEmail:'admin@example.invalid',now,env});
  await keys.updatePartnerKeyGrants(db,{keyId:replacement.key.keyId,scopeMode:'explicit',grants:[],actorEmail:'admin@example.invalid',now});
  assert.equal((await keys.authenticatePartnerRequest(db,auth(issued))).reason,'invalid_authentication');
  assert.equal((await keys.authenticatePartnerRequest(db,auth(replacement))).reason,'scope_not_authorized');
 } finally {await db.terminate();}
});
