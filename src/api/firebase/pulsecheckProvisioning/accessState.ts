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

const parseConsentVersionNumber = (version?: unknown): number => {
  const normalized = normalizeString(version).toLowerCase();
  const match = normalized.match(/(\d+)/);
  return match ? Number(match[1]) || 0 : 0;
};

const normalizeConsentVersions = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [rawId, rawVersion]) => {
    const id = normalizeString(rawId);
    const version = normalizeString(rawVersion);
    if (id && version) {
      acc[id] = version;
    }
    return acc;
  }, {});
};

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

export const requiresReConsentForVersion = (currentAccepted: unknown, latest: unknown): boolean => {
  const latestVersion = normalizeString(latest);
  if (!latestVersion) return false;

  const acceptedVersion = normalizeString(currentAccepted);
  if (!acceptedVersion) return true;

  return parseConsentVersionNumber(acceptedVersion) < parseConsentVersionNumber(latestVersion);
};

export const hasCompletedRequiredConsents = (athleteOnboarding?: AthleteOnboardingLike): boolean => {
  const requiredConsents = normalizeRequiredConsents(athleteOnboarding?.requiredConsents);
  if (requiredConsents.length === 0) {
    return true;
  }

  const completedConsentIds = new Set(normalizeConsentIds(athleteOnboarding?.completedConsentIds));
  const completedConsentVersions = normalizeConsentVersions(athleteOnboarding?.completedConsentVersions);
  const hasVersionedCompletions = Object.keys(completedConsentVersions).length > 0;
  return requiredConsents.every((consent) => {
    if (!completedConsentIds.has(consent.id)) return false;
    if (!hasVersionedCompletions) return true;

    const acceptedVersion = completedConsentVersions[consent.id];
    if (acceptedVersion) {
      return !requiresReConsentForVersion(acceptedVersion, consent.version);
    }

    return false;
  });
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
