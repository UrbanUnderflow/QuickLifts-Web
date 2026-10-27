// Actual admin page and component, synthetic metadata, all external requests blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const esbuild=require('esbuild'),{chromium}=require('playwright'),postcss=require('postcss'),tailwind=require('tailwindcss');
const root=path.resolve(__dirname,'../..');
const stamp='2026-10-27T12:00:00Z';
const receipt=id=>({baselineId:`receipt-${id}`,athleteId:`auntedna-athlete-${id}`,receivedAt:stamp,requestId:`request-${id}`});
const row=(id,name,extra={})=>({id:`health_backup_${Buffer.from(id).toString('hex').padEnd(64,'0').slice(0,64)}`,athleteId:id,athleteName:name,organizationId:'a'.repeat(64),organizationName:'Demo University',teamId:'b'.repeat(64),teamName:'Volleyball',createdAt:stamp,deliveryStatus:'pending',lastAttemptAt:null,verifiedAt:null,backupRetained:true,canDelete:false,receipt:null,...extra});
(async()=>{
 const mocks={
  'next/head':'export default function Head(){return null}',
  'next/link':`import React from 'react';export default function Link({href,children,className}){return <a href={href} className={className}>{children}</a>}`,
  '/components/auth/AdminRouteGuard':`import React from 'react';export default function Guard({children}){return <div className="clay-route"><header style={{background:'#171b1c',color:'#f2f2e8',padding:'16px 24px',borderBottom:'1px solid #343a3b'}}>PulseCheck · Admin workspace</header>{children}</div>}`,
  '/api/firebase/config':`export const auth={currentUser:{getIdToken:async()=>'synthetic-admin'}},getFirebaseModeRequestHeaders=()=>({'X-PulseCheck-Firebase-Mode':'dev'});`,
 };
 const build=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/pages/admin/pulsecheckBaselineBackups';createRoot(document.getElementById('root')).render(<Page/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-admin',setup(b){b.onResolve({filter:/.*/},args=>{const key=Object.keys(mocks).find(key=>args.path===key||args.path.endsWith(key));return key?{path:key,namespace:'fixture'}:undefined});b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));}}]});
 const config=require('../../tailwind.config');
 const css=await postcss([tailwind({...config,content:[root+'/src/pages/admin/pulsecheckBaselineBackups.tsx',root+'/src/components/admin/BaselineHealthBackups.tsx']})]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined});
 const clay=fs.readFileSync(root+'/src/styles/clay/clay.css','utf8');
 const server=http.createServer((req,res)=>{
  if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');return res.end(build.outputFiles[0].contents)}
  if(req.url.startsWith('/fonts/clay/')){const file=path.join(root,'public',req.url);if(fs.existsSync(file)){res.setHeader('Content-Type','font/ttf');return res.end(fs.readFileSync(file))}}
  res.setHeader('Content-Type','text/html');res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}\n${clay}</style><body style="margin:0"><div id="root"></div><script src="/app.js"></script></body></html>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});
 let rows=[row('waiting','Waiting Athlete',{sensitiveAnswers:{question:'PRIVATE_TEST_ANSWER_NEVER_RENDER'}}),row('verified','Verified Athlete',{deliveryStatus:'verified',canDelete:true,lastAttemptAt:stamp,verifiedAt:stamp,receipt:receipt('verified')}),row('removed','Removed Athlete',{deliveryStatus:'verified',backupRetained:false,verifiedAt:stamp,receipt:receipt('removed')})];
 let cursor='next-page',retryCount=0,conflict=true,forbidden=false,external=0,posts=[];const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/api/admin/pulsecheck/baseline-backups'){
   assert.equal(req.headers().authorization,'Bearer synthetic-admin');assert.equal(req.headers()['x-pulsecheck-firebase-mode'],'dev');
   if(forbidden)return route.fulfill({status:403,json:{error:'Admin access is required.'}});
   if(req.method()==='GET')return route.fulfill({json:url.searchParams.get('cursor')?{backups:[row('later','Later Athlete')],nextCursor:null}:{backups:rows,nextCursor:cursor}});
   const input=req.postDataJSON();posts.push(input);assert.deepEqual(Object.keys(input).sort(),['action','backupId']);
   let target=rows.find(item=>item.id===input.backupId);assert.ok(target);
   if(input.action==='retry'){
    retryCount++;target={...target,deliveryStatus:retryCount===1?'blocked':'verified',deliveryIssue:retryCount===1?'connection_not_configured':null,lastAttemptAt:stamp,...(retryCount===1?{}:{verifiedAt:stamp,canDelete:true,receipt:receipt(target.athleteId)})};
   }else{
    assert.equal(input.action,'delete');assert.equal(target.deliveryStatus,'verified');assert.ok(target.receipt);
    if(conflict)return route.fulfill({status:409,json:{error:'Delivery changed. Refresh and check the receipt before removing this backup.'}});
    target={...target,backupRetained:false,canDelete:false};
   }
   rows=rows.map(item=>item.id===target.id?target:item);return route.fulfill({json:{backup:target}});
  }
  if(url.hostname!=='127.0.0.1'){external++;return route.abort()}return route.continue();
 });
 const article=name=>page.getByRole('article',{name:`Backup for ${name}`,exact:true});
 const open=()=>page.goto(`http://127.0.0.1:${server.address().port}`);
 try{
  await open();await article('Waiting Athlete').waitFor();
  assert.equal(await article('Waiting Athlete').getByRole('button',{name:/Remove backup/}).count(),0);
  assert.notEqual(rows[1].receipt.athleteId,rows[1].athleteId);
  assert.equal(await article('Verified Athlete').getByRole('button',{name:'Remove backup for Verified Athlete'}).isEnabled(),true,'server-verified receipts can use a different AuntEdna athlete ID');
  assert.equal(await article('Removed Athlete').getByRole('button').count(),0);
  assert.equal((await page.locator('body').innerText()).includes('PRIVATE_TEST_ANSWER_NEVER_RENDER'),false);
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'/tmp/baseline-backups-admin-desktop.png',fullPage:true});
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No horizontal overflow at ${width}`)}
  await page.screenshot({path:'/tmp/baseline-backups-admin-mobile.png',fullPage:true});
  await page.getByRole('textbox',{name:'Find an athlete, team or program'}).fill('Verified Athlete');assert.equal(await page.getByRole('article').count(),1);
  await page.getByRole('textbox',{name:'Find an athlete, team or program'}).fill('');
  await article('Waiting Athlete').getByRole('button',{name:'Try delivery again'}).click();
  await page.getByRole('status').filter({hasText:'Delivery needs review.'}).waitFor();
  await article('Waiting Athlete').getByText('Check the program’s approved AuntEdna connection and sending key before trying again.',{exact:true}).waitFor();
  assert.equal(await article('Waiting Athlete').getByRole('button',{name:/Remove backup/}).count(),0);
  await article('Waiting Athlete').getByRole('button',{name:'Try delivery again'}).click();
  await page.getByRole('status').filter({hasText:'AuntEdna confirmed receipt for Waiting Athlete.'}).waitFor();
  await article('Waiting Athlete').getByRole('button',{name:'Remove backup for Waiting Athlete'}).waitFor();
  const deletesBefore=posts.filter(post=>post.action==='delete').length;
  await article('Verified Athlete').getByRole('button',{name:'Remove backup for Verified Athlete'}).click();
  await page.getByRole('dialog').waitFor();await page.getByRole('dialog').getByText('AuntEdna receipt: receipt-verified',{exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'/tmp/baseline-backups-remove-confirmation.png',fullPage:false});
  await page.getByRole('button',{name:'Keep backup',exact:true}).click();assert.equal(posts.filter(post=>post.action==='delete').length,deletesBefore,'canceling never removes a backup');
  await article('Verified Athlete').getByRole('button',{name:'Remove backup for Verified Athlete'}).click();await page.getByRole('button',{name:'Remove verified backup',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').filter({hasText:'Delivery changed.'}).waitFor();
  assert.equal(await article('Verified Athlete').getByText('Saved privately',{exact:true}).count(),1);
  conflict=false;await page.getByRole('button',{name:'Remove verified backup',exact:true}).click();
  await page.getByRole('status').filter({hasText:'The Pulse backup for Verified Athlete was removed.'}).waitFor();
  assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await article('Verified Athlete').getByText('Removed',{exact:true}).count(),1);
  assert.equal(await article('Verified Athlete').getByRole('button').count(),0);
  await page.getByRole('button',{name:'Load more backups',exact:true}).click();await article('Later Athlete').waitFor();
  await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByText('3 of 3 loaded backups shown.',{exact:false}).waitFor();
  assert.equal(await article('Later Athlete').count(),0);
  forbidden=true;await open();await page.getByRole('alert').filter({hasText:'Admin access is required.'}).waitFor();
  assert.equal(await page.getByRole('article').count(),0);assert.equal(await page.getByRole('button',{name:'Remove verified backup'}).count(),0);
  assert.deepEqual(errors,[]);assert.equal(external,0);
  console.log(JSON.stringify({success:true,metadataOnly:true,retry:true,receiptRequired:true,confirmedDelete:true,conflictPreservesBackup:true,pagination:true,forbidden:true,externalRequests:external}));
 }catch(error){console.error(await page.locator('body').innerText());throw error}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
