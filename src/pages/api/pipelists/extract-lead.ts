import type { NextApiRequest, NextApiResponse } from 'next';
import { JSDOM } from 'jsdom';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BRIDGE_FEATURE_ID = 'pipeListsLeadExtraction';
const MAX_PAGE_TEXT_CHARS = 45000;

type StageInput = {
  id: string;
  label: string;
  probability?: number;
};

type ExtractLeadRequest = {
  url?: string;
  listName?: string;
  templateLabel?: string;
  templateKey?: string;
  stages?: StageInput[];
};

const cleanText = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, listName, templateLabel, templateKey, stages } = (req.body || {}) as ExtractLeadRequest;
  const safeUrl = typeof url === 'string' ? url.trim() : '';

  if (!safeUrl) {
    return res.status(400).json({ error: 'Lead URL is required' });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(safeUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Unsupported URL protocol');
    }
  } catch {
    return res.status(400).json({ error: 'Enter a valid http or https URL' });
  }

  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please sign in before analyzing leads.' });
  }

  try {
    const page = await readPage(parsedUrl.toString());
    if (!page.text || page.text.length < 80) {
      return res.status(422).json({ error: 'Could not find enough readable text on that page.' });
    }

    const stageOptions = Array.isArray(stages) && stages.length > 0 ? stages : [];
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
        max_tokens: 1400,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You extract lead data for a universal list-management app.

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
  "confidence": number,
  "missingFields": string[]
}

Rules:
- Use only information supported by the page text. Do not invent names, amounts, emails, dates, or contacts.
- For unknown fields, return "".
- Pick "stage" from the provided stage ids only. If unsure, use the first stage id.
- "title" should be a short lead name, not a marketing headline.
- "organization" should be the company, school, grant program, competition, fund, or partner name.
- "nextStep" should be a practical next action for following up.
- "notes" should be blank unless the page contains deal-moving context: buyer angle, eligibility nuance, budget/funding detail, deadline risk, procurement constraint, relationship context, strategic fit, or a prep detail that changes what the user should do.
- Do not use "notes" to summarize what the page is, describe the website, or explain generic relevance. If the only note is "this page appears to be..." or "may be relevant...", return "".
- Use ISO date format YYYY-MM-DD for dates when explicit dates appear.
- Keep confidence from 0 to 100.`,
          },
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
    const parsed = parseJsonSafe(raw);

    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({ error: 'OpenAI returned an unreadable extraction.' });
    }

    const stageIds = stageOptions.map((stage) => stage.id);
    const fallbackStage = stageIds[0] || '';
    const stage = typeof parsed.stage === 'string' && stageIds.includes(parsed.stage) ? parsed.stage : fallbackStage;
    const priority = ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium';

    return res.status(200).json({
      success: true,
      item: {
        title: typeof parsed.title === 'string' ? parsed.title : '',
        organization: typeof parsed.organization === 'string' ? parsed.organization : '',
        owner: typeof parsed.owner === 'string' ? parsed.owner : '',
        stage,
        priority,
        amount: typeof parsed.amount === 'string' ? parsed.amount : '',
        dueDate: typeof parsed.dueDate === 'string' ? parsed.dueDate : '',
        nextStep: typeof parsed.nextStep === 'string' ? parsed.nextStep : '',
        notes: cleanExtractedNotes(parsed.notes),
        segment: typeof parsed.segment === 'string' ? parsed.segment : '',
        decisionMaker: typeof parsed.decisionMaker === 'string' ? parsed.decisionMaker : '',
        acv: typeof parsed.acv === 'string' ? parsed.acv : '',
        expectedCloseDate: typeof parsed.expectedCloseDate === 'string' ? parsed.expectedCloseDate : '',
        contractTerm: typeof parsed.contractTerm === 'string' ? parsed.contractTerm : '',
        pilotScope: typeof parsed.pilotScope === 'string' ? parsed.pilotScope : '',
        athleteCount: typeof parsed.athleteCount === 'string' ? parsed.athleteCount : '',
        pilotStart: typeof parsed.pilotStart === 'string' ? parsed.pilotStart : '',
        pilotEnd: typeof parsed.pilotEnd === 'string' ? parsed.pilotEnd : '',
        conversionLikelihood: typeof parsed.conversionLikelihood === 'string' ? parsed.conversionLikelihood : '',
        grossMargin: typeof parsed.grossMargin === 'string' ? parsed.grossMargin : '',
        partnerCost: typeof parsed.partnerCost === 'string' ? parsed.partnerCost : '',
        hardwareCost: typeof parsed.hardwareCost === 'string' ? parsed.hardwareCost : '',
        lossReason: typeof parsed.lossReason === 'string' ? parsed.lossReason : '',
        expansionPath: typeof parsed.expansionPath === 'string' ? parsed.expansionPath : '',
        sourceUrl: parsedUrl.toString(),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields.filter((item: unknown) => typeof item === 'string') : [],
      },
    });
  } catch (error) {
    console.error('[PipeLists Extract Lead] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to analyze that lead URL.',
      success: false,
    });
  }
}
