const { chromium } = require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:3217')?route.continue():route.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3217/PulseCheck/coach-survey/baseline?review=1');await page.getByRole('heading',{name:'Your coach baseline'}).waitFor();
 if(await page.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth))throw Error('horizontal overflow');
 await page.screenshot({path:'output/coach-surveys/baseline-mobile.png',fullPage:true});
 await page.setViewportSize({width:320,height:700});if(await page.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth))throw Error('320px overflow');await page.setViewportSize({width:390,height:844});
 await page.locator('input[name="recognize-support"]').first().focus();await page.keyboard.press('ArrowRight');if(!(await page.locator('input[name="recognize-support"]').nth(1).isChecked()))throw Error('keyboard radio navigation failed');
 for(const name of ['recognize-support','support-pathway','conversation-comfort']) await page.locator(`input[name="${name}"]`).first().check();
 await page.getByLabel('Individual conversations',{exact:true}).check();await page.getByLabel('No consistent process',{exact:true}).check();if(await page.getByLabel('Individual conversations',{exact:true}).isChecked())throw Error('none not exclusive');
 await page.getByLabel('Limited time',{exact:true}).check();
 for(const value of ['Knowing when to check in','Having better conversations','Bringing mental skills into coaching'])await page.getByLabel(value,{exact:true}).check();
 if(!(await page.getByLabel('Connecting athletes with appropriate support',{exact:true}).isDisabled()))throw Error('max not enforced');
 await page.getByRole('textbox',{name:/Additional thoughts/}).fill('Synthetic feedback for local QA only.');await page.getByRole('button',{name:'Finish review'}).click();await page.getByRole('heading',{name:'Review complete'}).waitFor();
 await page.goto('http://127.0.0.1:3217/PulseCheck/coach-survey/check-in?review=1');await page.getByRole('heading',{name:'Coach check-in'}).waitFor();await page.screenshot({path:'output/coach-surveys/check-in-mobile.png',fullPage:true});
 await page.getByLabel('Haven’t used it enough to tell',{exact:true}).check();await page.getByLabel('Haven’t used it',{exact:true}).check();await page.getByRole('button',{name:'Finish review'}).click();await page.getByRole('heading',{name:'Review complete'}).waitFor();
 await page.setViewportSize({width:1280,height:900});await page.goto('http://127.0.0.1:3217/PulseCheck/coach-survey/check-in?review=1');await page.getByRole('heading',{name:'Coach check-in'}).waitFor();await page.screenshot({path:'output/coach-surveys/check-in-desktop.png',fullPage:true});
 await page.goto('http://127.0.0.1:3217/PulseCheck/coach-survey/check-in');await page.locator('main').getByRole('alert').waitFor();
 // Synthetic API interception verifies failure/retry without touching Firebase.
 let posts=0;await page.route('**/api/pulsecheck/coach-survey/check-in',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{completed:false}});posts++;return route.fulfill({status:posts===1?503:200,json:posts===1?{error:'Synthetic network failure'}:{completed:true}});});
 await page.goto('http://127.0.0.1:3217/PulseCheck/coach-survey/check-in#token='+'A'.repeat(43));await page.getByLabel('Very',{exact:true}).check();await page.getByLabel('Yes',{exact:true}).check();await page.getByRole('textbox',{name:/Additional thoughts/}).fill('Synthetic retry case');await page.getByRole('button',{name:'Submit response'}).click();await page.locator('main').getByRole('alert').waitFor();if(!(await page.getByLabel('Very',{exact:true}).isChecked()))throw Error('answers lost');await page.getByRole('button',{name:'Submit response'}).click();await page.getByRole('heading',{name:'Thank you. Your response is recorded.'}).waitFor();if(posts!==2)throw Error('unexpected duplicate');if(page.url().includes('token'))throw Error('token not scrubbed');
 console.log(JSON.stringify({mobileWidths:[320,390],desktopWidth:1280,baselineComplete:true,periodicComplete:true,failureRetry:true,errors}));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
