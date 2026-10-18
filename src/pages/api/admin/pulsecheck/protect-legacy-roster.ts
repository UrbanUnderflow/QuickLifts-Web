import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../_auth';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
const { protectLegacyRoster } = require('../../../../lib/server/pulsecheck/protectLegacyRoster');
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({error:'POST required.'});
  if (!await requireAdminRequest(req)) return res.status(401).json({error:'Admin authentication required.'});
  try {
    const app=getFirebaseAdminApp(req.headers['x-pulsecheck-firebase-mode']==='dev'||req.headers['x-force-dev-firebase']==='true');
    const actor=await app.auth().verifyIdToken((req.headers.authorization||'').slice(7),true);
    const result=await protectLegacyRoster(app.firestore(),{coachId:req.body?.coachId,organizationId:req.body?.organizationId,actorUid:actor.uid},admin.firestore.FieldValue.serverTimestamp());
    return res.status(200).json(result);
  } catch(error) { return res.status(409).json({error:error instanceof Error?error.message:'Roster protection failed.'}); }
}
