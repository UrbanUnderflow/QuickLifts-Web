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

interface ResearchVCFirmRequest {
  prospect: VCProspect;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prospect } = req.body as ResearchVCFirmRequest;

    if (!prospect || !prospect.companies) {
      return res.status(400).json({ error: 'Prospect with companies field is required' });
    }

    // Get OpenAI API key
    const apiKey = process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found in environment variables');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    const researchPrompt = `You are a venture capital research specialist. Research the VC firm "${prospect.companies}" to find specific information that would help a fitness tech startup called Pulse create a personalized outreach email.

ABOUT PULSE (the startup reaching out):
- Community-building platform for fitness creators
- Transforms wearable health data into gamified experiences
- 800+ total users with 153 paid subscribers
- Partnership with Soul Cycle (2 instructors leading community challenges)
- 5-star Apple App Store rating
- Previously scaled fitness app BULK to 200K+ users across 70+ countries
- Founder: Former D1 athlete + Principal Engineer at Pfizer, Eli Lilly, Warby Parker
- Raising $750K for user acquisition and AI-powered scoring systems

RESEARCH TARGET: ${prospect.companies}
Additional context:
- Contact: ${prospect.person || 'Unknown'}
- Website: ${prospect.urls || 'Unknown'}
- LinkedIn: ${prospect.linkedin || 'Unknown'}
- Description: ${prospect.description || 'Unknown'}
- Investment Stage: ${prospect.stage || 'Unknown'}

RESEARCH OBJECTIVES - Find specific information about:
1. Portfolio companies that align with Pulse (fitness, health, wellness, consumer apps, community platforms, gamification, SaaS)
2. Investment thesis/values that align with Pulse's mission
3. Recent investments that show interest in similar sectors
4. Partner backgrounds or interests that relate to fitness/health/gaming
5. Any statements about diversity, community building, or health tech
6. Specific quotes or mission statements that resonate with Pulse's values

RESPONSE FORMAT - Return a JSON object with these fields:
{
  "relevantPortfolioCompanies": [
    {
      "name": "Company Name",
      "description": "What they do",
      "alignment": "How it relates to Pulse"
    }
  ],
  "investmentThesis": "Specific thesis points that align with Pulse",
  "partnerInsights": "Relevant partner backgrounds or interests",
  "firmValues": "Values/mission that align with Pulse",
  "recentRelevantInvestments": "Recent investments showing sector interest",
  "personalizedAngle": "Best angle for Pulse to approach this firm",
  "suggestedMentions": "Specific things to mention in the email for personalization"
}

IMPORTANT:
- Focus on SPECIFIC, ACTIONABLE insights
- Look for REAL portfolio companies and investments
- Find CONCRETE alignment points, not generic statements
- If you can't find specific information, be honest about it
- Prioritize quality over quantity - better to have 2 specific insights than 5 generic ones

Return ONLY valid JSON, no markdown or explanations.`;

    console.log(`🔍 Researching VC firm: ${prospect.companies}`);

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: "system",
          content: "You are a VC research specialist with deep knowledge of venture capital firms, their portfolios, investment theses, and partner backgrounds. Focus on finding specific, actionable insights for personalized outreach."
        },
        {
          role: "user",
          content: researchPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.1, // Low temperature for factual research
    });

    const generatedContent = response.choices[0]?.message?.content?.trim();
    if (!generatedContent) {
      throw new Error('OpenAI did not return valid content.');
    }

    console.log('🤖 Raw Research Response:', generatedContent);

    // Clean and parse response
    let cleanedResponse = generatedContent
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    console.log('🧹 Cleaned Research Response:', cleanedResponse);

    // Parse JSON response
    let researchData;
    try {
      researchData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse research response:', parseError);
      console.log('Raw response content:', generatedContent);
      throw new Error('AI returned invalid JSON format for research.');
    }

    console.log(`📊 Successfully researched ${prospect.companies}`);

    return res.status(200).json({ 
      insights: researchData,
      success: true
    });

  } catch (error) {
    console.error('Error researching VC firm:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false 
    });
  }
} 