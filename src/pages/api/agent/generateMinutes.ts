import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Generate Meeting Minutes API
 * 
 * POST — Takes a conversation transcript and uses AI to generate structured meeting minutes.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { transcript, participants, messageCount } = req.body;

        if (!transcript) {
            return res.status(400).json({ error: 'Missing transcript' });
        }

        const participantNames = (participants || []).map((p: string) =>
            p.charAt(0).toUpperCase() + p.slice(1)
        );

        const systemPrompt = `You are a meeting minutes summarizer for a startup team called Pulse (FitWithPulse.ai).
You will receive a transcript of a Round Table brainstorm session between the founder (Tremaine) and AI team members.

Generate structured meeting minutes in the following JSON format:
{
  "executiveSummary": "2-3 sentence overview of the session",
  "topicsDiscussed": [
    { "title": "Topic Name", "summary": "1-2 sentence summary of the discussion around this topic" }
  ],
  "keyInsights": [
    "A standout idea, observation, or 'aha' moment from the discussion"
  ],
  "decisions": [
    "A position taken or consensus reached during the discussion"
  ],
  "openQuestions": [
    "An unresolved question that needs follow-up"
  ],
  "actionItems": [
    { "task": "A concrete next step", "owner": "Person responsible" }
  ]
}

Rules:
- Be concise but capture the substance of the brainstorm
- Identify 2-5 key topics discussed
- Extract 3-5 key insights (the best ideas and observations)
- Identify any decisions or positions the team took
- List open questions that remain unresolved
- Suggest 2-4 action items based on the discussion, assign owners where obvious
- Use the actual names of participants (${participantNames.join(', ')})
- Return ONLY valid JSON, no markdown or extra text`;

        const userPrompt = `Here is the Round Table transcript with ${messageCount} messages between ${participantNames.join(', ')}:\n\n${transcript}`;

        // Try OpenAI first, then fall back to a structured extraction
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
                    temperature: 0.3,
                    max_tokens: 2000,
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('OpenAI API error:', errText);
                // Fall through to fallback
            } else {
                const data = await response.json();
                const content = data.choices?.[0]?.message?.content?.trim();

                if (content) {
                    try {
                        // Strip markdown code fences if present
                        const jsonStr = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
                        const parsed = JSON.parse(jsonStr);
                        return res.status(200).json(parsed);
                    } catch (e) {
                        console.error('Failed to parse AI response as JSON:', e);
                        // Fall through to fallback
                    }
                }
            }
        }

        // Fallback: Try OpenClaw via the agentRunner's approach
        const useOpenClaw = process.env.USE_OPENCLAW === 'true';
        if (useOpenClaw) {
            try {
                const { execSync } = require('child_process');
                const clawPrompt = `${systemPrompt}\n\n${userPrompt}`;
                const escaped = clawPrompt.replace(/'/g, "'\\''");
                const result = execSync(
                    `openclaw chat send '${escaped}' --agent main --json 2>/dev/null`,
                    { encoding: 'utf8', timeout: 60_000 }
                ).trim();

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

        // Final fallback: simple extraction from transcript
        const lines = transcript.split('\n').filter((l: string) => l.trim());
        const topics = new Set<string>();
        const insights: string[] = [];
        const questions: string[] = [];

        for (const line of lines) {
            if (line.includes('?')) {
                questions.push(line.split(':').slice(1).join(':').trim());
            }
            if (line.toLowerCase().includes('what if') || line.toLowerCase().includes('makes me wonder') || line.toLowerCase().includes('interesting')) {
                insights.push(line.split(':').slice(1).join(':').trim());
            }
        }

        return res.status(200).json({
            executiveSummary: `Round table discussion with ${participantNames.join(' and ')} covering ${messageCount} messages. The team explored several topics in a brainstorm format.`,
            topicsDiscussed: [{ title: 'General Discussion', summary: 'The team discussed various topics in a brainstorm format.' }],
            keyInsights: insights.slice(0, 5).length > 0 ? insights.slice(0, 5) : ['Discussion was actively collaborative with multiple perspectives shared.'],
            decisions: ['Further discussion needed on key topics.'],
            openQuestions: questions.slice(0, 5).length > 0 ? questions.slice(0, 5) : ['No specific questions captured.'],
            actionItems: [{ task: 'Review meeting minutes and identify next steps', owner: 'Tremaine' }],
        });

    } catch (error: any) {
        console.error('Generate minutes API error:', error);
        return res.status(500).json({ error: error.message || 'Failed to generate minutes' });
    }
}
