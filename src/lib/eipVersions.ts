/** EIP versions are independent documents; editing never overwrites a prior version. */
export interface EipVersionReference {
  id: string;
  documentType: string;
  originalDocumentId?: string;
  sourceDocumentId?: string;
  versionNumber?: number;
  approvalStatus?: string;
  autoSigned?: boolean;
  autoSignedAt?: unknown;
  status?: string;
}

export function eipFamilyId(document: EipVersionReference): string {
  return document.originalDocumentId || document.id;
}

export function isApprovedEip(document: EipVersionReference): boolean {
  return document.documentType === 'eip' && document.status === 'completed' &&
    (document.approvalStatus === 'approved' ||
      (!document.approvalStatus && Boolean(document.autoSigned || document.autoSignedAt)));
}

export function nextEipVersion(source: EipVersionReference, documents: EipVersionReference[]): number {
  const family = eipFamilyId(source);
  return Math.max(1, ...documents.filter(d => d.documentType === 'eip' && eipFamilyId(d) === family)
    .map(d => d.versionNumber || 1)) + 1;
}

export function eipDraftText(content: string): string {
  // Legacy EIPs have an adoption footer. Its signature belongs only to that version.
  const unsigned = content.replace(/^#{1,3}\s+11\.\s+Adoption Footer\s*$[\s\S]*?(?=^#{1,2}\s|$(?![\s\S]))/m,
    '## 11. Approval of This Version\n\nThis draft requires separate corporate approval. Prior signatures do not approve this version.\n\nAuthorized signature: ____________________\nName and capacity: ____________________\nActual execution date: ____________________\nEffective date, following required approvals: ____________________\n\n');
  return unsigned.startsWith('DRAFT - NOT APPROVED') ? unsigned : `DRAFT - NOT APPROVED\n\n${unsigned}`;
}

export function buildEipDraftVersion(source: EipVersionReference, options: {
  title: string; content: string; changeSummary: string; versionNumber: number; now: unknown;
}) {
  if (!options.title.trim() || !options.content.trim() || !options.changeSummary.trim()) {
    throw new Error('Enter a title, full draft text, and a change summary.');
  }
  if (/\/s\/\s*\S/i.test(options.content)) {
    throw new Error('Remove copied signatures from the new draft. The original signed version is preserved separately.');
  }
  return {
    title: options.title.trim(), content: eipDraftText(options.content.trim()),
    prompt: options.changeSummary.trim(), changeSummary: options.changeSummary.trim(),
    documentType: 'eip', status: 'completed', approvalStatus: 'draft',
    requiresSignature: true, autoSigned: false, isAmendment: true,
    originalDocumentId: eipFamilyId(source), sourceDocumentId: source.id,
    versionNumber: options.versionNumber,
    createdAt: options.now, updatedAt: options.now,
    // An unsigned draft must not silently become the plan used for other grants.
    closingRequirements: ['Confirm required corporate approvals and effective date before adopting this EIP version.'],
    revisionHistory: [{ prompt: options.changeSummary.trim(), timestamp: options.now }],
    exhibits: [source.id],
  };
}
