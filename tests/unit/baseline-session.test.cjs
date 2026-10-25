const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,f);
let issued=[],modes=[];
const admin={auth:()=>({verifyIdToken:async(token,checkRevoked)=>{assert.equal(checkRevoked,true);if(token!=='valid')throw Error('invalid');return {uid:'signed-in-athlete'};},createCustomToken:async uid=>{issued.push(uid);return 'synthetic-token';}})};
const filename=path.resolve('src/lib/firebase-admin.ts');require.cache[filename]={id:filename,filename,loaded:true,exports:{__esModule:true,default:admin,getFirebaseAdminApp:dev=>{modes.push(dev);return {};}}};
const handler=require(path.resolve('src/pages/api/pulsecheck/baseline-session.ts')).default;
async function call(method,token,body={},mode='prod'){const value={status:200};await handler({method,headers:{authorization:token?'Bearer '+token:undefined,'x-pulsecheck-firebase-mode':mode},body},{setHeader(){},status(n){value.status=n;return this;},json(data){value.body=data;return this;},end(){return this;}});return value;}
test('embedded sign-in only mints the authenticated account, never a caller-supplied UID',async()=>{issued=[];const result=await call('POST','valid',{userID:'another-athlete'});assert.equal(result.body.userID,'signed-in-athlete');assert.deepEqual(issued,['signed-in-athlete']);});
test('missing, invalid, and revoked credentials cannot mint sessions',async()=>{issued=[];assert.equal((await call('POST')).status,401);assert.equal((await call('POST','revoked')).status,401);assert.deepEqual(issued,[]);});
test('embedded sessions preserve the Firebase environment and reject GET',async()=>{modes=[];assert.equal((await call('GET','valid')).status,405);await call('POST','valid',{},'dev');await call('POST','valid');assert.deepEqual(modes,[true,false]);});
