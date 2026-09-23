import json
from pathlib import Path
root=Path.cwd(); out=root/'output/pdf'; out.mkdir(parents=True,exist_ok=True)
founder='''PULSE INTELLIGENCE LABS, INC.
FOUNDER SHARE SURRENDER AND RETIREMENT AGREEMENT
AND SOLE DIRECTOR WRITTEN CONSENT

Document date: September 23, 2026

This agreement is between Pulse Intelligence Labs, Inc., a Delaware corporation (the "Company"), and Tremaine Grant (the "Founder"). It becomes effective when Tremaine Grant signs and delivers it in each capacity stated in the execution block below (the "Effective Time"). The electronic signature record establishes the actual execution date.

1. SHARES AND PURPOSE

The Founder holds 9,000,000 shares of the Company's Common Stock, par value $0.00001 per share, acquired under the Restricted Stock Purchase Agreement dated December 12, 2025 (the "RSPA"). The Founder voluntarily contributes 1,000,000 of those shares to the Company without cash or other property being paid by the Company. The purpose is to make shares available for the Company's approved equity reserves. Immediately after this transaction, the Founder will hold 8,000,000 shares.

2. PRESENT SURRENDER AND COMPANY ACCEPTANCE

At the Effective Time, the Founder irrevocably assigns, transfers and surrenders to the Company all right, title and interest in exactly 1,000,000 Common shares from the RSPA issuance. The Company accepts those shares as a voluntary capital contribution. This agreement is the Founder's written stock-transfer instruction and the Company's acceptance. No termination of service, exercise of the RSPA termination repurchase option, refund of the original purchase price, or release of the original property and intellectual-property assignment occurs.

The Founder represents that he owns the surrendered shares and has authority to transfer them, free of third-party liens or transfers, other than restrictions held by the Company under the RSPA. The Company expressly consents to this transfer and waives the RSPA Section 6(h) transfer restriction solely for these 1,000,000 shares and this surrender. All restrictions on the remaining shares continue.

3. BOARD ACCEPTANCE, RETIREMENT AND SHARE RECORDS

Tremaine Grant, acting as the Company's sole director, adopts these resolutions under Section 141(f) of the Delaware General Corporation Law: the Company accepts the surrender under Section 160; immediately after acquisition, the Company retires the 1,000,000 surrendered shares under Section 243. They resume the status of authorized and unissued Common Stock, available for lawful reservation and future issuance. The Company's total authorized Common Stock remains 10,000,000 shares. This transaction authorizes no cash distribution and directs no reduction of stated capital.

The officers are directed to record the surrender and retirement in the stock ledger at the Effective Time, retain this signed instrument with the corporate records, and cancel or appropriately endorse the surrendered portion of any existing stock certificate or electronic position. Any replacement evidence of the Founder's remaining position shall show 8,000,000 shares, without changing its original acquisition history, legends or continuing restrictions. A record entry must identify this signed agreement and the actual execution date; preparation or upload alone does not transfer shares.

4. CONTINUING VESTING OF THE REMAINING SHARES

The RSPA is amended by agreement of the Company and the Founder solely to reflect this proportionate reduction. The surrendered shares are allocated proportionately across the original vesting schedule. The remaining 8,000,000 shares retain the December 11, 2025 vesting commencement date, four-year vesting period, twelve-month cliff, continued-service conditions, and applicable acceleration provisions in the RSPA. There is no new vesting commencement date or acceleration caused by this surrender.

Subject to those existing conditions, 2,000,000 of the remaining shares become released from the repurchase option on December 11, 2026. The remaining 6,000,000 become released in thirty-six monthly installments through December 11, 2029. At month m following the cliff (m = 1 through 36), the cumulative number released is 2,000,000 plus the whole number obtained by rounding down 6,000,000 multiplied by m divided by 36. Each installment equals the increase in that cumulative amount. This produces exactly 8,000,000 shares over the schedule and preserves any release already earned under the governing agreement.

5. PRESERVATION OF OTHER RIGHTS

Except for this surrender, the specific transfer consent and the proportionate share-count adjustment, the RSPA and its related agreements remain in force. The original purchase consideration and intellectual-property assignment remain with the Company. This instrument grants no replacement award, fixes no tax valuation, waives no third-party financing right, and promises no tax result. Existing financing notice and consent obligations remain applicable according to their terms.

6. EXECUTION AND GOVERNING LAW

Delaware law governs this agreement. Electronic signatures and counterparts are effective. The single signature below is expressly given by Tremaine Grant individually as surrendering stockholder, on behalf of the Company as Chief Executive Officer to accept the surrender and amend the RSPA, and as sole director to adopt the resolutions in Section 3. Each capacity is independently assented to by that signature.

Tremaine Grant
Individually as surrendering stockholder; for Pulse Intelligence Labs, Inc. as Chief Executive Officer; and as its Sole Director
Signature: ________________________________
Execution date: recorded with the electronic signature
'''
reserve='''PULSE INTELLIGENCE LABS, INC.
EQUITY RESERVE APPROVAL
WRITTEN CONSENT OF THE SOLE DIRECTOR AND SOLE STOCKHOLDER

Document date: September 23, 2026

Tremaine Grant, constituting the sole director and sole holder of the Company's outstanding voting Common Stock, adopts the following resolutions in those respective capacities under Sections 141(f) and 228 of the Delaware General Corporation Law. This consent is executed after completion of the Company's Founder Share Surrender and Retirement Agreement. Its actual execution and delivery date, recorded with the electronic signature, is the "Approval Date."

1. FOUNDER RETURN AND CAPITALIZATION DETERMINATION

The undersigned confirms the completed surrender and retirement of 1,000,000 Common shares under the separately signed Founder Share Surrender and Retirement Agreement and the corresponding stock-ledger entry. The Founder consequently holds 8,000,000 issued and outstanding Common shares. The returned shares have resumed authorized and unissued status. The Certificate of Incorporation filed December 11, 2025, Delaware File Number 10434585, authorizes 10,000,000 Common shares at $0.00001 par value per share.

The Board approves the following authorized-share allocation and reservation schedule on the Approval Date:

Issued and outstanding Founder Common Stock: 8,000,000 shares.
Aggregate Equity Incentive Plan reserve: 1,600,000 shares.
Separate EDNA strategic reserve: 400,000 shares.
Total issued shares and reserved authorized shares: 10,000,000 shares.
Unallocated authorized shares outside these reserves: zero.

Reserved shares remain unissued until lawfully issued under their governing instruments. The 1,600,000-share Plan reserve includes existing awards and commitments under the Plan's share-counting rules; it is not added on top of them. The schedule preserves 25,000-option allocations each for Valerie Alexander and Marques Zak and identifies 500,000 shares as a proposed Chris Collins allocation, subject to its separate grant and class approvals. On that planning basis, 1,050,000 Plan shares remain unallocated. This consent itself grants none of those individual awards.

2. BOARD ADOPTION AND STOCKHOLDER APPROVAL OF PLAN AMENDMENT

The Board hereby adopts, and the sole stockholder separately approves, the Proposed Amendment to the Equity Incentive Plan prepared September 14, 2026 and attached as the Plan Amendment. The approval includes replacement of Plan Section 3.1 with the 1,600,000-share aggregate limit and addition of Section 3.5 concerning the separate strategic-partner reserve. The original Plan's remaining provisions, eligibility restrictions, share-counting rules and protections for outstanding awards remain unchanged. This approval includes the stockholder approval required by the Plan for the reserve amendment and, to the extent applicable, its incentive-stock-option provisions.

3. SEPARATE STRATEGIC RESERVE

The Board separately reserves 400,000 authorized and unissued Common shares outside the Plan: 200,000 for EDNA, Inc.'s Strategic Share Award and 200,000 for its additional Strategic Partnership Warrant. These shares are counted once, exclusively within this strategic reserve. This reservation supports the separate EDNA Board Consent and definitive instruments. Issuance remains subject to their own signatures, consideration approvals, reciprocal-delivery conditions and existing investor rights. No EDNA shares are issued by this reserve consent, and EDNA is not made a Plan participant.

4. LAUNCH NOTE AND FUTURE SHARE CAPACITY

The Company's $25,000 LAUNCH convertible promissory note is accounted for separately from the authorized-share allocation above. Its conversion rights, accrued interest, notices, participation rights and other contractual protections continue unchanged. The note's defined Fully-Diluted Capitalization includes converting securities on an as-converted basis and applies its own treatment of outstanding and promised options and the unissued option pool, including its limitation on pool increases. The 10,000,000 allocation total is not adopted as that contractual denominator or as a fixed conversion valuation or price.

The Board directs that conversion shares be calculated under the note at the applicable conversion event. Before a conversion or issuance requiring additional authorized shares, the Company must lawfully make sufficient shares available, including any necessary charter amendment and required corporate or investor actions. This consent imposes no obligation on the Founder to make another surrender. It waives no required notice or consent and changes no note term.

5. EFFECTIVENESS DETERMINATION AND RECORDING

Based on the completed founder return, the charter, the foregoing reservation schedule and the approvals in this consent, the Board determines that sufficient authorized and unissued Common shares exist for the amended Plan reserve and the separately reserved EDNA instruments. The existing charter requires no amendment merely to make these reservations of its already authorized Common Stock. No new class, individual grant or conversion is authorized here. Any notice, consent or filing required by an existing financing agreement for these specific reserve actions must have been completed before execution; by signing, the undersigned confirms that determination rather than waiving the requirement.

The Board records the Approval Date as the Plan Amendment Effective Date under Section 3 of the Plan Amendment. The officers shall retain this signed consent, its attached Plan Amendment and the founder-return ledger record together; record the Board adoption, stockholder approval, founder-return completion and Amendment Effective Date; and update the Plan reserve record to 1,600,000. Earlier Plan versions and their signatures remain historical records. Future issuances remain subject to sufficient shares and all applicable approvals and financing obligations.

6. SINGLE SIGNATURE IN SEPARATE CAPACITIES

By the signature below, Tremaine Grant first adopts these resolutions as sole director and then separately approves them as sole stockholder, holding all outstanding voting Common Stock after the founder return. He directs the Company to retain the consent with both its Board and stockholder records. Electronic execution and delivery are authorized; the signature record supplies the actual date.

Tremaine Grant
Sole Director and Sole Stockholder of Pulse Intelligence Labs, Inc.; Chief Executive Officer
Signature: ________________________________
Approval Date: recorded with the electronic signature

ATTACHMENT
Plan Amendment prepared September 14, 2026: the exact saved text presented with this signature request. Its historical preparation date remains unchanged; this signed consent records its adoption and effectiveness.
'''
cap='''PULSE INTELLIGENCE LABS, INC.
CAPITALIZATION AND SHARE-RESERVATION CERTIFICATE

Document date: September 23, 2026

Delivered under Section 2.2 of the Strategic Vesting Share Agreement with EDNA, Inc.

The undersigned, as sole director and Chief Executive Officer of Pulse Intelligence Labs, Inc., a Delaware corporation (the "Company"), certifies the following to EDNA, Inc. ("EDNA") as of the actual date recorded with the undersigned's electronic signature (the "Certification Date"). This certificate is executed after the founder share return and reserve approvals identified in Section 7 have been completed and recorded. Capitalized terms otherwise have the meanings in the Strategic Vesting Share Agreement (the "Share Agreement").

1. AUTHORIZED CAPITAL AND ISSUED SHARES

The Company's Certificate of Incorporation, filed December 11, 2025 with the Delaware Secretary of State, File Number 10434585, authorizes 10,000,000 shares of Common Stock, par value $0.00001 per share. Common Stock is the only authorized class; no preferred class is authorized.

Following the completed surrender and retirement of 1,000,000 founder shares, Tremaine Grant holds 8,000,000 issued and outstanding Common shares. Those shares constitute 100% of currently issued Common Stock. The shares remain subject to the original founder vesting terms as proportionately adjusted by the surrender agreement: commencement December 11, 2025, four years, and a twelve-month cliff. Reserved shares and unexercised rights are not issued stockholder ownership.

2. AUTHORIZED-SHARE ALLOCATION AND RESERVATIONS

Category | Shares | Percentage of the 10,000,000-share allocation
Founder Common Stock issued and outstanding | 8,000,000 | 80.0%
Equity Incentive Plan reserve | 1,600,000 | 16.0%
Separate EDNA strategic reserve | 400,000 | 4.0%
Total issued shares and reserved authorized shares | 10,000,000 | 100.0%

This table allocates the Company's authorized Common shares between issued shares and approved reservations. Its percentages use the stated 10,000,000-share allocation basis. They are not percentages of current issued-stock ownership, an as-converted capitalization calculation, or the "Fully-Diluted Capitalization" defined in the LAUNCH note. Conversion shares and their resulting dilution are addressed separately in Section 5. Unallocated authorized capacity outside the listed reserves is zero.

3. EQUITY INCENTIVE PLAN RESERVE

The aggregate Plan reserve is 1,600,000 shares, including awards and commitments chargeable under the Plan's share-counting provisions. The following recorded and planned allocations are included within that limit:

Chris Collins, Head of Strategic Advancement | 500,000 shares | Planned; separate grant approval and execution pending. Four-year vesting with a twelve-month cliff. This is 5.0% of the allocation basis in Section 2, not a certification of as-converted ownership. Any proposed non-voting class requires separate valid class authorization before issuance.
Valerie Alexander, advisor | 25,000 options | Awaiting required signatures; execution pending.
Marques Zak, advisor | 25,000 options | Awaiting required signatures; execution pending.
Unallocated planning balance | 1,050,000 shares | 1,600,000 less the 550,000 planned and pending allocations above.
Total Plan reserve | 1,600,000 shares.

Planning allocations are distinguished from effective grants. The certificate itself grants no award and verifies no recipient signature. Shares already counted under an award are not counted a second time as additional reserve.

4. STRATEGIC RESERVE FOR EDNA

Strategic Share Award | 200,000 Common shares | 2.0% of the Section 2 allocation basis; issued as vested over forty-eight months beginning September 11, 2026, subject to the Share Agreement.
Separate Strategic Partnership Warrant | Up to 200,000 Common shares | 2.0% of the Section 2 allocation basis; exercise and purchase terms remain in the separate Warrant.
Total strategic reserve | 400,000 Common shares | 4.0% of the Section 2 allocation basis.

The Company has separately reserved those 400,000 authorized and unissued Common shares for the two instruments. They are outside the Plan and are not committed to another purpose. The counts remain fixed, subject to the express proportionate corporate adjustments in the governing instruments. They provide no automatic top-up for financing or convertible-note dilution. Actual voting and stockholder rights attach only to issued shares. This certificate neither certifies EDNA's capitalization nor satisfies the separate requirement that EDNA's reciprocal Share Award meet the initial 2.0% closing condition.

5. CONVERTIBLE SECURITIES AND CALCULATION BASIS

LAUNCH (Founder University) convertible promissory note: $25,000 principal; 5% annual simple interest, computed on actual elapsed days over a 365-day year; maturity eighteen months after issuance under the note, subject to its demand and conversion provisions. The note's actual terms govern its issuance date, accrued balance, maturity and conversion rights.

In a qualifying preferred financing of at least $1,000,000, the note provides for conversion using the lesser of 80% of the financing price and the price derived from its $1,000,000 Target Valuation divided by its contractually defined Fully-Diluted Capitalization. The governing note determines treatment of principal and interest. Its other conversion and change-of-control provisions continue to apply.

For that contractual calculation, Fully-Diluted Capitalization includes issued and outstanding shares on an as-converted basis, converting securities including the LAUNCH note, issued and promised options, and the eligible unissued option pool. The definition limits inclusion of an option-pool increase, except to the extent needed to cover promised options exceeding the existing pool. Accordingly, neither the entire 1,600,000-share Plan reserve nor the 10,000,000 allocation total is automatically the denominator under the note.

No conversion share count, fixed conversion price or as-converted ownership percentage is certified here. Those amounts depend on the applicable conversion event, the convertible balance and the note's contractual inputs. The 2.0% figures in Section 4 describe only the specified allocation basis. Conversion may dilute the Founder, EDNA and other holders without changing EDNA's fixed award and warrant counts.

The proposed post-money SAFE with The Athletic Mind SPV I, LLC, for up to $1,400,000 at a $10,000,000 cap, remains unissued and is not counted as an outstanding convertible security in this certificate.

Before any conversion requiring more shares than are then legally available, the Company must obtain the necessary authorizations and make shares available through a lawful capital action, including a charter amendment if needed. No future founder surrender is promised. This certificate does not amend the note, defer a payment obligation, subordinate its rights, or establish that conversion capacity has already been reserved within the EDNA or Plan reserves.

6. CONTINUING INVESTOR RIGHTS

The LAUNCH note's rights of first offer or participation, most-favored-nation protections, information rights, notices, consents, and conversion protections remain in force to the extent provided by that instrument. Applicable notices and consents must be satisfied at the time and for the action required by the note. This certificate supplies no waiver or investor consent. The note governs in case of a discrepancy with this summary.

7. APPROVAL AND SUPPORTING RECORDS

The completed Founder Share Surrender and Retirement Agreement documents the reduction from 9,000,000 to 8,000,000 founder shares. The Equity Reserve Approval signed by the sole director and sole stockholder adopts the 1,600,000-share Plan amendment and separately establishes the 400,000-share strategic reservation. The PIL Board Consent concerning EDNA Strategic Equity approves the EDNA instruments subject to their stated conditions. Their actual signature dates and accompanying records are retained with this certificate.

The separate Consideration and Buyback-Cost Schedule sets out the noncash consideration value and separate Warrant exercise price, subject to its own signature and approval. The reciprocal contractual buyback agreement governs adoption of the negotiated buyback price. This capitalization certificate makes no new valuation or price determination. The remaining reciprocal-delivery, execution, securities and investor-rights conditions in the definitive agreements continue to govern effectiveness and issuance.

PULSE INTELLIGENCE LABS, INC.
Tremaine Grant
Sole Director and Chief Executive Officer
Signature: ________________________________
Certification Date: recorded with the electronic signature
'''
items=[('founder','pil-founder-share-return-2026-09-23','founder_share_return','PIL Founder Share Surrender and Retirement Agreement',founder,'PIL-Founder-Share-Return'),('reserve','pil-eip-reserve-approval-2026-09-23','equity_reserve_approval','PIL Equity Reserve Approval - Sole Director and Stockholder',reserve,'PIL-Equity-Reserve-Approval'),('certificate','XmKR9EaPEkeQZcQbaw0A','strategic_capitalization_certificate','PIL Capitalization and Share-Reservation Certificate - EDNA',cap,'PIL-Capitalization-and-Share-Reservation-Certificate-EDNA-Revised')]
manifest={}
for key,id,kind,title,content,name in items:
 content=content.strip()+'\n'
 manifest[key]={'id':id,'documentType':kind,'title':title,'content':content,'fileName':name+'.txt'}
 (out/(name+'.txt')).write_text(content)
(root/'src/content/equity/edna-capitalization-approvals.json').write_text(json.dumps(manifest,indent=2)+'\n')
print([(k,len(v['content'])) for k,v in manifest.items()])
