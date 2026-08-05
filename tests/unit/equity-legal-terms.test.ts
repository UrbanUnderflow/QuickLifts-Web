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
