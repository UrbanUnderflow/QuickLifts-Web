import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/agent/followup
 * Body: { chatId, context, targetAgent, participants }
 *
 * Generates a Nora follow-up question for the brainstorm round table.
 * Nora acts as the facilitator, keeping the conversation alive by
 * asking probing questions to specific agents.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { context, targetAgent, participants } = req.body;

    if (!context || !targetAgent) {
        return res.status(400).json({ error: 'Missing context or targetAgent' });
    }

    const agentNames: Record<string, string> = {
        sage: 'Sage',
        scout: 'Scout',
        solara: 'Solara',
        nora: 'Nora',
        antigravity: 'Antigravity',
    };

    const targetName = agentNames[targetAgent] || targetAgent;
    const participantNames = (participants || []).map((id: string) => agentNames[id] || id);

    const systemPrompt = `You are Nora — Director of System Ops at Pulse (FitWithPulse.ai). You're facilitating a round table brainstorm.

Your job: Keep the conversation alive with a sharp, probing follow-up question.

Rules:
- Address @${targetName} directly with a question that builds on the conversation
- Ask ONE question that digs deeper, challenges an assumption, or connects ideas
- Keep it under 2 sentences — punchy, not verbose
- Use @${targetName} at the start of your message
- Don't summarize what was said — push the discussion forward
- Occasionally reference what another agent said to create cross-pollination
- Be specific, not generic. Reference real concepts from the conversation.

Participants: ${participantNames.join(', ')}

Example outputs:
- "@Scout That dependency model is interesting — but what happens when two agents claim the same resource simultaneously? Have you thought about conflict resolution?"
- "@Solara You mentioned narrative cues over backlogs. How would we track accountability without explicit story points?"
- "@Sage The health data pipeline you described — could that same architecture power the real-time agent monitoring we've been discussing?"`;

    const userPrompt = `Here's the recent conversation:\n\n${context}\n\nGenerate a single follow-up question for @${targetName}:`;

    try {
        // Try OpenAI
        const apiKey = process.env.OPENAI_API_KEY;

        if (apiKey) {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.8,
                    max_tokens: 200,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const followUp = data.choices?.[0]?.message?.content?.trim();

                if (followUp) {
                    return res.status(200).json({ followUp, from: 'nora' });
                }
            } else {
                const errText = await response.text();
                console.error('[followup] OpenAI API error:', errText);
            }
        }

        // Fallback: generate a simple follow-up without AI
        const fallbackQuestions = [
            `@${targetName} That's an interesting angle — how would you prioritize implementing that given our current constraints?`,
            `@${targetName} Building on what was just discussed — what's the biggest risk you see if we move forward with this approach?`,
            `@${targetName} I want to dig deeper on your point — what would the MVP version of that look like?`,
            `@${targetName} Great perspective. How does this connect to what ${participantNames.filter((n: string) => n !== targetName)[0] || 'the team'} mentioned earlier?`,
        ];

        const followUp = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
        return res.status(200).json({ followUp, from: 'nora', fallback: true });

    } catch (error: any) {
        console.error('[followup] API error:', error);
        return res.status(500).json({ error: error.message || 'Failed to generate follow-up' });
    }
}
