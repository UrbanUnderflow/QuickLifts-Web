const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
const scope = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../../src/lib/equityDocumentScope.ts'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports: scope.exports});
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../../netlify/functions/send-signing-request.ts'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
function setup(options = {}) {
  const saved = {equityDocumentId: 'plan', documentType: 'eip', documentName: 'Saved plan', recipientName: 'Saved person', recipientEmail: 'person@example.test', documentContent: 'Terms', signingGroupId: 'group', status: 'pending', ...options.saved};
  const writes = [], sends = [];
  const document = {status: 'completed', content: 'Terms', signingRequestIds: ['req'], ...options.document};
  const snapshot = value => ({exists: true, data: () => ({...value})});
  const db = {collection: collection => ({doc: id => ({collection, id, get: async () => collection === 'admin' ? {exists: options.admin !== false} : snapshot(collection === 'equity-documents' ? document : saved)})}), runTransaction: async fn => fn({get: async () => snapshot({...saved}), set: (ref, value) => { if(options.failSave && saved.emailDelivery) throw new Error('DB unavailable'); writes.push(value); Object.assign(saved,value); }})};
  const firestore = () => db;
  firestore.FieldValue = {increment: value => value};
  const firebase = {getFirebaseAdminApp: () => ({}), admin: {firestore, auth: () => ({verifyIdToken: async () => { if (options.badToken) throw new Error('Invalid'); return {email: 'admin@example.test'}; }})}};
  const email = {buildEmailDedupeKey: () => 'dedupe', sendBrevoTransactionalEmail: async payload => {sends.push(payload); Object.assign(saved,options.race); if(options.transportError)throw new Error('Network interrupted'); return options.sendResult || {success: true, messageId: 'msg'};}};
  const module = {exports: {}};
  vm.runInNewContext(source, {exports: module.exports, module, require: name => name === '../../src/lib/equityEmailDelivery' ? require('./load-ts.cjs')(path.join(__dirname, '../../../src/lib/equityEmailDelivery.ts')) : name === '../../src/lib/equityCapitalizationApprovals' ? require('./load-ts.cjs')(path.join(__dirname, '../../../src/lib/equityCapitalizationApprovals.ts')) : name === '../../src/lib/equitySigningRequirements' ? require('./load-ts.cjs')(path.join(__dirname, '../../../src/lib/equitySigningRequirements.ts')) : name === '../../src/lib/equitySigningPackage' ? require('./load-ts.cjs')(path.join(__dirname, '../../../src/lib/equitySigningPackage.ts')) : name === '../../src/lib/equityExecution' ? require('./load-ts.cjs')(path.join(__dirname, '../../../src/lib/equityExecution.ts')) : name === '../../src/lib/equityDocumentScope' ? scope.exports : name === './config/firebase' ? firebase : name === './utils/emailSequenceHelpers' ? email : require(name), process: {env: {NETLIFY_DEV: undefined, URL: undefined, CUSTOM_BASE_URL: undefined, ...options.environment}}, Date, console: {error() {}, log() {}}});
  return {writes, sends, saved, invoke: payload => module.exports.handler({httpMethod: 'POST', headers: options.noToken ? {} : {authorization: 'Bearer token'}, body: JSON.stringify({documentId: 'req', recipientEmail: 'person@example.test', ...payload})}, {})};
}
for (const [label, options, code] of [['missing auth', {noToken: true}, 401], ['bad token', {badToken: true}, 401], ['non-admin', {admin: false}, 403], ['signed', {saved: {status: 'signed'}}, 409], ['invalidated', {saved: {invalidatedAt: 'now'}}, 409], ['replaced packet', {document: {signingRequestIds: ['other']}}, 409], ['changed document', {document: {content: 'Changed'}}, 409], ['closing requirements', {document: {closingRequirements: ['Approval']}}, 409], ['legacy equity without link', {saved: {equityDocumentId: null}}, 409]]) {
  test(`rejects ${label} before sending`, async () => {const s = setup(options); assert.equal((await s.invoke()).statusCode, code); assert.equal(s.sends.length, 0); assert.equal(s.writes.length, 0);});
}
test('rejects arbitrary recipient and ignores caller-supplied content routing', async () => {
  const s = setup();
  assert.equal((await s.invoke({recipientEmail: 'attacker@example.test'})).statusCode, 400);
  assert.equal(s.sends.length, 0);
  assert.equal((await s.invoke({documentName: 'Forged name', recipientName: 'Forged person', supportingDocuments: [{title: 'Fake', url: 'https://evil.example'}]})).statusCode, 200);
  assert.equal(s.sends[0].toEmail, 'person@example.test');
  assert.match(s.sends[0].subject, /Saved plan/);
  assert.doesNotMatch(s.sends[0].htmlContent, /Forged|evil.example/);
});
test('signature completed during delivery is never overwritten', async () => {
  const s = setup({race: {status: 'signed', signatureData: {typedName: 'Person'}}});
  assert.equal((await s.invoke()).statusCode, 200);
  assert.equal(s.sends.length, 1);
  assert.equal(s.writes.length, 1); assert.equal(s.writes[0].emailDelivery.status,'sending'); assert.equal(s.saved.status,'signed');
});
test('invalidation or changed recipient during delivery is not overwritten', async () => {
  for (const race of [{invalidatedAt: 'now'}, {recipientEmail: 'changed@example.test'}]) {
    const s = setup({race}); assert.equal((await s.invoke()).statusCode, 200); assert.equal(s.writes.length, 1); assert.equal(s.writes[0].emailDelivery.status,'sending');
  }
});

test('rejects incoming and archived equity before sending', async () => { for (const document of [{title: 'AuntEdna Board Consent Strategic Equity'}, {equityDirection: 'incoming'}, {archivedFromEquity: true}]) { const s = setup({document}); assert.equal((await s.invoke()).statusCode, 409); assert.equal(s.sends.length, 0); } });

test('coordinated EDNA instruments can only be emailed through their complete package',async()=>{
 for(const extra of [{},{packageId:'recipient-package'},{previewMode:true}]){
  const s=setup({saved:{equityDocumentId:'pil-auntedna-vesting-shares-draft',...extra},document:{contractualBuybackRevision:1,closingRequirements:[]}});const result=await s.invoke();assert.equal(result.statusCode,409,result.body);assert.match(result.body,/complete equity package/);assert.equal(s.sends.length,0);assert.equal(s.writes.length,0);
 }
});

for (const [name, environment, expected] of [
 ['local Netlify default', {NETLIFY_DEV:'true'}, 'http://localhost:8888'],
 ['local Netlify configured loopback', {NETLIFY_DEV:'true',URL:'http://127.0.0.1:9990/'}, 'http://127.0.0.1:9990'],
 ['local IPv6 loopback', {NETLIFY_DEV:'true',URL:'http://[::1]:8888/'}, 'http://[::1]:8888'],
 ['remote URL rejected in local runtime', {NETLIFY_DEV:'true',URL:'https://unexpected.example',CUSTOM_BASE_URL:'https://fitwithpulse.ai'}, 'http://localhost:8888'],
 ['credential-bearing local URL rejected', {NETLIFY_DEV:'true',URL:'http://user:password@localhost:8888'}, 'http://localhost:8888'],
 ['invalid local URL rejected', {NETLIFY_DEV:'true',URL:'not-a-url'}, 'http://localhost:8888'],
 ['production default', {URL:'http://localhost:8888'}, 'https://fitwithpulse.ai'],
 ['production custom domain', {CUSTOM_BASE_URL:'https://equity.example',URL:'http://localhost:8888'}, 'https://equity.example'],
]) test(`${name} selects the trusted signing and relative attachment origin`,async()=>{
 const s=setup({environment,saved:{supportingDocuments:[{title:'Board consent',documentType:'board_consent',url:'/equity-doc/board'}]}});
 const result=await s.invoke({origin:'https://attacker.example'});assert.equal(result.statusCode,200,result.body);
 assert.ok(s.sends[0].htmlContent.includes(`href="${expected}/sign/req"`));assert.ok(s.sends[0].htmlContent.includes(`href="${expected}/equity-doc/board"`));assert.doesNotMatch(s.sends[0].htmlContent,/attacker\.example|unexpected\.example|user:password/);
});

for (const [label, sendResult, state] of [
 ['provider rejection',{success:false,error:'IP address is not authorized'},'failed'],
 ['suppressed recipient',{success:true,skipped:true,suppressed:true,suppressionReason:'blocked'},'failed'],
 ['missing provider ID',{success:true,skipped:true},'unknown']
]) test(`persists ${label} instead of reporting sent`,async()=>{
 const s=setup({sendResult});const response=await s.invoke();assert.equal(response.statusCode,502,response.body);
 assert.equal(s.saved.emailDelivery.status,state);assert.ok(s.saved.emailDelivery.unresolvedFailure.reason);assert.equal(s.saved.status,'pending');assert.equal(s.saved.sentAt,undefined);
});
test('network uncertainty is saved without claiming delivery or definite rejection',async()=>{
 const s=setup({transportError:true});const response=await s.invoke();assert.equal(response.statusCode,502);
 assert.equal(s.saved.emailDelivery.status,'unknown');assert.match(s.saved.emailDelivery.reason,/not confirm/);
});
test('accepted send preserves unresolved failure until Brevo confirms delivery',async()=>{
 const s=setup({saved:{emailDelivery:{status:'failed',messageId:'older',attemptId:'old',recipientEmail:'person@example.test',unresolvedFailure:{reason:'Blocked',at:'2026-09-01T00:00:00Z'}}}});
 const response=await s.invoke({sendAttemptId:'new'});assert.equal(response.statusCode,200,response.body);
 assert.equal(s.saved.emailDelivery.status,'accepted');assert.equal(s.saved.emailDelivery.unresolvedFailure.reason,'Blocked');assert.equal(s.saved.emailDeliveryAttempts.length,1);
 assert.match(JSON.parse(response.body).message,/not yet been confirmed/);
});
test('repeated identical accepted attempt does not send another email',async()=>{
 const s=setup();await s.invoke({sendAttemptId:'same'});const response=await s.invoke({sendAttemptId:'same'});
 assert.equal(response.statusCode,200,response.body);assert.equal(s.sends.length,1);
});
test('a send in progress cannot be submitted concurrently',async()=>{
 const s=setup({saved:{emailDelivery:{status:'sending',messageId:null,attemptId:'other',attemptedAt:new Date(),recipientEmail:'person@example.test'}}});
 assert.equal((await s.invoke({sendAttemptId:'new'})).statusCode,409);assert.equal(s.sends.length,0);
});
test('failed persistence after provider acceptance is not reported as success',async()=>{
 const s=setup({failSave:true});const response=await s.invoke();assert.equal(response.statusCode,503);
 assert.match(JSON.parse(response.body).message,/status could not be saved/);
});
