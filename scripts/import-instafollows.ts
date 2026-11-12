/** Run only with authorized production Admin credentials. Inputs remain outside Git.
 * stage <dist-directory> <dataset-id>; reconcile <snapshot-json>; activate <dataset-id>
 * Output is aggregate counts only. Never print records, paths from manifests, or raw errors.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {OWNER_UID,ROOT_COLLECTION,ROOT_DOCUMENT,validateAccounts,parseSnapshot,reconcileSnapshot,accountKey,validUsername,ReviewError} from '../src/lib/instafollows/model';
const require=createRequire(import.meta.url);
const registry=require('../src/lib/server/firebase/app-registry.js');
const [action,input,datasetId]=process.argv.slice(2);
const validDataset=(s:unknown):s is string=>typeof s==='string'&&/^[a-z0-9-]{1,80}$/.test(s);
async function main(){
 const app=registry.getNamedFirebaseAdminApp({mode:'prod',appName:'instagram-review-import',runtime:'netlify-function',allowApplicationDefault:false,failClosed:true});
 try{
  const owner=await app.auth().getUserByEmail('tre@fitwithpulse.ai');if(owner.uid!==OWNER_UID||owner.disabled)throw new ReviewError(403,'Owner verification failed.');
  const db=app.firestore(),root=db.collection(ROOT_COLLECTION).doc(ROOT_DOCUMENT);
  if(action==='stage'){
   if(!validDataset(datasetId))throw new ReviewError(400,'Invalid dataset identifier.');
   const html=await fs.readFile(path.join(input,'index.html'),'utf8'),match=html.match(/<script[^>]*id="accounts"[^>]*>([\s\S]*?)<\/script>/);
   if(!match)throw new ReviewError(400,'Missing account data.');
   const accounts=validateAccounts(JSON.parse(match[1])),manifest=JSON.parse(await fs.readFile(path.join(input,'avatars.json'),'utf8'));
   const known=new Set(accounts.map(a=>a.username.toLowerCase()));
   if(Object.keys(manifest).some(k=>!validUsername(k)||!known.has(k.toLowerCase())))throw new ReviewError(400,'Unexpected avatar account.');
   const dataset=root.collection('datasets').doc(datasetId);if((await dataset.get()).exists)throw new ReviewError(409,'Dataset already exists; use a new staging identifier.');
   // Validate every image before the first write. Restrict to local non-symlink assets.
   const images=[] as {username:string;bytes:Buffer;contentType:string}[];
   const realBase=await fs.realpath(input);
   for(const [username,relative] of Object.entries(manifest)){
    if(typeof relative!=='string'||!/^avatars\/[A-Za-z0-9_.%~-]+\.(jpg|jpeg|png|webp)$/i.test(relative))throw new ReviewError(400,'Invalid avatar path.');
    const file=await fs.realpath(path.join(input,relative));if(!file.startsWith(realBase+path.sep))throw new ReviewError(400,'Avatar outside dataset.');
    const bytes=await fs.readFile(file);if(bytes.length>750000||bytes.length<12)throw new ReviewError(400,'Avatar exceeds private document limit.');
    const contentType=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':'';
    if(!contentType)throw new ReviewError(400,'Invalid avatar format.');images.push({username,bytes,contentType});
   }
   await dataset.set({status:'staging',ownerUid:OWNER_UID,accountCount:accounts.length,photoCount:images.length,createdAt:Date.now()});
   const photographed=new Set(images.map(i=>i.username.toLowerCase()));
   const rows=accounts.map(a=>({...a,hasPhoto:photographed.has(a.username.toLowerCase())}));
   for(let i=0;i<rows.length;i+=400){const batch=db.batch();for(const a of rows.slice(i,i+400))batch.set(dataset.collection('accounts').doc(accountKey(a.username)),a);await batch.commit();}
   for(let i=0;i<rows.length;i+=500)await dataset.collection('chunks').doc(String(i/500).padStart(3,'0')).set({index:i/500,accounts:rows.slice(i,i+500)});
   // Small batches avoid Firestore's request size limit.
   for(let i=0;i<images.length;i+=5){const batch=db.batch();for(const image of images.slice(i,i+5))batch.set(dataset.collection('images').doc(accountKey(image.username)),{bytes:image.bytes,contentType:image.contentType});await batch.commit();}
   const [recordCount,imageCount]=await Promise.all([dataset.collection('accounts').count().get(),dataset.collection('images').count().get()]);
   if(recordCount.data().count!==rows.length||imageCount.data().count!==images.length)throw new ReviewError(409,'Staging count mismatch.');
   await dataset.update({status:'ready'});console.log(JSON.stringify({staged:true,accounts:rows.length,photos:images.length}));
  }else if(action==='reconcile'){
   const snapshot=parseSnapshot(JSON.parse(await fs.readFile(input,'utf8'))),stateRef=root.collection('state').doc('marks'),migrationRef=root.collection('state').doc('migration');
   const result=await db.runTransaction(async(tx:any)=>{const [state,previous]=await Promise.all([tx.get(stateRef),tx.get(migrationRef)]);const old=previous.data()?.snapshot;
    if(old&&JSON.stringify(old)===JSON.stringify(snapshot))return {applied:0,conflicts:0,idempotent:true};
    const result=reconcileSnapshot(state.data()?.entries||{},old,snapshot);
    if(Buffer.byteLength(JSON.stringify(result.entries))>800000)throw new ReviewError(400,'Marks exceed private document limit.');
    tx.set(stateRef,{entries:result.entries,updatedAt:Date.now()});tx.set(migrationRef,{snapshot,appliedAt:Date.now(),conflicts:result.conflicts});return {applied:result.applied,conflicts:result.conflicts,idempotent:false};});
   console.log(JSON.stringify({...result,reviewed:snapshot.reviewed.length,dontUnfollow:snapshot.dontUnfollow.length}));
  }else if(action==='activate'){
   if(!validDataset(input))throw new ReviewError(400,'Invalid dataset identifier.');
   await db.runTransaction(async(tx:any)=>{const [dataset,migration]=await Promise.all([tx.get(root.collection('datasets').doc(input)),tx.get(root.collection('state').doc('migration'))]);if(dataset.data()?.status!=='ready'||dataset.data()?.ownerUid!==OWNER_UID||!migration.exists||migration.data()?.conflicts)throw new ReviewError(409,'Dataset or reconciliation not ready.');tx.set(root,{ownerUid:OWNER_UID,activeDataset:input,initialPage:4,activatedAt:Date.now()},{merge:true});});console.log(JSON.stringify({activated:true}));
  }else throw new ReviewError(400,'Choose stage, reconcile, or activate.');
 }finally{await app.delete();}
}
main().catch(e=>{console.error(JSON.stringify({error:e instanceof ReviewError?e.message:'Private import failed; no raw error retained.'}));process.exitCode=1;});
