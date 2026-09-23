import {evaluateDocumentSignatures} from './equityExecution';
import {isSendableEquityDocument, isOutgoingEquityWorkspaceDocument} from './equityDocumentScope';
import {getEquitySigningRequirements} from './equitySigningRequirements';
export type PackageSigner = {name: string; email: string; role: string};
export type PackageSource = {id: string; title?: string; documentType?: string; content?: string; status?: string; requiresSignature?: boolean; closingRequirements?: unknown[]; issuanceRequirements?: unknown[]; contractualBuybackRevision?: number; approvalStatus?: string; capitalizationRevision?: number; prerequisiteDocumentIds?: string[]; capitalizationRecordedAt?: unknown; capitalizationLedgerEventId?: string; founderReturn?: Record<string, unknown>; reserveApproval?: Record<string, unknown>; preparedSigners?: PackageSigner[]; signingRequestIds?: string[]; signingRequestId?: string; autoSigned?: boolean; signedAt?: unknown; equityDirection?: string; archivedFromEquity?: boolean};
export const normalizePackageEmail = (email: string) => email.trim().toLowerCase();
const capitalizationIds = {certificate: 'XmKR9EaPEkeQZcQbaw0A', founder: 'pil-founder-share-return-2026-09-23', reserve: 'pil-eip-reserve-approval-2026-09-23', board: 'pil-auntedna-20260909-05', plan: 'pulse-eip-amendment-2026-09-14-v2'};
const exactIds = (actual: unknown, expected: string[]) => Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === expected.length && expected.every(id => actual.includes(id));
/** The revised certificate travels with the recorded approvals on which it relies. */
function capitalizationReferenceErrors(references: PackageSource[]): string[] {
  const certificates = references.filter(document => document.id === capitalizationIds.certificate || (document.documentType === 'strategic_capitalization_certificate' && document.capitalizationRevision !== undefined));
  if (!certificates.length) return [];
  const certificate = certificates[0];
  const prerequisites = [capitalizationIds.founder, capitalizationIds.reserve, capitalizationIds.board];
  if (certificates.length !== 1 || certificate.id !== capitalizationIds.certificate || certificate.documentType !== 'strategic_capitalization_certificate' || certificate.capitalizationRevision !== 1 || certificate.requiresSignature !== true || !exactIds(certificate.prerequisiteDocumentIds, prerequisites)) return ['The capitalization certificate must retain its reviewed revision and three supporting approval references.'];
  const errors: string[] = [];
  if (certificate.closingRequirements?.length) errors.push('The capitalization certificate has unresolved completion requirements.');
  for (const [id, type, label] of [[capitalizationIds.founder, 'founder_share_return', 'founder share return'], [capitalizationIds.reserve, 'equity_reserve_approval', 'EIP reserve approval']]) {
    const document = references.find(item => item.id === id);
    if (!document || document.documentType !== type || document.capitalizationRevision !== 1 || document.requiresSignature !== true || document.approvalStatus !== 'approved' || !document.capitalizationRecordedAt || document.capitalizationLedgerEventId !== id || document.closingRequirements?.length) errors.push(`Include the signed and recorded ${label} supporting the capitalization certificate.`);
  }
  const founder = references.find(document => document.id === capitalizationIds.founder);
  const founderTerms = founder?.founderReturn;
  if (founder && (!exactIds(founder.prerequisiteDocumentIds, []) || !founderTerms || founderTerms.sharesBefore !== 9000000 || founderTerms.sharesReturned !== 1000000 || founderTerms.sharesAfter !== 8000000 || founderTerms.vestingStartDate !== '2025-12-11' || founderTerms.vestingMonths !== 48 || founderTerms.cliffMonths !== 12)) errors.push('The founder return instructions no longer match the reviewed one-million-share return.');
  const reserve = references.find(document => document.id === capitalizationIds.reserve);
  const reserveTerms = reserve?.reserveApproval;
  if (reserve && (!exactIds(reserve.prerequisiteDocumentIds, [capitalizationIds.founder]) || !reserveTerms || reserveTerms.planDocumentId !== capitalizationIds.plan || reserveTerms.reserveShares !== 1600000 || reserveTerms.founderReturnDocumentId !== capitalizationIds.founder || typeof reserveTerms.planContentHash !== 'string' || !/^[a-f0-9]{64}$/i.test(reserveTerms.planContentHash))) errors.push('The EIP reserve approval instructions no longer match the reviewed plan and founder return.');
  const board = references.find(document => document.id === capitalizationIds.board);
  if (!board || board.documentType !== 'strategic_board_consent_pil' || board.requiresSignature !== true) errors.push('Include the signed EDNA board consent identified in the capitalization certificate.');
  return errors;
}
export function validatePackageSources(signable: PackageSource[], references: PackageSource[], verifiedBoardIds: Set<string>): string[] {
  const errors: string[] = [];
  if (!signable.length || signable.length > 8 || references.length > 12) errors.push('Select between one and eight signature documents and at most twelve references.');
  const ids = [...signable, ...references].map(doc => doc.id);
  if (new Set(ids).size !== ids.length) errors.push('Each document can appear only once in the package.');
  for (const doc of [...signable, ...references]) {
    if (!isOutgoingEquityWorkspaceDocument(doc) || doc.status !== 'completed' || !doc.content?.trim()) errors.push(`${doc.title || doc.id}: a completed outgoing document is required.`);
  }
  for (const doc of signable) {
    if (!isSendableEquityDocument(doc) || doc.requiresSignature !== true || /board.consent|capitalization|consideration/i.test(doc.documentType || '')) errors.push(`${doc.title || doc.id}: include this document as a reference, not a recipient signature.`);
    if (getEquitySigningRequirements(doc).length) errors.push(`${doc.title || doc.id}: resolve the closing requirements before sending.`);
    const roster = doc.preparedSigners || [];
    if (!roster.length || roster.length > 12 || roster.some(s => !s.name?.trim() || !s.role?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email || '')) || new Set(roster.map(s => `${normalizePackageEmail(s.email)}:${s.role.trim().toLowerCase()}`)).size !== roster.length) errors.push(`${doc.title || doc.id}: complete the required signer roster.`);
    if (doc.signingRequestIds?.length || doc.signingRequestId || doc.autoSigned || doc.signedAt) errors.push(`${doc.title || doc.id}: a signing packet already exists; use its existing links instead of replacing it.`);
  }
  if (!references.some(doc => /board.consent/i.test(doc.documentType || '') && verifiedBoardIds.has(doc.id))) errors.push('Include the board consent with verified signatures.');
  for (const category of ['capitalization', 'consideration']) {
    if (!references.some(doc => new RegExp(category === 'capitalization' ? 'capitalization|cap_table' : category, 'i').test(`${doc.documentType} ${doc.title}`) && doc.approvalStatus === 'approved')) errors.push(`Include the approved ${category} document.`);
  }
  for (const doc of references) {
    if (doc.requiresSignature === true && !verifiedBoardIds.has(doc.id)) errors.push(`${doc.title || doc.id}: required reference signatures have not been verified.`);
    if (/board.consent/i.test(doc.documentType || '') && !verifiedBoardIds.has(doc.id)) errors.push(`${doc.title || doc.id}: board signatures have not been verified.`);
    else if (!/board.consent/i.test(doc.documentType || '') && doc.approvalStatus !== 'approved') errors.push(`${doc.title || doc.id}: the reference must be approved before inclusion.`);
  }
  errors.push(...capitalizationReferenceErrors(references));
  return [...new Set(errors)];
}
export function packageRecipients(documents: PackageSource[]): PackageSigner[] {
  const recipients = new Map<string, PackageSigner>();
  for (const document of documents) for (const signer of document.preparedSigners || []) {
    const email = normalizePackageEmail(signer.email);
    if (!recipients.has(email)) recipients.set(email, {...signer, email, name: signer.name.trim()});
  }
  return [...recipients.values()];
}

/** Revalidate immutable snapshots at delivery and at signature time. */
const expirationTime = (value: any): number => value?.toMillis?.() ?? (typeof value?.seconds === 'number' ? value.seconds * 1000 : value instanceof Date ? value.getTime() : Date.parse(value));
const expired = (value: any, now: number) => value !== undefined && value !== null && (!Number.isFinite(expirationTime(value)) || expirationTime(value) <= now);
export function validatePreparedPackage(root: any, documents: any[], requests: any[], now = Date.now()): string[] {
  const errors: string[] = [];
  if (root.documentType !== 'strategic_signing_package' || root.previewMode || root.invalidatedAt || expired(root.expiresAt, now) || !Array.isArray(root.packageDocuments) || !root.packageDocuments.length || root.packageDocuments.length > 24) return ['This package is invalid, expired, or unavailable.'];
  const items = root.packageDocuments;
  if (items.some((item: any) => !item || !['sign', 'reference'].includes(item.mode))) return ['This package contains an invalid document mode.'];
  const signItems = items.filter((item: any) => item.mode === 'sign');
  const referenceItems = items.filter((item: any) => item.mode === 'reference');
  const expectedIds = signItems.map((item: any) => item.requestId);
  const childIds = root.childRequestIds;
  if (!signItems.length || signItems.length > 96 || referenceItems.length > 20 || new Set(signItems.map((item: any) => item.id)).size > 8 || !Array.isArray(childIds) || childIds.length !== expectedIds.length || expectedIds.some((id: any) => typeof id !== 'string' || !id) || new Set(childIds).size !== childIds.length || new Set(expectedIds).size !== expectedIds.length || expectedIds.some((id: string) => !childIds.includes(id))) return ['The package signature requests do not match its document list.'];
  const references: PackageSource[] = [];
  for (const item of items) {
    const source = documents.find(document => document.id === item.id);
    if (!source || source.content !== item.content || source.status !== 'completed' || !isOutgoingEquityWorkspaceDocument(source)) { errors.push(`${item.title}: the document changed. Prepare a new package.`); continue; }
    if (item.mode === 'sign') {
      const request = requests.find(request => request.id === item.requestId);
      const rosterMatches = request && Array.isArray(source.preparedSigners) && source.preparedSigners.filter((signer: PackageSigner) => normalizePackageEmail(signer.email || '') === normalizePackageEmail(request.recipientEmail || '') && signer.role?.trim().toLowerCase() === request.signerRole?.trim().toLowerCase()).length === 1;
      if (!request || !rosterMatches || source.requiresSignature !== true || !['pending', 'sent', 'delivered', 'opened', 'viewed', 'signed'].includes(request.status) || expired(request.expiresAt, now) || request.packageId !== root.id || request.previewMode || request.invalidatedAt || request.equityDocumentId !== source.id || request.documentContent !== source.content || normalizePackageEmail(request.recipientEmail || '') !== normalizePackageEmail(root.recipientEmail || '') || !source.signingRequestIds?.includes(request.id) || request.signingGroupId !== source.signingGroupId || source.needsResendSignature || getEquitySigningRequirements(source).length || !isSendableEquityDocument(source)) errors.push(`${item.title}: the signature request is no longer current.`);
    } else {
      references.push(source);
      if (source.requiresSignature === true && !evaluateDocumentSignatures(source, requests).verified) errors.push(`${item.title}: required reference signatures are no longer current.`);
      if (!/board.consent/i.test(source.documentType || '') && source.approvalStatus !== 'approved') errors.push(`${item.title}: reference approval is no longer current.`);
    }
  }
  // Signature verification itself is performed by callers using evaluateDocumentSignatures.
  if (!references.some(document => /board.consent/i.test(document.documentType || ''))) errors.push('The board consent is missing.');
  for (const category of ['capitalization', 'consideration']) if (!references.some(document => new RegExp(category === 'capitalization' ? 'capitalization|cap_table' : category, 'i').test(`${document.documentType} ${document.title}`) && document.approvalStatus === 'approved')) errors.push(`The approved ${category} reference is missing.`);
  errors.push(...capitalizationReferenceErrors(references));
  return [...new Set(errors)];
}
