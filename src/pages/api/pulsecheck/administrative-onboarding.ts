import type {NextApiRequest,NextApiResponse} from 'next';
import {authorizeDashboardRequest} from '../../../lib/coach-dashboard/auth';
import {validTeamId} from '../../../lib/coach-dashboard/access';
import {administrativeOnboardingState} from '../../../lib/server/pulsecheck/administrativeOnboarding';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','private, no-store');if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}if(!validTeamId(req.query.teamId))return res.status(400).json({error:'Choose a valid team.'});
 let identity;try{identity=await authorizeDashboardRequest(req);}catch{return res.status(401).json({error:'Sign in to check your team setup.'});}
 try{return res.json(await administrativeOnboardingState(identity.db,identity.uid,req.query.teamId));}catch{return res.status(503).json({error:'Your existing setup could not be verified.'});}
}
