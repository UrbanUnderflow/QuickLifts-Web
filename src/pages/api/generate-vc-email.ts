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
    const { template, prospect } = req.body as GenerateEmailRequest;

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

    // Create the personalization prompt
    const prompt = `You are an expert email writer specializing in VC outreach. Your task is to analyze the provided email template and create a personalized email for a specific VC prospect.

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

INSTRUCTIONS:
1. **Analyze the template's tone, style, and structure** - Match the original writer's voice exactly
2. **Personalize with prospect data** - Seamlessly integrate relevant prospect information
3. **Maintain the email flow** - Keep the same structure and progression of ideas
4. **Generate a compelling subject line** - Create a subject that would appeal to this specific VC
5. **Make it feel authentic** - Ensure the personalization feels natural, not forced

REQUIREMENTS:
- Keep the same level of formality/casualness as the template
- Use the prospect's name and firm naturally throughout
- Reference specific details that show you've researched them
- Maintain the original email's length and structure
- Make the email relevant to their investment focus/stage
- Ensure all personalizations are accurate to the provided data

Return your response as JSON in this exact format:
{
  "subject": "Compelling subject line for ${prospect.person} at ${prospect.companies}",
  "email": "The complete personalized email in HTML format with proper line breaks and formatting"
}

The email should be ready to send - professional, engaging, and tailored specifically for ${prospect.person} at ${prospect.companies}.`;

    console.log('🤖 Generating personalized email for:', prospect.person, 'at', prospect.companies);

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