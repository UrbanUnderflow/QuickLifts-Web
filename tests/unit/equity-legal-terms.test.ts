import test from 'node:test';
import assert from 'node:assert/strict';

import { __test } from '../../netlify/functions/generate-equity-document';
import { getManagedAdvisorEquityProfile } from '../../src/lib/equityAdvisorProfiles';

const advisorGrant = {
  stakeholderName: 'Valerie Alexander',
  stakeholderEmail: 'advisor@example.com',
  stakeholderType: 'advisor' as const,
  stakeholderTitle: 'Strategic Advisor',
  documentType: 'advisor_nso_agreement',
  boardApprovalDate: 'August 2, 2026',
  grantDetails: {
    equityType: 'nso',
    numberOfShares: 10_000,
    strikePrice: 0.05,
    fairMarketValueAtGrant: 0.05,
    valuationDate: '2026-08-02',
    earlyExerciseAllowed: false,
    vestingSchedule: 'monthly',
    vestingStartDate: '2026-01-15',
    cliffMonths: 3,
    vestingMonths: 24,
  },
};

test('Valerie and Marques are each managed as 25,000-option advisor grants', () => {
  assert.equal(getManagedAdvisorEquityProfile('Valerie Alexander')?.numberOfOptions, 25_000);
  assert.equal(getManagedAdvisorEquityProfile('  marques   ZAK ')?.numberOfOptions, 25_000);
  assert.equal(getManagedAdvisorEquityProfile('Valerie Alexander')?.fallbackExercisePrice, 0.05);
  assert.equal(getManagedAdvisorEquityProfile('Marques Zak')?.fallbackExercisePrice, 0.05);
  assert.equal(getManagedAdvisorEquityProfile('Another Advisor'), null);
});

test('advisor documents keep the Board grant date separate from vesting commencement', () => {
  assert.equal(__test.getGrantDate(advisorGrant), 'August 2, 2026');
  assert.equal(__test.getVestingCommencementDate(advisorGrant), 'January 15, 2026');

  const prompt = __test.DOCUMENT_TEMPLATES.advisor_nso_agreement.userPrompt(advisorGrant);
  assert.match(prompt, /GRANT DATE: August 2, 2026/);
  assert.match(prompt, /VESTING COMMENCEMENT DATE: January 15, 2026/);
  assert.match(prompt, /do not backdate the Grant Date/i);
});

test('advisor documents explain when valuation materials predate the grant date', () => {
  const revisedGrant = {
    ...advisorGrant,
    boardApprovalDate: 'August 6, 2026',
    grantDetails: {
      ...advisorGrant.grantDetails,
      valuationDate: '2026-04-19',
    },
  };

  const prompt = __test.DOCUMENT_TEMPLATES.advisor_nso_agreement.userPrompt(revisedGrant);

  assert.match(prompt, /GRANT DATE: August 6, 2026/);
  assert.match(prompt, /Fair Market Value Determination Date: April 19, 2026/);
  assert.match(prompt, /Board reviewed the valuation materials dated April 19, 2026/i);
  assert.match(prompt, /as of the Grant Date, August 6, 2026/i);
});

test('managed advisor request normalization repairs stale par-value-like option pricing', () => {
  const normalized = __test.normalizeManagedAdvisorRequestBody({
    ...advisorGrant,
    boardApprovalDate: 'August 6, 2026',
    grantDetails: {
      ...advisorGrant.grantDetails,
      numberOfShares: 10_000,
      strikePrice: 0.001,
      fairMarketValueAtGrant: 0.001,
      valuationDate: '2026-04-19',
    },
  });

  assert.equal(normalized.grantDetails?.numberOfShares, 25_000);
  assert.equal(normalized.grantDetails?.strikePrice, 0.05);
  assert.equal(normalized.grantDetails?.fairMarketValueAtGrant, 0.05);

  const prompt = __test.DOCUMENT_TEMPLATES.board_consent.userPrompt(normalized);
  assert.match(prompt, /Number of Shares: 25,000/);
  assert.match(prompt, /Exercise Price per Share: \$0\.05/);
  assert.match(prompt, /Board-Determined Fair Market Value per Share: \$0\.05/);
  assert.doesNotMatch(prompt, /\$0\.001/);
});

test('advisor NSO prompt separates FMV from par value and limits Rule 701 services', () => {
  const prompt = __test.DOCUMENT_TEMPLATES.advisor_nso_agreement.userPrompt(advisorGrant);

  assert.match(prompt, /Board-Determined Fair Market Value per Share: \$0\.05/);
  assert.match(prompt, /corporate par value is legally distinct from fair market value/i);
  assert.match(prompt, /do not include services in connection with the offer or sale of securities/i);
  assert.match(prompt, /83\(b\) election is not triggered merely by the grant/i);
  assert.doesNotMatch(prompt, /official IRS Form 15620/);
});

test('Valerie and Marques receive role-specific, non-fundraising service scopes', () => {
  assert.match(__test.getAdvisorServiceScope(advisorGrant), /Enterprise strategy, organizational planning/);
  assert.match(__test.getAdvisorServiceScope(advisorGrant), /Excludes legal representation, fundraising/);

  const marquesScope = __test.getAdvisorServiceScope({
    ...advisorGrant,
    stakeholderName: 'Marques Zak',
  });
  assert.match(marquesScope, /Marketing and brand strategy, athletic-conference market insight/);
  assert.match(marquesScope, /Excludes fundraising, investor solicitation/);
});

test('83(b) notice is conditional on early exercise of unvested shares', () => {
  const prompt = __test.DOCUMENT_TEMPLATES.advisor_nso_agreement.userPrompt({
    ...advisorGrant,
    grantDetails: {
      ...advisorGrant.grantDetails,
      earlyExerciseAllowed: true,
    },
  });

  assert.match(prompt, /official IRS Form 15620/);
  assert.match(prompt, /Do not invent or prefill a substitute tax form/);
  assert.match(prompt, /no later than 30 days after the shares are transferred/i);
  assert.match(prompt, /Do not say an 83\(b\) election is due on the Option Grant Date/i);
});

test('EIP uses the explicit reserve and does not itself grant advisor equity', () => {
  const prompt = __test.DOCUMENT_TEMPLATES.eip.userPrompt({
    documentType: 'eip',
    documentDate: 'August 2, 2026',
    planShareReserve: 1_000_000,
  });

  assert.match(prompt, /PLAN SHARE RESERVE: 1,000,000 shares/);
  assert.match(prompt, /Plan reserve is not itself an issuance or grant/i);
  assert.match(prompt, /every award requires separate Board approval and an award agreement/i);
  assert.match(prompt, /Do not name Valerie Alexander, Marques Zak, or any individual participant/i);
});

test('advisor agreement normalization repairs stale investor-introduction language', () => {
  const staleContent = `
Advisor Services
The Advisor will provide strategic guidance, introductions to investors, partners, and customers, and periodic meetings.

Section 5 - Acceptance
Company:
Advisor:
`;

  const normalized = __test.normalizeGeneratedContent('advisor_nso_agreement', staleContent, advisorGrant);
  const issues = __test.collectGeneratedContentIssues('advisor_nso_agreement', normalized, advisorGrant);

  assert.doesNotMatch(normalized, /introductions to investors/i);
  assert.match(normalized, /services in connection with the offer or sale of securities/i);
  assert.match(normalized, /corporate par value is legally distinct from fair market value/i);
  assert.match(normalized, /Early exercise is not permitted/i);
  assert.match(normalized, /83\(b\) election is not triggered merely by the grant/i);
  assert.deepEqual(issues, []);
});

test('advisor agreement normalization places added option compliance terms in the grant section', () => {
  const revisedGrant = {
    ...advisorGrant,
    boardApprovalDate: 'August 6, 2026',
    grantDetails: {
      ...advisorGrant.grantDetails,
      valuationDate: '2026-04-19',
    },
  };
  const staleContent = `
SECTION 1 - ADVISOR SERVICES AGREEMENT
The Advisor will provide strategic guidance and commercial partnership strategy.

SECTION 2 - GRANT OF NON-QUALIFIED STOCK OPTIONS
2.1 Grant
This Option is granted pursuant to the Plan.

2.2 Exercise Price
The exercise price is $0.05 per share.

2.3 Vesting Schedule
The options vest monthly.

SECTION 5 - ACCEPTANCE
Company:
Advisor:
`;

  const normalized = __test.normalizeGeneratedContent('advisor_nso_agreement', staleContent, revisedGrant);
  const issues = __test.collectGeneratedContentIssues('advisor_nso_agreement', normalized, revisedGrant);
  const complianceIndex = normalized.indexOf('2.2A Additional Option Compliance Terms');
  const vestingIndex = normalized.indexOf('2.3 Vesting Schedule');

  assert.notEqual(complianceIndex, -1);
  assert.notEqual(vestingIndex, -1);
  assert.ok(complianceIndex < vestingIndex);
  assert.match(normalized, /Fair Market Value Determination Date \/ valuation materials date is April 19, 2026/i);
  assert.match(normalized, /Grant Date, August 6, 2026/i);
  assert.doesNotMatch(normalized, /Advisor Option Compliance Terms/i);
  assert.deepEqual(issues, []);
});

test('advisor agreement normalization replaces a truncated final section with complete general provisions and signatures', () => {
  const truncatedContent = `
SECTION 1 - ADVISOR SERVICES AGREEMENT
The services compensated by this Option are bona fide advisory services and do not include services in connection with the offer or sale of securities in a capital-raising transaction or services that directly or indirectly promote or maintain a market for the Company's securities.

SECTION 2 - GRANT OF NON-QUALIFIED STOCK OPTIONS
2.1 Grant
This Option is granted pursuant to, and subject in all respects to, the terms and conditions of the Pulse Intelligence Labs, Inc. Equity Incentive Plan (the 'Plan'), which is hereby incorporated by reference.

2.2 Exercise Price
Corporate par value is legally distinct from fair market value and is not being used as the exercise price.

2.3A Early Exercise and Section 83(b)
Early exercise is not permitted. The Advisor may exercise only vested portions of the Option.
An 83(b) election is not triggered merely by the grant of this ordinary NSO.

SECTION 3 - TAX MATTERS AND INVESTMENT RISK
The Company makes no tax representations, and the Advisor is responsible for obtaining their own tax advice.
The tax timing of an NSO grant, exercise, and any later transfer or sale of shares is distinct and should be considered by the
`;

  const normalized = __test.normalizeGeneratedContent('advisor_nso_agreement', truncatedContent, advisorGrant);
  const issues = __test.collectGeneratedContentIssues('advisor_nso_agreement', normalized, advisorGrant);

  assert.match(normalized, /SECTION 3 - TAX MATTERS AND INVESTMENT RISK/);
  assert.match(normalized, /should be considered by the Advisor with the Advisor's own tax, legal, and financial advisors/i);
  assert.match(normalized, /SECTION 4 - GENERAL PROVISIONS/);
  assert.match(normalized, /SECTION 5 - ACCEPTANCE/);
  assert.match(normalized, /Name: Tremaine Grant/);
  assert.match(normalized, /Title: Founder & Sole Director/);
  assert.match(normalized, /Name: Valerie Alexander/);
  assert.doesNotMatch(normalized, /considered by the\s*$/i);
  assert.deepEqual(issues, []);
});

test('advisor agreement issue collection rejects missing signature sections before normalization', () => {
  const incompleteContent = `
SECTION 1 - ADVISOR SERVICES AGREEMENT
The services compensated by this Option are bona fide advisory services and do not include services in connection with the offer or sale of securities in a capital-raising transaction or services that directly or indirectly promote or maintain a market for the Company's securities.
Corporate par value is legally distinct from fair market value.
Early exercise is not permitted. An 83(b) election is not triggered merely by the grant.
`;

  const issues = __test.collectGeneratedContentIssues('advisor_nso_agreement', incompleteContent, advisorGrant);

  assert.ok(issues.some(issue => /General Provisions/i.test(issue)));
  assert.ok(issues.some(issue => /signature\/acceptance/i.test(issue)));
  assert.ok(issues.some(issue => /Company signature block/i.test(issue)));
  assert.ok(issues.some(issue => /Advisor signature block/i.test(issue)));
});

test('board consent normalization removes unsupported 409A phrasing and states early exercise', () => {
  const staleContent = `
WRITTEN CONSENT
The Board determined the fair market value was $0.05 per share in accordance with Section 409A.

IN WITNESS WHEREOF
/s/ Tremaine Grant
Date: August 2, 2026
`;

  const normalized = __test.normalizeGeneratedContent('board_consent', staleContent, advisorGrant);
  const issues = __test.collectGeneratedContentIssues('board_consent', normalized, advisorGrant);

  assert.doesNotMatch(normalized, /in accordance with Section 409A/i);
  assert.match(normalized, /Fair Market Value Determination Date is August 2, 2026/i);
  assert.match(normalized, /Early exercise is not permitted/i);
  assert.deepEqual(issues, []);
});

test('board consent normalization repairs stale par-value-like exercise price references', () => {
  const normalizedGrant = __test.normalizeManagedAdvisorRequestBody({
    ...advisorGrant,
    documentType: 'board_consent',
    grantDetails: {
      ...advisorGrant.grantDetails,
      strikePrice: 0.001,
      fairMarketValueAtGrant: 0.001,
    },
  });
  const staleContent = `
WRITTEN CONSENT
RESOLVED, that the Company grants Valerie Alexander an option to purchase 25,000 shares at an exercise price of $0.001 per share.
Early exercise is not permitted.

IN WITNESS WHEREOF
/s/ Tremaine Grant
Date: August 2, 2026
`;

  const normalized = __test.normalizeGeneratedContent('board_consent', staleContent, normalizedGrant);
  const issues = __test.collectGeneratedContentIssues('board_consent', normalized, normalizedGrant);

  assert.match(normalized, /exercise price of \$0\.05 per share/i);
  assert.doesNotMatch(normalized, /\$0\.001 per share/i);
  assert.deepEqual(issues, []);
});

test('EIP normalization adds required plan safeguards and removes named participants', () => {
  const staleContent = `
Equity Incentive Plan
The plan has a reserve for awards. Valerie Alexander and Marques Zak may receive awards.

/s/ Tremaine Grant
`;

  const normalized = __test.normalizeGeneratedContent('eip', staleContent, {
    documentType: 'eip',
    documentDate: 'August 2, 2026',
    planShareReserve: 1_000_000,
  });
  const issues = __test.collectGeneratedContentIssues('eip', normalized, {
    documentType: 'eip',
    documentDate: 'August 2, 2026',
    planShareReserve: 1_000_000,
  });

  assert.doesNotMatch(normalized, /Valerie Alexander|Marques Zak/i);
  assert.match(normalized, /Plan reserve of 1,000,000 shares/i);
  assert.match(normalized, /Rule 701/i);
  assert.match(normalized, /Administrator must confirm the applicable securities-law exemption/i);
  assert.deepEqual(issues, []);
});

test('EIP normalization pins 83(b) timing to transfer of substantially nonvested shares', () => {
  const staleContent = `
Equity Incentive Plan
The Plan reserve is not itself an issuance or grant. The Plan reserve of 1,000,000 shares of Common Stock only sets the maximum available pool. Every award requires separate Board approval and an award agreement.
For reliance on Rule 701, consultant and advisor eligibility is limited to natural persons providing bona fide services that are not connected to a capital-raising securities transaction and do not directly or indirectly promote or maintain a market for Company securities.
The Administrator must confirm the applicable securities-law exemption for every grant. Plan eligibility alone does not supply an exemption.
Corporate par value is distinct from fair market value and must not be substituted for the Board-determined exercise price.
Early exercise is permitted only when an individual award agreement expressly permits it. An 83(b) election is not triggered merely by the grant of an unexercised option. Participants must be informed of the potential 30-day Section 83(b) election deadline.

/s/ Tremaine Grant
`;

  const normalized = __test.normalizeGeneratedContent('eip', staleContent, {
    documentType: 'eip',
    documentDate: 'August 2, 2026',
    planShareReserve: 1_000_000,
  });
  const issues = __test.collectGeneratedContentIssues('eip', normalized, {
    documentType: 'eip',
    documentDate: 'August 2, 2026',
    planShareReserve: 1_000_000,
  });

  assert.doesNotMatch(normalized, /potential 30-day Section 83\(b\) election deadline\./i);
  assert.match(normalized, /possible 30-day Section 83\(b\) election deadline after transfer of substantially nonvested shares/i);
  assert.deepEqual(issues, []);
});

test('EIP normalization completes a plan that truncates after stock option safeguards', () => {
  const truncatedContent = `
Equity Incentive Plan
3. Shares Subject to the Plan
The Plan reserve is not itself an issuance or grant. The Plan reserve of 1,000,000 shares of Common Stock only sets the maximum available pool. Every award requires separate Board approval and an award agreement.
For reliance on Rule 701, consultant and advisor eligibility is limited to natural persons providing bona fide services that are not connected to a capital-raising securities transaction and do not directly or indirectly promote or maintain a market for Company securities.
The Administrator must confirm the applicable securities-law exemption for every grant. Plan eligibility alone does not supply an exemption.
Corporate par value is distinct from fair market value and must not be substituted for the Board-determined exercise price.

6. Stock Options
6.1 Grant of Options
The Administrator may grant ISOs and NSOs to eligible participants.
6.4 Term
No stock option shall have a term longer than 10 years from the date of grant.
Plan Administration Safeguards
Early exercise is permitted only when an individual award agreement expressly permits it. An 83(b) election is not triggered merely by the grant of an unexercised option. If unvested shares are acquired, participant notices should address the possible 30-day Section 83(b) deadline after transfer of substantially nonvested shares.
`;

  const normalized = __test.normalizeGeneratedContent('eip', truncatedContent, {
    documentType: 'eip',
    documentDate: 'August 6, 2026',
    planShareReserve: 1_000_000,
  });
  const issues = __test.collectGeneratedContentIssues('eip', normalized, {
    documentType: 'eip',
    documentDate: 'August 6, 2026',
    planShareReserve: 1_000_000,
  });

  assert.match(normalized, /7\. Restricted Stock and RSUs/);
  assert.match(normalized, /8\. Termination of Service/);
  assert.match(normalized, /9\. Corporate Transactions/);
  assert.match(normalized, /10\. General Provisions/);
  assert.match(normalized, /11\. Adoption and Approval/);
  assert.match(normalized, /\/s\/ Tremaine Grant/);
  assert.match(normalized, /Founder & Sole Director/);
  assert.match(normalized, /Sole Stockholder/);
  assert.match(normalized, /Date: August 6, 2026/);
  assert.deepEqual(issues, []);
});

test('EIP issue collection rejects missing late plan sections before normalization', () => {
  const incompleteContent = `
Equity Incentive Plan
The Plan reserve is not itself an issuance or grant.
For reliance on Rule 701, consultant and advisor eligibility is limited to natural persons providing bona fide services that are not connected to a capital-raising securities transaction and do not directly or indirectly promote or maintain a market for Company securities.
Corporate par value is distinct from fair market value and must not be substituted for the Board-determined exercise price.
An 83(b) election is not triggered merely by the grant of an unexercised option.
`;

  const issues = __test.collectGeneratedContentIssues('eip', incompleteContent, {
    documentType: 'eip',
    documentDate: 'August 6, 2026',
    planShareReserve: 1_000_000,
  });

  assert.ok(issues.some(issue => /Termination of Service/i.test(issue)));
  assert.ok(issues.some(issue => /Corporate Transactions/i.test(issue)));
  assert.ok(issues.some(issue => /General Provisions/i.test(issue)));
  assert.ok(issues.some(issue => /adoption section/i.test(issue)));
  assert.ok(issues.some(issue => /adoption signature/i.test(issue)));
});
