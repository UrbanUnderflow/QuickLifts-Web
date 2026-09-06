import type { NextApiRequest, NextApiResponse } from 'next';
import { isLocalTestingRequest, localTestingApp, LOCAL_TESTER_UID } from '../../../../../lib/nora-red-team/localTesting';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST' || !isLocalTestingRequest(req)) return res.status(403).json({error:'Local testing is unavailable.'});
  try {
    const app = localTestingApp();
    try { await app.auth().getUser(LOCAL_TESTER_UID); } catch(e) { if ((e as {code?:string}).code !== 'auth/user-not-found') throw e; await app.auth().createUser({uid:LOCAL_TESTER_UID, displayName:'Synthetic local tester'}); }
    const token = await app.auth().createCustomToken(LOCAL_TESTER_UID,{noraLocalTester:true});
    const exchange = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + encodeURIComponent(process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY || ''), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,returnSecureToken:true})});
    const session=await exchange.json(); if(!exchange.ok || !session.idToken)throw new Error('Token exchange failed');
    res.setHeader('Set-Cookie', `nora-local-session=${session.idToken}; HttpOnly; SameSite=Strict; Path=/api/admin/pulsecheck/nora-red-team; Max-Age=3500`);
    return res.json({projectId:app.options.projectId});
  } catch { return res.status(503).json({error:'Development tester credentials could not be initialized.'}); }
}
