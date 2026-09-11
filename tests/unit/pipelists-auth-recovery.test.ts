import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../src/pages/PipeLists.tsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const handleGoogleSignIn ='), source.indexOf('  const sendMagicLink ='));
const fallback = source.slice(source.indexOf('const shouldRetryGoogleSignInWithRedirect ='), source.indexOf('const defaultDraft ='));
function setup(error?: { code: string }, stall = false) {
  let busy = false, popupCalls = 0, redirectCalls = 0;
  const messages: any[] = [];
  const lock = {current:false};
  const deps = {
    googleSignInInFlightRef:lock, setIsGoogleSignInStarting:(v:boolean)=>{busy=v;}, setAuthMessage:(v:any)=>messages.push(v),
    GoogleAuthProvider:class {setCustomParameters() {}}, shouldUseRedirectSignIn:()=>false,
    simpBudgetAuth:{}, browserPopupRedirectResolver:{},
    signInWithPopup:()=>{popupCalls++;return stall ? new Promise(()=>{}) : error ? Promise.reject(error) : Promise.resolve({user:{email:'test@example.com'}});},
    signInWithRedirect:()=>{redirectCalls++;return Promise.resolve();},
    withTimeout:(promise:Promise<any>, ms:number, message:string)=>stall ? Promise.reject(new Error(message)) : promise,
    isSharedView:false, shareDoc:null, readAuthError:(e:any)=>e.message || e.code, console:{error:()=>{}},
  };
  const run = new Function(...Object.keys(deps),ts.transpile(fallback+handler+'\nreturn handleGoogleSignIn;'))(...Object.values(deps));
  return {run,lock,messages,get busy(){return busy;},get popupCalls(){return popupCalls;},get redirectCalls(){return redirectCalls;}};
}
test('an unresolved provider attempt releases the buttons and shows recovery instructions', async()=>{
 const app=setup(undefined,true);await app.run();assert.equal(app.busy,false);assert.equal(app.lock.current,false);assert.match(app.messages.at(-1).text,/took too long/);
});
test('closed or cancelled popups never launch an unsolicited competing redirect', async()=>{
 for(const code of ['auth/popup-closed-by-user','auth/cancelled-popup-request']){const app=setup({code});await app.run();assert.equal(app.redirectCalls,0);assert.equal(app.busy,false);}
});
test('blocked popups retain redirect fallback',async()=>{const app=setup({code:'auth/popup-blocked'});await app.run();assert.equal(app.redirectCalls,1);assert.equal(app.busy,false);});
test('rapid clicks start a single provider attempt',async()=>{const app=setup();await Promise.all([app.run(),app.run()]);assert.equal(app.popupCalls,1);});
