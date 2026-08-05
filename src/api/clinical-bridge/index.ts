import { auth, getFirebaseModeRequestHeaders } from '../firebase/config';
import type {
  ClinicalBridgeSmokeRequest,
  ClinicalBridgeSmokeResponse,
} from './types';

export type * from './types';

export const CLINICAL_BRIDGE_PROVIDER = 'auntedna' as const;

export class ClinicalBridgeSmokeTestError extends Error {
  readonly httpStatus: number;
  readonly responseBody: unknown;

  constructor(message: string, httpStatus: number, responseBody: unknown) {
    super(message);
    this.name = 'ClinicalBridgeSmokeTestError';
    this.httpStatus = httpStatus;
    this.responseBody = responseBody;
  }
}

export async function runClinicalBridgeSmokeTest(input: ClinicalBridgeSmokeRequest): Promise<ClinicalBridgeSmokeResponse> {
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
    throw new ClinicalBridgeSmokeTestError(
      data?.error || `Clinical bridge smoke test failed with HTTP ${response.status}.`,
      response.status,
      data,
    );
  }

  return data as ClinicalBridgeSmokeResponse;
}
