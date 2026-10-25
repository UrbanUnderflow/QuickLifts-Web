const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file);
const { VERSION, questionsFor, validateSubmission } = require('../../src/lib/coachSurveys/questionnaire.ts');
const { processSurvey, COLLECTION, ROOT, tokenDigest } = require('../../src/lib/coachSurveys/service.ts');
const { duePeriod, runCoachSurveyDeliveries, DELIVERY_RELEASE_APPROVED, enrollmentIdFor } = require('../../src/lib/coachSurveys/delivery.ts');
const body = kind => ({ version: VERSION, answers: Object.fromEntries(questionsFor(kind).map(q => [q.id, q.multiple ? [q.options[0].value] : q.options[0].value])), comment: 'Synthetic feedback only.' });
const prefix = `${COLLECTION}/${ROOT}`;
function fakeDb(seed = {}) {
  const data = new Map(Object.entries(seed)); let serial = Promise.resolve();
  const ref = (path, filters = []) => ({ path, id: path.split('/').at(-1), collection: name => ref(`${path}/${name}`), doc: id => ref(`${path}/${id}`), limit: () => ref(path,filters), where: (field,operator,value) => ref(path,[...filters,[field,value]]),
    get: async () => ({ exists: data.has(path), data: () => data.get(path), docs: [...data.keys()].filter(k => k.startsWith(path + '/') && k.slice(path.length + 1).split('/').length === 1 && filters.every(([field,value])=>data.get(k)?.[field]===value)).map(k => ({ id: k.split('/').at(-1), ref: ref(k), data: () => data.get(k) })) }),
    set: async (v, opts) => data.set(path, opts?.merge ? { ...data.get(path), ...v } : v) });
  return { data, collection: ref, runTransaction: fn => { const next = serial.then(async () => { const writes = []; const result = await fn({ get: r => r.get(), create: (r, v) => { if(data.has(r.path)) throw Error('exists'); writes.push([r.path,v]); }, set: (r,v) => writes.push([r.path,v]), update: (r,v) => writes.push([r.path,{...data.get(r.path),...v}]) }); for(const [k,v] of writes)data.set(k,v); return result; }); serial = next.catch(()=>{}); return next; } };
}
const token = 'A'.repeat(43), hash = tokenDigest(token);
const invite = kind => ({ kind, enabled:true, version:VERSION, participantId:'synthetic-coach', programId:'synthetic-pilot', periodId:'2026-11-01', opensAtMs:0, expiresAtMs:Date.now()+86400000 });
test('approved six/two flows preserve response choices without scores', () => {
  assert.equal(questionsFor('baseline').length, 6); assert.equal(questionsFor('check-in').length, 2);
  const data=validateSubmission('baseline',body('baseline')); assert.equal(data.responseCount,6); assert.equal(data.score,undefined);
  const periodic=body('check-in');periodic.answers.usefulness='Haven’t used it enough to tell'; periodic.answers['informed-action']='Haven’t used it';assert.equal(validateSubmission('check-in',periodic).recallDays,21);
});
test('reject missing/unknown values, mixed none, duplicates, >3 priorities and oversized text', () => {
  for(const change of [v=>delete v.answers.barriers,v=>v.answers.barriers=['Nothing currently','Other'],v=>v.answers.barriers=['Other','Other'],v=>v.answers['pilot-needs']=questionsFor('baseline')[5].options.slice(0,4).map(o=>o.value),v=>v.comment='x'.repeat(1001),v=>v.answers.foo='bad',v=>v.participantId='spoof',v=>v.version='old']) {const v=body('baseline');change(v);assert.throws(()=>validateSubmission('baseline',v));}
  const v=body('baseline');v.answers.barriers=['Other'];v.otherText={barriers:'Synthetic other'};assert.equal(validateSubmission('baseline',v).otherText.barriers,'Synthetic other');v.answers.barriers=['Nothing currently'];assert.throws(()=>validateSubmission('baseline',v));
});
test('immutable submission, network retry and concurrent duplicate are idempotent', async()=>{
 const db=fakeDb({[`${prefix}/invitations/${hash}`]:invite('baseline')});
 assert.deepEqual(await processSurvey(db,token,'baseline'),{completed:false,recallDays:null});
 await Promise.all([processSurvey(db,token,'baseline',body('baseline')),processSurvey(db,token,'baseline',body('baseline'))]);
 assert.deepEqual(await processSurvey(db,token,'baseline'),{completed:true});
 const saved=db.data.get(`${prefix}/responses/${hash}`);await processSurvey(db,token,'baseline',{bad:true});assert.equal(db.data.get(`${prefix}/responses/${hash}`),saved);
 assert.equal([...db.data.keys()].filter(k=>k.includes('/responses/')).length,1);
});
test('reissued invitation cannot duplicate same participant/program/period',async()=>{
 const other='B'.repeat(43);const db=fakeDb({[`${prefix}/invitations/${hash}`]:invite('baseline'),[`${prefix}/invitations/${tokenDigest(other)}`]:invite('baseline')});
 await processSurvey(db,token,'baseline',body('baseline'));assert.deepEqual(await processSurvey(db,other,'baseline',body('baseline')),{completed:true});assert.equal([...db.data.keys()].filter(k=>k.includes('/responses/')).length,1);
});
test('reject expired, wrong kind, disabled and missing/mismatched baseline',async()=>{
 for(const overrides of [{expiresAtMs:0},{enabled:false},{kind:'check-in'}]) {const db=fakeDb({[`${prefix}/invitations/${hash}`]:{...invite('baseline'),...overrides}});await assert.rejects(processSurvey(db,token,'baseline',body('baseline')));}
 const db=fakeDb({[`${prefix}/invitations/${hash}`]:{...invite('check-in'),baselineResponseId:'f'.repeat(64)}});await assert.rejects(processSurvey(db,token,'check-in',body('check-in')));
 db.data.set(`${prefix}/responses/${'f'.repeat(64)}`,{kind:'baseline',participantId:'other',programId:'synthetic-pilot'});await assert.rejects(processSurvey(db,token,'check-in',body('check-in')));
 db.data.set(`${prefix}/responses/${'f'.repeat(64)}`,{kind:'baseline',participantId:'synthetic-coach',programId:'synthetic-pilot'});assert.deepEqual(await processSurvey(db,token,'check-in',body('check-in')),{completed:true});
});
const enrollment=()=>({enabled:true,approved:true,participantId:'synthetic-coach',programId:'synthetic-pilot',teamId:'synthetic-team',baselineResponseId:'f'.repeat(64),startDate:'2026-10-25',endDate:'2026-12-20',timeZone:'America/New_York',sendHour:9,messageVersion:'coach-check-in-v1',channels:{email:{destination:'coach@example.test',consentRecordedAtMs:1,recipientVerifiedAtMs:1,suppressed:false},sms:{destination:'+12025550123',consentRecordedAtMs:1,recipientVerifiedAtMs:1,suppressed:false}}});
test('21-calendar-day cadence respects timezone/DST, stop and pilot end',()=>{
 const v=enrollment();assert.equal(duePeriod(v,new Date('2026-10-25T12:59Z')),null);assert.equal(duePeriod(v,new Date('2026-10-25T13:00Z')),'2026-10-25');assert.equal(duePeriod(v,new Date('2026-11-15T13:00Z')),null);assert.equal(duePeriod(v,new Date('2026-11-15T14:00Z')),'2026-11-15');assert.equal(duePeriod(v,new Date('2026-11-14T14:00Z')),null);assert.equal(duePeriod(v,new Date('2026-12-27T14:00Z')),null);assert.equal(duePeriod({...v,stoppedAtMs:1},new Date('2026-10-25T13:00Z')),null);assert.equal(DELIVERY_RELEASE_APPROVED,false);
});
test('delivery uses shared link, independent channel dedupe and holds ambiguous outcomes',async()=>{
 const v=enrollment(),db=fakeDb({[`${prefix}/enrollments/${enrollmentIdFor(v.participantId,v.programId)}`]:v,[`${prefix}/responses/${v.baselineResponseId}`]:{kind:'baseline',participantId:v.participantId,programId:v.programId}});let sends=0;
 const deps={eligible:async()=>true,send:async(channel,to,message)=>{sends++;assert.match(message.text,/#token=/);assert.ok(!message.text.includes(v.participantId));return {status:channel==='email'?'sent':'uncertain',...(channel==='email'?{messageId:'synthetic'}:{})};}};
 await Promise.all([runCoachSurveyDeliveries(db,new Date('2026-10-25T13:00Z'),'https://example.test',deps),runCoachSurveyDeliveries(db,new Date('2026-10-25T13:00Z'),'https://example.test',deps)]);assert.equal(sends,2);
 await runCoachSurveyDeliveries(db,new Date('2026-10-25T15:00Z'),'https://example.test',deps);assert.equal(sends,2);
});
test('suppressed/stopped enrollments never dispatch',async()=>{
 const v=enrollment();v.enabled=false;const db=fakeDb({[`${prefix}/enrollments/${enrollmentIdFor(v.participantId,v.programId)}`]:v});await runCoachSurveyDeliveries(db,new Date('2026-10-25T13:00Z'),'https://example.test',{eligible:async()=>true,send:async()=>{throw Error('must not send');}});assert.equal(db.data.size,1);
});
test('restricted namespace remains denied; routes do not return answer payloads',()=>{
 const rules=fs.readFileSync('firestore.rules','utf8');assert.match(rules,/collectionName == 'pulsecheck-restricted-questionnaire-submissions'/);assert.match(rules,/match \/pulsecheck-restricted-questionnaire-submissions\/\{document=\*\*\} \{\s*allow read, write: if false;/);
});
test('collection API is disabled without credentials and returns no private data',async()=>{
 const handler=require('../../src/pages/api/pulsecheck/coach-survey/[kind].ts').default;
 const original=process.env.COACH_SURVEY_COLLECTION_ENABLED;delete process.env.COACH_SURVEY_COLLECTION_ENABLED;
 const res={code:0,headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},json(v){this.body=v;return this;},end(){return this;}};
 await handler({method:'GET',query:{kind:'baseline'},headers:{}},res);assert.equal(res.code,503);assert.equal(res.headers['Cache-Control'],'private, no-store');assert.equal(res.body.answers,undefined);
 if(original!==undefined)process.env.COACH_SURVEY_COLLECTION_ENABLED=original;
});
test('stopped enrollment blocks periodic use even with an unexpired invitation',async()=>{
 const db=fakeDb({[`${prefix}/invitations/${hash}`]:{...invite('check-in'),enrollmentId:'synthetic'},[`${prefix}/enrollments/synthetic`]:{enabled:false,participantId:'synthetic-coach',programId:'synthetic-pilot'}});await assert.rejects(processSurvey(db,token,'check-in',body('check-in')),/stopped/);
});
test('known pre-provider failure retries at most three times, one hour apart',async()=>{
 const v=enrollment();delete v.channels.sms;const db=fakeDb({[`${prefix}/enrollments/${enrollmentIdFor(v.participantId,v.programId)}`]:v,[`${prefix}/responses/${v.baselineResponseId}`]:{kind:'baseline',participantId:v.participantId,programId:v.programId}});let sends=0;
 const deps={eligible:async()=>true,send:async()=>{sends++;return {status:'retryable'};}};
 for(const time of ['13:00','13:01','14:00','15:00','16:00'])await runCoachSurveyDeliveries(db,new Date(`2026-10-25T${time}Z`),'https://example.test',deps);assert.equal(sends,3);
});
test('setup prepares disabled records only and distinct lifecycle status',()=>{
 const {prepareCoachSurveySetup,coachSurveyStatus}=require('../../src/lib/coachSurveys/setup.ts');const v=enrollment();const bundle=prepareCoachSurveySetup(v,'https://example.test');assert.equal(bundle.enrollment.enabled,false);assert.equal(bundle.enrollment.approved,false);assert.equal(bundle.baselineInvitation.enabled,false);assert.match(bundle.baselineLink,/#token=[A-Za-z0-9_-]{43}$/);assert.equal(coachSurveyStatus(bundle.enrollment,false).periodic,'awaiting-baseline');assert.equal(coachSurveyStatus(bundle.enrollment,true).periodic,'paused');
});
test('admin authorization requires revoked-token verification and same-project admin record',async()=>{
 const {assertSurveyAdmin}=require('../../src/lib/coachSurveys/admin.ts');const db=fakeDb();let checked=false;
 const app={auth:()=>({verifyIdToken:async(token,revoked)=>{checked=revoked;assert.equal(token,'synthetic');return{uid:'admin-test',email:'admin@example.test'};}}),firestore:()=>db};
 await assert.rejects(assertSurveyAdmin(app,'synthetic'),/Admin/);db.data.set('admin/admin@example.test',{});assert.equal((await assertSurveyAdmin(app,'synthetic')).uid,'admin-test');assert.equal(checked,true);db.data.set('account-closure-jobs/admin-test',{});await assert.rejects(assertSurveyAdmin(app,'synthetic'));
});
function seedAdminDb(){return fakeDb({'pulsecheck-pilots/synthetic-pilot':{teamId:'synthetic-team',status:'active'},'pulsecheck-team-memberships/synthetic-team_synthetic-coach':{userId:'synthetic-coach',teamId:'synthetic-team',organizationId:'synthetic-org',role:'coach',status:'active'},'pulsecheck-teams/synthetic-team':{status:'active',organizationId:'synthetic-org'},'pulsecheck-organizations/synthetic-org':{status:'active'},'users/synthetic-coach':{email:'coach@example.test',phoneNumber:'+12025550123'}});}
test('admin saves paused verified coach setup, revokes replaced links and audits actions',async()=>{
 const {manageCoachSurvey}=require('../../src/lib/coachSurveys/admin.ts');const db=seedAdminDb();const req={action:'save',teamId:'synthetic-team',programId:'synthetic-pilot',participantId:'synthetic-coach',consentConfirmed:true,recipientVerified:true,consentReference:'Synthetic consent record',config:{...enrollment(),channels:['email','sms']}};
 await assert.rejects(manageCoachSurvey(db,'admin',{...req,consentConfirmed:false}));await manageCoachSurvey(db,'admin',req);const id=enrollmentIdFor(req.participantId,req.programId);assert.equal(db.data.get(`${prefix}/enrollments/${id}`).enabled,false);
 const first=await manageCoachSurvey(db,'admin',{...req,action:'baseline-link'});const firstHash=tokenDigest(first.path.split('token=')[1]);assert.equal(db.data.get(`${prefix}/invitations/${firstHash}`).enabled,true);
 const reused=await manageCoachSurvey(db,'admin',{...req,action:'baseline-link'});assert.equal(reused.path,first.path);
 await manageCoachSurvey(db,'admin',{...req,action:'baseline-link',regenerate:true});assert.equal(db.data.get(`${prefix}/invitations/${firstHash}`).enabled,false);
 await assert.rejects(manageCoachSurvey(db,'admin',{...req,action:'enable'}),/release approval/);await manageCoachSurvey(db,'admin',{...req,action:'stop'});assert.ok(db.data.get(`${prefix}/enrollments/${id}`).stoppedAtMs);assert.equal([...db.data.keys()].filter(k=>k.includes('/admin-events/')).length,4);
});
test('admin cannot provision athletes, inactive teams or cross-team enrollment',async()=>{
 const {verifyCoach,manageCoachSurvey}=require('../../src/lib/coachSurveys/admin.ts');const db=seedAdminDb();db.data.get('pulsecheck-team-memberships/synthetic-team_synthetic-coach').role='athlete';await assert.rejects(verifyCoach(db,'synthetic-coach','synthetic-team'));db.data.get('pulsecheck-team-memberships/synthetic-team_synthetic-coach').role='coach';db.data.get('pulsecheck-teams/synthetic-team').status='archived';await assert.rejects(verifyCoach(db,'synthetic-coach','synthetic-team'));
});
test('Twilio SDK accepts signed form and rejects tampering, foreign account, destination and URL',()=>{
 const {verifySmsWebhook}=require('../../src/lib/coachSurveys/smsOptOut.ts');const twilio=require('twilio');const settings={authToken:'synthetic-secret-only',url:'https://example.test/api/sms',accountSid:'AC'+'1'.repeat(32),to:'+12025550111'};const form={AccountSid:settings.accountSid,To:settings.to,From:'+12025550123',MessageSid:'SM'+'2'.repeat(32),Body:'STOP',ExtraFutureParam:'signed too'};const signature=twilio.getExpectedTwilioSignature(settings.authToken,settings.url,form);
 assert.equal(verifySmsWebhook(form,signature,settings),true);for(const changed of [{...form,Body:'START'},{...form,AccountSid:'other'},{...form,To:'+12025550112'},{...form,ExtraFutureParam:'tampered'}])assert.equal(verifySmsWebhook(changed,signature,settings),false);assert.equal(verifySmsWebhook(form,signature,{...settings,url:'https://evil.test'}),false);
});
test('SMS STOP suppresses globally by phone; retries dedupe; START never resumes; HELP sends nothing',async()=>{
 const {recordSmsOptOut}=require('../../src/lib/coachSurveys/smsOptOut.ts');const db=fakeDb(),form={From:'+12025550123',MessageSid:'SM'+'2'.repeat(32),Body:'stop'};await recordSmsOptOut(db,form,1);const suppression=`${prefix}/sms-suppressions/${tokenDigest(form.From)}`;assert.equal(db.data.get(suppression).suppressed,true);assert.equal((await recordSmsOptOut(db,form,2)).duplicate,true);assert.equal(db.data.get(suppression).stoppedAtMs,1);
 await recordSmsOptOut(db,{...form,MessageSid:'SM'+'3'.repeat(32),Body:'START'},3);assert.equal(db.data.get(suppression).suppressed,true);await recordSmsOptOut(db,{...form,MessageSid:'SM'+'4'.repeat(32),Body:'HELP'},4);assert.equal(db.data.get(suppression).suppressed,true);assert.ok([...db.data.values()].every(v=>!JSON.stringify(v).includes(form.From)));
});
test('admin and webhook default release gates cause no database/provider operations',async()=>{
 for(const [file,env] of [['../../src/pages/api/admin/pulsecheck/coach-surveys.ts','COACH_SURVEY_COLLECTION_ENABLED'],['../../src/pages/api/pulsecheck/coach-survey/sms-webhook.ts','COACH_SURVEY_SMS_WEBHOOK_ENABLED']]){
  delete process.env[env];const handler=require(file).default;const res={setHeader(){},status(code){this.code=code;return this;},json(){return this;},end(){return this;}};await handler({method:'POST',headers:{}},res);assert.equal(res.code,503);
 }
});
test('verified SMS synchronization initializes clear state but cannot erase STOP',async()=>{
 const {manageCoachSurvey}=require('../../src/lib/coachSurveys/admin.ts');const db=seedAdminDb();const req={action:'save',teamId:'synthetic-team',programId:'synthetic-pilot',participantId:'synthetic-coach',consentConfirmed:true,recipientVerified:true,smsProviderStateConfirmed:true,consentReference:'Synthetic provider verification',config:{...enrollment(),channels:['sms']}};
 await manageCoachSurvey(db,'admin',req);const key=`${prefix}/sms-suppressions/${tokenDigest('+12025550123')}`;assert.equal(db.data.get(key).suppressed,false);db.data.set(key,{suppressed:true,stoppedAtMs:1});await assert.rejects(manageCoachSurvey(db,'admin',req),/prior SMS opt-out/);assert.equal(db.data.get(key).suppressed,true);
});
test('private results remain scoped to requested team and enrollment program',async()=>{
 const {readCoachSurveys}=require('../../src/lib/coachSurveys/admin.ts');const db=seedAdminDb(),v=enrollment();const id=enrollmentIdFor(v.participantId,v.programId);db.data.set(`${prefix}/enrollments/${id}`,v);db.data.set(`${prefix}/responses/${v.baselineResponseId}`,{kind:'baseline',participantId:v.participantId,programId:v.programId,answers:{},submittedAtMs:1});db.data.set(`${prefix}/responses/foreign`,{kind:'baseline',participantId:v.participantId,programId:'other-program',comment:'must not return'});db.data.set(`${prefix}/enrollments/other`,{...v,teamId:'other-team'});
 const result=await readCoachSurveys(db,'synthetic-team');assert.equal(result.candidates.length,1);assert.equal(result.enrollments.length,1);assert.equal(result.enrollments[0].responses.length,1);assert.equal(result.enrollments[0].status.baseline,'completed');assert.ok(!JSON.stringify(result).includes('must not return'));
});
test('administrator may stop an enrollment after membership removal',async()=>{
 const {manageCoachSurvey}=require('../../src/lib/coachSurveys/admin.ts');const v=enrollment(),id=enrollmentIdFor(v.participantId,v.programId),db=fakeDb({[`${prefix}/enrollments/${id}`]:v});await manageCoachSurvey(db,'admin',{action:'stop',teamId:v.teamId,participantId:v.participantId,programId:v.programId});assert.equal(db.data.get(`${prefix}/enrollments/${id}`).enabled,false);
});
test('survey management is mounted in provisioning with team/pilot context; standalone page redirects',()=>{
 const dashboard=fs.readFileSync('src/pages/admin/pulsecheckProvisioning.tsx','utf8'),panel=fs.readFileSync('src/components/admin/TeamCoachSurveys.tsx','utf8'),old=fs.readFileSync('src/pages/admin/coachSurveys.tsx','utf8');assert.match(dashboard,/<TeamCoachSurveys key=\{team.id\} teamId=\{team.id\} pilots=\{bundledPilots/);assert.ok(!panel.includes('Team ID'));assert.ok(!panel.includes('Pilot or program ID'));assert.match(old,/destination: '\/admin\/pulsecheckProvisioning'/);
});
test('survey setup rejects a pilot from another team',async()=>{
 const {manageCoachSurvey}=require('../../src/lib/coachSurveys/admin.ts');const db=seedAdminDb();db.data.set('pulsecheck-pilots/synthetic-pilot',{teamId:'other-team',status:'active'});await assert.rejects(manageCoachSurvey(db,'admin',{action:'save',teamId:'synthetic-team',participantId:'synthetic-coach',programId:'synthetic-pilot'}),/belonging to this team/);
});
test('periodic delivery eligibility follows the provisioning pilot lifecycle',async()=>{
 const {coachSurveyProviders}=require('../../src/lib/coachSurveys/providers.ts');const db=seedAdminDb(),v=enrollment(),provider=coachSurveyProviders(db);assert.equal(await provider.eligible(v,'email'),true);db.data.get('pulsecheck-pilots/synthetic-pilot').status='completed';assert.equal(await provider.eligible(v,'email'),false);db.data.get('pulsecheck-pilots/synthetic-pilot').status='active';db.data.get('pulsecheck-pilots/synthetic-pilot').endAt={toMillis:()=>1};assert.equal(await provider.eligible(v,'email'),false);
});
test('one-time development results exclude unrelated participants and programs',async()=>{
 const {readCoachSurveyUserTest}=require('../../src/lib/coachSurveys/admin.ts');
 const db=fakeDb({[`${prefix}/responses/a`]:{programId:'coach-user-test-20261025',participantId:'coach-user-test-20261025-qa',kind:'baseline'},[`${prefix}/responses/b`]:{programId:'coach-user-test-20261025',participantId:'other-user'},[`${prefix}/responses/c`]:{programId:'other-program',participantId:'coach-user-test-20261025-user'}});
 assert.equal((await readCoachSurveyUserTest(db)).responses.length,1);
 const route=fs.readFileSync('src/pages/api/admin/pulsecheck/coach-surveys.ts','utf8');
 assert.ok(route.indexOf('assertSurveyAdmin(getFirebaseAdminApp')<route.indexOf("req.query.userTest === '1'"));
 assert.ok(route.includes('readCoachSurveyUserTest(identity.db)'));
});
test('cadence inherits default, team, coach and reset without touching another team',()=>{
 const {effectiveSchedule,cadenceDays}=require('../../src/lib/coachSurveys/cadence.ts');const v=enrollment();
 assert.deepEqual([effectiveSchedule(v).days,effectiveSchedule(v).source],[21,'default']);
 assert.equal(effectiveSchedule(v,{cadenceDays:14}).days,14);assert.equal(effectiveSchedule({...v,cadenceDaysOverride:7},{cadenceDays:14}).days,7);
 assert.equal(effectiveSchedule({...v,cadenceDaysOverride:null},{cadenceDays:14}).source,'team');assert.equal(effectiveSchedule(v,{cadenceDays:null}).days,21);
 for(const bad of [0,-1,1.5,366,'14'])assert.throws(()=>cadenceDays(bad));
});
test('cadence changes postpone overdue sends by a full local interval across DST',()=>{
 const {effectiveSchedule,nextScheduledDate}=require('../../src/lib/coachSurveys/cadence.ts');const now=Date.parse('2026-10-25T13:00:00Z'),v={...enrollment(),cadenceDaysOverride:7,cadenceChangedAtMs:now};
 assert.equal(effectiveSchedule(v).startDate,'2026-11-01');assert.equal(duePeriod(v,new Date(now)),null);
 assert.equal(duePeriod(v,new Date('2026-11-01T13:59:00Z')),null);assert.equal(duePeriod(v,new Date('2026-11-01T14:00:00Z')),'2026-11-01');
 assert.equal(nextScheduledDate(v,{},new Date(now)),'2026-11-01');assert.equal(duePeriod({...v,stoppedAtMs:now},new Date('2026-11-01T14:00:00Z')),null);
});
test('team changes and resets update inherited schedules only and preserve paused state',async()=>{
 const {manageCoachSurvey}=require('../../src/lib/coachSurveys/admin.ts');const {effectiveSchedule}=require('../../src/lib/coachSurveys/cadence.ts');const db=seedAdminDb();const now=Date.parse('2026-10-25T13:00:00Z');
 await manageCoachSurvey(db,'admin',{action:'team-cadence',teamId:'synthetic-team',cadenceDays:14},now);
 const team=db.data.get(`${prefix}/team-settings/synthetic-team`);assert.equal(team.cadenceDays,14);assert.equal(effectiveSchedule(enrollment(),team).startDate,'2026-11-08');assert.equal(effectiveSchedule({...enrollment(),cadenceDaysOverride:7},team).startDate,enrollment().startDate);assert.equal(db.data.has(`${prefix}/team-settings/other-team`),false);
 await manageCoachSurvey(db,'admin',{action:'team-cadence',teamId:'synthetic-team',cadenceDays:null},now);assert.equal(effectiveSchedule(enrollment(),db.data.get(`${prefix}/team-settings/synthetic-team`)).days,21);
});
test('issued recall interval controls survey question wording and stored recall',async()=>{
 const db=fakeDb({[`${prefix}/invitations/${hash}`]:{...invite('check-in'),recallDays:14,baselineResponseId:'f'.repeat(64)},[`${prefix}/responses/${'f'.repeat(64)}`]:{kind:'baseline',participantId:'synthetic-coach',programId:'synthetic-pilot'}});
 assert.equal((await processSurvey(db,token,'check-in')).recallDays,14);await processSurvey(db,token,'check-in',body('check-in'));assert.equal(db.data.get(`${prefix}/responses/${hash}`).recallDays,14);assert.match(questionsFor('check-in',14)[0].text,/past 2 weeks/);
});
test('coach-facing email templates preserve exact approved copy and dynamic cadence',()=>{
 const {coachEmail}=require('../../src/lib/coachSurveys/messages.ts');const b=coachEmail('baseline','https://example.test/b','https://example.test/stop');assert.equal(b.subject,'Welcome to AthleticMind: your coach baseline');assert.ok(!b.text.includes('Before we get started'));assert.match(b.text,/Please complete this short baseline questionnaire/);assert.match(b.html,/Complete your coach baseline/);
 const c=coachEmail('check-in','https://example.test/c','https://example.test/stop',14);assert.match(c.text,/past 2 weeks/);assert.ok(!c.text.includes('three weeks'));assert.match(c.html,/Manage survey reminders/);
});
test('manual email is disabled before any provider or database operation',async()=>{
 const {sendBaselineEmail}=require('../../src/lib/coachSurveys/manualEmail.ts');delete process.env.COACH_SURVEY_MANUAL_EMAIL_ENABLED;
 await assert.rejects(sendBaselineEmail(null,'admin',{},'https://example.test'),/held for release/);
});
test('coach cadence override and reset preserve STOP, pause and other enrollments',async()=>{
 const {manageCoachSurvey}=require('../../src/lib/coachSurveys/admin.ts');const db=seedAdminDb(),v={...enrollment(),enabled:false,stoppedAtMs:1};const id=enrollmentIdFor(v.participantId,v.programId);db.data.set(`${prefix}/enrollments/${id}`,v);db.data.set(`${prefix}/enrollments/other`,{cadenceDaysOverride:30});
 const req={action:'coach-cadence',teamId:v.teamId,programId:v.programId,participantId:v.participantId,cadenceDays:7};
 await manageCoachSurvey(db,'admin',req,1000);assert.equal(db.data.get(`${prefix}/enrollments/${id}`).enabled,false);assert.equal(db.data.get(`${prefix}/enrollments/${id}`).stoppedAtMs,1);assert.equal(db.data.get(`${prefix}/enrollments/other`).cadenceDaysOverride,30);
 await manageCoachSurvey(db,'admin',{...req,cadenceDays:null},2000);assert.equal(db.data.get(`${prefix}/enrollments/${id}`).cadenceDaysOverride,null);
});
test('team cadence runner snapshots recall and sends once per channel',async()=>{
 const v=enrollment(),id=enrollmentIdFor(v.participantId,v.programId);const db=fakeDb({[`${prefix}/enrollments/${id}`]:v,[`${prefix}/responses/${v.baselineResponseId}`]:{kind:'baseline',participantId:v.participantId,programId:v.programId},[`${prefix}/team-settings/${v.teamId}`]:{cadenceDays:7}});let sent=0;
 const deps={eligible:async()=>true,send:async(_c,_d,message)=>{assert.match(message.text,/past 1 week/);sent++;return{status:'sent',messageId:'synthetic'}}};
 await runCoachSurveyDeliveries(db,new Date('2026-11-01T14:00:00Z'),'https://example.test',deps);await runCoachSurveyDeliveries(db,new Date('2026-11-01T14:01:00Z'),'https://example.test',deps);assert.equal(sent,Object.keys(v.channels).length);assert.ok([...db.data.entries()].filter(([k])=>k.includes('/invitations/')).every(([,value])=>value.recallDays===7));
});
test('manual baseline preview uses verified coach contact and reuses scoped invitation',async()=>{
 const {previewBaselineEmail}=require('../../src/lib/coachSurveys/manualEmail.ts');const db=seedAdminDb(),v={...enrollment(),enabled:false};const id=enrollmentIdFor(v.participantId,v.programId);db.data.set(`${prefix}/enrollments/${id}`,v);const req={teamId:v.teamId,participantId:v.participantId,programId:v.programId,recipient:'untrusted@example.test'};
 const first=await previewBaselineEmail(db,'admin',req,'https://example.test');const second=await previewBaselineEmail(db,'admin',req,'https://example.test');assert.equal(first.recipient,'coach@example.test');assert.equal(first.confirmationId,second.confirmationId);assert.match(first.text,/Please complete this short baseline questionnaire/);assert.equal([...db.data.keys()].filter(k=>k.includes('/invitations/')).length,2); // New invitation plus disabled placeholder.
 db.data.get('users/synthetic-coach').email='updated@example.test';const changed=await previewBaselineEmail(db,'admin',req,'https://example.test');assert.notEqual(changed.confirmationId,first.confirmationId);
});
test('expired baseline copy requires explicit regeneration and completed baseline cannot regenerate',async()=>{
 const {manageCoachSurvey}=require('../../src/lib/coachSurveys/admin.ts');const db=seedAdminDb(),v={...enrollment(),enabled:false};const id=enrollmentIdFor(v.participantId,v.programId);db.data.set(`${prefix}/enrollments/${id}`,v);db.data.set(`${prefix}/invitations/${v.baselineResponseId}`,{enabled:true,expiresAtMs:1});const req={action:'baseline-link',teamId:v.teamId,participantId:v.participantId,programId:v.programId};
 await assert.rejects(manageCoachSurvey(db,'admin',req),/Confirm regeneration/);const replaced=await manageCoachSurvey(db,'admin',{...req,regenerate:true});const digest=tokenDigest(replaced.path.split('token=')[1]);db.data.set(`${prefix}/responses/${digest}`,{kind:'baseline'});await assert.rejects(manageCoachSurvey(db,'admin',{...req,regenerate:true}),/already completed/);
});
