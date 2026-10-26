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
test('20 questionnaire items plus 8 familiarity ratings form the 28-item starting profile', () => {
 const {questions,QUESTIONNAIRE_VERSION,VERSION}=require(path.resolve('src/lib/questionnaires/cau.ts'));
 assert.equal(questions.length,20); assert.equal(questions.length+8,28);
 assert.equal(VERSION,'cau-operational-web-v1');assert.equal(QUESTIONNAIRE_VERSION,'athlete-starting-point-v2');
 assert.deepEqual(questions.map(q=>Number(q.id.slice(-2))),[2,3,4,6,7,8,35,36,37,38,39,40,41,42,43,44,45,46,47,48]);
});
test('stores supplied values, self-reported identity and explicit skipped fields', () => {
 const record=validateSubmission({name:' Test Athlete ',email:'Athlete@example.com',answers:{'cau-starting-point-35':'Mostly'}});
 assert.equal(record.identity.email,'athlete@example.com');assert.equal(record.fields['cau-starting-point-35'].value,'Mostly');
 assert.equal(record.fields['cau-starting-point-06'].state,'skipped');assert.equal(record.version,'athlete-starting-point-v2');
});
test('rejects legacy IDs, unknown options, duplicate, excessive and exclusive mixed selections',()=>{
 for(const answers of [{fake:'x'},{'cau-operational-14':'Often'},{'cau-starting-point-01':'bogus'},{'cau-starting-point-46':['Focus','Focus']},{'cau-starting-point-46':['Focus','Confidence','Preparation']},{'cau-starting-point-46':['Focus','I am not sure yet']}]) assert.throws(()=>validateSubmission({name:'Test',email:'a@example.com',answers}));
});
test('19 protected fields never enter the 1-field performance mirror',()=>{
 const split=splitSubmission({submissionId:'test',name:'Example',email:'test@example.com',answers:{'cau-starting-point-39':'Less than 5 hours'}});
 assert.equal(Object.keys(split.auntEdna.fields).length,19);assert.equal(Object.keys(split.pulseCheck.fields).length,1);
 assert.equal(JSON.stringify(split.pulseCheck).includes('Less than 5 hours'),false);
 const mirror=attachAuntEdnaReceipt(split.pulseCheck,{submissionId:'test',recordId:'ae-test',receiptId:'receipt-test'});
 assert.equal(mirror.auntEdnaReferences['cau-starting-point-39'].questionnaireVersion,'athlete-starting-point-v2');
 assert.equal(mirror.auntEdnaReferences['cau-starting-point-39'].value,undefined);
 assert.throws(()=>attachAuntEdnaReceipt(split.pulseCheck,{submissionId:'wrong',recordId:'ae-test',receiptId:'receipt-test'}));
});
test('restricted collection stays excluded from signed-in fallback',()=>{
 const rules=fs.readFileSync('firestore.rules','utf8');assert.match(rules,/collectionName == 'pulsecheck-restricted-questionnaire-submissions'/);
 assert.match(rules,/match \/pulsecheck-restricted-questionnaire-submissions\/\{document=\*\*\} \{\s*allow read, write: if false;/);
});
test('each current item has exactly one routing decision and old IDs cannot be reinterpreted',()=>{
 const source=require('../../src/content/questionnaires/athlete-starting-point.json'),routing=require('../../src/content/questionnaires/cau-routing.json');
 assert.deepEqual(routing.questions.filter(q=>source.questions.some(item=>item.id===q.questionId)).map(q=>q.questionId).sort(),source.questions.map(q=>q.id).sort());
 assert.throws(()=>questionCustodian('cau-operational-35'));
 for(const n of [2,3,4,6,7,8,35,36,37,38,39,40,41,42,43,44,45,47,48])assert.equal(questionCustodian('cau-starting-point-'+String(n).padStart(2,'0')),'auntEDNA');
});

test('the standard questionnaire contains no institution or fixed sport wording', () => {
 const source=require('../../src/content/questionnaires/athlete-starting-point.json');
 const visible=JSON.stringify(source.questions.map(({question,choices,sectionTitle,instructions})=>({question,choices,sectionTitle,instructions})));
 assert.doesNotMatch(visible,/CAU|Clark Atlanta|UMES|volleyball/i);
 assert.equal(source.version,'athlete-starting-point-v2');
});

test('all 19 protected question IDs, wording, choices and instructions remain byte-equivalent to v1',()=>{
 const previous=require('../../src/content/questionnaires/athlete-starting-point-v1.json');
 const current=require('../../src/content/questionnaires/athlete-starting-point.json');
 const protectedItems=current.questions.filter(q=>questionCustodian(q.id)==='auntEDNA');assert.equal(protectedItems.length,19);
 for(const question of protectedItems)assert.deepEqual(question,previous.questions.find(q=>q.id===question.id));
 assert.deepEqual(current.questions.filter(q=>questionCustodian(q.id)==='PulseCheck').map(q=>q.id),['cau-starting-point-46']);
});
