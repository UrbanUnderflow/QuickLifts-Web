import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function parseJsonSafe(raw: string): any {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Scans a campaign strategy artifact for spam trigger keywords,
 * deliverability risks, and formatting issues.
 *
 * Returns a structured report with flagged items and suggestions.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    const { artifact } = req.body || {};

    if (!artifact || typeof artifact !== 'string' || artifact.trim().length < 20) {
        return res.status(400).json({ error: 'A valid strategy artifact is required' });
    }

    try {
        const openai = new OpenAI({ apiKey });

        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            temperature: 0.1,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `You are a cold email deliverability expert. Analyze the provided email campaign strategy for spam triggers and deliverability risks.

Return a JSON object with:
{
  "score": number (0-100, where 100 = perfectly clean, 0 = very spammy),
  "verdict": "clean" | "minor_issues" | "needs_attention" | "high_risk",
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "type": "spam_word" | "formatting" | "link" | "tone" | "length" | "personalization",
      "text": "the exact problematic word or phrase from the email",
      "email": "Email 1" or "Email 2" etc (which email it appears in),
      "suggestion": "what to replace it with or how to fix it"
    }
  ],
  "summary": "A brief 1-2 sentence overall assessment"
}

Common spam trigger words to flag:
- Sales pressure: "buy now", "act now", "limited time", "don't miss", "hurry", "urgent", "exclusive deal", "order now"
- Free offers: "free", "no cost", "complimentary", "bonus", "gift"
- Money: "earn money", "make money", "cash", "income", "$$$", "save big", "discount", "cheap"
- Guarantee: "100%", "guaranteed", "promise", "risk-free", "no obligation"
- Excessive: multiple exclamation marks (!!), ALL CAPS words, excessive emojis
- Clickbait: "click here", "click below", "open now", "read this"
- CAN-SPAM: missing unsubscribe/opt-out mention

Also flag:
- HTML-heavy formatting that could trigger filters
- Too many links (more than 1-2 per email)
- Very long emails (over 200 words in cold outreach)
- Lack of personalization (no {{firstName}} etc.)
- Generic subject lines
- Aggressive or pushy tone

Note: Words like "free" are OK in natural context (e.g., "feel free to reach out") — only flag when used in a promotional/spammy way.
Personalization placeholders like {{firstName}}, {{goal}}, etc. are GOOD — do not flag them.`
                },
                {
                    role: 'user',
                    content: `Analyze this campaign strategy for spam triggers and deliverability risks:\n\n${artifact.slice(0, 100000)}`
                }
            ]
        });

        const raw = response.choices?.[0]?.message?.content?.trim() || '{}';
        const parsed = parseJsonSafe(raw);

        if (!parsed) {
            return res.status(200).json({
                success: true,
                score: 50,
                verdict: 'needs_attention',
                issues: [],
                summary: 'Could not fully analyze the strategy. Review manually.'
            });
        }

        return res.status(200).json({
            success: true,
            score: parsed.score ?? 50,
            verdict: parsed.verdict || 'needs_attention',
            issues: Array.isArray(parsed.issues) ? parsed.issues : [],
            summary: parsed.summary || 'Analysis complete.'
        });

    } catch (error: any) {
        console.error('[Spam Check] Error:', error);
        return res.status(500).json({
            error: error?.message || 'Failed to check for spam triggers'
        });
    }
}
