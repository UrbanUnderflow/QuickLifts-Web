/** Equity administration manages PIL-issued awards and their supporting documents. */
export function isIncomingEquityDocument(document: { title?: string; equityDirection?: string }): boolean {
  if (document.equityDirection === 'incoming') return true;
  // Compatibility for the existing reciprocal partnership packet, before direction was recorded.
  return /\bAuntEdna\s+Warrant\s+to\s+PIL\b|\bAuntEdna\s+Board\s+Consent\s+Strategic\s+Equity\b/i.test(document.title || '');
}
export function isOutgoingEquityWorkspaceDocument(document: { title?: string; equityDirection?: string; archivedFromEquity?: boolean }): boolean {
  return !document.archivedFromEquity && !isIncomingEquityDocument(document) && !isOperationalPartnershipDocument(document);
}

export function isOperationalPartnershipDocument(document: { title?: string }): boolean {
  return /PIL and AuntEdna.*(?:Strategic Partnership and Integration Agreement|Exhibit A Data Architecture and System Boundaries|Exhibit B Performance Standards and Service Levels)/i.test(document.title || '');
}
export function isEquityReferenceDocument(document: { title?: string; requiresSignature?: boolean }): boolean {
  return document.requiresSignature !== true && /Reciprocal Strategic Equity Side Letter/i.test(document.title || '');
}
export function isSendableEquityDocument(document: { title?: string; equityDirection?: string; archivedFromEquity?: boolean; requiresSignature?: boolean }): boolean {
  return isOutgoingEquityWorkspaceDocument(document) && !isEquityReferenceDocument(document);
}

/** Match the instrument, not just the recipient. Shared approvals support either award. */
export function documentMatchesAllocation(document: { title?: string; documentType?: string; allocationKind?: string }, kind?: string): boolean {
  if (!kind) return true;
  if (document.allocationKind) return document.allocationKind === kind;
  const label = `${document.documentType || ''} ${document.title || ''}`;
  if (/consent|capitalization|side letter/i.test(label)) return true;
  if (/reciprocal.*buyback|share.award.*(?:buyback|repurchase)|consideration.schedule/i.test(label)) return kind === 'vesting_shares';
  if (/warrant/i.test(label)) return kind === 'warrant';
  if (/equity agreement|vesting|restricted.stock|stock.purchase|stock.grant/i.test(label)) return kind === 'vesting_shares';
  return false;
}
