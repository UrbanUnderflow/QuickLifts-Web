import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { resolveOpenAIApiKey } from './utils/resolveOpenAIApiKey';

interface RequestBody {
  stakeholderId?: string;
  stakeholderName?: string;
  stakeholderEmail?: string;
  stakeholderType?: 'founder' | 'employee' | 'advisor' | 'investor' | 'contractor';
  stakeholderTitle?: string;
  documentType: string;
  prompt?: string;
  requiresSignature?: boolean;
  boardApprovalDate?: string;
  documentDate?: string;
  planShareReserve?: number;
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

const formatHumanDate = (value?: string) => {
  if (!value) return null;
  const parsed = parseDateLike(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const parseDateLike = (value?: string | null) => {
  if (!value) return null;

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, yearRaw, monthRaw, dayRaw] = dateOnlyMatch;
    const parsed = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw), 12, 0, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
};

const formatDatePlusYears = (value: string | null, years: number) => {
  const parsed = parseDateLike(value);
  if (!parsed) return null;

  const resolved = new Date(parsed);
  resolved.setFullYear(resolved.getFullYear() + years);

  return resolved.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getGrantDate = (data: RequestBody) => {
  return data.boardApprovalDate || formatHumanDate(data.grantDetails?.vestingStartDate) || formatHumanDate(new Date().toISOString());
};

const getVestingCommencementDate = (data: RequestBody) => {
  // Service-based vesting may start before the Board formally approves a grant.
  // Keep that date distinct; never backdate the legal Grant Date.
  return formatHumanDate(data.grantDetails?.vestingStartDate) || data.boardApprovalDate || getGrantDate(data);
};

const getValuationDate = (data: RequestBody) =>
  formatHumanDate(data.grantDetails?.valuationDate) || data.boardApprovalDate || getGrantDate(data);

const formatPerSharePrice = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
};

const getOptionExpirationDate = (data: RequestBody) => {
  return formatDatePlusYears(getGrantDate(data), 10) || 'the tenth anniversary of the Grant Date';
};

const getCurrentHumanDate = () =>
  new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const getDocumentDate = (data: RequestBody) => {
  return data.documentDate || data.boardApprovalDate || getCurrentHumanDate();
};

const getVestingInstructionBlock = (
  grantDetails?: RequestBody['grantDetails'],
  vestingCommencementDate?: string
) => {
  const numberOfShares = Math.max(0, grantDetails?.numberOfShares || 0);
  const vestingMonths = Math.max(1, grantDetails?.vestingMonths || 24);
  const cliffMonths = Math.max(0, Math.min(grantDetails?.cliffMonths || 0, vestingMonths));
  const vestingStartDate = vestingCommencementDate || formatHumanDate(grantDetails?.vestingStartDate) || 'the Vesting Commencement Date';

  if (!numberOfShares) {
    return `- State the vesting mechanics clearly, including cliff treatment, monthly vesting cadence, and how any rounding remainder is handled on the final vesting date.`;
  }

  const perMonthInstallment = numberOfShares / vestingMonths;
  const cliffShares = Math.round(perMonthInstallment * cliffMonths);
  const remainingMonths = Math.max(vestingMonths - cliffMonths, 0);
  const remainingShares = numberOfShares - cliffShares;
  const monthlyPostCliff = remainingMonths > 0 ? Math.floor(remainingShares / remainingMonths) : 0;
  const finalInstallment = remainingMonths > 0
    ? remainingShares - (monthlyPostCliff * Math.max(remainingMonths - 1, 0))
    : remainingShares;

  if (cliffMonths === 0) {
    const monthlyInstallment = Math.floor(numberOfShares / vestingMonths);
    const finalMonthlyInstallment = numberOfShares - (monthlyInstallment * Math.max(vestingMonths - 1, 0));
    return [
      `- Vesting Commencement Date: ${vestingStartDate}`,
      `- State the vesting schedule explicitly as ${numberOfShares.toLocaleString()} option shares vesting in ${vestingMonths} monthly installments beginning on the Vesting Commencement Date.`,
      `- Use exact numbers: ${monthlyInstallment.toLocaleString()} shares vest on each monthly vesting date for the first ${Math.max(vestingMonths - 1, 0)} month(s), and ${finalMonthlyInstallment.toLocaleString()} shares vest on the final vesting date.`,
      `- If you describe the schedule in prose, make clear there is no cliff.`,
    ].join('\n');
  }

  return [
    `- Vesting Commencement Date: ${vestingStartDate}`,
    `- State the vesting schedule explicitly, not directionally. Do not say only "monthly vesting after cliff."`,
    `- Use exact numbers: ${cliffShares.toLocaleString()} shares vest on the ${cliffMonths}-month cliff date, representing the first ${cliffMonths} monthly installments.`,
    remainingMonths > 0
      ? `- After the cliff, ${monthlyPostCliff.toLocaleString()} shares vest monthly for the next ${Math.max(remainingMonths - 1, 0)} month(s), and ${finalInstallment.toLocaleString()} shares vest on the final vesting date so that the total vested equals ${numberOfShares.toLocaleString()} shares over ${vestingMonths} months.`
      : `- All ${numberOfShares.toLocaleString()} shares vest on the cliff date because the cliff equals the full vesting period.`,
    `- Make clear that the Grant Date / Board Approval Date and the Vesting Commencement Date may be the same, but if both are shown they must be labeled distinctly and consistently.`,
  ].join('\n');
};

const getEarlyExerciseInstructionBlock = (data: RequestBody) => {
  if (!data.grantDetails?.earlyExerciseAllowed) {
    return `- Early exercise is not permitted. The Advisor may exercise only vested portions of the Option.
- State that an 83(b) election is not triggered merely by the grant of this ordinary NSO. Do not attach an 83(b) form to a grant that does not transfer substantially nonvested shares.`;
  }

  return `- Early exercise is permitted only under the express mechanics in this Agreement.
- Shares acquired before vesting remain subject to the same vesting schedule and to a Company repurchase right at the Advisor's original exercise price upon cessation of service, subject to applicable law and the Plan.
- Include an 83(b) NOTICE (not tax advice) explaining that if the Advisor exercises for substantially nonvested shares, an election may be available and generally must be filed with the IRS no later than 30 days after the shares are transferred.
- Include a clearly labeled Section 83(b) notice directing the Advisor to the then-current official IRS Form 15620 (or other IRS-accepted written statement). Do not invent or prefill a substitute tax form. State that the Company does not file the election for the Advisor and that the Advisor must consult personal tax counsel.
- Do not say an 83(b) election is due on the Option Grant Date; the relevant transfer, if any, occurs when unvested shares are acquired on exercise.`;
};

const getAdvisorServiceScope = (data: RequestBody) => {
  const normalizedName = (data.stakeholderName || '').trim().toLowerCase();

  if (normalizedName === 'valerie alexander') {
    return 'Enterprise strategy, organizational planning, go-to-market positioning, executive coaching, and bona fide commercial partnership strategy. Excludes legal representation, fundraising, investor solicitation, securities placement, and securities-market promotion.';
  }

  if (normalizedName === 'marques zak') {
    return 'Marketing and brand strategy, athletic-conference market insight, customer positioning, and bona fide institutional partnership strategy. Excludes fundraising, investor solicitation, securities placement, and securities-market promotion.';
  }

  return `Strategic guidance relevant to the Advisor's role as ${data.stakeholderTitle || 'Strategic Advisor'}, product/market advice, industry expertise, and bona fide commercial partnership strategy. Excludes fundraising, investor solicitation, securities placement, and securities-market promotion.`;
};

const formatAdditionalContext = (prompt?: string) => {
  const trimmed = (prompt ?? '').trim();
  if (!trimmed) return '';
  return `\n\nADDITIONAL CONTEXT / INSTRUCTIONS:\n${trimmed}\n`;
};

const normalizeBoardConsentResolutionNumbering = (content: string) => {
  let sawGrantApprovalHeading = false;

  return content
    .split('\n')
    .map((line) => {
      if (/^\s*(?:#{1,6}\s*)?1[\.)]\s+Approval of .*Grant\s*$/i.test(line)) {
        sawGrantApprovalHeading = true;
        return line;
      }

      if (sawGrantApprovalHeading && /^\s*(?:#{1,6}\s*)?1[\.)]\s+Authorization to Execute Documents\s*$/i.test(line)) {
        return line.replace(/^(\s*(?:#{1,6}\s*)?)1([\.)])/, (_match, prefix, punctuation) => `${prefix}2${punctuation}`);
      }

      return line;
    })
    .join('\n');
};

const normalizeAdvisorAgreementOptionExpiration = (content: string, data: RequestBody) => {
  const optionExpirationDate = getOptionExpirationDate(data);
  if (optionExpirationDate === 'the tenth anniversary of the Grant Date') return content;

  const explicitExpirationSentence =
    `The Option shall expire ten (10) years from the Grant Date, on ${optionExpirationDate}, unless earlier terminated pursuant to the Plan or this Agreement.`;

  return content
    .replace(
      /The Option shall expire (?:ten\s*\(10\)|10) years from (?:the )?Grant Date(?:,?\s*which is [^.]+)?\./gi,
      explicitExpirationSentence
    )
    .replace(
      /The Option shall expire on the tenth anniversary of (?:the )?Grant Date\./gi,
      explicitExpirationSentence
    );
};

const insertBeforeSignatureSection = (content: string, addition: string) => {
  const trimmedAddition = addition.trim();
  if (!trimmedAddition) return content;

  const signaturePatterns = [
    /\n#{1,6}\s*(?:SECTION\s*)?5\b[^\n]*(?:ACCEPTANCE|SIGNATURE)/i,
    /\nSECTION\s+5\b[^\n]*(?:ACCEPTANCE|SIGNATURE)/i,
    /\nIN WITNESS WHEREOF\b/i,
    /\nSIGNATURES?\b/i,
  ];

  for (const pattern of signaturePatterns) {
    const match = content.match(pattern);
    if (match?.index) {
      return `${content.slice(0, match.index).trimEnd()}\n\n${trimmedAddition}\n${content.slice(match.index)}`;
    }
  }

  return `${content.trimEnd()}\n\n${trimmedAddition}\n`;
};

const removeUnsupportedSecuritiesServices = (content: string) =>
  content
    .replace(/introductions to investors,\s*partners,\s*and customers/gi, 'commercial partnership strategy, customer context, and partner context')
    .replace(/investor introductions/gi, 'commercial partnership strategy')
    .replace(/introductions to investors/gi, 'commercial partnership strategy')
    .replace(/fundraising introductions/gi, 'commercial partnership strategy');

const normalizeUnsupported409AClaims = (content: string) =>
  content
    .replace(/determined in accordance with Section 409A/gi, 'determined in good faith after considering the supporting valuation materials in the corporate records')
    .replace(/in accordance with Section 409A/gi, 'after considering the supporting valuation materials in the corporate records')
    .replace(/pursuant to Section 409A/gi, 'after considering the supporting valuation materials in the corporate records');

const ensureAdvisorAgreementSafeguards = (content: string, data: RequestBody) => {
  let result = normalizeAdvisorAgreementOptionExpiration(
    normalizeUnsupported409AClaims(removeUnsupportedSecuritiesServices(content)),
    data,
  );
  const lower = result.toLowerCase();
  const additions: string[] = [];

  if (!lower.includes('services in connection with the offer or sale of securities') || !lower.includes('promote or maintain a market')) {
    additions.push(
      `The services compensated by this Option are bona fide advisory services and do not include services in connection with the offer or sale of securities in a capital-raising transaction or services that directly or indirectly promote or maintain a market for the Company's securities.`,
    );
  }

  if (!lower.includes('corporate par value is legally distinct from fair market value')) {
    additions.push(
      `Corporate par value is legally distinct from fair market value and is not being used as the exercise price. The exercise price is not less than the Board-determined fair market value on the Grant Date.`,
    );
  }

  if (!lower.includes('fair market value determination date')) {
    additions.push(`The Fair Market Value Determination Date is ${getValuationDate(data)}.`);
  }

  if (!lower.includes('formal section 409a appraisal')) {
    additions.push(
      `The Company is not representing in this Agreement that a formal Section 409A appraisal exists unless that appraisal is separately identified in the Company's corporate records.`,
    );
  }

  if (data.grantDetails?.earlyExerciseAllowed) {
    if (!lower.includes('form 15620') || !lower.includes('30 days after the shares are transferred') || !lower.includes('repurchase right')) {
      additions.push(
        `Early exercise is permitted only under the express mechanics in this Agreement. Shares acquired before vesting remain subject to the same vesting schedule and to a Company repurchase right at the Advisor's original exercise price upon cessation of service, subject to applicable law and the Plan. If the Advisor exercises for substantially nonvested shares, an 83(b) election may be available and generally must be filed with the IRS no later than 30 days after the shares are transferred using the then-current official IRS Form 15620 or other IRS-accepted written statement. The Company does not file the election for the Advisor.`,
      );
    }
  } else if (!lower.includes('early exercise is not permitted') || !lower.includes('83(b) election is not triggered merely by the grant')) {
    additions.push(
      `Early exercise is not permitted. The Advisor may exercise only vested portions of the Option. An 83(b) election is not triggered merely by the grant of this ordinary NSO because no substantially nonvested shares are transferred by the grant itself.`,
    );
  }

  if (!lower.includes('grant date') || !lower.includes('vesting commencement date')) {
    additions.push(
      `For clarity, the Grant Date / Board Approval Date is ${getGrantDate(data)} and the separate Vesting Commencement Date is ${getVestingCommencementDate(data)}.`,
    );
  }

  if (!lower.includes('grant, exercise, and any later transfer or sale')) {
    additions.push(
      `Tax timing for an NSO can differ at grant, exercise, and any later transfer or sale of shares. The Advisor is responsible for consulting personal tax counsel.`,
    );
  }

  if (!lower.includes('six (6) months') && !lower.includes('six months')) {
    additions.push(
      `For advisors, vested options remain exercisable for six (6) months after cessation of service, subject to earlier expiration under the Plan and this Agreement.`,
    );
  }

  if (additions.length) {
    result = insertBeforeSignatureSection(
      result,
      `## Advisor Option Compliance Terms\n${additions.map(item => `- ${item}`).join('\n')}`,
    );
  }

  return result;
};

const ensureBoardConsentSafeguards = (content: string, data: RequestBody) => {
  let result = normalizeBoardConsentResolutionNumbering(normalizeUnsupported409AClaims(content));
  const lower = result.toLowerCase();
  const additions: string[] = [];

  if (!lower.includes('fair market value determination date')) {
    additions.push(`The Fair Market Value Determination Date is ${getValuationDate(data)} for the Option.`);
  }

  if (!lower.includes('corporate par value') || !lower.includes('fair market value')) {
    additions.push(
      `Corporate par value is legally distinct from fair market value and is not being used as the Option exercise price.`,
    );
  }

  if (data.grantDetails) {
    const earlyExerciseText = data.grantDetails.earlyExerciseAllowed
      ? `Early exercise is permitted only if and as stated in the award agreement, with any unvested shares subject to Company repurchase rights and participant tax notices.`
      : `Early exercise is not permitted. The grantee may exercise only vested portions of the Option.`;
    if (!lower.includes('early exercise')) additions.push(earlyExerciseText);
  }

  if (!lower.includes('formal section 409a appraisal')) {
    additions.push(
      `The Board is not stating that a formal Section 409A appraisal exists unless such appraisal is separately identified in the Company's corporate records.`,
    );
  }

  if (additions.length) {
    result = insertBeforeSignatureSection(
      result,
      `## Additional Grant Determinations\n${additions.map(item => `- ${item}`).join('\n')}`,
    );
  }

  return result;
};

const ensureEipSafeguards = (content: string, data: RequestBody) => {
  let result = content
    .replace(/Valerie Alexander/gi, 'individual participant')
    .replace(/Marques Zak/gi, 'individual participant');
  const lower = result.toLowerCase();
  const additions: string[] = [];
  const reserve = (data.planShareReserve || 1_000_000).toLocaleString();

  if (!lower.includes('plan reserve is not itself an issuance or grant')) {
    additions.push(
      `The Plan reserve is not itself an issuance or grant. The Plan reserve of ${reserve} shares of Common Stock only sets the maximum available pool. Every award requires separate Board approval and an award agreement.`,
    );
  }

  if (!lower.includes('rule 701') || !lower.includes('capital-raising') || !lower.includes('promote or maintain a market')) {
    additions.push(
      `For reliance on Rule 701, consultant and advisor eligibility is limited to natural persons providing bona fide services that are not connected to a capital-raising securities transaction and do not directly or indirectly promote or maintain a market for Company securities.`,
    );
  }

  if (!lower.includes('administrator must confirm the applicable securities-law exemption')) {
    additions.push(
      `The Administrator must confirm the applicable securities-law exemption for every grant. Plan eligibility alone does not supply an exemption.`,
    );
  }

  if (!lower.includes('corporate par value is distinct from fair market value')) {
    additions.push(
      `Corporate par value is distinct from fair market value and must not be substituted for the Board-determined exercise price.`,
    );
  }

  if (!lower.includes('83(b) election is not triggered merely by the grant')) {
    additions.push(
      `Early exercise is permitted only when an individual award agreement expressly permits it. An 83(b) election is not triggered merely by the grant of an unexercised option. If unvested shares are acquired, participant notices should address the possible 30-day Section 83(b) deadline after transfer of substantially nonvested shares.`,
    );
  }

  if (additions.length) {
    result = insertBeforeSignatureSection(
      result,
      `## Plan Administration Safeguards\n${additions.map(item => `- ${item}`).join('\n')}`,
    );
  }

  return result;
};

const collectGeneratedContentIssues = (documentType: string, content: string, data: RequestBody) => {
  const lower = content.toLowerCase();
  const issues: string[] = [];

  if (documentType === 'advisor_nso_agreement') {
    if (/introductions to investors|investor introductions|fundraising introductions/i.test(content)) {
      issues.push('Advisor services still include investor or fundraising introductions.');
    }
    if (!lower.includes('services in connection with the offer or sale of securities')) {
      issues.push('Advisor Rule 701 capital-raising service limitation is missing.');
    }
    if (!lower.includes('promote or maintain a market')) {
      issues.push('Advisor securities-market promotion limitation is missing.');
    }
    if (!lower.includes('corporate par value is legally distinct from fair market value')) {
      issues.push('Advisor FMV/par-value distinction is missing.');
    }
    if (data.grantDetails?.earlyExerciseAllowed) {
      if (!lower.includes('form 15620') || !lower.includes('30 days after the shares are transferred')) {
        issues.push('Early-exercise 83(b) notice is incomplete.');
      }
    } else if (!lower.includes('early exercise is not permitted') || !lower.includes('83(b) election is not triggered merely by the grant')) {
      issues.push('No-early-exercise and ordinary NSO 83(b) language is incomplete.');
    }
  }

  if (documentType === 'board_consent') {
    if (!lower.includes('fair market value determination date')) {
      issues.push('Board Consent FMV determination date is missing.');
    }
    if (!lower.includes('early exercise')) {
      issues.push('Board Consent early-exercise treatment is missing.');
    }
    if (/determined in accordance with section 409a|pursuant to section 409a/i.test(content)) {
      issues.push('Board Consent includes an unsupported Section 409A appraisal claim.');
    }
  }

  if (documentType === 'eip') {
    if (!lower.includes('plan reserve is not itself an issuance or grant')) {
      issues.push('EIP reserve/grant separation is missing.');
    }
    if (!lower.includes('rule 701') || !lower.includes('capital-raising') || !lower.includes('promote or maintain a market')) {
      issues.push('EIP Rule 701 advisor limits are missing.');
    }
    if (/valerie alexander|marques zak/i.test(content)) {
      issues.push('EIP names individual participants.');
    }
  }

  return issues;
};

const normalizeGeneratedContent = (documentType: string, content: string, data: RequestBody) => {
  if (documentType === 'board_consent') {
    return ensureBoardConsentSafeguards(content, data);
  }

  if (documentType === 'advisor_nso_agreement') {
    return ensureAdvisorAgreementSafeguards(content, data);
  }

  if (documentType === 'eip') {
    return ensureEipSafeguards(content, data);
  }

  return content;
};

const DOCUMENT_TEMPLATES: Record<string, { title: string; systemPrompt: string; userPrompt: (data: RequestBody) => string }> = {
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
5. This board consent should appear ALREADY EXECUTED by the sole director. Do NOT use blank signature lines, underscores, or placeholder signature fields.

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
      const currentDate = data.boardApprovalDate || getCurrentHumanDate();
      
      return `Generate a Board Consent document (Written Consent of the Board of Directors in Lieu of Meeting) for:

COMPANY: Pulse Intelligence Labs, Inc., a Delaware corporation
GRANTEE: ${data.stakeholderName}
ROLE: ${data.stakeholderType}
APPROVAL DATE: ${currentDate}
${data.grantDetails ? `
GRANT TO APPROVE:
- Type: ${data.grantDetails.equityType === 'iso' ? 'Incentive Stock Option' : data.grantDetails.equityType === 'nso' ? 'Non-Qualified Stock Option' : data.grantDetails.equityType}
- Number of Shares: ${data.grantDetails.numberOfShares.toLocaleString()}
- Exercise Price per Share: $${formatPerSharePrice(data.grantDetails.strikePrice) || '[MISSING - DO NOT APPROVE]'}
- Board-Determined Fair Market Value per Share: $${formatPerSharePrice(data.grantDetails.fairMarketValueAtGrant ?? data.grantDetails.strikePrice) || '[MISSING - DO NOT APPROVE]'}
- Fair Market Value Determination Date: ${getValuationDate(data)}
- Early Exercise: ${data.grantDetails.earlyExerciseAllowed ? 'Permitted, subject to the award agreement and Company repurchase right' : 'Not permitted'}
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
   - State that, after considering the supporting valuation materials in the corporate records, the Board determined in good faith that the fair market value of the Company's common stock was $${formatPerSharePrice(data.grantDetails?.fairMarketValueAtGrant ?? data.grantDetails?.strikePrice) || '[MISSING]'} per share as of ${getValuationDate(data)}
   - State that the exercise price is not less than the Board-determined fair market value on the Grant Date
   - Do NOT claim that a formal Section 409A appraisal exists unless the additional instructions explicitly say one exists
   - Do NOT use or describe the certificate-of-incorporation par value as fair market value or as the option exercise price
   - Note that granting equity to ${data.stakeholderName} is in the best interest of the Company

4. RESOLUTIONS ("NOW, THEREFORE, BE IT RESOLVED"):
   - Use exactly two numbered resolution headings, in this order:
     1. Approval of Non-Qualified Stock Option Grant
     2. Authorization to Execute Documents
   - Do NOT restart numbering. The authorization resolution must be numbered "2.", never "1."
   - Under heading 1, include a resolution approving the grant of the ${data.grantDetails?.equityType === 'nso' ? 'Non-Qualified Stock Option' : data.grantDetails?.equityType === 'iso' ? 'Incentive Stock Option' : 'equity award'} to ${data.stakeholderName}
   - CRITICAL: Include this exact sentence in the grant resolution: "The Option is granted pursuant to, and subject in all respects to, the terms and conditions of the Pulse Intelligence Labs, Inc. Equity Incentive Plan (the 'Plan')."
   - Under heading 2, include a resolution authorizing officers to execute the Option Agreement and any related documents
   - Do NOT say the Board is ratifying prior actions or approving the grant retroactively unless the prompt explicitly asks for ratification
   - Do NOT include a separate FMV resolution - the FMV is already established in the recitals
   ${getVestingInstructionBlock(data.grantDetails, currentDate)}

5. EFFECTIVENESS AND DATE (MANDATORY - VERIFICATION WILL FAIL WITHOUT THIS):
   - You MUST include this EXACT text with the date filled in: "This Written Consent shall be effective as of ${currentDate} and may be executed in counterparts."
   - You MUST also include one of these lines near the top (in header or first recital): "Dated as of ${currentDate}" OR "Approved on ${currentDate}" OR "Written Consent dated ${currentDate}"
   - CRITICAL: The date "${currentDate}" MUST be written out in full - DO NOT use placeholders, underscores, or leave blank

6. SIGNATURE BLOCK - CRITICAL FORMAT (SOLE DIRECTOR ONLY):
   Use this EXACT format - do NOT add multiple director signature lines and do NOT leave any blank signature line:

   IN WITNESS WHEREOF, the undersigned, being the sole member of the Board of Directors of Pulse Intelligence Labs, Inc., has executed this Written Consent as of the date set forth below.

   /s/ Tremaine Grant
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
   - The signature should appear already executed as "/s/ Tremaine Grant" and must not be left blank

EXAMPLE OF CORRECT DATE USAGE:
- Header: "Dated as of January 23, 2026"
- Effectiveness: "This Written Consent shall be effective as of January 23, 2026"
- Signature: "Date: January 23, 2026"

Make it formal and suitable for corporate records. This document will be investor-diligence ready.`;
    },
  },

  stockholder_consent: {
    title: 'Stockholder Consent',
    systemPrompt: `You are an expert corporate attorney. Generate a Stockholder Consent document for corporate actions requiring stockholder approval.

CRITICAL REQUIREMENTS:
1. This is for a SOLE STOCKHOLDER company context. Tremaine Grant is the sole holder of the Company's outstanding voting stock for purposes of this consent.
2. The document must appear ALREADY EXECUTED. Do NOT use blank signature lines, placeholders, or underscore fields.
3. Use the same execution date consistently in the header/recitals, effectiveness clause, and signature block.
4. The signature should appear already executed as "/s/ Tremaine Grant".`,
    userPrompt: (data: RequestBody) => {
      const currentDate = getDocumentDate(data);
      const stockholderName = data.stakeholderName || 'Tremaine Grant';

      return `Generate a Written Consent of Stockholders for:

COMPANY: Pulse Intelligence Labs, Inc., a Delaware corporation
SOLE STOCKHOLDER: ${stockholderName}
CONSENT DATE: ${currentDate}

This consent is for ratifying equity grants and/or adopting/amending the Equity Incentive Plan.
${formatAdditionalContext(data.prompt)}

Please include:
1. Title: "WRITTEN CONSENT OF THE SOLE STOCKHOLDER OF PULSE INTELLIGENCE LABS, INC. IN LIEU OF MEETING"
2. Recitals establishing authority and confirming that the undersigned is the sole holder of the Company's outstanding capital stock entitled to vote on these matters
3. Resolution to adopt/ratify the Equity Incentive Plan
4. Resolution to approve the share reserve and related equity actions
5. Waiver of notice provisions
6. Effectiveness clause using this exact date: ${currentDate}
7. Already-executed signature block showing ownership approval, not a blank e-sign section

MANDATORY DATE AND EXECUTION REQUIREMENTS:
- Include the date "${currentDate}" in the header or opening recital, in the effectiveness clause, and in the signature block
- Do NOT use a different approval/effective date anywhere else in the document
- Make clear this is a clean, finalized consent, not a draft awaiting signature

SIGNATURE BLOCK REQUIREMENTS:
Use an already-executed stockholder signature block in substantially this form, with no blanks:

/s/ Tremaine Grant
Tremaine Grant
Sole Stockholder
Holder of 100% of the outstanding voting shares

Date: ${currentDate}

Make it formal, diligence-ready, and internally consistent.`;
    },
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
ADVISOR ROLE: ${data.stakeholderTitle || 'Strategic Advisor'}
COMPENSABLE ADVISORY SERVICES: ${getAdvisorServiceScope(data)}
GRANT DATE: ${getGrantDate(data)}
VESTING COMMENCEMENT DATE: ${getVestingCommencementDate(data)}

GRANT DETAILS:
- Option Type: Non-Qualified Stock Option (NSO)
- Number of Shares: ${data.grantDetails?.numberOfShares?.toLocaleString() || '10,000'}
- Exercise Price per Share: $${formatPerSharePrice(data.grantDetails?.strikePrice) || '[MISSING - DO NOT ISSUE]'}
- Board-Determined Fair Market Value per Share: $${formatPerSharePrice(data.grantDetails?.fairMarketValueAtGrant ?? data.grantDetails?.strikePrice) || '[MISSING - DO NOT ISSUE]'}
- Fair Market Value Determination Date: ${getValuationDate(data)}
- Vesting Period: ${data.grantDetails?.vestingMonths || 24} months total
- Vesting Schedule: Monthly vesting after cliff
- Cliff Period: ${data.grantDetails?.cliffMonths || 3} months
- Option Term: 10 years from Grant Date
- Option Expiration Date: ${getOptionExpirationDate(data)}
- Early Exercise: ${data.grantDetails?.earlyExerciseAllowed ? 'Permitted, subject to repurchase and tax provisions' : 'Not permitted'}
${data.boardApprovalDate ? `- Board Approval Date: ${data.boardApprovalDate}` : ''}

${formatAdditionalContext(data.prompt)}

Generate a SINGLE COMBINED AGREEMENT with these requirements. CRITICAL: Do NOT use the word "FAST" anywhere. Do NOT reference "Founder Institute" or "Founder Advisor Standard Template". This is a standard Advisor Services Agreement with an NSO grant:

SECTION 1 - ADVISOR SERVICES AGREEMENT:
1.1 Engagement - Company engages Advisor for non-exclusive advisory services on a non-exclusive basis
1.2 Services - Use this role-specific scope: "${getAdvisorServiceScope(data)}" Also include periodic advisory meetings. Do not add fundraising, securities placement, investor solicitation, or promotion of a market for Company securities as compensable services. IMPORTANT: Add these sentences: "Nothing herein obligates the Company to request, or the Advisor to provide, any minimum number of hours or services." "The services compensated by this Option are bona fide advisory services and do not include services in connection with the offer or sale of securities in a capital-raising transaction or services that directly or indirectly promote or maintain a market for the Company's securities."
1.3 No Employment Relationship - Independent contractor, not an employee/officer/director
1.4 Confidentiality - Keep non-public information confidential
1.5 Intellectual Property - Use this STRONGER language: "All inventions, ideas, improvements, works of authorship, feedback, and materials conceived or developed by the Advisor in connection with the services shall be the exclusive property of the Company. The Advisor hereby assigns all right, title, and interest in such intellectual property to the Company."
1.6 Term - May be terminated by either party at any time, with or without cause

SECTION 2 - GRANT OF NON-QUALIFIED STOCK OPTIONS:
2.1 Grant - NSO to purchase the specified shares pursuant to the Pulse Intelligence Labs, Inc. Equity Incentive Plan (the "Plan"). CRITICAL: Include this exact sentence: "This Option is granted pursuant to, and subject in all respects to, the terms and conditions of the Pulse Intelligence Labs, Inc. Equity Incentive Plan (the 'Plan'), which is hereby incorporated by reference."${data.boardApprovalDate ? ` CRITICAL: Also include this exact sentence: "The Option was approved by the Board of Directors pursuant to written consent dated ${data.boardApprovalDate}."` : ''}
2.1A Date Treatment - The legal Grant Date / Board Approval Date must be ${getGrantDate(data)}. The separate Vesting Commencement Date must be ${getVestingCommencementDate(data)}. Do not backdate the Grant Date. If the two dates differ, label them distinctly and do not rewrite one to match the other.
2.2 Exercise Price - Fair market value as determined by the Board
   - State that the exercise price is not less than the Board-determined fair market value on the Grant Date
   - State that corporate par value is legally distinct from fair market value and is not being used as the exercise price
   - Do not claim that a formal Section 409A appraisal exists unless the additional instructions explicitly say one exists
2.3 Vesting Schedule
${getVestingInstructionBlock(data.grantDetails, getVestingCommencementDate(data))}
2.3A Early Exercise and Section 83(b)
${getEarlyExerciseInstructionBlock(data)}
2.4 Term of Option - Include this exact sentence: "The Option shall expire ten (10) years from the Grant Date, on ${getOptionExpirationDate(data)}, unless earlier terminated pursuant to the Plan or this Agreement." Do NOT say only that the Option expires 10 years from the Grant Date, and do NOT say the Grant Date itself is the expiration date.
2.5 Termination of Service - Unvested options terminate. For advisors, set the post-termination exercise window to six (6) months for vested options (not 90 days). Include clear mechanics and any Plan override language.
2.6 No Stockholder Rights - Until Option is exercised

SECTION 3 - TAX MATTERS AND INVESTMENT RISK:
- Company makes no tax representations, Advisor responsible for own tax advice
- Clearly distinguish the tax timing of an NSO grant, exercise, and any later transfer or sale of shares
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
    userPrompt: (data: RequestBody) => {
      const currentDate = getDocumentDate(data);

      return `Generate a comprehensive Equity Incentive Plan for:

COMPANY: Pulse Intelligence Labs, Inc., a Delaware corporation
PLAN EFFECTIVE DATE: ${currentDate}
PLAN SHARE RESERVE: ${(data.planShareReserve || 1_000_000).toLocaleString()} shares of Common Stock
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
   - Set the initial aggregate share reserve to exactly ${(data.planShareReserve || 1_000_000).toLocaleString()} shares of Common Stock
   - Share counting rules
   - Adjustments for corporate events
   - State that the Plan reserve is not itself an issuance or grant; every award requires separate Board approval and an award agreement

4. ELIGIBILITY
   - Employees, Directors, Consultants, and Advisors
   - Make clear that advisors are expressly eligible service providers under the Plan and are not left to implication
   - ISO limitations (employees only)
   - For reliance on Rule 701, limit consultant/advisor eligibility to natural persons providing bona fide services that are not connected to a capital-raising securities transaction and do not directly or indirectly promote or maintain a market for Company securities
   - State that the Administrator must confirm the applicable securities-law exemption for every grant; do not imply that Plan eligibility alone supplies an exemption
   - Do not name Valerie Alexander, Marques Zak, or any individual participant in the company-wide Plan

5. TYPES OF AWARDS
   - Stock Options (ISOs and NSOs)
   - Restricted Stock
   - RSUs
   - Stock Appreciation Rights
   - Other Stock-Based Awards

6. STOCK OPTIONS
   - Grant of Options
   - Exercise Price (not less than FMV)
   - Make clear that corporate par value is distinct from fair market value and must not be substituted for the Board-determined exercise price
   - Vesting and Exercisability
   - Term (10 years max)
   - Method of Exercise
   - Payment methods
   - ISO specific rules
   - Early exercise only when an individual award agreement expressly permits it; require Company repurchase rights for unvested shares and a participant tax notice addressing the possible 30-day Section 83(b) deadline after transfer of substantially nonvested shares
   - State that an 83(b) election is not triggered merely by the grant of an unexercised option

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
    - Effective date, which must be stated as ${currentDate}

11. ADOPTION FOOTER
    - Add a short final adoption section confirming the Plan was adopted and approved effective as of ${currentDate}
    - Show it as already executed by the sole company approver, not pending signature
    - Use this exact executed signature format:
      /s/ Tremaine Grant
      Tremaine Grant
      Founder & Sole Director
      Sole Stockholder
      Date: ${currentDate}
    - State that individual grants remain ineffective until separately approved by the Board and documented in an award agreement
    - State that any ISO provisions are subject to timely stockholder approval as required by applicable tax law

Make it comprehensive and suitable for a venture-backed startup. Include standard 409A compliance language. Do not leave blank signature lines or placeholder dates.`;
    },
  },
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
    const body = JSON.parse(event.body || '{}') as RequestBody;
    const { documentType, stakeholderName } = body;
    const openaiApiKey = resolveOpenAIApiKey();

    if (!openaiApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured. Set OPENAI_API_KEY or OPEN_AI_SECRET_KEY.' }),
      };
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const template = DOCUMENT_TEMPLATES[documentType];
    
    if (!template) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid document type' }) };
    }

    // For most documents we need a stakeholder (person-specific).
    // EIP is company-wide and intentionally does NOT require a stakeholder.
    if (documentType !== 'eip') {
      if (!body.stakeholderName || !body.stakeholderEmail || !body.stakeholderType) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing stakeholder details for this document type' }) };
      }
    }

    if (documentType === 'advisor_nso_agreement' || (documentType === 'board_consent' && body.stakeholderType === 'advisor')) {
      const strikePrice = body.grantDetails?.strikePrice;
      if (!body.grantDetails?.numberOfShares || !strikePrice || strikePrice <= 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Advisor option documents require a positive option count and Board-determined exercise price. Corporate par value cannot be used as a default.',
          }),
        };
      }
      if (!body.grantDetails.valuationDate) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Advisor option documents require a fair-market-value determination date.' }),
        };
      }
    }

    if (documentType === 'eip' && (!body.planShareReserve || body.planShareReserve <= 0)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'The Equity Incentive Plan requires a positive, explicit share reserve.' }),
      };
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

    const rawContent = completion.choices[0]?.message?.content;

    if (!rawContent) {
      throw new Error('No content generated');
    }

    const content = normalizeGeneratedContent(documentType, rawContent, body);
    const contentIssues = collectGeneratedContentIssues(documentType, content, body);
    if (contentIssues.length) {
      throw new Error(`Generated document failed advisor equity safeguards: ${contentIssues.join(' ')}`);
    }

    // Generate title based on document type and stakeholder
    const title = documentType === 'eip' 
      ? `${template.title} - Pulse Intelligence Labs, Inc.`
      : `${template.title} - ${stakeholderName}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, title, content, documentType }),
    };
  } catch (error) {
    console.error('Error generating equity document:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate document' }),
    };
  }
};

const __test = {
  DOCUMENT_TEMPLATES,
  getGrantDate,
  getVestingCommencementDate,
  getEarlyExerciseInstructionBlock,
  getAdvisorServiceScope,
  normalizeGeneratedContent,
  collectGeneratedContentIssues,
};

export { handler, __test };
