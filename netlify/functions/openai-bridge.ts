import { Handler } from '@netlify/functions';
import { admin, headers as corsHeaders } from './config/firebase';

// Basic map to enforce reasonable limits per feature.
const FEATURE_LIMITS: Record<string, { maxTokens: number; modelPattern: RegExp }> = {
  scanFood: { maxTokens: 1500, modelPattern: /gpt-4o|gpt-4/i },
  analyzeSupplementLabel: { maxTokens: 1500, modelPattern: /gpt-4o|gpt-4/i },
  analyzeWorkoutMachineScreen: { maxTokens: 1500, modelPattern: /gpt-4o|gpt-4/i },
  gradeNutritionLabel: { maxTokens: 1000, modelPattern: /gpt-4o|gpt-4/i },
  parseMacrosFromLabelImage: { maxTokens: 1000, modelPattern: /gpt-4o|gpt-4/i },
  generateResponse: { maxTokens: 2000, modelPattern: /gpt-4o|gpt-4/i }, // Nora Chat
  generateWorkout: { maxTokens: 4000, modelPattern: /gpt-4o|gpt-4/i }, // Workout Generation
  groundedFoodLookup: { maxTokens: 3000, modelPattern: /gpt-5|gpt-4|gpt-4o|o[1-4]/i },
  macraAssessMacros: { maxTokens: 2500, modelPattern: /gpt-4o|gpt-4/i },
  macraDailyInsight: { maxTokens: 1000, modelPattern: /gpt-4o|gpt-4/i },
  macraFoodJournalFeedback: { maxTokens: 1500, modelPattern: /gpt-4o|gpt-4/i },
  macraLabelScan: { maxTokens: 2200, modelPattern: /gpt-4o|gpt-4/i },
  macraLabelSupplements: { maxTokens: 2500, modelPattern: /gpt-4o|gpt-4/i },
  macraMealPlan: { maxTokens: 2000, modelPattern: /gpt-4o|gpt-4/i }, // Macra: Nora-generated meal plans
  macraMealNote: { maxTokens: 1500, modelPattern: /gpt-4o|gpt-4/i },
  noraNutritionChat: { maxTokens: 700, modelPattern: /gpt-4o|gpt-4/i }, // Macra: Nora coach Q&A
  pulsecheckSportIntelligence: { maxTokens: 8000, modelPattern: /gpt-4o|gpt-4/i },
  // Default bounds for generic actions
  default: { maxTokens: 1000, modelPattern: /gpt-4o|gpt-4|gpt-3.5/i }
};

const getHeader = (headers: Record<string, string | undefined> | undefined, headerName: string): string | undefined => {
  if (!headers) return undefined;

  const directMatch = headers[headerName];
  if (directMatch) return directMatch;

  const normalizedHeaderName = headerName.toLowerCase();
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === normalizedHeaderName);
  return matchedKey ? headers[matchedKey] : undefined;
};

const resolveOpenAIApiKey = (): string | null => {
  const configuredKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_SECRET_KEY?.trim();
  return configuredKey || null;
};

const REMOTE_BRIDGE_FEATURE_ALIASES: Record<string, string> = {
  // Local dev may relay to a deployed bridge that has not received the newest
  // feature id yet. Use a known high-token policy there to avoid truncating
  // structured JSON before this local branch is deployed.
  pulsecheckSportIntelligence: 'generateWorkout'
};

const resolveRemoteBridgeOrigin = (): string => {
  return (process.env.OPENAI_BRIDGE_FALLBACK_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai')
    .replace(/\/+$/, '');
};

const isLocalBridgeRequest = (event: { headers?: Record<string, string | undefined> }): boolean => {
  const host = (getHeader(event.headers, 'host') || '').toLowerCase();
  return host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('0.0.0.0');
};

const shouldRelayToRemoteBridge = (
  event: { headers?: Record<string, string | undefined> },
  providerApiKey: string | null
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
  openApiPath: string,
  featureId: string
) => {
  const remoteUrl = `${resolveRemoteBridgeOrigin()}/api/openai${openApiPath}`;
  const authHeader = getHeader(event.headers, 'authorization');
  const contentType = getHeader(event.headers, 'content-type') || 'application/json';
  const remoteFeatureId = REMOTE_BRIDGE_FEATURE_ALIASES[featureId] || featureId;

  console.warn('[openai-bridge] Local provider key missing; relaying request to deployed bridge.', {
    remoteUrl,
    featureId,
    remoteFeatureId
  });

  const response = await fetch(remoteUrl, {
    method: event.httpMethod,
    headers: {
      'Content-Type': contentType,
      ...(authHeader ? { Authorization: authHeader } : {}),
      'openai-organization': remoteFeatureId,
      'x-pulsecheck-original-openai-organization': featureId,
      'x-pulsecheck-firebase-mode': 'prod'
    },
    body: event.httpMethod === 'POST' ? event.body || '{}' : undefined
  });
  const data = await response.text();

  return {
    statusCode: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': response.headers.get('content-type') || 'application/json'
    },
    body: data
  };
};

const verifyAuth = async (authHeader: string | undefined): Promise<string | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    console.error('[openai-bridge] Auth verification failed:', error);
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
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // 1. Verify Authentication Layer
  const uid = await verifyAuth(getHeader(event.headers, 'authorization'));
  if (!uid) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized: Missing or invalid Firebase token' })
    };
  }

  // 2. Extract specific path suffix for OpenAI (e.g., /v1/chat/completions)
  // This supports Netlify rewrite rules (from /api/openai/v1/* to /.netlify/functions/openai-bridge)
  const pathMatch = event.path.match(/(\/v1\/.*)/);
  const openApiPath = pathMatch ? pathMatch[1] : '/v1/chat/completions';
  const openApiUrl = `https://api.openai.com${openApiPath}`;

  const featureId = getHeader(event.headers, 'openai-organization') || 'default';
  const providerApiKey = resolveOpenAIApiKey();

  if (!providerApiKey) {
    if (shouldRelayToRemoteBridge(event, providerApiKey)) {
      try {
        return await relayToRemoteBridge(event, openApiPath, featureId);
      } catch (error: any) {
        console.error('[openai-bridge] Failed to relay local request to deployed bridge:', error);
        return {
          statusCode: 502,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'OpenAI bridge relay failed. Check deployed bridge availability.' })
        };
      }
    }

    console.error('[openai-bridge] Missing provider API key. Configure OPENAI_API_KEY or OPEN_AI_SECRET_KEY.');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'OpenAI bridge misconfigured: missing OPENAI_API_KEY or OPEN_AI_SECRET_KEY' })
    };
  }
  
  let parsedBody: any;
  if (event.httpMethod === 'POST') {
    try {
      parsedBody = JSON.parse(event.body || '{}');

      // 3. Optional Rate-Limiting & Security Bounds
      const featureConfig = FEATURE_LIMITS[featureId] || FEATURE_LIMITS['default'];
      // Reject explicitly expensive unapproved models via proxy
      if (parsedBody.model && !featureConfig.modelPattern.test(parsedBody.model)) {
        console.warn(`[openai-bridge] UID ${uid} attempted to use forbidden model: ${parsedBody.model} for feature: ${featureId}`);
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Forbidden model' })
        };
      }

      // Automatically cap maximum output tokens to prevent runaway quota abuse
      const maxTokensBound = process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS) : 4000;
      const effectiveTokenCap = Math.min(featureConfig.maxTokens, Number.isFinite(maxTokensBound) ? maxTokensBound : 4000);

      if (typeof parsedBody.max_output_tokens === 'number') {
        parsedBody.max_output_tokens = Math.min(parsedBody.max_output_tokens, effectiveTokenCap);
      } else if (typeof parsedBody.max_completion_tokens === 'number') {
        parsedBody.max_completion_tokens = Math.min(parsedBody.max_completion_tokens, effectiveTokenCap);
      } else if (!parsedBody.max_tokens || parsedBody.max_tokens > effectiveTokenCap) {
        parsedBody.max_tokens = effectiveTokenCap;
      }

    } catch (_error) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Bad Request: Invalid JSON payload' })
      };
    }
  }

  // 4. Securely Forward the Request to OpenAI
  try {
    const fetchOptions: RequestInit = {
      method: event.httpMethod,
      headers: {
        'Content-Type': getHeader(event.headers, 'content-type') || 'application/json',
        'Authorization': `Bearer ${providerApiKey}`
      }
    };

    if (event.httpMethod === 'POST') {
      fetchOptions.body = JSON.stringify(parsedBody);
    }

    const response = await fetch(openApiUrl, fetchOptions);
    const data = await response.text();

    if (!response.ok) {
      console.error('[openai-bridge] OpenAI upstream error:', {
        status: response.status,
        path: openApiPath,
        featureId,
        body: data.slice(0, 1000)
      });
    }

    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('content-type') || 'application/json'
      },
      body: data
    };
  } catch (error: any) {
    console.error('[openai-bridge] Failed to proxy request to OpenAI:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal Gateway Error contacting OpenAI' })
    };
  }
};
