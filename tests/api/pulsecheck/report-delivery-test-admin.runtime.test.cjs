const test=require('node:test');
const assert=require('node:assert/strict');
const {compileTypeScriptRuntime,loadCompiledModule,createFirestoreAdminMock}=require('../firebase-admin/_runtimeHarness.cjs');
const compiled=compileTypeScriptRuntime({cacheKey:'report-sms-test-admin',entryPaths:['src/pages/api/admin/pulsecheck/report-delivery-test.ts']});
function setup(adminAllowed=true){
 const f=createFirestoreAdminMock({collections:{admin:[{id:'admin@example.test',data:{}}],'coach-team-insight-reports/delivery/configs':[{id:'team',data:{teamId:'team',recipientUids:['adminUid','coach'],smsRecipientUids:['adminUid','coach']}}]}});
 const calls=[];
 const app={firestore:()=>f.db,auth:()=>({verifyIdToken:async()=>({uid:'adminUid',email:'admin@example.test'})})};
 const mod=loadCompiledModule({compiled,fileName:'report-delivery-test.js',mocks:{
  '../_auth':{requireAdminRequest:async()=>adminAllowed},
  '/lib/firebase-admin':{getFirebaseAdminApp:()=>app},
  '/coach-dashboard/access':{validTeamId:s=>typeof s==='string'&&/^[a-zA-Z0-9_-]+$/.test(s)},
  '/coach-dashboard/reportDelivery':{validateDeliveryConfig:v=>v,dueReports:()=>[{kind:'daily',reportDate:'2026-11-17'}]},
  '/coach-dashboard/reportDeliveryRunner':{runReportDeliveries:async(...args)=>{calls.push(['email',args]);return{sent:1}}},
  '/coach-dashboard/reportSmsDelivery':{runReportSmsDeliveries:async(...args)=>{calls.push(['sms',args]);return{accepted:3}}},
 }});
 return{handler:mod.default,calls};
}
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(v){this.statusCode=v;return this},json(v){this.body=v;return this}});
test('admin test invokes both real runners scoped to verified identity and completed period',async()=>{const s=setup();let res=response();await s.handler({method:'POST',headers:{authorization:'Bearer test'},body:{teamId:'team',kind:'daily'}},res);assert.equal(res.statusCode,200);assert.equal(s.calls.length,2);for(const [,args]of s.calls){assert.deepEqual(args[2].run,{teamId:'team',uid:'adminUid',kind:'daily',reportDate:'2026-11-17'});}res=response();await s.handler({method:'POST',headers:{authorization:'Bearer test'},body:{teamId:'team',kind:'daily',phone:'+15555551111'}},res);assert.equal(res.statusCode,400);assert.equal(s.calls.length,2);});
test('unauthenticated request never reaches either report runner',async()=>{const s=setup(false),res=response();await s.handler({method:'POST',headers:{},body:{teamId:'team',kind:'daily'}},res);assert.equal(res.statusCode,401);assert.equal(s.calls.length,0);});
