import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

/// POST /api/admin/refine-sfx-prompt
///
/// Takes the original ElevenLabs SFX prompt for a Pulse Ritual sound
/// plus the user's plain-English feedback on the generated audio, and
/// returns a rewritten prompt that incorporates the feedback while
/// preserving the original sound's purpose and emotional tone.
///
/// The admin page calls this between Generate cycles so the user can
/// iterate on a sound by saying "too sharp," "needs more decay," or
/// "lower the pitch" instead of hand-editing the prompt.

type RefineRequest = {
  originalPrompt: string;
  feedback: string;
  label?: string;
  description?: string;
  durationSeconds?: number;
};

type RefineResponse =
  | { refinedPrompt: string }
  | { error: string; detail?: string };

const SYSTEM_PROMPT = `You are a sound designer working on Pulse Ritual, a calm iOS habit app. The product voice for every sound effect is: soft, intentional, peaceful, calming. No mechanical clicks. No game-y dings. Singing bowls, water, breath, warm felt taps.

You will be given:
  - The original ElevenLabs SFX prompt for one sound effect
  - The sound's purpose / call site
  - Plain-English feedback from the designer who just heard the generated audio

Rewrite the prompt to incorporate the feedback while preserving the sound's original intent and the calming brand tone. Return ONE paragraph of natural-language prompt text — no quotes, no bullet points, no preamble, no explanation. Stay specific about timbre, attack, decay, frequency range, and reverb. End the prompt with "no music, no speech" if it wasn't already there.`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RefineResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPEN_AI_SECRET_KEY is not configured' });
  }

  try {
    const {
      originalPrompt,
      feedback,
      label,
      description,
      durationSeconds,
    } = (req.body ?? {}) as RefineRequest;

    if (!originalPrompt || typeof originalPrompt !== 'string' || !originalPrompt.trim()) {
      return res.status(400).json({ error: 'Missing originalPrompt' });
    }
    if (!feedback || typeof feedback !== 'string' || !feedback.trim()) {
      return res.status(400).json({ error: 'Missing feedback' });
    }

    const userPrompt = [
      label ? `SOUND: ${label}` : null,
      description ? `PURPOSE: ${description}` : null,
      durationSeconds ? `TARGET DURATION: ${durationSeconds}s` : null,
      `ORIGINAL PROMPT:\n${originalPrompt.trim()}`,
      `DESIGNER FEEDBACK:\n${feedback.trim()}`,
      `Return ONLY the refined prompt as one paragraph of natural-language text.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.55,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const refined = completion.choices[0]?.message?.content?.trim();
    if (!refined) {
      return res.status(502).json({ error: 'Model returned an empty refinement' });
    }

    return res.status(200).json({ refinedPrompt: refined });
  } catch (error: any) {
    console.error('[refine-sfx-prompt] error', error);
    return res.status(500).json({
      error: 'Server error',
      detail: error?.message || String(error),
    });
  }
}
