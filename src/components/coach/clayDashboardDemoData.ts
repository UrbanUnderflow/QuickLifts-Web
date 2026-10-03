/** Illustrative data for the explicitly labeled coach demo only. Never use as a live fallback. */
import type { CoverageMetric, ParticipationAthlete, TeamParticipation, TeamWellbeing, WellbeingCard } from '../../lib/coach-dashboard/types';
const coverage = (completed: number, expected: number): CoverageMetric => ({completed, expected, rate: expected ? Math.round(completed / expected * 100) : null, status: 'available'});
const names = ['Jordan Adams','Morgan Brooks','Taylor Carter','Casey Williams','Riley Davis','Avery Ellis','Cameron Ford','Alex Grant','Jamie Harris','Drew Jackson','Skyler Lee','Reese Martin','Parker Nelson','Quinn Owens','Rowan Parker','Sam Reed','Emerson Scott','Hayden Taylor','Charlie Young','Dakota White','Logan Brown','Finley Green','Kai Wilson','Sage Walker'];
const skills = [{id:'demo-breathing',name:'4-7-8 Relaxation Breathing'},{id:'demo-reset',name:'Next-play reset'},{id:'demo-focus',name:'Focus cues'}];
const athletes:ParticipationAthlete[]=names.map((displayName,i)=>({id:`demo-athlete-${i+1}`,displayName,avatarUrl:null,checkIns:coverage(i%4===0?3:4,4),skillTraining:coverage(i%5===0?2:3,3),wearables:i>19?{completed:0,expected:null,rate:null,status:'not_connected'}:i===19?{completed:0,expected:7,rate:0,status:'sync_pending'}:coverage(i%3===0?5:7,7),currentSkill:{...skills[i<14?0:i<20?1:2],phase:i%3===0?'learn':i%3===1?'practice':'use'}}));
export const demoTeamParticipation:TeamParticipation={
 teamId:'demo-team',asOf:'2026-10-03T15:00:00Z',from:'2026-09-27',to:'2026-10-03',canViewWellbeing:true,athletes,
 adherence:{checkIns:coverage(90,96),skillTraining:coverage(67,72),wearables:coverage(119,140)},
 daily:[{date:'2026-09-27',checkIns:12,skillTraining:8,wearables:16},{date:'2026-09-28',checkIns:14,skillTraining:10,wearables:17},{date:'2026-09-29',checkIns:13,skillTraining:9,wearables:16},{date:'2026-09-30',checkIns:14,skillTraining:11,wearables:18},{date:'2026-10-01',checkIns:12,skillTraining:9,wearables:17},{date:'2026-10-02',checkIns:13,skillTraining:10,wearables:18},{date:'2026-10-03',checkIns:12,skillTraining:10,wearables:17}],
 skills:skills.map(skill=>{const learners=athletes.filter(a=>a.currentSkill?.id===skill.id);return {...skill,phase:null,athleteCount:learners.length,phases:learners.reduce<Record<string,number>>((result,a)=>{const phase=a.currentSkill?.phase||'unknown';result[phase]=(result[phase]||0)+1;return result;},{})};}),
 limitations:['Illustrative sample team data.','Check-ins and skill training are measured against scheduled or assigned activity.','Wearable coverage is measured only for connected athletes.']
};
const card=(source:string,contributors:number,values:WellbeingCard['values']):WellbeingCard=>({status:'available',contributors,eligible:24,source,asOf:'2026-10-03T15:00:00Z',values});
export const demoTeamWellbeing:TeamWellbeing={teamId:'demo-team',asOf:'2026-10-03T15:00:00Z',minimumContributors:5,
 mood:card('Shared athlete check-ins',18,[{label:'Good',value:10,unit:'athletes'},{label:'Okay',value:5,unit:'athletes'},{label:'Heavy',value:3,unit:'athletes'}]),
 recovery:card('Shared self-reported recovery',16,[{label:'Sleep quality',value:3.8,unit:'/ 5'},{label:'Fatigue',value:2.4,unit:'/ 5'},{label:'Soreness',value:2.1,unit:'/ 5'}]),
 wearables:card('Consented connected wearables',14,[{label:'Average sleep',value:7.4,unit:'hours'},{label:'Average resting heart rate',value:58,unit:'bpm'}]),
 journaling:card('Shared journaling activity counts',15,[{label:'Athletes who journaled',value:12,unit:'athletes'},{label:'Entries this week',value:28,unit:'entries'}])
};
