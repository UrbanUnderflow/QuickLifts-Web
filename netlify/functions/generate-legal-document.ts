import { Handler } from '@netlify/functions';

// Document type templates and system prompts
const DOCUMENT_TEMPLATES: Record<string, { systemPrompt: string; defaultTitle: string }> = {
  nda: {
    systemPrompt: `You are a legal document drafting assistant specializing in Non-Disclosure Agreements. 
Generate a comprehensive, professional NDA that includes:
- Clear definitions of Confidential Information
- Obligations of the receiving party
- Exclusions from confidential information
- Term and termination clauses
- Return of materials clause
- Remedies and enforcement provisions
- Governing law clause
Use clear, professional legal language appropriate for business contracts.`,
    defaultTitle: 'Non-Disclosure Agreement'
  },
  terms: {
    systemPrompt: `You are a legal document drafting assistant specializing in Terms of Service agreements.
Generate comprehensive Terms of Service that include:
- Acceptance of terms
- User account responsibilities
- Prohibited activities
- Intellectual property rights
- Disclaimers and limitation of liability
- Indemnification
- Termination provisions
- Governing law and dispute resolution
Use clear language that is both legally sound and understandable.`,
    defaultTitle: 'Terms of Service'
  },
  privacy: {
    systemPrompt: `You are a legal document drafting assistant specializing in Privacy Policies.
Generate a comprehensive Privacy Policy that includes:
- Information collection (personal data, usage data, cookies)
- How information is used
- Information sharing and disclosure
- Data security measures
- User rights (access, correction, deletion)
- Children's privacy
- International data transfers
- Policy updates
- Contact information
Ensure compliance with GDPR, CCPA, and other major privacy regulations.`,
    defaultTitle: 'Privacy Policy'
  },
  contractor: {
    systemPrompt: `You are a legal document drafting assistant specializing in Independent Contractor Agreements.
Generate a comprehensive contractor agreement that includes:
- Scope of services
- Compensation and payment terms
- Independent contractor status
- Confidentiality obligations
- Intellectual property assignment
- Term and termination
- Insurance requirements
- Indemnification
- Non-solicitation (if applicable)
Use clear, professional legal language.`,
    defaultTitle: 'Independent Contractor Agreement'
  },
  employment: {
    systemPrompt: `You are a legal document drafting assistant specializing in Employment Agreements.
Generate a comprehensive employment agreement that includes:
- Position and duties
- Compensation and benefits
- At-will employment status (or specified term)
- Confidentiality obligations
- Non-compete and non-solicitation (where enforceable)
- Intellectual property assignment
- Termination provisions
- Severance (if applicable)
Use clear, professional legal language compliant with employment law.`,
    defaultTitle: 'Employment Agreement'
  },
  'ip-assignment': {
    systemPrompt: `You are a legal document drafting assistant specializing in Intellectual Property Assignment Agreements.
Generate a comprehensive IP assignment that includes:
- Definition of assigned intellectual property
- Assignment of rights (present and future)
- Warranties of ownership
- Further assurances clause
- Work for hire acknowledgment
- Compensation for assignment
- Exclusions (if any)
Use clear, professional legal language for technology companies.`,
    defaultTitle: 'Intellectual Property Assignment Agreement'
  },
  advisor: {
    systemPrompt: `You are a legal document drafting assistant specializing in Advisor Agreements for startups.
Generate a comprehensive advisor agreement that includes:
- Advisory services description
- Time commitment expectations
- Equity compensation (vesting schedule)
- Confidentiality obligations
- IP assignment
- No conflicts representation
- Term and termination
- No employee relationship disclaimer
Use clear, professional legal language appropriate for startup advisors.`,
    defaultTitle: 'Advisor Agreement'
  },
  safe: {
    systemPrompt: `You are a legal document drafting assistant specializing in SAFE (Simple Agreement for Future Equity) documents.
Generate a SAFE agreement that includes:
- Purchase amount
- Valuation cap (if applicable)
- Discount rate (if applicable)
- Equity financing conversion terms
- Liquidity event conversion
- Dissolution provisions
- Pro-rata rights (if applicable)
- Most Favored Nation provision (if applicable)
Follow Y Combinator SAFE standards where appropriate.`,
    defaultTitle: 'Simple Agreement for Future Equity (SAFE)'
  },
  partnership: {
    systemPrompt: `You are a legal document drafting assistant specializing in Partnership Agreements.
Generate a comprehensive partnership agreement that includes:
- Partnership purpose and business
- Capital contributions
- Profit and loss allocation
- Management and voting rights
- Partner duties and restrictions
- Admission of new partners
- Withdrawal and dissolution
- Dispute resolution
Use clear, professional legal language.`,
    defaultTitle: 'Partnership Agreement'
  },
  license: {
    systemPrompt: `You are a legal document drafting assistant specializing in License Agreements.
Generate a comprehensive license agreement that includes:
- Grant of license (scope and limitations)
- License fees and royalties
- Intellectual property rights
- Restrictions on use
- Warranties and disclaimers
- Indemnification
- Term and termination
- Audit rights (if applicable)
Use clear, professional legal language.`,
    defaultTitle: 'License Agreement'
  },
  proposal: {
    systemPrompt: `You are a professional document drafting assistant specializing in business proposals.
Generate a compelling, well-structured proposal document that includes:
- Executive summary
- Problem statement / opportunity identification
- Proposed solution / approach
- Scope of work and deliverables
- Timeline and milestones
- Pricing / investment breakdown
- Team qualifications and relevant experience
- Terms and conditions
- Next steps / call to action
Use professional business language that is persuasive yet factual.`,
    defaultTitle: 'Business Proposal'
  },
  'system-design': {
    systemPrompt: `You are a technical documentation specialist specializing in system design documents.
Generate a comprehensive, well-structured system design document that includes:
- System Overview and Purpose
- Problem Statement / Requirements
- Architecture Overview (high-level)
- System Components and their responsibilities
- Data Models and Schemas
- API Specifications (if applicable)
- Database Design (if applicable)
- User Flows and Interactions
- Technology Stack
- Scalability and Performance Considerations
- Security Considerations
- Error Handling and Edge Cases
- Deployment Strategy
- Testing Strategy
- Future Enhancements / Roadmap
Use clear, technical language appropriate for engineering teams. Include diagrams descriptions where helpful (describe what diagrams would show).
Structure the document so it can serve as both a design spec and implementation guide.`,
    defaultTitle: 'System Design Document'
  },
  custom: {
    systemPrompt: `You are a document formatting assistant. The user will paste an existing document.
Your job is to preserve the original wording, tone, and structure as much as possible while applying clean formatting.
Do NOT rewrite sentences, alter voice, or add new content. Only fix obvious grammar/typo issues.
Focus on presentation: headings, spacing, lists, numbering, and consistent formatting.`,
    defaultTitle: 'Legal Document'
  }
};

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
    const body = JSON.parse(event.body || '{}');
    const { prompt, documentType, documentId, requiresSignature } = body || {};

    if (!prompt || !documentType) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields: prompt and documentType' }) };
    }

    const openaiApiKey = process.env.OPEN_AI_SECRET_KEY;
    if (!openaiApiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'OpenAI API key not configured' }) };
    }

    const template = DOCUMENT_TEMPLATES[documentType] || DOCUMENT_TEMPLATES.custom;
    const wantsSignature = Boolean(requiresSignature);
    const preserveVerbiage =
      documentType === 'custom'
        ? `\n\nCRITICAL CONTENT PRESERVATION RULES:\n- Keep the original wording and tone intact.\n- Only fix clear grammar or spelling errors.\n- Do not paraphrase, expand, or shorten content.\n- Do not add new clauses, sections, or legal concepts unless explicitly present in the pasted text.`
        : '';

    // Universal formatting rules for proper markdown rendering
    const bulletFormattingRules = `
BULLET & LIST FORMATTING (CRITICAL - follow exactly):
- For bullet lists, ALWAYS start each item with "- " (dash + space). Example:
  - First item
  - Second item
  - Third item
- For numbered lists, use "1. ", "2. ", "3. " (number + period + space)
- For nested/sub-bullets, use two spaces then "- " (e.g., "  - sub-item")
- DO NOT use plain text lists without bullet markers
- DO NOT use "•" Unicode bullets - use "-" or "*" instead
- Each list item should be on its own line
- Use "## " for section headers, "### " for subsections
- Use "**text**" for bold emphasis`;

    const formattingInstructions = wantsSignature
      ? `IMPORTANT FORMATTING INSTRUCTIONS:
- Start with a clear document title
- Use numbered sections (1., 2., 3., etc.) for main sections
- Use lettered subsections (a., b., c.) where appropriate
- Include an "EFFECTIVE DATE" placeholder at the beginning (if applicable)
- Include signature blocks at the end with placeholders for:
  - Company name and representative
  - Counterparty name and representative
  - Date lines
- Use professional formatting throughout
- Include a "WHEREAS" recitals section where appropriate
- End with an "IN WITNESS WHEREOF" clause before signatures
${bulletFormattingRules}

The document should be ready to print as a professional document.`
      : `IMPORTANT FORMATTING INSTRUCTIONS:
- Start with a clear document title
- Use numbered sections (1., 2., 3., etc.) for main sections
- Use lettered subsections (a., b., c.) where appropriate
- If you include dates, use placeholders like "Effective Date: [Insert Date]" (optional)
- DO NOT include signature blocks, signature lines, or "IN WITNESS WHEREOF" sections
- Use professional formatting throughout
${bulletFormattingRules}

The document should be ready to print as a professional document.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `${template.systemPrompt}\n\n${formattingInstructions}${preserveVerbiage}`
          },
          {
            role: 'user',
            content: `Please generate a ${template.defaultTitle} based on the following requirements and details:

${prompt}

Generate a complete, professionally formatted legal document.`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let errorDetail = '';
      if (contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          errorDetail = errorData?.error?.message || JSON.stringify(errorData);
        } catch (e) {
          errorDetail = 'OpenAI API returned an unreadable error response.';
        }
      } else {
        const text = await response.text();
        errorDetail = text.substring(0, 500);
      }
      console.error('[generate-legal-document] OpenAI API error:', errorDetail);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to generate document from AI' }) };
    }

    const data = await response.json();
    const generatedContent = data?.choices?.[0]?.message?.content;

    if (!generatedContent) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'No content generated' }) };
    }

    // Extract title from the generated content (first line or use default)
    const lines = generatedContent.split('\n').filter((line: string) => line.trim());
    let title = template.defaultTitle;

    // Try to extract title from first line if it looks like a title
    if (lines[0] && !lines[0].includes('EFFECTIVE DATE') && !lines[0].toLowerCase().startsWith('this')) {
      const potentialTitle = lines[0].replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
      if (potentialTitle.length < 100) {
        title = potentialTitle;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        content: generatedContent,
        title,
        documentId
      })
    };
  } catch (error) {
    console.error('[generate-legal-document] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate document'
      })
    };
  }
};

export { handler };
