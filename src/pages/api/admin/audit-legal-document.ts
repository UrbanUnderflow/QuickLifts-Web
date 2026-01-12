import type { NextApiRequest, NextApiResponse } from 'next';

// Document type specific audit criteria
const AUDIT_CRITERIA: Record<string, string[]> = {
  'nda': [
    'Clear definition of Confidential Information',
    'Parties clearly identified with full legal names',
    'Mutual vs one-way confidentiality specified',
    'Duration/term of confidentiality obligations',
    'Permitted disclosures and exceptions',
    'Return or destruction of materials clause',
    'Governing law and jurisdiction',
    'Signature blocks for all parties',
    'Effective date specified'
  ],
  'contractor': [
    'Scope of services clearly defined',
    'Compensation and payment terms',
    'Independent contractor status clause',
    'Tax responsibility acknowledgment',
    'Intellectual property assignment',
    'Confidentiality provisions',
    'Term and termination conditions',
    'Insurance requirements if applicable',
    'Non-compete/non-solicitation if needed'
  ],
  'employment': [
    'Position title and responsibilities',
    'Compensation, benefits, and bonus structure',
    'At-will or specified term status',
    'Start date clearly stated',
    'Reporting structure',
    'Confidentiality obligations',
    'IP assignment provisions',
    'Non-compete and non-solicitation clauses',
    'Termination conditions and notice periods',
    'Severance terms if applicable'
  ],
  'advisor': [
    'Advisory services description',
    'Time commitment expectations',
    'Equity compensation and vesting schedule',
    'Confidentiality obligations',
    'IP assignment clause',
    'No conflicts of interest representation',
    'Term and termination provisions',
    'No employment relationship disclaimer',
    'Expense reimbursement policy'
  ],
  'safe': [
    'Purchase amount clearly stated',
    'Valuation cap specified (if applicable)',
    'Discount rate specified (if applicable)',
    'Definition of Equity Financing',
    'Conversion mechanics',
    'Liquidity event provisions',
    'Dissolution provisions',
    'Pro-rata rights (if included)',
    'Information rights',
    'Most Favored Nation clause (if applicable)'
  ],
  'proposal': [
    'Executive summary present',
    'Client/recipient clearly identified',
    'Problem or opportunity clearly stated',
    'Proposed solution clearly described',
    'Scope of work and deliverables defined',
    'Timeline and milestones included',
    'Pricing or investment breakdown',
    'Team qualifications or company background',
    'Terms and conditions',
    'Clear next steps or call to action',
    'Contact information provided'
  ],
  'system-design': [
    'System overview and purpose clearly stated',
    'Problem statement or requirements defined',
    'Architecture overview provided',
    'System components identified with responsibilities',
    'Data models or schemas described',
    'API specifications included (if applicable)',
    'Database design documented (if applicable)',
    'User flows or interactions outlined',
    'Technology stack specified',
    'Scalability considerations addressed',
    'Security considerations included',
    'Error handling approach defined',
    'Deployment strategy outlined',
    'Testing strategy described'
  ],
  'default': [
    'All parties clearly identified',
    'Purpose and scope clearly stated',
    'Key terms and definitions',
    'Rights and obligations of each party',
    'Duration/term of agreement',
    'Termination conditions',
    'Dispute resolution mechanism',
    'Governing law specified',
    'Signature blocks for all parties',
    'Effective date'
  ]
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { documentId, content, documentType, title } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Missing required field: content' });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const criteria = AUDIT_CRITERIA[documentType] || AUDIT_CRITERIA['default'];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a legal document auditor. Your job is to review legal documents and provide a comprehensive audit that identifies:
1. Critical issues that must be fixed before the document can be signed
2. Missing elements that should typically be included
3. Recommendations for improvement
4. Strengths of the document

You must respond with a valid JSON object in exactly this format:
{
  "overallStatus": "ready" | "needs-work" | "critical-issues",
  "score": <number 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "criticalIssues": ["<issue 1>", "<issue 2>", ...],
  "missingElements": ["<element 1>", "<element 2>", ...],
  "recommendations": ["<recommendation 1>", "<recommendation 2>", ...],
  "strengths": ["<strength 1>", "<strength 2>", ...]
}

SCORING GUIDELINES:
- 90-100: Ready to send, minor or no issues
- 70-89: Needs some work, but no critical issues
- 50-69: Significant issues that should be addressed
- Below 50: Critical issues that must be fixed

CRITICAL ISSUES include:
- Missing party names or placeholder text like [Company Name] still present
- Missing essential legal clauses for this document type
- Contradictory terms
- Missing signature blocks
- No governing law specified

BE STRICT about placeholder text - any brackets like [Name], [Date], [Amount] should be flagged.`
          },
          {
            role: 'user',
            content: `Please audit this ${documentType || 'legal'} document titled "${title || 'Untitled'}".

Expected elements for this document type:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

---
DOCUMENT TO AUDIT:
${content}
---

Provide a comprehensive audit in the JSON format specified. Be thorough but fair in your assessment.`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
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

    let audit;
    try {
      audit = JSON.parse(auditContent);
    } catch (parseError) {
      console.error('Failed to parse audit JSON:', parseError);
      return res.status(500).json({ error: 'Invalid audit response format' });
    }

    // Validate and sanitize the audit response
    const sanitizedAudit = {
      overallStatus: ['ready', 'needs-work', 'critical-issues'].includes(audit.overallStatus) 
        ? audit.overallStatus 
        : 'needs-work',
      score: typeof audit.score === 'number' ? Math.min(100, Math.max(0, audit.score)) : 50,
      summary: typeof audit.summary === 'string' ? audit.summary : 'Unable to generate summary.',
      criticalIssues: Array.isArray(audit.criticalIssues) ? audit.criticalIssues : [],
      missingElements: Array.isArray(audit.missingElements) ? audit.missingElements : [],
      recommendations: Array.isArray(audit.recommendations) ? audit.recommendations : [],
      strengths: Array.isArray(audit.strengths) ? audit.strengths : []
    };

    return res.status(200).json({
      success: true,
      audit: sanitizedAudit,
      documentId: documentId
    });

  } catch (error) {
    console.error('Error auditing legal document:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to audit document' 
    });
  }
}
