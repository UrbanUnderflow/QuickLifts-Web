const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
const scope = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../../src/lib/equityDocumentScope.ts'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports: scope.exports});
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../../netlify/functions/record-equity-signature.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function setup(overrides = {}) {
  const request = { equityDocumentId: 'doc', recipientEmail: 'person@example.com', status: 'sent', documentContent: 'Approved terms', signingGroupId: 'group', ...overrides.request };
  const document = { status: 'completed', content: 'Approved terms', signingRequestIds: ['req'], ...overrides.document };
  const writes = [];
  const db = { collection: collection => ({ doc: id => ({ collection, id }) }), runTransaction: async fn => fn({
    get: async ref => ({ exists: true, data: () => ref.collection === 'equity-documents' ? document : request }),
    update: (ref, value) => writes.push(value),
  }) };
  const firestore = () => db;
  firestore.Timestamp = { now: () => ({ toDate: () => new Date('2026-09-23T12:00:00Z') }) };
  const firebase = { getFirebaseAdminApp: () => ({}), admin: { firestore, auth: () => ({ verifyIdToken: async () => ({ uid: 'uid', email: 'person@example.com', email_verified: true, ...overrides.identity }) }) } };
  const module = { exports: {} };
  vm.runInNewContext(source, { exports: module.exports, module, require: name => name === '../../src/lib/equityCapitalizationApprovals' ? require('./load-ts.cjs')(path.join(__dirname, '../../../src/lib/equityCapitalizationApprovals.ts')) : name === '../../src/lib/equitySigningRequirements' ? require('./load-ts.cjs')(path.join(__dirname, '../../../src/lib/equitySigningRequirements.ts')) : name === '../../src/lib/equitySigningPackage' ? require('./load-ts.cjs')(path.join(__dirname, '../../../src/lib/equitySigningPackage.ts')) : name === '../../src/lib/equityExecution' ? require('./load-ts.cjs')(path.join(__dirname, '../../../src/lib/equityExecution.ts')) : name === '../../src/lib/equityDocumentScope' ? scope.exports : name === './config/firebase' ? firebase : require(name), Date, console });
  return { writes, invoke: body => module.exports.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer token', 'x-nf-client-connection-ip': '127.0.0.1' }, body: JSON.stringify({ requestId: 'req', typedName: 'Person', signatureFont: 'Brush Script MT', ...body }) }) };
}
test('records server-verified evidence, ignoring caller proof', async () => {
  const s = setup(); const result = await s.invoke({ verifiedUid: 'forged', signatureData: { verifiedEmail: 'forged' } });
  assert.equal(result.statusCode, 200); assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0].signatureData.verifiedUid, 'uid'); assert.equal(s.writes[0].signatureData.verificationMethod, 'firebase-auth');
  assert.equal(s.writes[0].signatureData.documentHash.length, 64);
});
for (const [label, overrides, status] of [
  ['wrong recipient', { identity: { email: 'other@example.com' } }, 403],
  ['unverified recipient', { identity: { email_verified: false } }, 403],
  ['already signed', { request: { status: 'signed' } }, 409],
  ['invalidated', { request: { invalidatedAt: '2026-09-01' } }, 409],
  ['preview', { request: { previewMode: true } }, 409],
  ['expired', { request: { expiresAt: '2020-01-01' } }, 410],
  ['changed content', { document: { content: 'New terms' } }, 409],
  ['replaced group', { document: { signingRequestIds: ['other'] } }, 409],
  ['closing requirements', { document: { closingRequirements: ['Approval'] } }, 409],
]) test(`rejects ${label} without writes`, async () => { const s = setup(overrides); assert.equal((await s.invoke()).statusCode, status); assert.equal(s.writes.length, 0); });

test('rejects incoming and archived execution without writes', async () => { for (const document of [{title: 'AuntEdna Warrant to PIL'}, {archivedFromEquity: true}]) { const s = setup({document}); assert.equal((await s.invoke()).statusCode, 409); assert.equal(s.writes.length, 0); } });

const supportingDocument = {documentType:'strategic_capitalization_certificate',requiresSignature:true,signingGroupId:'group',preparedSigners:[{name:'Tremaine Grant',email:'person@example.com',role:'Sole director'}]};
test('verified sole signature approves a supporting certificate in the same transaction', async()=>{const s=setup({document:supportingDocument,request:{signerRole:'Sole director'}});const result=await s.invoke();assert.equal(result.statusCode,200,result.body);assert.equal(s.writes.length,2);assert.equal(s.writes[1].approvalStatus,'approved');assert.equal(s.writes[1].approvalRequestId,'req');});
for(const [label,change] of [['different signer',{preparedSigners:[{name:'Another director',email:'person@example.com',role:'Sole director'}]}],['multiple signers',{preparedSigners:[...supportingDocument.preparedSigners,...supportingDocument.preparedSigners]}],['changed group',{signingGroupId:'changed'}]])test(`supporting approval rejects ${label}`,async()=>{const s=setup({document:{...supportingDocument,...change},request:{signerRole:'Sole director'}});assert.equal((await s.invoke()).statusCode,409);assert.equal(s.writes.length,0);});

test('reconciled EDNA documents cannot be signed without their validated full package',async()=>{
 for(const closingRequirements of [[],['Complete approved capitalization and reservation certificates and reciprocal EDNA award delivery, including the initial 2% condition']]){
  const s=setup({request:{equityDocumentId:'pil-auntedna-vesting-shares-draft'},document:{contractualBuybackRevision:1,closingRequirements}});const result=await s.invoke();assert.equal(result.statusCode,409,result.body);assert.match(result.body,/complete equity package/);assert.equal(s.writes.length,0);
 }
});
