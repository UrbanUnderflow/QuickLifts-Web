const {test}=require('node:test');
const fs=require('fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/node_modules/@firebase/rules-unit-testing');
const {doc,setDoc,getDoc}=require('/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/node_modules/firebase/firestore');
for(const [label,rulesFile,shouldAllow] of [['deployed','/tmp/consent-deployed-firestore.rules',true],['local','/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/firestore.rules',false]]){
 test(label+' rules: unrelated signed-in membership consent-summary read '+(shouldAllow?'ALLOWED (privacy gap)':'DENIED'),async()=>{
  const env=await initializeTestEnvironment({projectId:'demo-consent-summary-'+label,firestore:{host:'127.0.0.1',port:8197,rules:fs.readFileSync(rulesFile,'utf8')}});
  try{
   await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'pulsecheck-team-memberships/team_athlete'),{userId:'athlete',teamId:'team',organizationId:'org',role:'athlete',athleteOnboarding:{consentDecisions:{health:{decision:'declined',signedName:'Synthetic Athlete',version:'v1'}}}});});
   const unrelated=env.authenticatedContext('unrelated').firestore();
   await (shouldAllow?assertSucceeds:assertFails)(getDoc(doc(unrelated,'pulsecheck-team-memberships/team_athlete')));
  }finally{await env.cleanup();}
 });
}
