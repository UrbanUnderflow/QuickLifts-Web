import type {
  PulseCheckOnboardingTrackerStepId,
  PulseCheckOnboardingTrackerStepStatus,
  PulseCheckTeam,
} from './types';

// Shared source of truth for the PulseCheck onboarding tracker.
// Imported by both the Provisioning console (per-team editing) and the
// Onboarding Playbook dashboard (birds-eye view) so the two never drift.

export type TeamOnboardingTrackerStepDefinition = {
  id: PulseCheckOnboardingTrackerStepId;
  label: string;
  owner: string;
  meeting: string;
  description: string;
};

export const TEAM_ONBOARDING_TRACKER_STEPS: TeamOnboardingTrackerStepDefinition[] = [
  {
    id: 'provisioning',
    label: 'Create organization & team',
    owner: 'PulseCheck',
    meeting: 'Before kickoff',
    description: 'Create the organization, team, and — when the rollout uses them — the pilot and cohort, in provisioning.',
  },
  {
    id: 'intake',
    label: 'Intake done',
    owner: 'PulseCheck',
    meeting: 'Before kickoff',
    description: 'Sponsor, coach list, rough roster, launch date, support route, and device plan are all confirmed.',
  },
  {
    id: 'coach-kickoff',
    label: 'Meeting 1 — kickoff done',
    owner: 'PulseCheck',
    meeting: 'Meeting 1',
    description: 'Coach gets the goals, roles, data boundaries, device plan, and next steps.',
  },
  {
    id: 'dashboard-training',
    label: 'Meeting 2 — training done',
    owner: 'PulseCheck',
    meeting: 'Meeting 2',
    description: 'Coach can read a report, use the dashboard, work follow-ups, and not over-read thin data.',
  },
  {
    id: 'team-rollout',
    label: 'Meeting 3 — launch booked',
    owner: 'PulseCheck',
    meeting: 'Meeting 3',
    description: 'Room plan, invite flow, delivery support, troubleshooting, and athlete agenda are ready.',
  },
  {
    id: 'device-sync',
    label: 'Devices synced',
    owner: 'PulseCheck',
    meeting: 'Launch day',
    description: 'Device count is reconciled and every athlete is connected or logged for follow-up.',
  },
  {
    id: 'first-check-in',
    label: 'First check-in done',
    owner: 'Coach + athletes',
    meeting: 'Launch day',
    description: 'Athletes finish the first check-in and know when honest daily input is expected.',
  },
  {
    id: 'first-training',
    label: 'First session done',
    owner: 'Coach + athletes',
    meeting: 'Launch day',
    description: 'Athletes finish the first mental training session with PulseCheck staff there.',
  },
  {
    id: 'weekly-snapshot',
    label: 'Weekly snapshot live',
    owner: 'Coach success',
    meeting: 'Post-launch',
    description: 'The weekly report day, its owner, and how it reaches the coach are all set.',
  },
  {
    id: 'stakeholder-cadence',
    label: 'Stakeholder check-ins set',
    owner: 'PulseCheck',
    meeting: 'Post-launch',
    description: 'Coach and sponsor check-ins are booked every two weeks with an owner and action log.',
  },
];

export const TRACKER_STATUS_OPTIONS: Array<{
  value: PulseCheckOnboardingTrackerStepStatus;
  label: string;
  description: string;
}> = [
  { value: 'pending', label: 'Not started', description: 'No action yet' },
  { value: 'in-progress', label: 'Working', description: 'Owner is handling it' },
  { value: 'complete', label: 'Done', description: 'Verified and ready' },
  { value: 'blocked', label: 'Needs help', description: 'Escalate before launch' },
];

export const getTeamOnboardingStepStatus = (
  team: PulseCheckTeam,
  stepId: PulseCheckOnboardingTrackerStepId
): PulseCheckOnboardingTrackerStepStatus =>
  team.implementationMetadata?.onboardingTracker?.steps?.[stepId]?.status || 'pending';

export const getTeamOnboardingProgress = (team: PulseCheckTeam) => {
  const completedCount = TEAM_ONBOARDING_TRACKER_STEPS.filter(
    (step) => getTeamOnboardingStepStatus(team, step.id) === 'complete'
  ).length;
  const blockedCount = TEAM_ONBOARDING_TRACKER_STEPS.filter(
    (step) => getTeamOnboardingStepStatus(team, step.id) === 'blocked'
  ).length;
  const inProgressCount = TEAM_ONBOARDING_TRACKER_STEPS.filter(
    (step) => getTeamOnboardingStepStatus(team, step.id) === 'in-progress'
  ).length;

  return {
    completedCount,
    blockedCount,
    inProgressCount,
    totalCount: TEAM_ONBOARDING_TRACKER_STEPS.length,
    pct: Math.round((completedCount / TEAM_ONBOARDING_TRACKER_STEPS.length) * 100),
  };
};

export const getTrackerStatusLabel = (status: PulseCheckOnboardingTrackerStepStatus) =>
  TRACKER_STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Not started';
