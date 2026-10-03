const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { build } = require('esbuild');
const { chromium } = require('playwright');
const postcss = require('postcss');
const tailwind = require('tailwindcss');

test('failed status reveals exact message/code, dismisses, and clears after success', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipelists-status-'));
  let browser, server;
  try {
    await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Status,{saveFailureDetails} from './src/components/pipelists/PipeListsSaveStatus';
      const root=createRoot(document.getElementById('root'));
      window.renderStatus=(failure)=>root.render(<Status failure={failure}><span style={{color:'#f43f5e'}}>●</span><span>{failure?'Save failed':'Saved'}</span><span>· tremaine.grant@gmail.com</span></Status>);
      window.renderStatus(saveFailureDetails({code:'failed-precondition',message:'The stored version does not match the required base version.'}));`, resolveDir: process.cwd(), loader:'tsx' }, bundle:true, outfile:path.join(dir,'app.js') });
    const source = await fs.readFile('src/components/pipelists/PipeListsSaveStatus.tsx','utf8');
    const css = await postcss([tailwind({content:[{raw:source,extension:'tsx'}]})]).process('@tailwind base; @tailwind components; @tailwind utilities;', {from:undefined});
    server=http.createServer(async(req,res)=>{ if(req.url==='/app.js')res.end(await fs.readFile(path.join(dir,'app.js'))); else res.end(`<html><style>${css.css}</style><body style="background:#fafaf9;padding:40px"><div style="display:flex;justify-content:flex-end" id="root"></div><script src="/app.js"></script></body></html>`); });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1000,height:500}});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const trigger=page.getByRole('button',{name:'Save failed. Show error details'});
    await trigger.click();
    const bubble=page.getByRole('region',{name:'Save error details'});
    assert.match(await bubble.innerText(), /failed-precondition/);
    assert.match(await bubble.innerText(), /stored version/);
    await page.screenshot({path:'/tmp/pipelists-save-error-popup.png'});
    await page.keyboard.press('Escape'); assert.equal(await bubble.count(),0);
    await trigger.click(); await page.mouse.click(10,450); assert.equal(await bubble.count(),0);
    await trigger.click(); await page.getByRole('button',{name:'Close save error'}).click(); assert.equal(await bubble.count(),0);
    await trigger.click(); await page.evaluate(()=>window.renderStatus(null));
    await page.getByRole('button',{name:/Saved/}).waitFor(); assert.equal(await bubble.count(),0);
  } finally { await browser?.close(); if(server)await new Promise(resolve=>server.close(resolve)); await fs.rm(dir,{recursive:true,force:true}); }
});
