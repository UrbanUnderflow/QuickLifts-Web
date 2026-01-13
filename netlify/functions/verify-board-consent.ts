import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RequestBody {
  boardConsentContent: string;
  expectedStakeholderName: string;
  expectedNumberOfOptions?: number;
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

    if (!body.boardConsentContent?.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing boardConsentContent' }) };
    }
    if (!body.expectedStakeholderName?.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing expectedStakeholderName' }) };
    }

    const expectedOptionsLine = typeof body.expectedNumberOfOptions === 'number'
      ? `Expected options amount: ${body.expectedNumberOfOptions.toLocaleString()}`
      : `Expected options amount: (not provided)`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            `You are a corporate paralegal verifying a Board Consent for an equity grant.\n` +
            `Return ONLY valid JSON.\n\n` +
            `You must output exactly this JSON shape:\n` +
            `{\n` +
            `  "isValid": boolean,\n` +
            `  "approvalDate": string | null,\n` +
            `  "issues": string[]\n` +
            `}\n\n` +
            `Rules:\n` +
            `- approvalDate should be a human-readable date like "Jan 11, 2026" if you can infer it.\n` +
            `- If no date is present/inferrable, approvalDate must be null and add an issue.\n` +
            `- Be strict: if stakeholder name doesn't appear, mark invalid.\n`,
        },
        {
          role: 'user',
          content:
            `Verify this Board Consent matches the expected grant.\n\n` +
            `Expected stakeholder name: ${body.expectedStakeholderName}\n` +
            `${expectedOptionsLine}\n\n` +
            `BOARD CONSENT CONTENT:\n` +
            `${body.boardConsentContent}\n`,
        },
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'No verification result generated' }) };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Invalid verification response format' }) };
    }

    const isValid = Boolean(parsed.isValid);
    const approvalDate = typeof parsed.approvalDate === 'string' ? parsed.approvalDate : null;
    const issues = Array.isArray(parsed.issues) ? parsed.issues.filter((x: unknown) => typeof x === 'string') : [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, isValid, approvalDate, issues }),
    };
  } catch (error) {
    console.error('Error verifying board consent:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to verify board consent' }),
    };
  }
};

export { handler };
