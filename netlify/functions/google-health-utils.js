const crypto = require('crypto');
const { admin, headers } = require('./config/firebase');

const GOOGLE_HEALTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_HEALTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_HEALTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_HEALTH_API_BASE_URL = 'https://health.googleapis.com/v4';

const GOOGLE_HEALTH_SCOPE_PREFIX = 'https://www.googleapis.com/auth/googlehealth';
const DEFAULT_SCOPES = [
  `${GOOGLE_HEALTH_SCOPE_PREFIX}.activity_and_fitness.readonly`,
  `${GOOGLE_HEALTH_SCOPE_PREFIX}.health_metrics_and_measurements.readonly`,
  `${GOOGLE_HEALTH_SCOPE_PREFIX}.sleep.readonly`,
  `${GOOGLE_HEALTH_SCOPE_PREFIX}.profile.readonly`,
];
const ALLOWED_SCOPE_SUFFIXES = new Set([
  'activity_and_fitness.readonly',
  'health_metrics_and_measurements.readonly',
  'sleep.readonly',
  'profile.readonly',
  'location.readonly',
]);

const DEFAULT_RETURN_TO = '/PulseCheck/fitbit';
const OAUTH_STATES_COLLECTION = 'pulsecheck-oauth-states';
const CONNECTIONS_COLLECTION = 'health-provider-connections';
const TOKEN_REFRESH_SKEW_SECONDS = 5 * 60;

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': headers['Access-Control-Allow-Headers'],
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeGoogleHealthError(error, fallback = {}) {
  const rawMessage = String(error?.message || '').trim();
  const normalizedMessage = rawMessage.toLowerCase();
  const statusCode = Number.isFinite(error?.statusCode) ? error.statusCode : fallback.statusCode || 500;
  const fallbackCode = fallback.errorCode || 'GOOGLE_HEALTH_UNKNOWN';
  const fallbackMessage = fallback.message || 'We could not complete the Google Health request right now.';

  if (typeof error?.errorCode === 'string' && error.errorCode.trim()) {
    return {
      statusCode,
      errorCode: error.errorCode.trim(),
      message: typeof error?.publicMessage === 'string' && error.publicMessage.trim()
        ? error.publicMessage.trim()
        : fallbackMessage,
    };
  }

  if (normalizedMessage.includes('missing authorization header')) {
    return {
      statusCode: 401,
      errorCode: 'GOOGLE_HEALTH_AUTH_REQUIRED',
      message: 'Sign in to keep using Fitbit through Google Health.',
    };
  }

  if (normalizedMessage.includes('request body must be valid json')) {
    return {
      statusCode: 400,
      errorCode: 'GOOGLE_HEALTH_INVALID_REQUEST',
      message: 'This Google Health request was missing some details. Please try again.',
    };
  }

  if (
    normalizedMessage.includes('missing google_health_client_id')
    || normalizedMessage.includes('missing google_health_client_secret')
    || normalizedMessage.includes('environment variables')
  ) {
    return {
      statusCode: 500,
      errorCode: 'GOOGLE_HEALTH_CONFIG_UNAVAILABLE',
      message: 'The Fitbit connection is unavailable right now.',
    };
  }

  if (normalizedMessage.includes('token exchange failed')) {
    return {
      statusCode: 502,
      errorCode: 'GOOGLE_HEALTH_CALLBACK_FAILED',
      message: 'We could not finish the Fitbit connection right now.',
    };
  }

  if (normalizedMessage.includes('token refresh failed')) {
    return {
      statusCode: 502,
      errorCode: 'GOOGLE_HEALTH_SYNC_FAILED',
      message: 'We could not refresh your Fitbit health data right now.',
    };
  }

  if (normalizedMessage.includes('connection request') && normalizedMessage.includes('expired')) {
    return {
      statusCode: 400,
      errorCode: 'GOOGLE_HEALTH_CALLBACK_EXPIRED',
      message: 'This Fitbit connection request expired. Start the connection again.',
    };
  }

  if (normalizedMessage.includes('connection request') && normalizedMessage.includes('not found')) {
    return {
      statusCode: 400,
      errorCode: 'GOOGLE_HEALTH_CALLBACK_INVALID_STATE',
      message: 'This Fitbit connection request is no longer active.',
    };
  }

  return {
    statusCode,
    errorCode: fallbackCode,
    message: typeof error?.publicMessage === 'string' && error.publicMessage.trim()
      ? error.publicMessage.trim()
      : fallbackMessage,
  };
}

function buildGoogleHealthErrorResponse(error, fallback) {
  const resolved = normalizeGoogleHealthError(error, fallback);
  return {
    statusCode: resolved.statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({
      error: resolved.message,
      errorCode: resolved.errorCode,
    }),
  };
}

function parseJsonBody(event) {
  if (!event?.body) return {};
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (error) {
    throw createError(400, 'Request body must be valid JSON.');
  }
}

function getQueryParams(event) {
  return event?.queryStringParameters || {};
}

function normalizeScopeValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  const suffix = normalized.startsWith(`${GOOGLE_HEALTH_SCOPE_PREFIX}.`)
    ? normalized.slice(GOOGLE_HEALTH_SCOPE_PREFIX.length + 1)
    : normalized.replace(/^googlehealth\./, '');
  if (!ALLOWED_SCOPE_SUFFIXES.has(suffix)) return '';
  return `${GOOGLE_HEALTH_SCOPE_PREFIX}.${suffix}`;
}

function normalizeScopes(input) {
  const rawValues = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[,\s]+/)
      : [];
  const scopes = rawValues.map(normalizeScopeValue).filter(Boolean);
  return Array.from(new Set(scopes.length ? scopes : DEFAULT_SCOPES));
}

function sanitizeReturnTo(value) {
  if (typeof value !== 'string') return DEFAULT_RETURN_TO;
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'pulsecheck:' || parsed.protocol === 'pulse:' || parsed.protocol === 'quicklifts:') {
      return parsed.toString();
    }
  } catch (error) {
    return DEFAULT_RETURN_TO;
  }

  return DEFAULT_RETURN_TO;
}

function getBaseSiteUrl() {
  return (process.env.SITE_URL || process.env.URL || 'https://fitwithpulse.ai').replace(/\/+$/, '');
}

function getRedirectUri() {
  const configured = process.env.GOOGLE_HEALTH_REDIRECT_URI;
  if (configured && typeof configured === 'string' && configured.trim()) return configured.trim();
  return `${getBaseSiteUrl()}/.netlify/functions/google-health-callback`;
}

function getConfiguredScopes() {
  return normalizeScopes(process.env.GOOGLE_HEALTH_SCOPES || DEFAULT_SCOPES);
}

function getOauthCredentials() {
  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw createError(500, 'Missing GOOGLE_HEALTH_CLIENT_ID or GOOGLE_HEALTH_CLIENT_SECRET environment variables.');
  }
  return { clientId, clientSecret };
}

async function verifyAuth(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Missing Authorization header');
  }
  return admin.auth().verifyIdToken(authHeader.slice('Bearer '.length));
}

function buildStateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function buildAuthorizeUrl({ clientId, redirectUri, scopes, state }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
  });
  return `${GOOGLE_HEALTH_AUTHORIZE_URL}?${params.toString()}`;
}

function parseJsonText(rawText) {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch (error) {
    return { rawText };
  }
}

async function exchangeCodeForToken({ code, redirectUri }) {
  const { clientId, clientSecret } = getOauthCredentials();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(GOOGLE_HEALTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const rawText = await response.text();
  const data = parseJsonText(rawText);
  if (!response.ok) {
    const detail = data?.error_description || data?.error || data?.rawText || `status ${response.status}`;
    throw createError(502, `Google Health token exchange failed: ${detail}`);
  }
  return data;
}

async function refreshAccessToken(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw createError(409, 'Google Health refresh token is missing. Reconnect Fitbit to keep syncing.');
  }

  const { clientId, clientSecret } = getOauthCredentials();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(GOOGLE_HEALTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const rawText = await response.text();
  const data = parseJsonText(rawText);
  if (!response.ok) {
    const detail = data?.error_description || data?.error || data?.rawText || `status ${response.status}`;
    throw createError(502, `Google Health token refresh failed: ${detail}`);
  }

  return data;
}

async function revokeGoogleToken(token) {
  if (!token) return { revoked: false, status: 'missing_token' };
  const response = await fetch(GOOGLE_HEALTH_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ token }).toString(),
  });
  if (response.ok || response.status === 400) {
    return { revoked: response.ok, status: response.status };
  }
  const rawText = await response.text();
  throw createError(502, `Google Health token revoke failed: ${rawText || response.status}`);
}

function timestampToEpochSeconds(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 9999999999 ? Math.floor(value / 1000) : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }
  if (typeof value.toMillis === 'function') return Math.floor(value.toMillis() / 1000);
  if (typeof value.seconds === 'number') return value.seconds;
  return null;
}

function resolveTokenExpirySeconds(connection = {}) {
  return timestampToEpochSeconds(connection.accessTokenExpiresAt)
    || timestampToEpochSeconds(connection.expiresAt)
    || null;
}

async function ensureFreshGoogleHealthConnection(connectionRef, connection) {
  if (!connection || connection.status !== 'connected' || !connection.accessToken) {
    throw createError(409, 'Connect Fitbit before refreshing this health source.');
  }

  const expiresAt = resolveTokenExpirySeconds(connection);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!expiresAt || expiresAt - TOKEN_REFRESH_SKEW_SECONDS > nowSeconds) {
    return connection;
  }

  const tokenData = await refreshAccessToken(connection.refreshToken);
  const refreshedAt = Math.floor(Date.now() / 1000);
  const nextExpiresAt = refreshedAt + Number(tokenData.expires_in || tokenData.expiresIn || 0);
  const update = {
    accessToken: tokenData.access_token || tokenData.accessToken || connection.accessToken,
    refreshToken: tokenData.refresh_token || tokenData.refreshToken || connection.refreshToken,
    tokenType: tokenData.token_type || connection.tokenType || 'Bearer',
    accessTokenIssuedAt: refreshedAt,
    accessTokenExpiresAt: Number.isFinite(nextExpiresAt) && nextExpiresAt > refreshedAt ? nextExpiresAt : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastTokenRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
    lastError: '',
  };

  await connectionRef.set(update, { merge: true });
  return { ...connection, ...update };
}

async function googleHealthApiRequest(accessToken, path, options = {}) {
  const url = path.startsWith('http') ? new URL(path) : new URL(`${GOOGLE_HEALTH_API_BASE_URL}${path}`);
  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) return null;
  const rawText = await response.text();
  const data = parseJsonText(rawText);
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || data?.error_description || data?.error || data?.rawText || `Google Health API request failed: ${path}`;
    const error = createError(response.status, detail);
    error.googleHealthStatus = response.status;
    error.googleHealthPath = path;
    throw error;
  }
  return data;
}

async function getGoogleHealthIdentity(accessToken) {
  return googleHealthApiRequest(accessToken, '/users/me/identity');
}

function buildConnectionDocId(userId) {
  return `${String(userId || '').trim()}_google_health`;
}

function appendQueryParams(urlString, params) {
  const url = new URL(urlString, getBaseSiteUrl());
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function redirectHtml({ title, message, redirectTo }) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeRedirect = escapeHtml(redirectTo);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${safeTitle}</title><meta http-equiv="refresh" content="0;url=${safeRedirect}" /></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#05070c;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<main style="width:min(560px,calc(100vw - 32px));border:1px solid rgba(255,255,255,.08);border-radius:24px;background:rgba(9,19,38,.96);padding:28px;box-shadow:0 24px 60px rgba(0,0,0,.35);">
<h1 style="margin:0 0 12px;font-size:1.4rem;">${safeTitle}</h1><p style="margin:0;line-height:1.6;color:#cbd5e1;">${safeMessage}</p><p style="margin-top:16px;"><a style="color:#e0fe10;" href="${safeRedirect}">Continue</a></p>
</main><script>window.location.replace(${JSON.stringify(redirectTo)});</script></body></html>`;
}

function toConnectionStatus(data) {
  if (!data) {
    return {
      connected: false,
      status: 'not_connected',
      provider: 'google_health',
      sourceFamily: 'fitbit',
    };
  }
  return {
    connected: data.status === 'connected',
    status: data.status || 'not_connected',
    provider: 'google_health',
    sourceFamily: 'fitbit',
    grantedScopes: Array.isArray(data.grantedScopes) ? data.grantedScopes : [],
    requestedScopes: Array.isArray(data.requestedScopes) ? data.requestedScopes : [],
    connectedAt: data.connectedAt || null,
    disconnectedAt: data.disconnectedAt || null,
    accessTokenExpiresAt: data.accessTokenExpiresAt || null,
    healthUserId: data.healthUserId || null,
    legacyUserId: data.legacyUserId || null,
    lastWebhookAt: data.lastWebhookAt || null,
    lastWebhookDataType: data.lastWebhookDataType || null,
    pendingWebhookSync: data.pendingWebhookSync === true,
    lastSuccessfulSyncAt: data.lastSuccessfulSyncAt || null,
    lastSuccessfulSnapshotDateKey: data.lastSuccessfulSnapshotDateKey || null,
    lastImportedDomains: Array.isArray(data.lastImportedDomains) ? data.lastImportedDomains : [],
    lastError: data.lastError || '',
    redirectUri: data.redirectUri || getRedirectUri(),
    productsEnabled: data.productsEnabled || { pulsecheck: true, fit_with_pulse: true },
  };
}

module.exports = {
  CONNECTIONS_COLLECTION,
  DEFAULT_RETURN_TO,
  DEFAULT_SCOPES,
  GOOGLE_HEALTH_API_BASE_URL,
  GOOGLE_HEALTH_SCOPE_PREFIX,
  OAUTH_STATES_COLLECTION,
  RESPONSE_HEADERS,
  appendQueryParams,
  buildAuthorizeUrl,
  buildConnectionDocId,
  buildGoogleHealthErrorResponse,
  buildStateToken,
  createError,
  ensureFreshGoogleHealthConnection,
  exchangeCodeForToken,
  getConfiguredScopes,
  getGoogleHealthIdentity,
  getOauthCredentials,
  getQueryParams,
  getRedirectUri,
  googleHealthApiRequest,
  normalizeGoogleHealthError,
  normalizeScopes,
  parseJsonBody,
  redirectHtml,
  refreshAccessToken,
  revokeGoogleToken,
  sanitizeReturnTo,
  toConnectionStatus,
  verifyAuth,
};
