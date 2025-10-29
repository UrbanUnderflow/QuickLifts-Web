import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  try {
    const { prompt, currentBody, context } = req.body || {};
    if (!prompt || !currentBody) {
      return res.status(400).json({ error: 'prompt and currentBody are required' });
    }

    const system = `You are a helpful writing assistant for short, friendly creator DMs. Revise the message to be clear, warm, and natural.
- Keep under ~150-180 words.
- Maintain the original intent and key details unless the prompt says otherwise.
- Improve flow, grammar, and concision.
- Do not add claims that weren't present.`;

    const userContent = `Current Message:\n\n${currentBody}\n\nRevision Prompt:\n${prompt}\n\nContext (optional):\n${JSON.stringify(context || {}, null, 2)}\n\nTask: Produce a revised single message body ready to paste as a DM.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent }
        ],
        temperature: 0.7,
        max_tokens: 400
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `OpenAI request failed: ${err}` });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return res.status(500).json({ error: 'No content returned from model' });
    }

    return res.status(200).json({ revisedBody: text });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}

