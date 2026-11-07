const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const crypto = require('node:crypto').webcrypto;
const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://localhost',pretendToBeVisual:true});
for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true,crypto})) Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
const React = require('react');
const {act} = React;
const {Simulate} = require('react-dom/test-utils');
const {createRoot} = require('react-dom/client');
const compile = (path,requireFn = require) => {const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText)(requireFn,m,m.exports);return m.exports;};
const domain=compile('src/lib/simpbudget/statements.ts');
const row=(extra={})=>({id:'r1',date:'2026-11-01',description:'Home Depot',amount:100,kind:'expense',spaceId:'',reason:'Review',sourceRow:2,reviewed:false,excluded:false,duplicate:false,splits:[],...extra});
const statement=(extra={})=>({id:'s1',accountId:'a',fileName:'existing.csv',fingerprint:'hash',guidance:'',createdAt:'2026-11-01',status:'review',revision:1,transactions:[row()],warnings:[],...extra});
async function harness(initial=[]) {
  const data=new Map();
  data.set('simpbudget-users/u/statementAccounts/a',{id:'a',name:'Checking',type:'bank',defaultSpaceId:'personal'});
  for(const value of initial)data.set(`simpbudget-users/u/statementImports/${value.id}`,structuredClone(value));
  const writes=[];
  let failLoad=false;
  const firebase={collection:(_db,...path)=>path.join('/'),doc:(path,id)=>`${path}/${id}`,getDocs:async path=>{if(failLoad)throw Error('offline');return {docs:[...data].filter(([key])=>key.startsWith(path+'/')).map(([,value])=>({data:()=>structuredClone(value)}))};},setDoc:async(path,value)=>{data.set(path,structuredClone(value));writes.push(value);},runTransaction:async(_db,fn)=>{const staged=[];await fn({get:async path=>({exists:()=>data.has(path),data:()=>structuredClone(data.get(path))}),set:(path,value)=>staged.push([path,structuredClone(value)])});for(const [path,value]of staged){data.set(path,value);writes.push(value);}}};
  const Component=compile('src/components/simpbudget/StatementWorkspace.tsx',name=>name==='firebase/firestore'?firebase:name.includes('simpBudgetConfig')?{simpBudgetDb:{}}:name.includes('/statements')?domain:require(name)).default;
  const root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(Component,{user:{uid:'u',getIdToken:async()=> 'test-token'},spaces:[{id:'personal',name:'Personal'},{id:'pulse',name:'Pulse'},{id:'tres',name:'TresProperties'}],year:2026,month:11})));
  const button=(text)=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
  const click=async(text)=>{const b=button(text);assert.ok(b,`Missing button: ${text}`);await act(async()=>Simulate.click(b));};
  const input=label=>document.querySelector(`[aria-label="${label}"]`);
  const change=async(label,value)=>{const el=input(label);assert.ok(el,label);await act(async()=>Simulate.change(el,{target:{value,checked:value}}));};
  await click('Open statement workspace');
  return {data,writes,click,button,input,change,close:async()=>act(async()=>root.unmount()),text:()=>document.body.textContent,open:async(value=initial[0])=>click(`${value.fileName} · ${value.status} · ${value.transactions.length} rows`)};
}
test('statement UI loads saved account/history, requires review, commits and undoes actuals',async()=>{
  const h=await harness([statement()]);try{
    assert.match(h.text(),/existing.csv · review · 1 rows/);assert.match(h.input('Statement account').textContent,/Checking/);
    await h.open();await h.click('Commit reviewed transactions');assert.match(h.text(),/Review this transaction/);assert.equal(h.writes.length,0);
    await h.click('Select all');await h.change('Bulk bucket','personal');await h.click('Assign selected & review');
    await h.click('Save review');assert.equal(h.writes.at(-1).revision,2);assert.equal(h.writes.at(-1).transactions[0].reviewed,true);
    await h.click('Commit reviewed transactions');assert.equal(h.writes.at(-1).status,'committed');assert.match(h.text(),/\$100.00/);
    await h.click('Undo import');assert.equal(h.writes.at(-1).status,'undone');assert.match(h.text(),/history is retained/);assert.equal(h.button('Commit reviewed transactions'),undefined);
  }finally{await h.close();}
});
test('CSV upload exposes mapping, guidance suggestion, and creates durable review without committing',async()=>{
  const h=await harness();try{
    await h.change('Statement account','a');await h.change('Upload guidance','Home Depot transactions this month are likely for TresProperties');
    const csv='Date,Merchant,Amount\n2026-11-01,Home Depot,12.50';
    const file={name:'statement.csv',size:csv.length,type:'text/csv',arrayBuffer:async()=>new TextEncoder().encode(csv).buffer,text:async()=>csv};
    await act(async()=>Simulate.change(h.input('Upload statements'),{target:{files:[file],value:'fake'}}));
    assert.match(h.text(),/Map columns · statement.csv/);assert.equal(h.writes.length,0);
    await h.click('Create review');const saved=h.writes.at(-1);assert.equal(saved.status,'review');assert.equal(saved.transactions[0].amount,12.5);assert.equal(saved.transactions[0].suggestedSpaceId,'tres');assert.equal(saved.transactions[0].reviewed,false);assert.equal(saved.transactions[0].spaceId,'');assert.equal(saved.revision,1);
    assert.match(h.text(),/Suggested: TresProperties/);
  }finally{await h.close();}
});
test('bulk selection only changes selected rows and splits enforce exact total before commit',async()=>{
  const h=await harness([statement({transactions:[row(),row({id:'r2',sourceRow:3,amount:30})]})]);try{
    await h.open(statement({transactions:[row(),row({id:'r2',sourceRow:3,amount:30})]}));
    await h.change('Select row 2',true);await h.change('Bulk bucket','pulse');await h.click('Assign selected & review');await h.click('Save review');
    assert.equal(h.writes.at(-1).transactions[0].spaceId,'pulse');assert.equal(h.writes.at(-1).transactions[1].reviewed,false);
    await act(async()=>Simulate.click([...document.querySelectorAll('button')].find(b=>b.textContent==='Split transaction')));
    await h.change('Split 1 amount row 2','70');await h.change('Split 2 amount row 2','20');
    const reviewed=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Reviewed').querySelector('input');
    await act(async()=>Simulate.change(reviewed,{target:{checked:true}}));await h.click('Commit reviewed transactions');assert.match(h.text(),/Split amounts must equal/);
    await h.change('Split 2 amount row 2','30');await act(async()=>Simulate.change(reviewed,{target:{checked:true}}));
    await h.change('Select row 2',false);await h.change('Select row 3',true);await h.click('Exclude selected');await h.click('Commit reviewed transactions');assert.equal(h.writes.at(-1).status,'committed');assert.deepEqual(domain.actualTotals([h.writes.at(-1)]),{personal:70,pulse:30});
  }finally{await h.close();}
});
test('optimistic revision prevents overwriting newer review from another tab',async()=>{
  const h=await harness([statement()]);try{
    await h.open();h.data.set('simpbudget-users/u/statementImports/s1',statement({revision:2}));
    await h.click('Save review');assert.match(h.text(),/changed in another tab/);assert.equal(h.writes.length,0);assert.equal(h.data.get('simpbudget-users/u/statementImports/s1').revision,2);
  }finally{await h.close();}
});
test('reopening current history item retains edits and a usable revision',async()=>{
  const h=await harness([statement()]);try{
    await h.open();await h.change('Description row 2','Corrected merchant');await h.open();
    assert.equal(h.input('Description row 2').value,'Corrected merchant');
    await h.click('Save review');assert.doesNotMatch(h.text(),/changed in another tab/);assert.equal(h.writes.at(-1).transactions[0].description,'Corrected merchant');
  }finally{await h.close();}
});
test('repeated commit clicks issue one transaction and preserve one actual record',async()=>{
  const h=await harness([statement({transactions:[row({reviewed:true,spaceId:'personal'})]})]);try{
    await h.open();const button=h.button('Commit reviewed transactions');
    await act(async()=>{Simulate.click(button);Simulate.click(button);});
    assert.equal(h.writes.length,1);assert.equal(h.writes[0].status,'committed');assert.deepEqual(domain.actualTotals([...h.data].filter(([k])=>k.includes('/statementImports/')).map(([,v])=>v)),{personal:100});
  }finally{await h.close();}
});
