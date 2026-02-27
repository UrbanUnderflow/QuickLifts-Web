// Next.js API route that proxies to the Netlify TTS function
// This allows TTS to work on localhost:3000 (Next.js dev) in addition to Netlify dev
import type { NextApiRequest, NextApiResponse } from 'next';

// ElevenLabs voice IDs
const ELEVEN_VOICES: Record<string, string> = {
    rachel: '21m00Tcm4TlvDq8ikWAM',
    bella: 'EXAVITQu4vr4xnSDxMaL',
    elli: 'MF3mGyEYCl7XYWbV9V6O',
    charlotte: 'XB0fDUnXU5powFXDhCwa',
    nicole: 'piTKgcLEGmPE4e6mEKli',
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text, voice = 'rachel', speed = 1.0 } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Missing text parameter' });
        }

        // Try ElevenLabs first
        const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY;
        if (elevenLabsKey) {
            const voiceId = ELEVEN_VOICES[voice] || ELEVEN_VOICES.rachel;

            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=2`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'xi-api-key': elevenLabsKey,
                    },
                    body: JSON.stringify({
                        text,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                            style: 0.3,
                            use_speaker_boost: true,
                        },
                    }),
                }
            );

            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const base64Audio = Buffer.from(arrayBuffer).toString('base64');
                return res.status(200).json({
                    audio: base64Audio,
                    format: 'mp3',
                    provider: 'elevenlabs',
                });
            }

            console.warn('[tts] ElevenLabs error:', response.status);
        }

        // Fallback: OpenAI TTS
        const openAiKey = process.env.OPEN_AI_SECRET_KEY;
        if (!openAiKey) {
            return res.status(500).json({
                error: 'No TTS API key configured. Set ELEVEN_LABS_API_KEY or OPEN_AI_SECRET_KEY in .env.local',
            });
        }

        const openAiVoice = voice === 'rachel' || voice === 'bella' ? 'nova' : 'shimmer';

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openAiKey}`,
            },
            body: JSON.stringify({
                model: 'tts-1-hd',
                input: text,
                voice: openAiVoice,
                response_format: 'mp3',
                speed,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[tts] OpenAI TTS error:', response.status, errorText);
            return res.status(502).json({
                error: 'TTS generation failed',
                detail: errorText.substring(0, 200),
            });
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');

        return res.status(200).json({
            audio: base64Audio,
            format: 'mp3',
            provider: 'openai',
        });
    } catch (error: any) {
        console.error('[tts] Error:', error);
        return res.status(500).json({ error: 'Server error', detail: error.message });
    }
}
