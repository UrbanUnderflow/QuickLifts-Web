// OpenAI ↔ Anthropic shape translators used by openai-bridge.ts dual-path.
//
// Limited to the request shapes Sport Intelligence callers actually send:
// system + user messages, optional `response_format: json_object`. Image
// content / function calling are not migrated through this route.
//
// Kept in their own module so tests can exercise the translation + fallback
// flow without booting the full Netlify handler.

export const ANTHROPIC_API_VERSION = '2023-06-01';

export interface OpenAIChatCompletionBody {
  model?: string;
  messages?: Array<{ role: string; content: unknown }>;
  max_tokens?: number;
  temperature?: number;
  response_format?: { type?: string };
  [key: string]: unknown;
}

export interface AnthropicMessagesRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: string; content: string }>;
  tools?: Array<{ name: string; description?: string; input_schema: unknown }>;
  tool_choice?: { type: 'tool'; name: string };
}

export interface AnthropicMessagesResponse {
  id?: string;
  model?: string;
  stop_reason?: string;
  content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export const translateOpenAIToAnthropic = (
  openaiBody: OpenAIChatCompletionBody,
  anthropicModel: string,
): { request: AnthropicMessagesRequest; usesForcedTool: boolean } => {
  const messages = Array.isArray(openaiBody.messages) ? openaiBody.messages : [];
  const systemMessage = messages.find((m) => m && m.role === 'system');
  const conversation = messages.filter((m) => m && m.role !== 'system');
  const usesForcedTool = openaiBody?.response_format?.type === 'json_object';

  const request: AnthropicMessagesRequest = {
    model: anthropicModel,
    max_tokens: typeof openaiBody.max_tokens === 'number' ? openaiBody.max_tokens : 4000,
    system: typeof systemMessage?.content === 'string' ? systemMessage.content : undefined,
    messages: conversation.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
  };

  if (usesForcedTool) {
    request.tools = [
      {
        name: 'submit_response',
        description: 'Submit the structured JSON response.',
        input_schema: { type: 'object', additionalProperties: true },
      },
    ];
    request.tool_choice = { type: 'tool', name: 'submit_response' };
  }
  return { request, usesForcedTool };
};

export const translateAnthropicToOpenAI = (
  anthropicResponse: AnthropicMessagesResponse,
  usesForcedTool: boolean,
): OpenAIChatCompletionResponse => {
  let content = '';
  if (usesForcedTool) {
    const toolUse = (anthropicResponse?.content || []).find(
      (b) => b?.type === 'tool_use' && b?.name === 'submit_response',
    );
    content = toolUse ? JSON.stringify(toolUse.input) : '';
  } else {
    content = (anthropicResponse?.content || [])
      .filter((b) => b?.type === 'text')
      .map((b) => b.text || '')
      .join('');
  }
  return {
    id: anthropicResponse?.id || `msg_${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: anthropicResponse?.model || 'claude-sonnet-4-6',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason:
          anthropicResponse?.stop_reason === 'end_turn'
            ? 'stop'
            : anthropicResponse?.stop_reason || 'stop',
      },
    ],
    usage: {
      prompt_tokens: anthropicResponse?.usage?.input_tokens || 0,
      completion_tokens: anthropicResponse?.usage?.output_tokens || 0,
      total_tokens:
        (anthropicResponse?.usage?.input_tokens || 0) +
        (anthropicResponse?.usage?.output_tokens || 0),
    },
  };
};
