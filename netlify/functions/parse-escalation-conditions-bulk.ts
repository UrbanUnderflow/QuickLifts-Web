import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

type RequestBody = {
  tier: number; // 1 | 2 | 3 (EscalationTier)
  allowedCategories: string[]; // strict allowed categories for the selected tier
  template: 'v1';
  text: string;
};

type ParsedCondition = {
  title: string;
  description: string;
  category: string;
  keywords: string[];
  examplePhrases: string[];
  priority: number; // 0-10
  isActive: boolean;
  tier: number; // echoed back (forced)
};

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

function normalizeList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .map((s) => s.replace(/^[-•]\s*/, ''));
}

function clampPriority(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, Math.round(v)));
}

function safeBool(v: unknown, fallback = true): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
  }
  return fallback;
}

function extractQuotedPhrases(text: string): { cleaned: string; phrases: string[] } {
  // Supports straight quotes "..." and curly quotes “...”
  const phrases: string[] = [];
  const regex = /["“]([^"”]+)["”]/g;
  let cleaned = text;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const phrase = (match[1] || '').trim();
    if (phrase) phrases.push(phrase);
  }
  if (phrases.length) {
    cleaned = cleaned.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
    // Clean dangling punctuation/commas
    cleaned = cleaned.replace(/\s+,/g, ',').replace(/,\s+,/g, ',').replace(/,\s*$/g, '').trim();
  }
  return { cleaned, phrases };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    if (!process.env.OPEN_AI_SECRET_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing OPEN_AI_SECRET_KEY' }) };
    }

    const body = (JSON.parse(event.body || '{}') || {}) as RequestBody;
    const tier = Number(body.tier);
    const allowedCategories = Array.isArray(body.allowedCategories) ? body.allowedCategories : [];
    const template = body.template;
    const text = String(body.text || '');

    if (![1, 2, 3].includes(tier)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid tier. Must be 1, 2, or 3.' }) };
    }
    if (template !== 'v1') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid template. Must be v1.' }) };
    }
    if (!text.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing text' }) };
    }
    if (!allowedCategories.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing allowedCategories' }) };
    }

    // Hard limit to keep prompt safe
    const trimmedText = text.length > 40000 ? text.slice(0, 40000) : text;

    const looksLikeBlockTemplate = /(^|\n)\s*title\s*:/i.test(trimmedText) && /(^|\n)\s*category\s*:/i.test(trimmedText);
    const looksLikeBulletList = /(^|\n)\s*[-*•]\s+/.test(trimmedText) && !looksLikeBlockTemplate;

    const system = `
You are a strict parser for an admin bulk-import template.

The admin has selected escalation tier ${tier}. Every returned condition MUST:
- have tier = ${tier}
- have category EXACTLY one of the allowed categories provided

TEMPLATE (v1) RULES:
- There are TWO accepted formats (still considered the same v1 import template):
  A) Block format:
     - Input contains multiple blocks separated by a line with only: ---
     - Each block uses these keys (case-insensitive):
       Title:
       Category:
       Description:
       Priority: (0-10)
       Active: (true/false)
       Keywords: (comma-separated)
       ExamplePhrases: (list lines starting with -)
  B) List format:
     - One condition per line, starting with -, *, or •
     - Format: "- Title: description"
     - Category is NOT required in list format; you must infer it from the description, BUT it must be one of allowed categories.
     - Priority/Active/Keywords/ExamplePhrases are optional; infer reasonable defaults:
       priority: 5 (unless clearly stronger/weaker, clamp 0-10)
       isActive: true
       keywords: 5-20
       examplePhrases: 2-8
     - IMPORTANT: If a list line contains quoted text (e.g. "can't stop thinking about race" or “...”),
       those quoted strings MUST be placed into examplePhrases (without quotes), and removed from description.

OUTPUT RULES:
- Return ONLY JSON.
- Shape:
  {
    "conditions": [
      {
        "title": string,
        "description": string,
        "category": string,
        "keywords": string[],
        "examplePhrases": string[],
        "priority": number,
        "isActive": boolean,
        "tier": number
      }
    ],
    "warnings": string[]
  }

STRICTNESS:
- If a block is missing a required field (Title, Category, Description), omit it and add a warning.
- If Category is not one of the allowed categories, OMIT the block and add a warning (do not guess).
- Keep keywords concise (5-20) and examplePhrases concise (2-8). Trim whitespace and remove empty values.
`.trim();

    const user = `
AllowedCategories: ${JSON.stringify(allowedCategories)}
DetectedFormat: ${looksLikeBlockTemplate ? 'block' : looksLikeBulletList ? 'list' : 'unknown'}

InputText:
${trimmedText}
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Empty OpenAI response' }) };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Invalid JSON from OpenAI', detail: content }) };
    }

    const warnings: string[] = normalizeList(parsed?.warnings);
    const rawConditions: any[] = Array.isArray(parsed?.conditions) ? parsed.conditions : [];

    const conditions: ParsedCondition[] = rawConditions
      .map((c) => {
        const title = typeof c?.title === 'string' ? c.title.trim() : '';
        const description = typeof c?.description === 'string' ? c.description.trim() : '';
        const category = typeof c?.category === 'string' ? c.category.trim() : '';
        const keywords = normalizeList(c?.keywords);
        const examplePhrases = normalizeList(c?.examplePhrases);
        const priority = clampPriority(c?.priority);
        const isActive = safeBool(c?.isActive, true);
        // If model left quoted phrases inside description, move them to examplePhrases.
        const extracted = extractQuotedPhrases(description);
        const mergedExamplePhrases = [...examplePhrases, ...extracted.phrases]
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          title,
          description: extracted.cleaned || description,
          category,
          keywords,
          examplePhrases: mergedExamplePhrases,
          priority,
          isActive,
          tier
        };
      })
      .filter((c) => {
        if (!c.title || !c.description || !c.category) return false;
        if (!allowedCategories.includes(c.category)) return false;
        return true;
      })
      .map((c) => ({
        ...c,
        keywords: c.keywords.slice(0, 25),
        examplePhrases: c.examplePhrases.slice(0, 12),
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        conditions,
        warnings,
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || 'Server error',
      }),
    };
  }
};

