// Offline integration of the real provisioning contact form; every request is intercepted.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),{chromium}=require('playwright'),root=path.resolve(__dirname,'../..');
(async()=>{
 const bundle=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Staff from './src/components/admin/TeamClinicalStaff';createRoot(document.getElementById('root')).render(<Staff teamId="synthetic-team" currentRoute="hotline"/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'offline-auth',setup(b){b.onResolve({filter:/api\/firebase\/config$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export const auth={currentUser:{getIdToken:async()=>'synthetic-only'}};export const getFirebaseModeRequestHeaders=()=>({'X-PulseCheck-Firebase-Mode':'dev'});`}));}}]});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'application/javascript':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].contents:'<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:17px system-ui;margin:24px;max-width:900px}.pcp-fg{display:grid;gap:12px}.pcp-fld{display:grid;gap:6px}input,select,button{font:inherit;max-width:100%;box-sizing:border-box}button{margin:8px;padding:12px}fieldset{min-width:0}</style><div id="root"></div><script src="/app.js"></script></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844}});let config=null,posts=[],errors=[],stale=false;
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/api/admin/pulsecheck/designated-clinical-staff'){
   if(req.method()==='PUT'){const input=req.postDataJSON();posts.push(input);assert.equal(input.teamId,'synthetic-team');if(stale)return route.fulfill({status:409,json:{error:'These settings changed in another session. Reload before saving.'}});config={...input.configuration,status:input.action==='activate'?'active':'draft',revision:input.expectedRevision+1};}
   return route.fulfill({json:{config,delivery:{email:true,sms:false}}});
  }
  if(url.hostname!=='127.0.0.1')return route.abort();return route.continue();
 });
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByLabel('Full name',{exact:true}).fill('Synthetic Clinician');await page.getByLabel('Work email',{exact:true}).fill('clinical@example.test');await page.getByLabel('Phone with country code',{exact:true}).fill('+1 410 555 0123');
  await page.getByRole('button',{name:'Save clinical staff draft',exact:true}).click();await page.getByText('Clinical staff draft saved. Current routing is unchanged.').waitFor();assert.equal(posts.at(-1).action,'save');
  await page.getByRole('button',{name:'Activate clinical staff alerts',exact:true}).click();await page.getByText('Clinical staff alerts activated.',{exact:false}).waitFor();assert.equal(posts.at(-1).action,'activate');assert.equal(posts.at(-1).expectedRevision,1);
  assert.equal(await page.getByRole('button',{name:'Save clinical staff draft',exact:true}).isEnabled(),false);
  await page.getByText('Text delivery is not configured.',{exact:false}).waitFor();await page.screenshot({path:'/tmp/baseline-clinical-staff.png',fullPage:true});
  await page.getByRole('button',{name:'Deactivate alerts',exact:true}).click();await page.getByText('Clinical staff alerts deactivated.',{exact:false}).waitFor();assert.equal(posts.at(-1).expectedRevision,2);
  stale=true;await page.getByRole('button',{name:'Save clinical staff draft',exact:true}).click();await page.getByRole('alert').filter({hasText:'These settings changed'}).waitFor();assert.deepEqual(errors,[]);
  console.log(JSON.stringify({success:true,actions:posts.map(p=>p.action),externalRequests:0}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
