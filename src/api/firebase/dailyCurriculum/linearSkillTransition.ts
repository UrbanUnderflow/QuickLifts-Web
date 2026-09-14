import type { LinearPublishedVersion } from './linearPublication';
import { addLocalCalendarDays } from './phaseProgression';
export interface LinearSkillPin { readonly skillId: string; readonly versionId: string; readonly startedOn: string }
export interface LinearSkillTransitionInput {
  currentSkill: LinearSkillPin;
  pinnedVersion: LinearPublishedVersion | null;
  /** Caller resolves audience applicability; publication itself is never a completion signal. */
  latestApplicableVersion: LinearPublishedVersion | null;
  completedSkillIds: readonly string[];
  /** True only after the caller verifies completion of every phase of the pinned skill. */
  skillComplete: boolean;
  nextStartedOn: string;
}
export type LinearSkillTransition =
  | { kind: 'keep_current'; pin: LinearSkillPin; version: LinearPublishedVersion }
  | { kind: 'next_skill'; pin: LinearSkillPin; version: LinearPublishedVersion }
  | { kind: 'blocked'; reason: string }
  | { kind: 'complete' };
function validVersion(version: LinearPublishedVersion | null): version is LinearPublishedVersion {
  return !!version && version.status === 'published' && !!version.id &&
    version.content.orderedIds.length === version.skills.length &&
    new Set(version.content.orderedIds).size === version.content.orderedIds.length &&
    version.skills.every((skill, index) => skill.id === version.content.orderedIds[index]) &&
    version.runtimeReadySkillIds.every(id => version.content.orderedIds.includes(id));
}
const validDate = (date: string) => { try { return addLocalCalendarDays(date, 0) === date; } catch { return false; } };
/** Keeps the exact pin/version mid-skill; consumers must retain their existing phase/window state. */
export function selectLinearSkillTransition(input: LinearSkillTransitionInput): LinearSkillTransition {
  const { currentSkill: pin, pinnedVersion } = input;
  if (!validVersion(pinnedVersion) || pinnedVersion.id !== pin.versionId ||
      !pinnedVersion.content.orderedIds.includes(pin.skillId) || !validDate(pin.startedOn)) {
    return { kind: 'blocked', reason: 'The original published skill pin and version are required.' };
  }
  if (input.skillComplete !== true) return { kind: 'keep_current', pin, version: pinnedVersion };
  const latest = input.latestApplicableVersion;
  if (!validVersion(latest)) return { kind: 'blocked', reason: 'A valid latest applicable published version is required at the skill boundary.' };
  if (!validDate(input.nextStartedOn) || input.nextStartedOn <= pin.startedOn) return { kind: 'blocked', reason: 'The next skill requires a valid later local start date.' };
  const completed = new Set([...input.completedSkillIds, pin.skillId]);
  const remaining = latest.content.orderedIds.filter(id => !completed.has(id));
  if (!remaining.length) return { kind: 'complete' };
  const next = remaining[0];
  if (!latest.runtimeReadySkillIds.includes(next)) return { kind: 'blocked', reason: 'The next skill in the published order requires runtime approval before assignment.' };
  return { kind: 'next_skill', pin: { skillId: next, versionId: latest.id, startedOn: input.nextStartedOn }, version: latest };
}
