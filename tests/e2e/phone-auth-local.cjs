// Actual phone form, offline verification adapter; no external requests or SMS.
const assert = require('node:assert/strict'), http = require('node:http'), path = require('node:path');
const esbuild = require('esbuild'), { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
  const built = await esbuild.build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Phone from './src/components/auth/PhoneSignIn';createRoot(document.getElementById('root')).render(<Phone mode={new URLSearchParams(location.search).get('mode')==='link'?'link':'signin'} onSuccess={user=>window.__success.push(user.uid)}/>);`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{name:'offline-phone',setup(build){build.onResolve({filter:/api\/firebase\/auth\/phone$/},()=>({path:'phone',namespace:'mock'}));build.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export function normalizeAuthPhone(value){const p=value.trim().replace(/[\\s().-]/g,'');if(!/^\\+[1-9]\\d{7,14}$/.test(p))throw Error('Include a country code.');return p} export const phoneAuthError=e=>e.message;export const createPhoneAuthAttempt=async()=>({send:async phone=>window.__sent.push(phone),confirm:async(code,email,accepted)=>{window.__attempts.push({code,email,accepted});if(code!=='123456')throw Error('That code is incorrect.');return {uid:'kept-account'}},dispose:async()=>{}});`}));}}] });
  const server = http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'application/javascript':'text/html');res.end(req.url==='/app.js'?built.outputFiles[0].contents:'<html><div id="root"></div><script src="/app.js"></script></html>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({headless:true}), page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let external=0; const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();external++;return route.abort();});
  await page.addInitScript(()=>{window.__sent=[];window.__attempts=[];window.__success=[];});
  const url=`http://127.0.0.1:${server.address().port}/`;
  try {
    await page.goto(url);
    await page.getByRole('button',{name:'Send text message',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'institutional email'}).waitFor();
    await page.getByLabel('Institutional email').fill('athlete@institution.example');
    await page.getByLabel('Phone number', {exact:true}).fill('+1 (202) 555-0123');
    await page.getByRole('button',{name:'Send text message',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Terms'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__sent),[]);
    await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'Send text message',exact:true}).click();
    await page.getByLabel('Verification code').waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__sent),['+12025550123']);
    assert.equal(await page.getByLabel('Institutional email').isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:/Resend in/}).isDisabled(),true);
    await page.getByLabel('Verification code').fill('000000');
    await page.getByRole('button',{name:'Verify and sign in'}).click();
    await page.getByRole('alert').filter({hasText:'incorrect'}).waitFor();
    await page.getByLabel('Verification code').fill('123456');
    await page.getByRole('button',{name:'Verify and sign in'}).click();
    await page.waitForFunction(()=>window.__success.length===1);
    assert.deepEqual(await page.evaluate(()=>window.__attempts.at(-1)),{code:'123456',email:'athlete@institution.example',accepted:true});
    await page.goto(url+'?mode=link');
    await page.getByRole('button',{name:'Connect phone number',exact:true}).click();
    assert.equal(await page.getByLabel('Institutional email').count(),0);
    await page.getByLabel('Phone number',{exact:true}).fill('+12025550124');
    await page.getByRole('button',{name:'Send text message',exact:true}).click();
    await page.getByLabel('Verification code').fill('123456');
    await page.getByRole('button',{name:'Verify and connect'}).click();
    await page.waitForFunction(()=>window.__success.length===1);
    assert.deepEqual(errors,[]);assert.equal(external,0);
    console.log(JSON.stringify({success:true,scenarios:6,externalRequests:external}));
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
