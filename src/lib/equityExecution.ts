import { resolveEquityPlan, type PlanDocument } from './equityPlanState';

export interface ExecutionGrant {
  id: string; status: string; stakeholderId?: string; numberOfShares: number;
  strikePrice?: number; vestingSchedule?: string; vestingStartDate?: unknown; cliffMonths?: number; vestingMonths?: number;
  earlyExerciseAllowed?: boolean; equityDocumentId?: string; boardConsentDocId?: string;
  documents?: Array<{ id: string; documentType?: string }>;
}
export interface ExecutionStakeholder {
  id: string; email: string; grants?: ExecutionGrant[]; boardConsentDocId?: string | null;
  documents?: Array<{ id: string; documentType?: string }>;
}
export interface ExecutionDocument extends PlanDocument {
  updatedAt?: unknown; stakeholderId?: string | null; grantId?: string; signingRequestIds?: string[]; signingGroupId?: string;
  preparedSigners?: Array<{ role: string; email: string; name?: string }>;
  grantDetails?: Partial<ExecutionGrant>;
  executionVerification?: { method?: string; reviewedBy?: string; reviewedAt?: unknown; documentContent?: string };
}
export interface ExecutionRequest {
  id: string; equityDocumentId?: string; stakeholderId?: string; status: string;
  recipientEmail?: string; signerRole?: string; signingGroupId?: string; documentContent?: string;
  previewMode?: boolean; invalidatedAt?: unknown; signedAt?: unknown; sentAt?: unknown;
  signatureData?: { typedName?: string; timestamp?: unknown; signedAt?: unknown; verificationMethod?: string; verifiedEmail?: string; verifiedUid?: string };
}
export interface GrantExecutionResult {
  status: 'verified' | 'pending' | 'terminated' | 'revoked' | 'exercised';
  label: string; reasons: string[]; documentId: string | null; requestIds: string[]; verified: boolean;
  vesting: { vested: number; unvested: number } | null;
}

function milliseconds(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  if (value && typeof value === 'object') {
    if ('toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
    if ('seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
  }
  return NaN;
}
const normalized = (value?: string) => value?.trim().toLowerCase() || '';
const role = (value?: string) => normalized(value).replace(/\s+/g, ' ');
const agreementTypes = new Set(['advisor_nso_agreement', 'advisor_nso', 'option_agreement', 'stock_grant', 'stock_grant_agreement', 'restricted_stock_agreement']);

function signatureReasons(document: ExecutionDocument, requests: ExecutionRequest[], now: number, recipientEmail?: string): string[] {
  const reasons: string[] = [];
  const ids = document.signingRequestIds || [];
  if (!ids.length || new Set(ids).size !== ids.length) return ['The current signature packet is missing or ambiguous.'];
  const selected = ids.map(id => requests.find(request => request.id === id));
  if (selected.some(request => !request)) return ['A required signature request is missing.'];
  const current = selected as ExecutionRequest[];
  const groups = new Set(current.map(request => request.signingGroupId));
  if (groups.size !== 1 || !current[0].signingGroupId || (document.signingGroupId && current[0].signingGroupId !== document.signingGroupId)) reasons.push('Signatures do not belong to the current packet.');
  const prepared = document.preparedSigners || [];
  if (prepared.length) {
    if (prepared.some(signer => !normalized(signer.email) || !role(signer.role)) || new Set(prepared.map(signer => `${role(signer.role)}:${normalized(signer.email)}`)).size !== prepared.length) reasons.push('The required signer roster needs review.');
    if (current.length !== prepared.length || prepared.some(signer => current.filter(request => role(request.signerRole) === role(signer.role) && normalized(request.recipientEmail) === normalized(signer.email)).length !== 1)) reasons.push('Required signer roles or email addresses do not match the prepared agreement.');
  } else if (!recipientEmail) reasons.push('The required signer roster is missing.');
  if (recipientEmail) {
    const recipients = current.filter(request => ['recipient', 'advisor', 'employee', 'grantee', 'optionee', 'participant'].includes(role(request.signerRole)));
    const companies = current.filter(request => ['company', 'company representative', 'authorized company representative'].includes(role(request.signerRole)));
    if (recipients.length !== 1 || normalized(recipients[0]?.recipientEmail) !== normalized(recipientEmail)) reasons.push('The recipient signature must match the shareholder email and recipient role.');
    if (companies.length !== 1 || normalized(companies[0]?.recipientEmail) === normalized(recipientEmail)) reasons.push('A separate company signature is required.');
    if (!prepared.length && current.length !== 2) reasons.push('The company and recipient signature packet needs review.');
  } else if (document.documentType === 'board_consent' && prepared.some(signer => !/\bdirector\b/.test(role(signer.role)))) reasons.push('Board approval requires the complete director signer roster.');
  for (const request of current) {
    const signature = request.signatureData;
    if (request.previewMode || request.invalidatedAt || request.status !== 'signed') { reasons.push('A required signature is pending, invalidated, or a preview.'); continue; }
    if (request.equityDocumentId !== document.id || request.documentContent !== document.content || !document.content?.trim()) reasons.push('The signed text does not match the current agreement.');
    if (recipientEmail && normalized(request.recipientEmail) === normalized(recipientEmail) && request.stakeholderId && request.stakeholderId !== document.stakeholderId) reasons.push('A signature request belongs to a different shareholder.');
    const signedAt = milliseconds(request.signedAt);
    const signatureAt = milliseconds(signature?.timestamp ?? signature?.signedAt);
    if (!signature?.typedName?.trim() || !Number.isFinite(signedAt) || !Number.isFinite(signatureAt) || signedAt > now || signatureAt > now) reasons.push('A signature name or valid execution timestamp is missing.');
    if (signature?.verificationMethod !== 'firebase-auth' || !signature.verifiedUid?.trim() || !normalized(signature.verifiedEmail) || normalized(signature.verifiedEmail) !== normalized(request.recipientEmail)) reasons.push('Signer identity has not been verified by the signing service.');
  }
  return [...new Set(reasons)];
}

export function documentWorkflowLabel(document: ExecutionDocument, requests: ExecutionRequest[]): 'Planned' | 'Ready to send' | 'Awaiting signatures' {
  const currentIds = new Set(document.signingRequestIds || []);
  const sent = requests.some(request => currentIds.has(request.id)
    && request.equityDocumentId === document.id && !request.previewMode && !request.invalidatedAt
    && (!document.signingGroupId || document.signingGroupId === request.signingGroupId)
    && (['sent', 'delivered', 'opened', 'viewed', 'signed'].includes(request.status) || Number.isFinite(milliseconds(request.sentAt))));
  if (sent) return 'Awaiting signatures';
  return document.status === 'completed' && Boolean(document.content?.trim()) ? 'Ready to send' : 'Planned';
}

export function evaluateGrantExecution(input: {
  stakeholder: ExecutionStakeholder; grant: ExecutionGrant; documents: ExecutionDocument[]; requests: ExecutionRequest[]; now?: number;
}): GrantExecutionResult {
  const { stakeholder, grant, documents, requests, now = Date.now() } = input;
  const base: GrantExecutionResult = { status: 'pending', label: 'Planned', reasons: [], documentId: null, requestIds: [], verified: false, vesting: null };
  if (['terminated', 'revoked', 'exercised'].includes(grant.status)) return { ...base, status: grant.status as 'terminated' | 'revoked' | 'exercised', label: grant.status[0].toUpperCase() + grant.status.slice(1), reasons: ['This grant is closed and cannot become active through signature verification.'] };
  if (grant.stakeholderId && grant.stakeholderId !== stakeholder.id) base.reasons.push('The grant belongs to a different shareholder.');
  const linked = new Set([grant.equityDocumentId, ...(grant.documents || []).map(item => item.id)].filter(Boolean));
  let candidates = documents.filter(document => agreementTypes.has(document.documentType) && ((Boolean(grant.id) && document.grantId === grant.id) || linked.has(document.id)));
  if (!candidates.length && stakeholder.grants?.length === 1 && stakeholder.grants[0].id === grant.id) {
    const holderLinks = new Set((stakeholder.documents || []).map(item => item.id));
    candidates = documents.filter(document => agreementTypes.has(document.documentType) && (holderLinks.has(document.id) || document.stakeholderId === stakeholder.id) && !document.grantId);
  }
  if (!candidates.length) return { ...base, reasons: [...base.reasons, 'No agreement is linked unambiguously to this grant.'] };
  candidates.sort((a, b) => (milliseconds(b.updatedAt ?? b.createdAt) || 0) - (milliseconds(a.updatedAt ?? a.createdAt) || 0) || (b.versionNumber || 1) - (a.versionNumber || 1));
  const agreement = candidates[0];
  base.label = documentWorkflowLabel(agreement, requests);
  base.documentId = agreement.id;
  base.requestIds = agreement.signingRequestIds || [];
  if (candidates[1] && (milliseconds(candidates[1].updatedAt ?? candidates[1].createdAt) || 0) === (milliseconds(agreement.updatedAt ?? agreement.createdAt) || 0) && (candidates[1].versionNumber || 1) === (agreement.versionNumber || 1)) base.reasons.push('More than one current grant agreement needs review.');
  if (agreement.status !== 'completed' || agreement.stakeholderId !== stakeholder.id || (agreement.grantId && agreement.grantId !== grant.id)) base.reasons.push('The current agreement is incomplete or belongs to another grant or shareholder.');
  base.reasons.push(...signatureReasons(agreement, requests, now, stakeholder.email));
  const boardId = grant.boardConsentDocId || stakeholder.boardConsentDocId;
  const board = documents.find(document => document.id === boardId);
  if (!board || board.documentType !== 'board_consent' || board.status !== 'completed' || board.stakeholderId !== stakeholder.id || (board.grantId && board.grantId !== grant.id)) base.reasons.push('Recorded board approval for this grant is missing.');
  else {
    const boardTerms = board.grantDetails;
    if (!boardTerms || ['numberOfShares', 'strikePrice', 'cliffMonths', 'vestingMonths', 'earlyExerciseAllowed', 'vestingSchedule'].some(field => boardTerms[field as keyof ExecutionGrant] === undefined || boardTerms[field as keyof ExecutionGrant] !== grant[field as keyof ExecutionGrant]) || !Number.isFinite(milliseconds(boardTerms.vestingStartDate)) || milliseconds(boardTerms.vestingStartDate) !== milliseconds(grant.vestingStartDate)) base.reasons.push('Board approval terms must match this grant.');
    // A review note alone is not retained evidence of an executed board approval.
    if (signatureReasons(board, requests, now).length) base.reasons.push('Board approval needs verified signatures from the complete director roster.');
  }
  if (!resolveEquityPlan(documents, now).active) base.reasons.push('An effective equity incentive plan is required.');
  const terms = agreement.grantDetails;
  const fields = ['numberOfShares', 'strikePrice', 'cliffMonths', 'vestingMonths', 'earlyExerciseAllowed', 'vestingSchedule'] as const;
  const start = milliseconds(grant.vestingStartDate);
  const matching = Boolean(terms) && fields.every(field => grant[field] !== undefined && terms![field] !== undefined && grant[field] === terms![field]) && Number.isFinite(start) && milliseconds(terms?.vestingStartDate) === start;
  const monthlySchedules: Record<string, { months: number; cliff: number }> = {
    '4-year-1-cliff': { months: 48, cliff: 12 },
    '4-year-monthly': { months: 48, cliff: 0 },
    '2-year-monthly': { months: 24, cliff: 0 },
  };
  const schedule = monthlySchedules[grant.vestingSchedule || ''];
  if (grant.vestingSchedule !== 'monthly' && (!schedule || schedule.months !== grant.vestingMonths || schedule.cliff !== grant.cliffMonths)) base.reasons.push('This vesting schedule requires review before calculating monthly vesting.');
  const valid = Number.isSafeInteger(grant.numberOfShares) && grant.numberOfShares > 0 && typeof grant.strikePrice === 'number' && Number.isFinite(grant.strikePrice) && grant.strikePrice >= 0 && typeof grant.earlyExerciseAllowed === 'boolean' && Number.isInteger(grant.cliffMonths) && grant.cliffMonths! >= 0 && Number.isInteger(grant.vestingMonths) && grant.vestingMonths! > 0 && grant.cliffMonths! <= grant.vestingMonths!;
  if (!matching || !valid) base.reasons.push('The signed agreement must match all share, price, vesting, and early-exercise terms.');
  base.reasons = [...new Set(base.reasons)];
  if (base.reasons.length) {
    return base;
  }
  const startDate = new Date(start);
  const currentDate = new Date(now);
  let months = (currentDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + currentDate.getUTCMonth() - startDate.getUTCMonth();
  const anniversary = new Date(start);
  anniversary.setUTCDate(1);
  anniversary.setUTCMonth(startDate.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 1, 0)).getUTCDate();
  anniversary.setUTCDate(Math.min(startDate.getUTCDate(), lastDay));
  if (now < anniversary.getTime()) months--;
  months = Math.max(0, months);
  const vested = months < grant.cliffMonths! ? 0 : Math.floor(grant.numberOfShares * Math.min(months, grant.vestingMonths!) / grant.vestingMonths!);
  return { ...base, status: 'verified', label: 'Active', verified: true, vesting: { vested, unvested: grant.numberOfShares - vested } };
}

export function evaluateDocumentSignatures(document: ExecutionDocument, requests: ExecutionRequest[], now = Date.now()) {
  const hasRecordedSignatures = requests.some(request => request.equityDocumentId === document.id && !request.previewMode && (request.status === 'signed' || Boolean(request.signatureData?.typedName?.trim()))) || Boolean(document.autoSigned || document.autoSignedAt);
  const recipient = document.preparedSigners?.find(signer => ['recipient', 'advisor', 'employee', 'grantee', 'optionee', 'participant'].includes(role(signer.role)))?.email;
  const reasons = signatureReasons(document, requests, now, document.documentType === 'board_consent' ? undefined : recipient);
  if (document.status !== 'completed') reasons.push('The document is not completed.');
  return { verified: reasons.length === 0, isFullyExecuted: reasons.length === 0, hasRecordedSignatures, reasons, requestIds: document.signingRequestIds || [] };
}
