const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function fixture(){
 const values=new Map([['simpbudget-users/owner/statementImports/s1',{id:'s1',status:'committed',transactions:[{id:'r1',spaceId:'pulse',reviewed:true,splits:[{spaceId:'pulse',amount:12}]}]}]]);
 const writes=[];
 const ref=path=>({path,collection:name=>ref(path+'/'+name),doc:id=>ref(path+'/'+id),get:async()=>({exists:values.has(path),data:()=>values.get(path)})});
 const db={collection:name=>ref(name),runTransaction:async fn=>{const staged=[];const result=await fn({get:r=>r.get(),set:(r,v)=>staged.push([r.path,v])});for(const [p,v]of staged){values.set(p,v);writes.push(p);}return result;}};
 const exp={}; const source=ts.transpileModule(fs.readFileSync('netlify/functions/simpbudget-statement-document.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','Buffer',source)(name=>name.includes('getSimpBudgetServiceAccount')?{getSimpBudgetAuth:async()=>({verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);if(token==='bad')throw Error('bad');return{uid:token};}}),getSimpBudgetFirestore:async()=>db}:require(name),exp,Buffer);
 const run=(body,token='owner')=>exp.handler({httpMethod:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(body)});
 const file={action:'attach',statementId:'s1',fileName:'statement.pdf',mimeType:'application/pdf',dataBase64:Buffer.from('%PDF-1.7 synthetic original').toString('base64')};
 return{run,file,values,writes};
}
test('original roundtrip is exact, idempotent and never changes sorted ledger',async()=>{
 const f=fixture();const before=JSON.stringify(f.values.get('simpbudget-users/owner/statementImports/s1'));
 assert.equal((await f.run(f.file)).statusCode,200);
 const firstWrites=f.writes.length;assert.equal((await f.run(f.file)).statusCode,200);assert.equal(f.writes.length,firstWrites);
 const read=await f.run({action:'read',statementId:'s1'});assert.equal(read.statusCode,200);assert.equal(JSON.parse(read.body).dataBase64,f.file.dataBase64);
 assert.equal(JSON.stringify(f.values.get('simpbudget-users/owner/statementImports/s1')),before);
 assert.ok(f.writes.every(p=>!p.includes('/statementImports/')));
 const other={...f.file,dataBase64:Buffer.from('%PDF-1.7 different original').toString('base64')};assert.equal((await f.run(other)).statusCode,409);
});
test('cross-user and invalid auth cannot read, list or attach another user originals',async()=>{
 const f=fixture();await f.run(f.file);
 for(const action of ['attach','read'])assert.equal((await f.run({...f.file,action},'other')).statusCode,404);
 assert.deepEqual(JSON.parse((await f.run({action:'list',ids:['s1']},'other')).body).documents,[]);
 assert.equal((await f.run(f.file,'bad')).statusCode,401);
 assert.equal((await f.run({...f.file,statementId:'../owner'})).statusCode,400);
});
test('imported CSV and later original coexist without duplicate transaction imports',async()=>{
 const f=fixture();assert.equal((await f.run({...f.file,role:'import',fileName:'statement.csv',mimeType:'text/csv',dataBase64:Buffer.from('date,amount\n2026-01-01,12').toString('base64')})).statusCode,200);
 assert.equal((await f.run(f.file)).statusCode,200);
 assert.equal(JSON.parse((await f.run({action:'list',ids:['s1']})).body).documents.length,2);
});
test('validates signatures, size and chunk integrity',async()=>{
 const f=fixture();assert.equal((await f.run({...f.file,dataBase64:Buffer.from('html').toString('base64')})).statusCode,400);
 assert.equal((await f.run({...f.file,dataBase64:'a'.repeat(5600000)})).statusCode,413);
 const bytes=Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(700000,32)]);assert.equal((await f.run({...f.file,dataBase64:bytes.toString('base64')})).statusCode,200);
 assert.equal(JSON.parse((await f.run({action:'read',statementId:'s1'})).body).dataBase64,bytes.toString('base64'));
 f.values.delete('simpbudget-users/owner/statementDocumentChunks/s1_1');assert.equal((await f.run({action:'read',statementId:'s1'})).statusCode,500);
});
