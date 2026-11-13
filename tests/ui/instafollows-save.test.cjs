const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{act}=React,{JSDOM}=require('jsdom');
for(const scenario of ['fallback-save-undo','retry','unavailable'])test(`private review ${scenario}`,async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://fitwithpulse.ai/instafollows'}),prior=new Map();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 Object.defineProperty(dom.window.crypto,'randomUUID',{value:undefined});
 if(scenario==='unavailable')Object.defineProperty(dom.window.crypto,'getRandomValues',{value:undefined});
 const compile=(file,mocks)=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>mocks[n],window:dom.window,crypto:dom.window.crypto,Uint8Array,Date,Error,setTimeout,clearTimeout,btoa:s=>Buffer.from(s).toString('base64'),fetch:request});return module.exports;};
 const calls=[];let decision={},failed=false;
 async function request(path,opts={}){
  if(path.endsWith('/session'))return {ok:true,status:200,json:async()=>({expiresAt:Date.now()+3600000})};
  if(opts.method==='PATCH'){const input=JSON.parse(opts.body);calls.push(input);assert.equal(opts.headers['X-Instafollows-Request'],'1');assert.equal(opts.credentials,'same-origin');if(scenario==='retry'&&!failed){failed=true;throw Error('Synthetic connection loss');}decision={...decision,[input.flag]:{value:input.value,revision:input.expectedRevision+1,operationId:input.operationId}};return {ok:true,status:200,json:async()=>({key:'c3ludGhldGlj',decision})};}
  return {ok:true,status:200,json:async()=>({accounts:[{username:'synthetic',full_name:'Synthetic fixture'}],entries:{},initialPage:1})};
 }
 const client=compile('src/lib/instafollows/client.ts',{});
 const page=compile('src/pages/instafollows.tsx',{react:React,'react/jsx-runtime':require('react/jsx-runtime'),'next/head':({children})=>null,'../styles/instafollows.module.css':{},'../lib/instafollows/client':client}).default;
 const root=require('react-dom/client').createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}});
 await act(async()=>root.render(React.createElement(page)));
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
 await act(async()=>button('Reviewed').click());
 if(scenario==='unavailable'){assert.equal(calls.length,0);assert.match(document.querySelector('[role=alert]').textContent,/Saving is unavailable/);assert.equal(button('Reviewed').disabled,false);assert.equal(button('Reviewed').getAttribute('aria-pressed'),'false');return;}
 if(scenario==='retry'){assert.equal(button('Reviewed').getAttribute('aria-pressed'),'false');assert.match(document.querySelector('[role=alert]').textContent,/Synthetic connection loss/);await act(async()=>button('Retry save').click());assert.equal(calls[0].operationId,calls[1].operationId);}
 assert.match(calls[0].operationId,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 assert.equal(button('Reviewed').getAttribute('aria-pressed'),'true');assert.equal(button('Don’t unfollow').getAttribute('aria-pressed'),'false');assert.match(document.body.textContent,/Saved\./);
 if(scenario==='fallback-save-undo'){await act(async()=>button('↶ Undo').click());assert.equal(button('Reviewed').getAttribute('aria-pressed'),'false');assert.equal(calls[1].expectedRevision,1);assert.notEqual(calls[0].operationId,calls[1].operationId);}
});
