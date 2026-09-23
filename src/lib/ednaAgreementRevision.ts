import {dateEdnaInstrument} from './ednaDocumentDate';

/** Clean counterparty-facing revision. Unresolved deal terms remain in the closing schedule. */
export function reviseEdnaAgreement(content: string): string {
  if (!content.includes('## SECTION 8') || !content.includes('## SECTION 2')) throw new Error('The agreement structure changed; review before applying this revision.');
  let result = content.slice(0, content.indexOf('## DRAFTING SOURCES') === -1 ? undefined : content.indexOf('## DRAFTING SOURCES'));
  result = result.replace(/# PIL VESTING SHARES EQUITY AGREEMENT[\s\S]*?(?=## SECTION 1)/, `# STRATEGIC VESTING SHARE AGREEMENT

PROPOSED AGREEMENT — SUBJECT TO COMPLETION AND EXECUTION

This Strategic Vesting Share Agreement (the “Agreement”) is entered into by Pulse Intelligence Labs, Inc., a Delaware corporation (“PIL” or the “Company”), and EDNA, Inc. (“EDNA” or the “Recipient”), effective upon satisfaction of Section 6 on the Grant Date specified in Schedule A. The parties’ Strategic Partnership and Integration Agreement (the “Partnership Agreement”) and September 9, 2026 Reciprocal Strategic Equity Side Letter (the “Side Letter”) are referenced below.

`);
  result = result.replace(/AuntEdna\.ai, Inc\./g, 'EDNA, Inc.').replace(/AUNTEDNA\.AI, INC\./g, 'EDNA, INC.').replace(/AuntEdna/g, 'EDNA');
  result = result.replace('No advisor intellectual-property assignment is imported from the Valerie Alexander agreement. ', '');
  result = result.replace('Subject to resolution of the closing issue above and all conditions in Section 6, PIL proposes an award of [EXACT NUMBER OF SHARES TO BE APPROVED] shares of [SECURITY CLASS AND ASSOCIATED RIGHTS TO BE APPROVED], representing 2.0% of PIL’s approved Fully Diluted Capitalization as of the approved Grant Date.', 'Subject to Section 6, PIL grants the Recipient the number and class of shares specified in Schedule A, representing 2.0% of PIL’s approved Fully Diluted Capitalization as of the Grant Date.');
  result = result.replace('It is not an advisor NSO, an option to exercise, or the separate purchase warrant. No option exercise price, ten-year option term, or post-termination exercise window is imported from the advisor template.', 'The award is a vesting-share award. Its relationship to any other equity instrument is solely as expressly stated in the completed Schedule A and the parties’ signed closing documents.');
  result = result.replace('The working reserve figures alone do not establish the denominator or final award size.', 'The approved capitalization certificate shall be attached as Schedule B.');
  result = result.replace(/2.3 Consideration and issuance mechanics\.[\s\S]*?(?=2.4 Dates\.)/, `2.3 Consideration and issuance mechanics. The consideration, original acquisition cost per share, issuance timing, voting and distribution rights, and treatment of unvested shares shall be specified in Schedule A and approved by PIL’s board before execution. Delivery and stock-ledger entries shall follow those approved terms. This Agreement does not itself confer stockholder rights before lawful issuance. The unvested portion is subject to the termination provisions below; any issued shares representing that portion shall be treated under the expressly approved cancellation or repurchase mechanics in Schedule A.

`);
  result = result.replace(/2.4 Dates\.[\s\S]*?(?=2.5 Vesting\.)/, `2.4 Dates. The Grant Date and Vesting Commencement Date are specified in Schedule A. The commencement date shall be the Partnership Agreement’s effective date unless the parties otherwise approve in writing. Each signature shall bear its actual execution date.

`);
  result = result.replace('Termination alone does not automatically forfeit vested securities.', 'Ordinary expiration, nonrenewal, or termination without a Repurchase Event does not trigger the repurchase option in Section 3.5.');
  result = result.replace('Treatment of vested shares remains subject to the final definitive terms and applicable law; this draft creates no additional automatic forfeiture or repurchase right.', 'Vested shares remain subject to the repurchase option in Section 3.5.');
  result = result.replace('Unvested rights terminate upon such a breach; remedies affecting vested securities require an express enforceable contractual basis and applicable law.', 'Unvested rights terminate upon such a breach. Issued shares, including vested shares, are subject to Section 3.5.');
  result = result.replace('## SECTION 4', `3.5 Company option to repurchase at original cost.

(a) Repurchase Events. PIL may elect to repurchase all or any portion of the shares issued under this Agreement and then held by EDNA or a permitted transferee following: (i) fraud by EDNA against PIL in connection with the strategic relationship or this award; (ii) willful theft or misappropriation of PIL’s intellectual property; (iii) intentional and material misuse of PIL’s data, intentional unauthorized access to protected systems or information, or verified intentional circumvention of a specifically documented Shared Account opportunity or scope; (iv) other willful misconduct by EDNA causing material harm to PIL; or (v) a material breach by EDNA of this Agreement, the Side Letter, or the Partnership Agreement that remains uncured following the applicable written notice and cure period. These are “Repurchase Events.” The attribution and Shared Account protections in Section 3.4 apply. A good-faith commercial dispute, ordinary underperformance that is not a material breach, or termination for convenience alone is not a Repurchase Event.

(b) Notice, cure and determination. PIL shall give written notice describing the alleged conduct and supporting facts. A curable material breach has the cure period required by the Partnership Agreement, or thirty calendar days after receipt of notice if that agreement provides none. No cure period is required for established fraud, willful intellectual-property theft, or intentional misconduct that is not reasonably capable of cure. A Repurchase Event must be established by EDNA’s written admission or a final binding determination under the applicable dispute-resolution procedure; PIL’s allegation alone does not establish it. Pending determination, either party may seek available interim relief, but ownership does not automatically transfer to PIL.

(c) Price. The repurchase price is the original acquisition cost per share actually paid or furnished by EDNA to PIL, as expressly documented and approved in Schedule A, multiplied by the shares repurchased, equitably adjusted for stock splits, combinations and similar recapitalizations. Noncash consideration must have an expressly agreed allocation and board-approved value in Schedule A. The price does not include subsequent appreciation. Absence of a documented acquisition cost does not establish a zero price, and no price is supplied by par value alone. A zero acquisition cost applies only if expressly agreed and lawfully approved in Schedule A.

(d) Exercise and closing. PIL must exercise by written notice within ninety days after the Repurchase Event is established under subsection (b), identifying the shares, calculation and closing date. Closing shall occur within thirty days after the exercise notice, subject to subsection (e), against concurrent payment and delivery of the shares free of liens created by EDNA and reasonably necessary transfer documents. EDNA shall procure each permitted transferee’s written agreement to this Section before transfer. This option survives termination of the Partnership Agreement and this Agreement with respect to shares issued hereunder.

(e) Legal limitations and other remedies. Repurchase is subject to applicable law, including Delaware corporate-law limits on purchases of a corporation’s own shares, required corporate approvals and binding investor rights. No unlawful payment or automatic forfeiture is required. If a timely elected closing is legally prohibited, it shall be deferred until lawful, with written notice explaining the impediment; title remains with its holder until lawful closing. Other contractual and legal remedies remain available without double recovery. The parties expressly agree to this repurchase option as a term of this award; any required corresponding amendment to the reciprocal instruments or Side Letter must be executed as a condition of Section 6.

## SECTION 4`);
  result = result.replace('Tax consequences depend on the final instrument and issuance timing; the option-specific tax statements in the advisor template do not apply automatically to this award.', 'Tax treatment depends on the actual issuance and vesting mechanics. If substantially nonvested property is transferred in connection with services, the Recipient shall promptly obtain its own advice concerning whether a Section 83(b) election is available and appropriate, including the applicable thirty-day filing deadline after transfer. PIL makes no election for the Recipient and gives no assurance of tax treatment.');
  result = result.replace('No exemption from registration, filing obligation, investor consent, or other issuance requirement is deemed established by this draft.', 'Issuance remains subject to the securities-law pathway and required consents, filings and notices identified at closing.');
  result = result.replace(/This Agreement and award cannot become effective until:[\s\S]*?(?=## SECTION 7)/, `This Agreement and award become effective only when: (a) Schedules A and B are completed and approved; (b) required PIL board, stockholder and investor consents for this share award and repurchase option are obtained; (c) applicable securities-law requirements are satisfied; (d) the parties execute any amendment needed to reconcile this award and Section 3.5 with the Side Letter and other equity instruments; and (e) authorized representatives execute the definitive documents. Closing shall occur concurrently with delivery of the corresponding effective EDNA-to-PIL equity instrument, its required corporate approvals and capitalization certification, unless both parties expressly agree otherwise in a signed writing. This Agreement does not alone fulfill that reciprocal delivery condition.

`);
  result = result.replace(/7.1 Relationship to existing agreements\.[\s\S]*?(?=7.2 Governing law\.)/, `7.1 Relationship to existing agreements. This Agreement governs the PIL award identified in Schedule A. The Partnership Agreement controls operational and commercial matters. The Side Letter continues to govern applicable economic protections except as expressly amended in signed closing documents. The reciprocal EDNA issuance shall be documented separately and delivered under Section 6. No general entire-agreement provision extinguishes the parties’ other agreements.

`);
  result = result.replace(/7.2 Governing law\.[\s\S]*?(?=7.3 Amendments)/, `7.2 Governing law. Delaware law governs this Agreement, without regard to conflict-of-law principles. Notices and dispute resolution shall follow the Partnership Agreement’s applicable procedures, including any required negotiation and binding dispute resolution, except as expressly agreed in signed closing documents.

`);
  result = result.replace('Blank signature blocks are not signatures or proof of authority.', 'Each signatory represents that they are authorized to bind the party for which they sign.');
  result = result.replace('## SECTION 8 — SIGNATURES (UNSIGNED DRAFT)', '## SECTION 8 — SIGNATURES').replace('Title: CEO [authority to be confirmed]', 'Title: CEO').replace(/Title: \[TO BE CONFIRMED\]/g, 'Title: ____________________________');
  result = result.replace('[Confirm the complete required signatory list and signing capacities before circulation.]', '');
  result += `
## SCHEDULE A — AWARD AND CLOSING TERMS

Recipient: EDNA, Inc.
Grant Date: ____________________________
Vesting Commencement Date: ____________________________
Number of shares: ____________________________
Security class and associated rights: ____________________________
Fully Diluted Capitalization: As certified in Schedule B.
Target percentage at Grant Date: 2.0%.
Consideration furnished and board-approved value: ____________________________
Original acquisition cost per share for Section 3.5: ____________________________
Issuance timing and treatment of issued unvested shares: ____________________________
Voting and distribution rights before vesting: ____________________________
Fractional-share and installment rounding treatment: ____________________________
Relationship to other equity instruments and required amendments: ____________________________
Reciprocal closing instrument and approvals: ____________________________

The completed schedule and capitalization certificate must be approved before execution. No blank field is deemed zero or waived.

## SCHEDULE B — APPROVED CAPITALIZATION CERTIFICATE

The board-approved certificate described in Section 2.2 and the final whole-share vesting schedule shall be attached at closing.
`;
  return result.trim();
}

/** Settled terms from the September 11 signing side letter and September 12 board package. */
export function completeEdnaAgreement(clean: string): string {
  if (!clean.includes('3.5 Company option to repurchase at original cost.')) throw new Error('Apply the clean EDNA revision first.');
  let text = clean.replace('PROPOSED AGREEMENT — SUBJECT TO COMPLETION AND EXECUTION\n\n','');
  text = text.replace(/September 9, 2026/g,'September 11, 2026');
  text = text.replace('## SECTION 2 — PROPOSED VESTING-SHARE AWARD','## SECTION 2 — STRATEGIC SHARE AWARD');
  text = text.replace('The proposed award recognizes','The award recognizes');
  text = text.replace(/2.1 Award\.[\s\S]*?(?=2.2 Capitalization certificate\.)/, `2.1 Award and separate warrant. Subject to Section 6, PIL grants EDNA a contractual Strategic Share Award for exactly 200,000 shares of PIL common stock, subject only to the proportionate corporate adjustments in Section 2.6. This award is outside PIL’s Equity Incentive Plan. It is additional to, and does not replace, reduce or satisfy, the separate Strategic Partnership Warrant issued by PIL to EDNA for up to 200,000 additional common shares. The combined maximum under the two instruments is 400,000 common shares before those adjustments. This Agreement governs only the Share Award; the separate Warrant governs its purchase price, exercise, term and other purchase mechanics. No cash payment or exercise is required for the Share Award. The two fixed counts are not floating percentage grants or guarantees against dilution.

`);
  text = text.replace(/2.2 Capitalization certificate\.[\s\S]*?(?=2.3 Consideration)/, `2.2 Capitalization and reservation certificate. Before closing, each party shall deliver the board-approved certificate required by Side Letter Section 18.3. PIL’s certificate shall confirm sufficient authorized and uncommitted common shares and separate reservations for the 200,000-share Share Award and 200,000-share Warrant, legally sufficient noncash consideration, required approvals, and the treatment of outstanding stock, options, warrants, convertible notes, SAFEs and equity-plan reserves without double counting. The certificates shall disclose resulting ownership percentages. They do not automatically change either fixed count. The EDNA certificate must also satisfy the express 2.0% reciprocal condition in Section 6. PIL shall not rely on an outdated reserve amount in an earlier draft in place of its lawfully approved current reserve records.

`);
  text = text.replace(/2.3 Consideration and issuance mechanics\.[\s\S]*?(?=2.4 Dates\.)/, `2.3 Consideration and issuance. The consideration is EDNA’s strategic undertakings and contributions under the Partnership Agreement and Side Letter, as authorized and valued by PIL’s board in a documented determination of legally sufficient noncash consideration, including applicable par-value requirements. No cash purchase price is payable. This award does not discharge commercial payments otherwise owed. No unvested shares are issued at closing. PIL shall issue each vested installment without an exercise notice, cash payment or election to exercise, promptly enter EDNA in its stock ledger and provide an electronic or certificated ownership record. Administrative delay does not postpone vesting or cancel an accrued right to issuance. Before actual issuance, EDNA has a contractual issuance right and no voting or dividend rights solely from the unissued award. Issued shares carry the rights of PIL common stock, subject to lawful restrictions and Section 3.5.

`);
  text = text.replace(/2.4 Dates\.[\s\S]*?(?=2.5 Vesting\.)/, `2.4 Dates. The agreed grant-reference date and Vesting Commencement Date are September 11, 2026. Legal effectiveness occurs only at the coordinated closing described in Section 6. No award becomes effective or shares become issuable before those conditions are met. Any elapsed service credit from September 11, 2026 remains subject to the vesting conditions. Signatures shall record the actual dates signed; the grant-reference date does not represent an earlier execution or completed closing.

`);
  text = text.replace(/2.5 Vesting\.[\s\S]*?(?=## SECTION 3)/, `2.5 Vesting. The Share Award vests over forty-eight months commencing September 11, 2026. No shares vest before September 11, 2027. On that date, 50,000 shares vest. On each monthly anniversary afterward through September 11, 2030, the cumulative vested total is 50,000 plus the whole number obtained by rounding down 150,000 multiplied by the number of completed monthly installments after the cliff divided by 36. Each installment equals the increase in that cumulative total. The final installment vests the entire remaining balance so that cumulative vesting equals exactly 200,000 shares. Except for express acceleration, no partial month is credited. All vesting remains subject to Section 3 and the closing condition in Section 6. The separate Warrant vests under its own instrument and does not consume this award.

2.6 Corporate adjustments and dilution. Stock splits, reverse splits, stock dividends, recapitalizations, combinations, reclassifications and similar changes produce proportionate adjustments to the unissued award shares and installments without an economic windfall. Ordinary financing dilution and conversion of existing instruments do not increase this fixed-count award. No perpetual ownership percentage or automatic top-up is promised. The initial reciprocal 2.0% closing test in Section 6 is not an ongoing anti-dilution right.

`);
  text = text.replace('implemented under the approved issuance mechanics in Section 2.3', 'with all vested but unissued installments remaining due for issuance under Section 2.3, subject to Section 3.5');
  text = text.replace(/\(c\) Price\.[\s\S]*?(?=\(d\) Exercise and closing\.)/, `(c) Price. The repurchase price is EDNA’s original acquisition cost for the repurchased shares, determined from the contemporaneous board-approved consideration record required by Sections 2.2–2.3, without subsequent appreciation, and equitably adjusted for stock splits and similar recapitalizations. EDNA pays no cash purchase price for this Share Award; its consideration is noncash. Accordingly, the original cost is the portion of the expressly documented and board-approved noncash consideration value allocable to the shares repurchased, plus any cash actually paid for those shares. The separate Warrant’s exercise price, current fair market value, and par value alone do not determine this price. The board-approved record must state the per-share allocation before closing. Absence of that record does not create a zero-cost repurchase right. A price dispute is resolved under Section 7.2; PIL may timely exercise its option while the disputed price is determined, with closing following that determination subject to subsection (e).

`);
  text = text.replace('Tax treatment depends on the actual issuance and vesting mechanics. If substantially nonvested property is transferred in connection with services, the Recipient shall promptly obtain its own advice concerning whether a Section 83(b) election is available and appropriate, including the applicable thirty-day filing deadline after transfer. PIL makes no election for the Recipient and gives no assurance of tax treatment.', 'The agreed structure issues shares only as they vest and transfers no unvested shares at closing. Each party shall obtain advice on its own tax treatment. If the parties later amend the structure to transfer substantially nonvested property in connection with services, the Recipient shall promptly obtain advice about the availability, appropriateness and filing deadline of any Section 83(b) election. PIL makes no election for the Recipient and gives no assurance of tax treatment.');
  text = text.replace(/This Agreement and award become effective only when:[\s\S]*?(?=## SECTION 7)/, `6.1 Coordinated closing. This Agreement is subject to a condition precedent that EDNA contemporaneously grants and delivers to PIL a valid, enforceable reciprocal Strategic Share Award, duly authorized by EDNA, together with its required approvals and capitalization and share-reservation certificate. The reciprocal award must be separately additional to EDNA’s purchase Warrant in favor of PIL, must carry matching vesting and substantive protections as required by the Side Letter, and must represent 2.0% of EDNA’s fully diluted capitalization at the coordinated closing, as certified by EDNA’s board and acknowledged by PIL. The September 11 Side Letter specifies a reciprocal fixed 200,000-common-share award. If that fixed count does not represent the required 2.0%, the parties must execute a written amendment with all required corporate approvals before closing; neither a certificate nor this clause automatically changes a share count. The reciprocal separate purchase Warrants must also be delivered as required by the Side Letter. A purchase Warrant alone does not satisfy the reciprocal Share Award condition.

6.2 No unilateral effectiveness. Unless and until EDNA has validly granted and delivered the reciprocal Share Award described in Section 6.1, PIL’s grant and issuance obligations under this Agreement are null and void and of no force or effect: no equity, vesting entitlement, or right to issuance arises in EDNA’s favor under this Agreement. Signatures, preparation, elapsed time, or a unilateral ledger entry do not waive this condition. Delivery at closing means delivery of an effective contractual award; neither party must deliver all 200,000 vested shares upfront contrary to the agreed vesting schedule. If the reciprocal award is never validly delivered, PIL’s award never becomes effective. Once validly closed, a later failure to issue vested reciprocal installments is a material breach subject to applicable notice, cure, enforcement, and Section 3.5; it does not silently erase lawfully issued third-party rights.

6.3 Other closing conditions. Closing also requires completed board-approved capitalization and consideration records, sufficient lawful share reservations, all required board, stockholder and investor consents covering this specific share award and repurchase option, applicable securities-law compliance, and authorized execution of the necessary definitive documents and amendments. PIL may not close based solely on an unsigned approval or a consent whose scope covers only a Warrant. Neither party shall be required to perform its equity closing materially before the other. Any waiver of the reciprocal closing condition requires an express written agreement signed by both parties and all required approvals.

6.4 Relationship to Side Letter. The parties adopt this Agreement as the specific definitive terms for PIL’s Share Award and as a written supplement to the September 11, 2026 Side Letter. Upon authorized execution and satisfaction of the closing conditions, Sections 3.5 and 6 expressly supplement and, to the extent inconsistent, amend the Side Letter’s provisions on vested-share remedies and reciprocal closing for this award. The parties shall approve matching substantive reciprocal protections, or expressly approve any agreed difference in writing, consistent with Side Letter Section 15. All other separate Share Award and Warrant rights remain in effect under their respective documents.

`);
  text = text.replace('Title: ____________________________','Title: Co-Founder/Co-CEO').replace('Title: ____________________________','Title: Co-Founder/Co-CEO');
  text = text.slice(0,text.indexOf('## SCHEDULE A')) + `## SCHEDULE A — AWARD TERMS

Issuer: Pulse Intelligence Labs, Inc., a Delaware corporation.
Recipient: EDNA, Inc.
Instrument: Contractual Strategic Share Award, with shares issued as vested.
Maximum shares: 200,000 PIL common shares, subject only to Section 2.6 adjustments.
Separate purchase right: Up to 200,000 additional PIL common shares under the separate Strategic Partnership Warrant; not replaced or satisfied by this award.
Grant-reference and vesting commencement date: September 11, 2026.
Legal effectiveness: Coordinated closing under Section 6; actual signatures dated when executed.
Vesting: 48 months; 50,000 shares on September 11, 2027; remaining 150,000 in 36 monthly installments under Section 2.5; final vesting September 11, 2030.
Cash purchase price: None.
Noncash consideration: Strategic undertakings and contributions under the Partnership Agreement and Side Letter, with lawful value and per-share cost allocation documented by PIL’s board before closing.
Stockholder rights: Common-stock rights attach upon issuance; none arise solely from unissued award rights.
Repurchase: At original acquisition cost for Repurchase Events under Section 3.5, including vested shares.
Reciprocal condition: Effective EDNA-to-PIL award satisfying Section 6.1, additional to the separate reciprocal Warrant; otherwise PIL’s award is null and void under Section 6.2.
Governing law: Delaware.

## SCHEDULE B — CLOSING RECORDS

The parties’ board-approved capitalization and share-reservation certificates, PIL’s documented consideration value and per-share original-cost allocation, required corporate consents, and reciprocal award delivery evidence shall be delivered with the coordinated closing package. These records evidence satisfaction of the closing conditions and do not alter fixed share counts without the required signed amendment.
`;
  return dateEdnaInstrument(text.trim());
}
