import type { NextApiRequest, NextApiResponse } from 'next';

type GenerateSfxResponse =
  | { audio: string; format: 'mp3'; provider: 'elevenlabs'; contentType: string }
  | { error: string; detail?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateSfxResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ELEVEN_LABS_API_KEY is not configured' });
  }

  try {
    const {
      prompt,
      durationSeconds = 4,
      promptInfluence = 0.35,
      loop = false,
    } = req.body ?? {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const response = await fetch(
      'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: prompt.trim(),
          duration_seconds: Math.max(1, Math.min(8, Number(durationSeconds) || 4)),
          prompt_influence: Math.max(0, Math.min(1, Number(promptInfluence) || 0.35)),
          loop: Boolean(loop),
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({
        error: 'ElevenLabs sound effect generation failed',
        detail: detail.slice(0, 400),
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const audio = Buffer.from(arrayBuffer).toString('base64');

    return res.status(200).json({
      audio,
      format: 'mp3',
      provider: 'elevenlabs',
      contentType: 'audio/mpeg',
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Server error',
      detail: error?.message || String(error),
    });
  }
}
