/** Interactive only. Load authorized Firebase Admin credentials separately.
 * Never accept a PIN or session secret in arguments, environment, or a file.
 * This creates security configuration only; it never alters accounts or marks.
 */
import {createRequire} from 'node:module';
import {createPinConfig} from '../src/lib/instafollows/pin';
import {ROOT_COLLECTION,ROOT_DOCUMENT,OWNER_UID} from '../src/lib/instafollows/model';
async function hidden(prompt:string):Promise<string>{
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Interactive terminal required.');
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let value='';const cleanup=()=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};const onData=(chunk:Buffer)=>{for(const c of chunk.toString()){if(c==='\u0003'){cleanup();reject(Error('Canceled.'));return;}if(c==='\r'||c==='\n'){cleanup();resolve(value);return;}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(/\d/.test(c)&&value.length<6)value+=c;}};process.stdin.on('data',onData);});
}
async function main(){
 if(process.argv.length>2)throw Error('No arguments accepted.');
 let pin=await hidden('Enter six-digit review PIN (hidden): '),confirmation=await hidden('Confirm PIN (hidden): ');
 if(pin!==confirmation)throw Error('Confirmation does not match.');const config=await createPinConfig(pin);pin='';confirmation='';
 const require=createRequire(import.meta.url);const registry=require('../src/lib/server/firebase/app-registry.js');
 const app=registry.getNamedFirebaseAdminApp({mode:'prod',appName:'instagram-pin-provisioner',runtime:'netlify-function',allowApplicationDefault:false,failClosed:true});
 try{const owner=await app.auth().getUserByEmail('tre@fitwithpulse.ai');if(owner.uid!==OWNER_UID||owner.disabled)throw Error('Owner check failed.');const ref=app.firestore().collection(ROOT_COLLECTION).doc(ROOT_DOCUMENT).collection('security').doc('pin');await ref.create(config);console.log('PIN access configuration created. No dataset or marks changed.');}finally{await app.delete();}
}
main().catch(()=>{console.error('Provisioning did not complete. No credential details were retained.');process.exitCode=1;});
