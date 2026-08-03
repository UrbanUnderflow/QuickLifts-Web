import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { resolveOpenAIApiKey } from './utils/resolveOpenAIApiKey';

interface RequestBody {
  documentId: string;
  documentType: string;
  currentContent: string;
  revisionPrompt: string;
  originalPrompt?: string;
  requiresSignature?: boolean;
  stakeholderName?: string;
  stakeholderEmail?: string;
  stakeholderType?: 'founder' | 'employee' | 'advisor' | 'investor' | 'contractor';
  stakeholderTitle?: string;
  grantDetails?: {
    equityType: string;
    numberOfShares: number;
    strikePrice: number;
    fairMarketValueAtGrant?: number;
    valuationDate?: string;
    earlyExerciseAllowed?: boolean;
    vestingSchedule: string;
    vestingStartDate: string;
    cliffMonths: number;
    vestingMonths: number;
  };
}

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}') as RequestBody;
    const openaiApiKey = resolveOpenAIApiKey();

    if (!body.documentId || !body.documentType) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing documentId or documentType' }) };
    }

    if (!body.currentContent?.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing currentContent' }) };
    }

    if (!body.revisionPrompt?.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing revisionPrompt' }) };
    }

    if (!openaiApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured. Set OPENAI_API_KEY or OPEN_AI_SECRET_KEY.' }),
      };
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const contextualHeader = [
      `COMPANY: Pulse Intelligence Labs, Inc., a Delaware corporation`,
      body.documentType !== 'eip' && body.stakeholderName ? `STAKEHOLDER: ${body.stakeholderName}` : null,
      body.documentType !== 'eip' && body.stakeholderEmail ? `EMAIL: ${body.stakeholderEmail}` : null,
      body.documentType !== 'eip' && body.stakeholderType ? `ROLE TYPE: ${body.stakeholderType}` : null,
      body.documentType !== 'eip' && body.stakeholderTitle ? `ROLE TITLE: ${body.stakeholderTitle}` : null,
      body.grantDetails
        ? [
            `GRANT DETAILS:`,
            `- Equity Type: ${body.grantDetails.equityType}`,
            `- Number of Shares: ${body.grantDetails.numberOfShares.toLocaleString()}`,
            `- Strike Price per Share: $${Number(body.grantDetails.strikePrice).toFixed(4)}`,
            `- Board-Determined FMV per Share: $${Number(body.grantDetails.fairMarketValueAtGrant ?? body.grantDetails.strikePrice).toFixed(4)}`,
            body.grantDetails.valuationDate ? `- FMV Determination Date: ${body.grantDetails.valuationDate}` : null,
            `- Early Exercise: ${body.grantDetails.earlyExerciseAllowed ? 'Allowed' : 'Not allowed'}`,
            `- Vesting Schedule: ${body.grantDetails.vestingSchedule}`,
            `- Vesting Start Date: ${body.grantDetails.vestingStartDate}`,
            `- Cliff Months: ${body.grantDetails.cliffMonths}`,
            `- Vesting Months: ${body.grantDetails.vestingMonths}`,
          ].filter(Boolean).join('\n')
        : null,
      body.originalPrompt?.trim() ? `ORIGINAL PROMPT:\n${body.originalPrompt.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const bulletFormattingRules = `
BULLET & LIST FORMATTING (CRITICAL - follow exactly):
- For bullet lists, ALWAYS start each item with "- " (dash + space). Example:
  - First item
  - Second item
- For numbered lists, use "1. ", "2. ", "3. " (number + period + space)
- For nested/sub-bullets, use two spaces then "- " (e.g., "  - sub-item")
- DO NOT use plain text lists without bullet markers
- DO NOT use "•" Unicode bullets - use "-" or "*" instead
- Each list item should be on its own line
- Use "## " for section headers, "### " for subsections
- Use "**text**" for bold emphasis`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            `You are an expert corporate attorney editing a legal document for a Delaware startup.\n\n` +
            `IMPORTANT:\n` +
            `- Return ONLY the revised document text.\n` +
            `- Preserve the overall structure unless the revision explicitly changes it.\n` +
            `- If the revision asks to add/remove sections, do so cleanly.\n` +
            (body.documentType === 'advisor_nso_agreement'
              ? `- Preserve the distinction between corporate par value and Board-determined fair market value / exercise price.\n` +
                `- Do not list fundraising, investor solicitation, securities placement, or market-promotion work as compensable advisor services.\n` +
                `- Do not say an 83(b) election is due at option grant. Include an 83(b) notice or sample only when early exercise can transfer substantially nonvested shares.\n` +
                `- Keep the legal Grant Date / Board Approval Date distinct from the Vesting Commencement Date; never backdate the Grant Date.\n`
              : ``) +
            (body.requiresSignature
              ? `- Ensure a signature section exists at the end with signature blocks for BOTH parties (Company and Recipient), including printed name + title + date lines.\n`
              : `- Remove signature lines/blocks if present unless they are strictly required.\n`) +
            `\n${bulletFormattingRules}`,
        },
        {
          role: 'user',
          content:
            `${contextualHeader}\n\n` +
            `CURRENT DOCUMENT:\n` +
            `${body.currentContent}\n\n` +
            `REVISION INSTRUCTIONS:\n` +
            `${body.revisionPrompt}\n`,
        },
      ],
      temperature: 0.25,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No revised content generated');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, content }),
    };
  } catch (error) {
    console.error('Error revising equity document:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to revise document' }),
    };
  }
};

export { handler };
