import { auth, getFirebaseModeRequestHeaders } from '../firebase/config';
import type {
  ClinicalBridgeSmokeAction,
  ClinicalBridgeSmokeResponse,
} from './types';

export type * from './types';

export const CLINICAL_BRIDGE_PROVIDER = 'auntedna' as const;

export async function runClinicalBridgeSmokeTest(input: {
  action: ClinicalBridgeSmokeAction;
  allowWrites?: boolean;
  athlete?: {
    externalId?: string;
    displayName?: string;
    email?: string;
    organizationId?: string;
    teamId?: string;
  };
  escalation?: {
    escalationRecordId?: string;
    tier?: number;
    category?: string;
  };
  escalationId?: string;
  status?: string;
}): Promise<ClinicalBridgeSmokeResponse> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Admin authentication is required before running clinical bridge tests.');
  }

  const response = await fetch('/.netlify/functions/clinical-bridge-smoke-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...getFirebaseModeRequestHeaders(),
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(data?.error || `Clinical bridge smoke test failed with HTTP ${response.status}.`);
  }

  return data as ClinicalBridgeSmokeResponse;
}
