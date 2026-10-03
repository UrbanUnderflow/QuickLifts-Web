import { hasMorningCheckIn, hasEveningCheckIn } from '../../../netlify/functions/utils/teamShowingUpScore';
import { scheduledParticipationDates, coverageForDays, loadCurrentLinearSkill, loadWearableParticipation, loadWearableLifecycle, normalizeWearableFamily } from './participationSources';
import type { firestore } from 'firebase-admin';
import { activeRecord, DashboardAccessError, loadTeamAccess, validTeamId, visibleAthlete } from './access';
import { trainerSharingChoices, TRAINER_SHARING_FIELDS, type CoverageMetric, type TeamParticipation, type TeamWellbeing, type WellbeingCard } from './types';
const DAY = 86400000;
export const MIN_CONTRIBUTORS = 5;
const deviceFamilies = new Set(['oura', 'apple_health', 'healthkit', 'health_kit', 'apple_watch', 'healthconnect', 'google_health', 'polar', 'fitbit', 'whoop', 'garmin']);
const metric = (completed: number, expected: number | null, reason?: string): CoverageMetric => ({ completed, expected, rate: expected && expected > 0 ? Math.round(completed / expected * 100) : null, status: expected == null ? 'unavailable' : 'available', ...(reason ? { reason } : {}) });
const boundedText = (v: unknown, fallback: string) => typeof v === 'string' && v.trim() ? v.trim().slice(0, 160) : fallback;
export function sharingAllows(grant: Record<string, any> | undefined, uid: string, teamId: string, field: string) {
  return TRAINER_SHARING_FIELDS.includes(field as any) && trainerSharingChoices(grant, uid, teamId)[field as keyof ReturnType<typeof trainerSharingChoices>];
}
export function aggregateCard(rows: Array<Record<string, number>>, eligible: number, source: string, asOf: string, units: Record<string, string>): WellbeingCard {
  const contributors = rows.length;
  // Do not disclose a small cohort's count or values, including through zero/one deltas.
  if (contributors < MIN_CONTRIBUTORS) return { status: contributors ? 'insufficient_responses' : 'unavailable', reason: 'Not enough shared data yet. This summary appears when at least five athletes have contributed.', contributors: 0, eligible, source, asOf, values: [] };
  const values = Object.keys(units).flatMap(label => { const samples = rows.map(r => r[label]).filter(Number.isFinite); return samples.length >= MIN_CONTRIBUTORS ? [{ label, value: Math.round(samples.reduce((a,b) => a+b,0) / samples.length * 10)/10, unit: units[label] }] : []; });
  return { status: values.length ? 'available' : 'insufficient_responses', contributors, eligible, source, asOf, values };
}
export async function loadDashboard(db: firestore.Firestore, uid: string, teamId: string, view: 'participation' | 'wellbeing', now = Date.now()): Promise<TeamParticipation | TeamWellbeing> {
  const { membership, team, access } = await loadTeamAccess(db, uid, teamId);
  if (!(view === 'wellbeing' ? access.wellbeing : access.participation)) throw new DashboardAccessError(403, view === 'wellbeing' ? 'An explicit athletic trainer permission is required.' : 'Team participation access is required.');
  // Fixed seven completed UTC dates prevent caller-controlled windows / differencing queries.
  const to = new Date(now - DAY).toISOString().slice(0,10); const from = new Date(now - DAY * 7).toISOString().slice(0,10);
  const dates = Array.from({length:7}, (_,i) => new Date(Date.parse(`${from}T00:00:00Z`) + i*DAY).toISOString().slice(0,10));
  const roster = await db.collection('pulsecheck-team-memberships').where('teamId','==',teamId).get();
  const athletes = roster.docs.map(d => d.data()).filter(d => d.role === 'athlete' && d.organizationId === team.organizationId && activeRecord(d) && validTeamId(d.userId) && visibleAthlete(membership,d.userId));
  if (athletes.length > 250) throw new DashboardAccessError(503, 'This team needs a paginated dashboard before it can be displayed.');
  // Assigned-only access cannot request team aggregates (small-cohort differencing).
  if (view === 'wellbeing' && membership.rosterVisibilityScope !== 'team' && membership.rosterVisibilityScope != null) throw new DashboardAccessError(403, 'Team-wide trainer scope is required for aggregate wellbeing.');
  const asOf = new Date(now).toISOString();
  const daily = dates.map(date => ({date,checkIns:0,skillTraining:0,wearables:0}));
  const moodRows: Record<string,number>[] = [], recoveryRows: Record<string,number>[] = [], wearableRows: Record<string,number>[] = [], journalRows: Record<string,number>[] = [];
  const result = [];
  // Bound concurrent reads rather than fan out entire large rosters.
  for (let offset=0; offset<athletes.length; offset+=10) {
    const batch = await Promise.all(athletes.slice(offset,offset+10).map(async member => {
      const athleteId = member.userId;
      if (view === 'wellbeing') {
        const grant = (await db.collection('pulsecheck-trainer-sharing').doc(`${teamId}_${athleteId}`).get()).data();
        if (sharingAllows(grant,athleteId,teamId,'mood') || sharingAllows(grant,athleteId,teamId,'recovery')) {
          const checkins = await db.collection('mental-check-ins').doc(athleteId).collection('check-ins').where('date','>=',from).where('date','<=',to).select('date','moodWord','energyLevel','sleepQuality','subjectiveRecoveryScore').get();
          const perDay = new Map<string,Record<string,any>>(); for (const doc of checkins.docs) perDay.set(doc.data().date,doc.data());
          const canonical = await db.getAll(...dates.map(date => db.collection('pulsecheck-morning-checkins').doc(`${athleteId}_${date}`)));
          canonical.forEach((doc,index) => { const d=doc.data(); if(!d) return; const existing=perDay.get(dates[index])||{}; perDay.set(dates[index],{...existing,subjectiveRecoveryScore:d.subjectiveRecoveryLevel??existing.subjectiveRecoveryScore}); });
          const values = [...perDay.values()];
          // Only explicitly reported moodWord. Canonical level is readiness, not mood.
          const moodScores: Record<string,number> = { tough:1,drained:1,heavy:2,low:2,okay:3,ok:3,good:4,solid:4,great:5,locked:5 };
          const moods = values.map(d => moodScores[String(d.moodWord || '').trim().toLowerCase()]).filter(Number.isFinite);
          if (sharingAllows(grant,athleteId,teamId,'mood') && moods.length) moodRows.push({'Reported mood':moods.reduce((a,b)=>a+b,0)/moods.length});
          if (sharingAllows(grant,athleteId,teamId,'recovery')) {
            const row: Record<string,number> = {};
            for (const [field,label] of [['sleepQuality','Sleep quality'],['energyLevel','Energy'],['subjectiveRecoveryScore','Reported recovery']] as const) { const n = values.map(d=>d[field]).filter(v=>typeof v==='number' && v>=1 && v<=5); if(n.length) row[label]=n.reduce((a,b)=>a+b,0)/n.length; }
            if(Object.keys(row).length) recoveryRows.push(row);
          }
        }
        if (sharingAllows(grant,athleteId,teamId,'wearables')) {
          const lifecycle = await loadWearableLifecycle(db,athleteId,teamId,team.organizationId);
          const records = await db.collection('health-context-source-records').where('athleteUserId','==',athleteId).where('status','==','active').where('observedAt','>=',Date.parse(`${from}T00:00:00Z`)/1000).where('observedAt','<',Date.parse(`${to}T00:00:00Z`)/1000+86400).orderBy('observedAt','desc').select('observedAt','status','sourceFamily','payload','provenance').get();
          const rows = records.docs.map(d=>d.data()).filter(d=>d.status==='active' && deviceFamilies.has(d.sourceFamily) && lifecycle.allowed.has(normalizeWearableFamily(d.sourceFamily)) && d.provenance?.mode === 'direct' && d.observedAt>=Date.parse(`${from}T00:00:00Z`)/1000 && d.observedAt<Date.parse(`${to}T00:00:00Z`)/1000+86400);
          const row:Record<string,number>={};
          for(const [label,min,max] of [['Sleep duration',0,24],['Resting heart rate',25,220]] as const) {
            const vals=rows.map(d=>{const p=d.payload||{};const first=(keys:string[])=>keys.map(k=>p[k]).find(v=>typeof v==='number'&&Number.isFinite(v)&&v>0);return label==='Sleep duration' ? first(['sleepDuration','sleepDurationHours','totalSleepHours']) ?? ((first(['totalSleepMin','totalSleepMinutes','sleepDurationMinutes'])??NaN)/60) : first(['restingHeartRate','heartRateResting']);}).filter(v=>typeof v==='number'&&v>min&&v<=max);
            if(vals.length) row[label]=vals.reduce((a,b)=>a+b,0)/vals.length;
          }
          if(Object.keys(row).length) wearableRows.push(row);
        }
        if (sharingAllows(grant,athleteId,teamId,'journaling')) {
          const entries = await db.collection('pulsecheck-evidence-journals').doc(athleteId).collection('entries').where('createdAt','>=',Date.parse(`${from}T00:00:00Z`)).where('createdAt','<',Date.parse(`${to}T00:00:00Z`)+DAY).select('createdAt').get();
          journalRows.push({'Entries per sharing athlete':entries.size});
        }
        return null;
      }
      const [user, checkins, canonical, state, assignments] = await Promise.all([
        db.collection('users').doc(athleteId).get(),
        db.collection('mental-check-ins').doc(athleteId).collection('check-ins').where('date','>=',from).where('date','<=',to).select('date').get(),
        db.getAll(...dates.map(d=>db.collection('pulsecheck-morning-checkins').doc(`${athleteId}_${d}`))),
        db.collection('pulsecheck-linear-curriculum').doc('states').collection('items').doc(athleteId).get(),
        db.collection('pulsecheck-daily-assignments').where('athleteId','==',athleteId).select('sourceDate','status','teamId','moduleTitle','exerciseTitle','exerciseId','simId','actionType').get(),
      ]);
      const checkDays=new Set(checkins.docs.map(d=>d.data().date)); canonical.forEach((d,i)=>{if(d.exists && (hasMorningCheckIn(d.data()) || hasEveningCheckIn(d.data())))checkDays.add(dates[i]);});
      const stateData=state.data(); let currentSkill=null; let assigned:any[]=[];
      if(stateData?.optedIn===true && stateData.athleteId===athleteId) {
        currentSkill=await loadCurrentLinearSkill(db,athleteId,stateData);
        const history=await state.ref.collection('assignments').where('sourceDate','>=',from).where('sourceDate','<=',to).select('sourceDate','completedAt','phase','skillId','skillName').get();
        assigned=history.docs.map(d=>d.data());
      } else assigned=assignments.docs.map(d=>d.data()).filter(d=>d.teamId===teamId && dates.includes(d.sourceDate) && !['cancelled','superseded','deferred'].includes(d.status));
      const completed=assigned.filter(d=>d.completedAt || d.status==='completed');
      dates.forEach((d,i)=>{if(checkDays.has(d))daily[i].checkIns++;if(completed.some(a=>a.sourceDate===d))daily[i].skillTraining++;});
      const u=user.data()||{};
      const expectedDates=scheduledParticipationDates(dates,u,member);
      const wearable=await loadWearableParticipation(db,athleteId,teamId,team.organizationId,expectedDates);
      dates.forEach((d,i)=>{if(wearable.days.has(d))daily[i].wearables++;});
      const image=u.profileImage?.profileImageURL||u.profileImageUrl;
      return {id:athleteId,displayName:boundedText(u.displayName||u.username,'Athlete'),avatarUrl:typeof image==='string'&&image.startsWith('https://')?image:null,checkIns:coverageForDays(checkDays,expectedDates),skillTraining:metric(completed.length,assigned.length),wearables:wearable.metric,currentSkill};
    }));
    result.push(...batch.filter((r):r is NonNullable<typeof r>=>r!==null));
  }
  if(view==='wellbeing') return {teamId,asOf,minimumContributors:MIN_CONTRIBUTORS,mood:aggregateCard(moodRows,athletes.length,'Reported check-ins',asOf,{'Reported mood':'/5'}),recovery:aggregateCard(recoveryRows,athletes.length,'Self-reported check-ins',asOf,{'Sleep quality':'/5','Energy':'/5','Reported recovery':'/5'}),wearables:aggregateCard(wearableRows,athletes.length,'Consented connected wearable records',asOf,{'Sleep duration':'hours','Resting heart rate':'bpm'}),journaling:aggregateCard(journalRows,athletes.length,'Journal activity counts only',asOf,{'Entries per sharing athlete':'entries'})};
  const skills:TeamParticipation['skills']=[]; for(const athlete of result) if(athlete.currentSkill){let group=skills.find(s=>s.id===athlete.currentSkill!.id);if(!group){group={...athlete.currentSkill,athleteCount:0,phases:{}};skills.push(group);}group.athleteCount++;const phase=athlete.currentSkill.phase||'Unknown';group.phases[phase]=(group.phases[phase]||0)+1;}
  return {teamId,asOf,from,to,canViewWellbeing:access.wellbeing,athletes:result,adherence:{checkIns:metric(result.reduce((s,a)=>s+a.checkIns.completed,0),result.reduce((s,a)=>s+(a.checkIns.expected||0),0)),skillTraining:metric(result.reduce((s,a)=>s+a.skillTraining.completed,0),result.reduce((s,a)=>s+(a.skillTraining.expected||0),0)),wearables:metric(result.reduce((s,a)=>s+a.wearables.completed,0),result.some(a=>a.wearables.expected!==null)?result.reduce((s,a)=>s+(a.wearables.expected||0),0):null,'Measured days among verified connected sources; unavailable connections are excluded.')},daily,skills:skills.sort((a,b)=>b.athleteCount-a.athleteCount),limitations:['Seven completed UTC days.','Daily check-in schedule starts at account activation or team joining.','Wearable coverage excludes unavailable and disconnected sources; missing sync remains separate from completion.']};
}
