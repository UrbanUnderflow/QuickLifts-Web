import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';
import { getFeatureRouting } from '../../src/api/anthropic/featureRouting';
import {
  buildAdminFallbackLogger,
  callWithFallback,
} from '../../src/api/anthropic/callWithFallback';
import {
  ANTHROPIC_API_VERSION,
  translateAnthropicToOpenAI,
  translateOpenAIToAnthropic,
} from '../../src/api/anthropic/bridgeTranslation';
import { safeErrorBody, safeErrorResponse } from './utils/safeErrorResponse';

// Basic map to enforce reasonable limits per feature.
const FEATURE_LIMITS: Record<string, { maxTokens: number; modelPattern: RegExp }> = {
  scanFood: { maxTokens: 1500, modelPattern: /gpt-4o|gpt-4/i },
  analyzeSupplementLabel: { maxTokens: 1500, modelPattern: /gpt-4o|gpt-4/i },
  analyzeWorkoutMachineScreen: { maxTokens: 1500, modelPattern: /gpt-4o|gpt-4/i },
  gradeNutritionLabel: { maxTokens: 1000, modelPattern: /gpt-4o|gpt-4/i },
  parseMacrosFromLabelImage: { maxTokens: 1000, modelPattern: /gpt-4o|gpt-4/i },
  generateResponse: { maxTokens: 2000, modelPattern: /gpt-5-mini|gpt-5|gpt-4o|gpt-4/i }, // Nora Chat
  noraRoutineGeneration: { maxTokens: 8000, modelPattern: /gpt-5-mini|gpt-5|gpt-4o|gpt-4/i }, // 1:1 Routine JSON generation
  generateWorkout: { maxTokens: 4000, modelPattern: /gpt-4o|gpt-4/i }, // Workout Generation
  groundedFoodLookup: { maxTokens: 3000, modelPattern: /gpt-5|gpt-4|gpt-4o|o[1-4]/i },
  macraAssessMacros: { maxTokens: 2500, modelPattern: /gpt-5-mini|gpt-5|gpt-4o|gpt-4/i },
  macraDailyInsight: { maxTokens: 1000, modelPattern: /gpt-4o|gpt-4/i },
  macraFoodJournalFeedback: { maxTokens: 1500, modelPattern: /gpt-4o|gpt-4/i },
  macraLabelScan: { maxTokens: 2200, modelPattern: /gpt-4o|gpt-4/i },
  macraLabelSupplements: { maxTokens: 2500, modelPattern: /gpt-4o|gpt-4/i },
  macraMealPlan: { maxTokens: 2000, modelPattern: /gpt-4o|gpt-4/i }, // Macra: Nora-generated meal plans
  macraMealEdit: { maxTokens: 1500, modelPattern: /gpt-5-mini|gpt-5|gpt-4o|gpt-4/i }, // Macra: per-meal "edit with Nora" regenerator on the Plan tab
  macraMealNote: { maxTokens: 1500, modelPattern: /gpt-4o|gpt-4/i },
  noraNutritionChat: { maxTokens: 700, modelPattern: /gpt-4o|gpt-4/i }, // Macra: Nora coach Q&A
  pulsecheckSportIntelligence: { maxTokens: 8000, modelPattern: /gpt-4o|gpt-4/i },
  // Admin sound-design generation. Audio output is returned as base64 inside
  // the Chat Completions JSON response, so it can use the authenticated bridge
  // without exposing the OpenAI key to the browser.
  pulsecheckSoundEffects: { maxTokens: 2000, modelPattern: /^gpt-audio(?:-1\.5)?$/i },
  // FWP: AI judge gate on generated workouts — semantic pass over the rules-based
  // critic, grounded in the sport's trainingNuance from the SI layer.
  fwpWorkoutJudge: { maxTokens: 1500, modelPattern: /gpt-5-mini|gpt-5|gpt-4o|gpt-4/i },
  // Coach Dashboard v2 → Schedule tab: parse a scraped schedule page into
  // structured events. Needs headroom for a full season of JSON.
  coachScheduleImport: { maxTokens: 4000, modelPattern: /gpt-4o|gpt-4/i },
  // Admin-only: classify legacy challenges into ChallengeType enum (admin lever).
  classifyChallengeType: { maxTokens: 300, modelPattern: /gpt-4o-mini|gpt-4o/i },
  // Athletic Mind Hub: extract council contact emails from uploaded screenshots.
  athleticMindHubEmailExtraction: { maxTokens: 1600, modelPattern: /gpt-4o|gpt-4/i },
  // PipeLists: extract structured list-item fields from a pasted lead URL.
  pipeListsLeadExtraction: { maxTokens: 1800, modelPattern: /gpt-4o-mini|gpt-4o|gpt-4/i },
  // PipeLists: find new leads with the Responses API web-search tool.
  pipeListsLeadGeneration: { maxTokens: 6500, modelPattern: /gpt-5|gpt-4o|gpt-4|o[1-4]/i },
  // Default bounds for generic actions
  default: { maxTokens: 1000, modelPattern: /gpt-5-mini|gpt-5|gpt-4o|gpt-4|gpt-3.5/i }
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

const SIMPBUDGET_FIREBASE_API_KEY =
  process.env.SIMPBUDGET_FIREBASE_API_KEY?.trim()
  || process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_API_KEY?.trim()
  || 'AIzaSyCBoCQ4J9xoIhZuaUjFMPq_zltkXDQ_0e8';
const SIMPBUDGET_TOKEN_FEATURES = new Set(['pipeListsLeadExtraction', 'pipeListsLeadGeneration']);

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

const verifySimpBudgetAuth = async (idToken: string): Promise<string | null> => {
  if (!SIMPBUDGET_FIREBASE_API_KEY) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${SIMPBUDGET_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error('[openai-bridge] SimpBudget Auth verification failed:', {
        status: response.status,
        body: body.slice(0, 300),
      });
      return null;
    }

    const data = await response.json();
    const uid = data?.users?.[0]?.localId;
    return typeof uid === 'string' && uid ? uid : null;
  } catch (error) {
    console.error('[openai-bridge] SimpBudget Auth verification error:', error);
    return null;
  }
};

const verifyAuth = async (authHeader: string | undefined, featureId: string): Promise<string | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    if (SIMPBUDGET_TOKEN_FEATURES.has(featureId)) {
      const simpBudgetUid = await verifySimpBudgetAuth(idToken);
      if (simpBudgetUid) return simpBudgetUid;
    }

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
      body: JSON.stringify(safeErrorBody('METHOD_NOT_ALLOWED', 'That request is not supported.'))
    };
  }

  const featureId = getHeader(event.headers, 'openai-organization') || 'default';

  // 1. Verify Authentication Layer
  const uid = await verifyAuth(getHeader(event.headers, 'authorization'), featureId);
  if (!uid) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody('AUTH_REQUIRED', 'Please sign in again.'))
    };
  }

  // 2. Extract specific path suffix for OpenAI (e.g., /v1/chat/completions)
  // This supports Netlify rewrite rules (from /api/openai/v1/* to /.netlify/functions/openai-bridge)
  const pathMatch = event.path.match(/(\/v1\/.*)/);
  const openApiPath = pathMatch ? pathMatch[1] : '/v1/chat/completions';
  const openApiUrl = `https://api.openai.com${openApiPath}`;

  const providerApiKey = resolveOpenAIApiKey();

  if (!providerApiKey) {
    if (shouldRelayToRemoteBridge(event, providerApiKey)) {
      try {
        return await relayToRemoteBridge(event, openApiPath, featureId);
      } catch (error: any) {
        return safeErrorResponse({
          statusCode: 502,
          headers: corsHeaders,
          code: 'AI_BRIDGE_UNAVAILABLE',
          message: "We couldn't complete that request right now. Try again in a moment.",
          source: 'openai-bridge.relay',
          error,
          db,
          context: { featureId, openApiPath },
        });
      }
    }

    return safeErrorResponse({
      statusCode: 500,
      headers: corsHeaders,
      code: 'AI_BRIDGE_UNAVAILABLE',
      message: "We couldn't complete that request right now. Try again in a moment.",
      source: 'openai-bridge.missing-provider-key',
      error: new Error('Missing OPENAI_API_KEY or OPEN_AI_SECRET_KEY'),
      db,
      context: { featureId, openApiPath },
    });
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
          body: JSON.stringify(safeErrorBody('REQUEST_NOT_ALLOWED', 'That request is not allowed.'))
        };
      }

      // gpt-5 family rejects legacy `max_tokens` and non-default
      // `temperature`. Translate the canonical OpenAI shape clients send
      // (`max_tokens` + `temperature`) into the gpt-5-compatible shape so
      // callers can flip model strings without rewriting their payloads.
      const isGpt5Family = typeof parsedBody.model === 'string' && /^gpt-5/i.test(parsedBody.model);
      if (isGpt5Family) {
        if (typeof parsedBody.max_tokens === 'number' && typeof parsedBody.max_completion_tokens !== 'number') {
          parsedBody.max_completion_tokens = parsedBody.max_tokens;
          delete parsedBody.max_tokens;
        }
        // gpt-5 only accepts temperature === 1 (the default); strip any
        // other value rather than 400-erroring upstream.
        if (typeof parsedBody.temperature === 'number' && parsedBody.temperature !== 1) {
          delete parsedBody.temperature;
        }
      }

      // Automatically cap maximum output tokens to prevent runaway quota abuse
      const effectiveTokenCap = featureConfig.maxTokens;

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
        body: JSON.stringify(safeErrorBody('BAD_REQUEST', 'That request could not be read.'))
      };
    }
  }

  // 3a. Dual-path branch (Phase B+ Part 2). For features whose featureRouting
  // entry sets `fallbackProvider: 'openai'`, try Anthropic first via
  // callWithFallback. On error, fall through to the OpenAI proxy below. Only
  // engages on POST chat-completions calls when ANTHROPIC_API_KEY is set.
  const featureRouting = getFeatureRouting(featureId);
  const isDualPathChatCompletion =
    event.httpMethod === 'POST' &&
    parsedBody &&
    openApiPath.startsWith('/v1/chat/completions') &&
    featureRouting?.provider === 'anthropic' &&
    featureRouting?.fallbackProvider === 'openai' &&
    Boolean(process.env.ANTHROPIC_API_KEY);

  if (isDualPathChatCompletion && featureRouting) {
    try {
      const logger = buildAdminFallbackLogger(admin.firestore());
      const { result } = await callWithFallback({
        feature: featureRouting,
        anthropicCall: async () => {
          const { request: anthropicRequest, usesForcedTool } = translateOpenAIToAnthropic(
            parsedBody,
            featureRouting.model,
          );
          const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY!,
              'anthropic-version': ANTHROPIC_API_VERSION,
            },
            body: JSON.stringify(anthropicRequest),
          });
          if (!anthropicResp.ok) {
            const errText = await anthropicResp.text();
            throw new Error(`Anthropic upstream ${anthropicResp.status}: ${errText.slice(0, 300)}`);
          }
          const anthropicData = await anthropicResp.json();
          return translateAnthropicToOpenAI(anthropicData, usesForcedTool);
        },
        openaiCall: async () => {
          const upstreamResp = await fetch(openApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${providerApiKey}`,
            },
            body: JSON.stringify(parsedBody),
          });
          if (!upstreamResp.ok) {
            throw new Error(`OpenAI upstream ${upstreamResp.status}`);
          }
          return upstreamResp.json();
        },
        logger,
        uid,
      });
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      };
    } catch (error: any) {
      return safeErrorResponse({
        statusCode: 502,
        headers: corsHeaders,
        code: 'AI_ANALYZER_UNAVAILABLE',
        message: "We couldn't complete that request right now. Try again in a moment.",
        source: 'openai-bridge.dual-path',
        error,
        db,
        context: { featureId, openApiPath, uid },
      });
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
    const responseContentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      console.error('[openai-bridge] OpenAI upstream error:', {
        status: response.status,
        path: openApiPath,
        featureId,
        body: data.slice(0, 1000)
      });
      return safeErrorResponse({
        statusCode: response.status,
        headers: corsHeaders,
        code: 'AI_ANALYZER_UNAVAILABLE',
        message: "We couldn't complete that request right now. Try again in a moment.",
        source: 'openai-bridge.upstream',
        error: new Error(`OpenAI upstream ${response.status}: ${data.slice(0, 1000)}`),
        db,
        context: {
          featureId,
          openApiPath,
          uid,
          upstreamStatus: response.status,
          upstreamContentType: responseContentType,
        },
      });
    }

    if (!responseContentType.toLowerCase().includes('application/json')) {
      const bodyPreview = data.slice(0, 1000);
      console.error('[openai-bridge] OpenAI upstream returned non-JSON response:', {
        status: response.status,
        path: openApiPath,
        featureId,
        contentType: responseContentType,
        body: bodyPreview
      });
      return safeErrorResponse({
        statusCode: response.ok ? 502 : response.status,
        headers: corsHeaders,
        code: 'AI_ANALYZER_UNAVAILABLE',
        message: "We couldn't complete that request right now. Try again in a moment.",
        source: 'openai-bridge.non-json-upstream',
        error: new Error(`OpenAI upstream returned non-JSON ${response.status}: ${bodyPreview}`),
        db,
        context: {
          featureId,
          openApiPath,
          uid,
          upstreamStatus: response.status,
          upstreamContentType: responseContentType,
        },
      });
    }

    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': responseContentType || 'application/json'
      },
      body: data
    };
  } catch (error: any) {
    return safeErrorResponse({
      statusCode: 500,
      headers: corsHeaders,
      code: 'AI_ANALYZER_UNAVAILABLE',
      message: "We couldn't complete that request right now. Try again in a moment.",
      source: 'openai-bridge.proxy',
      error,
      db,
      context: { featureId, openApiPath, uid },
    });
  }
};
