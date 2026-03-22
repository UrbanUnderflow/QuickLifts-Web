import { auth } from '../config';
import { resolvePulseCheckFunctionUrl } from './pulseCheckFunctionsUrl';

export class OuraIntegrationError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = 'OURA_UNKNOWN', status = 500) {
    super(message);
    this.name = 'OuraIntegrationError';
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, OuraIntegrationError.prototype);
  }
}

export type OuraConnectionStatus = {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'not_connected' | string;
  provider: 'oura';
  grantedScopes?: string[];
  requestedScopes?: string[];
  connectedAt?: number | null;
  disconnectedAt?: number | null;
  accessTokenExpiresAt?: number | null;
  lastError?: string;
  redirectUri?: string;
};

type StartOuraAuthResult = {
  authorizeUrl: string;
  state: string;
  requestedScopes: string[];
  redirectUri: string;
  existingStatus: string;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to connect Oura.');
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
    throw new OuraIntegrationError(
      data?.error || data?.detail || data?.message || `Request failed with status ${response.status}`,
      data?.errorCode || 'OURA_UNKNOWN',
      response.status
    );
  }
  return data as T;
}

export const ouraIntegrationService = {
  async getStatus(): Promise<OuraConnectionStatus> {
    const headers = await getAuthHeaders();
    const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/oura-status'), {
      method: 'GET',
      headers,
    });

    return parseResponse<OuraConnectionStatus>(response);
  },

  async startAuth(input?: { returnTo?: string; scopes?: string[] }): Promise<StartOuraAuthResult> {
    const headers = await getAuthHeaders();
    const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/oura-auth-start'), {
      method: 'POST',
      headers,
      body: JSON.stringify(input || {}),
    });

    return parseResponse<StartOuraAuthResult>(response);
  },

  async connect(input?: { returnTo?: string; scopes?: string[] }): Promise<void> {
    const result = await this.startAuth(input);
    if (typeof window !== 'undefined') {
      window.location.assign(result.authorizeUrl);
    }
  },

  async disconnect(): Promise<OuraConnectionStatus> {
    const headers = await getAuthHeaders();
    const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/oura-disconnect'), {
      method: 'POST',
      headers,
    });

    const data = await parseResponse<{ disconnected: boolean; connection: OuraConnectionStatus }>(response);
    return data.connection;
  },
};
