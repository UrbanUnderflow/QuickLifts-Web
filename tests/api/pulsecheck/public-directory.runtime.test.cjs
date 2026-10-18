const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseDirectoryQuery,loadPublicDirectory}=require('../../../src/lib/profiles/publicDirectory.ts');
test('only public directory modes and bounded input accepted',()=>{
 for(const q of [{kind:'email',value:'secret'},{kind:'search',value:''},{kind:'directory',cursor:'a/b'},{kind:'username',value:['x']}]) assert.equal(parseDirectoryQuery(q),null);
 assert.deepEqual(parseDirectoryQuery({kind:'search',value:'name'}),{kind:'search',value:'name',cursor:undefined});
});
test('directory paginates, projects allowlist, excludes closed users',async()=>{
 const calls=[];const docs=Array.from({length:100},(_,i)=>({id:`u${i}`,data:()=>({displayName:'Name',email:'secret',mentalPerformanceGoals:['secret'],profileImage:{profileImageURL:'photo'}})}));
 const query={orderBy(x){calls.push(['orderBy',x]);return this},limit(x){assert.equal(x,100);return this},select(...fields){assert.deepEqual(fields,['displayName','username','bio','profileImage']);return this},get:async()=>({docs})};
 const db={collection(name){return name==='users'?query:{doc(id){return {get:async()=>({exists:id==='u0'})}}}}};
 const result=await loadPublicDirectory(db,{kind:'directory'});
 assert.equal(result.profiles.length,99);assert.equal(result.nextCursor,'u99');assert.equal(JSON.stringify(result).includes('secret'),false);assert.deepEqual(calls,[['orderBy','__name__']]);
});
test('username search is bounded and cannot search private fields',async()=>{
 const calls=[];const query={where(...args){calls.push(args);return this},orderBy(){return this},limit(n){assert.equal(n,10);return this},select(){return this},get:async()=>({docs:[]})};
 const result=await loadPublicDirectory({collection:()=>query},{kind:'search',value:'Athlete'});
 assert.deepEqual(calls,[['username','>=','athlete'],['username','<=','athlete\uf8ff']]);assert.equal(result.nextCursor,null);
});
test('legacy coach screen uses scoped support requests, never raw clinical queries',()=>{
 const fs=require('node:fs');const source=fs.readFileSync('src/components/coach/EscalationDashboard.tsx','utf8');
 assert.match(source,/\/api\/coach\/support-requests\?teamId=/);assert.doesNotMatch(source,/getActiveForCoach|listenForCoach|getDoc|firebase\/firestore/);
});
