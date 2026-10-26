// Exercise the actual login page offline. No real accounts, email, or external requests.
const assert = require('node:assert/strict'), http = require('node:http'), path = require('node:path');
const esbuild = require('esbuild'), { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const mocks = {
  'next/router': `export const useRouter=()=>window.__router;`,
  'firebase/auth': `export const getRedirectResult=async()=>null;export const signInWithPopup=async()=>({user:{uid:'same-athlete'}});export class OAuthProvider{addScope(){}}`,
  '../../api/firebase/config': `export const auth={};export const initializeFirebase=()=>{};export const isUsingDevFirebase=()=>false;`,
  '../../api/firebase/auth': `export default {isMagicLink:()=>window.__magic,completeMagicLink:async()=>({user:{uid:'same-athlete'}}),signInWithEmail:async()=>({user:{uid:'same-athlete'}})};`,
  '../../api/firebase/user': `export class User{};export const SubscriptionType={unsubscribed:'unsubscribed'};export const userService={fetchUserFromFirestore:async uid=>({id:uid})};`,
  '../../hooks/useUser': `export const useUser=()=>window.__signedIn?{id:'same-athlete'}:null;`,
  '../../components/PageHead': `export default function Head(){return null}`,
  'react-redux': `export const useDispatch=()=>()=>{};`,
  '../../redux/devModeSlice': `export const toggleDevMode=()=>({});`,
  '../../api/firebase/auth/accountLinking': `export const assertAccountIsCanonical=async user=>user;export const linkRememberedProviderCredential=async()=>{};export const rejectAccidentalNewSocialLogin=async()=>false;export const rememberProviderCredentialFromError=()=>false;`,
};
(async () => {
  const result = await esbuild.build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Login from './src/pages/PulseCheck/login';createRoot(document.getElementById('root')).render(<Login/>);`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{name:'offline',setup(build){build.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path]}));}}] });
  const server = http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'application/javascript':'text/html');res.end(req.url==='/app.js'?result.outputFiles[0].contents:'<html><div id="root"></div><script src="/app.js"></script></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true}), page = await browser.newPage();
  let externalRequests=0;const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();externalRequests++;return route.abort();});
  await page.addInitScript(()=>{const params=new URLSearchParams(location.search),flow=params.get('flow');window.__signedIn=flow==='signed-in';window.__magic=flow==='magic';window.__destinations=[];window.__router={query:{returnTo:params.get('target')},replace:path=>window.__destinations.push(path)};if(flow==='magic')localStorage.setItem('pulsecheck_magic_link_email','athlete@program.example');});
  const scenarios=[
    {flow:'signed-in',target:'/PulseCheck/baseline',expected:'/PulseCheck/baseline'},
    {flow:'password',target:'/PulseCheck/baseline',expected:'/PulseCheck/baseline'},
    {flow:'magic',target:'/PulseCheck/baseline',expected:'/PulseCheck/baseline'},
    {flow:'signed-in',target:'/PulseCheck/questionnaire/cau',expected:'/PulseCheck/questionnaire/cau'},
    {flow:'password',target:'https://untrusted.example/baseline',expected:'/PulseCheck?web=1'},
  ];
  try {
    for(const scenario of scenarios){
      await page.goto(`http://127.0.0.1:${server.address().port}/?${new URLSearchParams({flow:scenario.flow,target:scenario.target})}`);
      if(scenario.flow==='password'){
        await page.getByRole('button',{name:'Password',exact:true}).click();
        await page.getByPlaceholder('you@program.edu').fill('athlete@program.example');
        await page.locator('input[autocomplete="current-password"]').fill('Synthetic-only-123');
        await page.getByRole('button',{name:'Sign in with password',exact:true}).click();
      }
      await page.waitForFunction(()=>window.__destinations.length>0);
      assert.deepEqual(await page.evaluate(()=>[...new Set(window.__destinations)]),[scenario.expected]);
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({success:true,scenarios:scenarios.length,externalRequestsBlocked:externalRequests}));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
