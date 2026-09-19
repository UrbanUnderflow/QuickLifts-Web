// Server-owned administrative values. Missing history is never inferred as zero.
export const DERIVED_QUESTION_IDS = [5,6,7,8,11].map(n => `cau-operational-${String(n).padStart(2,'0')}`);
export const REMOVED_QUESTION_IDS = Array.from({length:11},(_,i)=>`cau-operational-${50+i}`);
export const isRemovedQuestion = (id: string) => REMOVED_QUESTION_IDS.includes(id);
export const isDerivedQuestion = (id: string) => DERIVED_QUESTION_IDS.includes(id);
export async function deriveAdministrativeAnswers(db: any, uid: string, now = new Date()) {
  const observedAt = now.toISOString();
  const date = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const answers: Record<string,string> = {'cau-operational-05':date,'cau-operational-07':'Not sure','cau-operational-08':'Not sure','cau-operational-11':'Not sure'};
  const provenance: Record<string,any> = {
    'cau-operational-05':{source:'server_submission_time',observedAt,timeZone:'America/New_York'},
    'cau-operational-06':{source:'unavailable',reason:'First access across both platforms is not verified'},
    'cau-operational-07':{source:'unavailable',reason:'Cross-platform prior usage is not verified'},
    'cau-operational-08':{source:'unavailable',reason:'Combined platform check-in total is not verified'},
    'cau-operational-11':{source:'unavailable',reason:'Current season not recorded'},
  };
  try {
    const profile = (await db.collection('users').doc(uid).get()).data();
    const phase = String(profile?.seasonPhase || '').toLowerCase().replace(/[^a-z]/g,'');
    const mapped: Record<string,string> = {preseason:'Preseason',inseason:'In season',postseason:'Postseason',offseason:'Off-season'};
    if (mapped[phase]) { answers['cau-operational-11']=mapped[phase]; provenance['cau-operational-11']={source:'users.seasonPhase',observedAt,currency:'last_saved_profile_value'}; }
  } catch { /* Preserve an explicit unknown if profile lookup is unavailable. */ }
  let pulseCheckCheckInsBeforeToday: number | null = null;
  try {
    const count = await db.collection('mental-check-ins').doc(uid).collection('check-ins').where('sourceDate','<',date).count().get();
    pulseCheckCheckInsBeforeToday = count.data().count;
  } catch { /* An unavailable count is not a zero. */ }
  return {answers, metadata:{version:1,submittedAt:observedAt,provenance,pulseCheckCheckInsBeforeToday,checkInScope:'mental-check-ins/check-ins with sourceDate before submission day; auntEDNA history excluded'}};
}
export function applyAdministrativeAnswers(input: any, derived: Awaited<ReturnType<typeof deriveAdministrativeAnswers>>) {
  return {...input,answers:{...Object.fromEntries(Object.entries(input.answers || {}).filter(([id])=>!isDerivedQuestion(id) && !isRemovedQuestion(id))),...derived.answers},administrativeMetadata:derived.metadata};
}
