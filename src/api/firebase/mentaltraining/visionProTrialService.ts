import { auth } from '../config';

export const VISION_PRO_LEGACY_ASSIGNMENTS_COLLECTION = 'mental-exercise-assignments' as const;
export const VISION_PRO_CURRICULUM_ASSIGNMENTS_COLLECTION = 'mental-curriculum-assignments' as const;

export type VisionProAssignmentCollection =
  | typeof VISION_PRO_LEGACY_ASSIGNMENTS_COLLECTION
  | typeof VISION_PRO_CURRICULUM_ASSIGNMENTS_COLLECTION;

export interface VisionProTrialSession {
  id: string;
  assignmentId: string;
  assignmentCollection: VisionProAssignmentCollection;
  athleteUserId: string;
  simId: string;
  simName: string;
  status: 'queued' | 'claimed' | 'running' | 'completed' | 'abandoned' | 'expired' | 'failed';
  reservedDeviceId?: string | null;
  claimedDeviceId?: string | null;
  claimedDeviceName?: string | null;
  tokenExpiresAt?: number | null;
  claimedAt?: number | null;
  startedAt?: number | null;
  completedAt?: number | null;
  abandonedAt?: number | null;
  createdByUserId?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  resultSummary?: {
    normalizedScore?: number | null;
    coreMetricName?: string | null;
    coreMetricValue?: number | null;
    durationSeconds?: number | null;
    completedAt?: number | null;
    simSessionId?: string | null;
  } | null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to manage Vision Pro trials.');
  }

  const idToken = await user.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

async function post<TResponse>(path: string, payload: Record<string, unknown>): Promise<TResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data as TResponse;
}

export const visionProTrialService = {
  async createSession(input: {
    assignmentId: string;
    assignmentCollection: VisionProAssignmentCollection;
    athleteUserId: string;
    simId?: string;
    simName?: string;
    reservedDeviceId?: string;
    reservedDeviceName?: string;
    createdByName?: string;
  }): Promise<VisionProTrialSession> {
    const data = await post<{ session: VisionProTrialSession }>(
      '/.netlify/functions/create-vision-pro-trial-session',
      input
    );
    return data.session;
  },
};
