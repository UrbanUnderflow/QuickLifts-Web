import { Handler } from '@netlify/functions';
import { admin, headers as corsHeaders } from './config/firebase';
import {
  callAnthropic,
  buildAdminAuditLogger,
  ServerBridgeFeatureNotRegisteredError,
  ServerBridgeForbiddenModelError,
  ServerBridgeProviderMismatchError,
} from '../../src/api/anthropic/serverBridge';

// =============================================================================
// anthropic-bridge — HTTP transport for Anthropic traffic from clients that
// can't safely hold the API key (browser, iOS).
//
// This file used to do everything: auth, validation, max-tokens cap, model
// pattern check, and the upstream Anthropic call. After the Core refactor
// (`src/api/anthropic/serverBridge.ts`), this is a thin layer over the Core:
//
//   1. Parse Firebase auth (clients are not pre-trusted)
//   2. Parse JSON body
//   3. Delegate to Core `callAnthropic` — which handles validation, cap,
//      model gate, SDK call, and audit log
//   4. Translate the Core result + Core errors into HTTP responses
//
// Server-side callers (Macra, Phase C, Phase D) skip this transport entirely
// and call Core directly — same gate, no HTTP round-trip.
//
// Local-dev relay: kept intact. When this function runs locally without
// `ANTHROPIC_API_KEY`, it forwards to the deployed bridge so engineers can
// test without copying secrets.
// =============================================================================

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
  const featureId = getHeader(event.headers, FEATURE_HEADER) || 'default';
  const providerApiKey = resolveAnthropicApiKey();

  // Local-dev relay path is preserved. When dev shell has no key, forward
  // to deployed bridge.
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

  // Only `/v1/messages` is supported via Core for now (this is what every
  // existing client caller hits). Other API paths can be added later if a
  // client needs them — Core would grow a dispatch map.
  if (event.httpMethod !== 'POST' || !apiPath.startsWith('/v1/messages')) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        error: `Unsupported path '${apiPath}'. Bridge currently supports POST /v1/messages only.`,
      }),
    };
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(event.body || '{}');
  } catch (_error) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Bad Request: Invalid JSON payload' }),
    };
  }

  // Translate the raw HTTP body (Anthropic Messages API shape) into the
  // Core's typed request envelope. Validation + max-tokens cap + model
  // gate happen inside `callAnthropic`. We pass `null` audit logger here
  // because the HTTP path doesn't have a Firestore admin client wired
  // by default in this transport — the audit log can be opted in once
  // we standardize firestore admin init across functions. Server-side
  // callers (Macra, Phase C, Phase D) DO pass an audit logger.
  try {
    const result = await callAnthropic(
      {
        featureId,
        system: typeof parsedBody.system === 'string' ? parsedBody.system : '',
        messages: Array.isArray(parsedBody.messages) ? parsedBody.messages : [],
        maxTokens: typeof parsedBody.max_tokens === 'number' ? parsedBody.max_tokens : undefined,
        model: typeof parsedBody.model === 'string' ? parsedBody.model : undefined,
        tools: parsedBody.tools,
        toolChoice: parsedBody.tool_choice,
        callerContext: { transport: 'http', uid },
      },
      { auditLogger: null },
    );

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(result.raw),
    };
  } catch (error: any) {
    if (error instanceof ServerBridgeFeatureNotRegisteredError) {
      console.warn(`[anthropic-bridge] uid=${uid} unknown featureId=${featureId}`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Unknown feature: ${featureId}` }),
      };
    }
    if (error instanceof ServerBridgeProviderMismatchError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: error.message }),
      };
    }
    if (error instanceof ServerBridgeForbiddenModelError) {
      console.warn(
        `[anthropic-bridge] uid=${uid} attempted forbidden model: ${error.attemptedModel} for feature: ${featureId}`,
      );
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden model' }),
      };
    }
    console.error('[anthropic-bridge] Failed to proxy request to Anthropic:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal Gateway Error contacting Anthropic',
        detail: error?.message || String(error),
      }),
    };
  }
};
