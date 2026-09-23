type RequirementDocument = {
  id?: string;
  documentType?: string;
  contractualBuybackRevision?: unknown;
  closingRequirements?: readonly unknown[];
  issuanceRequirements?: readonly unknown[];
};

const reconciledEdnaIds = new Set(['pil-auntedna-vesting-shares-draft', 'pil-auntedna-20260909-04', 'pil-auntedna-20260909-07']);
const reviewedIssuanceConditions = new Set([
  'Complete PIL board approval of consideration value and the separate Warrant exercise price, and obtain bilateral adoption of the matching $0.10 contractual Share Award repurchase price',
  'Complete approved capitalization and reservation certificates and reciprocal EDNA award delivery, including the initial 2% condition',
  'Confirm EDNA corporate identity and obtain all required signatures and corporate and securities approvals',
]);

const isReviewedIssuanceCondition = (document: RequirementDocument, requirement: unknown) =>
  reconciledEdnaIds.has(document.id || '') && document.contractualBuybackRevision === 1 && typeof requirement === 'string' && reviewedIssuanceConditions.has(requirement);

/** Unsettled terms still block sending. Only reviewed coordinated-closing conditions move. */
export function getEquitySigningRequirements(document: RequirementDocument): unknown[] {
  return [...(document.closingRequirements || [])].filter(requirement => !isReviewedIssuanceCondition(document, requirement));
}

/** Signature collection does not establish reciprocal delivery or authorize share issuance. */
export function getEquityIssuanceRequirements(document: RequirementDocument): unknown[] {
  return [...new Set([...(document.issuanceRequirements || []), ...(document.closingRequirements || []).filter(requirement => isReviewedIssuanceCondition(document, requirement))])];
}

/** These documents must retain the package's verified board and reference prerequisites. */
export function requiresEquitySigningPackage(document: RequirementDocument): boolean {
  return reconciledEdnaIds.has(document.id || '') || document.id === 'pil-edna-reciprocal-buyback-agreement' || document.documentType === 'strategic_reciprocal_buyback_agreement';
}
