import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

const MAX_ARTIFACT_CHARS = 180000;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function parseJsonSafe(raw: string): any {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Refines a campaign strategy artifact via OpenAI.
 *
 * Input: { artifact: string, prompt: string, campaignTitle?: string }
 * Output: { success: true, artifact: string }
 *
 * The returned artifact is the FULL updated strategy text,
 * which the frontend can display and later "Apply" to repopulate
 * the email sequences / settings.
 */
export const handler: Handler = async (event) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'OPENAI_API_KEY is not configured' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { artifact, prompt, campaignTitle } = body;

        if (!artifact || typeof artifact !== 'string' || artifact.trim().length < 20) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'A valid strategy artifact is required' })
            };
        }
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'A prompt describing the changes is required' })
            };
        }

        const openai = new OpenAI({ apiKey });
        const safeArtifact = artifact.slice(0, MAX_ARTIFACT_CHARS);

        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            temperature: 0.3,
            max_tokens: 5000,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `You are an expert cold email copywriter and campaign strategist for a fitness app called Pulse.

You will be given a campaign strategy document (the "artifact") and a user instruction describing changes to make.

Return a JSON object with exactly two keys:
1. "artifact" — the FULL updated strategy document (not a diff, not a summary)
2. "summary" — a short, conversational response (2-4 sentences) that:
   - Starts with your brief opinion on the request (e.g. "Good call — shorter follow-ups tend to perform better.")
   - Then summarizes what you changed (e.g. "I trimmed email 2 down to 3 sentences and made the tone more casual.")
   - Be specific about what emails/sections were modified

RULES for the artifact:
- Return the FULL updated strategy document.
- Preserve all formatting, structure, and sections from the original.
- Only change what the user's instruction asks for.
- Personalization placeholders like {{firstName}}, {{goal}}, {{level}}, {{focusArea}} should be preserved UNLESS the user explicitly asks to remove, replace, or change them. The user's instruction always takes priority.
- Keep email sequence numbering, delay days, subject lines, and settings sections intact unless the user asks to change them.
- If the user asks to add a new email, append it with appropriate delay and numbering.
- If the user asks to change tone, rewrite the bodies but keep structure.
- Keep the document human-readable.
- Do NOT wrap the artifact in code fences.`
                },
                {
                    role: 'user',
                    content: `Here is the current campaign strategy artifact for "${campaignTitle || 'campaign'}":\n\n---\n${safeArtifact}\n---\n\nPlease make the following changes:\n${prompt.trim()}`
                }
            ]
        });

        const raw = response.choices?.[0]?.message?.content?.trim() || '{}';
        const parsed = parseJsonSafe(raw);

        if (!parsed || !parsed.artifact || parsed.artifact.length < 20) {
            // Fallback: treat entire response as artifact if JSON parsing failed
            const fallbackArtifact = raw.length > 20 ? raw : null;
            if (!fallbackArtifact) {
                return {
                    statusCode: 422,
                    headers,
                    body: JSON.stringify({
                        error: 'OpenAI returned an empty or invalid response. Try a more specific prompt.'
                    })
                };
            }
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    artifact: fallbackArtifact,
                    summary: 'Changes applied to the strategy document.'
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                artifact: parsed.artifact,
                summary: parsed.summary || 'Changes applied to the strategy document.'
            })
        };

    } catch (error: any) {
        console.error('[Refine Strategy] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error?.message || 'Failed to refine campaign strategy'
            })
        };
    }
};
