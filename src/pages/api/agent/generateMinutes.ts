import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Generate Meeting Minutes API
 *
 * POST — Takes a conversation transcript (or raw messages array) and uses
 *         GPT-4o to produce high-signal, detailed, structured meeting minutes.
 *         Every substantive point from the transcript is surfaced — no generic filler.
 */

// All known agent IDs → display names
const AGENT_DISPLAY: Record<string, string> = {
    nora: 'Nora',
    scout: 'Scout',
    solara: 'Solara',
    sage: 'Sage',
    admin: 'Tremaine',
};

function toDisplay(id: string): string {
    return AGENT_DISPLAY[id.toLowerCase()] ?? (id.charAt(0).toUpperCase() + id.slice(1));
}

function buildTranscript(
    messages: Array<{
        from: string;
        content: string;
        responses?: Record<string, { content: string; status: string }>;
    }>
): string {
    const lines: string[] = [];

    for (const msg of messages) {
        const sender = toDisplay(msg.from);

        // Always include the initiating message (from admin or any agent)
        if (msg.content?.trim()) {
            lines.push(`${sender}: ${msg.content.trim()}`);
        }

        // Include every completed agent response in full
        if (msg.responses) {
            for (const [agentId, resp] of Object.entries(msg.responses)) {
                if (resp.status === 'completed' && resp.content?.trim()) {
                    lines.push(`${toDisplay(agentId)}: ${resp.content.trim()}`);
                }
            }
        }
    }

    return lines.join('\n\n');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { transcript: rawTranscript, messages, participants, messageCount, duration } = req.body;

        // Accept either a pre-built transcript string or the raw messages array
        const transcript: string = rawTranscript?.trim()
            || (messages ? buildTranscript(messages) : '');

        if (!transcript) {
            return res.status(400).json({ error: 'Missing transcript or messages' });
        }

        const participantNames = (participants as string[] || []).map(toDisplay);
        const charCount = transcript.length;

        const systemPrompt = `You are an elite executive assistant and strategic analyst for Pulse (FitWithPulse.ai), a fitness tech startup. Your job is to convert raw AI agent team conversations into high-signal meeting minutes that a founder can act on immediately.

MANDATORY RULES — violating these produces unusable output:
1. READ THE ENTIRE TRANSCRIPT before writing a single word. Capture every substantive idea.
2. Executive summary: minimum 4-6 sentences describing the REAL outcome of THIS specific conversation. Name specific projects, features, strategies, or concerns that were discussed. No generic filler whatsoever.
3. Value insights: each insight gets a specific, concrete takeaway. Explain HOW the insight connects to Pulse's goals and WHAT specific next move it unlocks. Never write "this could be valuable" without saying valuable HOW and TO WHOM.
4. Strategic decisions: only document things that were actually agreed upon or explicitly concluded — not aspirational statements. Be precise.
5. Next actions: enough specificity that someone could execute the task without re-reading the transcript. Don't write "follow up on X" — write exactly what following up entails.
6. Highlights: capture the most insightful, surprising, or energizing moments. Include near-verbatim quotes where meaningful, attributed to the correct speaker by name.
7. Risks / open questions: anything unresolved, any assumption needing validation, any point of genuine contention.
8. Participant names: ${participantNames.join(', ')}. Reference these names throughout (never use generic "agent" or "participant").
9. Length is not the enemy — being specific is. A 600-word executive summary is better than a 2-sentence platitude.

Return ONLY valid JSON matching this exact schema (no markdown fences, no text outside the JSON object):
{
  "executiveSummary": "4-6 sentence paragraph. Specific. References actual content from the conversation.",
  "valueInsights": [
    {
      "title": "Short punchy headline (not generic — name the actual concept discussed)",
      "takeaway": "2-3 sentences with specifics: what was learned, what angle was explored, what the implication is for Pulse",
      "impact": "Concrete, quantified-where-possible expected impact on the product, business metric, or team capability"
    }
  ],
  "strategicDecisions": [
    "A single, clear statement of a decision or position reached. Start with the decision itself."
  ],
  "nextActions": [
    {
      "task": "Specific, executable action item — enough context to act on without reading the transcript",
      "owner": "Responsible person's name",
      "due": "Due date or timeframe if mentioned or implied"
    }
  ],
  "highlights": [
    {
      "speaker": "Display name of the speaker",
      "summary": "Near-verbatim quote or precise description of a standout insight or moment"
    }
  ],
  "risksOrOpenQuestions": [
    "Specific unresolved question, risk, blocker, or assumption that needs follow-up — phrased as a direct question or clear concern"
  ]
}`;

        const userPrompt = `Here is the full Round Table transcript (${messageCount ?? 'N/A'} messages, duration: ${duration ?? 'N/A'}, ${charCount} characters, participants: ${participantNames.join(', ') || 'unknown'}):

${transcript}

Generate comprehensive, high-signal meeting minutes. Every section must directly reflect the actual content of this transcript.`;

        const useOpenClaw = process.env.USE_OPENCLAW === 'true';
        const apiKey = process.env.OPENAI_API_KEY;
        const allowDirectOpenAI = Boolean(apiKey) && !useOpenClaw;

        // Prefer OpenClaw when enabled so API-key billing is never used accidentally.
        if (useOpenClaw) {
            try {
                const { spawnSync } = require('child_process');
                const clawPrompt = `${systemPrompt}\n\n${userPrompt}`;
                const spawnResult = spawnSync(
                    process.env.OPENCLAW_BIN || 'openclaw',
                    [
                        '--no-color',
                        'agent',
                        '--local',
                        '--agent',
                        process.env.OPENCLAW_AGENT_ID || 'main',
                        '--message',
                        clawPrompt,
                        '--timeout',
                        '90',
                    ],
                    { encoding: 'utf8', timeout: 120_000, maxBuffer: 10 * 1024 * 1024, cwd: process.cwd(), env: process.env }
                );

                if (spawnResult.error) {
                    throw spawnResult.error;
                }
                if (spawnResult.status !== 0) {
                    throw new Error((spawnResult.stderr || spawnResult.stdout || '').trim() || `openclaw exit ${spawnResult.status}`);
                }
                const result = String(spawnResult.stdout || '').trim();

                // Try to parse the response
                try {
                    const parsed = JSON.parse(result);
                    if (parsed.executiveSummary) {
                        return res.status(200).json(parsed);
                    }
                    // OpenClaw might wrap in a response field
                    if (parsed.response) {
                        const inner = JSON.parse(parsed.response.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim());
                        return res.status(200).json(inner);
                    }
                } catch (e) {
                    console.error('Failed to parse OpenClaw response:', e);
                }
            } catch (e) {
                console.error('OpenClaw minutes generation failed:', e);
            }
        }

        // Try direct OpenAI only when OpenClaw mode is disabled.
        if (allowDirectOpenAI && apiKey) {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.4,
                    max_tokens: 4000,
                    response_format: { type: 'json_object' },
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('[generateMinutes] OpenAI API error:', errText);
                // Fall through to fallback
            } else {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content?.trim();

                if (content) {
                    try {
                        // Strip markdown fences just in case (shouldn't appear with json_object mode)
                        const jsonStr = content
                            .replace(/^```json?\n?/i, '')
                            .replace(/\n?```$/i, '')
                            .trim();
                        const parsed = JSON.parse(jsonStr);
                        return res.status(200).json(parsed);
                    } catch (parseErr) {
                        console.error('[generateMinutes] Failed to parse GPT response:', parseErr);
                        // Fall through to fallback
                    }
                }
            }
        }

        // ── Fallback: simple extraction (no AI available) ──────────────────────
        const lines = transcript.split('\n').filter((l: string) => l.trim());
        const questions: string[] = [];
        const highlights: Array<{ speaker: string; summary: string }> = [];

        for (const line of lines) {
            const [rawSpeaker, ...rest] = line.split(':');
            const text = rest.join(':').trim();
            if (!text) continue;
            if (text.includes('?')) questions.push(text);
            if (highlights.length < 4) {
                highlights.push({ speaker: rawSpeaker?.trim() || 'Participant', summary: text });
            }
        }

        return res.status(200).json({
            executiveSummary: `A round table session with ${participantNames.join(', ')} covering ${messageCount || lines.length} messages. AI synthesis was unavailable for this session — please review the full transcript to extract decisions and action items.`,
            valueInsights: [],
            strategicDecisions: ['AI synthesis unavailable — review transcript for decisions reached.'],
            nextActions: [{ task: 'Review the transcript and extract action items manually', owner: 'Tremaine' }],
            highlights,
            risksOrOpenQuestions: questions.slice(0, 5).length > 0
                ? questions.slice(0, 5)
                : ['No open questions captured in fallback extraction — please review transcript.'],
        });

    } catch (error: any) {
        console.error('[generateMinutes] Unexpected error:', error);
        return res.status(500).json({ error: error.message || 'Failed to generate minutes' });
    }
}
