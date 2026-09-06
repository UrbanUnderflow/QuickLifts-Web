const fs=require('fs');
const auth=require('firebase-tools/lib/auth');
async function main(){
 const account=auth.getGlobalDefaultAccount();if(!account?.tokens?.refresh_token)throw new Error('Firebase CLI sign-in required');
 const token=await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
 const headers={Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'};
 const base='https://firebaserules.googleapis.com/v1/';
 async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw new Error(data.error?.message || `HTTP ${r.status}`);return data;}
 const release=await api('projects/quicklifts-dev-01/releases/cloud.firestore');
 const rules=await api(release.rulesetName);fs.writeFileSync('/tmp/nora-dev-rules-before.json',JSON.stringify(rules,null,2));
 const files=rules.source.files.map(f=>({...f,content:f.content.replace('return request.auth != null;', "return request.auth != null && request.auth.uid != 'nora-local-synthetic-tester';").replace('function isExplicitlyRuledCollection(collectionName) {\n      return collectionName in [', "function isExplicitlyRuledCollection(collectionName) {\n      return collectionName.matches('nora-red-team-.*') || collectionName in [")}));
 if(files.every((f,i)=>f.content===rules.source.files[i].content)){console.log('Already protected');return;}
 const check=await api('projects/quicklifts-dev-01:test','POST',{source:{files},testSuite:{testCases:[]}});
 if(check.issues?.some(i=>i.severity==='ERROR'))throw new Error('Rules validation failed');
 const fresh=await api('projects/quicklifts-dev-01/releases/cloud.firestore');if(fresh.rulesetName!==release.rulesetName)throw new Error('Rules changed during review');
 const created=await api('projects/quicklifts-dev-01/rulesets','POST',{source:{files}});
 await api('projects/quicklifts-dev-01/releases/cloud.firestore','PATCH',{release:{name:'projects/quicklifts-dev-01/releases/cloud.firestore',rulesetName:created.name},updateMask:'rulesetName'});
 fs.writeFileSync('/tmp/nora-dev-rules-after.json',JSON.stringify({source:{files}},null,2));console.log('Deployed narrow development-only testing protection');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
