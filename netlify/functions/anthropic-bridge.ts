import { Handler } from '@netlify/functions';
import { admin, headers as corsHeaders } from './config/firebase';
import { ANTHROPIC_FEATURE_LIMITS } from '../../src/api/anthropic/featureRouting';

// Anthropic Messages API endpoint and required headers.
// https://docs.anthropic.com/en/api/messages
const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';

// Header callers set to identify the feature (mirrors `openai-organization`).
const FEATURE_HEADER = 'anthropic-organization';

const getHeader = (
  headers: Record<string, string | undefined> | undefined,
  headerName: string,
): string | undefined => {
  if (!headers) return undefined;
  const directMatch = headers[headerName];
  if (directMatch) return directMatch;
  const normalizedHeaderName = headerName.toLowerCase();
  const matchedKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === normalizedHeaderName,
  );
  return matchedKey ? headers[matchedKey] : undefined;
};

const resolveAnthropicApiKey = (): string | null => {
  return process.env.ANTHROPIC_API_KEY?.trim() || null;
};

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const isLocalBridgeRequest = (event: { headers?: Record<string, string | undefined> }): boolean => {
  const host = (getHeader(event.headers, 'host') || '').toLowerCase();
  return Array.from(LOCALHOST_HOSTNAMES).some((h) => host.includes(h));
};

const resolveRemoteBridgeOrigin = (): string =>
  (process.env.ANTHROPIC_BRIDGE_FALLBACK_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://fitwithpulse.ai').replace(/\/+$/, '');

const shouldRelayToRemoteBridge = (
  event: { headers?: Record<string, string | undefined> },
  providerApiKey: string | null,
): boolean => {
  if (providerApiKey) return false;
  if (!isLocalBridgeRequest(event)) return false;
  try {
    const remoteHost = new URL(resolveRemoteBridgeOrigin()).host.toLowerCase();
    const localHost = (getHeader(event.headers, 'host') || '').toLowerCase();
    return Boolean(remoteHost) && remoteHost !== localHost;
  } catch (_error) {
    return false;
  }
};

const relayToRemoteBridge = async (
  event: Parameters<Handler>[0],
  apiPath: string,
  featureId: string,
) => {
  const remoteUrl = `${resolveRemoteBridgeOrigin()}/api/anthropic${apiPath}`;
  const authHeader = getHeader(event.headers, 'authorization');
  const contentType = getHeader(event.headers, 'content-type') || 'application/json';

  console.warn('[anthropic-bridge] Local provider key missing; relaying to deployed bridge.', {
    remoteUrl,
    featureId,
  });

  const response = await fetch(remoteUrl, {
    method: event.httpMethod,
    headers: {
      'Content-Type': contentType,
      ...(authHeader ? { Authorization: authHeader } : {}),
      [FEATURE_HEADER]: featureId,
      'x-pulsecheck-firebase-mode': 'prod',
    },
    body: event.httpMethod === 'POST' ? event.body || '{}' : undefined,
  });
  const data = await response.text();
  return {
    statusCode: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': response.headers.get('content-type') || 'application/json',
    },
    body: data,
  };
};

const verifyAuth = async (authHeader: string | undefined): Promise<string | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    console.error('[anthropic-bridge] Auth verification failed:', error);
    return null;
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const uid = await verifyAuth(getHeader(event.headers, 'authorization'));
  if (!uid) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized: Missing or invalid Firebase token' }),
    };
  }

  const pathMatch = event.path.match(/(\/v1\/.*)/);
  const apiPath = pathMatch ? pathMatch[1] : '/v1/messages';
  const upstreamUrl = `${ANTHROPIC_API_BASE}${apiPath}`;

  const featureId = getHeader(event.headers, FEATURE_HEADER) || 'default';
  const providerApiKey = resolveAnthropicApiKey();

  if (!providerApiKey) {
    if (shouldRelayToRemoteBridge(event, providerApiKey)) {
      try {
        return await relayToRemoteBridge(event, apiPath, featureId);
      } catch (error: any) {
        console.error('[anthropic-bridge] Failed to relay local request to deployed bridge:', error);
        return {
          statusCode: 502,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Anthropic bridge relay failed. Check deployed bridge availability.',
          }),
        };
      }
    }
    console.error('[anthropic-bridge] Missing ANTHROPIC_API_KEY.');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Anthropic bridge misconfigured: missing ANTHROPIC_API_KEY' }),
    };
  }

  let parsedBody: any;
  if (event.httpMethod === 'POST') {
    try {
      parsedBody = JSON.parse(event.body || '{}');

      const featureConfig =
        ANTHROPIC_FEATURE_LIMITS[featureId] || ANTHROPIC_FEATURE_LIMITS['default'];

      if (parsedBody.model && !featureConfig.modelPattern.test(parsedBody.model)) {
        console.warn(
          `[anthropic-bridge] UID ${uid} attempted to use forbidden model: ${parsedBody.model} for feature: ${featureId}`,
        );
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Forbidden model' }),
        };
      }

      // Cap output tokens. Messages API uses `max_tokens` (required field) —
      // there is no `max_completion_tokens` / `max_output_tokens` in this API.
      const envCap = process.env.ANTHROPIC_MAX_TOKENS
        ? parseInt(process.env.ANTHROPIC_MAX_TOKENS)
        : 16000;
      const effectiveCap = Math.min(
        featureConfig.maxTokens,
        Number.isFinite(envCap) ? envCap : 16000,
      );
      if (typeof parsedBody.max_tokens !== 'number' || parsedBody.max_tokens > effectiveCap) {
        parsedBody.max_tokens = effectiveCap;
      }
    } catch (_error) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Bad Request: Invalid JSON payload' }),
      };
    }
  }

  try {
    const fetchOptions: RequestInit = {
      method: event.httpMethod,
      headers: {
        'Content-Type': getHeader(event.headers, 'content-type') || 'application/json',
        'x-api-key': providerApiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
    };
    if (event.httpMethod === 'POST') {
      fetchOptions.body = JSON.stringify(parsedBody);
    }

    const response = await fetch(upstreamUrl, fetchOptions);
    const data = await response.text();

    if (!response.ok) {
      console.error('[anthropic-bridge] Anthropic upstream error:', {
        status: response.status,
        path: apiPath,
        featureId,
        body: data.slice(0, 1000),
      });
    }

    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: data,
    };
  } catch (error: any) {
    console.error('[anthropic-bridge] Failed to proxy request to Anthropic:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal Gateway Error contacting Anthropic' }),
    };
  }
};
