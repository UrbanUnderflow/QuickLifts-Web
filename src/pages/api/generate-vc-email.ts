import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

interface VCProspect {
  id: string;
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
  status: string;
}

interface GenerateEmailRequest {
  template: string;
  prospect: VCProspect;
  researchInsights?: any; // Research data from the research API
}

interface GenerateEmailResponse {
  email: string;
  subject: string;
  success: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateEmailResponse | { error: string; success: boolean }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', success: false });
  }

  try {
    const { template, prospect, researchInsights } = req.body as GenerateEmailRequest;

    // Validate input
    if (!template?.trim()) {
      return res.status(400).json({ error: 'Email template is required', success: false });
    }

    if (!prospect || !prospect.person || !prospect.companies) {
      return res.status(400).json({ error: 'Valid prospect data is required', success: false });
    }

    // Get OpenAI API key
    const apiKey = process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found in environment variables');
      return res.status(500).json({ error: 'OpenAI API key not configured', success: false });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Create the personalization prompt with research insights
    const prompt = `You are an expert email writer specializing in VC outreach. Your task is to analyze the provided email template and create a highly personalized email using deep research insights about the VC prospect.

TEMPLATE TO ANALYZE:
${template}

PROSPECT INFORMATION:
- Name: ${prospect.person}
- VC Firm(s): ${prospect.companies}
- Email: ${prospect.email}
- Investment Stage: ${prospect.stage || 'Not specified'}
- Location: ${prospect.location || prospect.country || 'Not specified'}
- Description: ${prospect.description || 'Not specified'}
- LinkedIn: ${prospect.linkedin || 'Not specified'}
- Website(s): ${prospect.urls || 'Not specified'}
- Founded Companies: ${prospect.founder || 'Not specified'}
- Number of Exits: ${prospect.numberOfExits || 'Not specified'}

RESEARCH INSIGHTS ABOUT THE VC FIRM:
${researchInsights ? JSON.stringify(researchInsights, null, 2) : 'No additional research insights available'}

ADVANCED PERSONALIZATION INSTRUCTIONS:
1. **Use specific portfolio companies** - Reference actual portfolio companies that align with Pulse instead of generic descriptions
2. **Cite investment thesis alignment** - Use their specific investment thesis/values, not generic VC language
3. **Mention relevant partners** - Reference specific partners who might be interested based on their backgrounds
4. **Reference recent investments** - Mention recent relevant investments to show current market awareness
5. **Use their language/values** - Incorporate their firm's specific language, mission, or values
6. **Create meaningful connections** - Draw specific parallels between Pulse and their portfolio/thesis

EXAMPLE OF GOOD PERSONALIZATION (INSTEAD OF GENERIC):
❌ Generic: "Given your firm's investment in early-stage tech startups..."
✅ Specific: "Given your investment in ClassPass and thesis around empowering fitness communities..."

❌ Generic: "Your focus on diverse founders..."
✅ Specific: "Your partner Sarah's background as a former Nike executive and focus on athlete-founded companies..."

REQUIREMENTS:
- Use SPECIFIC company names, partner names, and thesis points from research insights
- Replace generic template placeholders with researched facts
- Maintain the template's tone and structure
- Make every personalization fact-based and relevant
- Ensure the research insights naturally enhance the template rather than replace it
- If research insights are limited, focus on what's available and supplement with prospect data

Return your response as JSON in this exact format:
{
  "subject": "Compelling subject line referencing specific research insight for ${prospect.person}",
  "email": "The complete personalized email in HTML format with proper line breaks and formatting, incorporating specific research insights naturally"
}

The email should demonstrate deep knowledge of ${prospect.companies} and create genuine connection points with Pulse based on researched facts.`;

    console.log('🤖 Generating personalized email for:', prospect.person, 'at', prospect.companies);
    if (researchInsights) {
      console.log('📊 Using research insights for enhanced personalization');
    }

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use the text model for better reasoning
      messages: [
        {
          role: 'system',
          content: 'You are an expert email writer specializing in VC outreach. You analyze email templates and create highly personalized, professional emails that maintain the original tone and style while seamlessly integrating prospect-specific information.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7, // Balanced creativity and consistency
    });

    const generatedContent = response.choices[0]?.message?.content?.trim();
    if (!generatedContent) {
      throw new Error('OpenAI did not return valid content');
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
      throw new Error('AI returned invalid JSON format');
    }

    // Validate response structure
    if (!parsedData.email || !parsedData.subject) {
      throw new Error('Response missing required fields (email, subject)');
    }

    console.log(`📧 Successfully generated email for ${prospect.person} at ${prospect.companies}`);

    return res.status(200).json({
      email: parsedData.email,
      subject: parsedData.subject,
      success: true
    });

  } catch (error) {
    console.error('Error generating VC email:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false
    });
  }
} 