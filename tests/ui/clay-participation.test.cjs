const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {build} = require('esbuild');
const {chromium} = require('playwright');

test('Clay team views preserve unavailable data, isolate trainer summaries and support roster search', async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'clay-participation-'));let browser,server;
 try {
 await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Views from './src/components/coach/ClayParticipationViews';import {demoTeamParticipation,demoTeamWellbeing} from './src/components/coach/clayDashboardDemoData';const root=createRoot(document.getElementById('root'));window.renderView=(view,empty=false)=>root.render(<Views view={view} participation={empty?null:demoTeamParticipation} wellbeing={demoTeamWellbeing} loading={false} error={null} onRetry={()=>{}} onOpenSkills={()=>window.renderView('skills')} onOpenAthletes={()=>window.renderView('athletes')}/>);window.renderView('overview');`,loader:'tsx',resolveDir:process.cwd()},bundle:true,outfile:path.join(dir,'app.js')});
 server=http.createServer(async(req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(await fs.readFile(path.join(dir,'app.js')))}else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(await fs.readFile(path.join(dir,'app.css')))}else res.end('<html><head><link rel="stylesheet" href="/app.css"></head><body style="margin:0;padding:32px;background:#f5f6f1"><div id="root"></div><script src="/app.js"></script></body></html>')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1300,height:1100}});await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('heading',{name:'What your team is learning'}).waitFor();assert.match(await page.locator('body').innerText(),/14 of 24 athletes/);assert.equal(await page.getByText('Team mood',{exact:true}).count(),0);
 await page.screenshot({path:'/tmp/clay-participation-overview.png',fullPage:true});
 await page.getByRole('button',{name:'View all athletes'}).click();await page.getByRole('textbox',{name:'Find an athlete'}).fill('Sage');assert.equal(await page.locator('tbody tr').count(),1);assert.match(await page.locator('tbody').innerText(),/Not connected/);await page.getByRole('button',{name:'Sage Walker'}).click();await page.getByRole('region',{name:'Sage Walker participation summary'}).waitFor();
 await page.evaluate(()=>window.renderView('wellbeing'));await page.getByRole('heading',{name:'Team mood'}).waitFor();assert.equal(await page.locator('table').count(),0);assert.equal(await page.getByRole('textbox',{name:'Find an athlete'}).count(),0);await page.screenshot({path:'/tmp/clay-participation-wellbeing.png',fullPage:true});
 await page.evaluate(()=>window.renderView('overview',true));await page.getByText('Select a team to view participation.').waitFor();assert.equal(await page.getByText('14 of 24 athletes currently learning this skill').count(),0);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.renderView('skills'));await page.getByRole('heading',{name:'Skill training',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);await page.screenshot({path:'/tmp/clay-participation-mobile.png',fullPage:true});
 }finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true})}
});
