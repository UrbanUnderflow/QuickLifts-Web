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

      if (typeof parsedBody.max_completion_tokens === 'number') {
        parsedBody.max_completion_tokens = Math.min(parsedBody.max_completion_tokens, effectiveTokenCap);
      } else if (!parsedBody.max_tokens || parsedBody.max_tokens > effectiveTokenCap) {
        parsedBody.max_tokens = effectiveTokenCap;
      }

    } catch (e) {
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
