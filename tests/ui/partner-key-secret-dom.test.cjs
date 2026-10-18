const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react'),{JSDOM}=require('jsdom');
test('secret stays masked until requested; copy retrieves full secret without revealing; hide and page exit clear it',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'}), prior={};
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){prior[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 let copied='', calls=0, fail=false;Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{if(fail)throw Error('denied');copied=value;}}});
 const module={exports:{}},source=ts.transpileModule(fs.readFileSync('src/components/developer/PartnerKeySecret.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',source)(name=>name==='react'?React:name==='lucide-react'?require(name):{},module,module.exports);
 const root=require('react-dom/client').createRoot(document.getElementById('root')),secret='synthetic-full-secret';
 const click=async label=>React.act(async()=>document.querySelector(`[aria-label="${label}"]`).click());
 try{
 await React.act(async()=>root.render(React.createElement(module.exports.default,{keyId:'synthetic-id',request:async body=>{assert.deepEqual(body,{action:'reveal',keyId:'synthetic-id'});calls++;return {secret};}})));
 assert.equal(calls,0);assert.equal(document.body.textContent.includes(secret),false);
 await click('Copy API secret');assert.equal(copied,secret);assert.equal(document.body.textContent.includes(secret),false);assert.match(document.body.textContent,/Copied/);
 await click('Reveal API secret');assert.equal(document.querySelector('code').textContent,secret);
 await click('Hide API secret');assert.equal(document.body.textContent.includes(secret),false);
 fail=true;await click('Copy API secret');assert.match(document.querySelector('[role="alert"]').textContent,/Could not copy/);
 await click('Reveal API secret');await React.act(async()=>window.dispatchEvent(new window.Event('pagehide')));assert.equal(document.body.textContent.includes(secret),false);
 }finally{await React.act(async()=>root.unmount());dom.window.close();for(const [key,descriptor] of Object.entries(prior)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
