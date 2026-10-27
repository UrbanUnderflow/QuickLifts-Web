// Render the actual invitation pages offline; no accounts, texts, or checkout calls.
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {build}=require('esbuild'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const mocks={
 'next/router':`export const useRouter=()=>window.__router;`,
 'next/head':`export default function Head(){return null}`,
 'next/link':`import React from 'react';export default function Link({children,href,...props}){return React.createElement('a',{href,...props},children)}`,
 'firebase/auth':`export const browserPopupRedirectResolver={};export const onAuthStateChanged=(auth,callback)=>{callback(null);return()=>{}};export const signOut=async()=>{};export const createUserWithEmailAndPassword=async()=>{};export const signInWithEmailAndPassword=async()=>{};export const signInWithCustomToken=async()=>{};export const signInWithPopup=async()=>{};export const sendEmailVerification=async()=>{};export const fetchSignInMethodsForEmail=async()=>[];export class GoogleAuthProvider{};export class OAuthProvider{}`,
};
const bySuffix={
 '/lib/firebase-admin':`export default {};export const getFirebaseAdminApp=()=>({});`,
 '/api/firebase/config':`export const auth={currentUser:null};export const getFirebaseModeRequestHeaders=()=>({});`,
 '/api/firebase/auth/phone':`export {normalizeAuthPhone} from './src/lib/pulsecheck/authPhone';export const phoneAuthError=e=>e.message;export const createPhoneAuthAttempt=async()=>({send:async()=>{},confirm:async()=>({uid:'kept-uid'}),dispose:async()=>{}});`,
 '/api/firebase/pulsecheckProvisioning/service':`export const pulseCheckProvisioningService=new Proxy({},{get:()=>async()=>({})});`,
 '/api/firebase/auth/username':`export const normalizeUsername=s=>s;export const generateUsernameFromEmail=s=>s.split('@')[0];export const isUsernameAvailable=async()=>true;export const isValidUsernameFormat=()=>true;export const claimUsername=async()=>{};`,
 '/api/firebase/user':`export const SubscriptionPlatform={Web:'Web'};export const SubscriptionType={teamPlan:'Team Plan Access',unsubscribed:'Unsubscribed'};export const UserLevel={Novice:'Novice'};export const userService={fetchUserFromFirestore:async()=>({email:'athlete@school.example'})};`,
 '/lib/server-firestore-fallback':`export const getFirestoreDocFallback=async()=>null;`,
 '/utils/tts':`export const speakStep=()=>{};export const stopNarration=()=>{};`,
 '/lib/noraOnboardingVoice':`export const buildNoraOnboardingWelcome=()=>'';`,
};
(async()=>{
 const outputs={};
 for(const name of ['team-invite','admin-activation']){
  const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/pages/PulseCheck/${name}/[token]';createRoot(document.getElementById('root')).render(<Page invite={window.__invite}/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'offline',setup(b){b.onResolve({filter:/.*/},a=>{if(mocks[a.path])return{path:a.path,namespace:'mock'};const suffix=Object.keys(bySuffix).find(s=>a.path.endsWith(s));if(suffix)return{path:suffix,namespace:'suffix'};if(a.path.endsWith('.module.css'))return{path:a.path,namespace:'style'};});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],resolveDir:root}));b.onLoad({filter:/.*/,namespace:'suffix'},a=>({contents:bySuffix[a.path],resolveDir:root}));b.onLoad({filter:/.*/,namespace:'style'},()=>({contents:`export default new Proxy({},{get:(_,key)=>String(key)})`}));}}]});outputs[name]=result.outputFiles[0].contents;
 }
 const server=http.createServer((req,res)=>{if(req.url==='/.netlify/functions/program-sign-in-policy'){let input='';req.on('data',chunk=>input+=chunk);req.on('end',()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode:JSON.parse(input).organizationId==='standard-program'?'standard':'institution-phone'}));});return;}if(req.url.startsWith('/app-')){res.setHeader('Content-Type','application/javascript');res.end(outputs[req.url.includes('admin')?'admin-activation':'team-invite']);return;}res.setHeader('Content-Type','text/html');res.end(`<html><div id="root"></div><script src="/app-${req.url.includes('admin')?'admin':'team'}.js"></script></html>`);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];let external=0;page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();external++;return route.abort();});
 await page.addInitScript(()=>{const p=new URLSearchParams(location.search);window.__router={isReady:true,query:{web:'1',skipFreshAccountCheck:'1'},pathname:location.pathname,asPath:location.pathname,replace:()=>{},push:()=>{}};window.__invite={token:'synthetic-invite',organizationId:p.get('standard')?'standard-program':'phone-program',organizationName:'Example Athletics',teamId:'synthetic-team',teamName:'Example Team',teamMembershipRole:p.get('role')||'athlete',targetEmail:'athlete@school.example',targetName:'Example Person',recipientName:'Example Person',status:'active',redemptionMode:'general',productBrand:'pulsecheck',distributionBrand:'pulsecheck',pilotId:'',cohortId:'',expiresAt:null,pageUrl:location.href,previewTitle:'Example invitation',previewDescription:'Example invitation',commercialSnapshot:{teamPlanBypassesPaywall:true,commercialModel:'team-plan',teamPlanStatus:'active'}};});
 try{for(const scenario of ['team?role=athlete','team?role=coach','admin','team?role=athlete&standard=1','team?role=coach&standard=1','admin?standard=1']){
  await page.goto(`http://127.0.0.1:${server.address().port}/${scenario}`);await page.getByRole('button',{name:'Sign up',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Institutional email').inputValue(),'athlete@school.example');
  assert.equal(await page.getByLabel('Phone number',{exact:true}).count(),1);
  assert.equal(await page.getByRole('checkbox').count(),1);
  if(scenario.includes('standard')){await page.getByText('Password',{exact:true}).first().waitFor();assert.ok(await page.getByText('Password',{exact:true}).count()>0,'standard registration retains email/password alongside phone');if(scenario.startsWith('admin'))assert.ok(await page.getByRole('button',{name:/Continue with Google/}).count()>0,'standard admin registration retains social sign-in');}
  else{assert.equal(await page.getByText('Password',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:/Continue with (Google|Apple)/}).count(),0);}
 }assert.deepEqual(errors,[]);assert.equal(external,0);console.log(JSON.stringify({success:true,scenarios:6,externalRequests:external}));}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
