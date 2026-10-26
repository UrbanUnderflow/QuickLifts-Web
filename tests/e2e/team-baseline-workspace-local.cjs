// Real workspace route with synthetic services; all external requests are blocked.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),{chromium}=require('playwright'),root=path.resolve(__dirname,'../..');
(async()=>{
 const mocks={
  'next/head':'export default function Head(){return null}',
  'next/link':'import React from "react";export default function Link(p){return <a {...p}/>} ',
  'next/router':`const router={query:{organizationId:'org',teamId:'second'},replace:async p=>{window.__navigation=p},push:async p=>{window.__navigation=p}};export const useRouter=()=>router;`,
  'firebase/firestore':'export const collection=(...x)=>x,doc=(...x)=>x,query=(...x)=>x,where=(...x)=>x,limit=(...x)=>x;export const getDoc=async()=>({exists:()=>false}),getDocs=async()=>({docs:[]});',
  '/api/firebase/config':`export const db={},auth={currentUser:{uid:'athlete',getIdToken:async()=>'synthetic'}},isUsingDevFirebase=()=>true;`,
  '/hooks/useUser':`const user={id:'athlete',displayName:'Local Athlete',email:'local@example.test'};export const useUser=()=>user,useUserLoading=()=>false;`,
  '/api/firebase/user':`export const userService={getUsersByIds:async()=>[{id:'athlete',displayName:'Local Athlete'}]};`,
  '/api/firebase/pulsecheckProvisioning/service':`export const pulseCheckProvisioningService={listTeamMemberships:async()=>[{id:'second_athlete',userId:'athlete',teamId:'second',organizationId:'org',role:window.__role||'athlete',status:'active',athleteOnboarding:{entryOnboardingStep:'complete',productConsentAccepted:true,baselinePathStatus:'complete'}}],getOrganization:async()=>({id:'org',displayName:'Organization'}),getTeam:async()=>({id:'second',displayName:'Second Team'}),listTeamInviteLinks:async()=>[],updateAthleteBaselineStatus:async()=>{window.__legacyWrites=(window.__legacyWrites||0)+1}};`,
  '/api/firebase/mentaltraining':`export const athleteProgressService={get:async()=>{window.__progressLoads=(window.__progressLoads||0)+1;return null}},assignmentService={getPendingForAthlete:async()=>[]},assignmentOrchestratorService={getForAthleteOnDate:async()=>null},PulseCheckDailyAssignmentStatus={Assigned:'assigned',Viewed:'viewed',Started:'started',Completed:'completed',Overridden:'overridden',Deferred:'deferred',Superseded:'superseded'};`,
  '/components/onboarding/GuidedTour':'export default function GuidedTour(){return null}',
 };
 const result=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/pages/PulseCheck/team-workspace';createRoot(document.getElementById('root')).render(<Page/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'synthetic-workspace',setup(b){b.onResolve({filter:/.*/},a=>{const key=Object.keys(mocks).find(k=>a.path===k||a.path.endsWith(k));return key?{path:key,namespace:'fixture'}:undefined});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
 const server=http.createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(result.outputFiles[0].contents)}res.setHeader('Content-Type','text/html');res.end('<html><body><div id="root"></div><script src="/app.js"></script></body></html>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});let external=0;
 try{
  for(const scenario of ['new-team','verified-complete','unavailable']){
   const page=await browser.newPage();await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.pathname==='/api/pulsecheck/baseline')return route.fulfill({status:scenario==='unavailable'?503:200,json:{required:scenario==='new-team',completed:true}});if(u.hostname!=='127.0.0.1'){external++;return route.abort()}return route.continue()});
   await page.goto(`http://127.0.0.1:${server.address().port}`);
   if(scenario==='verified-complete'){await page.waitForFunction(()=>window.__progressLoads===1);assert.equal(await page.evaluate(()=>window.__navigation),undefined)}
   else{await page.waitForFunction(()=>window.__navigation);assert.equal(await page.evaluate(()=>window.__navigation),'/PulseCheck/baseline');assert.equal(await page.evaluate(()=>window.__progressLoads||0),0);assert.equal(await page.evaluate(()=>window.__legacyWrites||0),0)}
   await page.close();
  }
  assert.equal(external,0);console.log(JSON.stringify({success:true,scenarios:3,externalRequests:external}));
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
