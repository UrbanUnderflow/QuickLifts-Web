// Real onboarding page + atomic persistence, isolated adapters and demo emulator only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {compileTypeScriptRuntime,loadCompiledModule}=require('../api/firebase-admin/_runtimeHarness.cjs');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const {execFileSync}=require('node:child_process');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8188';
const admin=require('firebase-admin');
const app=admin.initializeApp({projectId:'demo-consent-browser'},'consent-browser');const db=app.firestore();
const compiled=compileTypeScriptRuntime({cacheKey:'consent-browser',entryPaths:['src/lib/server/pulsecheck/atomicConsent.ts']});
const {saveAtomicConsent,resolveAtomicConsentDocuments}=loadCompiledModule({compiled,fileName:'atomicConsent.js'});
const root=path.resolve(__dirname,'../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'consent-browser-'));
const id='team_athlete',memberRef=db.doc(`pulsecheck-team-memberships/${id}`);
let saves=0;
(async()=>{
 const team={status:'active',organizationId:'org'},pilot={status:'active',teamId:'team',organizationId:'org',studyMode:'research'};
 const docs=resolveAtomicConsentDocuments(team,pilot,'pulsecheck');
 await Promise.all([db.doc('pulsecheck-organizations/org').set({status:'active',productBrand:'pulsecheck'}),db.doc('pulsecheck-teams/team').set(team),db.doc('pulsecheck-pilots/pilot').set(pilot),db.doc('users/athlete').set({displayName:'Synthetic Athlete'}),memberRef.set({userId:'athlete',teamId:'team',organizationId:'org',role:'athlete',status:'active',athleteOnboarding:{targetPilotId:'pilot',requiredConsents:docs}})]);
 const modules={
  'next/router':`const router={query:{teamId:'team',organizationId:'org'},push:async()=>{},replace:async()=>{},isReady:true};export const useRouter=()=>router;`,
  'next/head':`export default function Head(){return null}`,
  'next/link':`import React from 'react';export default function Link(p){return <a {...p}/>}`,
  '../../hooks/useUser':`const user={id:'athlete',displayName:'Synthetic Athlete',email:'synthetic@example.test'};export const useUser=()=>user;export const useUserLoading=()=>false;`,
  '../../api/firebase/user':`export const userService={fetchUserFromFirestore:async()=>({})};`,
  '../../utils/pdf':`export const renderHtmlToPdf=async()=>{};`,
  '../../utils/devAuthBypass':`export const isDevAuthBypassEnabled=()=>false;`,
  '../../api/firebase/pulsecheckProvisioning/service':`export const pulseCheckProvisioningService=new Proxy({}, {get:(_,name)=>(...args)=>window.__bridge(name,args)});`
 };
 const bundle=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/pages/PulseCheck/athlete-onboarding';createRoot(document.getElementById('app')).render(<Page/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',plugins:[{name:'isolated-adapters',setup(b){b.onResolve({filter:/.*/},args=>modules[args.path]?{path:args.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path],loader:'jsx',resolveDir:root}));}}]});
 execFileSync(process.execPath,[path.join(root,'node_modules/tailwindcss/lib/cli.js'),'--content',path.join(root,'src/pages/PulseCheck/athlete-onboarding.tsx')+','+path.join(root,'src/components/pulsecheck/consent/ConsentChoices.tsx'),'-o',path.join(out,'fixture.css'),'--minify'],{stdio:'pipe'});
 const browser=await chromium.launch();
 try{
 const context=await browser.newContext({viewport:{width:1280,height:1000}});
 await context.route('**/*',route=>route.abort()); // No external API, identity, delivery, or cloud traffic.
 await context.exposeFunction('__bridge',async(name,args)=>{
  if(name==='listUserTeamMemberships'){const snap=await memberRef.get();return [{id,...snap.data()}];}
  const collections={getTeam:'pulsecheck-teams',getOrganization:'pulsecheck-organizations',getPilot:'pulsecheck-pilots'};
  if(collections[name]){const snap=await db.doc(`${collections[name]}/${args[0]}`).get();return {id:snap.id,...snap.data(),...(name==='getOrganization'?{configuredProductBrand:snap.data().productBrand}:{})};}
  if(name==='saveAthleteOnboardingProgress'){const input=args[0];await saveAtomicConsent(db,'athlete',{teamMembershipId:id,action:'progress',expectedContext:input.expectedContext,onboarding:input},()=>admin.firestore.FieldValue.serverTimestamp());saves++;return {};}
  throw Error(`Unexpected service ${name}`);
 });
 async function open(){const p=await context.newPage();await p.setContent('<html><body style="background:#0b0b1c;color:white"><div id="app"></div></body></html>');await p.addStyleTag({path:path.join(out,'fixture.css')});await p.addScriptTag({content:bundle.outputFiles[0].text});await p.getByText('Your agreements and choices',{exact:true}).waitFor();return p;}
 let p=await open();
 await p.getByPlaceholder('Type your full name here').fill('Synthetic Athlete');
 const articles=p.locator('article');
 for(let i=0;i<docs.length;i++){
  const article=articles.nth(i),category=docs[i].category;
  if(category==='health_authorization')await article.getByRole('button',{name:'Decline authorization',exact:true}).click();
  else if(category==='research')await article.getByRole('button',{name:'Decline research',exact:true}).click();
  else {await article.locator('summary').click();await article.getByRole('button',{name:'Agree and sign',exact:true}).click();}
 }
 await p.waitForFunction(()=>true); // Wait below polls persisted state rather than elapsed time.
 async function receiptReady(){for(let i=0;i<80;i++){const data=(await memberRef.get()).data();if(Object.keys(data.athleteOnboarding.consentDecisions||{}).length===docs.length)return data;await new Promise(r=>setTimeout(r,100));}throw Error('Consent did not persist');}
 const saved=await receiptReady();
 for(const document of docs)assert.equal(saved.athleteOnboarding.consentDecisions[document.id].decision,['health_authorization','research'].includes(document.category)?'declined':'accepted');
 await p.screenshot({path:path.join(out,'saved.png'),fullPage:true});await p.close();p=await open();
 assert.equal(await p.getByText('Selected choice: declined',{exact:false}).count(),docs.filter(d=>['health_authorization','research'].includes(d.category)).length);
 await p.waitForTimeout(1000);await p.screenshot({path:path.join(out,'reopened.png'),fullPage:true});
 const changed=docs.map((d,i)=>i?d:{...d,body:d.body+' Synthetic revised requirement.'});
 await db.doc('pulsecheck-teams/team').update({requiredConsents:changed});await memberRef.update({'athleteOnboarding.requiredConsents':changed});
 await p.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await p.getByRole('button',{name:'Reload current requirements'}).waitFor();
 await p.screenshot({path:path.join(out,'stale-context.png'),fullPage:true});
 await p.close();p=await open();assert.match(await p.locator('article').first().textContent(),/Synthetic revised requirement/);assert.doesNotMatch(await p.locator('article').first().textContent(),/Selected choice: accepted/);
 assert.equal(await p.getByRole('button',{name:'Reload current requirements'}).count(),0);
 assert.equal((await memberRef.get()).data().athleteOnboarding.consentDecisions[docs[0].id].document.body,docs[0].body);
 console.log(JSON.stringify({result:'PASS',saves,documents:docs.length,evidence:out,verified:['rendered real page','atomic emulator save','optional declines persist on reopen','stale context blocked','reopen current terms preserves historical evidence'],limitations:['synthetic router and identity','service bridge bypasses HTTP auth','no production Next shell or deployed verification']}));
 }finally{await browser.close();}
})().finally(()=>app.delete()).catch(e=>{console.error(e);process.exitCode=1});
