const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {compileTypeScriptRuntime, createFirestoreAdminMock, createNextApiResponseRecorder, loadCompiledModule, repoRoot} = require('../firebase-admin/_runtimeHarness.cjs');
const compiled = compileTypeScriptRuntime({cacheKey:'team-code-privacy',entryPaths:[path.join(repoRoot,'src/pages/api/pulsecheck/team-code/redeem.ts'),path.join(repoRoot,'src/lib/pulsecheck/signInPolicy.js')]});
for (const closed of [false,true]) test(`team-code enrollment ${closed ? 'rejects closing account without writes' : 'protects enrolled user atomically'}`,async()=>{
 const firebase=createFirestoreAdminMock({collections:{'pulsecheck-organizations':[{id:'org',data:{status:'active',productBrand:'pulsecheck'}}],'account-closure-jobs':closed?[{id:'athlete',data:{status:'pending'}}]:[]}});
 firebase.admin.auth=()=>({verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);return {uid:'athlete',email:'athlete@example.test'};}});
 const handler=loadCompiledModule({compiled,fileName:'redeem.js',mocks:{'/lib/firebase-admin':{__esModule:true,default:firebase.admin,getFirebaseAdminApp:()=>({})},'/api/firebase/pulsecheckProvisioning/teamCode':{isTeamCodeShaped:()=>true,findTeamByCode:async()=>({id:'team',data:{organizationId:'org',status:'active'}})}}}).default;
 const res=createNextApiResponseRecorder();
 await handler({method:'POST',headers:{authorization:'Bearer synthetic'},body:{teamCode:'ABCDEF'}},res);
 const marker=firebase.getDocument('pulsecheck-private-users/athlete');
 if(closed){assert.equal(marker,undefined);assert.equal(firebase.getDocument('pulsecheck-team-memberships/team_athlete'),undefined);}
 else{assert.equal(marker.protected,true);assert.equal(marker.userId,'athlete');assert.equal(firebase.getDocument('pulsecheck-team-memberships/team_athlete').status,'active');
 const joinedAt=structuredClone(firebase.getDocument('pulsecheck-team-memberships/team_athlete').baselineJoinedAt),clock=Date.now;
 try{Date.now=()=>clock()+60000;await handler({method:'POST',headers:{authorization:'Bearer synthetic'},body:{teamCode:'ABCDEF'}},createNextApiResponseRecorder());}finally{Date.now=clock;}
 assert.deepEqual(firebase.getDocument('pulsecheck-team-memberships/team_athlete').baselineJoinedAt,joinedAt,'re-entering a code while active does not restart the baseline');}
});
