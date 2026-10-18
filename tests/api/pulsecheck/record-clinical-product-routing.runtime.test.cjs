const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
function fixture(productBrand = 'athleticmind') {
  const data = new Map(Object.entries({
    'pulsecheck-teams/team': { organizationId: 'org', status: 'active', displayName: 'Synthetic Team' },
    'pulsecheck-organizations/org': { productBrand, status: 'active' },
    'pulsecheck-team-memberships/team_athlete': { teamId: 'team', organizationId: 'org', userId: 'athlete', role: 'athlete', status: 'active' },
    'pulsecheck-team-memberships/team_clinician': { teamId: 'team', organizationId: 'org', userId: 'clinician', role: 'clinician', status: 'active', email: 'clinician@example.test', phone: '+15555550123' },
  }));
  const writes = [], emails = [], texts = [];
  let tail = Promise.resolve(), failSafety = false, emailResult = { success: true, messageId: 'email-1' }, smsResult = { success: true, messageSid: 'sms-1' }, releaseEmail = null;
  const ref = key => ({ id: key.split('/').at(-1), key,
    async get() { return { id: this.id, exists: data.has(key), data: () => data.get(key) }; },
    async set(value, options) { if (key.startsWith('pulsecheck-athlete-safety-state/') && failSafety) throw new Error('Injected safety failure'); data.set(key, options?.merge ? { ...data.get(key), ...structuredClone(value) } : structuredClone(value)); writes.push(key); },
  });
  const query = (name, filters = [], cap = Infinity) => ({
    doc(id) { return ref(`${name}/${id}`); },
    where(field, op, value) { return query(name, [...filters, [field,op,value]], cap); },
    orderBy() { return this; },
    limit(value) { return query(name, filters, value); },
    async get() { const docs = [...data].filter(([key,value]) => key.startsWith(name+'/') && filters.every(([f,o,v]) => o === 'in' ? v.includes(value[f]) : value[f] === v)).slice(0,cap).map(([key,value]) => ({ id: key.split('/').at(-1), exists: true, data: () => value })); return { docs, empty: !docs.length }; },
  });
  const db = { collection: name => query(name), runTransaction(fn) {
    const result = tail.then(async () => { const pending = []; const value = await fn({ get: r => r.get(), set: (r,v,o) => pending.push([r,v,o]) }); for (const [r,v,o] of pending) await r.set(v,o); return value; }); tail = result.catch(() => {}); return result;
  } };
  const firestore = () => db; firestore.FieldValue = { serverTimestamp: () => 1800000000 };
  const mocks = {
    'config/firebase.js': { headers: {}, admin: { firestore, auth: () => ({ verifyIdToken: async token => ({ uid: token }) }) }, initializeFirebaseAdmin() {}, getFirebaseAdminApp() {} },
    'utils/sendBrevoTransactionalEmail.js': { buildEmailDedupeKey: parts => parts.join('|'), sendBrevoTransactionalEmail: async message => { emails.push(message); if (releaseEmail) await releaseEmail; if (emailResult instanceof Error) throw emailResult; return emailResult; } },
    'utils/sendTwilioSms.js': { sendTwilioSms: async message => { texts.push(message); return smsResult; } },
  };
  for (const [file,exports] of Object.entries(mocks)) { const filename = path.join(root,'netlify/functions',file); require.cache[filename] = { id:filename, filename,loaded:true,exports }; }
  for (const file of ['record-clinical-escalation.js','clinical-responder.js']) delete require.cache[path.join(root,'netlify/functions',file)];
  const { _private: { runIncident } } = require(path.join(root,'netlify/functions/record-clinical-escalation.js'));
  const { _private: { processRequest } } = require(path.join(root,'netlify/functions/clinical-responder.js'));
  const request = async (extra = {}, uid = 'athlete') => {
    try { return await runIncident({db,decoded:{uid},now:()=>1800000000,body:{athleteUserId:'athlete',teamId:'team',tier:3,signalSource:'checkin',detectedAt:1800000000,...extra}}); }
    catch(error) { return {statusCode:error.statusCode || 500, body:JSON.stringify({error:error.message})}; }
  };
  return {data,writes,emails,texts,request, responder: body => processRequest(db,{uid:body.uid || 'clinician'},body),
    safetyFails: value=>failSafety=value, emailReturns:value=>emailResult=value, smsReturns:value=>smsResult=value,
    pauseEmail:promise=>releaseEmail=promise };
}
const body = response => JSON.parse(response.body);
test('PulseCheck uses only resources and safety state, ignores supplied brand', async () => {
 const f=fixture('pulsecheck'); const r=await f.request({productBrand:'athleticmind'});
 assert.equal(r.statusCode,200); assert.equal(body(r).supportRoute,'hotline'); assert.equal(body(r).providerConfirmed,false); assert.equal(f.emails.length,0); assert.equal(f.texts.length,0);
});
test('AthleticMind routes to current designated clinician with no contact/evidence in response', async () => {
 const f=fixture(); const r=await f.request({evidence:[{label:'secret',excerpt:'private content'}]});
 assert.equal(r.statusCode,200); assert.equal(f.emails.length,1); assert.equal(f.texts.length,1); assert.equal(body(r).clinician,undefined);
 assert.equal(JSON.stringify([...f.data.values()]).includes('private content'),false); assert.equal(JSON.stringify(f.emails).includes('private content'),false);
});
for(const change of ['foreign-team','wrong-org','revoked-athlete','revoked-clinician','assigned-out','archived-team','inactive-org','missing-product']) test(`no writes or delivery for ${change}`, async()=>{
 const f=fixture(); const extra={};
 if(change==='foreign-team') extra.teamId='other';
 if(change==='wrong-org') extra.organizationId='other';
 if(change==='revoked-athlete') f.data.get('pulsecheck-team-memberships/team_athlete').revokedAt=1;
 if(change==='revoked-clinician') f.data.get('pulsecheck-team-memberships/team_clinician').revokedAt=1;
 if(change==='assigned-out') Object.assign(f.data.get('pulsecheck-team-memberships/team_clinician'),{rosterVisibilityScope:'assigned',allowedAthleteIds:['other']});
 if(change==='archived-team') f.data.get('pulsecheck-teams/team').archivedAt=1;
 if(change==='inactive-org') f.data.get('pulsecheck-organizations/org').status='inactive';
 if(change==='missing-product') delete f.data.get('pulsecheck-organizations/org').productBrand;
 assert.ok((await f.request(extra)).statusCode>=400); assert.equal(f.writes.length,0); assert.equal(f.emails.length,0);
});
for(const decision of ['missing','accepted','declined','revoked','expired']) test(`routine tier cannot bypass canonical consent (${decision})`,async()=>{
 const f=fixture(); assert.equal((await f.request({tier:2,consentStatus:decision})).statusCode,400); assert.equal(f.writes.length,0);
});
test('successful deliveries are not repeated; failed safety stage resumes',async()=>{
 const f=fixture(); f.safetyFails(true); const first=await f.request(); assert.equal(first.statusCode,502);
 f.safetyFails(false); const retry=await f.request(); assert.equal(retry.statusCode,200); assert.equal(f.emails.length,1); assert.equal(f.texts.length,1);
 const repeat=await f.request(); assert.equal(repeat.statusCode,200); assert.equal(body(repeat).recorded,false); assert.equal(f.emails.length,1);
});
test('definitively failed channel resumes without replaying successful channel',async()=>{
 const f=fixture(); f.emailReturns({success:false}); assert.equal((await f.request()).statusCode,502);
 f.emailReturns({success:true,messageId:'email-retry'}); assert.equal((await f.request()).statusCode,200); assert.equal(f.emails.length,2); assert.equal(f.texts.length,1);
});
test('unknown outbound outcome remains unknown on retry and never claims success',async()=>{
 const f=fixture(); f.emailReturns(new Error('socket reset')); assert.equal((await f.request()).statusCode,502);
 const retry=await f.request(); assert.equal(retry.statusCode,502); assert.equal(body(retry).stageStatus.email,'unknown'); assert.equal(f.emails.length,1);
});
test('concurrent requests share one incident and one outbound attempt',async()=>{
 const f=fixture(); let release; f.pauseEmail(new Promise(resolve=>release=resolve));
 const first=f.request(); while(!f.emails.length) await new Promise(resolve=>setImmediate(resolve));
 const second=await f.request(); assert.equal(second.statusCode,202); release(); assert.equal((await first).statusCode,200); assert.equal(f.emails.length,1); assert.equal(f.texts.length,1);
});
test('responder list/get/ack/resolve is minimal, idempotent and preserves safety wall',async()=>{
 const f=fixture(); const id=body(await f.request()).escalationId;
 const queue=await f.responder({action:'list'}); assert.equal(queue.records.length,1); assert.deepEqual(queue.records[0].evidence,[]);
 await assert.rejects(f.responder({action:'resolve',escalationId:id,resolutionNote:'contacted'}),/Acknowledge/);
 await f.responder({action:'acknowledge',escalationId:id}); await f.responder({action:'acknowledge',escalationId:id});
 const result=await f.responder({action:'resolve',escalationId:id,resolutionNote:'Synthetic response documented'});
 assert.equal(result.resolved,true); assert.equal(result.providerConfirmed,false); assert.equal(f.data.get('pulsecheck-athlete-safety-state/athlete').crisisWallActive,true);
});
for(const change of ['foreign-user','revoked','assigned-out']) test(`responder ${change} denied read and acknowledgement`,async()=>{
 const f=fixture(); const id=body(await f.request()).escalationId;
 if(change==='revoked') f.data.get('pulsecheck-team-memberships/team_clinician').revokedAt=1;
 if(change==='assigned-out') Object.assign(f.data.get('pulsecheck-team-memberships/team_clinician'),{rosterVisibilityScope:'assigned',allowedAthleteIds:[]});
 for(const action of ['get','acknowledge']) await assert.rejects(f.responder({action,escalationId:id,uid:change==='foreign-user'?'other':'clinician'}));
});
module.exports={fixture};


test('SMS transport uncertainty stays unknown and is not automatically resent', async () => {
 const f=fixture(); f.smsReturns({ success:false, outcomeUnknown:true });
 assert.equal((await f.request()).statusCode,502);
 assert.equal((await f.request()).statusCode,502); assert.equal(f.texts.length,1); assert.equal(f.emails.length,1);
});
test('a provider helper skipped/in-progress response without a receipt is not confirmed delivery', async () => {
 const f=fixture(); f.emailReturns({ success:true, skipped:true });
 const r=await f.request(); assert.equal(r.statusCode,502); assert.equal(body(r).stageStatus.email,'unknown');
});
test('legacy incident with a previously successful page is resumed without repaging', async () => {
 const f=fixture();
 const bucket=new Date(Math.floor(1800000000/3600)*3600*1000).toISOString().slice(0,16);
 f.data.set('pulsecheck-clinical-escalations/legacy', {athleteUserId:'athlete',teamId:'team',organizationId:'org',tier:3,signalSource:'checkin',detectedAt:1800000000,
   supportRoute:'clinician',productBrand:'athleticmind',pagedClinicianMembershipId:'team_clinician',dedupeKey:`athlete|checkin|${bucket}`,
   emailDelivery:{success:true,messageId:'old-email'},smsDelivery:{success:true,messageSid:'old-sms'},deliveryStatus:'clinician_paged'});
 const r=await f.request(); assert.equal(r.statusCode,200); assert.equal(body(r).escalationId,'legacy'); assert.equal(f.emails.length,0); assert.equal(f.texts.length,0);
});
test('account closure tombstones block new incidents and responder operations', async () => {
 const f=fixture(); const id=body(await f.request()).escalationId;
 f.data.set('account-closure-jobs/clinician',{status:'pending'});
 await assert.rejects(f.responder({action:'get',escalationId:id}),/closure/);
 f.data.set('account-closure-jobs/athlete',{status:'pending'});
 assert.equal((await f.request()).statusCode,403);
});
test('assigned clinician covering this athlete may acknowledge; another clinician on same team cannot', async () => {
 const f=fixture(); Object.assign(f.data.get('pulsecheck-team-memberships/team_clinician'),{rosterVisibilityScope:'assigned',allowedAthleteIds:['athlete']});
 const id=body(await f.request()).escalationId;
 f.data.set('pulsecheck-team-memberships/team_other',{...f.data.get('pulsecheck-team-memberships/team_clinician'),userId:'other'});
 await assert.rejects(f.responder({action:'acknowledge',escalationId:id,uid:'other'}));
 assert.equal((await f.responder({action:'acknowledge',escalationId:id})).acknowledged,true);
});
