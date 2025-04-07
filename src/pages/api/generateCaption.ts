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
      Create a single, technical form cue or tip for this exercise. Focus only on proper execution or a key technique point.

      Exercise Name: ${exerciseName}
      Category: ${category}
      Tags: ${tags.join(', ')}

      Caption Requirements:
      - One clear, specific form cue or technical tip
      - No motivational phrases or exclamations
      - No generic encouragement or "let's" statements
      - Focus purely on technique or execution
      - Maximum 15 words
      - Do not use exclamation marks
      - Do not add phrases like "let's go", "let's unlock", etc.

      Example good captions:
      - "Keep your core engaged and back straight throughout the movement"
      - "Drive through your heels while maintaining neutral spine position"
      - "Maintain tension in your lats as you lower the weight"
    `;

    // Call OpenAI API using the SDK
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a technical fitness instructor who provides clear, concise form cues. You focus solely on proper exercise execution without adding motivational phrases.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 50
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