import type { NextApiRequest, NextApiResponse } from 'next';

const AUDIT_CRITERIA: Record<string, string[]> = {
  option_agreement: [
    'Parties clearly identified (Company + Optionee)',
    'Grant details included (type, shares, price, dates)',
    'Vesting schedule described clearly (cliff + monthly vesting)',
    'Term and expiration specified',
    'Exercise mechanics and payment methods',
    'Termination of service consequences',
    'Non-transferability clause',
    'Tax withholding / tax disclaimer',
    'Governing law (Delaware) and venue',
    'Signature blocks (if required)'
  ],
  fast_agreement: [
    'Advisor services scope described',
    'Equity compensation and vesting schedule',
    'Confidentiality obligations',
    'IP assignment clause',
    'No employment relationship disclaimer',
    'Term and termination provisions',
    'Governing law (Delaware)',
    'Signature blocks (if required)'
  ],
  advisor_nso_agreement: [
    'Section 1: Advisor Services Agreement section (not labeled FAST unless using FAST mechanics)',
    'Advisor engagement and services scope',
    'No employment relationship disclaimer',
    'Confidentiality obligations',
    'IP assignment clause',
    'Term and termination provisions',
    'Section 2: NSO Grant section',
    'Grant details (shares, exercise price)',
    'Equity Incentive Plan incorporated by reference',
    'Vesting schedule (cliff + monthly vesting)',
    'Option term (10 years)',
    'Termination of service consequences (including post-termination exercise window; 6 months for advisors)',
    'No stockholder rights until exercise',
    'Section 3: Tax matters disclaimer',
    'Section 4: General provisions',
    'Governing law (Delaware)',
    'Entire agreement clause',
    'Amendment provisions',
    'Securities law / transfer restriction acknowledgment',
    'Counterparts / electronic signature',
    'Signature blocks for Company (Tremaine Grant) and Advisor'
  ],
  board_consent: [
    'Recitals (WHEREAS) establishing authority and context',
    'Resolutions approving the grant / plan action',
    'Authorization for officers to execute documents',
    'FMV / 409A context if applicable',
    'Effective date',
    'Director signature block(s)'
  ],
  stockholder_consent: [
    'Recitals establishing authority',
    'Resolutions adopted/ratified',
    'Waiver of notice (if applicable)',
    'Effective date',
    'Signature block(s) and share/voting power representation'
  ],
  eip: [
    'Purpose and definitions section',
    'Administration and committee authority',
    'Share reserve and adjustment provisions',
    'Eligibility definitions',
    'Award types included',
    'Stock option terms (ISOs and NSOs)',
    'Termination and post-termination exercise provisions',
    'Change in control provisions',
    'Tax withholding / compliance language',
    'Amendment and termination provisions',
    'Governing law (Delaware)'
  ],
  default: [
    'Purpose and scope clearly stated',
    'Key terms defined',
    'Rights and obligations clear',
    'Governing law specified',
    'No unresolved placeholders like [Name] or [Date]',
    'Signature blocks (if required)'
  ]
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { documentId, content, documentType, title, requiresSignature } = req.body || {};

  if (!content) {
    return res.status(400).json({ error: 'Missing required field: content' });
  }

    const openaiApiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!openaiApiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const criteria = AUDIT_CRITERIA[documentType] || AUDIT_CRITERIA.default;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              `You are a legal document auditor focused on startup equity documents.\n` +
              `Your job is to review documents and return a strict audit.\n\n` +
              `You must respond with a valid JSON object in exactly this format:\n` +
              `{\n` +
              `  "overallStatus": "ready" | "needs-work" | "critical-issues",\n` +
              `  "score": <number 0-100>,\n` +
              `  "summary": "<2-3 sentence overall assessment>",\n` +
              `  "criticalIssues": ["<issue 1>", "<issue 2>", ...],\n` +
              `  "missingElements": ["<element 1>", "<element 2>", ...],\n` +
              `  "recommendations": ["<recommendation 1>", "<recommendation 2>", ...],\n` +
              `  "strengths": ["<strength 1>", "<strength 2>", ...]\n` +
              `}\n\n` +
              `SCORING GUIDELINES:\n` +
              `- 90-100: Ready to send, minor or no issues\n` +
              `- 70-89: Needs some work, but no critical issues\n` +
              `- 50-69: Significant issues that should be addressed\n` +
              `- Below 50: Critical issues that must be fixed\n\n` +
              `CRITICAL ISSUES include:\n` +
              `- Placeholder text like [Name], [Company], [Date], [Amount]\n` +
              `- Missing governing law\n` +
              `- Contradictory terms\n` +
              `- Missing essential equity clauses for this document type\n` +
              (requiresSignature
                ? `- Missing signature blocks (signature is required)\n`
                : '') +
              `\nBe strict and precise.`,
          },
          {
            role: 'user',
            content:
              `Please audit this equity document titled "${title || 'Untitled'}" (type: ${documentType || 'unknown'}).\n\n` +
              `Signature required: ${requiresSignature ? 'YES' : 'NO'}\n\n` +
              `Expected elements for this document type:\n` +
              `${criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}\n\n` +
              `---\nDOCUMENT TO AUDIT:\n${content}\n---\n\n` +
              `Provide a comprehensive audit in the JSON format specified.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return res.status(500).json({ error: 'Failed to audit document' });
    }

    const data = await response.json();
    const auditContent = data.choices[0]?.message?.content;
    if (!auditContent) {
      return res.status(500).json({ error: 'No audit result generated' });
    }

    let audit: any;
    try {
      audit = JSON.parse(auditContent);
    } catch (parseError) {
      console.error('Failed to parse audit JSON:', parseError);
      return res.status(500).json({ error: 'Invalid audit response format' });
    }

    const sanitizedAudit = {
      overallStatus: ['ready', 'needs-work', 'critical-issues'].includes(audit.overallStatus) ? audit.overallStatus : 'needs-work',
      score: typeof audit.score === 'number' ? Math.min(100, Math.max(0, audit.score)) : 50,
      summary: typeof audit.summary === 'string' ? audit.summary : 'Unable to generate summary.',
      criticalIssues: Array.isArray(audit.criticalIssues) ? audit.criticalIssues : [],
      missingElements: Array.isArray(audit.missingElements) ? audit.missingElements : [],
      recommendations: Array.isArray(audit.recommendations) ? audit.recommendations : [],
      strengths: Array.isArray(audit.strengths) ? audit.strengths : [],
    };

    return res.status(200).json({
      success: true,
      audit: sanitizedAudit,
      documentId,
    });
  } catch (error) {
    console.error('Error auditing equity document:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to audit document',
    });
  }
}

