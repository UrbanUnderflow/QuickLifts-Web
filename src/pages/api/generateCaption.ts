import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Define the structure of the request body
interface GenerateCaptionRequest {
  exerciseName: string;
  category: string;
  tags: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Extract data from request body
    const { exerciseName, category, tags } = req.body as GenerateCaptionRequest;

    // Validate input
    if (!exerciseName) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    // Get the OpenAI API key from environment variables
    const apiKey = process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found in environment variables');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Construct the prompt using the provided template
    const prompt = `
      Given the following information, create a concise, engaging exercise caption that provides the user with a practical tip or important form cue. Keep the tone motivating and actionable.

      Exercise Name: ${exerciseName}
      Category: ${category}
      Tags: ${tags.join(', ')}

      Caption Guidelines:
      - Must include a clear and specific form cue or actionable tip directly relevant to ${exerciseName}.
      - Keep captions concise (1 short sentence preferred).
      - Maintain an enthusiastic and motivating tone, suitable for fitness content.
    `;

    // Call OpenAI API using the SDK
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using the same model as in generateRound
      messages: [
        {
          role: 'system',
          content: 'You are a fitness expert that creates concise, helpful captions for exercise videos. Your captions should provide actionable tips and form cues in an enthusiastic tone.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    // Extract the generated caption from the response
    const generatedCaption = response.choices[0].message.content?.trim() || '';

    // Remove any quotes that might be around the caption
    const cleanedCaption = generatedCaption.replace(/^["'](.*)["']$/g, '$1');

    return res.status(200).json({ caption: cleanedCaption });
  } catch (error) {
    console.error('Error generating caption:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
} 