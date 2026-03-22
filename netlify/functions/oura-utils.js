const crypto = require('crypto');
const { admin, headers } = require('./config/firebase');

const OURA_AUTHORIZE_URL = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';
const OURA_REVOKE_URL = 'https://api.ouraring.com/oauth/revoke';

const DEFAULT_SCOPES = ['daily'];
const ALLOWED_SCOPES = new Set([
  'email',
  'personal',
  'daily',
  'heartrate',
  'workout',
  'tag',
  'session',
  'spo2',
]);

const DEFAULT_RETURN_TO = '/PulseCheck/oura';
const OAUTH_STATES_COLLECTION = 'pulsecheck-oauth-states';
const CONNECTIONS_COLLECTION = 'pulsecheck-oura-connections';

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeOuraError(error, fallback = {}) {
  const rawMessage = String(error?.message || '').trim();
  const normalizedMessage = rawMessage.toLowerCase();
  const statusCode = Number.isFinite(error?.statusCode) ? error.statusCode : fallback.statusCode || 500;
  const fallbackCode = fallback.errorCode || 'OURA_UNKNOWN';
  const fallbackMessage = fallback.message || 'We could not complete the Oura request right now.';

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
      errorCode: 'OURA_AUTH_REQUIRED',
      message: 'Sign in to PulseCheck to keep using Oura.',
    };
  }

  if (normalizedMessage.includes('request body must be valid json')) {
    return {
      statusCode: 400,
      errorCode: 'OURA_INVALID_REQUEST',
      message: 'This Oura request was missing some details. Please try again.',
    };
  }

  if (
    normalizedMessage.includes('missing oura_client_id')
    || normalizedMessage.includes('missing oura_client_secret')
    || normalizedMessage.includes('environment variables')
  ) {
    return {
      statusCode: 500,
      errorCode: 'OURA_CONFIG_UNAVAILABLE',
      message: 'The Oura connection is unavailable right now.',
    };
  }

  if (normalizedMessage.includes('token exchange failed')) {
    return {
      statusCode: 502,
      errorCode: 'OURA_CALLBACK_FAILED',
      message: 'We could not finish the Oura connection right now.',
    };
  }

  if (normalizedMessage.includes('refresh oura access token')) {
    return {
      statusCode: 502,
      errorCode: 'OURA_SYNC_FAILED',
      message: 'We could not refresh your Oura recovery data right now.',
    };
  }

  if (normalizedMessage.includes('revoke failed')) {
    return {
      statusCode: 502,
      errorCode: 'OURA_DISCONNECT_FAILED',
      message: 'We could not disconnect Oura right now.',
    };
  }

  if (normalizedMessage.includes('connection request') && normalizedMessage.includes('expired')) {
    return {
      statusCode: 400,
      errorCode: 'OURA_CALLBACK_EXPIRED',
      message: 'This Oura connection request expired. Start the connection again.',
    };
  }

  if (normalizedMessage.includes('connection request') && normalizedMessage.includes('not found')) {
    return {
      statusCode: 400,
      errorCode: 'OURA_CALLBACK_INVALID_STATE',
      message: 'This Oura connection request is no longer active.',
    };
  }

  if (normalizedMessage.includes('initializeapp') || normalizedMessage.includes('firebase app')) {
    return {
      statusCode: 503,
      errorCode: 'OURA_FIREBASE_NOT_READY',
      message: fallbackMessage,
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

function buildOuraErrorResponse(error, fallback) {
  const resolved = normalizeOuraError(error, fallback);
  return {
    statusCode: resolved.statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({
      error: resolved.message,
      errorCode: resolved.errorCode,
    }),
  };
}

function getQueryParams(event) {
  return event?.queryStringParameters || {};
}

function parseJsonBody(event) {
  if (!event?.body) return {};
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (error) {
    throw createError(400, 'Request body must be valid JSON.');
  }
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
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'pulsecheck:' || parsed.protocol === 'pulse:') {
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
  const configured = process.env.OURA_REDIRECT_URI;
  if (configured && typeof configured === 'string' && configured.trim()) {
    return configured.trim();
  }

  return `${getBaseSiteUrl()}/.netlify/functions/oura-callback`;
}

function getConfiguredScopes() {
  return normalizeScopes(process.env.OURA_SCOPES || DEFAULT_SCOPES);
}

function getOauthCredentials() {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw createError(500, 'Missing OURA_CLIENT_ID or OURA_CLIENT_SECRET environment variables.');
  }

  return { clientId, clientSecret };
}

async function verifyAuth(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Missing Authorization header');
  }

  const idToken = authHeader.slice('Bearer '.length);
  return admin.auth().verifyIdToken(idToken);
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

  return `${OURA_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForToken({ code, redirectUri }) {
  const { clientId, clientSecret } = getOauthCredentials();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const rawText = await response.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    data = { rawText };
  }

  if (!response.ok) {
    const detail =
      data?.error_description ||
      data?.error ||
      rawText ||
      `Token exchange failed with status ${response.status}`;
    throw createError(502, `Oura token exchange failed: ${detail}`);
  }

  return data;
}

async function revokeAccessToken(accessToken) {
  if (!accessToken) return;

  const response = await fetch(`${OURA_REVOKE_URL}?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    throw createError(502, `Oura revoke failed: ${rawText || response.statusText}`);
  }
}

function buildConnectionDocId(userId) {
  return String(userId || '').trim();
}

function appendQueryParams(urlString, params) {
  const url = new URL(urlString, getBaseSiteUrl());
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function redirectHtml({ title, message, redirectTo }) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeRedirect = escapeHtml(redirectTo);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeTitle}</title>
    <meta http-equiv="refresh" content="0;url=${safeRedirect}" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #05070c;
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(560px, calc(100vw - 32px));
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        background: rgba(9, 19, 38, 0.96);
        padding: 28px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.35);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 1.4rem;
      }
      p {
        margin: 0;
        line-height: 1.6;
        color: #cbd5e1;
      }
      a {
        color: #e0fe10;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <p style="margin-top:16px;">If you are not redirected automatically, <a href="${safeRedirect}">continue here</a>.</p>
    </div>
    <script>window.location.replace(${JSON.stringify(redirectTo)});</script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toConnectionStatus(data) {
  if (!data) {
    return {
      connected: false,
      status: 'not_connected',
      provider: 'oura',
    };
  }

  return {
    connected: data.status === 'connected',
    status: data.status || 'not_connected',
    provider: 'oura',
    grantedScopes: Array.isArray(data.grantedScopes) ? data.grantedScopes : [],
    requestedScopes: Array.isArray(data.requestedScopes) ? data.requestedScopes : [],
    connectedAt: data.connectedAt || null,
    disconnectedAt: data.disconnectedAt || null,
    accessTokenExpiresAt: data.accessTokenExpiresAt || null,
    lastError: data.lastError || '',
    redirectUri: data.redirectUri || getRedirectUri(),
  };
}

module.exports = {
  CONNECTIONS_COLLECTION,
  DEFAULT_RETURN_TO,
  OAUTH_STATES_COLLECTION,
  RESPONSE_HEADERS,
  appendQueryParams,
  buildAuthorizeUrl,
  buildConnectionDocId,
  buildOuraErrorResponse,
  buildStateToken,
  createError,
  exchangeCodeForToken,
  getBaseSiteUrl,
  getConfiguredScopes,
  getOauthCredentials,
  getQueryParams,
  getRedirectUri,
  normalizeScopes,
  parseJsonBody,
  redirectHtml,
  revokeAccessToken,
  sanitizeReturnTo,
  normalizeOuraError,
  toConnectionStatus,
  verifyAuth,
};
