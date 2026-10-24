import { athleteHasSatisfiedAccessRequirements, hasCompletedEntryOnboarding } from '../pulsecheckProvisioning/accessState';
import { getCompletedBaselineEvidence } from '../pulsecheckProvisioning/athleteTaskState';
import { isActivePulseCheckTeamMembership, type PulseCheckTeamMembership, type PulseCheckPilotStudyMode } from '../pulsecheckProvisioning/types';
import type { AthleteMentalProgress } from '../mentaltraining/types';

export function summarizeLiveOnboarding(membership: PulseCheckTeamMembership, teamId: string, studyMode: PulseCheckPilotStudyMode, progress: AthleteMentalProgress | null, progressLoaded: boolean) {
  const teamJoined = membership.teamId === teamId && isActivePulseCheckTeamMembership(membership) && membership.role === 'athlete';
  const accountLinked = teamJoined && Boolean(membership.userId);
  const setupComplete = hasCompletedEntryOnboarding(membership.athleteOnboarding)
    && athleteHasSatisfiedAccessRequirements(membership.athleteOnboarding, studyMode);
  // A synced membership flag alone does not establish that the baseline was saved.
  const evidence = getCompletedBaselineEvidence(progress);
  const baselineSaved = progressLoaded && evidence.complete;
  return { teamJoined, accountLinked, setupComplete, baselineSaved, completedAt: evidence.completedAt,
    complete: teamJoined && accountLinked && setupComplete && baselineSaved };
}
