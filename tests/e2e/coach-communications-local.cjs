// Offline component verification. Only synthetic data; fetch never leaves this page.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const esbuild=require('esbuild');const {chromium}=require('playwright');
(async()=>{
 const dir=path.resolve('work/communication-preview');fs.mkdirSync(dir,{recursive:true});
 await esbuild.build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Inbox from './src/components/coach/CoachSmsInbox';createRoot(document.getElementById('root')).render(<Inbox teamId="synthetic-team"/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,external:['/images/*'],outfile:path.join(dir,'app.js'),loader:{'.png':'dataurl'},plugins:[{name:'offline-auth',setup(build){build.onResolve({filter:/api\/firebase\/config$/},()=>({path:'mock-auth',namespace:'offline'}));build.onLoad({filter:/.*/,namespace:'offline'},()=>({contents:`export const auth={currentUser:{getIdToken:async()=> 'synthetic-token'}};export const getFirebaseModeRequestHeaders=()=>({});`,loader:'js'}));}}]});
 // Compile repository Tailwind tokens for the actual component.
 require('child_process').execFileSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','--input','src/index.css','--output',path.join(dir,'tailwind.css')],{stdio:'pipe'});
 const server=http.createServer((req,res)=>{const file=req.url==='/'?'index.html':req.url.slice(1);if(!['index.html','app.js','app.css','tailwind.css'].includes(file)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(dir,file)));});
 fs.writeFileSync(path.join(dir,'index.html'),'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/tailwind.css"><link rel="stylesheet" href="/app.css"></head><body style="background:#f7f8f5;padding:24px;font-family:Arial;color:#22302e"><main id="root"></main><script src="/app.js"></script></body></html>');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try {
 browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? {executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'} : {}),headless:true});
 const page=await browser.newPage({viewport:{width:1365,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const groups=[],posts=[];let lost=false;
 await page.route('**/api/**',async route=>{
  const req=route.request();
  if(req.method()==='POST'){
   const body=req.postDataJSON();posts.push(body);
   if(body.text==='Reject'){await route.fulfill({status:409,json:{notQueued:true,error:'Synthetic recipient validation failure'}});return;}
   const prior=groups.find(g=>g.requestId===body.requestId);
   if(!prior)groups.push({id:'batch-'+groups.length,requestId:body.requestId,atMs:Date.now(),recipientCount:body.athleteIds.length,counts:{queued:body.athleteIds.length}});
   if(body.text==='Lost response'&&!lost){lost=true;await route.abort();return;}
   await route.fulfill({status:202,json:{queued:true,duplicate:!!prior,batchId:(prior||groups[groups.length-1]).id}});return;
  }
  await route.fulfill({json:{ready:true,batches:groups,historyLimit:200,nextCursor:null,recipients:[{id:'a',name:'Jordan Sample',eligible:true},{id:'b',name:'Casey Example',eligible:true},{id:'c',name:'Taylor Sample',eligible:false}],messages:[{id:'m',athleteId:'a',text:'Thanks, Coach!',direction:'incoming',status:'received',atMs:1793750400000}]}});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'Select eligible athletes shown'}).click();
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('PulseCheck is ready. Download the app: https://example.test/app');
 await page.getByRole('button',{name:'Jordan Sample',exact:true}).click();
 await page.getByRole('button',{name:'Review text',exact:true}).click();
 assert.equal(await page.getByRole('checkbox',{name:'Select Taylor Sample'}).isDisabled(),true);
 await page.screenshot({path:path.join(dir,'desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Queue 2 texts',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Your group is saved'}).waitFor();
 assert.equal(groups.length,1);
 await page.reload();await page.getByRole('heading',{name:'Recent groups'}).waitFor();
 await page.getByRole('button',{name:'Jordan Sample',exact:true}).click();
 await page.getByRole('button',{name:'Reply to this athlete',exact:true}).click();
 assert.equal(await page.getByRole('checkbox',{name:'Select Jordan Sample'}).isChecked(),true);
 assert.equal(await page.getByRole('checkbox',{name:'Select Casey Example'}).isChecked(),false);
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Reject');await page.getByRole('button',{name:'Review text',exact:true}).click();await page.getByRole('button',{name:'Queue 1 texts',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic recipient validation failure'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Message',exact:true}).isEnabled(),true);
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Lost response');await page.getByRole('button',{name:'Review text',exact:true}).click();await page.getByRole('button',{name:'Queue 1 texts',exact:true}).click();await page.getByRole('button',{name:'Retry same request',exact:true}).click();await page.getByRole('status').filter({hasText:'already saved'}).waitFor();assert.equal(groups.length,2);assert.equal(posts[posts.length-1].requestId,posts[posts.length-2].requestId);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS: synthetic durable group review/queue, reload history, validation recovery, lost-response same-request retry, ineligible recipient, individual reply selection, mobile overflow, and browser errors. No external requests or SMS.');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
