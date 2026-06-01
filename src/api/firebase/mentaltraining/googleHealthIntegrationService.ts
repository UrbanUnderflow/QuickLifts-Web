import { auth } from '../config';
import { resolvePulseCheckFunctionUrl } from './pulseCheckFunctionsUrl';

export class GoogleHealthIntegrationError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = 'GOOGLE_HEALTH_UNKNOWN', status = 500) {
    super(message);
    this.name = 'GoogleHealthIntegrationError';
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, GoogleHealthIntegrationError.prototype);
  }
}

export type GoogleHealthConnectionStatus = {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'not_connected' | string;
  provider: 'google_health';
  sourceFamily: 'fitbit';
  grantedScopes?: string[];
  requestedScopes?: string[];
  connectedAt?: number | null;
  disconnectedAt?: number | null;
  accessTokenExpiresAt?: number | null;
  healthUserId?: string | null;
  legacyUserId?: string | null;
  lastWebhookAt?: number | null;
  lastWebhookDataType?: string | null;
  pendingWebhookSync?: boolean;
  lastSuccessfulSyncAt?: number | null;
  lastSuccessfulSnapshotDateKey?: string | null;
  lastImportedDomains?: string[];
  lastError?: string;
  redirectUri?: string;
  productsEnabled?: {
    pulsecheck?: boolean;
    fit_with_pulse?: boolean;
  };
};

type StartGoogleHealthAuthResult = {
  authorizeUrl: string;
  state: string;
  requestedScopes: string[];
  redirectUri: string;
  existingStatus: string;
};

export type GoogleHealthSyncResult = {
  ok: boolean;
  status: 'synced' | 'waiting_for_data' | string;
  snapshotId?: string;
  snapshotDateKey?: string;
  sourceRecordIds?: string[];
  importedDomains?: string[];
  detail?: string;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to connect Fitbit.');
  }

  const idToken = await user.getIdToken();
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as {
    error?: string;
    detail?: string;
    message?: string;
    errorCode?: string;
  };
  if (!response.ok) {
    throw new GoogleHealthIntegrationError(
      data?.error || data?.detail || data?.message || `Request failed with status ${response.status}`,
      data?.errorCode || 'GOOGLE_HEALTH_UNKNOWN',
      response.status
    );
  }
  return data as T;
}

export const googleHealthIntegrationService = {
  async getStatus(): Promise<GoogleHealthConnectionStatus> {
    const headers = await getAuthHeaders();
    const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/google-health-status'), {
      method: 'GET',
      headers,
    });

    return parseResponse<GoogleHealthConnectionStatus>(response);
  },

  async startAuth(input?: { returnTo?: string; scopes?: string[] }): Promise<StartGoogleHealthAuthResult> {
    const headers = await getAuthHeaders();
    const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/google-health-auth-start'), {
      method: 'POST',
      headers,
      body: JSON.stringify(input || {}),
    });

    return parseResponse<StartGoogleHealthAuthResult>(response);
  },

  async connect(input?: { returnTo?: string; scopes?: string[] }): Promise<void> {
    const result = await this.startAuth(input);
    if (typeof window !== 'undefined') {
      window.location.assign(result.authorizeUrl);
    }
  },

  async sync(input?: { timezone?: string; snapshotDateKey?: string }): Promise<GoogleHealthSyncResult> {
    const headers = await getAuthHeaders();
    const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/google-health-sync'), {
      method: 'POST',
      headers,
      body: JSON.stringify(input || {}),
    });

    return parseResponse<GoogleHealthSyncResult>(response);
  },

  async disconnect(): Promise<GoogleHealthConnectionStatus> {
    const headers = await getAuthHeaders();
    const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/google-health-disconnect'), {
      method: 'POST',
      headers,
    });

    const data = await parseResponse<{ disconnected: boolean; connection: GoogleHealthConnectionStatus }>(response);
    return data.connection;
  },
};
