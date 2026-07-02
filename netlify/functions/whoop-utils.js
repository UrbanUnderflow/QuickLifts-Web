const crypto = require('crypto');
const { admin, headers } = require('./config/firebase');
const { getSecretManagerSecret } = require('./google-secret-manager-utils');

const WHOOP_AUTHORIZE_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE_URL = 'https://api.prod.whoop.com/developer';
const DEFAULT_WHOOP_REDIRECT_URI = 'https://fitwithpulse.ai/.netlify/functions/whoop-callback';
const DEFAULT_WHOOP_CLIENT_ID = '7eda3ec3-47c9-46a5-be57-6c4612bd9b82';
const DEFAULT_WHOOP_CLIENT_SECRET_NAME = 'WHOOP_CLIENT_SECRET';
const DEFAULT_WHOOP_WEBHOOK_SECRET_NAME = 'WHOOP_WEBHOOK_SECRET';
const DEFAULT_WHOOP_SECRET_MANAGER_PROJECT_ID = 'quicklifts-dd3f1';

const DEFAULT_SCOPES = [
  'offline',
  'read:profile',
  'read:body_measurement',
  'read:cycles',
  'read:recovery',
  'read:sleep',
  'read:workout',
];
const ALLOWED_SCOPES = new Set(DEFAULT_SCOPES);
const DEFAULT_RETURN_TO = '/PulseCheck/whoop';
const OAUTH_STATES_COLLECTION = 'pulsecheck-oauth-states';
const CONNECTIONS_COLLECTION = 'pulsecheck-whoop-connections';
const TOKEN_REFRESH_SKEW_SECONDS = 5 * 60;
let cachedOauthCredentials = null;
let cachedWebhookSecret = null;

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': headers['Access-Control-Allow-Headers'] || 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function createError(statusCode, message, errorCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (errorCode) error.errorCode = errorCode;
  return error;
}

function normalizeWhoopError(error, fallback = {}) {
  const rawMessage = String(error?.message || '').trim();
  const normalizedMessage = rawMessage.toLowerCase();
  const statusCode = Number.isFinite(error?.statusCode) ? error.statusCode : fallback.statusCode || 500;
  const fallbackCode = fallback.errorCode || 'WHOOP_UNKNOWN';
  const fallbackMessage = fallback.message || 'We could not complete the WHOOP request right now.';

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
    return { statusCode: 401, errorCode: 'WHOOP_AUTH_REQUIRED', message: 'Sign in to keep using WHOOP.' };
  }
  if (normalizedMessage.includes('missing whoop_client_id') || normalizedMessage.includes('missing whoop_client_secret')) {
    return { statusCode: 500, errorCode: 'WHOOP_CONFIG_UNAVAILABLE', message: 'The WHOOP connection is unavailable right now.' };
  }
  if (normalizedMessage.includes('token exchange failed')) {
    return { statusCode: 502, errorCode: 'WHOOP_CALLBACK_FAILED', message: 'We could not finish the WHOOP connection right now.' };
  }
  if (normalizedMessage.includes('token refresh failed')) {
    return { statusCode: 502, errorCode: 'WHOOP_SYNC_FAILED', message: 'We could not refresh your WHOOP data right now.' };
  }
  if (normalizedMessage.includes('connection request') && normalizedMessage.includes('expired')) {
    return { statusCode: 400, errorCode: 'WHOOP_CALLBACK_EXPIRED', message: 'This WHOOP connection request expired. Start the connection again.' };
  }
  if (normalizedMessage.includes('connection request') && normalizedMessage.includes('not found')) {
    return { statusCode: 400, errorCode: 'WHOOP_CALLBACK_INVALID_STATE', message: 'This WHOOP connection request is no longer active.' };
  }
  if (normalizedMessage.includes('invalid whoop webhook signature')) {
    return { statusCode: 401, errorCode: 'WHOOP_WEBHOOK_SIGNATURE_INVALID', message: 'Invalid WHOOP webhook signature.' };
  }

  return {
    statusCode,
    errorCode: fallbackCode,
    message: typeof error?.publicMessage === 'string' && error.publicMessage.trim()
      ? error.publicMessage.trim()
      : fallbackMessage,
  };
}

function buildWhoopErrorResponse(error, fallback) {
  const resolved = normalizeWhoopError(error, fallback);
  return {
    statusCode: resolved.statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({ error: resolved.message, errorCode: resolved.errorCode }),
  };
}

function parseJsonBody(event) {
  if (!event?.body) return {};
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    throw createError(400, 'Request body must be valid JSON.', 'WHOOP_INVALID_REQUEST');
  }
}

function getRawBody(event) {
  if (!event?.body) return '';
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : String(event.body);
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
    .map((value) => String(value || '').trim())
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
  } catch {
    return DEFAULT_RETURN_TO;
  }
  return DEFAULT_RETURN_TO;
}

function getBaseSiteUrl() {
  return (process.env.SITE_URL || process.env.URL || 'https://fitwithpulse.ai').replace(/\/+$/, '');
}

function getRedirectUri() {
  const configured = process.env.WHOOP_REDIRECT_URI;
  if (configured && typeof configured === 'string' && configured.trim()) return configured.trim();
  return DEFAULT_WHOOP_REDIRECT_URI;
}

function getConfiguredScopes() {
  return normalizeScopes(process.env.WHOOP_SCOPES || DEFAULT_SCOPES);
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getWhoopSecretManagerProjectId() {
  return normalizeString(process.env.WHOOP_SECRET_MANAGER_PROJECT_ID)
    || normalizeString(process.env.GOOGLE_SECRET_MANAGER_PROJECT_ID)
    || DEFAULT_WHOOP_SECRET_MANAGER_PROJECT_ID;
}

function getConfiguredClientId() {
  return normalizeString(process.env.WHOOP_CLIENT_ID) || DEFAULT_WHOOP_CLIENT_ID;
}

function parseOauthSecretPayload(rawValue, fallbackClientId = '') {
  const trimmed = normalizeString(rawValue);
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') return null;

    const clientId = normalizeString(parsed.client_id)
      || normalizeString(parsed.clientId)
      || normalizeString(parsed.WHOOP_CLIENT_ID)
      || fallbackClientId;
    const clientSecret = normalizeString(parsed.client_secret)
      || normalizeString(parsed.clientSecret)
      || normalizeString(parsed.WHOOP_CLIENT_SECRET)
      || normalizeString(parsed.secret);
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
  } catch {
    return fallbackClientId ? { clientId: fallbackClientId, clientSecret: trimmed } : null;
  }
}

function getOauthCredentialsFromEnv() {
  const clientId = getConfiguredClientId();
  const clientSecret = normalizeString(process.env.WHOOP_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function shouldAllowEnvSecretFallback() {
  const configured = normalizeString(process.env.WHOOP_ALLOW_ENV_CREDENTIALS_FALLBACK).toLowerCase();
  if (['true', '1', 'yes'].includes(configured)) return true;
  if (['false', '0', 'no'].includes(configured)) return false;
  return process.env.NODE_ENV !== 'production'
    && process.env.CONTEXT !== 'production'
    && process.env.NETLIFY !== 'true';
}

async function getOauthCredentials() {
  if (cachedOauthCredentials) return cachedOauthCredentials;

  const clientId = getConfiguredClientId();
  const secretName = normalizeString(process.env.WHOOP_CLIENT_SECRET_NAME)
    || normalizeString(process.env.WHOOP_OAUTH_SECRET_NAME)
    || DEFAULT_WHOOP_CLIENT_SECRET_NAME;
  const secretProjectId = getWhoopSecretManagerProjectId();
  let secretError = null;

  if (secretName) {
    try {
      const secretValue = await getSecretManagerSecret(secretName, { projectId: secretProjectId });
      const secretCredentials = parseOauthSecretPayload(secretValue, clientId);
      if (secretCredentials) {
        cachedOauthCredentials = secretCredentials;
        return cachedOauthCredentials;
      }
      secretError = new Error(`Secret Manager secret ${secretName} is missing a WHOOP client secret.`);
    } catch (error) {
      secretError = error;
    }
  }

  const envCredentials = getOauthCredentialsFromEnv();
  if (envCredentials && shouldAllowEnvSecretFallback()) {
    cachedOauthCredentials = envCredentials;
    return cachedOauthCredentials;
  }

  const detail = secretError
    ? `, and failed to load WHOOP OAuth credentials from Secret Manager: ${secretError.message}`
    : '.';
  throw createError(
    500,
    `Missing WHOOP_CLIENT_ID or WHOOP_CLIENT_SECRET configuration${detail}`,
    'WHOOP_CONFIG_UNAVAILABLE'
  );
}

async function verifyAuth(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Missing Authorization header', 'WHOOP_AUTH_REQUIRED');
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
  return `${WHOOP_AUTHORIZE_URL}?${params.toString()}`;
}

async function tokenRequest(body) {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : {};
  if (!response.ok) {
    const detail = data?.error_description || data?.error || rawText || `status ${response.status}`;
    throw createError(502, `WHOOP token request failed: ${detail}`, 'WHOOP_TOKEN_FAILED');
  }
  return data;
}

async function exchangeCodeForToken({ code, redirectUri }) {
  const { clientId, clientSecret } = await getOauthCredentials();
  return tokenRequest(new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  }));
}

async function refreshAccessToken(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw createError(409, 'WHOOP refresh token is missing. Reconnect WHOOP to keep syncing.', 'WHOOP_RECONNECT_REQUIRED');
  }
  const { clientId, clientSecret } = await getOauthCredentials();
  return tokenRequest(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  }));
}

function timestampToEpochSeconds(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value > 9999999999 ? Math.floor(value / 1000) : Math.floor(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }
  if (typeof value.toMillis === 'function') return Math.floor(value.toMillis() / 1000);
  if (typeof value.seconds === 'number') return value.seconds;
  return null;
}

function resolveTokenExpirySeconds(connection = {}) {
  return timestampToEpochSeconds(connection.accessTokenExpiresAt);
}

async function ensureFreshAccessToken({ firestore, connectionRef, connection }) {
  const expiry = resolveTokenExpirySeconds(connection);
  const now = Math.round(Date.now() / 1000);
  if (connection?.accessToken && (!expiry || expiry - TOKEN_REFRESH_SKEW_SECONDS > now)) {
    return connection;
  }
  const tokenData = await refreshAccessToken(connection.refreshToken);
  const nowMs = Date.now();
  const nextConnection = {
    ...connection,
    accessToken: tokenData.access_token || connection.accessToken,
    refreshToken: tokenData.refresh_token || connection.refreshToken,
    tokenType: tokenData.token_type || connection.tokenType || 'bearer',
    accessTokenExpiresAt: typeof tokenData.expires_in === 'number' ? nowMs + tokenData.expires_in * 1000 : connection.accessTokenExpiresAt || null,
    accessTokenIssuedAt: nowMs,
    updatedAt: nowMs,
    lastError: '',
    lastErrorAt: null,
  };
  if (firestore && connectionRef) {
    await connectionRef.set({
      accessToken: nextConnection.accessToken,
      refreshToken: nextConnection.refreshToken,
      tokenType: nextConnection.tokenType,
      accessTokenExpiresAt: nextConnection.accessTokenExpiresAt,
      accessTokenIssuedAt: nextConnection.accessTokenIssuedAt,
      updatedAt: nextConnection.updatedAt,
      lastError: '',
      lastErrorAt: null,
    }, { merge: true });
  }
  return nextConnection;
}

async function whoopApiRequest(accessToken, path, options = {}) {
  if (!accessToken) throw createError(401, 'WHOOP access token is missing.', 'WHOOP_AUTH_REQUIRED');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${WHOOP_API_BASE_URL}${normalizedPath}`);
  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const response = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    body: options.body,
  });
  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : {};
  if (!response.ok) {
    const detail = data?.error_description || data?.error || rawText || `status ${response.status}`;
    const error = createError(response.status >= 500 ? 502 : response.status, `WHOOP API request failed: ${detail}`, 'WHOOP_API_FAILED');
    error.whoopStatus = response.status;
    throw error;
  }
  return data;
}

function appendQueryParams(target, params) {
  try {
    const url = new URL(target);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
    return url.toString();
  } catch {
    const [base, queryString = ''] = String(target || DEFAULT_RETURN_TO).split('?');
    const search = new URLSearchParams(queryString);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) search.set(key, String(value));
    });
    const next = search.toString();
    return next ? `${base}?${next}` : base;
  }
}

function redirectHtml({ title, message, redirectTo }) {
  const safeTitle = String(title || 'WHOOP').replace(/[<>&"]/g, '');
  const safeMessage = String(message || '').replace(/[<>&"]/g, '');
  const safeRedirect = String(redirectTo || DEFAULT_RETURN_TO).replace(/"/g, '&quot;');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><meta http-equiv="refresh" content="0;url=${safeRedirect}"></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#050507;color:white;padding:24px;"><h1>${safeTitle}</h1><p>${safeMessage}</p><p><a style="color:#c4ff00" href="${safeRedirect}">Return to PulseCheck</a></p></body></html>`;
}

function buildConnectionDocId(userId) {
  return String(userId || '').trim();
}

function toConnectionStatus(data) {
  if (!data || data.status === 'disconnected') {
    return { connected: false, status: data?.status || 'not_connected', provider: 'whoop', sourceFamily: 'whoop' };
  }
  return {
    connected: data.status === 'connected',
    status: data.status || 'unknown',
    provider: 'whoop',
    sourceFamily: 'whoop',
    requestedScopes: data.requestedScopes || [],
    grantedScopes: data.grantedScopes || [],
    connectedAt: data.connectedAt || null,
    disconnectedAt: data.disconnectedAt || null,
    updatedAt: data.updatedAt || null,
    whoopUserId: data.whoopUserId || data.userIdExternal || null,
    email: data.email || null,
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    lastSuccessfulSyncAt: data.lastSuccessfulSyncAt || null,
    lastImportedDomains: data.lastImportedDomains || [],
    lastError: data.lastError || '',
    lastErrorAt: data.lastErrorAt || null,
  };
}

function getHeader(headers = {}, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (String(key).toLowerCase() === target) return Array.isArray(value) ? value[0] : value;
  }
  return '';
}

function buildWebhookSignature({ timestamp, rawBody, secret }) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('base64');
}

async function getWebhookSecret() {
  if (cachedWebhookSecret) return cachedWebhookSecret;

  const secretName = normalizeString(process.env.WHOOP_WEBHOOK_SECRET_NAME)
    || DEFAULT_WHOOP_WEBHOOK_SECRET_NAME;
  const secretProjectId = getWhoopSecretManagerProjectId();
  let secretError = null;

  if (secretName) {
    try {
      const secretValue = normalizeString(await getSecretManagerSecret(secretName, { projectId: secretProjectId }));
      if (secretValue) {
        cachedWebhookSecret = secretValue;
        return cachedWebhookSecret;
      }
      secretError = new Error(`Secret Manager secret ${secretName} returned empty payload.`);
    } catch (error) {
      secretError = error;
    }
  }

  const envSecret = normalizeString(process.env.WHOOP_WEBHOOK_SECRET);
  if (envSecret && shouldAllowEnvSecretFallback()) {
    cachedWebhookSecret = envSecret;
    return cachedWebhookSecret;
  }

  try {
    const oauthCredentials = await getOauthCredentials();
    if (oauthCredentials.clientSecret) {
      cachedWebhookSecret = oauthCredentials.clientSecret;
      return cachedWebhookSecret;
    }
  } catch (error) {
    secretError = secretError || error;
  }

  const detail = secretError
    ? ` Failed to load WHOOP webhook secret from Secret Manager: ${secretError.message}`
    : '';
  throw createError(
    500,
    `Missing WHOOP_WEBHOOK_SECRET configuration.${detail}`,
    'WHOOP_CONFIG_UNAVAILABLE'
  );
}

function verifyWebhookSignature({ headers = {}, rawBody = '', secret }) {
  if (!secret) throw createError(500, 'Missing WHOOP_WEBHOOK_SECRET environment variable.', 'WHOOP_CONFIG_UNAVAILABLE');
  const signature = String(getHeader(headers, 'X-WHOOP-Signature') || '').trim();
  const timestamp = String(getHeader(headers, 'X-WHOOP-Signature-Timestamp') || '').trim();
  if (!signature || !timestamp) return false;
  const expected = buildWebhookSignature({ timestamp, rawBody, secret });
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = {
  WHOOP_API_BASE_URL,
  WHOOP_AUTHORIZE_URL,
  WHOOP_TOKEN_URL,
  DEFAULT_RETURN_TO,
  DEFAULT_SCOPES,
  DEFAULT_WHOOP_REDIRECT_URI,
  OAUTH_STATES_COLLECTION,
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  appendQueryParams,
  buildAuthorizeUrl,
  buildConnectionDocId,
  buildStateToken,
  buildWebhookSignature,
  buildWhoopErrorResponse,
  createError,
  ensureFreshAccessToken,
  exchangeCodeForToken,
  getConfiguredScopes,
  getOauthCredentials,
  getWebhookSecret,
  getQueryParams,
  getRawBody,
  getRedirectUri,
  normalizeScopes,
  normalizeWhoopError,
  parseJsonBody,
  redirectHtml,
  refreshAccessToken,
  sanitizeReturnTo,
  timestampToEpochSeconds,
  toConnectionStatus,
  verifyAuth,
  verifyWebhookSignature,
  whoopApiRequest,
};
