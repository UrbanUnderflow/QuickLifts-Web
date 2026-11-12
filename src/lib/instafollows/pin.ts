import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import type {firestore} from 'firebase-admin';
import type {NextApiRequest,NextApiResponse} from 'next';
import {ROOT_COLLECTION,ROOT_DOCUMENT,ReviewError} from './model';
export const SESSION_MS=8*60*60*1000;
export const COOKIE='__Host-instafollows';
const root=(db:firestore.Firestore)=>db.collection(ROOT_COLLECTION).doc(ROOT_DOCUMENT);
export type PinConfig={version:1;salt:string;verifier:string;sessionSecret:string;enabled:true};
const hex=(v:unknown,n:number):v is string=>typeof v==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(v);
export function validateConfig(v:any):PinConfig{
 if(v?.version!==1||v.enabled!==true||!hex(v.salt,32)||!hex(v.verifier,128)||!hex(v.sessionSecret,64))throw new ReviewError(503,'Unlock is not configured.');
 return v;
}
async function derive(pin:string,salt:string):Promise<Buffer>{return new Promise((resolve,reject)=>scryptCallback(pin,Uint8Array.from(Buffer.from(salt,'hex')),64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(e,key)=>e?reject(e):resolve(key)));}
export async function createPinConfig(pin:string):Promise<PinConfig>{
 if(!/^\d{6}$/.test(pin))throw new ReviewError(400,'Enter six digits.');
 const salt=randomBytes(16).toString('hex');return {version:1,enabled:true,salt,verifier:(await derive(pin,salt)).toString('hex'),sessionSecret:randomBytes(32).toString('hex')};
}
export async function verifyPin(pin:unknown,config:PinConfig){return typeof pin==='string'&&/^\d{6}$/.test(pin)&&timingSafeEqual(Uint8Array.from(await derive(pin,config.salt)),Uint8Array.from(Buffer.from(config.verifier,'hex')));}
const digest=(value:string,config:PinConfig)=>createHmac('sha256',Uint8Array.from(Buffer.from(config.sessionSecret,'hex'))).update(value).digest('hex');
export const sessionId=(token:string,config:PinConfig)=>digest('session:'+token,config);
export function readToken(req:NextApiRequest):string|undefined{
 const values=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));
 if(values.length!==1)return;const token=values[0].slice(COOKIE.length+1);return /^[A-Za-z0-9_-]{43}$/.test(token)?token:undefined;
}
export function assertRequest(req:NextApiRequest){
 if(req.headers['x-instafollows-request']!=='1'||req.headers['sec-fetch-site']==='cross-site')throw new ReviewError(403,'Use the review dashboard.');
 if(req.method!=='GET'&&(req.headers.origin!=='https://fitwithpulse.ai'||!/^application\/json(?:;|$)/i.test(String(req.headers['content-type']||''))))throw new ReviewError(403,'Use the review dashboard.');
}
export async function loadConfig(db:firestore.Firestore){return validateConfig((await root(db).collection('security').doc('pin').get()).data());}
export async function reserveAttempt(db:firestore.Firestore,config:PinConfig,req:NextApiRequest,now=Date.now()){
 // Only Netlify's connection header is considered; the global caps always apply.
 const header=req.headers['x-nf-client-connection-ip'];const client=typeof header==='string'&&isIP(header)?header:'unknown';
 const policies=[{key:'global-hour',ms:3600000,max:15},{key:'global-day',ms:86400000,max:60},{key:'client-'+(parseInt(digest(client,config).slice(0,2),16)%64),ms:900000,max:5}];
 await db.runTransaction(async tx=>{
  const refs=policies.map(p=>root(db).collection('pin-limits').doc(p.key)),snaps=await Promise.all(refs.map(r=>tx.get(r)));
  const rows=policies.map((p,i)=>{const start=Math.floor(now/p.ms)*p.ms,old=snaps[i].data();return {start,count:old?.start===start?Number(old.count):0};});
  if(rows.some((r,i)=>!Number.isFinite(r.count)||r.count>=policies[i].max))throw new ReviewError(429,'Too many unlock attempts. Try again later.');
  rows.forEach((r,i)=>tx.set(refs[i],{start:r.start,count:r.count+1}));
 });
}
export async function requireSession(db:firestore.Firestore,req:NextApiRequest,now=Date.now()){
 assertRequest(req);const config=await loadConfig(db),token=readToken(req);if(!token)throw new ReviewError(401,'Unlock to continue.');
 const session=(await root(db).collection('pin-sessions').doc(sessionId(token,config).slice(0,3)).get()).data();
 if(!session||session.digest!==sessionId(token,config)||session.revoked===true||!Number.isFinite(session.expiresAt)||session.expiresAt<=now||session.createdAt>now||session.expiresAt-session.createdAt!==SESSION_MS)throw new ReviewError(401,'Unlock to continue.');
 return {config,token,expiresAt:session.expiresAt};
}
export const cookieValue=(token:string,maxAge=SESSION_MS/1000)=>`${COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
export async function productionDb(){const {getFirebaseAdminApp}=await import('../firebase-admin');return getFirebaseAdminApp(false).firestore();}
export function pinHandler(getDb=productionDb,now=Date.now){return async(req:NextApiRequest,res:NextApiResponse)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST','DELETE'].includes(req.method||'')){res.setHeader('Allow','GET, POST, DELETE');return res.status(405).end();}
 try{
  assertRequest(req);const db=await getDb();
  if(req.method==='GET'){const session=await requireSession(db,req,now());return res.json({unlocked:true,expiresAt:session.expiresAt});}
  if(req.method==='DELETE'){
   const {config,token}=await requireSession(db,req,now());await root(db).collection('pin-sessions').doc(sessionId(token,config).slice(0,3)).set({revoked:true},{merge:true});res.setHeader('Set-Cookie',cookieValue('',0));return res.json({unlocked:false});
  }
  const config=await loadConfig(db);await reserveAttempt(db,config,req,now());
  if(!await verifyPin(req.body?.pin,config))throw new ReviewError(401,'Unable to unlock.');
  const token=randomBytes(32).toString('base64url'),createdAt=now();
  await root(db).collection('pin-sessions').doc(sessionId(token,config).slice(0,3)).set({digest:sessionId(token,config),createdAt,expiresAt:createdAt+SESSION_MS,revoked:false});
  res.setHeader('Set-Cookie',cookieValue(token));return res.json({unlocked:true,expiresAt:createdAt+SESSION_MS});
 }catch(e){if(e instanceof ReviewError&&e.status===429)res.setHeader('Retry-After','900');return res.status(e instanceof ReviewError?e.status:503).json({error:e instanceof ReviewError?e.message:'Unlock is unavailable. Try again later.'});}
};}
