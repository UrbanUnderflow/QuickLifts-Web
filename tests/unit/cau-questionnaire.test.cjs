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
const { validateSubmission, redactMigratedFields } = mod.exports;
test('stores supplied values and self-reported identity, with skipped fields represented', () => {
 const record = validateSubmission({name:' Test Athlete ',email:'Athlete@example.com',answers:{'cau-operational-14':'Often'}});
 assert.equal(record.identity.email, 'athlete@example.com');
 assert.equal(record.fields['cau-operational-14'].value, 'Often');
 assert.equal(record.fields['cau-operational-14'].state,'local');
});
test('rejects unknown IDs, invalid options, impossible dates', () => {
 for (const answers of [{fake:'x'},{'cau-operational-01':'bogus'},{'cau-operational-05':'2026-02-30'}]) assert.throws(() => validateSubmission({name:'Test',email:'a@example.com',answers}));
});
test('migration removes value only with verified matching receipt; preserves unrelated fields', () => {
 const record={revision:1,payloadDigest:'remove',fields:{a:{state:'local',value:'private'},b:{state:'local',value:'keep'}}};
 const receipt={verified:true,sourceRevision:1,externalRecordId:'external',receiptId:'receipt',fieldIds:['a']};
 assert.throws(()=>redactMigratedFields(record,{...receipt,verified:false},'now'));
 assert.throws(()=>redactMigratedFields(record,{...receipt,sourceRevision:2},'now'));
 const migrated=redactMigratedFields(record,receipt,'now');
 assert.equal(migrated.payloadDigest,undefined); assert.equal(migrated.fields.a.value,undefined); assert.equal(migrated.fields.a.state,'external'); assert.equal(migrated.fields.b.value,'keep'); assert.equal(record.fields.a.value,'private');
});
test('restricted collection is excluded from signed-in fallback', () => {
 const rules=fs.readFileSync('firestore.rules','utf8');
 assert.match(rules,/return collectionName == 'pulsecheck-restricted-questionnaire-submissions'/);
 assert.match(rules,/match \/pulsecheck-restricted-questionnaire-submissions\/\{document=\*\*\} \{\s*allow read, write: if false;/);
});
