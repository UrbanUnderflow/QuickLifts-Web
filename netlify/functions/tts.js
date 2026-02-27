// TTS Function: Converts text to natural-sounding speech
// Primary: ElevenLabs (highest quality, human-like voices)
// Fallback: OpenAI TTS (if ElevenLabs key not configured)

const { headers } = require('./config/firebase');

// ElevenLabs voice IDs — these are built-in voices
const ELEVEN_VOICES = {
    rachel: '21m00Tcm4TlvDq8ikWAM',   // Warm, calm female — great for coaching
    bella: 'EXAVITQu4vr4xnSDxMaL',     // Soft, nurturing female
    elli: 'MF3mGyEYCl7XYWbV9V6O',      // Young, friendly female
    charlotte: 'XB0fDUnXU5powFXDhCwa',  // Mature, confident female
    nicole: 'piTKgcLEGmPE4e6mEKli',     // Whisper-soft female
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const { text, voice = 'rachel', speed = 1.0 } = JSON.parse(event.body || '{}');

        if (!text || !text.trim()) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing text parameter' }),
            };
        }

        // Try ElevenLabs first (highest quality)
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

                return {
                    statusCode: 200,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        audio: base64Audio,
                        format: 'mp3',
                        provider: 'elevenlabs',
                    }),
                };
            }

            console.warn('[tts] ElevenLabs error:', response.status, await response.text());
            // Fall through to OpenAI
        }

        // Fallback: OpenAI TTS
        const openAiKey = process.env.OPEN_AI_SECRET_KEY;
        if (!openAiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'No TTS API key configured. Set ELEVEN_LABS_API_KEY or OPEN_AI_SECRET_KEY.' }),
            };
        }

        // Map voice name to OpenAI voice
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
                speed: speed,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[tts] OpenAI TTS error:', response.status, errorText);
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({
                    error: 'TTS generation failed',
                    detail: errorText.substring(0, 200),
                }),
            };
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audio: base64Audio,
                format: 'mp3',
                provider: 'openai',
            }),
        };
    } catch (error) {
        console.error('[tts] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server error', detail: error.message }),
        };
    }
};
