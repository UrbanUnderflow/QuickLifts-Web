const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8188';
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const admin=require('firebase-admin');
const {compileTypeScriptRuntime,loadCompiledModule}=require('../firebase-admin/_runtimeHarness.cjs');
const compiled=compileTypeScriptRuntime({cacheKey:'consent-http-auth',entryPaths:['netlify/functions/pulsecheck-consent-save.ts']});
test('real emulator bearer HTTP consent save/reopen; foreign identity, revoked and missing tokens denied',async()=>{
 const projectId='demo-developer-docs';const app=admin.initializeApp({projectId},`consent-http-${Date.now()}`),db=app.firestore();
 const {handler}=loadCompiledModule({compiled,fileName:'pulsecheck-consent-save.js',mocks:{'./config/firebase':{admin,getFirebaseAdminApp:()=>app,headers:{'Content-Type':'application/json'}}}});
 // Config only is injected. Handler, token validation and atomic transaction are real.
 const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;try{const result=await handler({httpMethod:req.method,headers:req.headers,body},{});res.writeHead(result.statusCode,result.headers);res.end(result.body);}catch(e){res.writeHead(500);res.end(String(e));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/.netlify/functions/pulsecheck-consent-save`;
 async function identity(email){const response=await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'SyntheticOnly!567',returnSecureToken:true})});const data=await response.json();assert.ok(data.idToken,JSON.stringify(data));return data;}
 try{
 const suffix=Date.now(),owner=await identity(`athlete-${suffix}@synthetic.example`),foreign=await identity(`other-${suffix}@synthetic.example`);
 const uid=owner.localId,teamId=`http-team-${suffix}`,orgId=`http-org-${suffix}`,memberId=`${teamId}_${uid}`,document={id:'custom-participation',category:'participation',title:'Synthetic participation',body:'Synthetic terms for local test.',version:'test-v1'};
 const optional={id:'custom-health',category:'health_authorization',title:'Synthetic health authorization',body:'Optional synthetic health terms.',version:'test-v1'};
 const documents=[document,optional];
 await Promise.all([db.doc(`pulsecheck-organizations/${orgId}`).set({status:'active',productBrand:'pulsecheck'}),db.doc(`pulsecheck-teams/${teamId}`).set({organizationId:orgId,status:'active',requiredConsents:documents}),db.doc(`pulsecheck-team-memberships/${memberId}`).set({userId:uid,role:'athlete',teamId,organizationId:orgId,status:'active',athleteOnboarding:{}}),db.doc(`users/${uid}`).set({displayName:'Synthetic Athlete'})]);
 const input={teamMembershipId:memberId,action:'progress',expectedContext:{organizationId:orgId,teamId,pilotId:'',cohortId:'',productBrand:'pulsecheck',documents},onboarding:{consentDecisions:Object.fromEntries(documents.map(d=>[d.id,{decision:d.category==='participation'?'accepted':'declined',version:d.version,signedName:'Synthetic Athlete',decidedAt:new Date().toISOString(),document:d}]))}};
 const send=token=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(input)});
 assert.equal((await send()).status,401);assert.equal((await send('invalid')).status,401);assert.equal((await send(foreign.idToken)).status,403);
 const response=await send(owner.idToken);assert.equal(response.status,200,await response.clone().text());assert.ok(await response.json());
 const saved=(await db.doc(`pulsecheck-team-memberships/${memberId}`).get()).data();assert.equal(saved.athleteOnboarding.consentDecisions[optional.id].decision,'declined');
 assert.equal((await send(owner.idToken)).status,200); // HTTP reopen/retry preserves receipt.
 await new Promise(resolve=>setTimeout(resolve,1100));await app.auth().revokeRefreshTokens(uid);
 assert.equal((await send(owner.idToken)).status,401);
 assert.deepEqual((await db.doc(`pulsecheck-team-memberships/${memberId}`).get()).data().athleteOnboarding.consentDecisions,saved.athleteOnboarding.consentDecisions);
 }finally{await new Promise(resolve=>server.close(resolve));await app.delete();}
});
