import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../_auth';
import { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
const { changeOrganizationLifecycle, listDeletedOrganizations } = require('../../../../../netlify/functions/lib/organization-lifecycle');
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','POST'].includes(req.method || '')) return res.status(405).json({error:'GET or POST required.'});
  if (!await requireAdminRequest(req)) return res.status(401).json({error:'Admin authentication required.'});
  try {
    const app=getFirebaseAdminApp(req.headers['x-pulsecheck-firebase-mode']==='dev' || req.headers['x-force-dev-firebase']==='true');
    const actor=await app.auth().verifyIdToken((req.headers.authorization || '').slice(7),true), db=app.firestore();
    const email=typeof actor.email==='string'?actor.email.trim():'';
    const records=email?await Promise.all([...new Set([email,email.toLowerCase(),email.toUpperCase()])].map(e=>db.collection('admin').doc(e).get())):[];
    if (!records.some(d=>d.exists) || (await db.collection('account-closure-jobs').doc(actor.uid).get()).exists) return res.status(403).json({error:'Admin access is unavailable.'});
    if(req.method==='GET') return res.status(200).json({organizations:await listDeletedOrganizations(db)});
    const body=req.body || {};
    if(Object.keys(body).some(k=>!['organizationId','action','confirmationName'].includes(k))) throw new Error('Unsupported request field.');
    const result=await changeOrganizationLifecycle({db,...body,actorUid:actor.uid});
    return res.status(200).json({success:true,...result});
  } catch(error) {return res.status(400).json({error:error instanceof Error?error.message:'Unable to update organization.'});}
}
