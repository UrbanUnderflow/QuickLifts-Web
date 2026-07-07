import type { NextApiRequest, NextApiResponse } from 'next';
import { JSDOM } from 'jsdom';

const OPENAI_MODEL = process.env.OPENAI_EXTRACT_MODEL || 'gpt-4o-mini';
const OPENAI_RESEARCH_MODEL = process.env.OPENAI_EXTRACT_SEARCH_MODEL || 'gpt-4o';
const OPENAI_BRIDGE_FEATURE_ID = 'pipeListsLeadExtraction';
const MAX_PAGE_TEXT_CHARS = 45000;

type StageInput = {
  id: string;
  label: string;
  probability?: number;
};

type ExtractLeadRequest = {
  input?: string;
  leadInput?: string;
  query?: string;
  url?: string;
  listName?: string;
  templateLabel?: string;
  templateKey?: string;
  stages?: StageInput[];
};

const extractStringFields = [
  'title',
  'organization',
  'owner',
  'stage',
  'amount',
  'dueDate',
  'nextStep',
  'notes',
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
  'sourceUrl',
] as const;

const extractProperties = extractStringFields.reduce<Record<string, unknown>>((properties, field) => {
  properties[field] = { type: 'string' };
  return properties;
}, {
  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
  contactEmails: { type: 'array', items: { type: 'string' } },
  confidence: { type: 'number' },
  missingFields: { type: 'array', items: { type: 'string' } },
});

const extractResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: extractProperties,
  required: ['priority', 'contactEmails', 'confidence', 'missingFields', ...extractStringFields],
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanText = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();

const cleanString = (value: unknown, maxLength = 1200) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\u00a0/g, ' ').trim().slice(0, maxLength);
};

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

const normalizeLeadUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : /^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(trimmed) ? `https://${trimmed}` : '';
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
};

const getMetaContent = (document: Document, selector: string) =>
  document.querySelector(selector)?.getAttribute('content')?.trim() || '';

const readPage = async (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
        'user-agent': 'Pulse PipeLists lead extractor (+https://fitwithpulse.ai)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Could not read the URL. The site returned ${response.status}.`);
    }

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    if (!contentType.includes('html')) {
      return {
        title: '',
        description: '',
        text: cleanText(raw).slice(0, MAX_PAGE_TEXT_CHARS),
      };
    }

    const dom = new JSDOM(raw);
    const { document } = dom.window;
    document.querySelectorAll('script, style, noscript, svg, iframe').forEach((node) => node.remove());

    const title = cleanText(
      document.querySelector('title')?.textContent ||
        getMetaContent(document, 'meta[property="og:title"]') ||
        '',
    );
    const description = cleanText(
      getMetaContent(document, 'meta[name="description"]') ||
        getMetaContent(document, 'meta[property="og:description"]') ||
        '',
    );
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map((node) => cleanText(node.textContent || ''))
      .filter(Boolean)
      .slice(0, 30)
      .join('\n');
    const bodyText = cleanText(document.body?.textContent || '');

    return {
      title,
      description,
      text: [title, description, headings, bodyText].filter(Boolean).join('\n\n').slice(0, MAX_PAGE_TEXT_CHARS),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const parseJsonSafe = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
          const text = (part as Record<string, unknown>).text;
          return typeof text === 'string' ? text : '';
        })
        .filter(Boolean);
    })
    .join('\n');
};

const getBridgeOrigin = () =>
  (process.env.OPENAI_BRIDGE_FALLBACK_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai')
    .replace(/\/+$/, '');

const getBridgeErrorMessage = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return 'Unable to analyze that lead URL.';

  const record = value as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
  }
  if (typeof error === 'string') return error;
  if (typeof record.message === 'string') return record.message;
  return 'Unable to analyze that lead URL.';
};

const cleanExtractedNotes = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim();
  if (!cleaned) return '';

  const genericPageSummaryPatterns = [
    /^\s*(this|the)\s+page\s+(serves|appears|is|provides|showcases|contains|describes|highlights)\b/i,
    /^\s*(this|the)\s+(website|site)\s+(serves|appears|is|provides|showcases|contains|describes|highlights)\b/i,
    /\bmay be relevant for partnerships? or sponsorships?\b/i,
    /\bcould be relevant for partnerships? or sponsorships?\b/i,
    /\bshowcasing various\b/i,
    /\bofficial athletics website\b/i,
  ];

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter((paragraph) => !genericPageSummaryPatterns.some((pattern) => pattern.test(paragraph)));

  return paragraphs.join('\n\n').trim();
};

const normalizeExtractedItem = (
  parsed: Record<string, unknown>,
  stageOptions: StageInput[],
  fallbackSourceUrl: string,
) => {
  const stageIds = stageOptions.map((stage) => stage.id);
  const fallbackStage = stageIds[0] || '';
  const parsedStage = cleanString(parsed.stage, 80);
  const parsedPriority = cleanString(parsed.priority, 20);
  const parsedSourceUrl = cleanString(parsed.sourceUrl, 800);

  return {
    title: cleanString(parsed.title, 240),
    organization: cleanString(parsed.organization, 240),
    owner: cleanString(parsed.owner, 120),
    stage: parsedStage && stageIds.includes(parsedStage) ? parsedStage : fallbackStage,
    priority: ['high', 'medium', 'low'].includes(parsedPriority) ? parsedPriority : 'medium',
    amount: cleanString(parsed.amount, 160),
    dueDate: cleanString(parsed.dueDate, 24),
    nextStep: cleanString(parsed.nextStep, 360),
    notes: cleanExtractedNotes(parsed.notes),
    segment: cleanString(parsed.segment, 180),
    decisionMaker: cleanString(parsed.decisionMaker, 180),
    acv: cleanString(parsed.acv, 120),
    expectedCloseDate: cleanString(parsed.expectedCloseDate, 24),
    contractTerm: cleanString(parsed.contractTerm, 120),
    pilotScope: cleanString(parsed.pilotScope, 500),
    athleteCount: cleanString(parsed.athleteCount, 120),
    pilotStart: cleanString(parsed.pilotStart, 24),
    pilotEnd: cleanString(parsed.pilotEnd, 24),
    conversionLikelihood: cleanString(parsed.conversionLikelihood, 160),
    grossMargin: cleanString(parsed.grossMargin, 120),
    partnerCost: cleanString(parsed.partnerCost, 120),
    hardwareCost: cleanString(parsed.hardwareCost, 120),
    lossReason: cleanString(parsed.lossReason, 240),
    expansionPath: cleanString(parsed.expansionPath, 500),
    sourceUrl: normalizeLeadUrl(parsedSourceUrl)?.toString() || fallbackSourceUrl,
    contactEmails: normalizeContactEmails(parsed.contactEmails),
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    missingFields: Array.isArray(parsed.missingFields)
      ? parsed.missingFields.map((item) => cleanString(item, 120)).filter(Boolean)
      : [],
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { input, leadInput, query, url, listName, templateLabel, templateKey, stages } = (req.body || {}) as ExtractLeadRequest;
  const rawInput = cleanString(input || leadInput || query || url, 1200);

  if (!rawInput) {
    return res.status(400).json({ error: 'Lead URL or name is required' });
  }

  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please sign in before analyzing leads.' });
  }

  try {
    const stageOptions = Array.isArray(stages) && stages.length > 0 ? stages : [];
    const parsedUrl = normalizeLeadUrl(rawInput);
    const systemPrompt = `You extract lead data for a universal list-management app.

Return only JSON with this shape:
{
  "title": string,
  "organization": string,
  "owner": string,
  "stage": string,
  "priority": "high" | "medium" | "low",
  "amount": string,
  "dueDate": string,
  "nextStep": string,
  "notes": string,
  "segment": string,
  "decisionMaker": string,
  "acv": string,
  "expectedCloseDate": string,
  "contractTerm": string,
  "pilotScope": string,
  "athleteCount": string,
  "pilotStart": string,
  "pilotEnd": string,
  "conversionLikelihood": string,
  "grossMargin": string,
  "partnerCost": string,
  "hardwareCost": string,
  "lossReason": string,
  "expansionPath": string,
  "sourceUrl": string,
  "contactEmails": string[],
  "confidence": number,
  "missingFields": string[]
}

Rules:
- Use only information supported by the page text. Do not invent names, amounts, emails, dates, or contacts.
- For unknown fields, return "".
- Only include contactEmails when the source visibly provides valid public email addresses. Never invent emails.
- Pick "stage" from the provided stage ids only. If unsure, use the first stage id.
- "title" should be a short lead name, not a marketing headline.
- "organization" should be the company, school, grant program, competition, fund, or partner name.
- "nextStep" should be a practical next action for following up.
- "notes" should be blank unless the page contains deal-moving context: buyer angle, eligibility nuance, budget/funding detail, deadline risk, procurement constraint, relationship context, strategic fit, or a prep detail that changes what the user should do.
- Do not use "notes" to summarize what the page is, describe the website, or explain generic relevance. If the only note is "this page appears to be..." or "may be relevant...", return "".
- Use ISO date format YYYY-MM-DD for dates when explicit dates appear.
- Keep confidence from 0 to 100.`;

    let parsed: unknown = null;
    let fallbackSourceUrl = '';

    if (parsedUrl) {
      const page = await readPage(parsedUrl.toString());
      if (!page.text || page.text.length < 80) {
        return res.status(422).json({ error: 'Could not find enough readable text on that page.' });
      }
      fallbackSourceUrl = parsedUrl.toString();

      const bridgeResponse = await fetch(`${getBridgeOrigin()}/api/openai/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          'openai-organization': OPENAI_BRIDGE_FEATURE_ID,
          'x-pulsecheck-firebase-mode': 'prod',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.1,
          max_tokens: 1600,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: JSON.stringify(
                {
                  url: parsedUrl.toString(),
                  pageTitle: page.title,
                  pageDescription: page.description,
                  listName: listName || '',
                  templateLabel: templateLabel || '',
                  templateKey: templateKey || '',
                  stages: stageOptions,
                  pageText: page.text,
                },
                null,
                2,
              ),
            },
          ],
        }),
      });

      const bridgeData = await bridgeResponse.json().catch(() => null);
      if (!bridgeResponse.ok) {
        return res.status(bridgeResponse.status).json({ error: getBridgeErrorMessage(bridgeData) });
      }

      const raw = bridgeData?.choices?.[0]?.message?.content?.trim() || '{}';
      parsed = parseJsonSafe(raw);
    } else {
      const bridgeResponse = await fetch(`${getBridgeOrigin()}/api/openai/v1/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          'openai-organization': OPENAI_BRIDGE_FEATURE_ID,
          'x-pulsecheck-firebase-mode': 'prod',
        },
        body: JSON.stringify({
          model: OPENAI_RESEARCH_MODEL,
          temperature: 0.1,
          max_output_tokens: 1700,
          tools: [{ type: 'web_search' }],
          text: {
            format: {
              type: 'json_schema',
              name: 'pipelists_lead_extraction',
              strict: true,
              schema: extractResponseSchema,
            },
          },
          input: [
            {
              role: 'system',
              content: `${systemPrompt}

When the user provides only a name, person, organization, fund, school, program, or short phrase, use web search to identify the most likely lead and fill only fields that current sources support. If the result is ambiguous, choose the best match and list ambiguity in missingFields.`,
            },
            {
              role: 'user',
              content: JSON.stringify(
                {
                  leadInput: rawInput,
                  listName: listName || '',
                  templateLabel: templateLabel || '',
                  templateKey: templateKey || '',
                  stages: stageOptions,
                },
                null,
                2,
              ),
            },
          ],
        }),
      });

      const bridgeData = await bridgeResponse.json().catch(() => null);
      if (!bridgeResponse.ok) {
        return res.status(bridgeResponse.status).json({ error: getBridgeErrorMessage(bridgeData) });
      }

      parsed = parseJsonSafe(getResponseText(bridgeData) || '{}');
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({ error: 'OpenAI returned an unreadable extraction.' });
    }

    return res.status(200).json({
      success: true,
      item: normalizeExtractedItem(parsed as Record<string, unknown>, stageOptions, fallbackSourceUrl),
    });
  } catch (error) {
    console.error('[PipeLists Extract Lead] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to analyze that lead.',
      success: false,
    });
  }
}
