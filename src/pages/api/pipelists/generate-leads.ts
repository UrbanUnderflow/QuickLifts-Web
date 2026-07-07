import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_LEAD_GEN_MODEL = process.env.OPENAI_LEAD_GEN_MODEL || process.env.OPENAI_SEARCH_MODEL || 'gpt-5.5';
const OPENAI_BRIDGE_FEATURE_ID = 'pipeListsLeadGeneration';
const MAX_ADJUSTMENTS_CHARS = 3000;
const MAX_EXISTING_ITEMS = 80;
const MIN_LEAD_COUNT = 3;
const MAX_LEAD_COUNT = 10;

type StageInput = {
  id: string;
  label: string;
  probability?: number;
};

type ExistingItemInput = {
  title?: string;
  organization?: string;
  sourceUrl?: string;
  dueDate?: string;
};

type GenerateLeadsRequest = {
  listName?: string;
  templateLabel?: string;
  templateKey?: string;
  stages?: StageInput[];
  adjustments?: string;
  requireFutureDeadline?: boolean;
  officialSourcesOnly?: boolean;
  count?: number;
  existingItems?: ExistingItemInput[];
};

type LeadCandidate = {
  title: string;
  organization: string;
  owner: string;
  stage: string;
  priority: 'high' | 'medium' | 'low';
  amount: string;
  dueDate: string;
  nextStep: string;
  notes: string;
  sourceUrl: string;
  segment: string;
  decisionMaker: string;
  acv: string;
  expectedCloseDate: string;
  contractTerm: string;
  pilotScope: string;
  athleteCount: string;
  pilotStart: string;
  pilotEnd: string;
  conversionLikelihood: string;
  grossMargin: string;
  partnerCost: string;
  hardwareCost: string;
  lossReason: string;
  expansionPath: string;
  contactEmails: string[];
  rationale: string;
  sourceEvidence: string;
  deadlineStatus: string;
};

const leadStringFields = [
  'title',
  'organization',
  'owner',
  'stage',
  'amount',
  'dueDate',
  'nextStep',
  'notes',
  'sourceUrl',
  'segment',
  'decisionMaker',
  'acv',
  'expectedCloseDate',
  'contractTerm',
  'pilotScope',
  'athleteCount',
  'pilotStart',
  'pilotEnd',
  'conversionLikelihood',
  'grossMargin',
  'partnerCost',
  'hardwareCost',
  'lossReason',
  'expansionPath',
  'rationale',
  'sourceEvidence',
  'deadlineStatus',
] as const;

const leadProperties = leadStringFields.reduce<Record<string, unknown>>((properties, field) => {
  properties[field] = { type: 'string' };
  return properties;
}, {
  priority: { type: 'string' },
  contactEmails: { type: 'array', items: { type: 'string' } },
});

const leadRequiredFields = ['priority', 'contactEmails', ...leadStringFields];

const leadResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    leads: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: leadProperties,
        required: leadRequiredFields,
      },
    },
  },
  required: ['leads'],
};

const cleanString = (value: unknown, maxLength = 1200) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim().slice(0, maxLength);
};

const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

const parseJsonSafe = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const getEasternDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
};

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeContactEmails = (value: unknown) => {
  const rawValues = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,;]+/) : [];
  return Array.from(
    new Set(
      rawValues
        .map((item) => cleanString(item, 180).toLowerCase())
        .filter((item) => emailPattern.test(item)),
    ),
  );
};

const isValidUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const listSourcePatterns = [
  /\b(list|directory|database|roundup|round-up|guide|overview|landscape|market map|map of|index)\b/i,
  /\b(top|best)\s+\d+\b/i,
  /\b\d+\+?\s+(investors|funds|grants|accelerators|competitions|programs|opportunities|vcs)\b/i,
  /\b(investors|funds|grants|accelerators|competitions|programs|opportunities|vcs)\s+(to know|you can|for startups|in \d{4})\b/i,
];

const listSourceUrlPatterns = [
  /\/(blog|news|insights|resources|articles|posts|lists|directories|directory|database|roundups?|guides?)\//i,
  /\b(list|directory|database|roundup|guide|overview|landscape|market-map)\b/i,
];

const isLikelyAggregateSource = (lead: Pick<LeadCandidate, 'title' | 'organization' | 'sourceUrl' | 'rationale' | 'sourceEvidence'>) => {
  const text = [lead.title, lead.organization, lead.rationale, lead.sourceEvidence].filter(Boolean).join(' ');
  if (listSourcePatterns.some((pattern) => pattern.test(text))) return true;

  try {
    const parsed = new URL(lead.sourceUrl);
    const urlText = `${parsed.hostname}${parsed.pathname}`;
    return listSourceUrlPatterns.some((pattern) => pattern.test(urlText));
  } catch {
    return false;
  }
};

const clampCount = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (Number.isNaN(parsed)) return 6;
  return Math.min(MAX_LEAD_COUNT, Math.max(MIN_LEAD_COUNT, parsed));
};

const getResponseText = (value: unknown) => {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.output_text === 'string') return record.output_text;

  const output = Array.isArray(record.output) ? record.output : [];
  return output
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) return [];
      return content
        .map((part) => {
          if (!part || typeof part !== 'object') return '';
          const partRecord = part as Record<string, unknown>;
          return typeof partRecord.text === 'string' ? partRecord.text : '';
        })
        .filter(Boolean);
    })
    .join('\n');
};

const getBridgeOrigin = () =>
  (process.env.OPENAI_BRIDGE_FALLBACK_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai')
    .replace(/\/+$/, '');

const getBridgeErrorMessage = (value: unknown) => {
  if (!value || typeof value !== 'object') return 'Unable to generate leads.';
  const record = value as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
  }
  if (typeof error === 'string') return error;
  if (typeof record.message === 'string') return record.message;
  return 'Unable to generate leads.';
};

const sanitizeLead = (
  value: unknown,
  stageIds: string[],
  fallbackStage: string,
  today: string,
  deadlineRequired: boolean,
): LeadCandidate | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const sourceUrl = cleanString(record.sourceUrl, 800);
  const dueDate = cleanString(record.dueDate, 24);

  if (!cleanString(record.title, 240) || !isValidUrl(sourceUrl)) return null;
  if (dueDate && (!isIsoDate(dueDate) || dueDate < today)) return null;
  if (deadlineRequired && (!dueDate || dueDate < today)) return null;

  const stage = cleanString(record.stage, 80);
  const priority = cleanString(record.priority, 20);

  return {
    title: cleanString(record.title, 240),
    organization: cleanString(record.organization, 240),
    owner: cleanString(record.owner, 120),
    stage: stageIds.includes(stage) ? stage : fallbackStage,
    priority: priority === 'high' || priority === 'low' ? priority : 'medium',
    amount: cleanString(record.amount, 160),
    dueDate,
    nextStep: cleanString(record.nextStep, 360),
    notes: cleanString(record.notes, 1800),
    sourceUrl,
    segment: cleanString(record.segment, 180),
    decisionMaker: cleanString(record.decisionMaker, 180),
    acv: cleanString(record.acv, 120),
    expectedCloseDate: cleanString(record.expectedCloseDate, 24),
    contractTerm: cleanString(record.contractTerm, 120),
    pilotScope: cleanString(record.pilotScope, 500),
    athleteCount: cleanString(record.athleteCount, 120),
    pilotStart: cleanString(record.pilotStart, 24),
    pilotEnd: cleanString(record.pilotEnd, 24),
    conversionLikelihood: cleanString(record.conversionLikelihood, 160),
    grossMargin: cleanString(record.grossMargin, 120),
    partnerCost: cleanString(record.partnerCost, 120),
    hardwareCost: cleanString(record.hardwareCost, 120),
    lossReason: cleanString(record.lossReason, 240),
    expansionPath: cleanString(record.expansionPath, 500),
    contactEmails: normalizeContactEmails(record.contactEmails),
    rationale: cleanString(record.rationale, 700),
    sourceEvidence: cleanString(record.sourceEvidence, 700),
    deadlineStatus: cleanString(record.deadlineStatus, 300),
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please sign in before generating leads.' });
  }

  const body = (req.body || {}) as GenerateLeadsRequest;
  const listName = cleanString(body.listName, 120);
  const templateLabel = cleanString(body.templateLabel, 120);
  const templateKey = cleanString(body.templateKey, 80);
  const adjustments = cleanString(body.adjustments, MAX_ADJUSTMENTS_CHARS);
  const count = clampCount(body.count);
  const today = getEasternDate();
  const stageOptions = Array.isArray(body.stages)
    ? body.stages
        .map((stage) => ({
          id: cleanString(stage?.id, 80),
          label: cleanString(stage?.label, 120),
          probability: typeof stage?.probability === 'number' ? stage.probability : undefined,
        }))
        .filter((stage) => stage.id)
    : [];
  const stageIds = stageOptions.map((stage) => stage.id);
  const fallbackStage = stageIds[0] || '';
  const deadlineRequired = body.requireFutureDeadline === true;
  const officialSourcesOnly = body.officialSourcesOnly === true;
  const existingItems = Array.isArray(body.existingItems)
    ? body.existingItems.slice(0, MAX_EXISTING_ITEMS).map((item) => ({
        title: cleanString(item.title, 180),
        organization: cleanString(item.organization, 180),
        sourceUrl: cleanString(item.sourceUrl, 800),
        dueDate: cleanString(item.dueDate, 24),
      }))
    : [];
  const existingKeys = new Set(
    existingItems.flatMap((item) =>
      [
        item.title ? normalizeKey(`${item.title} ${item.organization}`) : '',
        item.sourceUrl ? normalizeKey(item.sourceUrl) : '',
      ].filter(Boolean),
    ),
  );

  try {
    const response = await fetch(`${getBridgeOrigin()}/api/openai/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'openai-organization': OPENAI_BRIDGE_FEATURE_ID,
        'x-pulsecheck-firebase-mode': 'prod',
      },
      body: JSON.stringify({
        model: OPENAI_LEAD_GEN_MODEL,
        temperature: 0.15,
        max_output_tokens: 6000,
        tools: [{ type: 'web_search' }],
        text: {
          format: {
            type: 'json_schema',
            name: 'pipelists_lead_generation',
            strict: true,
            schema: leadResponseSchema,
          },
        },
        input: [
          {
            role: 'system',
            content: `You are a lead-generation researcher for PipeLists, a CRM-style opportunity tracker.

Current date: ${today}.

Research rules:
- Use the user's adjustments as the primary instruction source.
- Use web search and return leads supported by current sources.
- Return only leads that are relevant to the active PipeList and the user's adjustments.
- A lead must be a specific actionable entity: a named fund, person, company, program, grant, competition, contract, school, partner, or opportunity.
- Do not return source pages that are merely lists of other leads, directories, databases, rankings, roundups, market maps, article collections, or sector overviews.
- If a useful source page is a list/directory/roundup, treat it as a research source only: open or follow the entries, extract the individual leads from that page, and return those individual leads instead.
- Each returned lead's sourceUrl must point to that individual lead's official page, LinkedIn/profile page, application page, fund page, or program page. Do not use a directory/list page as sourceUrl unless it is also the official page for that exact lead.
- Avoid duplicates already in the user's list.
- Never invent deadlines, prizes, contacts, amounts, fit claims, or organizations.
- Only include contactEmails when a current source visibly provides valid public email addresses. Never invent contact emails.
- If a source has an explicit deadline, dueDate must use ISO format YYYY-MM-DD.
- If requireFutureDeadline is true, every returned lead must have a verified dueDate on or after ${today}.
- If requireFutureDeadline is false, dueDate can be "" unless the source provides a real deadline.
- If officialSourcesOnly is true, prefer official/current sources and verify against official pages before returning a lead.
- Pick stage from the provided stage ids only. If unsure, use the first stage id.
- Keep notes useful for the user: concise analysis, prep angle, and practical context. Do not write "AI confidence".
- sourceEvidence must briefly name the source support used, including the deadline when relevant.
- deadlineStatus must state whether the lead has a future deadline, no fixed deadline, or an optional follow-up date.
- Return JSON only.`,
          },
          {
            role: 'user',
            content: JSON.stringify(
              {
                requestedLeadCount: count,
                listName,
                templateLabel,
                templateKey,
                deadlineRequired,
                officialSourcesOnly,
                stageOptions,
                userAdjustments: adjustments,
                existingItems,
              },
              null,
              2,
            ),
          },
        ],
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({ error: getBridgeErrorMessage(data), success: false });
    }

    const parsed = parseJsonSafe(getResponseText(data) || '{}');
    const rawLeads = parsed && typeof parsed === 'object' && Array.isArray(parsed.leads) ? parsed.leads : [];
    const seenKeys = new Set<string>();
    const leads = rawLeads
      .map((lead: unknown) => sanitizeLead(lead, stageIds, fallbackStage, today, deadlineRequired))
      .filter((lead: LeadCandidate | null): lead is LeadCandidate => {
        if (!lead) return false;
        if (isLikelyAggregateSource(lead)) return false;
        const leadKeys = [
          normalizeKey(`${lead.title} ${lead.organization}`),
          normalizeKey(lead.sourceUrl),
        ].filter(Boolean);
        if (leadKeys.some((key) => existingKeys.has(key) || seenKeys.has(key))) return false;
        leadKeys.forEach((key) => seenKeys.add(key));
        return true;
      })
      .slice(0, count);

    return res.status(200).json({
      success: true,
      searchedAt: today,
      deadlineRequired,
      model: OPENAI_LEAD_GEN_MODEL,
      leads,
    });
  } catch (error) {
    console.error('[PipeLists Generate Leads] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to generate leads.',
      success: false,
    });
  }
}
