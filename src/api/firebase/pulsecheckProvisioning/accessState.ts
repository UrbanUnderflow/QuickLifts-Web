import type {
  PulseCheckAthleteOnboardingState,
  PulseCheckPilotEnrollmentStatus,
  PulseCheckPilotStudyMode,
  PulseCheckRequiredConsentDocument,
  PulseCheckResearchConsentStatus,
  PulseCheckTeamMembershipRole,
} from './types';

type AthleteOnboardingLike = Partial<PulseCheckAthleteOnboardingState> | Record<string, unknown> | null | undefined;

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeConsentIds = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => normalizeString(entry))
        .filter((entry, index, values) => entry && values.indexOf(entry) === index)
    : [];

const normalizeRequiredConsents = (value: unknown): PulseCheckRequiredConsentDocument[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is PulseCheckRequiredConsentDocument => {
        if (!entry || typeof entry !== 'object') return false;
        const candidate = entry as Record<string, unknown>;
        return Boolean(normalizeString(candidate.id));
      })
    : [];

export const hasCompletedEntryOnboarding = (athleteOnboarding?: AthleteOnboardingLike): boolean =>
  normalizeString(athleteOnboarding?.entryOnboardingStep) === 'complete';

export const hasCompletedRequiredConsents = (athleteOnboarding?: AthleteOnboardingLike): boolean => {
  const requiredConsents = normalizeRequiredConsents(athleteOnboarding?.requiredConsents);
  if (requiredConsents.length === 0) {
    return true;
  }

  const completedConsentIds = new Set(normalizeConsentIds(athleteOnboarding?.completedConsentIds));
  return requiredConsents.every((consent) => completedConsentIds.has(consent.id));
};

export const hasResolvedResearchConsent = (
  studyMode: PulseCheckPilotStudyMode | null,
  athleteOnboarding?: AthleteOnboardingLike
): boolean => {
  if (studyMode !== 'research') {
    return true;
  }

  const status = normalizeString(athleteOnboarding?.researchConsentStatus) as PulseCheckResearchConsentStatus;
  return status === 'accepted' || status === 'declined';
};

export const athleteHasSatisfiedAccessRequirements = (
  athleteOnboarding?: AthleteOnboardingLike,
  studyMode: PulseCheckPilotStudyMode | null = null
): boolean =>
  Boolean(athleteOnboarding?.productConsentAccepted)
  && hasCompletedRequiredConsents(athleteOnboarding)
  && hasResolvedResearchConsent(studyMode, athleteOnboarding);

export const resolveTeamMembershipOnboardingStatus = (input: {
  role: PulseCheckTeamMembershipRole;
  athleteOnboarding?: AthleteOnboardingLike;
  studyMode?: PulseCheckPilotStudyMode | null;
}): string => {
  if (input.role !== 'athlete') {
    return 'pending-profile';
  }

  return athleteHasSatisfiedAccessRequirements(input.athleteOnboarding, input.studyMode || null)
    && hasCompletedEntryOnboarding(input.athleteOnboarding)
    ? 'complete'
    : 'pending-consent';
};

export const resolvePilotEnrollmentStatus = (input: {
  athleteOnboarding?: AthleteOnboardingLike;
  studyMode?: PulseCheckPilotStudyMode | null;
}): PulseCheckPilotEnrollmentStatus =>
  athleteHasSatisfiedAccessRequirements(input.athleteOnboarding, input.studyMode || null)
  && hasCompletedEntryOnboarding(input.athleteOnboarding)
    ? 'active'
    : 'pending-consent';
