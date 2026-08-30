import type { NoraRedTeamUsage } from './types';

export type NoraRedTeamResponseRequest = {
  model: string;
  store?: boolean;
  max_output_tokens?: number;
  temperature?: number;
  text?: {
    format?: {
      type?: string;
      name?: string;
      strict?: boolean;
      schema?: Record<string, unknown>;
    };
  };
  input: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | Array<{ type?: string; text?: string }>;
  }>;
};

export type NoraRedTeamResponse = {
  output_text: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
};

export type NoraRedTeamModelClient = {
  responses: {
    create: (
      request: NoraRedTeamResponseRequest,
      options?: { signal?: AbortSignal },
    ) => Promise<NoraRedTeamResponse>;
  };
};

type BridgeClientOptions = {
  authorization: string;
  bridgeOrigin: string;
  featureId: string;
  firebaseMode?: string;
  fetchImpl?: typeof fetch;
};

type BridgeChatResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: unknown;
};

function extractMessageContent(content: NoraRedTeamResponseRequest['input'][number]['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map((part) => part?.text || '')
    .filter(Boolean)
    .join('\n');
}

function toChatResponseFormat(format?: NonNullable<NoraRedTeamResponseRequest['text']>['format']) {
  if (!format || typeof format !== 'object') return undefined;
  const typedFormat = format as NonNullable<NoraRedTeamResponseRequest['text']>['format'];
  if (typedFormat?.type === 'json_schema') {
    return {
      type: 'json_schema',
      json_schema: {
        name: typedFormat.name,
        strict: typedFormat.strict,
        schema: typedFormat.schema,
      },
    };
  }
  if (typedFormat?.type === 'json_object') return { type: 'json_object' };
  return undefined;
}

function bridgeErrorMessage(payload: BridgeChatResponse | null, fallback: string): string {
  const error = payload?.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function mapBridgeUsage(usage: BridgeChatResponse['usage']): NoraRedTeamUsage {
  return {
    inputTokens: usage?.prompt_tokens || 0,
    outputTokens: usage?.completion_tokens || 0,
    totalTokens: usage?.total_tokens || 0,
  };
}

function bridgeCompletionTokenBudget(model: string, requested?: number): number | undefined {
  if (typeof requested !== 'number') return undefined;
  // Chat Completions counts GPT-5 reasoning and visible text together. A small
  // cap can produce an apparently empty message before Nora receives evidence.
  if (/^gpt-5/i.test(model)) return Math.max(requested, 4096);
  return requested;
}

export function createNoraRedTeamBridgeClient(options: BridgeClientOptions): NoraRedTeamModelClient {
  const bridgeOrigin = options.bridgeOrigin.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl || fetch;

  return {
    responses: {
      create: async (request, requestOptions) => {
        const responseFormat = toChatResponseFormat(request.text?.format);
        const response = await fetchImpl(`${bridgeOrigin}/api/openai/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: options.authorization,
            'openai-organization': options.featureId,
            'x-pulsecheck-firebase-mode': options.firebaseMode || 'prod',
          },
          body: JSON.stringify({
            model: request.model,
            store: request.store === false ? false : undefined,
            temperature: request.temperature,
            max_completion_tokens: bridgeCompletionTokenBudget(request.model, request.max_output_tokens),
            ...(responseFormat ? { response_format: responseFormat } : {}),
            messages: request.input.map((message) => ({
              role: message.role,
              content: extractMessageContent(message.content),
            })),
          }),
          signal: requestOptions?.signal,
        });

        const payload = await response.json().catch(() => null) as BridgeChatResponse | null;
        if (!response.ok) {
          throw new Error(bridgeErrorMessage(
            payload,
            `OpenAI bridge request failed with status ${response.status}.`,
          ));
        }

        const firstChoice = payload?.choices?.[0];
        const outputText = firstChoice?.message?.content?.trim();
        if (!outputText) {
          const finishReason = firstChoice?.finish_reason || 'unknown';
          const refusal = firstChoice?.message?.refusal;
          throw new Error(refusal
            ? `OPENAI_BRIDGE_REFUSAL: ${refusal.slice(0, 180)}`
            : `OPENAI_BRIDGE_EMPTY_RESPONSE:${finishReason}`);
        }

        const usage = mapBridgeUsage(payload?.usage);
        return {
          output_text: outputText,
          usage: {
            input_tokens: usage.inputTokens,
            output_tokens: usage.outputTokens,
            total_tokens: usage.totalTokens,
          },
        };
      },
    },
  };
}
