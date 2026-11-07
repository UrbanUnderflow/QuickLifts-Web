const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const crypto = require('node:crypto').webcrypto;
const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://localhost',pretendToBeVisual:true});
for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,HTMLInputElement:dom.window.HTMLInputElement,HTMLButtonElement:dom.window.HTMLButtonElement,Element:dom.window.Element,Node:dom.window.Node,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),ResizeObserver:class{observe(){}disconnect(){}unobserve(){}},IntersectionObserver:class{observe(){}disconnect(){}unobserve(){}},IS_REACT_ACT_ENVIRONMENT:true,crypto})) Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.fetch=async(_url,options)=>{const b=JSON.parse(options.body);return {ok:true,json:async()=>b.action==='list'?{documents:[]}:{document:{statementId:b.statementId,role:b.role,fileName:b.fileName,mimeType:b.mimeType}}};};
globalThis.FileReader=class{readAsDataURL(file){file.arrayBuffer().then(bytes=>{this.result='data:application/octet-stream;base64,'+Buffer.from(bytes).toString('base64');this.onload();});}};
const React = require('react');
const {act} = React;
const {Simulate} = require('react-dom/test-utils');
const {createRoot} = require('react-dom/client');
const compile = (path,requireFn = require) => {const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText)(requireFn,m,m.exports);return m.exports;};
const domain=compile('src/lib/simpbudget/statements.ts');
const sorting=compile('src/lib/simpbudget/sortingQuestions.ts');
const Questions=compile('src/components/simpbudget/SortingQuestions.tsx',name=>name.includes('sortingQuestions')?sorting:require(name)).default;
const row=(extra={})=>({id:'r1',date:'2026-11-01',description:'Home Depot',amount:100,kind:'expense',spaceId:'',reason:'Review',sourceRow:2,reviewed:false,excluded:false,duplicate:false,splits:[],...extra});
const statement=(extra={})=>({id:'s1',accountId:'a',fileName:'existing.csv',fingerprint:'hash',guidance:'',createdAt:'2026-11-01',status:'review',revision:1,transactions:[row()],warnings:[],...extra});
async function harness(initial=[]) {
  const data=new Map();
  data.set('simpbudget-users/u/statementAccounts/a',{id:'a',name:'Checking',type:'bank',defaultSpaceId:'personal'});
  for(const value of initial)data.set(`simpbudget-users/u/statementImports/${value.id}`,structuredClone(value));
  const writes=[];
  let failLoad=false;
  const firebase={collection:(_db,...path)=>path.join('/'),doc:(path,id)=>`${path}/${id}`,getDocs:async path=>{if(failLoad)throw Error('offline');return {docs:[...data].filter(([key])=>key.startsWith(path+'/')).map(([,value])=>({data:()=>structuredClone(value)}))};},setDoc:async(path,value)=>{data.set(path,structuredClone(value));writes.push(value);},runTransaction:async(_db,fn)=>{const staged=[];await fn({get:async path=>({exists:()=>data.has(path),data:()=>structuredClone(data.get(path))}),set:(path,value)=>staged.push([path,structuredClone(value)])});for(const [path,value]of staged){data.set(path,value);writes.push(value);}}};
  const Component=compile('src/components/simpbudget/StatementWorkspace.tsx',name=>name==='firebase/firestore'?firebase:name.includes('simpBudgetConfig')?{simpBudgetDb:{}}:name.includes('/statements')?domain:name==='./SortingQuestions'?{__esModule:true,default:Questions}:name.includes('sortingQuestions')?sorting:name==='./TransactionDetails'?compile('src/components/simpbudget/TransactionDetails.tsx'):require(name)).default;
  const root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(Component,{user:{uid:'u',getIdToken:async()=> 'test-token'},spaces:[{id:'personal',name:'Personal'},{id:'pulse',name:'Pulse'},{id:'tres',name:'TresProperties'}],year:2026,month:11})));
  const button=(text)=>[...document.querySelectorAll('button')].find(b=>b.textContent===text||b.getAttribute('aria-label')===text);
  const click=async(text)=>{const b=button(text);assert.ok(b,`Missing button: ${text}`);await act(async()=>Simulate.click(b));};
  const input=label=>document.querySelector(`[aria-label="${label}"]`);
  const change=async(label,value)=>{const el=input(label);assert.ok(el,label);await act(async()=>Simulate.change(el,{target:{value,checked:value}}));};
  await click('Import statement');
  return {data,writes,click,button,input,change,close:async()=>act(async()=>root.unmount()),text:()=>document.body.textContent,open:async(value=initial[0])=>{await click('Close statement modal');await click('Import history');const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(value.fileName));await act(async()=>Simulate.click(b));}};
}
test('modal sorts selected rows, removes them from inbox, undoes, persists categories, commits and undoes import',async()=>{
  const h=await harness([statement()]);try{
    await h.open();assert.ok(document.querySelector('[role="dialog"][aria-modal="true"]'));assert.equal(h.button('Finish import').disabled,true);
    await h.change('Category row 2','Supplies & materials');await h.change('Select row 2',true);await h.click('Assign to Personal');
    assert.equal(h.input('Select row 2'),null);assert.match(h.text(),/All transactions sorted/);assert.equal(h.writes.length,0);
    await h.click('Undo last sort');assert.ok(h.input('Select row 2'));assert.equal(h.input('Category row 2').value,'Supplies & materials');
    await h.click('Select all');await h.click('Assign to Pulse');await h.click('Save for later');
    assert.equal(h.writes.at(-1).transactions[0].category,'Supplies & materials');assert.equal(h.writes.at(-1).transactions[0].spaceId,'pulse');
    await h.click('Finish import');assert.equal(h.writes.at(-1).status,'committed');assert.deepEqual(domain.actualTotals([h.writes.at(-1)]),{pulse:100});
    await h.click('Undo import');assert.equal(h.writes.at(-1).status,'undone');assert.deepEqual(domain.actualTotals([h.writes.at(-1)]),{});
    assert.equal(h.input('Category row 2'),null);
  }finally{await h.close();}
});
test('CSV upload opens transaction modal with suggestions and creates only a review',async()=>{
  const h=await harness();try{
    const csv='Date,Merchant,Amount\n2026-11-01,Home Depot,12.50';const file={name:'statement.csv',size:csv.length,type:'text/csv',arrayBuffer:async()=>new TextEncoder().encode(csv).buffer,text:async()=>csv};
    await act(async()=>Simulate.change(h.input('Upload statements'),{target:{files:[file],value:'fake'}}));
    assert.match(h.text(),/Match CSV columns/);assert.equal(h.writes.length,0);await h.change('Statement account','a');await h.change('Upload guidance','Home Depot transactions this month are likely for TresProperties');await h.click('Analyze');const saved=h.writes.at(-1);
    assert.equal(saved.status,'review');assert.equal(saved.transactions[0].suggestedSpaceId,'tres');assert.equal(saved.transactions[0].reviewed,false);assert.equal(saved.transactions[0].spaceId,'');
    assert.match(h.text(),/Sort your transactions/);assert.ok(h.input('Select row 2'));assert.equal(h.input('Upload statements'),null);
  }finally{await h.close();}
});
test('dragging one row moves only that row; dragging a selected row moves the selection and undo restores it',async()=>{
  const value=statement({transactions:[row(),row({id:'r2',sourceRow:3,amount:30}),row({id:'r3',sourceRow:4,amount:20})]});const h=await harness([value]);try{
    await h.open();const transfer={setData(){},effectAllowed:''};
    await act(async()=>Simulate.dragStart(h.input('Select row 2').closest('tr'),{dataTransfer:transfer}));
    await act(async()=>Simulate.drop(h.button('Assign to Pulse'),{preventDefault(){}}));
    assert.equal(h.input('Select row 2'),null);assert.ok(h.input('Select row 3'));
    await h.change('Select row 3',true);await h.change('Select row 4',true);
    await act(async()=>Simulate.dragStart(h.input('Select row 3').closest('tr'),{dataTransfer:transfer}));
    await act(async()=>Simulate.drop(h.button('Assign to TresProperties'),{preventDefault(){}}));
    assert.match(h.text(),/All transactions sorted/);await h.click('Undo last sort');assert.ok(h.input('Select row 3'));assert.ok(h.input('Select row 4'));assert.equal(h.input('Select row 2'),null);
    await h.click('Save for later');assert.equal(h.writes.at(-1).transactions[0].spaceId,'pulse');assert.equal(h.writes.at(-1).transactions[1].spaceId,'');
  }finally{await h.close();}
});
test('transfer classification removes a row from spending and can be undone',async()=>{
  const h=await harness([statement()]);try{await h.open();await h.change('Category row 2','card_payment');assert.equal(h.input('Select row 2'),null);await h.click('Undo last sort');assert.ok(h.input('Select row 2'));await h.change('Category row 2','card_payment');await h.click('Finish import');assert.deepEqual(domain.actualTotals([h.writes.at(-1)]),{});}finally{await h.close();}
});
test('split correction requires exact totals and disappears only after confirming the split',async()=>{
  const h=await harness([statement()]);try{
    await h.open();await h.click('Edit row 2');await h.click('Split transaction');await h.change('Split 1 amount row 2','70');await h.change('Split 2 amount row 2','20');await h.click('Confirm split');assert.match(h.text(),/Split amounts must equal/);assert.ok(h.input('Select row 2'));
    await h.change('Split 2 amount row 2','30');await h.click('Confirm split');assert.equal(h.input('Select row 2'),null);await h.click('Finish import');assert.deepEqual(domain.actualTotals([h.writes.at(-1)]),{personal:70,pulse:30});
  }finally{await h.close();}
});
test('optimistic revision prevents overwriting newer review from another tab',async()=>{
  const h=await harness([statement()]);try{await h.open();h.data.set('simpbudget-users/u/statementImports/s1',statement({revision:2}));await h.click('Save for later');assert.match(h.text(),/changed in another tab/);assert.equal(h.writes.length,0);}finally{await h.close();}
});
test('closing the modal saves the draft and returning preserves assignments',async()=>{
  const h=await harness([statement()]);try{await h.open();await h.click('Select all');await h.click('Assign to Personal');await h.click('Close statement modal');assert.equal(document.querySelector('[role="dialog"]'),null);assert.equal(h.writes.at(-1).status,'review');assert.equal(h.writes.at(-1).transactions[0].spaceId,'personal');await h.click('Import history');await h.open();assert.match(h.text(),/All transactions sorted/);}finally{await h.close();}
});
test('repeated finish clicks issue one transaction',async()=>{
  const h=await harness([statement({transactions:[row({reviewed:true,spaceId:'personal'})]})]);try{await h.open();const b=h.button('Finish import');await act(async()=>{Simulate.click(b);Simulate.click(b);});assert.equal(h.writes.length,1);assert.equal(h.writes[0].status,'committed');}finally{await h.close();}
});
test('PDF selection stays local until Analyze sends the staged document and prompt',async()=>{
  const previousFetch=globalThis.fetch, previousReader=globalThis.FileReader;
  const calls=[];
  globalThis.fetch=async(url,options)=>{if(url.includes('statement-document'))return previousFetch(url,options);calls.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>({transactions:[{date:'2026-11-01',description:'Synthetic purchase',amount:12,kind:'expense',reason:'Needs review',sourceRow:'Page 1 row 1'}],warnings:[]})};};
  globalThis.FileReader=class{readAsDataURL(file){file.arrayBuffer().then(bytes=>{this.result='data:application/pdf;base64,'+Buffer.from(bytes).toString('base64');this.onload();});}};
  const h=await harness();try{
    const file=Object.assign(new Blob(['%PDF-1.7 synthetic'],{type:'application/pdf'}),{name:'synthetic.pdf'});
    await act(async()=>Simulate.change(h.input('Upload statements'),{target:{files:[file],value:'fake'}}));
    assert.equal(calls.length,0);assert.equal(h.writes.length,0);assert.ok(document.querySelector('object[aria-label="Statement PDF preview"]'));
    await h.change('Upload guidance','Hardware is for Pulse');await h.change('Statement account','a');assert.equal(calls.length,0);
    await h.click('Analyze');assert.equal(calls.length,1);assert.equal(calls[0].body.guidance,'Hardware is for Pulse');assert.equal(calls[0].body.fileName,'synthetic.pdf');assert.equal(h.writes.at(-1).status,'review');assert.match(h.text(),/Sort your transactions/);
  }finally{await h.close();globalThis.fetch=previousFetch;globalThis.FileReader=previousReader;}
});

test('multiple files form one review and commit/undo atomically with source identity',async()=>{
 const h=await harness();try{
  const make=(name,desc)=>{const csv=`Transaction Date,Post Date,Description,Category,Type,Amount\n01/01/2026,01/02/2026,${desc},Shopping,Sale,-10`;return {name,size:csv.length,type:'text/csv',arrayBuffer:async()=>new TextEncoder().encode(csv).buffer,text:async()=>csv};};
  await act(async()=>Simulate.change(h.input('Upload statements'),{target:{files:[make('jan.csv','Shop'),make('feb.csv','Other shop')],value:'fake'}}));
  await h.change('Statement account','a');await h.click('Analyze');assert.equal(h.writes.length,2);
  assert.match(h.text(),/2 statements/);assert.match(h.text(),/Source/);assert.match(h.text(),/jan.csv/);assert.match(h.text(),/feb.csv/);
  assert.ok(h.writes.every(w=>w.transactions[0].sourceAccountName==='Checking'));assert.notEqual(h.writes[0].transactions[0].id,h.writes[1].transactions[0].id);
  await h.click('Select all');await h.click('Assign to Personal');await h.click('Finish import');
  assert.ok(h.writes.slice(-2).every(w=>w.status==='committed'));await h.click('Undo import');assert.ok(h.writes.slice(-2).every(w=>w.status==='undone'));
 }finally{await h.close();}
});

test('failure in a later PDF leaves no partial batch imported',async()=>{
 const h=await harness();const oldFetch=global.fetch;const oldReader=global.FileReader;const oldCreate=URL.createObjectURL;const oldRevoke=URL.revokeObjectURL;let calls=0;
 try{
  URL.createObjectURL=()=> 'blob:test';URL.revokeObjectURL=()=>{};
  global.FileReader=class{readAsDataURL(){this.result='data:application/pdf;base64,JVBERg==';this.onload();}};
  global.fetch=async()=>({ok:++calls===1,json:async()=>calls===1?{transactions:[row()]}:{error:'Provider unavailable'}});
  const file=name=>({name,type:'application/pdf',size:4,arrayBuffer:async()=>new Uint8Array([1,2,3,4]).buffer});
  await act(async()=>Simulate.change(h.input('Upload statements'),{target:{files:[file('one.pdf'),file('two.pdf')],value:'fake'}}));await h.change('Statement account','a');await h.click('Analyze');
  assert.equal(calls,2);assert.equal(h.writes.length,0);assert.match(h.text(),/Provider unavailable/);
 }finally{global.fetch=oldFetch;global.FileReader=oldReader;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;await h.close();}
});

test('attaching an original to a committed import preserves all sorted transactions and offers row links',async()=>{
 const value=statement({status:'committed',transactions:[row({spaceId:'pulse',reviewed:true,category:'Travel',splits:[{spaceId:'pulse',amount:100}]})]});
 const h=await harness([value]);try{
  await h.open();const before=JSON.stringify([...h.data]);
  const file={name:'existing.pdf',size:20,type:'application/pdf',arrayBuffer:async()=>Buffer.from('%PDF-1.7 synthetic').buffer};
  await act(async()=>Simulate.change(h.input('Attach original statements'),{target:{files:[file],value:'fake'}}));
  assert.equal(h.input('Statement for existing.pdf').value,'s1');
  await h.click('Attach selected documents');assert.equal(JSON.stringify([...h.data]),before);assert.equal(h.writes.length,0);
  assert.match(h.text(),/1\/1 originals attached/);assert.match(document.querySelector('tbody').textContent,/View statement/);
 }finally{await h.close();}
});

test('transaction details distinguishes self-reported entries and opens the exact imported source',async()=>{
 const Details=compile('src/components/simpbudget/TransactionDetails.tsx').default;const root=createRoot(document.getElementById('root'));let opened;
 const props={onClose(){},onOpenSource:id=>{opened=id;}};
 try{
  await act(async()=>root.render(React.createElement(Details,{...props,detail:{date:'2026-06-01',description:'Manual receipt',amount:30,sourceType:'self_reported'}})));
  assert.match(document.body.textContent,/Self-reported/);assert.match(document.body.textContent,/No source document/);
  await act(async()=>root.render(React.createElement(Details,{...props,detail:{date:'2026-06-01',description:'Hardware',amount:100,allocatedAmount:40,sourceType:'document',sourceFileName:'june.pdf',sourceRow:'Page 2 row 3',statementId:'statement-42',splits:[{name:'TresProperties',amount:40},{name:'Personal',amount:60}]}})));
  assert.match(document.body.textContent,/Extracted from a document/);assert.match(document.body.textContent,/Page 2 row 3/);assert.match(document.body.textContent,/This budget’s share/);
  await act(async()=>Simulate.click([...document.querySelectorAll('button')].find(b=>b.textContent==='View source document')));assert.equal(opened,'statement-42');
 }finally{await act(async()=>root.unmount());}
});
test('sorting questions accept Yes, No alternatives and preserve undo',async()=>{
 const h=await harness([statement({transactions:[row({suggestedSpaceId:'pulse'})]})]);try{await h.open();assert.match(h.text(),/Should these 1 transactions go to Pulse/);await h.click('No');await h.click('Personal');assert.equal(h.input('Select row 2'),null);await h.click('Undo last sort');assert.ok(h.input('Select row 2'));await h.click('Yes');await h.click('Save for later');assert.equal(h.writes.at(-1).transactions[0].spaceId,'pulse');assert.match(h.writes.at(-1).transactions[0].reason,/Sorting answer/);}finally{await h.close();}
});
test('source correction preserves sorted rows and original linkage',async()=>{
 const h=await harness([statement({transactions:[row({reviewed:true,spaceId:'pulse',sourceImportId:'s1',sourceAccountId:'wrong'})]})]);try{await h.open();await h.change('Correct review source account','a');await h.click('Save for later');const r=h.writes.at(-1).transactions[0];assert.equal(r.sourceAccountId,'a');assert.equal(r.sourceImportId,'s1');assert.equal(r.spaceId,'pulse');assert.equal(r.reviewed,true);}finally{await h.close();}
});
test('written exceptions are previewed before applying and can be undone',async()=>{
 const prior=globalThis.fetch;globalThis.fetch=async(url,options)=>url.includes('sort-answer')?{ok:true,json:async()=>({decisions:[{id:'r1',spaceId:'personal',exclude:false}],clarification:''})}:prior(url,options);
 const h=await harness([statement({transactions:[row({suggestedSpaceId:'pulse'})]})]);try{await h.open();await h.change('Sorting answer','No, this is Personal');await h.click('Send response');assert.ok(h.input('Select row 2'));assert.match(h.text(),/Check the proposed changes/);assert.equal(h.writes.length,0);await h.click('Apply these changes');assert.equal(h.input('Select row 2'),null);await h.click('Undo last sort');assert.ok(h.input('Select row 2'));}finally{await h.close();globalThis.fetch=prior;}
});
