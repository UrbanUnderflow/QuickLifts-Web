import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeDiagnostic} from '../../src/lib/coach-communications/runtime-diagnostic';
const owner='RI6D2h6ygab46uxxxZwVkYpWU6B2';
function setup(overrides:any={}) {
 let calls=0;const deps={authorize:async()=>({uid:owner,db:{} as any}),scope:async()=>{},key:()=> 'KEY_synthetic',now:()=>Date.parse('2026-11-12T16:00:00Z'),fetch:async(url:any,options:any)=>{calls++;assert.equal(url,'https://api.telnyx.com/v2/balance');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');return new Response('{"private":"balance"}',{status:200});},...overrides};
 const req:any={method:'POST',headers:{origin:'https://fitwithpulse.ai','x-pulsecheck-firebase-mode':'prod'}};
 const res:any={code:200,body:undefined,headers:{},setHeader(k:string,v:string){this.headers[k]=v;},status(c:number){this.code=c;return this;},end(){return this;},json(v:any){this.body=v;return this;}};
 return {req,res,run:()=>runtimeDiagnostic(deps)(req,res),calls:()=>calls};
}
test('diagnostic rejects wrong owner, unauthenticated, unauthorized, cross-origin, dev and expired requests before key access',async()=>{
 for(const overrides of [{authorize:async()=>({uid:'other'})},{authorize:async()=>{throw Error('private');}},{scope:async()=>{throw Error('private');}},{now:()=>Date.parse('2026-11-13T00:00:00Z')}]) {
  const s=setup({...overrides,key:()=>{assert.fail('key access');}});await s.run();assert.ok([401,403,404].includes(s.res.code));assert.equal(s.calls(),0);
 }
 for(const [header,value] of [['origin','https://other.test'],['x-pulsecheck-firebase-mode','dev']]){const s=setup({key:()=>{assert.fail('key access');}});s.req.headers[header]=value;await s.run();assert.equal(s.res.code,403);}
 const s=setup();s.req.method='GET';await s.run();assert.equal(s.res.code,405);
});
test('diagnostic returns only shape and bounded authentication metadata',async()=>{
 const s=setup();await s.run();assert.deepEqual(s.res.body,{shape:{present:true,placeholder:false,whitespace:false,quoted:false,keyPrefix:true,bearerPrefix:false},auth:{httpStatus:200}});assert.equal(s.calls(),1);assert.equal(s.res.headers['Cache-Control'],'private, no-store');
 for(const code of ['10009','secret']){const x=setup({fetch:async()=>new Response(JSON.stringify({errors:[{code,detail:'secret'}]}),{status:401})});await x.run();assert.deepEqual(x.res.body.auth,{httpStatus:401,...(code==='10009'?{providerErrorCode:code}:{})});assert.ok(!JSON.stringify(x.res.body).includes('secret'));}
 for(const key of ['', '***', ' KEY_synthetic', '"KEY_synthetic"','Bearer KEY_synthetic']){const x=setup({key:()=>key});await x.run();assert.equal(x.calls(),0);assert.equal(x.res.body.auth,undefined);}
 const x=setup({fetch:async()=>{throw Error('private headers');}});await x.run();assert.equal(x.res.code,503);assert.ok(!JSON.stringify(x.res.body).includes('private'));
});
