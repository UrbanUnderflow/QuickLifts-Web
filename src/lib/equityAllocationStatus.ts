import { getEquitySigningRequirements } from './equitySigningRequirements';
import { isEquityReferenceDocument } from './equityDocumentScope';
import { documentWorkflowLabel, evaluateDocumentSignatures, type ExecutionDocument, type ExecutionRequest } from './equityExecution';

type AllocationDocument = ExecutionDocument & { requiresSignature?: boolean; needsResendSignature?: boolean; closingRequirements?: readonly unknown[]; contractualBuybackRevision?: unknown };

/** Use the same party match for allocation status and its expanded package. */
export function matchesAllocationParty(document: { stakeholderId?: string | null; stakeholderName?: string | null }, name: string, stakeholderId?: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return stakeholderId ? document.stakeholderId === stakeholderId
    : Boolean(normalize(name)) && ` ${normalize(document.stakeholderName || '')} `.includes(` ${normalize(name)} `);
}

/** Call with the current document families shown in the expanded package. This never establishes issuance or vesting. */
export function allocationPackageStatus(documents: AllocationDocument[], requests: ExecutionRequest[], now = Date.now()) {
  const required = documents.filter(document => !isEquityReferenceDocument(document)
    && (document.requiresSignature !== false || Boolean(document.signingRequestIds?.length)));
  const hasAgreement = required.some(document => {
    const label = `${document.documentType} ${document.title || ''}`;
    return !/consent|capitalization|side.letter|buyback|repurchase|consideration.schedule/i.test(label)
      && /vesting|warrant|equity.agreement|stock.grant|stock.purchase|restricted.stock|option.agreement|advisor.nso/i.test(label);
  });
  if (!hasAgreement) return { signed: false, label: 'Planned', detail: 'An allocation agreement still needs to be linked to this package.' };
  const signed = required.length > 0 && required.every(document => !document.needsResendSignature && evaluateDocumentSignatures(document, requests, now).verified);
  if (signed) return { signed, label: 'Documents signed', detail: 'All current package signatures are verified. Issuance and vesting are tracked separately.' };
  const pending = required.filter(document => document.needsResendSignature || !evaluateDocumentSignatures(document, requests, now).verified);
  if (pending.some(document => document.needsResendSignature)) return { signed, label: 'Needs resend', detail: 'A current document requires updated signatures.' };
  if (pending.some(document => documentWorkflowLabel(document, requests) === 'Awaiting signatures')) return { signed, label: 'Awaiting signatures', detail: 'The current package still needs verified signatures.' };
  if (required.length && pending.every(document => documentWorkflowLabel(document, requests) === 'Ready to send' && !getEquitySigningRequirements(document).length)) return { signed, label: 'Ready to send', detail: 'Current documents are prepared for signature.' };
  return { signed, label: 'Planned', detail: 'The current signature package is not ready yet.' };
}
