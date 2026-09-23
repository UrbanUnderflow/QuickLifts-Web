import source from '../content/equity/edna-reconciled-package.json';
import {EDNA_PACKAGE_IDS} from './ednaReconciledPackage';

export interface EdnaBuybackSourceDocument {
  id: string;
  content: string;
  closingRequirements?: string[];
  signingRequestId?: string | null;
  signingRequestIds?: string[];
  signedAt?: unknown;
  autoSigned?: boolean;
  autoSignedAt?: unknown;
  signatureData?: unknown;
  status?: string;
  approvalStatus?: string;
}

const originalPrice = '(c) Price. The repurchase price is EDNA’s original acquisition cost for the repurchased shares, determined from the contemporaneous board-approved consideration record required by Sections 2.2–2.3, without subsequent appreciation, and equitably adjusted for stock splits and similar recapitalizations. EDNA pays no cash purchase price for this Share Award; its consideration is noncash. Accordingly, the original cost is the portion of the expressly documented and board-approved noncash consideration value allocable to the shares repurchased, plus any cash actually paid for those shares. The separate Warrant’s exercise price, current fair market value, and par value alone do not determine this price. The board-approved record must state the per-share allocation before closing. Absence of that record does not create a zero-cost repurchase right. A price dispute is resolved under Section 7.2; PIL may timely exercise its option while the disputed price is determined, with closing following that determination subject to subsection (e).';

export const EDNA_CONTRACTUAL_REPURCHASE_CLAUSE = '(c) Price. Upon authorized execution of this Agreement and the matching reciprocal instruments and satisfaction of Section 6, the contractual repurchase price is $0.10 per Share Award share repurchased, for a maximum aggregate price of $20,000 if all 200,000 Share Award shares are repurchased. A partial repurchase is priced proportionally at $0.10 multiplied by the number of shares repurchased. The per-share price and share count shall be equitably and inversely adjusted for stock splits, combinations and similar recapitalizations so that the aggregate price for the full adjusted award remains $20,000. No subsequent appreciation is included. This is a separately negotiated contractual price, independent of the board’s determination of fair market value, the noncash consideration value or tax basis, par value, and the separate Warrant’s exercise price. It does not change any of those amounts. The same contractual price and full-award maximum shall apply to EDNA’s repurchase of its reciprocal 200,000-share Share Award issued to PIL under the duly executed matching reciprocal instruments. The repurchase triggers, notice, cure, final-determination, exercise, closing and legal limitations in this Section remain applicable. A price-calculation dispute is resolved under Section 7.2; PIL may timely exercise its option while that dispute is determined, with closing following that determination subject to subsection (e).';

const sideLetterPrice = 'The Parties agree, upon authorized execution of this revised Side Letter and the matching reciprocal Share Award instruments and satisfaction of the coordinated closing conditions, to the contractual repurchase price in Section 3.5(c) of the PIL Strategic Vesting Share Agreement: $0.10 per Share Award share repurchased, or $20,000 for all 200,000 shares of each Party’s Share Award. Partial repurchases are proportional, and stock-split and similar adjustments shall preserve that full-award aggregate price. The reciprocal award shall contain matching substantive repurchase protections and the same contractual price, unless both Parties expressly approve a difference in writing with required approvals before closing. The option applies to issued Share Award shares, including vested shares, following the specified fraud, intellectual-property theft, misconduct or uncured material breach. The applicable notice, cure, final-determination, exercise, closing and legal-limit provisions remain in force. This provision expressly qualifies preservation of vested Share Award shares elsewhere in this Side Letter. It does not create automatic forfeiture, extend a repurchase option to Warrant shares, determine fair market value or tax basis, or change either Party’s noncash consideration value or Warrant exercise price. An unsigned proposal, storage of this text, or unilateral approval does not constitute bilateral adoption.';

const boardPrice = 'The Board expressly approves Section 3.5 of the attached PIL Strategic Vesting Share Agreement, including the option to repurchase issued Share Award shares, including vested shares, at a negotiated contractual price of $0.10 per share repurchased, or $20,000 for all 200,000 shares, after the specified fraud, intellectual-property theft, misconduct, or uncured material breach, subject to its notice, cure, final-determination, exercise and legal-limit provisions. Partial repurchases are proportional, and stock-split and similar adjustments shall preserve that full-award aggregate price. Adoption of this contractual price is subject to authorized bilateral execution of the matching reciprocal instruments and all closing conditions; the same price shall apply to EDNA’s repurchase of its reciprocal Share Award issued to PIL. This Board approval alone does not establish EDNA’s agreement. The option applies to Share Award shares; this consent does not extend it to Warrant shares. Before either instrument becomes effective, the Board must approve a written consideration schedule documenting the strategic noncash consideration and its legally sufficient aggregate value and per-share allocation separately from the contractual repurchase price. The Board must separately approve the Warrant exercise price and aggregate exercise cost. The $0.10 contractual repurchase price is not a determination of fair market value, noncash consideration value or tax basis, and this consent supplies no new amount for those values or for the separate Warrant exercise price.';

function sourceParagraph(text: string, startsWith: string): string {
  const matches = text.split('\n\n').filter(paragraph => paragraph.startsWith(startsWith));
  if (matches.length !== 1) throw new Error('The EDNA source package needs review before revising its repurchase terms.');
  return matches[0];
}

/** Exact, idempotent replacements avoid silently rewriting unfamiliar or partly amended legal terms. */
function replaceKnown(text: string, before: string, after: string): string {
  const oldCount = text.split(before).length - 1;
  const newCount = text.split(after).length - 1;
  if (oldCount === 0 && newCount === 1) return text;
  if (oldCount !== 1 || newCount !== 0) throw new Error('The EDNA repurchase terms differ from the reviewed draft. Review them before applying this revision.');
  return text.replace(before, after);
}

function reviseAgreement(content: string): string {
  if (!content.includes('exactly 200,000 shares of PIL common stock') || !content.includes('6.4 Relationship to Side Letter.')) {
    throw new Error('Apply the settled EDNA vesting agreement before revising the repurchase price.');
  }
  let revised = replaceKnown(content, '3.5 Company option to repurchase at original cost.', '3.5 Company option to repurchase at contractual price.');
  revised = replaceKnown(revised, originalPrice, EDNA_CONTRACTUAL_REPURCHASE_CLAUSE);
  revised = replaceKnown(revised,
    'Noncash consideration: Strategic undertakings and contributions under the Partnership Agreement and Side Letter, with lawful value and per-share cost allocation documented by PIL’s board before closing.',
    'Noncash consideration: Strategic undertakings and contributions under the Partnership Agreement and Side Letter, with lawful value and per-share allocation documented by PIL’s board before closing, separately from the contractual repurchase price.');
  revised = replaceKnown(revised,
    'Repurchase: At original acquisition cost for Repurchase Events under Section 3.5, including vested shares.',
    'Repurchase: At the contractual price of $0.10 per Share Award share for Repurchase Events under Section 3.5, including vested shares; $20,000 for all 200,000 shares, with proportional partial repurchases and the corporate adjustments in Section 3.5(c). Effective only upon bilateral adoption and satisfaction of Section 6.');
  return replaceKnown(revised,
    'The parties’ board-approved capitalization and share-reservation certificates, PIL’s documented consideration value and per-share original-cost allocation, required corporate consents, and reciprocal award delivery evidence shall be delivered with the coordinated closing package.',
    'The parties’ board-approved capitalization and share-reservation certificates, PIL’s documented consideration value and per-share allocation, the adopted contractual repurchase-price schedule, required corporate consents, and matching reciprocal award and repurchase terms shall be delivered with the coordinated closing package.');
}

/**
 * Prepares four unsigned package revisions. It never creates approvals, signatures, or requests.
 * Warrant text remains unchanged; its shared closing checklist follows the adopted price terminology.
 */
export function reviseEdnaContractualBuyback<T extends EdnaBuybackSourceDocument>(documents: readonly T[]): T[] {
  if (documents.length !== EDNA_PACKAGE_IDS.length || new Set(documents.map(document => document.id)).size !== EDNA_PACKAGE_IDS.length || EDNA_PACKAGE_IDS.some(id => !documents.some(document => document.id === id))) {
    throw new Error('Exactly the four current EDNA package documents are required.');
  }
  for (const document of documents) {
    if (!document.content?.trim()) throw new Error('An EDNA package document has no saved content.');
    if (document.signingRequestId || document.signingRequestIds?.length || document.signedAt || document.autoSigned || document.autoSignedAt || document.signatureData || ['signed', 'executed'].includes(document.status || '') || document.approvalStatus === 'approved') {
      throw new Error('An EDNA package document has signing or approval history. Preserve it and prepare a separate amendment.');
    }
  }
  const oldSideLetter = sourceParagraph(source.sideLetter, 'The Parties expressly approve the option in Section 3.5');
  const oldBoard = sourceParagraph(source.board, 'The Board expressly approves Section 3.5');
  const oldClosing = 'Complete PIL board approval of consideration value, original acquisition cost per share, and the separate Warrant exercise price';
  const newClosing = 'Complete PIL board approval of consideration value and the separate Warrant exercise price, and obtain bilateral adoption of the matching $0.10 contractual Share Award repurchase price';
  return documents.map(document => {
    let content = document.content;
    if (document.id === EDNA_PACKAGE_IDS[0]) content = reviseAgreement(content);
    if (document.id === EDNA_PACKAGE_IDS[1]) {
      content = replaceKnown(content, '4.6 Repurchase of PIL Share Award Shares', '4.6 Reciprocal Share Award Repurchase');
      content = replaceKnown(content, oldSideLetter, sideLetterPrice);
    }
    if (document.id === EDNA_PACKAGE_IDS[2]) content = replaceKnown(content, oldBoard, boardPrice);
    return {...document, content, ...(document.closingRequirements ? {closingRequirements: document.closingRequirements.map(requirement => {
      if (requirement === oldClosing) return newClosing;
      if (/original acquisition cost|original-cost|repurchase.*(?:fair market|\$0\.01)/i.test(requirement)) {
        throw new Error('An unfamiliar repurchase closing requirement needs review.');
      }
      return requirement;
    })} : {})};
  });
}
