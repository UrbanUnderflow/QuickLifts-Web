import { auth, getFirebaseModeRequestHeaders } from '../config';
import { resolvePulseCheckFunctionUrl } from '../mentaltraining/pulseCheckFunctionsUrl';
import type { CompletePulseCheckAthleteOnboardingInput, SavePulseCheckAthleteOnboardingProgressInput } from './types';

export async function saveAthleteConsentAtomically(action: 'progress' | 'complete', input: CompletePulseCheckAthleteOnboardingInput | SavePulseCheckAthleteOnboardingProgressInput) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to save your choices.');
  const { teamMembershipId, expectedContext, phone, ...onboarding } = input;
  const completed = input as CompletePulseCheckAthleteOnboardingInput;
  const progress = input as SavePulseCheckAthleteOnboardingProgressInput;
  const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/pulsecheck-consent-save'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getFirebaseModeRequestHeaders(), Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ teamMembershipId, expectedContext, action,
      onboarding: { ...onboarding, ...(action === 'complete' ? { productConsentAccepted: true, productConsentVersion: completed.consentVersion } : {}) },
      profile: { name: completed.name || progress.entryOnboardingName, phone, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) throw new Error(result.error?.message || 'Your choices could not be saved. Please retry.');
  return result as { success: true; onboardingStatus: string; eventId: string | null };
}
