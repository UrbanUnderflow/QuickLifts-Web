import type { Handler } from '@netlify/functions';
import { admin, headers as corsHeaders } from './config/firebase';
import { PULSECHECK_PHASE_J_LIFT_SUMMARY_PARSE } from '../../src/api/anthropic/featureRouting';
import {
  buildAdminAuditLogger,
  callAnthropic as callAnthropicCore,
} from '../../src/api/anthropic/serverBridge';
import {
  buildPhaseJLiftSummaryParserSystemPrompt,
  buildPhaseJLiftSummaryParserUserMessage,
  coercePhaseJLiftSummaryParseResult,
  parsePhaseJLiftSummaryLocally,
  resolvePhaseJLiftSummaryInputText,
  type PhaseJLiftSummaryEndpointResponse,
  type PhaseJLiftSummaryParserRequest,
} from '../../src/api/firebase/phaseJLiftSummaryParser';

const RESPONSE_HEADERS = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_INPUT_CHARS = 4000;

const parseBody = (body: string | null): PhaseJLiftSummaryParserRequest | null => {
  if (!body) return {};
  const parsed = JSON.parse(body) as PhaseJLiftSummaryParserRequest;
  return parsed && typeof parsed === 'object' ? parsed : null;
};

const rawInputLength = (input: PhaseJLiftSummaryParserRequest): number =>
  `${input.freeText || ''}${input.voiceTranscript || ''}`.length;

const extractJsonObject = (text: string): unknown => {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('empty_response');

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('json_object_not_found');
    return JSON.parse(trimmed.slice(start, end + 1));
  }
};

const buildFallbackResponse = (
  input: PhaseJLiftSummaryParserRequest,
  warning: string,
): PhaseJLiftSummaryEndpointResponse => {
  const local = parsePhaseJLiftSummaryLocally(input);
  return {
    ok: true,
    ...local,
    parserWarnings: Array.from(new Set([...local.parserWarnings, warning])),
  };
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'method_not_allowed' }),
    };
  }

  let input: PhaseJLiftSummaryParserRequest | null;
  try {
    input = parseBody(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'invalid_json' }),
    };
  }

  if (!input) {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'invalid_body' }),
    };
  }

  const { text } = resolvePhaseJLiftSummaryInputText(input);
  if (!text) {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'text_or_voiceTranscript_required' }),
    };
  }
  if (rawInputLength(input) > MAX_INPUT_CHARS) {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'input_too_long' }),
    };
  }

  if (input.preferLocal) {
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ ok: true, ...parsePhaseJLiftSummaryLocally(input) }),
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify(buildFallbackResponse(input, 'anthropic_api_key_missing')),
    };
  }

  try {
    const result = await callAnthropicCore(
      {
        featureId: PULSECHECK_PHASE_J_LIFT_SUMMARY_PARSE.featureId,
        system: buildPhaseJLiftSummaryParserSystemPrompt(),
        messages: [{ role: 'user', content: buildPhaseJLiftSummaryParserUserMessage(input) }],
        maxTokens: 1000,
        callerContext: {
          transport: 'server-direct',
          caller: 'phase-j.lift-summary-parser',
          athleteUserId: input.athleteUserId,
          candidateId: input.candidateId,
          promptId: input.promptId,
        },
      },
      { auditLogger: buildAdminAuditLogger(admin.firestore()) },
    );

    const parsed = extractJsonObject(result.text);
    const coerced = coercePhaseJLiftSummaryParseResult(parsed, input, 'anthropic');
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ ok: true, ...coerced }),
    };
  } catch (error) {
    console.warn('[parse-phase-j-lift-summary] Falling back to local parser:', error);
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify(buildFallbackResponse(input, 'anthropic_parse_failed')),
    };
  }
};
