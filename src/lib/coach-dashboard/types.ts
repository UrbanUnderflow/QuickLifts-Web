/** Public, allowlisted coach DTOs. Never add private check-in, chat, or journal text. */
export type CoverageMetric = { completed: number; expected: number | null; rate: number | null; status: 'available' | 'unavailable' | 'not_connected' | 'sync_pending'; reason?: string };
export type CurrentSkill = { assignedDate?: string; progress?: {completed: number; expected: number; rate: number | null}; id: string; name: string; phase: string | null; preview?: import('../../api/firebase/dailyCurriculum/linearRuntimeClient').LinearRuntimeAssignment };
export type ParticipationAthlete = { lifetime?: import('./lifetimeParticipation').LifetimeParticipation; noraConversationCount?: number | null; id: string; displayName: string; avatarUrl: string | null; checkIns: CoverageMetric; skillTraining: CoverageMetric; wearables: CoverageMetric; currentSkill: CurrentSkill | null; dailyParticipation?: { date: string; checkIn: boolean; morningCompleted?: boolean; eveningCompleted?: boolean; recoveryCompleted?: boolean; scheduled: boolean; skillAssigned: number; skillCompleted: number; wearableRecorded?: boolean; wearableDaytime?: boolean; wearableOvernight?: boolean }[] };
export type SkillGroup = CurrentSkill & { athleteCount: number; phases: Record<string, number> };
export type TeamParticipation = { curriculum?: import('./curriculumOutline').CoachCurriculumOutline; teamId: string; asOf: string; from: string; to: string; canViewWellbeing: boolean; athletes: ParticipationAthlete[]; adherence: { checkIns: CoverageMetric; skillTraining: CoverageMetric; wearables: CoverageMetric }; daily: { date: string; checkIns: number; skillTraining: number; wearables: number }[]; skills: SkillGroup[]; limitations: string[] };
export type WellbeingCard = { status: 'available' | 'unavailable' | 'insufficient_responses'; reason?: string; contributors: number; eligible: number; source: string; asOf: string; values: { label: string; value: number; unit: string }[] };
export type TeamWellbeing = { teamId: string; asOf: string; minimumContributors: number; mood: WellbeingCard; recovery: WellbeingCard; wearables: WellbeingCard; journaling: WellbeingCard };
export const TRAINER_SHARING_VERSION = 'team-trainer-aggregates-v1';
export const TRAINER_SHARING_FIELDS = ['mood', 'recovery', 'wearables', 'journaling'] as const;
export type TrainerSharingChoices = Record<typeof TRAINER_SHARING_FIELDS[number], boolean>;
export const TRAINER_SHARING_TEXT = 'Sharing is on by default. You can turn off any category below. Shared activity contributes to aggregate summaries for athletic trainers on this team. Coaches do not receive these summaries. Mood and recovery use your reported check-ins. Wearable summaries use sleep duration and resting heart rate from connected sources. Journaling shares activity counts only, never entry text. Private Nora conversations are never included. Summaries include available shared reports, even when only one athlete contributes. You may change these choices at any time; turning a choice off stops future dashboard access. This is separate from health authorization, clinical support, and research consent.';

/** Saved preferences override defaults; unknown saved formats never restore sharing. */
export function trainerSharingChoices(grant: Record<string, any> | undefined, athleteId: string, teamId: string): TrainerSharingChoices {
  if (grant === undefined) return { mood: true, recovery: true, wearables: true, journaling: true };
  const valid = grant.athleteId === athleteId && grant.teamId === teamId && grant.version === TRAINER_SHARING_VERSION;
  return Object.fromEntries(TRAINER_SHARING_FIELDS.map(field => [field, valid && grant.choices?.[field] === true])) as TrainerSharingChoices;
}
