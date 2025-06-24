import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

interface VCProspect {
  person: string;
  companies: string;
  urls: string;
  linkedin: string;
  continent: string;
  country: string;
  location: string;
  addresses: string;
  email: string;
  description: string;
  stage: string;
  founder: string;
  numberOfExits: string;
}

interface ResearchVCO3Request {
  prompt: string;
  validateUrls?: boolean; // Whether to validate website URLs
  maxProspects?: number; // Limit number of prospects returned
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, validateUrls = true, maxProspects = 5 } = req.body as ResearchVCO3Request;

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Research prompt is required' });
    }

    // Get OpenAI API key
    const apiKey = process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found in environment variables');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Create a comprehensive research prompt for o3
    const researchPrompt = `You are an expert VC research specialist with access to verify information through web research. Your task is to research venture capital prospects based on the user's request and provide ACCURATE, VERIFIED information.

USER RESEARCH REQUEST:
${prompt}

CRITICAL REQUIREMENTS FOR ACCURACY:
1. **Verify all URLs and websites** - Only include URLs that you can confirm are valid and active
2. **Validate email addresses** - Use standard firm email patterns (info@firm.com, contact@firm.com) or confirmed public emails
3. **Fact-check company information** - Ensure all firm names, partner names, and details are accurate
4. **Cross-reference investment data** - Verify investment stages, portfolio companies, and fund information
5. **Confirm location details** - Ensure addresses and location information are accurate

RESEARCH METHODOLOGY:
- Start by researching the specific VC firms mentioned or find relevant firms based on the request
- Verify firm websites and check they are active and legitimate
- Look up partner information and confirm their roles and backgrounds
- Check recent portfolio companies and investment activity
- Validate contact information through official sources
- Cross-reference information across multiple sources for accuracy

REQUIRED OUTPUT FORMAT - Return a JSON array with these exact fields (maximum ${maxProspects} prospects):
[
  {
    "person": "Verified partner/contact name",
    "companies": "Confirmed VC firm name", 
    "urls": "Validated website URLs (must be working/active)",
    "linkedin": "Verified LinkedIn profile URLs",
    "continent": "Confirmed continent",
    "country": "Confirmed country",
    "location": "Verified city/state/region",
    "addresses": "Confirmed office addresses",
    "email": "Validated email addresses (use firm patterns if specific emails not available)",
    "description": "Verified investment focus and portfolio details",
    "stage": "Confirmed investment stage focus",
    "founder": "Verified founding partners", 
    "numberOfExits": "Confirmed number of exits or portfolio information",
    "confidence": "HIGH/MEDIUM/LOW - your confidence in the data accuracy",
    "verificationNotes": "Brief notes on what was verified vs estimated"
  }
]

DATA ACCURACY GUIDELINES:
- **HIGH confidence**: All major details verified through official sources
- **MEDIUM confidence**: Most details verified, some estimated based on patterns
- **LOW confidence**: Limited verification possible, includes reasonable estimates

EMAIL PATTERNS TO USE (when specific emails unavailable):
- info@[firmname].com
- contact@[firmname].com  
- team@[firmname].com
- partners@[firmname].com

IMPORTANT VALIDATION RULES:
${validateUrls ? '- Test and verify all URLs before including them' : '- Include best-known URLs even if not verified'}
- Only include information you can reasonably confirm or that follows standard VC patterns
- Mark any estimated or unverified information clearly
- If research yields no reliable results, return an empty array rather than hallucinated data
- Prioritize quality over quantity - better to return 2 accurate prospects than 5 questionable ones

FAIL-SAFE: If you cannot find reliable information matching the request, return:
{"error": "Unable to find verified information matching the research criteria", "suggestions": "Consider researching more specific firm names or regions"}

Return ONLY valid JSON, no markdown or explanations.`;

    console.log(`🧠 Using o3 model for VC research: ${prompt.substring(0, 100)}...`);

    // Call OpenAI API with o3 model
    const response = await openai.chat.completions.create({
      model: 'o3-mini', // Use o3-mini for faster processing with good reasoning
      messages: [
        {
          role: "system",
          content: "You are an expert VC research specialist with strong fact-checking and verification capabilities. You prioritize accuracy over speed and will verify information through multiple sources before reporting it. You understand the importance of accurate contact information in professional outreach."
        },
        {
          role: "user",
          content: researchPrompt
        }
      ],
      max_tokens: 4000, // Allow more tokens for comprehensive research
      temperature: 0.1, // Very low temperature for factual accuracy
    });

    const generatedContent = response.choices[0]?.message?.content?.trim();
    if (!generatedContent) {
      throw new Error('o3 model did not return valid content.');
    }

    console.log('🧠 Raw o3 Research Response:', generatedContent.substring(0, 500) + '...');

    // Clean and parse response
    let cleanedResponse = generatedContent
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Parse JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse o3 response:', parseError);
      console.log('Raw response content:', generatedContent);
      throw new Error('o3 model returned invalid JSON format.');
    }

    // Check if o3 returned an error or no results
    if (parsedData && parsedData.error) {
      return res.status(400).json({ 
        error: parsedData.error,
        suggestions: parsedData.suggestions || 'Try refining your search criteria',
        success: false 
      });
    }

    // Validate response structure
    if (!Array.isArray(parsedData)) {
      throw new Error('Response is not an array');
    }

    // Filter for high confidence results if requested
    const highConfidenceResults = parsedData.filter(prospect => 
      prospect.confidence === 'HIGH' || prospect.confidence === 'MEDIUM'
    );

    console.log(`📊 o3 Research Results: ${parsedData.length} total, ${highConfidenceResults.length} high/medium confidence`);

    // Log confidence breakdown for debugging
    const confidenceBreakdown = parsedData.reduce((acc, prospect) => {
      const conf = prospect.confidence || 'UNKNOWN';
      acc[conf] = (acc[conf] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('🎯 Confidence breakdown:', confidenceBreakdown);

    return res.status(200).json({ 
      prospects: parsedData,
      highConfidenceResults: highConfidenceResults,
      confidenceBreakdown: confidenceBreakdown,
      totalResults: parsedData.length,
      success: true,
      model: 'o3-mini',
      validationEnabled: validateUrls
    });

  } catch (error) {
    console.error('Error in o3 VC research:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false,
      model: 'o3-mini'
    });
  }
} 