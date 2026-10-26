import { scenarioArchetypeForSport } from '../../api/firebase/mentaltraining/sportScenarioArchetypes';
import {
  MENTAL_SKILL_FAMILIES, MENTAL_SKILL_FAMILIARITY_LEVELS,
  createSelfReportStartingProfile, isSelfReportStartingProfile,
} from '../../api/firebase/mentaltraining/mentalSkillsBaseline';

const legacySteps = ['intro', 'state', 'tools', 'belief', 'reflection', 'body', 'breath', 'visualization', 'attention', 'emotion', 'coherence', 'result'];
const steps = ['tools', 'result'];
const assessmentKind = 'self_report_starting_profile' as const;

/** Accept unfinished v1 drafts without carrying their authored challenge scores forward. */
export function validateSkillsDraft(input: any, complete = false, _sportName = 'Sport') {
  const legacy = input?.version === 1;
  if (!input || (!legacy && (input.version !== 2 || input.assessmentKind !== assessmentKind))
      || !(legacy ? legacySteps : steps).includes(input.step)) throw Error('Invalid starting profile step.');
  const familiarity: any = {};
  for (const family of MENTAL_SKILL_FAMILIES) {
    const value = input.familiarity?.[family];
    if (!MENTAL_SKILL_FAMILIARITY_LEVELS.some(level => level.id === value)) throw Error('Invalid familiarity.');
    familiarity[family] = value;
  }
  const answeredFamiliarity = legacy
    ? MENTAL_SKILL_FAMILIES.filter(family => familiarity[family] !== 'new_to_me')
    : input.answeredFamiliarity ?? [];
  if (!Array.isArray(answeredFamiliarity) || new Set(answeredFamiliarity).size !== answeredFamiliarity.length
      || answeredFamiliarity.some((family: any) => !MENTAL_SKILL_FAMILIES.includes(family))) throw Error('Invalid answered familiarity fields.');
  return {
    version: 2 as const, assessmentKind, answeredFamiliarity,
    step: complete || input.step === 'result' ? 'result' : 'tools',
    familiarity,
  };
}

export function skillsResult(draft: ReturnType<typeof validateSkillsDraft>, sportName = 'Sport') {
  return createSelfReportStartingProfile({
    source: 'consolidated-athlete-baseline', sportName,
    sportArchetype: scenarioArchetypeForSport(sportName),
    familiarity: draft.familiarity, answeredFamiliarity: draft.answeredFamiliarity,
  });
}

/** Historical competency records remain complete; new records explicitly describe self-report. */
export function completedStartingProfile(value: any): boolean {
  return value?.version === 5 || isSelfReportStartingProfile(value);
}

export async function saveSkills(db: any, ref: any, input: any, uid: string, complete: boolean, sportName = 'Sport', allowReviewEdits = false) {
  const draft = validateSkillsDraft(input.draft, complete, sportName);
  if (!Number.isInteger(input.revision) || input.revision < 0) throw Error('Invalid revision.');
  return db.runTransaction(async (tx: any) => {
    const previous = (await tx.get(ref)).data();
    if (!allowReviewEdits && previous?.completed && isSelfReportStartingProfile(previous.result)) return previous;
    // A v1 draft may have saved its old result before the canonical write failed.
    // Retry from its stored self-report values, preserving answers while dropping old score claims.
    const migratingCompletedDraft = previous?.completed === true && previous?.draft?.version === 1;
    const savedDraft = migratingCompletedDraft ? validateSkillsDraft(previous.draft, true, sportName) : draft;
    if (!migratingCompletedDraft) {
      if (previous?.revision === input.revision + 1 && JSON.stringify(previous.draft) === JSON.stringify(draft)) return previous;
      if ((previous?.revision || 0) !== input.revision) throw Error('Starting profile changed in another tab. Reopen to continue.');
    }
    const isComplete = complete || migratingCompletedDraft;
    const value = {
      ownerUid: uid, version: 2, assessmentKind, revision: (previous?.revision || 0) + 1,
      draft: savedDraft, completed: isComplete,
      ...(isComplete ? {result: skillsResult(savedDraft, sportName)} : {}), updatedAt: new Date().toISOString(),
    };
    const safe = JSON.parse(JSON.stringify(value));
    tx.set(ref, safe);
    return safe;
  });
}
