const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve('src/lib/questionnaires/cau.ts');
const mod = new Module(filename, module);
mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { validateSubmission, splitSubmission, attachAuntEdnaReceipt } = mod.exports;
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
 assert.equal(Object.keys(split.auntEdna.fields).length,31);
 assert.equal(Object.keys(split.pulseCheck.fields).length,30);
 assert.equal(Object.keys(split.pulseCheck.auntEdnaReferences).length,31);
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
