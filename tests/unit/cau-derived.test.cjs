const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {deriveAdministrativeAnswers,applyAdministrativeAnswers}=require('../../src/lib/questionnaires/cau-derived.ts');
test('server date, profile season and scoped count replace browser claims',async()=>{
 let filter;
 const db={collection:name=>({doc:()=>({get:async()=>({data:()=>({seasonPhase:'In-Season'})}),collection:()=>({where:(...args)=>{filter=args;return {count:()=>({get:async()=>({data:()=>({count:7})})})}}})})})};
 const derived=await deriveAdministrativeAnswers(db,'athlete',new Date('2026-09-19T01:00:00Z'));
 assert.equal(derived.answers['cau-operational-05'],'2026-09-18');
 assert.equal(derived.answers['cau-operational-11'],'In season');
 assert.equal(derived.metadata.pulseCheckCheckInsBeforeToday,7);
 assert.deepEqual(filter,['sourceDate','<','2026-09-18']);
 assert.equal(derived.answers['cau-operational-08'],'Not sure');
 const input=applyAdministrativeAnswers({answers:{'cau-operational-05':'2000-01-01','cau-operational-06':'2000-01-01','cau-operational-08':'More than 10','cau-operational-35':'Agree'},administrativeMetadata:{forged:true}},derived);
 assert.equal(input.answers['cau-operational-06'],undefined);assert.equal(input.answers['cau-operational-35'],'Agree');assert.equal(input.administrativeMetadata.forged,undefined);
});
test('unavailable lookup stays unknown rather than zero or invented season',async()=>{
 const result=await deriveAdministrativeAnswers({collection:()=>{throw Error('offline')}},'athlete');
 assert.equal(result.metadata.pulseCheckCheckInsBeforeToday,null);assert.equal(result.answers['cau-operational-11'],'Not sure');
});
