import { Handler } from '@netlify/functions';

interface RequestBody {
  boardConsentContent: string;
  expectedStakeholderName: string;
  expectedNumberOfOptions?: number;
  expectedExercisePrice?: number;
  expectedVestingStartDate?: string;
  expectedCliffMonths?: number;
  expectedVestingMonths?: number;
  expectedEarlyExerciseAllowed?: boolean;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

const getHeader = (headers: Record<string, string | undefined> | undefined, headerName: string): string | undefined => {
  if (!headers) return undefined;

  const directMatch = headers[headerName];
  if (directMatch) return directMatch;

  const normalizedHeaderName = headerName.toLowerCase();
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === normalizedHeaderName);
  return matchedKey ? headers[matchedKey] : undefined;
};

const getRequestOrigin = (event: Parameters<Handler>[0]): string => {
  const host = getHeader(event.headers, 'host');
  const protocol = getHeader(event.headers, 'x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  return host ? `${protocol}://${host}` : (process.env.URL || process.env.DEPLOY_URL || 'https://fitwithpulse.ai');
};

const extractBridgeErrorMessage = (responseBody: string): string => {
  try {
    const parsed = JSON.parse(responseBody);
    return parsed?.error?.message || parsed?.error || responseBody;
  } catch {
    return responseBody;
  }
};

const createBridgeChatCompletion = async (
  event: Parameters<Handler>[0],
  body: Record<string, unknown>,
): Promise<ChatCompletionResponse> => {
  const authorization = getHeader(event.headers, 'authorization');
  if (!authorization) {
    throw new Error('OpenAI bridge authentication is required. Please sign in again and retry.');
  }

  const response = await fetch(`${getRequestOrigin(event)}/api/openai/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      'openai-organization': 'equityBoardConsentVerification',
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI bridge verification failed (${response.status}): ${extractBridgeErrorMessage(responseText)}`);
  }

  try {
    return JSON.parse(responseText) as ChatCompletionResponse;
  } catch {
    throw new Error('OpenAI bridge returned an invalid verification response.');
  }
};

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const expectedTerms = [
      expectedOptionsLine,
      typeof body.expectedExercisePrice === 'number'
        ? `Expected exercise price / Board-determined FMV per share: $${body.expectedExercisePrice}`
        : null,
      body.expectedVestingStartDate
        ? `Expected vesting commencement date: ${body.expectedVestingStartDate}`
        : null,
      typeof body.expectedCliffMonths === 'number'
        ? `Expected cliff: ${body.expectedCliffMonths} months`
        : null,
      typeof body.expectedVestingMonths === 'number'
        ? `Expected total vesting period: ${body.expectedVestingMonths} months`
        : null,
      typeof body.expectedEarlyExerciseAllowed === 'boolean'
        ? `Expected early-exercise treatment: ${body.expectedEarlyExerciseAllowed ? 'permitted' : 'not permitted'}`
        : null,
    ].filter(Boolean).join('\n');

    const completion = await createBridgeChatCompletion(event, {
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
            `- approvalDate should be a human-readable date like "Jan 11, 2026" or "January 11, 2026" if you can infer it from the document.\n` +
            `- Look for dates in: effectiveness clauses ("effective as of..."), signature blocks ("Date: ..."), or recitals ("Dated as of...", "Approved on...").\n` +
            `- If no date is present/inferrable, approvalDate must be null and add an issue: "Approval date is missing or not inferrable."\n` +
            `- Check for signature date in the signature block - if missing, add issue: "Signature date is missing."\n` +
            `- Be strict: if stakeholder name doesn't appear, mark invalid.\n` +
            `- Compare every supplied expected grant term (option count, exercise price/FMV, vesting commencement, cliff, total vesting, and early-exercise treatment) against the document. Any omission or mismatch is an issue and makes the consent invalid.\n` +
            `- Treat corporate par value as distinct from fair market value. If the consent substitutes par value for the expected exercise price/FMV, mark invalid.\n` +
            `- The document must have BOTH an approval/effective date AND a signature date clearly stated.\n`,
        },
        {
          role: 'user',
          content:
            `Verify this Board Consent matches the expected grant.\n\n` +
            `Expected stakeholder name: ${body.expectedStakeholderName}\n` +
            `${expectedTerms}\n\n` +
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
