import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

interface ExtractVCDataRequest {
  inputType: 'image' | 'text' | 'prompt';
  data?: string; // Text content for spreadsheet data
  imageUrls?: string[]; // Firebase Storage URLs for images
  prompt?: string; // AI research prompt
  singleProspectResearch?: boolean; // Flag for stage research
}

interface VCProspect {
  person: string;
  companies: string;
  urls: string;
  linkedin: string;
  continent: string;
  country: string;
  location: string; // NEW: More flexible location field
  addresses: string;
  email: string;
  description: string;
  stage: string;
  founder: string;
  numberOfExits: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { inputType, data, imageUrls, prompt, singleProspectResearch } = req.body as ExtractVCDataRequest;

    // Validate input
    if (!inputType || (inputType !== 'image' && inputType !== 'text' && inputType !== 'prompt')) {
      return res.status(400).json({ error: 'Invalid inputType. Must be "image", "text", or "prompt"' });
    }

    if (inputType === 'text' && !data?.trim()) {
      return res.status(400).json({ error: 'Text data is required for text extraction' });
    }

    if (inputType === 'image' && (!imageUrls || imageUrls.length === 0)) {
      return res.status(400).json({ error: 'Image URLs are required for image extraction' });
    }

    if (inputType === 'prompt' && !prompt?.trim()) {
      return res.status(400).json({ error: 'Research prompt is required for AI research' });
    }

    // Get OpenAI API key
    const apiKey = process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found in environment variables');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    let messages: any[] = [];

    if (inputType === 'image') {
      // IMAGE EXTRACTION PROMPT
      const prompt = `You are a precise data extraction specialist. Extract VC prospect information from the provided image(s).

CRITICAL RULES:
- Extract ONLY data that is clearly visible in the image
- Do NOT generate, infer, or hallucinate any information
- If you cannot clearly see the data, return an empty array []
- Focus on structured data like spreadsheets, tables, or lists

REQUIRED FORMAT - Return a JSON array with these exact fields:
[
  {
    "person": "Contact Name from image",
    "companies": "VC Firm Names from image", 
    "urls": "website URLs from image",
    "linkedin": "LinkedIn URLs from image",
    "continent": "Continent from image or inferred from country",
    "country": "Country from image",
    "location": "Any location info (city, state, region, etc.) from image",
    "addresses": "Office addresses from image",
    "email": "Email addresses from image",
    "description": "Investment focus/notes from image",
    "stage": "Investment stage from image",
    "founder": "Founder name from image", 
    "numberOfExits": "Number of exits from image"
  }
]

VALIDATION: If you cannot access or clearly read the image content, return: {"error": "Cannot access or read the provided image"}

Return ONLY valid JSON, no markdown or explanations.`;

      const imageContent = imageUrls!.map(url => ({
        type: "image_url" as const,
        image_url: {
          url: url,
          detail: "high" as const
        }
      }));

      messages = [
        {
          role: "system",
          content: "You are a precise data extraction specialist focused on extracting VC prospect data from images."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageContent
          ]
        }
      ];

    } else if (inputType === 'text') {
      // TEXT EXTRACTION PROMPT
      const prompt = `You are a data extraction specialist. Extract and format VC prospect data from the provided text.

INPUT DATA:
${data}

TASK: Parse the above text and extract VC prospect information. The text likely contains:
- Spreadsheet data (comma/tab separated)
- List of VC firms and contacts
- Investment information

REQUIRED FORMAT - Return a JSON array with these exact fields:
[
  {
    "person": "Contact Name",
    "companies": "VC Firm Names", 
    "urls": "website URLs",
    "linkedin": "LinkedIn URLs",
    "continent": "Continent (infer from country if not specified)",
    "country": "Country",
    "location": "Any location info (city, state, region, etc.)",
    "addresses": "Office addresses",
    "email": "Email addresses",
    "description": "Investment focus/notes",
    "stage": "Investment stage",
    "founder": "Founder name", 
    "numberOfExits": "Number of exits"
  }
]

RULES:
- Extract data exactly as provided in the text
- For missing fields, use empty string ""
- Parse structured data intelligently (CSV, tabs, etc.)
- Combine related information logically
- If no valid data found, return empty array []

Return ONLY valid JSON, no markdown or explanations.`;

      messages = [
        {
          role: "system",
          content: "You are a data extraction specialist focused on parsing text data into structured VC prospect information."
        },
        {
          role: "user",
          content: prompt
        }
      ];
    } else if (inputType === 'prompt') {
      if (singleProspectResearch) {
        // STAGE RESEARCH - SPECIALIZED PROMPT
        const stageResearchPrompt = `You are a VC industry specialist. Based on the research request, determine the investment stage focus for the specified VC firm.

USER REQUEST:
${prompt}

TASK: Determine the investment stage focus of the VC firm mentioned in the request. Research their typical investment patterns and stage preferences.

AVAILABLE STAGES: Pre-Seed, Seed, Series A, Series B, Series C, Series D+, Growth, Late Stage, Multi-Stage

RESPONSE FORMAT: Return ONLY the stage names that apply to this firm, comma-separated.

Examples of good responses:
- "Seed, Series A"
- "Multi-Stage"
- "Pre-Seed, Seed"
- "Growth, Late Stage"

If you cannot determine the stage focus, return: "Unknown"

Return ONLY the stage names, no explanations or JSON.`;

        messages = [
          {
            role: "system",
            content: "You are a VC industry specialist focused on determining investment stage preferences of venture capital firms."
          },
          {
            role: "user",
            content: stageResearchPrompt
          }
        ];
      } else {
        // REGULAR AI RESEARCH PROMPT
        const researchPrompt = `You are an AI research specialist with access to general knowledge about venture capital firms and investors. Based on the user's research request, provide structured VC prospect information.

USER REQUEST:
${prompt}

TASK: Research and compile comprehensive VC prospect data based on the request. Use your knowledge of:
- Well-known VC firms and their partners
- Investment focus areas and stage preferences
- General contact patterns and firm structures
- Public information about VC professionals

REQUIRED FORMAT - Return a JSON array with these exact fields:
[
  {
    "person": "Contact Name/Partner Name",
    "companies": "VC Firm Name", 
    "urls": "Firm website URLs",
    "linkedin": "LinkedIn profile URLs (when known)",
    "continent": "Continent where firm is based",
    "country": "Country where firm is based",
    "location": "City, state, or region",
    "addresses": "Office addresses (when known)",
    "email": "General contact emails (use firm domain patterns)",
    "description": "Investment focus, stage, sectors",
    "stage": "Investment stage focus (Seed, Series A, etc.)",
    "founder": "Founding partners (when relevant)", 
    "numberOfExits": "Notable exits or portfolio size info"
  }
]

IMPORTANT GUIDELINES:
- Provide realistic, research-based information
- Use general knowledge about well-known VCs
- For emails, use common firm patterns (info@firm.com, partners@firm.com)
- Include multiple relevant prospects when appropriate
- If research request is unclear, return empty array []

Return ONLY valid JSON, no markdown or explanations.`;

        messages = [
          {
            role: "system",
            content: "You are an AI research specialist with knowledge of the venture capital industry, firms, and professionals."
          },
          {
            role: "user",
            content: researchPrompt
          }
        ];
      }
    }

    console.log(`🤖 Processing ${inputType} extraction with OpenAI...`);

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: inputType === 'image' ? 'gpt-4o' : 'gpt-4o-mini', // Use gpt-4o for images, gpt-4o-mini for text and prompts
      messages: messages,
      max_tokens: inputType === 'image' ? 4000 : 2000,
      temperature: inputType === 'prompt' ? 0.3 : 0.1, // Slightly higher temperature for research prompts
    });

    const generatedContent = response.choices[0]?.message?.content?.trim();
    if (!generatedContent) {
      throw new Error('OpenAI did not return valid content.');
    }

    console.log('🤖 Raw OpenAI Response:', generatedContent);

    // Handle stage research response differently
    if (singleProspectResearch) {
      // For stage research, return the raw response as stage information
      const stageResult = generatedContent.trim();
      console.log(`🎯 Stage Research Result: "${stageResult}"`);
      
      return res.status(200).json({ 
        success: true,
        stageResearch: stageResult,
        prospects: [] // Empty array for compatibility
      });
    }

    // Clean and parse response for regular data extraction
    let cleanedResponse = generatedContent
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    console.log('🧹 Cleaned Response:', cleanedResponse);

    // Parse JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.log('Raw response content:', generatedContent);
      throw new Error('AI returned invalid JSON format.');
    }

    // Check if AI returned an error
    if (parsedData && parsedData.error) {
      return res.status(400).json({ error: parsedData.error });
    }

    // Validate response structure
    if (!Array.isArray(parsedData)) {
      throw new Error('Response is not an array');
    }

    console.log(`📊 Successfully extracted ${parsedData.length} prospects`);

    return res.status(200).json({ 
      prospects: parsedData,
      success: true,
      count: parsedData.length 
    });

  } catch (error) {
    console.error('Error extracting VC data:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false 
    });
  }
} 