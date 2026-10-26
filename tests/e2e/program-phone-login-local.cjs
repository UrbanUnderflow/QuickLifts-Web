// Exercise the actual login page offline. No real accounts, email, or external requests.
const assert = require('node:assert/strict'), http = require('node:http'), path = require('node:path');
const esbuild = require('esbuild'), { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const mocks = {
  '../../api/firebase/auth/phone': `export {normalizeAuthPhone} from './src/lib/pulsecheck/authPhone';export const phoneAuthError=e=>e.message;export const createPhoneAuthAttempt=async()=>({send:async phone=>window.__numbers.push(phone),confirm:async()=>({uid:'same-athlete'}),dispose:async()=>{}});export const completeExistingEmailLink=async()=>({uid:'same-athlete'});`,
  'next/router': `export const useRouter=()=>window.__router;`,
  'firebase/auth': `export const getRedirectResult=async()=>null;export const signInWithPopup=async()=>({user:{uid:'same-athlete'}});export class OAuthProvider{addScope(){}}`,
  '../../api/firebase/config': `export const getFirebaseModeRequestHeaders=()=>({});export const auth={};export const initializeFirebase=()=>{};export const isUsingDevFirebase=()=>false;`,
  '../../api/firebase/auth': `export default {isMagicLink:()=>window.__magic,completeMagicLink:async()=>({user:{uid:'same-athlete'}}),signInWithEmail:async()=>({user:{uid:'same-athlete'}})};`,
  '../../api/firebase/user': `export class User{};export const SubscriptionType={unsubscribed:'unsubscribed'};export const userService={fetchUserFromFirestore:async uid=>({id:uid})};`,
  '../../hooks/useUser': `export const useUser=()=>window.__signedIn?{id:'same-athlete'}:null;`,
  '../../components/PageHead': `export default function Head(){return null}`,
  'react-redux': `export const useDispatch=()=>()=>{};`,
  '../../redux/devModeSlice': `export const toggleDevMode=()=>({});`,
  '../../api/firebase/auth/accountLinking': `export const assertAccountIsCanonical=async user=>user;export const linkRememberedProviderCredential=async()=>{};export const rejectAccidentalNewSocialLogin=async()=>false;export const rememberProviderCredentialFromError=()=>false;`,
};
(async () => {
  const result = await esbuild.build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Login from './src/pages/PulseCheck/login';createRoot(document.getElementById('root')).render(<Login/>);`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{name:'offline',setup(build){build.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],resolveDir:root}));}}] });
  const server = http.createServer((req,res)=>{if(req.url==='/.netlify/functions/program-sign-in-policy'){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode:JSON.parse(body).email.endsWith('@standard.example')?'standard':'institution-phone'}));});return;}res.setHeader('Content-Type',req.url==='/app.js'?'application/javascript':'text/html');res.end(req.url==='/app.js'?result.outputFiles[0].contents:'<html><div id="root"></div><script src="/app.js"></script></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true}), page = await browser.newPage();
  let externalRequests=0;const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();externalRequests++;return route.abort();});
  await page.addInitScript(()=>{window.__numbers=[];window.__destinations=[];window.__router={query:{},replace:path=>window.__destinations.push(path)};});
  try {
    const url=`http://127.0.0.1:${server.address().port}/`;
    await page.goto(url);
    assert.equal(await page.getByRole('button',{name:'Google',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Apple',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Password',exact:true}).count(),0);
    assert.equal(await page.getByText(/saved for reference/).count(),0);
    await page.getByLabel('Institutional email').fill('athlete@school.example');
    await page.getByLabel('Phone number',{exact:true}).fill('4165550123');
    await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'Send text message',exact:true}).click();
    await page.getByLabel('Verification code').waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__numbers),['+14165550123']);
    await page.getByLabel('Verification code').fill('123456');
    await page.getByRole('button',{name:'Verify and sign in'}).click();
    await page.waitForFunction(()=>window.__destinations.length>0);
    await page.goto(url);
    await page.getByLabel('Institutional email').fill('coach@standard.example');
    await page.getByRole('button',{name:'Google',exact:true}).waitFor();
    await page.getByLabel('Institutional email').fill('coach@school.example');
    await page.getByRole('button',{name:'Google',exact:true}).waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);assert.equal(externalRequests,0);
    console.log(JSON.stringify({success:true,scenarios:5,externalRequests}));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
