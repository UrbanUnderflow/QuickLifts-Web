import test from 'node:test';import assert from 'node:assert/strict';
import {parseSnapshot,reconcileSnapshot,changeMark,accountKey,validateAccounts,ReviewError} from '../../src/lib/instafollows/model';
import {reviewHandler} from '../../src/lib/instafollows/server';
const snapshot=(reviewed:string[]=[],dontUnfollow:string[]=[],time='2026-11-12T18:00:00Z')=>parseSnapshot({source:'https://tremaine-instagram-review.tremaine.chatgpt.site/',capturedAt:time,reviewed,dontUnfollow});
test('snapshot requires exact origin and preserves independent and unknown marks',()=>{
 for(const source of ['https://tremaine-instagram-review.tremaine.chatgpt.site.evil.test','https://tremaine-instagram-review.tremaine.chatgpt.site@evil.test','http://tremaine-instagram-review.tremaine.chatgpt.site'])assert.throws(()=>parseSnapshot({...snapshot(),source}));
 const out=reconcileSnapshot({},undefined,snapshot(['synthetic.a'],['synthetic.a','unknown']));assert.equal(out.entries[accountKey('synthetic.a')].reviewed?.value,true);assert.equal(out.entries[accountKey('synthetic.a')].dontUnfollow?.value,true);assert.equal(out.entries[accountKey('unknown')].dontUnfollow?.value,true);
});
test('final delta preserves newer user edits, imports removals, and rejects stale snapshots',()=>{
 const old=snapshot(['a','b'],['a']),initial=reconcileSnapshot({},undefined,old);
 initial.entries[accountKey('a')]=changeMark(initial.entries[accountKey('a')],{flag:'reviewed',value:false,expectedRevision:1,operationId:'11111111-1111-4111-8111-111111111111'});
 const newer=snapshot(['a','c'],[],'2026-11-12T19:00:00Z'),next=reconcileSnapshot(initial.entries,old,newer);
 assert.equal(next.entries[accountKey('a')].reviewed?.value,false);assert.equal(next.entries[accountKey('b')].reviewed?.value,false);assert.equal(next.entries[accountKey('a')].dontUnfollow?.value,false);assert.equal(next.entries[accountKey('c')].reviewed?.value,true);assert.throws(()=>reconcileSnapshot(next.entries,newer,old));
});
test('mark revisions guard stale writes and undo while retries are idempotent',()=>{
 const change={flag:'reviewed',value:true,expectedRevision:0,operationId:'11111111-1111-4111-8111-111111111111'};const first=changeMark({},change);assert.deepEqual(changeMark(first,change),first);assert.throws(()=>changeMark(first,{...change,operationId:'22222222-2222-4222-8222-222222222222'}));const keep=changeMark(first,{...change,flag:'dontUnfollow'});assert.equal(keep.reviewed?.value,true);assert.equal(keep.dontUnfollow?.value,true);
});
test('data validation rejects duplicate accounts and path-like names',()=>{assert.throws(()=>validateAccounts([{username:'../x',full_name:''}]));assert.throws(()=>validateAccounts([{username:'A',full_name:''},{username:'a',full_name:''}]));});
test('private API rejects unauthorized reads, images, and writes before database access',async()=>{
 for(const method of ['GET','PATCH'])for(const query of [{},{image:'synthetic'}]){const req:any={method,query,headers:{},body:{}};const res:any={code:200,headers:{},setHeader(k:string,v:string){this.headers[k]=v;},status(n:number){this.code=n;return this;},json(v:any){return v;},end(){}};await reviewHandler(async()=>{throw new ReviewError(403,'Denied');})(req,res);assert.equal(res.code,403);assert.equal(res.headers['Cache-Control'],'private, no-store');}
});
