import type {NextApiRequest,NextApiResponse} from 'next';
import {productionDb,requireSession} from './pin';
import type {firestore} from 'firebase-admin';
import {OWNER_UID,ROOT_COLLECTION,ROOT_DOCUMENT,ReviewError,validUsername,accountKey,changeMark} from './model';
export const reviewRoot=(db:firestore.Firestore)=>db.collection(ROOT_COLLECTION).doc(ROOT_DOCUMENT);
export async function authorizeReview(req: NextApiRequest) {
  const db=await productionDb();await requireSession(db,req);return db;
}
export function reviewHandler(authorize=authorizeReview){return async(req:NextApiRequest,res:NextApiResponse)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(!['GET','PATCH'].includes(req.method||'')){res.setHeader('Allow','GET, PATCH');return res.status(405).end();}
  try{
    const db=await authorize(req),root=reviewRoot(db),meta=(await root.get()).data();
    if(meta?.ownerUid!==OWNER_UID||typeof meta.activeDataset!=='string')throw new ReviewError(503,'Your private review is being prepared.');
    const dataset=root.collection('datasets').doc(meta.activeDataset);
    if(req.method==='GET'&&req.query.image!==undefined){
      if(!validUsername(req.query.image))throw new ReviewError(400,'Invalid image.');
      const image=(await dataset.collection('images').doc(accountKey(req.query.image)).get()).data();
      if(!image||!['image/jpeg','image/png','image/webp'].includes(image.contentType)||!Buffer.isBuffer(image.bytes))return res.status(404).end();
      res.setHeader('Content-Type',image.contentType);return res.status(200).send(image.bytes);
    }
    if(req.method==='GET'){
      const [chunks,state]=await Promise.all([dataset.collection('chunks').orderBy('index').get(),root.collection('state').doc('marks').get()]);
      return res.json({accounts:chunks.docs.flatMap(d=>d.data().accounts),entries:state.data()?.entries||{},initialPage:meta.initialPage||4});
    }
    if(req.headers.origin!=='https://fitwithpulse.ai')throw new ReviewError(403,'Use this dashboard to save changes.');
    const input=req.body;if(!validUsername(input?.username))throw new ReviewError(400,'Invalid account.');
    const key=accountKey(input.username),stateRef=root.collection('state').doc('marks');
    const decision=await db.runTransaction(async tx=>{
      const [account,state]=await Promise.all([tx.get(dataset.collection('accounts').doc(key)),tx.get(stateRef)]);
      if(!account.exists)throw new ReviewError(404,'Account not found.');
      const entries=state.data()?.entries||{},next=changeMark(entries[key]||{},input);
      tx.set(stateRef,{entries:{...entries,[key]:next},updatedAt:Date.now()});return next;
    });return res.json({key,decision});
  }catch(e){return res.status(e instanceof ReviewError?e.status:503).json({error:e instanceof ReviewError?e.message:'Private review unavailable. Try again.'});}
};}
