/** Uses existing runtime credentials. Dry run is default; --apply writes only missing/stale weekly reports. */
import { getFirebaseAdminApp } from '../src/lib/firebase-admin';
import { latestReportEnd,generateWeeklyInsight } from '../src/lib/coach-dashboard/insightService';
import { loadTeamAccess } from '../src/lib/coach-dashboard/access';
const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
async function main(){
 const teamId=arg('team'),uid=arg('viewer'),start=arg('start');if(!teamId||!uid||!start)throw Error('Supply team, viewer, start date.');
 const db=getFirebaseAdminApp().firestore();const {team,access}=await loadTeamAccess(db,uid,teamId);
 if(!access.participation||!access.wellbeing)throw Error('Backfill viewer must have team participation and trainer access.');
 const date=new Date(`${start}T00:00:00Z`);if(!Number.isFinite(date.getTime()))throw Error('Invalid start date');date.setUTCDate(date.getUTCDate()+((7-date.getUTCDay())%7));
 const ends:string[]=[];for(;date.toISOString().slice(0,10)<=latestReportEnd();date.setUTCDate(date.getUTCDate()+7))ends.push(date.toISOString().slice(0,10));
 if(ends.length>104)throw Error('Backfill exceeds two years.');
 console.log(JSON.stringify({team:team.displayName,weeks:ends,roles:['coach','trainer'],apply:process.argv.includes('--apply')}));
 if(!process.argv.includes('--apply'))return;
 for(const to of ends)for(const role of ['coach','trainer'] as const){const report=await generateWeeklyInsight(db,uid,teamId,role,to);console.log(JSON.stringify({week:to,role,mode:report.mode,facts:report.facts.length,insights:report.insights.length}));}
}
main().catch(e=>{console.error('Backfill stopped:',e.message);process.exitCode=1;});
