import { selectLinearSkillTransition, type LinearSkillPin } from './linearSkillTransition';
import { evaluatePhaseProgression, addLocalCalendarDays } from './phaseProgression';
import { LinearCurriculumEntry, validateLinearOrder } from './linearCurriculum';

export type LinearProgressionBasis = 'five_days_in_fourteen' | 'calendar_days' | 'completed_sessions';
export type LinearPhase = 'learn' | 'practice' | 'use_it';
export interface LinearPublicationDraft {
  orderedIds: string[];
  rationales: Record<string, string>;
  audience: { mode: 'explicit_athlete_ids'; confirmed: boolean } | null;
  progressionBasis: LinearProgressionBasis | null;
  /** Required distinct completion days per phase; each phase uses a 14-day window. */
  protocolDays: [number, number, number];
  simulationDays: { practice: number; useIt: number } | null;
  phaseProposal?: unknown;
}
export interface LinearPublishedVersion {
  readonly id: string;
  readonly status: 'reviewed' | 'published';
  readonly publishedAt: string;
  readonly content: Readonly<LinearPublicationDraft>;
  readonly skills: readonly LinearCurriculumEntry[];
  /** Explicit runtime review, never inferred from a human-readable readiness label. */
  readonly runtimeReadySkillIds: readonly string[];
}
export interface LinearEnrollment {
  athleteId: string;
  versionId: string;
  optedIn: true;
  startedOn: string;
  /** Pinned IANA timezone; travel cannot reinterpret prior completion dates. */
  timezone?: string;
  /** Enrollment adds a separate timeline; it never deletes prior assignments or progress. */
  historyPolicy: 'preserve';
}
export interface LinearCompletionEvidence {
  id: string;
  athleteId: string;
  versionId: string;
  skillId: string;
  phase: LinearPhase;
  status: 'completed';
  /** Server-verified completion instant, milliseconds since epoch. */
  completedAt?: number;
}
export type LinearPreviewResult =
  | { kind: 'blocked'; reason: string }
  | { kind: 'review_due'; reason: string }
  | { kind: 'skill_complete'; skillId: string; nextStartedOn: string }
  | { kind: 'assignment'; versionId: string; skillId: string; skillName: string; ordinal: number; phase: LinearPhase; progressionBasis: LinearProgressionBasis; phasePosition: number; phaseLength: number; verifiedCompletions: number; journalWithinUse: true; windowStart: string; windowEnd: string; restartCount: number; phaseCompletedToday: boolean };

export const validateLinearPublication = (draft: LinearPublicationDraft, active: LinearCurriculumEntry[]) => {
  const errors = validateLinearOrder(draft.orderedIds, active);
  if (draft.audience?.mode !== 'explicit_athlete_ids' || draft.audience.confirmed !== true) errors.push('Confirm the explicit opt-in athlete audience before publishing.');
  if (draft.progressionBasis !== 'five_days_in_fourteen') errors.push('Review the selected policy: five distinct completion days within fourteen days for each phase.');
  if (!Array.isArray(draft.protocolDays) || draft.protocolDays.length !== 3 || draft.protocolDays.some(value => value !== 5)) errors.push('Protocol Learn, Practice and Use lengths must remain 5 / 5 / 5 for this prototype.');
  if (active.some(skill => skill.type === 'simulation') && (!draft.simulationDays || draft.simulationDays.practice !== 5 || draft.simulationDays.useIt !== 5)) errors.push('Confirm five completion days per simulation phase; simulation phase settings remain unapproved until reviewed.');
  if (!draft.rationales || Object.entries(draft.rationales).some(([id, note]) => !draft.orderedIds.includes(id) || typeof note !== 'string' || note.length > 4000)) errors.push('Rationales must belong to ordered skills and be at most 4,000 characters.');
  return { errors, warnings: active.filter(skill => skill.readiness).map(skill => `${skill.name}: ${skill.readiness}`) };
};

const freezeDeep = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
};
/** Produces a detached immutable snapshot. Publishing this snapshot does not enroll anyone. */
export const buildLinearVersion = (input: { id: string; status?: 'reviewed' | 'published'; publishedAt: string; draft: LinearPublicationDraft; active: LinearCurriculumEntry[]; runtimeReadySkillIds?: string[] }): LinearPublishedVersion => {
  const result = validateLinearPublication(input.draft, input.active);
  if (result.errors.length) throw new Error(result.errors.join(' '));
  if (!input.id.trim() || !Number.isFinite(Date.parse(input.publishedAt))) throw new Error('Version ID and publication timestamp are required.');
  const ready = [...new Set(input.runtimeReadySkillIds || [])];
  if (ready.some(id => !input.draft.orderedIds.includes(id))) throw new Error('Runtime approval includes an unknown skill.');
  const byId = new Map(input.active.map(skill => [skill.id, skill]));
  return freezeDeep(JSON.parse(JSON.stringify({ id: input.id, status: input.status || 'published', publishedAt: input.publishedAt, content: input.draft, skills: input.draft.orderedIds.map(id => byId.get(id)), runtimeReadySkillIds: ready })) as LinearPublishedVersion);
};
const dayNumber = (value: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() / 86_400_000 : null;
};
/** Pure adapter input. No default enrollment, writes, legacy migration, or completion inference. */
export const previewLinearAssignment = (input: { featureEnabled?: boolean; athleteId: string; version: LinearPublishedVersion | null; enrollment: LinearEnrollment | null; asOf: string; completions?: readonly LinearCompletionEvidence[]; currentSkill?: { skillId: string; startedOn: string } }): LinearPreviewResult => {
  if (input.featureEnabled !== true) return { kind: 'blocked', reason: 'Versioned curriculum assignment is disabled.' };
  const { version, enrollment } = input;
  if (!version || version.status !== 'published') return { kind: 'blocked', reason: 'A published version is required.' };
  if (!enrollment || enrollment.optedIn !== true || enrollment.athleteId !== input.athleteId || enrollment.versionId !== version.id || enrollment.historyPolicy !== 'preserve') return { kind: 'blocked', reason: 'Explicit enrollment pinned to this version is required.' };
  if (version.skills.length !== version.content.orderedIds.length || version.skills.some((skill, index) => skill.id !== version.content.orderedIds[index])) return { kind: 'blocked', reason: 'The version skill snapshot does not match its immutable order.' };
  const validity = validateLinearPublication(version.content as LinearPublicationDraft, [...version.skills]);
  if (validity.errors.length) return { kind: 'blocked', reason: validity.errors.join(' ') };
  const start = dayNumber(enrollment.startedOn); const today = dayNumber(input.asOf);
  if (start === null || today === null) return { kind: 'blocked', reason: 'Valid enrollment and preview dates are required.' };
  if (today < start) return { kind: 'blocked', reason: 'The enrollment has not started.' };
  if (!enrollment.timezone) return { kind: 'blocked', reason: 'A pinned athlete timezone is required for distinct completion days.' };
  const basis = version.content.progressionBasis!;
  let phaseStartedOn = input.currentSkill?.startedOn || enrollment.startedOn;
  const firstIndex = input.currentSkill ? version.skills.findIndex(skill => skill.id === input.currentSkill!.skillId) : 0;
  if (firstIndex < 0) return { kind: 'blocked', reason: 'The current skill is unavailable in its pinned version.' };
  const evidence = (input.completions || []).filter(item => item.status === 'completed' && item.athleteId === input.athleteId && item.versionId === version.id);
  if (evidence.some(item => typeof item.completedAt !== 'number' || !Number.isFinite(item.completedAt))) return { kind: 'blocked', reason: 'Verified completion timestamps are required; undated history cannot advance this policy.' };
  for (let index = firstIndex; index < version.skills.length; index++) {
    const skill = version.skills[index];
    const phases: LinearPhase[] = skill.type === 'protocol' ? ['learn', 'practice', 'use_it'] : ['practice', 'use_it'];
    for (const phase of phases) {
      let progress;
      try { progress = evaluatePhaseProgression({ phaseStartedOn, asOf: input.asOf, timezone: enrollment.timezone, completions: evidence.filter(item => item.skillId === skill.id && item.phase === phase).map(item => ({ id: item.id, completedAt: item.completedAt! })) }); }
      catch { return { kind: 'blocked', reason: 'Valid local dates and a pinned IANA timezone are required.' }; }
      if (progress.completedOn && progress.completedOn < input.asOf) { phaseStartedOn = addLocalCalendarDays(progress.completedOn, 1); continue; }
      if (!version.runtimeReadySkillIds.includes(skill.id)) return { kind: 'blocked', reason: `${skill.name} needs runtime review before it can be assigned. ${skill.readiness}` };
      return { kind: 'assignment', versionId: version.id, skillId: skill.id, skillName: skill.name, ordinal: index + 1, phase, progressionBasis: basis, phasePosition: Math.min(progress.count + 1, 5), phaseLength: 5, verifiedCompletions: progress.count, journalWithinUse: true, windowStart: progress.currentWindowStart, windowEnd: progress.currentWindowEnd, restartCount: progress.restartCount, phaseCompletedToday: progress.uniqueCompletionDays.includes(input.asOf) };
    }
    if (input.currentSkill) return { kind: 'skill_complete', skillId: skill.id, nextStartedOn: phaseStartedOn };
  }
  return { kind: 'review_due', reason: 'The required completion days are recorded. Review what to practice next; this does not establish mastery.' };
};

/** Resolves a proposed assignment and next pin without writing any athlete state.
 * A runtime caller must atomically persist nextPin and completedSkillId against the prior pin before delivery.
 * latestApplicableVersion must already be selected for this athlete by trusted server policy.
 */
export function previewPinnedSkillAssignment(input: {
  featureEnabled?: boolean; athleteId: string; enrollment: LinearEnrollment;
  currentSkill: LinearSkillPin; pinnedVersion: LinearPublishedVersion | null;
  latestApplicableVersion: LinearPublishedVersion | null; completedSkillIds: readonly string[];
  asOf: string; completions: readonly LinearCompletionEvidence[];
}): { result: LinearPreviewResult; nextPin?: LinearSkillPin; completedSkillId?: string } {
  if (!input.featureEnabled) return { result: { kind: 'blocked', reason: 'Versioned curriculum assignment is disabled.' } };
  const kept = selectLinearSkillTransition({ ...input, skillComplete: false, nextStartedOn: input.asOf });
  if (kept.kind !== 'keep_current') return { result: { kind: 'blocked', reason: kept.kind === 'blocked' ? kept.reason : 'A pinned current skill is required.' } };
  const current = previewLinearAssignment({ featureEnabled: true, athleteId: input.athleteId, version: kept.version, enrollment: { ...input.enrollment, versionId: kept.pin.versionId }, currentSkill: kept.pin, asOf: input.asOf, completions: input.completions });
  if (current.kind !== 'skill_complete') return { result: current };
  const next = selectLinearSkillTransition({ ...input, skillComplete: true, nextStartedOn: input.asOf });
  if (next.kind === 'blocked') return { result: next, completedSkillId: current.skillId };
  if (next.kind === 'complete') return { result: { kind: 'review_due', reason: 'All eligible skills in the latest applicable curriculum are complete.' }, completedSkillId: current.skillId };
  if (next.kind !== 'next_skill') return { result: { kind: 'blocked', reason: 'The completed skill is awaiting boundary review.' } };
  // This is a proposed new pin, never an enrollment mutation or assignment write.
  const result = previewLinearAssignment({ featureEnabled: true, athleteId: input.athleteId, version: next.version, enrollment: { ...input.enrollment, versionId: next.pin.versionId }, currentSkill: next.pin, asOf: input.asOf, completions: input.completions });
  return { result, nextPin: next.pin, completedSkillId: current.skillId };
}
