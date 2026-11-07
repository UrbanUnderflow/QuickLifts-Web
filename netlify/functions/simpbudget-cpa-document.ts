import type { Handler } from '@netlify/functions';
import { createHash } from 'crypto';
import { getSimpBudgetAuth, getSimpBudgetFirestore } from './utils/getSimpBudgetServiceAccount';

const MAX_BYTES = 4 * 1024 * 1024, CHUNK_BYTES = 512 * 1024;
const MAX_YEAR_BYTES = 100 * 1024 * 1024, MAX_FILES = 100;
const TOPICS = new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,19]);
const headers = { 'Content-Type':'application/json', 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' };
const reply = (statusCode:number,body:unknown) => ({statusCode,headers,body:JSON.stringify(body)});
class DocumentError extends Error { constructor(public status:number,message:string){super(message);} }
const digest = (bytes:Buffer) => createHash('sha256').update(bytes).digest('hex');
export function validateCPADocument(input:any){
 if(typeof input.fileName!=='string'||!input.fileName.trim()||input.fileName.length>200||/[\x00-\x1f\x7f/\\]/.test(input.fileName))throw new DocumentError(400,'Invalid document name.');
 if(typeof input.dataBase64!=='string'||!input.dataBase64||input.dataBase64.length>Math.ceil(MAX_BYTES/3)*4)throw new DocumentError(413,'Choose a file up to 4 MB.');
 const bytes=Buffer.from(input.dataBase64,'base64');
 if(!bytes.length||bytes.length>MAX_BYTES||bytes.toString('base64')!==input.dataBase64)throw new DocumentError(400,'Invalid document encoding.');
 const valid=input.mimeType==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':input.mimeType==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):input.mimeType==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:input.mimeType==='image/webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':false;
 if(!valid)throw new DocumentError(400,'Choose a PDF, PNG, JPEG, or WebP document.');
 return {bytes,sha256:digest(bytes)};
}
// This top-level collection is denied to browser clients by the default Firestore rule.
// Only this authenticated API accesses it. No AI, public links, or content logging.
export const handler:Handler=async event=>{
 if(event.httpMethod!=='POST')return reply(405,{error:'Use POST.'});
 const bearer=event.headers.authorization||event.headers.Authorization||'';
 if(!/^Bearer \S+$/.test(bearer))return reply(401,{error:'Sign in to access CPA documents.'});
 let owner:string;
 try{owner=(await(await getSimpBudgetAuth()).verifyIdToken(bearer.slice(7),true)).uid;if(!owner)throw Error();}catch{return reply(401,{error:'Your session has expired. Sign in again.'});}
 try{
  if(!event.body||event.isBase64Encoded||Buffer.byteLength(event.body)>5_650_000)throw new DocumentError(413,'Choose a file up to 4 MB.');
  let input:any;try{input=JSON.parse(event.body);}catch{throw new DocumentError(400,'Invalid request.');}
  if(!input||!['attach','list','read'].includes(input.action))throw new DocumentError(400,'Invalid action.');
  if(!Number.isInteger(input.year)||input.year<2000||input.year>new Date().getUTCFullYear()+1)throw new DocumentError(400,'Invalid tax year.');
  if(input.topicId!==undefined&&!TOPICS.has(input.topicId))throw new DocumentError(400,'Invalid preparation topic.');
  const db=await getSimpBudgetFirestore();
  const year=db.collection('simpbudget-cpa-documents').doc(owner).collection('years').doc(String(input.year));
  const documents=year.collection('documents'),chunks=year.collection('chunks');
  if(input.action==='list'){
   const result=await documents.limit(MAX_FILES+1).get();
   if(result.docs.length>MAX_FILES)throw new DocumentError(500,'Document collection needs review.');
   return reply(200,{documents:result.docs.map(s=>s.data()).filter(d=>input.topicId===undefined||d.topicId===input.topicId).sort((a,b)=>a.attachedAt.localeCompare(b.attachedAt))});
  }
  if(input.action==='read'){
   if(typeof input.documentId!=='string'||!/^\d{1,2}_[a-f0-9]{64}$/.test(input.documentId))throw new DocumentError(400,'Invalid document.');
   const saved=(await documents.doc(input.documentId).get()).data();
   if(!saved)throw new DocumentError(404,'Document not found in this year of your account.');
   if(!Number.isInteger(saved.chunks)||saved.chunks<1||saved.chunks>8||!Number.isInteger(saved.size)||saved.size<1||saved.size>MAX_BYTES)throw new DocumentError(500,'Document is unavailable.');
   const parts=await Promise.all(Array.from({length:saved.chunks},(_,i)=>chunks.doc(`${input.documentId}_${i}`).get()));
   if(parts.some(p=>!p.exists))throw new DocumentError(500,'Document is incomplete.');
   const bytes=Buffer.concat(parts.map(p=>Buffer.from(p.data()!.bytes)));
   if(bytes.length!==saved.size||digest(bytes)!==saved.sha256)throw new DocumentError(500,'Document integrity check failed.');
   return reply(200,{document:saved,dataBase64:bytes.toString('base64')});
  }
  if(!TOPICS.has(input.topicId))throw new DocumentError(400,'Choose a preparation topic.');
  const {bytes,sha256}=validateCPADocument(input),id=`${input.topicId}_${sha256}`;
  const metadata=documents.doc(id),saved={id,year:input.year,topicId:input.topicId,fileName:input.fileName.trim(),mimeType:input.mimeType,size:bytes.length,sha256,chunks:Math.ceil(bytes.length/CHUNK_BYTES),attachedAt:new Date().toISOString()};
  const result=await db.runTransaction(async tx=>{
   const [existing,usage]=await Promise.all([tx.get(metadata),tx.get(year)]);
   if(existing.exists)return existing.data();
   const count=usage.data()?.count??0,totalBytes=usage.data()?.totalBytes??0;
   if(!Number.isInteger(count)||count<0||!Number.isInteger(totalBytes)||totalBytes<0)throw new DocumentError(500,'Document storage needs review.');
   if(count>=MAX_FILES||totalBytes+bytes.length>MAX_YEAR_BYTES)throw new DocumentError(413,'This year has reached its document limit (100 files or 100 MB).');
   tx.set(year,{count:count+1,totalBytes:totalBytes+bytes.length},{merge:true});
   tx.set(metadata,saved);
   for(let i=0;i<saved.chunks;i++)tx.set(chunks.doc(`${id}_${i}`),{bytes:bytes.subarray(i*CHUNK_BYTES,(i+1)*CHUNK_BYTES)});
   return saved;
  });
  return reply(200,{document:result});
 }catch(error){return error instanceof DocumentError?reply(error.status,{error:error.message}):reply(503,{error:'Private document storage is temporarily unavailable. Retry when connected.'});}
};
