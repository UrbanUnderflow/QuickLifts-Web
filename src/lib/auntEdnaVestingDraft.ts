/** Draft only. Source snapshots preserve the basis for review without treating them as signed. */
export function buildAuntEdnaVestingDraft(template: {id:string; title:string; content:string}, sideLetter: {id:string; title:string; content:string}) {
  if (!/Valerie Alexander/i.test(template.title) || !template.content.trim() || !/Reciprocal Strategic Equity Side Letter/i.test(sideLetter.title) || !sideLetter.content.trim()) throw new Error('The Valerie template and AuntEdna side letter must be available before drafting.');
  return {
    title: 'PIL Vesting Shares Equity Agreement - AuntEdna.ai (Draft)',
    documentType: 'strategic_vesting_equity_agreement',
    allocationKind: 'vesting_shares', equityDirection: 'outgoing',
    stakeholderName: 'AuntEdna.ai', stakeholderId: null,
    status: 'completed', approvalStatus: 'draft', requiresSignature: true,
    sourceReferences: [template, sideLetter],
    prompt: 'Use Valerie agreement structure only; adapt to PIL company-to-company vesting shares outside EIP using AuntEdna side-letter terms. Preserve unresolved terms and approval conditions. Do not issue or sign.',
    closingRequirements: [
      'Reconcile in a written amendment whether the 2% vesting-share award replaces the side-letter warrant or is additional to a separate 2% purchase warrant; obtain both parties’ agreement before issuance',
      'Approve exact share count, security class, consideration, issuance timing, and treatment of unvested shares',
      'Approve capitalization certificate, denominator, convertible-note treatment, and fractional-share treatment',
      'Confirm grant date and vesting commencement date',
      'Obtain required board, stockholder and investor consents and securities-law confirmation for this specific vesting-share instrument',
      'Confirm authorized signer names, titles and email addresses for each party',
    ],
    exhibits: [sideLetter.id],
    content: `# PIL VESTING SHARES EQUITY AGREEMENT

## DRAFT FOR REVIEW — NOT EFFECTIVE; NOT AN ISSUED GRANT

Pulse Intelligence Labs, Inc., a Delaware corporation (the “Company” or “PIL”), and AuntEdna.ai, Inc., a Texas corporation (the “Recipient” or “AuntEdna”), propose this company-to-company strategic equity agreement (the “Agreement”). The Grant Date and Effective Date are [TO BE APPROVED]. No signature, corporate approval, issuance, or vesting is established by preparing or storing this draft.

### Closing issue requiring written resolution

The September 9, 2026 Reciprocal Strategic Equity Side Letter describes a single 2.0% strategic equity right, ordinarily implemented through a strategic partnership warrant unless a different instrument is determined appropriate. The current working allocation separately lists 2.0% vesting shares and a 2.0% purchase warrant. This draft addresses only the proposed vesting-share allocation. Before execution, both parties must confirm in writing whether it replaces the side-letter warrant or constitutes a separately approved additional award, and amend the affected documents as necessary. This draft does not itself create an aggregate 4.0% entitlement or change an existing warrant.

## SECTION 1 — STRATEGIC RELATIONSHIP

1.1 Purpose. The proposed award recognizes the strategic relationship described in the September 9, 2026 Strategic Partnership and Integration Agreement (the “Partnership Agreement”) and Reciprocal Strategic Equity Side Letter (the “Side Letter”), including commercialization, integration, institutional development, pilots, and joint implementation. It is not payment for an individual referral, Clinical Handoff, customer contract, grant payment, or other individual transaction.

1.2 Corporate recipient. The recipient is AuntEdna.ai, Inc. No equity is granted personally to any founder, director, officer, employee, advisor, contractor, or other individual. This Agreement does not create employment, agency, a legal partnership, joint venture, or authority to bind the other party.

1.3 Existing operational terms. The parties’ existing confidentiality, intellectual-property, data-access, clinical, commercial, indemnification, liability, and operational obligations remain governed by the Partnership Agreement and its exhibits. No advisor intellectual-property assignment is imported from the Valerie Alexander agreement. Neither party receives access to the other’s intellectual property, systems, source code, models, datasets, or confidential or clinical information by holding this award.

## SECTION 2 — PROPOSED VESTING-SHARE AWARD

2.1 Award. Subject to resolution of the closing issue above and all conditions in Section 6, PIL proposes an award of [EXACT NUMBER OF SHARES TO BE APPROVED] shares of [SECURITY CLASS AND ASSOCIATED RIGHTS TO BE APPROVED], representing 2.0% of PIL’s approved Fully Diluted Capitalization as of the approved Grant Date. It is a strategic company-to-company award outside the Equity Incentive Plan. It is not an advisor NSO, an option to exercise, or the separate purchase warrant. No option exercise price, ten-year option term, or post-termination exercise window is imported from the advisor template.

2.2 Capitalization certificate. Before execution, PIL must provide a board-approved capitalization certificate identifying outstanding common and preferred stock, options, warrants, convertible instruments, SAFEs, reserved plan shares, and other applicable rights; their inclusion or exclusion and conversion assumptions; whether this award and any separate warrant are included in the denominator; the approved share count and class; and fractional-share treatment. The parties must acknowledge the calculation basis in writing. The working reserve figures alone do not establish the denominator or final award size.

2.3 Consideration and issuance mechanics. [TO BE APPROVED: lawful consideration and value; whether shares are issued at closing subject to restrictions or issued as they vest; delivery and stock-ledger mechanics; treatment and any repurchase or cancellation mechanics for unvested shares; voting and distribution rights before vesting.] No present stockholder rights arise from this unsigned draft. Actual rights must follow the approved class, governing documents, final issuance mechanics, and applicable law. Neither payment terms nor repurchase price are assumed to be zero.

2.4 Dates. Grant Date: [TO BE APPROVED]. Vesting Commencement Date: [TO BE CONFIRMED; the Side Letter ordinarily refers to the Partnership Agreement’s Effective Date unless otherwise approved in writing]. Execution dates shall be the actual dates signed. Preparing this draft does not backdate approval or issuance.

2.5 Vesting. Subject to Section 3, the award vests over 24 months from the approved Vesting Commencement Date. No portion vests before the six-month anniversary. Twenty-five percent vests on that anniversary; the remaining seventy-five percent vests in equal monthly installments in months seven through twenty-four. Once the final share count is approved, an attached schedule must state whole-share installments and an approved final rounding adjustment so that total vesting equals exactly the approved award.

2.6 No perpetual percentage. The 2.0% target is measured at the approved Grant Date on the agreed capitalization basis. It is not a perpetual ownership guarantee, anti-dilution protection, or right to automatic future top-ups.

## SECTION 3 — CONTINUED VESTING AND TERMINATION

3.1 Continued vesting requires the Partnership Agreement to remain in effect, AuntEdna to continue materially participating in good faith, and AuntEdna not to be in an uncured material breach or to have committed an Uncurable Strategic Breach. A temporary cure period does not automatically suspend vesting unless the breach remains uncured after the applicable cure period or the parties otherwise agree in writing.

3.2 If the Partnership Agreement expires, is not renewed, or ends through a contractual off-ramp without an uncured material breach by AuntEdna, the vested portion remains vested and the unvested portion terminates as of the effective termination date, implemented under the approved issuance mechanics in Section 2.3. Termination alone does not automatically forfeit vested securities.

3.3 Upon termination for AuntEdna’s uncured material breach, further vesting ceases and the unvested portion terminates. Treatment of vested shares remains subject to the final definitive terms and applicable law; this draft creates no additional automatic forfeiture or repurchase right.

3.4 Uncurable Strategic Breach has the meaning and limits in Side Letter Sections 4.5 and 18.1–18.2, including intentional material misuse of data, intentional unauthorized access, verified intentional circumvention of a specifically documented Shared Account opportunity or scope, fraud, willful intellectual-property theft, or comparable qualifying intentional misconduct. Good-faith attribution disputes alone do not forfeit equity. Representative misconduct is not automatically attributed to a party without the authorization, ratification, enabling conduct, failure to remediate, or other attribution described there. Unvested rights terminate upon such a breach; remedies affecting vested securities require an express enforceable contractual basis and applicable law.

## SECTION 4 — CHANGE OF CONTROL AND PARTICIPATION RIGHTS

4.1 Change of Control has the meaning in Side Letter Section 12. Subject to applicable confidentiality and legal restrictions, PIL shall give reasonable notice sufficient to determine the award’s treatment.

4.2 While the Partnership Agreement remains in effect and AuntEdna is not in uncured material breach and has not committed an Uncurable Strategic Breach, fifty percent of the then-unvested award accelerates immediately before consummation of a Change of Control of PIL. The remainder accelerates if, in connection with or within twelve months afterward, the acquirer terminates the Partnership Agreement other than for AuntEdna’s material breach, materially eliminates the strategic relationship, refuses to assume or honor the equity instrument, or is AuntEdna’s material competitor and AuntEdna exercises the applicable Section 14.4A termination or exclusivity right. No acceleration applies for a recipient in the disqualifying breach described in Side Letter Section 5.3.

4.3 Any financing participation right remains subject to Side Letter Section 6, including applicable law, investor qualifications, board approval, allocation limitations and prior investor rights, execution of financing documents, the stated election period and termination events. This Agreement does not enlarge that right or guarantee allocation, control, or a maintained ownership percentage. Neither party must invest additional capital or guarantee the other’s obligations.

## SECTION 5 — RISK, TRANSFER, AND CORPORATE RIGHTS

5.1 The parties acknowledge that private-company equity may be illiquid, restricted, diluted, and lose value. Each party is responsible for its own legal, tax, and accounting advice. Tax consequences depend on the final instrument and issuance timing; the option-specific tax statements in the advisor template do not apply automatically to this award.

5.2 Securities are subject to applicable securities laws, the approved class and governing documents, applicable rights of first refusal, legends, and valid transfer restrictions. The final agreement must identify any instrument-specific transfer limitations. No exemption from registration, filing obligation, investor consent, or other issuance requirement is deemed established by this draft.

5.3 No board seat, observer right, veto, managerial control, or special governance right is created beyond rights necessarily arising from the approved class and expressly agreed definitive documents. Revenue sharing, Shared Account economics, and commercial payment obligations remain separate; neither party may offset them merely because of this equity relationship.

## SECTION 6 — CONDITIONS TO EFFECTIVENESS

This Agreement and award cannot become effective until: (a) the parties resolve and document the relationship to the separate warrant and the Side Letter; (b) PIL approves the exact share count, security class, consideration, capitalization basis, dates, issuance mechanics, and final vesting schedule; (c) required board, stockholder, and investor approvals are obtained for this specific instrument; (d) the lawful securities issuance pathway and required filings or notices are confirmed; (e) the applicable coordinated-closing requirements in Side Letter Section 18.4 are satisfied or expressly modified in writing; and (f) all required authorized representatives execute the completed definitive documents. A document referring only to a warrant must not be treated as approval of this share issuance without confirming its actual scope.

## SECTION 7 — GENERAL PROVISIONS

7.1 Relationship to existing agreements. This Agreement addresses only the mechanics of the proposed PIL vesting-share award. The Partnership Agreement controls operational and commercial matters. The Side Letter continues to govern its applicable economic protections, subject to the written reconciliation required above. No incoming AuntEdna-to-PIL equity is granted here. No general entire-agreement clause extinguishes the parties’ other signed agreements.

7.2 Governing law. [TO BE CONFIRMED against the parties’ existing agreements and final issuance terms; PIL is a Delaware corporation.] Corporate issuance requirements must comply with applicable law. Dispute-resolution provisions are not amended by this draft.

7.3 Amendments and execution. Amendments require a writing signed by authorized representatives and any necessary corporate approvals. Counterparts and electronic signatures are permitted as provided in the Side Letter. Blank signature blocks are not signatures or proof of authority.

## SECTION 8 — SIGNATURES (UNSIGNED DRAFT)

PULSE INTELLIGENCE LABS, INC.
By: ______________________________
Name: Tremaine Grant
Title: CEO [authority to be confirmed]
Date: ____________________________

AUNTEDNA.AI, INC.
By: ______________________________
Name: Tracey Hathaway
Title: [TO BE CONFIRMED]
Date: ____________________________

By: ______________________________
Name: Jelanna Olivera
Title: [TO BE CONFIRMED]
Date: ____________________________

[Confirm the complete required signatory list and signing capacities before circulation.]

## DRAFTING SOURCES

Structure reference: Valerie Alexander’s Advisor Agreement and Non-Qualified Stock Option Grant (${template.id}). Its individual-advisor services, option economics, EIP participation, dates, approval assertions, and intellectual-property assignment are not copied into this strategic share award.
Substantive reference: Reciprocal Strategic Equity Side Letter dated September 9, 2026 (${sideLetter.id}). Source text is retained in the document record for traceability; storage does not verify execution.
`,
  };
}
