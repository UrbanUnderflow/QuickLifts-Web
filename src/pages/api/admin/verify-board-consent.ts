import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

interface RequestBody {
  boardConsentContent: string;
  expectedStakeholderName: string;
  expectedNumberOfOptions?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as RequestBody;

    if (!body.boardConsentContent?.trim()) {
      return res.status(400).json({ error: 'Missing boardConsentContent' });
    }
    if (!body.expectedStakeholderName?.trim()) {
      return res.status(400).json({ error: 'Missing expectedStakeholderName' });
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
            `- approvalDate should be a human-readable date like "Jan 11, 2026" or "January 11, 2026" if you can infer it from the document.\n` +
            `- Look for dates in: effectiveness clauses ("effective as of..."), signature blocks ("Date: ..."), or recitals ("Dated as of...", "Approved on...").\n` +
            `- If no date is present/inferrable, approvalDate must be null and add an issue: "Approval date is missing or not inferrable."\n` +
            `- Check for signature date in the signature block - if missing, add issue: "Signature date is missing."\n` +
            `- Be strict: if stakeholder name doesn't appear, mark invalid.\n` +
            `- The document must have BOTH an approval/effective date AND a signature date clearly stated.\n`,
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
      return res.status(500).json({ error: 'No verification result generated' });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: 'Invalid verification response format' });
    }

    const isValid = Boolean(parsed.isValid);
    const approvalDate = typeof parsed.approvalDate === 'string' ? parsed.approvalDate : null;
    const issues = Array.isArray(parsed.issues) ? parsed.issues.filter((x: unknown) => typeof x === 'string') : [];

    return res.status(200).json({ success: true, isValid, approvalDate, issues });
  } catch (error) {
    console.error('Error verifying board consent:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to verify board consent' });
  }
}

