const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { act } = React;

test('returning phone login asks only phone, then switches to the text-code screen', async t => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://fixture.invalid/admin?organizationId=irrelevant' });
  const prior = new Map();
  for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})) {
    prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  }
  const sent=[], confirmed=[], successes=[];
  const module = {exports:{}};
  const mocks = {
    react:React,
    '../../api/firebase/config':{getFirebaseModeRequestHeaders:()=>({})},
    '../../api/firebase/auth/phone':{
      normalizeAuthPhone:phone=>'+12025550123', phoneAuthError:e=>e.message,
      createPhoneAuthAttempt:async()=>({send:async number=>sent.push(number),confirm:async(...args)=>{confirmed.push(args);return {uid:'existing'}},dispose:async()=>{}}),
    },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/auth/PhoneSignIn.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{
    module,exports:module.exports,require:name=>mocks[name],window:dom.window,HTMLInputElement:dom.window.HTMLInputElement,Date,Error,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,
    fetch:()=>{throw Error('Login must not request an organization policy')},
  });
  const {createRoot}=require('react-dom/client');
  const root=createRoot(dom.window.document.getElementById('root'));
  t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}});
  await act(async()=>root.render(React.createElement(module.exports.default,{onSuccess:user=>successes.push(user)})));
  assert.equal(dom.window.document.querySelectorAll('input').length,1);
  assert.equal(dom.window.document.querySelector('input').type,'tel');
  let button=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent==='Log in');
  assert.ok(button);
  await act(async()=>button.click());
  assert.equal(sent.length,1);
  assert.equal(dom.window.document.querySelector('input[type=tel]'),null);
  assert.match(dom.window.document.body.textContent,/Enter the code sent via text/);
  const input=dom.window.document.querySelector('input[autocomplete=one-time-code]');
  await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'123456');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  button=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent==='Continue');
  assert.equal(button.disabled,false);
  await act(async()=>button.click());
  assert.deepEqual(confirmed[0].slice(0,3),['123456','',false]);
  assert.equal(confirmed[0][3],undefined);
  assert.equal(successes[0].uid,'existing');
});
