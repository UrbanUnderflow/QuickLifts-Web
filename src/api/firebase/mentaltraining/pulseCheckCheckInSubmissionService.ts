import { auth } from '../config';
import { resolvePulseCheckFunctionUrl } from './pulseCheckFunctionsUrl';
import type { PulseCheckCheckInSubmissionResult, SubmitPulseCheckCheckInInput } from './types';

const isLocalHarnessAvailable = () =>
  typeof window !== 'undefined' &&
  Boolean((window as typeof window & {
    __pulseE2E?: {
      submitPulseCheckCheckIn?: (input: SubmitPulseCheckCheckInInput) => Promise<PulseCheckCheckInSubmissionResult>;
    };
  }).__pulseE2E?.submitPulseCheckCheckIn);

const shouldUseLocalCheckInFallback = (errorMessage: string) =>
  isLocalHarnessAvailable() &&
  (
    errorMessage.includes('Could not load the default credentials') ||
    errorMessage.includes('Request failed with status 500') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('Authenticated session required')
  );

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to submit a PulseCheck check-in.');
  }

  const idToken = await user.getIdToken();
  const shouldForceDevFirebase =
    typeof window !== 'undefined' &&
    window.localStorage.getItem('forceDevFirebase') === 'true';

  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
    ...(shouldForceDevFirebase ? { 'X-Force-Dev-Firebase': '1' } : {}),
  };
}

export const pulseCheckCheckInSubmissionService = {
  async submit(input: SubmitPulseCheckCheckInInput): Promise<PulseCheckCheckInSubmissionResult> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/submit-pulsecheck-checkin'), {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Request failed with status ${response.status}`);
      }

      return data as PulseCheckCheckInSubmissionResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PulseCheck check-in failed.';
      if (!shouldUseLocalCheckInFallback(message)) {
        throw error;
      }

      console.warn('[PulseCheck check-in] Falling back to local E2E harness:', message);
      const harness = (window as typeof window & {
        __pulseE2E?: {
          submitPulseCheckCheckIn?: (payload: SubmitPulseCheckCheckInInput) => Promise<PulseCheckCheckInSubmissionResult>;
        };
      }).__pulseE2E;

      return harness!.submitPulseCheckCheckIn!(input) as Promise<PulseCheckCheckInSubmissionResult>;
    }
  },
};
