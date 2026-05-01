const crypto = require('crypto');
const { admin, headers } = require('./config/firebase');

const POLAR_AUTHORIZE_URL = 'https://flow.polar.com/oauth2/authorization';
const POLAR_TOKEN_URL = 'https://polarremote.com/v2/oauth2/token';
const POLAR_API_BASE_URL = 'https://www.polaraccesslink.com/v3';

const DEFAULT_SCOPES = ['accesslink.read_all'];
const ALLOWED_SCOPES = new Set(['accesslink.read_all']);
const DEFAULT_RETURN_TO = '/PulseCheck/polar';
const OAUTH_STATES_COLLECTION = 'pulsecheck-oauth-states';
const CONNECTIONS_COLLECTION = 'pulsecheck-polar-connections';
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

function normalizePolarError(error, fallback = {}) {
  const rawMessage = String(error?.message || '').trim();
  const normalizedMessage = rawMessage.toLowerCase();
  const statusCode = Number.isFinite(error?.statusCode) ? error.statusCode : fallback.statusCode || 500;
  const fallbackCode = fallback.errorCode || 'POLAR_UNKNOWN';
  const fallbackMessage = fallback.message || 'We could not complete the Polar request right now.';

  if (normalizedMessage.includes('missing authorization header')) {
    return { statusCode: 401, errorCode: 'POLAR_AUTH_REQUIRED', message: 'Sign in to keep using Polar.' };
  }

  if (normalizedMessage.includes('missing polar_client_id') || normalizedMessage.includes('missing polar_client_secret')) {
    return { statusCode: 500, errorCode: 'POLAR_CONFIG_UNAVAILABLE', message: 'The Polar connection is unavailable right now.' };
  }

  if (normalizedMessage.includes('token exchange failed')) {
    return { statusCode: 502, errorCode: 'POLAR_CALLBACK_FAILED', message: 'We could not finish the Polar connection right now.' };
  }

  if (normalizedMessage.includes('connection request') && normalizedMessage.includes('expired')) {
    return { statusCode: 400, errorCode: 'POLAR_CALLBACK_EXPIRED', message: 'This Polar connection request expired. Start the connection again.' };
  }

  if (normalizedMessage.includes('connection request') && normalizedMessage.includes('not found')) {
    return { statusCode: 400, errorCode: 'POLAR_CALLBACK_INVALID_STATE', message: 'This Polar connection request is no longer active.' };
  }

  return {
    statusCode,
    errorCode: fallbackCode,
    message: typeof error?.publicMessage === 'string' && error.publicMessage.trim()
      ? error.publicMessage.trim()
      : fallbackMessage,
  };
}

function buildPolarErrorResponse(error, fallback) {
  const resolved = normalizePolarError(error, fallback);
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

function normalizeScopes(input) {
  const rawValues = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[,\s]+/)
      : [];
  const scopes = rawValues
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value) => value && ALLOWED_SCOPES.has(value));
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
  const configured = process.env.POLAR_REDIRECT_URI;
  if (configured && typeof configured === 'string' && configured.trim()) return configured.trim();
  return `${getBaseSiteUrl()}/.netlify/functions/polar-callback`;
}

function getConfiguredScopes() {
  return normalizeScopes(process.env.POLAR_SCOPES || DEFAULT_SCOPES);
}

function getOauthCredentials() {
  const clientId = process.env.POLAR_CLIENT_ID;
  const clientSecret = process.env.POLAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw createError(500, 'Missing POLAR_CLIENT_ID or POLAR_CLIENT_SECRET environment variables.');
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
  });
  return `${POLAR_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForToken({ code, redirectUri }) {
  const { clientId, clientSecret } = getOauthCredentials();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(POLAR_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : {};
  if (!response.ok) {
    const detail = data?.error_description || data?.error || rawText || `status ${response.status}`;
    throw createError(502, `Polar token exchange failed: ${detail}`);
  }
  return data;
}

async function refreshAccessToken(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw createError(409, 'Polar refresh token is missing. Reconnect Polar to keep syncing.');
  }

  const { clientId, clientSecret } = getOauthCredentials();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(POLAR_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : {};
  if (!response.ok) {
    const detail = data?.error_description || data?.error || rawText || `status ${response.status}`;
    throw createError(502, `Polar token refresh failed: ${detail}`);
  }

  return data;
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

async function ensureFreshPolarConnection(connectionRef, connection) {
  if (!connection || connection.status !== 'connected' || !connection.accessToken) {
    throw createError(409, 'Connect Polar before refreshing this health source.');
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
    accessTokenIssuedAt: refreshedAt,
    accessTokenExpiresAt: Number.isFinite(nextExpiresAt) && nextExpiresAt > refreshedAt ? nextExpiresAt : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastTokenRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
    lastError: '',
  };

  await connectionRef.set(update, { merge: true });
  return { ...connection, ...update };
}

async function polarApiRequest(accessToken, path, options = {}) {
  const url = path.startsWith('http') ? new URL(path) : new URL(`${POLAR_API_BASE_URL}${path}`);
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
  const data = rawText ? JSON.parse(rawText) : {};
  if (!response.ok) {
    const detail = data?.message || data?.error_description || data?.error || rawText || `Polar API request failed: ${path}`;
    const error = createError(response.status, detail);
    error.polarStatus = response.status;
    throw error;
  }
  return data;
}

async function registerPolarUser(accessToken, userId) {
  try {
    return await polarApiRequest(accessToken, '/users', {
      method: 'POST',
      body: { 'member-id': String(userId) },
    });
  } catch (error) {
    if (error?.polarStatus === 409) {
      return { 'member-id': String(userId), alreadyRegistered: true };
    }
    throw error;
  }
}

function buildConnectionDocId(userId) {
  return String(userId || '').trim();
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
  if (!data) return { connected: false, status: 'not_connected', provider: 'polar' };
  return {
    connected: data.status === 'connected',
    status: data.status || 'not_connected',
    provider: 'polar',
    grantedScopes: Array.isArray(data.grantedScopes) ? data.grantedScopes : [],
    requestedScopes: Array.isArray(data.requestedScopes) ? data.requestedScopes : [],
    connectedAt: data.connectedAt || null,
    disconnectedAt: data.disconnectedAt || null,
    accessTokenExpiresAt: data.accessTokenExpiresAt || null,
    polarUserId: data.polarUserId || null,
    memberId: data.memberId || null,
    firstName: data.firstName || null,
    lastWebhookAt: data.lastWebhookAt || null,
    lastWebhookType: data.lastWebhookType || null,
    pendingWebhookSync: data.pendingWebhookSync === true,
    lastError: data.lastError || '',
    redirectUri: data.redirectUri || getRedirectUri(),
  };
}

module.exports = {
  CONNECTIONS_COLLECTION,
  DEFAULT_RETURN_TO,
  OAUTH_STATES_COLLECTION,
  POLAR_API_BASE_URL,
  RESPONSE_HEADERS,
  appendQueryParams,
  buildAuthorizeUrl,
  buildConnectionDocId,
  buildPolarErrorResponse,
  buildStateToken,
  createError,
  ensureFreshPolarConnection,
  exchangeCodeForToken,
  getConfiguredScopes,
  getOauthCredentials,
  getQueryParams,
  getRedirectUri,
  normalizePolarError,
  normalizeScopes,
  parseJsonBody,
  polarApiRequest,
  redirectHtml,
  refreshAccessToken,
  registerPolarUser,
  sanitizeReturnTo,
  toConnectionStatus,
  verifyAuth,
};
