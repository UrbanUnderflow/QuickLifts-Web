import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasCompletedRequiredConsents,
  requiresReConsentForVersion,
  resolvePilotEnrollmentStatus,
  resolveTeamMembershipOnboardingStatus,
} from '../../src/api/firebase/pulsecheckProvisioning/accessState';

const requiredPilotConsentsV6 = [
  {
    id: 'pulsecheck-pilot-participation-notice-v1',
    title: 'PulseCheck Pilot Participation Notice',
    body: 'Pilot participation notice.',
    version: 'v6',
  },
  {
    id: 'pulsecheck-pilot-privacy-and-data-use-v1',
    title: 'PulseCheck Pilot Privacy and Data Use',
    body: 'Pilot privacy notice.',
    version: 'v6',
  },
];

test('requiresReConsentForVersion detects older accepted versions', () => {
  assert.equal(requiresReConsentForVersion('v5', 'v6'), true);
  assert.equal(requiresReConsentForVersion('v6', 'v6'), false);
  assert.equal(requiresReConsentForVersion('', 'v6'), true);
  assert.equal(requiresReConsentForVersion('v7', 'v6'), false);
});

test('PulseCheck consent v6 re-prompts athletes who completed v5 documents', () => {
  const athleteOnboarding = {
    productConsentAccepted: true,
    entryOnboardingStep: 'complete',
    researchConsentStatus: 'not-required',
    requiredConsents: requiredPilotConsentsV6,
    completedConsentIds: requiredPilotConsentsV6.map((consent) => consent.id),
    completedConsentVersions: {
      'pulsecheck-pilot-participation-notice-v1': 'v5',
      'pulsecheck-pilot-privacy-and-data-use-v1': 'v5',
    },
  };

  assert.equal(hasCompletedRequiredConsents(athleteOnboarding), false);
  assert.equal(
    resolveTeamMembershipOnboardingStatus({
      role: 'athlete',
      athleteOnboarding,
      studyMode: 'pilot',
    }),
    'pending-consent'
  );
  assert.equal(
    resolvePilotEnrollmentStatus({
      athleteOnboarding,
      studyMode: 'pilot',
    }),
    'pending-consent'
  );
});

test('PulseCheck consent v6 accepts athletes who completed current versions', () => {
  const athleteOnboarding = {
    productConsentAccepted: true,
    entryOnboardingStep: 'complete',
    researchConsentStatus: 'not-required',
    requiredConsents: requiredPilotConsentsV6,
    completedConsentIds: requiredPilotConsentsV6.map((consent) => consent.id),
    completedConsentVersions: {
      'pulsecheck-pilot-participation-notice-v1': 'v6',
      'pulsecheck-pilot-privacy-and-data-use-v1': 'v6',
    },
  };

  assert.equal(hasCompletedRequiredConsents(athleteOnboarding), true);
  assert.equal(
    resolveTeamMembershipOnboardingStatus({
      role: 'athlete',
      athleteOnboarding,
      studyMode: 'pilot',
    }),
    'complete'
  );
  assert.equal(
    resolvePilotEnrollmentStatus({
      athleteOnboarding,
      studyMode: 'pilot',
    }),
    'active'
  );
});
