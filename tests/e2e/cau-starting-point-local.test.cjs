// Offline integration of the real baseline UI. No external traffic or clinical submissions.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),esbuild=require('esbuild'),{chromium}=require('playwright');
const version=require('../../src/content/questionnaires/athlete-starting-point.json').version;
const source=require('../../src/content/questionnaires/athlete-starting-point.json');
const healthTerms=require('../../src/content/consents/pulsecheck-only.json').health;
(async()=>{
 const result=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/pages/PulseCheck/questionnaire/cau';createRoot(document.getElementById('root')).render(<Page collectionEnabled={true}/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'offline',setup(b){b.onResolve({filter:/^(firebase\/auth|next\/head)$|api\/firebase\/config$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='next/head'?'export default function Head(){return null}':a.path==='firebase/auth'?`export function onAuthStateChanged(a,cb){queueMicrotask(()=>cb({uid:'local-test',displayName:'Local Athlete',email:'local@example.test',getIdToken:async()=>'local-only'}));return()=>{}}export async function signInWithEmailAndPassword(){}export async function signInWithCustomToken(){return {user:{uid:"local-test"}}}export async function signOut(){}`:'export const auth={};export const isUsingDevFirebase=()=>true;'}));}}]});
 const server=http.createServer((req,res)=>{if(req.url==='/pulsecheck-wordmark-green.png'){res.setHeader('Content-Type','image/png');return res.end(fs.readFileSync(root+'/public/pulsecheck-wordmark-green.png'));}if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');return res.end(result.outputFiles[0].contents);}res.setHeader('Content-Type','text/html');res.end('<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root"></div><script src="/app.js"></script></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844}});
 let scenario='combined',posts=[],errors=[],interrupted=false,consentSaved=false,completed=false,revision=0,goalDraft=null,skills=null;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname.includes('/api/')){
   const decision=scenario==='pending'&&!consentSaved?'pending':scenario==='declined'?'declined':scenario==='health-off'?'disabled':'accepted';
   let data={questionnaireVersion:version,available:true,completed:completed||scenario==='completed',required:true,healthBaselineEnabled:scenario!=='health-off',healthAuthorizationRequired:decision==='pending',healthAuthorizationDecision:decision,healthSharingAllowed:decision==='accepted',healthCollectionAvailable:scenario!=='unready',healthDocuments:[healthTerms],healthConsentDecisions:{},sportName:'Volleyball'};
   if(scenario==='resumed'||scenario==='health-off'||scenario==='declined'||scenario==='unready')Object.assign(data,{draft:goalDraft,skills});
   if(scenario==='completed')data.questionnaireVersion='athlete-starting-point-v1';
   if(interrupted&&scenario==='combined')data.submissionSharing=true;
   if(request.method()==='POST'){
    const input=request.postDataJSON();posts.push(input);assert.equal(input.questionnaireVersion,version);
    if(input.action==='saveHealthDecision'){consentSaved=true;data={saved:true};}
    else if(input.action==='savePerformanceDraft'){goalDraft={...input.draft,revision:++revision};data={draft:goalDraft};}
    else if(input.action?.includes('Skills')){skills={draft:input.draft,completed:input.action==='completeSkills',revision:++revision};data={skills};}
    else if(scenario==='combined'&&!interrupted){interrupted=true;return route.fulfill({status:503,json:{error:'Temporary save interruption. Please retry.'}});}
    else{completed=true;data={saved:true,completed:true};}
   }
   return route.fulfill({json:data});
  }
  if(url.hostname!=='127.0.0.1')return route.abort();return route.continue();
 });
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 const open=async next=>{scenario=next;completed=false;await page.goto(`http://127.0.0.1:${server.address().port}/`);};
 const layout=async()=>{for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Horizontal overflow at ${width}px`);
  const clipped=await page.locator('button,input,textarea,select').evaluateAll(nodes=>nodes.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&getComputedStyle(el).visibility!=='hidden'&&(r.left < -1||r.right>innerWidth+1)}).map(el=>el.textContent));
  assert.deepEqual(clipped,[],`Clipped controls at ${width}px`);
 }await page.setViewportSize({width:390,height:844});};
 try{
  await open('combined');await click('Start baseline');await page.getByRole('button',{name:/Performance baseline/}).click();
  await page.getByRole('heading',{name:'What do you want to get better at?'}).waitFor();
  assert.match(await page.locator('.cau-step-label').innerText(),/1 of 9/);await layout();
  await click('Focus');await click('Confidence');await click('Getting ready');await page.getByRole('alert').filter({hasText:'You’ve picked 2.'}).waitFor();
  await page.screenshot({path:'/tmp/baseline-28-goals.png'});await click('Continue');
  await page.getByRole('heading',{name:'Which skills have you tried?'}).waitFor();
  assert.equal(await page.getByRole('combobox').count(),8);assert.equal(await page.locator('.skills-mood-option').count(),0);await layout();
  await page.getByLabel('Focus cues experience').selectOption('use_it');
  await page.getByLabel('Breathing and body awareness experience').selectOption('new_to_me');
  await page.screenshot({path:'/tmp/baseline-28-experience.png',fullPage:true});
  const style=await page.addStyleTag({content:'.skills-family-heading{font-size:30px!important}.skills-description{font-size:32px!important}'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await style.evaluate(el=>el.remove());
  await click('Continue');await page.getByRole('heading',{name:'Your experience is saved.'}).waitFor();await click('Complete Performance');
  assert.deepEqual(skills.draft.answeredFamiliarity,['attention_cues','breathing_body_awareness']);
  assert.equal(skills.draft.currentState,undefined);assert.equal(skills.draft.evidence,undefined);
  await page.getByRole('button',{name:/Well-being and support/}).click();
  assert.match(await page.locator('.cau-step-label').innerText(),/1 of 19/);
  const health=source.questions.filter(q=>q.id!=='cau-starting-point-46');
  for(const q of health){
   await page.locator('.cau-question-title').filter({hasText:q.question}).waitFor();
   await page.locator('.cau-choice-btn').first().click();if(q.type==='multi_select')await click('Continue');
  }
  await click('Submit answers');await page.getByText('Temporary save interruption. Please retry.').waitFor();
  await click('Submit answers');await page.getByRole('heading',{name:'Your answers are saved.'}).waitFor();
  assert.equal(posts.filter(p=>!p.action).length,2);assert.equal(Object.keys(posts.at(-1).answers).length,20);
  const originalGoal=structuredClone(goalDraft),originalSkills=structuredClone(skills);
  for(const next of ['health-off','declined','unready','resumed']){
   goalDraft=originalGoal;skills=originalSkills;await open(next);
   await page.getByRole('heading',{name:'Your starting point',exact:true}).waitFor();
   if(next==='health-off')assert.equal(await page.getByRole('button',{name:/Well-being and support/}).count(),0);
   if(next==='unready'){
    await page.getByText('Your program’s health connection is not ready.',{exact:false}).waitFor();
    await page.getByRole('button',{name:/Well-being and support/}).click();await page.locator('.cau-question-title').waitFor();
    await page.getByRole('button',{name:'Back to sections',exact:true}).click();
   }
   if(next==='unready'||next==='resumed')await click('Complete performance only');
   await click('Submit answers');await page.getByRole('heading',{name:'Your answers are saved.'}).waitFor();assert.equal(posts.at(-1).shareHealth,false);
  }
  await open('pending');await page.getByRole('heading',{name:'Your health authorization'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Start baseline',exact:true}).count(),0);
  await page.screenshot({path:'/tmp/baseline-28-consent.png',fullPage:true});
  await page.getByRole('button',{name:'Decline authorization',exact:true}).click();
  await click('Save health choice and continue');await page.getByRole('button',{name:'Start baseline',exact:true}).waitFor();
  assert.equal(posts.at(-1).action,'saveHealthDecision');assert.equal(posts.at(-1).decisions[healthTerms.id].decision,'declined');
  await open('completed');await page.getByRole('heading',{name:'Your answers are saved.'}).waitFor();assert.equal(await page.getByRole('button',{name:'Start baseline',exact:true}).count(),0);
  await page.addInitScript(()=>{window.__baselineNativeEvents=[];window.webkit={messageHandlers:{baselineSession:{postMessage(message){window.__baselineNativeEvents.push(message.action);if(message.action==='signIn')setTimeout(()=>window.dispatchEvent(new CustomEvent('pulse-baseline-session',{detail:{customToken:'synthetic',userID:'local-test'}})),0);}}}};});
  await page.reload();await page.getByRole('heading',{name:'Your answers are saved.'}).waitFor();await page.waitForFunction(()=>window.__baselineNativeEvents.includes('completed'));
  assert.deepEqual(await page.evaluate(()=>window.__baselineNativeEvents),['signIn','completed']);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({success:true,questionnaireItems:20,familiarityItems:8,total:28,scenarios:7,version}));
 }catch(error){console.error(await page.locator('body').innerText());throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
