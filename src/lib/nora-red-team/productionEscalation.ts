import type { NoraRedTeamModelClient } from './modelClient';
import type {
  NoraRedTeamEscalationClassifier,
  NoraRedTeamEscalationResult,
  NoraRedTeamEscalationTier,
  NoraRedTeamUsage,
} from './types';

type ProductionCondition = {
  id: string;
  tier: number;
  category: string;
  title: string;
  description: string;
  examplePhrases: string[];
  keywords: string[];
  isActive: boolean;
  priority: number;
  [key: string]: unknown;
};

type ProductionClassification = {
  tier?: number;
  category?: string;
  reason?: string;
  explanation?: string;
  confidence?: number;
  shouldEscalate?: boolean;
  classificationFamily?: string;
  classificationSource?: string;
  requiresCoachReview?: boolean;
  requiresClinicalHandoff?: boolean;
};

type ClassifierResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get: (name: string) => string | null;
    entries: () => IterableIterator<[string, string]>;
  };
  json: () => Promise<Record<string, unknown>>;
  text: () => Promise<string>;
};

type ProductionEscalationRuntime = {
  classifyEscalation: (
    db: unknown,
    userId: string,
    message: string,
    recentMessages: Array<{ isFromUser: boolean; content: string }>,
    conversationId: string,
    options: {
      conditions: ProductionCondition[];
      requestClassification: (input: {
        model: string;
        systemPrompt: string;
        userPrompt: string;
        maxOutputTokens: number;
      }) => Promise<ClassifierResponse>;
    },
  ) => Promise<ProductionClassification | null>;
};

type FirestoreValue = {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  stringValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

const productionEscalationRuntime = require('../../../netlify/functions/pulsecheck-chat.js')
  .runtimeHelpers as ProductionEscalationRuntime;

function parseFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) {
    return (value.arrayValue?.values || []).map((entry) => parseFirestoreValue(entry));
  }
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue?.fields || {}).map(([key, entry]) => [key, parseFirestoreValue(entry)]),
    );
  }
  return undefined;
}

function parseFirestoreDocument(document: FirestoreDocument): ProductionCondition {
  const parsed = Object.fromEntries(
    Object.entries(document.fields || {}).map(([key, value]) => [key, parseFirestoreValue(value)]),
  ) as Record<string, unknown>;
  const id = String(document.name || '').split('/').pop() || 'unknown-condition';
  return {
    ...parsed,
    id,
    tier: Number(parsed.tier) || 0,
    category: String(parsed.category || 'general'),
    title: String(parsed.title || ''),
    description: String(parsed.description || ''),
    examplePhrases: Array.isArray(parsed.examplePhrases)
      ? parsed.examplePhrases.map(String)
      : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
    isActive: parsed.isActive !== false,
    priority: Number(parsed.priority) || 0,
  };
}

export async function loadActiveProductionEscalationConditions(input: {
  authorization: string;
  projectId: string;
  fetchImpl?: typeof fetch;
}): Promise<ProductionCondition[]> {
  if (!/^[a-z0-9][a-z0-9-]{3,62}$/i.test(input.projectId)) {
    throw new Error('ESCALATION_POLICY_UNAVAILABLE: Invalid Firebase project id.');
  }
  const fetchImpl = input.fetchImpl || fetch;
  const conditions: ProductionCondition[] = [];
  let pageToken = '';

  for (let page = 0; page < 5; page += 1) {
    const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(input.projectId)}/databases/(default)/documents/escalation-conditions`;
    const url = `${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: input.authorization,
        Accept: 'application/json',
      },
    });
    const payload = await response.json().catch(() => null) as {
      documents?: FirestoreDocument[];
      nextPageToken?: string;
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      const detail = payload?.error?.message || `Firestore returned HTTP ${response.status}.`;
      throw new Error(`ESCALATION_POLICY_UNAVAILABLE: ${detail}`);
    }

    conditions.push(...(payload?.documents || []).map(parseFirestoreDocument));
    pageToken = String(payload?.nextPageToken || '');
    if (!pageToken) break;
  }

  const active = conditions
    .filter((condition) => condition.isActive)
    .sort((left, right) => left.tier - right.tier || right.priority - left.priority);
  if (!active.length) {
    throw new Error('ESCALATION_POLICY_UNAVAILABLE: No active production escalation conditions were found.');
  }
  return active;
}

function emptyUsage(): NoraRedTeamUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function normalizeTier(value: unknown): NoraRedTeamEscalationTier {
  const tier = Math.max(0, Math.min(3, Math.round(Number(value) || 0)));
  return tier as NoraRedTeamEscalationTier;
}

function mapEscalationResult(input: {
  classification: ProductionClassification;
  conditionCount: number;
  model: string;
  durationMs: number;
}): NoraRedTeamEscalationResult {
  const tier = normalizeTier(input.classification.tier);
  const requiresClinicalHandoff = input.classification.requiresClinicalHandoff === true || tier >= 2;
  const recordWouldBeCreated = requiresClinicalHandoff
    || ['care_escalation', 'critical_safety'].includes(String(input.classification.classificationFamily || ''));
  const consentWorkflowWouldStart = tier === 2 && recordWouldBeCreated;
  return {
    tier,
    category: String(input.classification.category || 'general'),
    reason: String(input.classification.reason || ''),
    explanation: String(input.classification.explanation || input.classification.reason || ''),
    confidence: Math.max(0, Math.min(1, Number(input.classification.confidence) || 0)),
    shouldEscalate: input.classification.shouldEscalate === true || tier >= 2,
    classificationFamily: String(input.classification.classificationFamily || 'none'),
    classificationSource: String(input.classification.classificationSource || 'production_ai_classifier'),
    requiresCoachReview: input.classification.requiresCoachReview === true || tier >= 1,
    requiresClinicalHandoff,
    modal: tier === 3 ? 'tier_3_critical' : tier === 2 ? 'tier_2_consent' : 'none',
    consentRequired: tier === 2,
    recordWouldBeCreated,
    consentWorkflowWouldStart,
    safetyModeWouldActivate: tier === 3,
    handoffWouldStart: tier === 3 || consentWorkflowWouldStart,
    coachNotificationWouldStart: tier === 3,
    simulationOnly: true,
    conditionSource: 'production_firestore',
    conditionCount: input.conditionCount,
    model: input.model,
    durationMs: input.durationMs,
  };
}

export function createProductionEscalationClassifier(input: {
  openai: NoraRedTeamModelClient;
  conditions: ProductionCondition[];
  model?: string;
}): NoraRedTeamEscalationClassifier {
  const model = input.model || 'gpt-4o-mini';

  return async (classifierInput) => {
    const usage = emptyUsage();
    const startedAt = Date.now();
    const classification = await productionEscalationRuntime.classifyEscalation(
      null,
      'synthetic-red-team-athlete',
      classifierInput.athleteMessage,
      classifierInput.recentMessages,
      classifierInput.conversationId,
      {
        conditions: input.conditions,
        requestClassification: async (request) => {
          const response = await input.openai.responses.create({
            model,
            store: false,
            temperature: 0.1,
            max_output_tokens: request.maxOutputTokens,
            text: { format: { type: 'json_object' } },
            input: [
              { role: 'system', content: [{ type: 'input_text', text: request.systemPrompt }] },
              { role: 'user', content: [{ type: 'input_text', text: request.userPrompt }] },
            ],
          });
          usage.inputTokens += response.usage?.input_tokens || 0;
          usage.outputTokens += response.usage?.output_tokens || 0;
          usage.totalTokens += response.usage?.total_tokens || 0;
          const payload = {
            choices: [{ message: { content: response.output_text } }],
            model,
            usage: {
              prompt_tokens: response.usage?.input_tokens || 0,
              completion_tokens: response.usage?.output_tokens || 0,
              total_tokens: response.usage?.total_tokens || 0,
            },
          };
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: {
              get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
              entries: function* entries() {
                yield ['content-type', 'application/json'] as [string, string];
              },
            },
            json: async () => payload,
            text: async () => JSON.stringify(payload),
          };
        },
      },
    );
    if (!classification) {
      throw new Error('ESCALATION_CLASSIFICATION_UNAVAILABLE: Production classifier returned no result.');
    }

    return {
      escalation: mapEscalationResult({
        classification,
        conditionCount: input.conditions.length,
        model,
        durationMs: Date.now() - startedAt,
      }),
      usage,
    };
  };
}
