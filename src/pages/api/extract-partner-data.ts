import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

interface ExtractPartnerDataRequest {
  inputType: 'image' | 'text';
  data?: string; // Text content for spreadsheet data
  imageUrls?: string[]; // Firebase Storage URLs for images
}

interface PartnerProspect {
  companyName: string;
  contactPerson: string;
  contactNames: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  industry: string;
  companySize: string;
  location: string;
  country: string;
  partnershipType: string;
  partnershipTier: string;
  fitScore: string;
  missionFit: string;
  audienceOverlap: string;
  activationPotential: string;
  brandReputation: string;
  scalability: string;
  resourcesBeyondMoney: string;
  weightedPriorityScore: string;
  notes: string;
  notesJustification: string;
  status: string;
  contactStatus: string;
  lastContactDate: string;
  nextFollowUpDate: string;
  leadSource: string;
  priority: string;
  potentialValue: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { inputType, data, imageUrls } = req.body as ExtractPartnerDataRequest;

    // Validate input
    if (!inputType || (inputType !== 'image' && inputType !== 'text')) {
      return res.status(400).json({ error: 'Invalid inputType. Must be "image" or "text"' });
    }

    if (inputType === 'text' && !data?.trim()) {
      return res.status(400).json({ error: 'Text data is required for text extraction' });
    }

    if (inputType === 'image' && (!imageUrls || imageUrls.length === 0)) {
      return res.status(400).json({ error: 'Image URLs are required for image extraction' });
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
      const prompt = `You are a precise data extraction specialist. Extract corporate partner prospect information from the provided image(s).

CRITICAL RULES:
- Extract ONLY data that is clearly visible in the image
- Do NOT generate, infer, or hallucinate any information
- If you cannot clearly see the data, return an empty array []
- Focus on structured data like spreadsheets, tables, or lists

REQUIRED FORMAT - Return a JSON array with these exact fields:
[
  {
    "companyName": "Company Name from image",
    "contactPerson": "Primary Contact Person Name from image",
    "contactNames": "All contact names from image (comma separated)",
    "email": "Email address from image",
    "phone": "Phone number from image",
    "website": "Website URL from image",
    "linkedin": "LinkedIn URL from image",
    "industry": "Industry/sector from image",
    "companySize": "Company size from image (e.g., 'Small (11-50)', 'Large (201-1000)')",
    "location": "City, State or location from image",
    "country": "Country from image",
    "partnershipType": "Type of partnership from image (e.g., 'Sponsorship', 'Technology Integration')",
    "partnershipTier": "Partnership tier from image (e.g., 'Tier 1 - Strategic', 'Tier 2 - Premium')",
    "fitScore": "Overall fit score from image (1-5, for backward compatibility)",
    "missionFit": "Mission fit rating from image (1-5)",
    "audienceOverlap": "Audience overlap rating from image (1-5)",
    "activationPotential": "Activation potential rating from image (1-5)",
    "brandReputation": "Brand reputation rating from image (1-5)",
    "scalability": "Scalability rating from image (1-5)",
    "resourcesBeyondMoney": "Resources beyond money rating from image (1-5)",
    "weightedPriorityScore": "Weighted priority score from image (numeric value like 3.75)",
    "notes": "General notes from image",
    "notesJustification": "Notes/justification from image (specific reasoning for ratings)",
    "status": "Partnership status from image (default to 'new' if not specified)",
    "contactStatus": "Contact status from image (default to 'not-contacted' if not specified)",
    "lastContactDate": "Last contact date from image (YYYY-MM-DD format)",
    "nextFollowUpDate": "Next follow-up date from image (YYYY-MM-DD format)",
    "leadSource": "Lead source from image",
    "priority": "Priority from image (high/medium/low, default to 'medium')",
    "potentialValue": "Potential value from image (e.g., '$50,000')"
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
          content: "You are a precise data extraction specialist focused on extracting corporate partner prospect data from images."
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
      const prompt = `You are a data extraction specialist. Extract and format corporate partner prospect data from the provided text.

INPUT DATA:
${data}

TASK: Parse the above text and extract corporate partner prospect information. The text likely contains:
- Spreadsheet data (comma/tab separated)
- List of companies and contacts
- Partnership information

REQUIRED FORMAT - Return a JSON array with these exact fields:
[
  {
    "companyName": "Company Name",
    "contactPerson": "Primary Contact Person Name",
    "contactNames": "All contact names (comma separated)",
    "email": "Email address",
    "phone": "Phone number",
    "website": "Website URL",
    "linkedin": "LinkedIn URL",
    "industry": "Industry/sector",
    "companySize": "Company size (e.g., 'Small (11-50)', 'Large (201-1000)')",
    "location": "City, State or location",
    "country": "Country",
    "partnershipType": "Type of partnership (e.g., 'Sponsorship', 'Technology Integration')",
    "partnershipTier": "Partnership tier (e.g., 'Tier 1 - Strategic', 'Tier 2 - Premium')",
    "fitScore": "Overall fit score (1-5, for backward compatibility)",
    "missionFit": "Mission fit rating (1-5)",
    "audienceOverlap": "Audience overlap rating (1-5)",
    "activationPotential": "Activation potential rating (1-5)",
    "brandReputation": "Brand reputation rating (1-5)",
    "scalability": "Scalability rating (1-5)",
    "resourcesBeyondMoney": "Resources beyond money rating (1-5)",
    "weightedPriorityScore": "Weighted priority score (numeric value like 3.75)",
    "notes": "General notes or description",
    "notesJustification": "Notes/justification (specific reasoning for ratings)",
    "status": "Partnership status (default to 'new' if not specified)",
    "contactStatus": "Contact status (default to 'not-contacted' if not specified)",
    "lastContactDate": "Last contact date (YYYY-MM-DD format)",
    "nextFollowUpDate": "Next follow-up date (YYYY-MM-DD format)",
    "leadSource": "Lead source",
    "priority": "Priority (high/medium/low, default to 'medium')",
    "potentialValue": "Potential value (e.g., '$50,000')"
  }
]

RULES:
- Extract data exactly as provided in the text
- For missing fields, use empty string ""
- Parse structured data intelligently (CSV, tabs, etc.)
- Combine related information logically
- If no valid data found, return empty array []
- Use standard formats for dates (YYYY-MM-DD)
- Normalize company sizes to standard options: 'Startup (1-10)', 'Small (11-50)', 'Medium (51-200)', 'Large (201-1000)', 'Enterprise (1000+)'
- Normalize industries to common categories: 'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Education', 'Sports & Fitness', 'Media & Entertainment', 'Government', 'Non-Profit', 'Other'

Return ONLY valid JSON, no markdown or explanations.`;

      messages = [
        {
          role: "system",
          content: "You are a data extraction specialist focused on extracting corporate partner prospect data from text."
        },
        {
          role: "user",
          content: prompt
        }
      ];
    }

    console.log(`🤖 Processing ${inputType} extraction with OpenAI...`);

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: inputType === 'image' ? 'gpt-4o' : 'gpt-4o-mini', // Use gpt-4o for images, gpt-4o-mini for text
      messages: messages,
      max_tokens: inputType === 'image' ? 4000 : 2000,
      temperature: 0.1, // Low temperature for precise extraction
    });

    const generatedContent = response.choices[0]?.message?.content?.trim();
    if (!generatedContent) {
      throw new Error('OpenAI did not return valid content.');
    }

    console.log('🤖 Raw OpenAI Response:', generatedContent);

    // Clean and parse response
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

    console.log(`📊 Successfully extracted ${parsedData.length} partner prospects`);

    return res.status(200).json({ 
      success: true,
      prospects: parsedData 
    });

  } catch (error) {
    console.error('Error extracting partner data:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false 
    });
  }
}
