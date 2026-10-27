// Real baseline, invitation, phone form and onboarding components. Synthetic services only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {build}=require('esbuild'),{chromium}=require('playwright'),postcss=require('postcss'),tailwind=require('tailwindcss');
const root=path.resolve(__dirname,'../..'),version=require('../../src/content/questionnaires/athlete-starting-point.json').version;
const documents=[
 {id:'synthetic-participation',version:'synthetic-v1',category:'participation',title:'Synthetic program agreement',body:'Offline test terms. This fixture creates no real agreement.'},
 {id:'synthetic-health',version:'synthetic-v1',category:'health_authorization',title:'Synthetic health choice',body:'Offline test health choice. No real answers or permission are saved.'},
];
const mocks={
 'next/router':`export const useRouter=()=>window.__router;`,
 'next/head':`export default function Head(){return null}`,
 'next/link':`import React from 'react';export default function Link({children,href,className}){return <a href={href} className={className}>{children}</a>}`,
 'firebase/auth':`export const browserPopupRedirectResolver={};export const onAuthStateChanged=(auth,callback)=>{window.__authListeners.push(callback);queueMicrotask(()=>callback(auth.currentUser));return()=>{window.__authListeners=window.__authListeners.filter(value=>value!==callback)}};export const signOut=async()=>{sessionStorage.removeItem('fixture-signed-in');window.__fixtureAuth.currentUser=null;window.__authListeners.forEach(callback=>callback(null))};export const signInWithCustomToken=async()=>({user:window.__fixtureUser});export const signInWithEmailAndPassword=async()=>{throw Error('Unexpected password call')};export const createUserWithEmailAndPassword=async()=>{throw Error('Unexpected account write')};export const signInWithPopup=async()=>{throw Error('Unexpected social call')};export const sendEmailVerification=async()=>{throw Error('Unexpected email')};export const fetchSignInMethodsForEmail=async()=>[];export class GoogleAuthProvider{};export class OAuthProvider{addScope(){}}`,
};
const suffix={
 '/api/firebase/config':`export const auth=window.__fixtureAuth,db={},storage={};export const isUsingDevFirebase=()=>true,getFirebaseModeRequestHeaders=()=>({'X-PulseCheck-Firebase-Mode':'dev'});export const initializeFirebase=()=>{};`,
 '/api/firebase/auth/phone':`export {normalizeAuthPhone} from './src/lib/pulsecheck/authPhone';export const phoneAuthError=error=>error.message;export const createPhoneAuthAttempt=async()=>({send:async phone=>window.__service('phone-send',{phone}),confirm:async(code,email,terms,organizationId)=>{await window.__service('phone-confirm',{code,email,terms,organizationId});sessionStorage.setItem('fixture-signed-in','1');window.__fixtureAuth.currentUser=window.__fixtureUser;window.__authListeners.forEach(callback=>callback(window.__fixtureUser));return window.__fixtureUser},dispose:async()=>{}});export const completeExistingEmailLink=async()=>{throw Error('Unexpected email link')};`,
 '/api/firebase/pulsecheckProvisioning/service':`export const pulseCheckProvisioningService=new Proxy({},{get:(_,method)=>(...args)=>window.__service(method,args)});`,
 '/api/firebase/user':`export class User{};export const SubscriptionPlatform={Web:'Web'},SubscriptionType={teamPlan:'Team Plan Access',unsubscribed:'Unsubscribed'},UserLevel={Novice:'Novice'};export const userService={fetchUserFromFirestore:uid=>window.__service('profile',[uid]),createUser:()=>{throw Error('Unexpected account write')},nonUICurrentUser:null};`,
 '/api/firebase/auth/username':`export const normalizeUsername=value=>value,generateUsernameFromEmail=value=>value.split('@')[0],isUsernameAvailable=async()=>true,isValidUsernameFormat=()=>true,claimUsername=async()=>{};`,
 '/hooks/useUser':`export const useUser=()=>window.__fixtureAuth.currentUser?{id:'fixture-athlete',displayName:'Synthetic Athlete',email:'athlete@example.test'}:null,useUserLoading=()=>false;`,
 '/lib/firebase-admin':`export default {};export const getFirebaseAdminApp=()=>({});`,
 '/lib/server-firestore-fallback':`export const getFirestoreDocFallback=async()=>null;`,
 '/utils/tts':`export const speakStep=()=>{},stopNarration=()=>{};`,
 '/utils/pdf':`export const renderHtmlToPdf=async()=>{throw Error('Unexpected PDF download')};`,
 '/utils/devAuthBypass':`export const isDevAuthBypassEnabled=()=>false;`,
};
(async()=>{
 const entries={baseline:'src/pages/PulseCheck/baseline',invite:'src/pages/PulseCheck/team-invite/[token]',onboarding:'src/pages/PulseCheck/athlete-onboarding'};
 const bundles={};
 for(const [name,entry]of Object.entries(entries)){
  const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Page from './${entry}';createRoot(document.getElementById('root')).render(<Page ${name==='baseline'?'collectionEnabled={true}':name==='invite'?'invite={window.__invite}':''}/>);`,loader:'tsx',resolveDir:root},bundle:true,write:false,define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_ATHLETICMIND_IOS_APP_STORE_URL':'"https://apps.apple.com/app/the-athletic-mind/id6825533952"','process.env.NEXT_PUBLIC_ATHLETICMIND_ANDROID_PLAY_STORE_URL':'"https://play.google.com/store/apps/details?id=com.fitwithpulse.athleticmind"'},plugins:[{name:'offline-flow',setup(b){b.onResolve({filter:/.*/},args=>{if(mocks[args.path])return{path:args.path,namespace:'mock'};const key=Object.keys(suffix).find(key=>args.path.endsWith(key));if(key)return{path:key,namespace:'suffix'};if(args.path.endsWith('.module.css'))return{path:args.path,namespace:'style'}});b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));b.onLoad({filter:/.*/,namespace:'suffix'},args=>({contents:suffix[args.path],loader:'tsx',resolveDir:root}));b.onLoad({filter:/.*/,namespace:'style'},()=>({contents:'export default new Proxy({},{get:(_,key)=>String(key)})'}));}}]});bundles[name]=result.outputFiles[0].contents;
 }
 const config=require('../../tailwind.config');const css=await postcss([tailwind({...config,content:Object.values(entries).map(entry=>root+'/'+entry+'.tsx').concat([root+'/src/components/auth/PhoneSignIn.tsx',root+'/src/components/pulsecheck/consent/ConsentChoices.tsx'])})]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined});
 const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://fixture.test').pathname;if(pathname.startsWith('/bundle-')){res.setHeader('Content-Type','application/javascript');return res.end(bundles[pathname.slice(8,-3)])}if(pathname.endsWith('.png')||pathname.endsWith('.svg')){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg"/>')}const entry=pathname.includes('/team-invite/')?'invite':pathname==='/PulseCheck/athlete-onboarding'?'onboarding':'baseline';res.setHeader('Content-Type','text/html');res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style><body style="margin:0;background:#171b1c;color:#f2f2e8"><div id="root"></div><script src="/bundle-${entry}.js"></script></body></html>`)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
 let external=0,activePage=null;const results=[];
 try{
  for(const scenario of [{mode:'register',code:'UMESBOWL',policy:'standard',health:'accepted'},{mode:'signin',code:'UMESGOLF',policy:'institution-phone',health:'declined'}]){
   const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();activePage=page;page.setDefaultTimeout(15000);const events=[],errors=[],visits=[];
   const state={redeemed:false,onboarded:false,baselineCompleted:false,decisions:{}};
   const team={id:'fixture-team',organizationId:'fixture-org',displayName:scenario.code==='UMESBOWL'?"Women's Bowling":'Golf',healthBaselineEnabled:true,intake:{athlete:{version:'fixture-v1',questions:[]}}};
   const organization={id:'fixture-org',displayName:'Synthetic University',configuredProductBrand:'athleticmind',healthBaselineEnabled:true};
   const membership={id:'fixture-membership',userId:'fixture-athlete',teamId:team.id,organizationId:organization.id,role:'athlete',status:'active',onboardingStatus:'pending',phone:'+12025550123',athleteOnboarding:{targetPilotId:'fixture-pilot',targetCohortId:'fixture-cohort',requiredConsents:documents,consentDecisions:{},productConsentAccepted:false}};
   page.on('pageerror',error=>errors.push(error.message));page.on('framenavigated',frame=>{if(frame===page.mainFrame())visits.push(new URL(frame.url()).pathname)});
   await context.addInitScript(({teamName,documents})=>{
    window.__authListeners=[];window.__fixtureUser={uid:'fixture-athlete',displayName:'Synthetic Athlete',email:'athlete@example.test',emailVerified:true,phoneNumber:'+12025550123',providerData:[],getIdToken:async()=>'synthetic-token',reload:async()=>{}};
    window.__fixtureAuth={currentUser:sessionStorage.getItem('fixture-signed-in')?window.__fixtureUser:null};
    new MutationObserver(changes=>{if(sessionStorage.getItem('fixture-baseline-complete'))return;for(const change of changes)for(const node of change.addedNodes){if(node.nodeType!==1)continue;const selector='a[href*="apps.apple.com"],a[href*="play.google.com"],a[href^="athleticmind://"],a[href^="pulsecheck://"]';if(node.matches(selector)||node.querySelector(selector))sessionStorage.setItem('fixture-early-app-link','1')}}).observe(document,{childList:true,subtree:true});
    window.__service=async(method,args)=>{const response=await fetch('/__fixture/service',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})});if(!response.ok)throw Error('Unexpected fixture service call: '+method);return response.json()};
    const query=Object.fromEntries(new URLSearchParams(location.search));const target=value=>typeof value==='string'?value:value.pathname+(Object.keys(value.query||{}).length?'?'+new URLSearchParams(value.query):'');
    window.__router={isReady:true,query,pathname:location.pathname.includes('/team-invite/')?'/PulseCheck/team-invite/[token]':location.pathname,asPath:location.pathname+location.search,push:async value=>location.assign(target(value)),replace:async(value,unused,options)=>{if(options?.shallow){history.replaceState(null,'',target(value));return}location.replace(target(value))}};
    window.__invite={token:'fixture-invite',activationUrl:location.href,productBrand:'athleticmind',distributionBrand:'athleticmind',organizationId:'fixture-org',teamId:'fixture-team',pilotId:'fixture-pilot',pilotName:'Synthetic pilot',cohortId:'fixture-cohort',cohortName:'Synthetic cohort',targetEmail:'',organizationName:'Synthetic University',teamName,status:'active',redemptionMode:'general',redemptionCount:0,teamMembershipRole:'athlete',invitedTitle:'',recipientName:'',prefilledProfileImageUrl:'',previewTitle:'Synthetic invite',previewDescription:'Offline test',previewImageUrl:'',pageUrl:location.href,commercialSnapshot:{teamPlanBypassesPaywall:true,commercialModel:'team-plan',teamPlanStatus:'active'}};
   },{teamName:team.displayName,documents});
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname!=='127.0.0.1'){external++;return route.abort()}
    if(url.pathname==='/__fixture/service'){
     const {method,args}=req.postDataJSON();events.push({method,args});
     const response=method==='redeemTeamInvite'?(state.redeemed=true,{organizationName:organization.displayName,teamName:team.displayName,teamMembershipRole:'athlete'}):method==='listUserTeamMemberships'?(state.redeemed?[membership]:[]):method==='getTeam'?team:method==='getOrganization'?organization:method==='getPilot'?{id:'fixture-pilot',studyMode:'operational'}:method==='profile'?{id:'fixture-athlete',email:'athlete@example.test',institutionalEmail:'athlete@example.test',displayName:'Synthetic Athlete'}:method==='saveAthleteOnboardingProgress'?{}:method==='phone-send'?{}:method==='phone-confirm'?{}:method==='completeAthleteOnboarding'?(state.onboarded=true,state.decisions=args[0].consentDecisions,{}):undefined;
     assert.notEqual(response,undefined,`Unexpected fixture method ${method}`);return route.fulfill({json:response});
    }
    if(url.pathname==='/api/pulsecheck/activation/resolve'){const input=req.postDataJSON();assert.equal(input.code,scenario.code);assert.equal(input.forceDevFirebase,true);return route.fulfill({json:{inviteToken:'fixture-invite',teamName:team.displayName}})}
    if(url.pathname==='/.netlify/functions/program-sign-in-policy'){assert.equal(req.postDataJSON().organizationId,organization.id);return route.fulfill({json:{mode:scenario.policy}})}
    if(url.pathname==='/api/pulsecheck/team-invite/activity')return route.fulfill({json:{recorded:true}});
    if(url.pathname==='/.netlify/functions/send-pulsecheck-athlete-onboarded-email'){events.push({method:'mocked-notification'});return route.fulfill({json:{sent:false}})}
    if(url.pathname==='/api/pulsecheck/questionnaire/cau'){
     assert.equal(req.method(),'GET','navigation test sends no baseline answers');assert.equal(req.headers().authorization,'Bearer synthetic-token');
     return route.fulfill({json:{questionnaireVersion:version,available:state.onboarded,required:true,completed:state.baselineCompleted,healthBaselineEnabled:true,healthSharingAllowed:scenario.health==='accepted',healthAuthorizationRequired:false,healthAuthorizationDecision:scenario.health,healthCollectionAvailable:true,healthBackupAvailable:true,healthDocuments:[documents[1]],healthConsentDecisions:state.decisions,productBrand:'athleticmind',sportName:'Synthetic sport'}});
    }
    if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/.netlify/'))throw Error('Unexpected remote service '+url.pathname);
    return route.continue();
   });
   const noAppLinks=async()=>{assert.equal(await page.locator('a[href*="apps.apple.com"],a[href*="play.google.com"],a[href^="athleticmind://"],a[href^="pulsecheck://"]').count(),0,'downloads/open-app links wait until baseline completion');assert.equal(await page.getByRole('button',{name:'Prefer the mobile app instead',exact:true}).count(),0)};
   await page.goto(base+'/PulseCheck/baseline');await page.getByRole('heading',{name:'Find your program.',exact:true}).waitFor();
   await page.getByLabel('Organization or team code').fill(scenario.code);await page.getByRole('button',{name:'Continue',exact:true}).click();
   await page.waitForURL(/\/PulseCheck\/team-invite\/fixture-invite\?/);const inviteUrl=new URL(page.url());assert.equal(inviteUrl.searchParams.get('web'),'1');assert.equal(inviteUrl.searchParams.get('returnTo'),'/PulseCheck/baseline');assert.equal(inviteUrl.searchParams.get('devFirebase'),'1');
   await page.getByRole('heading',{name:'Create or sign in to your account',exact:true}).waitFor();await noAppLinks();
   if(scenario.mode==='signin')await page.getByRole('button',{name:/^Sign In/}).first().click();
   if(scenario.mode==='register'){await page.getByPlaceholder('you@institution.edu').fill('athlete@example.test');await page.getByRole('checkbox',{name:/I agree to the Terms and Privacy Policy/}).check()}
   else assert.equal(await page.getByPlaceholder('you@institution.edu').count(),0,'returning login only asks for phone');
   await page.getByLabel('Phone number',{exact:true}).fill('2025550123');await page.getByRole('button',{name:scenario.mode==='register'?'Sign up':'Log in',exact:true}).click();
   await page.getByLabel('Verification code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Continue',exact:true}).click();
   await page.getByRole('button',{name:'Accept Invite',exact:true}).click();
   await page.waitForURL(/\/PulseCheck\/athlete-onboarding\?/);const onboardingUrl=new URL(page.url());assert.equal(onboardingUrl.searchParams.get('returnTo'),'/PulseCheck/baseline');assert.equal(onboardingUrl.searchParams.get('organizationId'),organization.id);assert.equal(onboardingUrl.searchParams.get('teamId'),team.id);await noAppLinks();
   await page.getByPlaceholder('Your name',{exact:true}).fill('Synthetic Athlete');await page.getByPlaceholder('(301) 555-1234',{exact:true}).fill('2025550123');
   await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByText('Please agree before continuing.',{exact:true}).waitFor();assert.equal(state.onboarded,false,'required onboarding agreements cannot be skipped');
   await page.getByText('I agree to get started with PulseCheck for my team.',{exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'I agree to get started with PulseCheck for my team.',exact:true}).isChecked(),true);
   await page.getByPlaceholder('Type your full name here',{exact:true}).fill('Synthetic Athlete');
   for(const doc of documents){const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:doc.title,exact:true})});if(await card.locator('summary').count())await card.locator('summary').click();await card.getByRole('button',{name:doc.category==='health_authorization'?(scenario.health==='accepted'?'Authorize and sign':'Decline authorization'):'Agree and sign',exact:true}).click()}
   await page.getByRole('button',{name:'Continue',exact:true}).click();
   await page.waitForURL(base+'/PulseCheck/baseline');await page.getByRole('button',{name:'Start baseline',exact:true}).waitFor();await noAppLinks();
   assert(state.redeemed);assert(state.onboarded);assert.equal(state.decisions['synthetic-participation'].decision,'accepted');assert.equal(state.decisions['synthetic-health'].decision,scenario.health);
   assert.equal(visits.includes('/PulseCheck/pilot-invite-next-steps'),false,'web-first flow never visits app-first next steps');
   const phone=events.find(event=>event.method==='phone-confirm').args;assert.equal(phone.email,scenario.mode==='register'?'athlete@example.test':'');assert.equal(phone.terms,scenario.mode==='register');assert.equal(events.filter(event=>event.method==='phone-send').length,1);
   await page.screenshot({path:`/tmp/baseline-web-entry-${scenario.mode}.png`,fullPage:true});
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-early-app-link')),null,'initial render and hydration never flash an app-first link');
   state.baselineCompleted=true;await page.evaluate(()=>sessionStorage.setItem('fixture-baseline-complete','1'));await page.reload();await page.getByRole('heading',{name:'Your answers are saved.',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Download for iPhone',exact:true}).count(),1);assert.equal(await page.getByRole('link',{name:'Download for Android',exact:true}).count(),1);
   assert.deepEqual(errors,[]);results.push({mode:scenario.mode,code:scenario.code,policy:scenario.policy,healthChoice:scenario.health,webFirst:true});await context.close();
  }
  // Generic, app-first pilot invitation behavior stays available outside a baseline web entry.
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(15000);
  await context.addInitScript(()=>{window.__authListeners=[];window.__fixtureAuth={currentUser:null};window.__router={isReady:true,query:{},pathname:'/PulseCheck/team-invite/[token]',asPath:location.pathname,push:async()=>{},replace:async()=>{}};window.__invite={token:'fixture-invite',productBrand:'pulsecheck',distributionBrand:'pulsecheck',organizationId:'fixture-org',teamId:'fixture-team',pilotId:'fixture-pilot',cohortId:'fixture-cohort',targetEmail:'',organizationName:'Synthetic University',teamName:'Synthetic Team',status:'active',redemptionMode:'general',teamMembershipRole:'athlete',commercialSnapshot:{teamPlanBypassesPaywall:true},pageUrl:location.href};});
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'){external++;return route.abort()}if(url.pathname==='/api/pulsecheck/team-invite/activity')return route.fulfill({json:{recorded:true}});return route.continue()});
  await page.goto(base+'/PulseCheck/team-invite/fixture-invite');await page.getByRole('link',{name:/iPhone App Store/}).waitFor();await context.close();
  assert.equal(external,0);console.log(JSON.stringify({success:true,realPages:3,scenarios:results,defaultAppFirstPreserved:true,externalRequests:external,realAccountsCreated:0,realMessagesSent:0}));
 }catch(error){if(activePage&&!activePage.isClosed())console.error(await activePage.locator('body').innerText());throw error}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
