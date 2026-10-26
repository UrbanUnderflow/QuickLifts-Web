const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const prior=require.extensions['.ts'];require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);
const {baselineCompletionUrl}=require(path.resolve('src/lib/questionnaires/baseline-completion-url.ts'));require.extensions['.ts']=prior;
test('completion stays on the exact hosted candidate instead of crossing into production',()=>{
 assert.equal(baselineCompletionUrl({DEPLOY_URL:'https://candidate--quickliftsapp.netlify.app',URL:'https://fitwithpulse.ai'}),'https://candidate--quickliftsapp.netlify.app/.netlify/functions/complete-pulsecheck-baseline');
 assert.equal(baselineCompletionUrl({DEPLOY_PRIME_URL:'https://branch--quickliftsapp.netlify.app'}),'https://branch--quickliftsapp.netlify.app/.netlify/functions/complete-pulsecheck-baseline');
 assert.equal(baselineCompletionUrl({PULSECHECK_BASELINE_DEPLOYMENT_ORIGIN:'https://built--quickliftsapp.netlify.app',URL:'https://fitwithpulse.ai'}),'https://built--quickliftsapp.netlify.app/.netlify/functions/complete-pulsecheck-baseline');
 assert.equal(baselineCompletionUrl({}),'https://fitwithpulse.ai/.netlify/functions/complete-pulsecheck-baseline');
});
test('an invalid configured host fails closed without forwarding tokens elsewhere',()=>{
 for(const DEPLOY_URL of ['https://untrusted.invalid','http://fitwithpulse.ai','https://fitwithpulse.ai.untrusted.invalid','https://token@fitwithpulse.ai','https://fitwithpulse.ai:8443','not a URL'])assert.throws(()=>baselineCompletionUrl({DEPLOY_URL}));
});
