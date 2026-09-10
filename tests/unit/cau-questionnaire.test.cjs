const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { validateSubmission, splitSubmission, attachAuntEdnaReceipt } = require(path.resolve('src/lib/questionnaires/cau.ts'));
const {questionCustodian} = require(path.resolve('src/lib/questionnaires/cau-routing.ts'));
require.extensions['.ts'] = previousLoader;
test('stores supplied values and self-reported identity, with skipped fields represented', () => {
 const record = validateSubmission({name:' Test Athlete ',email:'Athlete@example.com',answers:{'cau-operational-14':'Often'}});
 assert.equal(record.identity.email, 'athlete@example.com');
 assert.equal(record.fields['cau-operational-14'].value, 'Often');
 assert.equal(record.fields['cau-operational-14'].state,'local');
});
test('rejects unknown IDs, invalid options, impossible dates', () => {
 for (const answers of [{fake:'x'},{'cau-operational-01':'bogus'},{'cau-operational-05':'2026-02-30'}]) assert.throws(() => validateSubmission({name:'Test',email:'a@example.com',answers}));
});
test('separate records never copy auntEDNA values or answer hashes into PulseCheck', () => {
 const split=splitSubmission({submissionId:'test',name:'Example',email:'test@example.com',answers:{'cau-operational-14':'Often','cau-operational-26':'PRIVATE_SENTINEL'}});
 assert.equal(Object.keys(split.auntEdna.fields).length,48);
 assert.equal(Object.keys(split.pulseCheck.fields).length,13);
 assert.equal(Object.keys(split.pulseCheck.auntEdnaReferences).length,48);
 assert.equal(JSON.stringify(split.pulseCheck).includes('PRIVATE_SENTINEL'),false);
 assert.equal(split.pulseCheck.fields['cau-operational-14'],undefined);
 const mirror=attachAuntEdnaReceipt(split.pulseCheck,{submissionId:'test',recordId:'ae-test',receiptId:'receipt-test'});
 assert.equal(mirror.auntEdnaReferences['cau-operational-14'].recordId,'ae-test');
 assert.equal(mirror.auntEdnaReferences['cau-operational-14'].value,undefined);
 assert.throws(()=>attachAuntEdnaReceipt(split.pulseCheck,{submissionId:'wrong',recordId:'ae-test',receiptId:'receipt-test'}));
});
test('restricted collection is excluded from signed-in fallback', () => {
 const rules=fs.readFileSync('firestore.rules','utf8');
 assert.match(rules,/return collectionName == 'pulsecheck-restricted-questionnaire-submissions'/);
 assert.match(rules,/match \/pulsecheck-restricted-questionnaire-submissions\/\{document=\*\*\} \{\s*allow read, write: if false;/);
});

test('every active question has exactly one explicit routing rule', () => {
 const source = require('../../src/content/questionnaires/cau-operational.json');
 const routing = require('../../src/content/questionnaires/cau-routing.json');
 assert.deepEqual(routing.questions.map(q=>q.questionId).sort(),source.questions.filter(q=>q.id!=='cau-operational-04').map(q=>q.id).sort());
 assert.throws(()=>questionCustodian('unknown'));
 for(const n of [2,3,6,7,8,10,12,13,33,38,39,40,53,55,57,58,61]) assert.equal(questionCustodian('cau-operational-'+String(n).padStart(2,'0')),'auntEDNA');
});
test('injury narrative is conditional and never enters the performance record', () => {
 for(const answer of ['Yes','No']) {
 const result=splitSubmission({submissionId:'conditional',name:'Example',email:'test@example.com',answers:{'cau-operational-12':answer,'cau-operational-13':'INJURY_PRIVATE'}});
 assert.equal(JSON.stringify(result.pulseCheck).includes('INJURY_PRIVATE'),false);
 assert.equal(result.auntEdna.fields['cau-operational-13'].state,answer==='Yes'?'local':'not_applicable');
 assert.equal(result.auntEdna.fields['cau-operational-13'].value,answer==='Yes'?'INJURY_PRIVATE':undefined);
 }
});
