import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_LEAD_GEN_MODEL = process.env.OPENAI_LEAD_GEN_MODEL || process.env.OPENAI_SEARCH_MODEL || 'gpt-4o-mini';
const OPENAI_BRIDGE_FEATURE_ID = 'pipeListsLeadGeneration';
const MAX_ADJUSTMENTS_CHARS = 20000;
const MAX_EXISTING_ITEMS = 80;
const MIN_LEAD_COUNT = 3;
const MAX_LEAD_COUNT = 30;

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
  listDescription?: string;
  listObjective?: string;
  leadDefinition?: string;
  templateLabel?: string;
  templateKey?: string;
  stages?: StageInput[];
  stageOptions?: StageInput[];
  adjustments?: string;
  searchPrompt?: string;
  researchPrompt?: string;
  inputEntries?: unknown[];
  requestedLeadCount?: number;
  taskMode?: string;
  requireFutureDeadline?: boolean;
  officialSourcesOnly?: boolean;
  count?: number;
  existingItems?: ExistingItemInput[];
};

type LeadCandidate = {
  title: string;
  organization: string;
  description: string;
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
  deadlineSource: string;
};

const leadStringFields = [
  'title',
  'organization',
  'description',
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
  'deadlineSource',
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

type LeadFilterStats = {
  invalid: number;
  aggregate: number;
  duplicate: number;
};

const emptyLeadFilterStats = (): LeadFilterStats => ({
  invalid: 0,
  aggregate: 0,
  duplicate: 0,
});

const keyContains = (candidate: string, target: string) => {
  if (!candidate || !target) return false;
  return candidate === target || candidate.includes(target) || target.includes(candidate);
};

const looksLikePersonName = (value: string) => {
  const cleaned = cleanString(value, 120);
  if (!cleaned || /\b(university|college|school|department|athletics?|fund|ventures?|capital|program|center|centre|institute)\b/i.test(cleaned)) {
    return false;
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => /^[A-Z][a-zA-Z'.-]+$/.test(word));
};

const clampCount = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (Number.isNaN(parsed)) return 6;
  return Math.min(MAX_LEAD_COUNT, Math.max(MIN_LEAD_COUNT, parsed));
};

const clampStructuredCount = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(MAX_LEAD_COUNT, Math.max(1, parsed));
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
  const rawDueDate = cleanString(record.dueDate, 24);
  const rawDeadlineSource = cleanString(record.deadlineSource, 40).toLowerCase();
  const hasExplicitDeadline = rawDeadlineSource === 'explicit';
  const dueDate = hasExplicitDeadline ? rawDueDate : '';

  if (!cleanString(record.title, 240) || !isValidUrl(sourceUrl)) return null;
  if (dueDate && (!isIsoDate(dueDate) || dueDate < today)) return null;
  if (deadlineRequired && (!dueDate || dueDate < today)) return null;

  const stage = cleanString(record.stage, 80);
  const priority = cleanString(record.priority, 20);

  return {
    title: cleanString(record.title, 240),
    organization: cleanString(record.organization, 240),
    description: cleanString(record.description, 600),
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
    expectedCloseDate: '',
    contractTerm: cleanString(record.contractTerm, 120),
    pilotScope: cleanString(record.pilotScope, 500),
    athleteCount: cleanString(record.athleteCount, 120),
    pilotStart: '',
    pilotEnd: '',
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
    deadlineSource: dueDate ? 'explicit' : 'none',
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
  const listDescription = cleanString(body.listDescription, 800);
  const listObjective = cleanString(body.listObjective, 1200);
  const leadDefinition = cleanString(body.leadDefinition, 1200);
  const templateLabel = cleanString(body.templateLabel, 120);
  const templateKey = cleanString(body.templateKey, 80);
  const adjustments = cleanString(body.searchPrompt || body.adjustments, MAX_ADJUSTMENTS_CHARS);
  const researchPrompt = cleanString(body.researchPrompt, 3000);
  const inputEntries = Array.isArray(body.inputEntries)
    ? Array.from(new Set(body.inputEntries.map((entry) => cleanString(entry, 160)).filter(Boolean))).slice(0, MAX_LEAD_COUNT)
    : [];
  const count =
    inputEntries.length > 0
      ? clampStructuredCount(body.requestedLeadCount ?? body.count ?? inputEntries.length)
      : clampCount(body.requestedLeadCount ?? body.count);
  const taskMode = cleanString(body.taskMode, 80) || (inputEntries.length > 0 ? 'extract_all_named_entries' : 'discover_leads');
  const today = getEasternDate();
  const rawStageOptions = Array.isArray(body.stageOptions) ? body.stageOptions : body.stages;
  const stageOptions = Array.isArray(rawStageOptions)
    ? rawStageOptions
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

  const buildSystemPrompt = (forceExactEntry: boolean) => `You are a lead-generation researcher for PipeLists, a CRM-style opportunity tracker.

Current date: ${today}.

Research rules:
- Use the user's prompt as the primary instruction source. Do not add assumptions, targeting criteria, deadline requirements, product details, or opportunity types that the user did not provide.
- Use listObjective and leadDefinition as the qualification lens for this PipeList. The returned notes and rationale must explain fit against that profile when provided.
- When the prompt contains a pasted list or article with multiple named entries, extract every distinct named entry up to requestedLeadCount. Treat this as an extraction job, not a request to return a smaller sample.
- When inputEntries is provided, research each input entry in order and return exactly one lead for every input entry up to requestedLeadCount unless that entry cannot be identified from current sources.
- When inputEntries contains one exact school or university name, treat it as a named target to verify, not a broad discovery request. Return that institution if a current official source exists.
- Do not return an empty list merely because the supplied institution name is broad, well-known, or needs buyer research. Use the source-backed notes and nextStep fields to explain the relevant buyer path.
- For pasted structured content, preserve the supplied names and facts. Use web search to locate and verify a supporting source for each entry rather than replacing the entries with different recommendations.
- If a supplied name is shorthand, misspelled, or informal, use the verified official name in title/organization while keeping the returned lead clearly tied to the supplied entry.
- Use web search and return leads supported by current sources.
- Use the user's research brief to decide what insight to yield for each lead. Put the useful source-backed insight in description, notes, rationale, sourceEvidence, deadlineStatus, and nextStep.
- Return only leads that are relevant to the active PipeList and the user's prompt.
- A lead must be a specific actionable entity: a named fund, person, company, program, grant, competition, contract, school, partner, or opportunity.
- For universities or schools, the lead should be the specific institution, preferably using its official homepage, athletics page, department page, or official staff/contact page as sourceUrl.
- For university pilot PipeLists, never use an individual staff member as title. Put the institution, department, or program in title and put people in decisionMaker.
- description must concisely summarize what the entity is in 1-2 source-supported sentences. Keep fit analysis, prep angle, and recommendations in notes or rationale instead.
- Do not return source pages that are merely lists of other leads, directories, databases, rankings, roundups, market maps, article collections, or sector overviews.
- If a useful source page is a list/directory/roundup, treat it as a research source only: open or follow the entries, extract the individual leads from that page, and return those individual leads instead.
- Each returned lead's sourceUrl must point to that individual lead's official page, LinkedIn/profile page, application page, fund page, or program page. Do not use a directory/list page as sourceUrl unless it is also the official page for that exact lead.
- Avoid exact duplicates already in the user's list. For inputEntries, do not suppress a supplied entry unless it clearly matches an existing title plus organization or sourceUrl.
- Never invent deadlines, prizes, contacts, amounts, fit claims, or organizations.
- Only include contactEmails when a current source visibly provides valid public email addresses. Never invent contact emails.
- If a source has an explicit deadline, dueDate must use ISO format YYYY-MM-DD and deadlineSource must be "explicit".
- If a source does not visibly list a deadline, leave dueDate, expectedCloseDate, pilotStart, and pilotEnd empty and set deadlineSource to "none".
- Never create internal follow-up dates, expected-close dates, pilot dates, or relationship deadlines during research.
- If requireFutureDeadline is true, every returned lead must have a verified dueDate on or after ${today}.
- If requireFutureDeadline is false, dueDate can be "" unless the source provides a real deadline.
- If officialSourcesOnly is true, prefer official/current sources and verify against official pages before returning a lead.
- Pick stage from the provided stage ids only. If unsure, use the first stage id.
- Keep notes useful for the user: concise analysis, prep angle, and practical context. Do not write "AI confidence".
- sourceEvidence must briefly name the source support used, including the deadline when relevant.
- deadlineStatus must state whether the lead has a future deadline, no fixed deadline, or an optional follow-up date.
- Return JSON only.${forceExactEntry ? '\n- Exact-entry retry: the previous pass returned no candidates. Search the exact inputEntries value again and return one usable official-source lead if the institution or organization exists.' : ''}`;

  const requestRawLeads = async (forceExactEntry: boolean) => {
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
        temperature: forceExactEntry ? 0.05 : 0.15,
        max_output_tokens: Math.min(14000, Math.max(5000, count * 450)),
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
            content: buildSystemPrompt(forceExactEntry),
          },
          {
            role: 'user',
            content: JSON.stringify(
              {
                requestedLeadCount: count,
                taskMode,
                forceExactEntry,
                listName,
                listDescription,
                listObjective,
                leadDefinition,
                templateLabel,
                templateKey,
                deadlineRequired,
                officialSourcesOnly,
                stageOptions,
                searchPrompt: adjustments,
                researchPrompt,
                inputEntries,
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
      return {
        ok: false as const,
        status: response.status,
        error: getBridgeErrorMessage(data),
        rawLeads: [] as unknown[],
      };
    }

    const parsed = parseJsonSafe(getResponseText(data) || '{}');
    return {
      ok: true as const,
      rawLeads: parsed && typeof parsed === 'object' && Array.isArray(parsed.leads) ? parsed.leads : [],
    };
  };

  const filterLeadCandidates = (rawLeads: unknown[]) => {
    const seenKeys = new Set<string>();
    const filtered = emptyLeadFilterStats();
    const leads: LeadCandidate[] = [];
    const exactEntryLabel = inputEntries.length === 1 ? cleanString(inputEntries[0], 160) : '';
    const exactEntryKeys = exactEntryLabel ? [normalizeKey(exactEntryLabel)].filter(Boolean) : [];

    rawLeads.forEach((rawLead) => {
      let lead = sanitizeLead(rawLead, stageIds, fallbackStage, today, deadlineRequired);
      if (!lead) {
        filtered.invalid += 1;
        return;
      }
      const initialLeadKeys = [
        normalizeKey(lead.title),
        normalizeKey(lead.organization),
        normalizeKey(`${lead.title} ${lead.organization}`),
        normalizeKey(lead.sourceUrl),
      ].filter(Boolean);
      const isExactEntryMatch =
        exactEntryKeys.length > 0 && exactEntryKeys.some((entryKey) => initialLeadKeys.some((leadKey) => keyContains(leadKey, entryKey)));
      const originalTitle = lead.title;
      const originalOrganization = lead.organization;

      if (
        exactEntryLabel &&
        isExactEntryMatch &&
        looksLikePersonName(originalTitle) &&
        exactEntryKeys.some((entryKey) => keyContains(normalizeKey(originalOrganization), entryKey))
      ) {
        lead = {
          ...lead,
          title: exactEntryLabel,
          organization: originalOrganization || exactEntryLabel,
          decisionMaker: lead.decisionMaker || originalTitle,
        };
      }

      if (isLikelyAggregateSource(lead) && !isExactEntryMatch) {
        filtered.aggregate += 1;
        return;
      }
      const leadKeys = [
        normalizeKey(lead.title),
        normalizeKey(lead.organization),
        normalizeKey(`${lead.title} ${lead.organization}`),
        normalizeKey(lead.sourceUrl),
      ].filter(Boolean);
      if (leadKeys.some((key) => existingKeys.has(key) || seenKeys.has(key))) {
        filtered.duplicate += 1;
        return;
      }
      leadKeys.forEach((key) => seenKeys.add(key));
      leads.push(lead);
    });

    return {
      leads: leads.slice(0, count),
      filtered,
    };
  };

  try {
    const initialResponse = await requestRawLeads(false);
    if (!initialResponse.ok) {
      return res.status(initialResponse.status).json({ error: initialResponse.error, success: false });
    }

    let rawLeads = initialResponse.rawLeads;
    let retryUsed = false;
    let { leads, filtered } = filterLeadCandidates(rawLeads);

    if (inputEntries.length === 1 && leads.length === 0 && rawLeads.length === 0) {
      const retryResponse = await requestRawLeads(true);
      if (retryResponse.ok) {
        rawLeads = retryResponse.rawLeads;
        retryUsed = true;
        ({ leads, filtered } = filterLeadCandidates(rawLeads));
      }
    }

    return res.status(200).json({
      success: true,
      searchedAt: today,
      deadlineRequired,
      model: OPENAI_LEAD_GEN_MODEL,
      rawLeadCount: rawLeads.length,
      retryUsed,
      filtered,
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
