import test from 'node:test';import assert from 'node:assert/strict';import {randomInt} from 'node:crypto';
import {COOKIE,SESSION_MS,createPinConfig,validateConfig,verifyPin,pinHandler,requireSession,reserveAttempt,sessionId} from '../../src/lib/instafollows/pin';
import {reviewHandler} from '../../src/lib/instafollows/server';
import {ROOT_COLLECTION,ROOT_DOCUMENT} from '../../src/lib/instafollows/model';
const base=`${ROOT_COLLECTION}/${ROOT_DOCUMENT}`;
class DB{
 data=new Map<string,any>();queue=Promise.resolve();
 collection(p:string):any{return {doc:(id:string)=>this.doc(p+'/'+id)};}
 doc(p:string):any{return {path:p,collection:(name:string)=>this.collection(p+'/'+name),get:async()=>({data:()=>this.data.get(p),exists:this.data.has(p)}),set:async(v:any,o:any)=>{this.data.set(p,o?.merge?{...this.data.get(p),...v}:v);}};}
 runTransaction(fn:any){const task=this.queue.then(async()=>{const writes:any[]=[];const out=await fn({get:(r:any)=>r.get(),set:(r:any,v:any)=>writes.push([r.path,v])});for(const [p,v]of writes)this.data.set(p,v);return out;});this.queue=task.then(()=>{},()=>{});return task;}
}
const req=(method='GET',body:any={})=>({method,body,query:{},headers:{origin:'https://fitwithpulse.ai','content-type':'application/json','x-instafollows-request':'1','sec-fetch-site':'same-origin'}} as any);
const response=()=>({code:200,body:undefined as any,headers:{} as any,setHeader(k:string,v:any){this.headers[k]=v;},status(n:number){this.code=n;return this;},json(v:any){this.body=v;return this;},end(){return this;}});
const pin=String(randomInt(1000000)).padStart(6,'0');let config:any;
test('salted slow verifier is random and configuration fails closed',async()=>{config=await createPinConfig(pin);const another=await createPinConfig(pin);assert.notEqual(config.salt,another.salt);assert.notEqual(config.verifier,another.verifier);assert.ok(await verifyPin(pin,config));assert.equal(await verifyPin('invalid',config),false);assert.throws(()=>validateConfig(undefined));assert.throws(()=>validateConfig({...config,sessionSecret:''}));});
test('unlock issues only protected cookie; tampering, expiry, rotation and lock reject session',async()=>{
 const db=new DB();db.data.set(base+'/security/pin',config);let now=100000;const handler=pinHandler(async()=>db as any,()=>now),r=response();await handler(req('POST',{pin}),r);assert.equal(r.code,200);assert.deepEqual(r.body,{unlocked:true,expiresAt:now+SESSION_MS});const cookie=r.headers['Set-Cookie'];assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);assert.match(cookie,/Path=\//);const token=cookie.split(';')[0].split('=')[1],get=req();get.headers.cookie=`${COOKIE}=${token}`;
 await requireSession(db as any,get,now);const tampered=req();tampered.headers.cookie=`${COOKIE}=${token.slice(0,-1)}${token.endsWith('A')?'B':'A'}`;await assert.rejects(requireSession(db as any,tampered,now));await assert.rejects(requireSession(db as any,get,now+SESSION_MS));
 const del=req('DELETE');del.headers.cookie=get.headers.cookie;const out=response();await handler(del,out);assert.equal(out.body.unlocked,false);await assert.rejects(requireSession(db as any,get,now));assert.match(out.headers['Set-Cookie'],/Max-Age=0/);
 db.data.set(base+'/security/pin',{...config,sessionSecret:'f'.repeat(64)});await assert.rejects(requireSession(db as any,get,now));
});
test('distributed reservations enforce concurrency and global caps despite spoofed headers with bounded storage',async()=>{
 const db=new DB(),request=req('POST');const results=await Promise.allSettled(Array.from({length:12},()=>reserveAttempt(db as any,config,request,1000)));assert.equal(results.filter(r=>r.status==='fulfilled').length,5);
 const other=new DB();let accepted=0;for(let i=1;i<=200;i++){const r=req('POST');r.headers['x-forwarded-for']=`198.51.100.${i}`;r.headers['x-nf-client-connection-ip']=`192.0.2.${i}`;try{await reserveAttempt(other as any,config,r,1000);accepted++;}catch{}}assert.equal(accepted,15);assert.ok(other.data.size<=66);
});
test('CSRF, absent sessions, Firebase bearer and missing config cannot expose records, images or edits',async()=>{
 const db=new DB();db.data.set(base+'/security/pin',config);
 for(const method of ['GET','PATCH'])for(const image of [false,true]){const r=req(method);if(image)r.query.image='synthetic';r.headers.authorization='Bearer synthetic';const out=response();await reviewHandler(async request=>{await requireSession(db as any,request);return db as any;})(r,out);assert.equal(out.code,401);assert.equal(out.headers['Cache-Control'],'private, no-store');}
 for(const patch of [{origin:'https://evil.test'},{'x-instafollows-request':undefined},{'sec-fetch-site':'cross-site'},{'content-type':'text/plain'}]){const r=req('POST',{pin});Object.assign(r.headers,patch);const out=response();await pinHandler(async()=>db as any)(r,out);assert.equal(out.code,403);}
 const empty=response();await pinHandler(async()=>new DB() as any)(req('POST',{pin}),empty);assert.equal(empty.code,503);
 const marks={entries:{synthetic:{reviewed:{value:true}}}};db.data.set(base+'/state/marks',marks);const out=response();await pinHandler(async()=>db as any)(req('POST',{pin:'invalid'}),out);assert.equal(out.code,401);assert.deepEqual(db.data.get(base+'/state/marks'),marks);
});
