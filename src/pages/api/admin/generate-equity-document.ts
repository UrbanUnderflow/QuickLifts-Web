import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RequestBody {
  stakeholderId?: string;
  stakeholderName?: string;
  stakeholderEmail?: string;
  stakeholderType?: 'founder' | 'employee' | 'advisor' | 'investor' | 'contractor';
  documentType: string;
  prompt?: string;
  requiresSignature?: boolean;
  boardApprovalDate?: string; // Date the Board approved this grant
  grantDetails?: {
    equityType: string;
    numberOfShares: number;
    strikePrice: number;
    vestingSchedule: string;
    vestingStartDate: string;
    cliffMonths: number;
    vestingMonths: number;
  };
}

const formatAdditionalContext = (prompt?: string) => {
  const trimmed = (prompt ?? '').trim();
  if (!trimmed) return '';
  return `\n\nADDITIONAL CONTEXT / INSTRUCTIONS:\n${trimmed}\n`;
};

const DOCUMENT_TEMPLATES = {
  option_agreement: {
    title: 'Stock Option Agreement',
    systemPrompt: `You are an expert corporate attorney specializing in startup equity compensation. Generate a professional Stock Option Agreement that is comprehensive yet clear.`,
    userPrompt: (data: RequestBody) => `Generate a Stock Option Agreement for:

COMPANY: Pulse Intelligence Labs, Inc., a Delaware corporation
OPTIONEE: ${data.stakeholderName}
EMAIL: ${data.stakeholderEmail}
ROLE TYPE: ${data.stakeholderType}
${data.grantDetails ? `
GRANT DETAILS:
- Option Type: ${data.grantDetails.equityType === 'iso' ? 'Incentive Stock Option (ISO)' : 'Non-Qualified Stock Option (NSO)'}
- Number of Shares: ${data.grantDetails.numberOfShares.toLocaleString()}
- Exercise Price per Share: $${data.grantDetails.strikePrice.toFixed(4)}
- Vesting Schedule: ${data.grantDetails.vestingSchedule}
- Vesting Start Date: ${data.grantDetails.vestingStartDate}
- Cliff Period: ${data.grantDetails.cliffMonths} months
- Total Vesting Period: ${data.grantDetails.vestingMonths} months
` : ''}
${formatAdditionalContext(data.prompt)}

Please include:
1. Grant of Option section
2. Exercise Price and Payment Terms
3. Vesting Schedule (detailed)
4. Term and Expiration
5. Method of Exercise
6. Non-Transferability provisions
7. Termination of Employment provisions
8. Tax Withholding requirements
9. No Rights as Stockholder until exercise
10. Governing Documents reference (EIP controls)
11. Entire Agreement clause
12. Signature blocks for both Company and Optionee

Use formal legal language but keep it readable. Include standard Delaware corporate law provisions.`,
  },

  board_consent: {
    title: 'Board Consent - Equity Grant Approval',
    systemPrompt: `You are an expert corporate attorney. Generate a formal Board Consent document (Written Consent of the Board of Directors in Lieu of Meeting) for approving equity grants at a Delaware corporation. 

CRITICAL REQUIREMENTS:
1. This is for a SOLE DIRECTOR company - Tremaine Grant is the SOLE member of the Board of Directors. Do NOT create signature blocks for multiple directors.
2. Reference DGCL §141(f) for written consent authority.
3. Include explicit Plan incorporation language.
4. Do NOT include a separate "FURTHER RESOLVED" for fair market value determination - establish FMV in the recitals only, not as a redundant resolution.

MANDATORY DATE REQUIREMENTS (CRITICAL - VERIFICATION WILL FAIL WITHOUT THESE):
- You MUST include the approval date in at least TWO places:
  1. In an effectiveness clause: "This Written Consent shall be effective as of [DATE]"
  2. In the signature block: "Date: [DATE]"
- You MUST also include a date in the recitals or header: "Dated as of [DATE]" or "Approved on [DATE]"
- The date format must be human-readable like "January 23, 2026" or "Jan 23, 2026"
- DO NOT use placeholders like [DATE], [CURRENT_DATE], or blank lines for dates
- DO NOT leave date fields empty or with underscores
- The approval date and signature date must be the SAME date and must be explicitly written out
- If you fail to include these dates, the document will fail verification`,
    userPrompt: (data: RequestBody) => {
      // Get current date in the format "January 23, 2026"
      const currentDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      return `Generate a Board Consent document (Written Consent of the Board of Directors in Lieu of Meeting) for:

COMPANY: Pulse Intelligence Labs, Inc., a Delaware corporation
GRANTEE: ${data.stakeholderName}
ROLE: ${data.stakeholderType}
APPROVAL DATE: ${currentDate}
${data.grantDetails ? `
GRANT TO APPROVE:
- Type: ${data.grantDetails.equityType === 'iso' ? 'Incentive Stock Option' : data.grantDetails.equityType === 'nso' ? 'Non-Qualified Stock Option' : data.grantDetails.equityType}
- Number of Shares: ${data.grantDetails.numberOfShares.toLocaleString()}
- Exercise Price (Fair Market Value per 409A): $${data.grantDetails.strikePrice.toFixed(4)}
- Vesting: ${data.grantDetails.vestingSchedule}
- Cliff: ${data.grantDetails.cliffMonths} months
- Total Vesting Period: ${data.grantDetails.vestingMonths} months
` : ''}
${formatAdditionalContext(data.prompt)}

DOCUMENT STRUCTURE REQUIREMENTS:

1. OPENING: Title as "WRITTEN CONSENT OF THE SOLE DIRECTOR OF PULSE INTELLIGENCE LABS, INC. IN LIEU OF MEETING"

2. AUTHORITY STATEMENT: "The undersigned, being the sole member of the Board of Directors of Pulse Intelligence Labs, Inc., a Delaware corporation (the "Company"), acting pursuant to Section 141(f) of the Delaware General Corporation Law, hereby adopts the following resolutions by written consent without a meeting:"

3. RECITALS (WHEREAS clauses):
   - Establish that the Company has adopted the Pulse Intelligence Labs, Inc. Equity Incentive Plan (the "Plan")
   - Identify the grantee and their role as ${data.stakeholderType}
   - State the Board has determined the fair market value of the Company's common stock to be $${data.grantDetails?.strikePrice?.toFixed(4) || '0.0010'} per share, determined in accordance with Section 409A of the Internal Revenue Code
   - Note that granting equity to ${data.stakeholderName} is in the best interest of the Company

4. RESOLUTIONS ("NOW, THEREFORE, BE IT RESOLVED"):
   - Resolution approving the grant of the ${data.grantDetails?.equityType === 'nso' ? 'Non-Qualified Stock Option' : data.grantDetails?.equityType === 'iso' ? 'Incentive Stock Option' : 'equity award'} to ${data.stakeholderName}
   - CRITICAL: Include this exact sentence in the grant resolution: "The Option is granted pursuant to, and subject in all respects to, the terms and conditions of the Pulse Intelligence Labs, Inc. Equity Incentive Plan (the 'Plan')."
   - Resolution authorizing officers to execute the Option Agreement and any related documents
   - Resolution ratifying prior actions taken in connection with this grant
   - Do NOT include a separate FMV resolution - the FMV is already established in the recitals

5. EFFECTIVENESS AND DATE (MANDATORY - VERIFICATION WILL FAIL WITHOUT THIS):
   - You MUST include this EXACT text with the date filled in: "This Written Consent shall be effective as of ${currentDate} and may be executed in counterparts."
   - You MUST also include one of these lines near the top (in header or first recital): "Dated as of ${currentDate}" OR "Approved on ${currentDate}" OR "Written Consent dated ${currentDate}"
   - CRITICAL: The date "${currentDate}" MUST be written out in full - DO NOT use placeholders, underscores, or leave blank

6. SIGNATURE BLOCK - CRITICAL FORMAT (SOLE DIRECTOR ONLY):
   Use this EXACT format - do NOT add multiple director signature lines:

   IN WITNESS WHEREOF, the undersigned, being the sole member of the Board of Directors of Pulse Intelligence Labs, Inc., has executed this Written Consent as of the date set forth below.

   ______________________________
   Tremaine Grant
   Sole Director

   Date: ${currentDate}
   
   MANDATORY DATE REQUIREMENTS (VERIFICATION WILL FAIL IF THESE ARE MISSING):
   - The signature block Date field MUST contain: "${currentDate}" - write it out in full
   - DO NOT use underscores, blank lines, or placeholders in the Date field
   - The date "${currentDate}" must appear in AT LEAST these three places:
     1. In the effectiveness clause: "effective as of ${currentDate}"
     2. In a header/recital: "Dated as of ${currentDate}" or "Approved on ${currentDate}"
     3. In the signature block: "Date: ${currentDate}"
   - All three dates must be the same: "${currentDate}"
   - Write the date in full text format like "January 23, 2026" - do not abbreviate
   - If any date is missing or left blank, the document verification will fail

EXAMPLE OF CORRECT DATE USAGE:
- Header: "Dated as of January 23, 2026"
- Effectiveness: "This Written Consent shall be effective as of January 23, 2026"
- Signature: "Date: January 23, 2026"

Make it formal and suitable for corporate records. This document will be investor-diligence ready.`;
    },
  },

  stockholder_consent: {
    title: 'Stockholder Consent',
    systemPrompt: `You are an expert corporate attorney. Generate a Stockholder Consent document for corporate actions requiring stockholder approval.`,
    userPrompt: (data: RequestBody) => `Generate a Written Consent of Stockholders for:

COMPANY: Pulse Intelligence Labs, Inc., a Delaware corporation

This consent is for ratifying equity grants and/or adopting/amending the Equity Incentive Plan.
${formatAdditionalContext(data.prompt)}

Please include:
1. Recitals establishing authority
2. Resolution to adopt/ratify the Equity Incentive Plan
3. Resolution to approve share reserve
4. Waiver of notice provisions
5. Effectiveness clause
6. Signature block with space for percentage of outstanding shares`,
  },

  fast_agreement: {
    title: 'FAST Agreement (Founder Advisor Standard Template)',
    systemPrompt: `You are an expert corporate attorney. Generate a FAST Agreement (Founder Advisor Standard Template) - a streamlined advisor equity agreement.`,
    userPrompt: (data: RequestBody) => `Generate a FAST Agreement (Founder Advisor Standard Template) for:

COMPANY: Pulse Intelligence Labs, Inc., a Delaware corporation
ADVISOR: ${data.stakeholderName}
EMAIL: ${data.stakeholderEmail}
${data.grantDetails ? `
EQUITY GRANT:
- Type: ${data.grantDetails.equityType === 'nso' ? 'Non-Qualified Stock Option' : data.grantDetails.equityType}
- Number of Shares/Options: ${data.grantDetails.numberOfShares.toLocaleString()}
- Vesting: ${data.grantDetails.vestingSchedule}
` : `
Standard FAST terms with typical advisor vesting (monthly over 24 months).
`}
${formatAdditionalContext(data.prompt)}

Please include:
1. Advisor Services description (strategic advice, introductions, industry expertise)
2. Equity Compensation terms
3. Vesting schedule
4. Confidentiality obligations
5. IP Assignment clause
6. Non-exclusive arrangement acknowledgment
7. Termination provisions
8. No employment relationship disclaimer
9. Governing law (Delaware)
10. Signature blocks

Keep it concise (FAST agreements are meant to be simple) but comprehensive.`,
  },

  advisor_nso_agreement: {
    title: 'Advisor Agreement and Non-Qualified Stock Option Grant',
    systemPrompt: `You are an expert corporate attorney specializing in startup equity compensation. Generate a combined Advisor Services Agreement and Non-Qualified Stock Option Grant document. This is a single agreement that combines advisor services terms with the actual NSO equity grant under the Company's Equity Incentive Plan. CRITICAL: Do NOT use the word "FAST" anywhere in the document. Do NOT reference "Founder Advisor Standard Template" or "Founder Institute" anywhere. This is a standard advisor services agreement with an NSO grant - not a FAST agreement.`,
    userPrompt: (data: RequestBody) => `Generate a combined Advisor Agreement and Non-Qualified Stock Option Grant for:

COMPANY: Pulse Intelligence Labs, Inc., a Delaware corporation
ADVISOR: ${data.stakeholderName}
EMAIL: ${data.stakeholderEmail}
GRANT DATE: ${data.grantDetails?.vestingStartDate || new Date().toISOString().split('T')[0]}

GRANT DETAILS:
- Option Type: Non-Qualified Stock Option (NSO)
- Number of Shares: ${data.grantDetails?.numberOfShares?.toLocaleString() || '10,000'}
- Exercise Price per Share: $${data.grantDetails?.strikePrice?.toFixed(4) || '0.0010'}
- Vesting Period: ${data.grantDetails?.vestingMonths || 24} months total
- Vesting Schedule: Monthly vesting after cliff
- Cliff Period: ${data.grantDetails?.cliffMonths || 3} months
- Option Term: 10 years from Grant Date
${data.boardApprovalDate ? `- Board Approval Date: ${data.boardApprovalDate}` : ''}

${formatAdditionalContext(data.prompt)}

Generate a SINGLE COMBINED AGREEMENT with these requirements. CRITICAL: Do NOT use the word "FAST" anywhere. Do NOT reference "Founder Institute" or "Founder Advisor Standard Template". This is a standard Advisor Services Agreement with an NSO grant:

SECTION 1 - ADVISOR SERVICES AGREEMENT:
1.1 Engagement - Company engages Advisor for non-exclusive advisory services on a non-exclusive basis
1.2 Services - Strategic guidance, introductions to investors/partners/customers, periodic advisory meetings. IMPORTANT: Add this sentence: "Nothing herein obligates the Company to request, or the Advisor to provide, any minimum number of hours or services."
1.3 No Employment Relationship - Independent contractor, not an employee/officer/director
1.4 Confidentiality - Keep non-public information confidential
1.5 Intellectual Property - Use this STRONGER language: "All inventions, ideas, improvements, works of authorship, feedback, and materials conceived or developed by the Advisor in connection with the services shall be the exclusive property of the Company. The Advisor hereby assigns all right, title, and interest in such intellectual property to the Company."
1.6 Term - May be terminated by either party at any time, with or without cause

SECTION 2 - GRANT OF NON-QUALIFIED STOCK OPTIONS:
2.1 Grant - NSO to purchase the specified shares pursuant to the Pulse Intelligence Labs, Inc. Equity Incentive Plan (the "Plan"). CRITICAL: Include this exact sentence: "This Option is granted pursuant to, and subject in all respects to, the terms and conditions of the Pulse Intelligence Labs, Inc. Equity Incentive Plan (the 'Plan'), which is hereby incorporated by reference."${data.boardApprovalDate ? ` CRITICAL: Also include this exact sentence: "The Option was approved by the Board of Directors pursuant to written consent dated ${data.boardApprovalDate}."` : ''}
2.2 Exercise Price - Fair market value as determined by the Board
2.3 Vesting Schedule - Use this EXACT vesting language (adapt months/values as needed): "The Option shall vest over ${data.grantDetails?.vestingMonths || 24} months, with no vesting until the completion of the first ${data.grantDetails?.cliffMonths || 3} months following the Grant Date. After the completion of the cliff, the remaining Option shall vest in equal monthly installments over the remainder of the vesting period."
2.4 Term of Option - 10 years from Grant Date
2.5 Termination of Service - Unvested options terminate. For advisors, set the post-termination exercise window to six (6) months for vested options (not 90 days). Include clear mechanics and any Plan override language.
2.6 No Stockholder Rights - Until Option is exercised

SECTION 3 - TAX MATTERS AND INVESTMENT RISK:
- Company makes no tax representations, Advisor responsible for own tax advice
- Add this investment risk acknowledgement: "The Advisor acknowledges that the Option involves investment risk and that there is no guarantee of liquidity or value. The Advisor has had an opportunity to consult with their own legal and financial advisors."

SECTION 4 - GENERAL PROVISIONS:
4.1 Governing Law - Delaware
4.2 Entire Agreement - This Agreement, together with the Plan, constitutes the entire agreement between the parties. CRITICAL: Include this sentence: "This Option is granted pursuant to, and subject in all respects to, the terms and conditions of the Pulse Intelligence Labs, Inc. Equity Incentive Plan (the 'Plan'), which is hereby incorporated by reference."
4.3 Amendment - Written agreement signed by both parties
4.4 Counterparts; Electronic Signature - May be executed electronically
4.5 Securities Law Compliance / Transfer Restrictions - Add a short clause acknowledging that the Option and any shares issued upon exercise have not been registered under the Securities Act of 1933 and may not be transferred except pursuant to an applicable exemption / applicable securities laws.

SECTION 5 - ACCEPTANCE (SIGNATURE BLOCKS):
Include signature blocks for:
- COMPANY: Pulse Intelligence Labs, Inc.
  - Signature line
  - Name: Tremaine Grant
  - Title: Founder & Sole Director
  - Date line

- ADVISOR:
  - Signature line
  - Name: ${data.stakeholderName}
  - Date line

Format this as a professional legal document ready for e-signature. Use clear section numbering. Do not use markdown - use plain text formatting only.`,
  },

  eip: {
    title: 'Equity Incentive Plan',
    systemPrompt: `You are an expert corporate attorney specializing in executive compensation and equity plans. Generate a comprehensive Equity Incentive Plan for a Delaware corporation.`,
    userPrompt: (data: RequestBody) => `Generate a comprehensive Equity Incentive Plan for:

COMPANY: Pulse Intelligence Labs, Inc., a Delaware corporation
${formatAdditionalContext(data.prompt)}

Please create a full Equity Incentive Plan that includes:

1. PURPOSE AND DEFINITIONS
   - Comprehensive definitions section
   - Purpose of the Plan

2. ADMINISTRATION
   - Board/Committee authority
   - Delegation provisions
   - Decisions binding

3. SHARES SUBJECT TO THE PLAN
   - Share reserve
   - Share counting rules
   - Adjustments for corporate events

4. ELIGIBILITY
   - Employees, Directors, Consultants
   - ISO limitations (employees only)

5. TYPES OF AWARDS
   - Stock Options (ISOs and NSOs)
   - Restricted Stock
   - RSUs
   - Stock Appreciation Rights
   - Other Stock-Based Awards

6. STOCK OPTIONS
   - Grant of Options
   - Exercise Price (not less than FMV)
   - Vesting and Exercisability
   - Term (10 years max)
   - Method of Exercise
   - Payment methods
   - ISO specific rules

7. RESTRICTED STOCK AND RSUs
   - Grant provisions
   - Vesting conditions
   - Settlement terms

8. TERMINATION OF SERVICE
   - Death/Disability
   - Voluntary termination
   - Termination for Cause
   - Post-termination exercise periods

9. CORPORATE TRANSACTIONS
   - Change in Control provisions
   - Acceleration options
   - Assumption/substitution

10. GENERAL PROVISIONS
    - Non-transferability
    - Tax withholding
    - No right to employment
    - Governing law (Delaware)
    - Amendment and termination
    - Effective date

Make it comprehensive and suitable for a venture-backed startup. Include standard 409A compliance language.`,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as RequestBody;
    const { documentType, stakeholderName } = body;

    const template = DOCUMENT_TEMPLATES[documentType as keyof typeof DOCUMENT_TEMPLATES];
    
    if (!template) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // For most documents we need a stakeholder (person-specific).
    // EIP is company-wide and intentionally does NOT require a stakeholder.
    if (documentType !== 'eip') {
      if (!body.stakeholderName || !body.stakeholderEmail || !body.stakeholderType) {
        return res.status(400).json({ error: 'Missing stakeholder details for this document type' });
      }
    }

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
            template.systemPrompt +
            `\n\nIMPORTANT: Generate the document in clean, professional format. Use proper section numbering.` +
            `\n${bulletFormattingRules}` +
            (body.requiresSignature
              ? `\n\nSIGNATURE REQUIREMENT:\nInclude a clear signature section at the end with signature blocks for BOTH parties (Company and Recipient), including printed name + title + date lines.`
              : `\n\nSIGNATURE REQUIREMENT:\nDo NOT include signature lines unless the document type inherently requires it.`),
        },
        {
          role: 'user',
          content: template.userPrompt(body),
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content generated');
    }

    // Generate title based on document type and stakeholder
    const title = documentType === 'eip' 
      ? `${template.title} - Pulse Intelligence Labs, Inc.`
      : `${template.title} - ${stakeholderName}`;

    return res.status(200).json({
      success: true,
      title,
      content,
      documentType,
    });
  } catch (error) {
    console.error('Error generating equity document:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate document',
    });
  }
}
