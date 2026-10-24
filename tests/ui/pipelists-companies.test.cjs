const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require('playwright');
const postcss = require('postcss');
const tailwind = require('tailwindcss');

test('company checkboxes wrap on mobile, support multiple choices, reload and clear', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipelists-companies-'));
  let browser;
  try {
    await build({ stdin: { contents: `import React,{useState} from 'react'; import {createRoot} from 'react-dom/client'; import Companies from './src/components/pipelists/PipeListsCompanies';
      function App(){const [value,setValue]=useState([]);return <main className="mx-auto max-w-xl rounded-xl border border-stone-200 bg-white p-5"><h1 className="mb-5 text-xl font-semibold">Grant details</h1><Companies value={value} onChange={setValue}/><button className="mt-5 rounded border p-2" onClick={()=>{window.saved=JSON.stringify(value);setValue(JSON.parse(window.saved))}}>Save and reload</button><p className="mt-4" role="status">{value.join(', ') || 'Unassigned'}</p></main>}createRoot(document.getElementById('root')).render(<App/>);`, resolveDir:process.cwd(), loader:'tsx' }, bundle:true, outfile:path.join(dir,'app.js') });
    const source=await fs.readFile('src/components/pipelists/PipeListsCompanies.tsx','utf8');
    const css=await postcss([tailwind({content:[{raw:source+' max-w-xl mx-auto p-5 mb-5 text-xl rounded-xl border border-stone-200 bg-white mt-5 p-2 mt-4',extension:'tsx'}]})]).process('@tailwind base; @tailwind components; @tailwind utilities;', {from:undefined});
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage();
    await page.route('**/*',route=>route.abort());
    for(const width of [375,1280]) {
      await page.setViewportSize({width,height:600});
      await page.setContent(`<html><style>${css.css}</style><body style="padding:16px;background:#fafaf9"><div id="root"></div></body></html>`);
      await page.addScriptTag({content:await fs.readFile(path.join(dir,'app.js'),'utf8')});
      assert.equal(await page.getByRole('checkbox').count(),4);
      await page.getByRole('checkbox',{name:'PIL',exact:true}).check();
      await page.getByRole('checkbox',{name:'ATHLeda',exact:true}).check();
      await page.getByRole('button',{name:'Save and reload'}).click();
      assert.equal(await page.getByRole('status').innerText(),'PIL, ATHLeda');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:`/tmp/pipelists-companies-${width}.png`});
      await page.getByRole('checkbox',{name:'PIL',exact:true}).uncheck();
      await page.getByRole('checkbox',{name:'ATHLeda',exact:true}).uncheck();
      await page.getByRole('button',{name:'Save and reload'}).click();
      assert.equal(await page.getByRole('status').innerText(),'Unassigned');
    }
  } finally {await browser?.close();await fs.rm(dir,{recursive:true,force:true});}
});
