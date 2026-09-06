import { getFirebaseAdminApp } from '../firebase-admin';
import { createSyntheticFirebaseIdToken } from './syntheticFirebaseAuth';
let cached: { token: string; until: number } | undefined;
// Model bridge authentication only. Never return this credential to the browser.
export async function localModelAuthorization() {
 if(process.env.NODE_ENV!=='development'||process.env.NORA_LOCAL_TESTING!=='true')throw new Error('Local model access unavailable');
 if(cached && cached.until>Date.now())return `Bearer ${cached.token}`;
 const token=await createSyntheticFirebaseIdToken({app:getFirebaseAdminApp(false),uid:'nora-red-team-scheduled-runner',email:'nora-red-team-scheduled@redteam.invalid',apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',claims:{noraRedTeamSynthetic:true,noraRedTeamScheduled:true,role:'internal_red_team_runner'}});
 cached={token,until:Date.now()+45*60*1000};return `Bearer ${token}`;
}
