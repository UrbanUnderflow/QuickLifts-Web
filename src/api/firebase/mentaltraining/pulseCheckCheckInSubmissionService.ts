import { auth } from '../config';
import { resolvePulseCheckFunctionUrl } from './pulseCheckFunctionsUrl';
import type { PulseCheckCheckInSubmissionResult, SubmitPulseCheckCheckInInput } from './types';

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
  },
};
