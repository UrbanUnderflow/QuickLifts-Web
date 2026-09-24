import {createHash} from 'crypto';
import * as reviewedDocuments from '../content/equity/edna-capitalization-approvals.json';
import {evaluateDocumentSignatures} from './equityExecution';
import {deriveEquityBalances, issuedShares, readPlanReserve} from './equityPlanState';

export const CAPITALIZATION_APPROVAL_IDS = {
  founder: 'pil-founder-share-return-2026-09-23',
  reserve: 'pil-eip-reserve-approval-2026-09-23',
  plan: 'pulse-eip-amendment-2026-09-14-v2',
  board: 'pil-auntedna-20260909-05',
  certificate: 'XmKR9EaPEkeQZcQbaw0A',
} as const;
const founderEmail = 'tre@fitwithpulse.ai';
const normalized = (value: unknown) => String(value || '').trim().toLowerCase();
const fail = (message: string) => Object.assign(new Error(message), {statusCode: 409});
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const docId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);

export function isReviewedCapitalizationDocument(id: string, document: any): boolean {
  return [CAPITALIZATION_APPROVAL_IDS.founder, CAPITALIZATION_APPROVAL_IDS.reserve, CAPITALIZATION_APPROVAL_IDS.certificate].includes(id as any)
    && document?.capitalizationRevision === 1;
}
export function isCapitalizationApprovalDocument(document: any): boolean {
  return document?.documentType === 'founder_share_return' || document?.documentType === 'equity_reserve_approval';
}
export function capitalizationActionHash(document: any): string {
  return hash(JSON.stringify({documentType: document.documentType, capitalizationRevision: document.capitalizationRevision,
    founderReturn: document.founderReturn || null, reserveApproval: document.reserveApproval || null,
    prerequisiteDocumentIds: document.prerequisiteDocumentIds || []}));
}
function assertRevision(document: any, id: string) {
  const expected = document.documentType === 'founder_share_return' ? CAPITALIZATION_APPROVAL_IDS.founder
    : document.documentType === 'equity_reserve_approval' ? CAPITALIZATION_APPROVAL_IDS.reserve : CAPITALIZATION_APPROVAL_IDS.certificate;
  if (id !== expected || document.capitalizationRevision !== 1) throw fail('This capitalization document needs its reviewed execution instructions.');
  const reviewed = Object.values(reviewedDocuments).find((value: any) => value.id === id) as any;
  const normalizeContent = (value: string) => value.replace(/\r\n?/g, '\n').replace(/^Document date:.*$/gm, 'Document date: [current]').trim();
  if (!reviewed || document.documentType !== reviewed.documentType || !document.content || normalizeContent(document.content) !== normalizeContent(reviewed.content)) throw fail('This document differs from the reviewed capitalization paperwork. Upload the prepared document before signing.');
  const signer = document.preparedSigners?.[0];
  if (document.preparedSigners?.length !== 1 || normalized(signer?.email) !== founderEmail || normalized(signer?.name) !== 'tremaine grant') throw fail('This approval must name Tremaine Grant as its sole authorized signer.');
}
function assertPrerequisites(document: any, expected: string[]) {
  const ids = document.prerequisiteDocumentIds;
  if (!Array.isArray(ids) || ids.length !== expected.length || new Set(ids).size !== expected.length || expected.some(id => !ids.includes(id))) throw fail('This document’s approval dependencies need review.');
}
function assertFounderTerms(document: any) {
  const terms = document.founderReturn;
  if (!terms || (terms.stakeholderId !== undefined && !docId(terms.stakeholderId)) || terms.sharesBefore !== 9000000 || terms.sharesReturned !== 1000000 || terms.sharesAfter !== 8000000
    || terms.vestingStartDate !== '2025-12-11' || terms.vestingMonths !== 48 || terms.cliffMonths !== 12) throw fail('The founder return instructions must match the approved one-million-share return and preserved vesting terms.');
  return terms;
}
function assertFounderLedger(founder: any, terms: any, expected: number) {
  if (!founder || founder.type !== 'founder' || normalized(founder.name) !== 'tremaine grant' || normalized(founder.email) !== founderEmail || founder.isReservedPool
    || issuedShares(founder) !== expected || (founder.totalShares !== undefined && founder.totalShares !== expected)
    || (founder.grants?.length)) throw fail('The founder stock ledger differs from this return. Review it before signing.');
  if (expected === 8000000 && founder.shareReturnDocumentId !== CAPITALIZATION_APPROVAL_IDS.founder) throw fail('The completed founder return is not recorded in the stock ledger.');
  if (terms.stakeholderId && founder.id !== terms.stakeholderId) throw fail('The founder return points to a different stockholder record.');
}
async function readDocument(db: any, transaction: any, id: string) {
  const ref = db.collection('equity-documents').doc(id); const snapshot = await transaction.get(ref);
  if (!snapshot.exists) throw fail('A required capitalization document is missing.');
  return {ref, document: {...snapshot.data(), id}};
}
async function requireSignature(db: any, transaction: any, document: any) {
  const ids = document.signingRequestIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 12) throw fail(`Sign ${document.title || 'the prerequisite document'} first.`);
  const requests = await Promise.all(ids.map(async (id: string) => {
    if (!docId(id)) throw fail('A required approval signature is unavailable.');
    const snapshot = await transaction.get(db.collection('signingRequests').doc(id));
    return {...snapshot.data(), id};
  }));
  if (!evaluateDocumentSignatures(document, requests).verified) throw fail(`Sign ${document.title || 'the prerequisite document'} first.`);
  return requests;
}
async function readHolders(db: any, transaction: any) {
  const snapshot = await transaction.get(db.collection('equity-stakeholders'));
  return snapshot.docs.map((row: any) => ({...row.data(), id: row.id}));
}

/** Read every dependency before any signature or ledger write. Called again at execution. */
export async function readCapitalizationExecutionState(db: any, transaction: any, id: string, document: any) {
  const isAction = isCapitalizationApprovalDocument(document);
  const isCertificate = document.documentType === 'strategic_capitalization_certificate' && (document.capitalizationRevision !== undefined || id === CAPITALIZATION_APPROVAL_IDS.certificate);
  if (!isAction && !isCertificate) return null;
  assertRevision(document, id);
  const holders = await readHolders(db, transaction);
  const eventRef = db.collection('equity-ledger-events').doc(id);
  const event = await transaction.get(eventRef);
  if (isAction && (event.exists || document.capitalizationRecordedAt || document.capitalizationLedgerEventId)) throw fail('This approval has already been recorded. Review its signed record.');
  if (document.documentType === 'founder_share_return') {
    const terms = assertFounderTerms(document); const founder = holders.find((row: any) => terms.stakeholderId ? row.id === terms.stakeholderId : row.type === 'founder' && normalized(row.email) === founderEmail);
    assertFounderLedger(founder, terms, 9000000);
    if (holders.filter((row: any) => row.type === 'founder').length !== 1 || holders.reduce((n: number, row: any) => n + issuedShares(row), 0) !== 9000000) throw fail('The stock ledger no longer matches the sole-founder capitalization approved in this document.');
    return {kind: 'founder' as const, eventRef, founder, founderRef: db.collection('equity-stakeholders').doc(founder.id), terms};
  }
  const founderSource = await readDocument(db, transaction, CAPITALIZATION_APPROVAL_IDS.founder);
  assertRevision(founderSource.document, CAPITALIZATION_APPROVAL_IDS.founder);
  const founderTerms = assertFounderTerms(founderSource.document);
  await requireSignature(db, transaction, founderSource.document);
  if (!founderSource.document.capitalizationRecordedAt || founderSource.document.capitalizationLedgerEventId !== CAPITALIZATION_APPROVAL_IDS.founder) throw fail('The signed founder return has not been recorded in the stock ledger.');
  const founder = holders.find((row: any) => founderTerms.stakeholderId ? row.id === founderTerms.stakeholderId : row.type === 'founder' && normalized(row.email) === founderEmail);
  assertFounderLedger(founder, founderTerms, 8000000);
  if (holders.reduce((n: number, row: any) => n + issuedShares(row), 0) !== 8000000) throw fail('Issued shares have changed. Update the capitalization documents before signing.');
  const plan = await readDocument(db, transaction, CAPITALIZATION_APPROVAL_IDS.plan);
  if (plan.document.documentType !== 'eip' || plan.document.status !== 'completed' || readPlanReserve(plan.document.content) !== 1600000) throw fail('The saved EIP must contain the reviewed 1,600,000-share reserve.');
  if (document.documentType === 'equity_reserve_approval') {
    assertPrerequisites(document, [CAPITALIZATION_APPROVAL_IDS.founder]);
    const terms = document.reserveApproval;
    if (!terms || terms.planDocumentId !== CAPITALIZATION_APPROVAL_IDS.plan || terms.reserveShares !== 1600000
      || terms.founderReturnDocumentId !== CAPITALIZATION_APPROVAL_IDS.founder || terms.planContentHash !== hash(plan.document.content)) throw fail('The EIP text no longer matches the plan attached to this approval.');
    if (plan.document.approvalStatus === 'approved' || plan.document.effectiveAt) throw fail('This EIP already has an adoption record. Review it before signing another approval.');
    const pools = await transaction.get(db.collection('equity-pool'));
    if (pools.docs.length > 1) throw fail('Multiple equity reserve ledgers exist. Reconcile them before recording this approval.');
    // Some companies have plan documents but no bookkeeping ledger yet. Create it only at execution.
    const createPool = pools.docs.length === 0;
    const pool = createPool ? {id: 'pil-eip', totalReserved: 0, exercised: 0} : {...pools.docs[0].data(), id: pools.docs[0].id};
    if (!createPool && (!Number.isSafeInteger(pool.totalReserved) || ![1000000,1600000].includes(pool.totalReserved) || !Number.isSafeInteger(pool.exercised || 0) || (pool.exercised || 0) < 0)) throw fail('The equity reserve ledger changed. Review it before adopting this plan.');
    const balances = deriveEquityBalances(holders, 1600000, pool.exercised || 0, 10000000);
    if (balances.available === null || balances.available < 0 || balances.unallocated === null || balances.unallocated < 400000) throw fail('The proposed EIP reserve leaves insufficient authorized shares for the separately approved strategic reserve.');
    return {kind: 'reserve' as const, eventRef, plan, pool, createPool, poolRef: db.collection('equity-pool').doc(pool.id), balances};
  }
  assertPrerequisites(document, [CAPITALIZATION_APPROVAL_IDS.founder, CAPITALIZATION_APPROVAL_IDS.reserve, CAPITALIZATION_APPROVAL_IDS.board]);
  const reserve = await readDocument(db, transaction, CAPITALIZATION_APPROVAL_IDS.reserve);
  assertRevision(reserve.document, CAPITALIZATION_APPROVAL_IDS.reserve);
  await requireSignature(db, transaction, reserve.document);
  const board = await readDocument(db, transaction, CAPITALIZATION_APPROVAL_IDS.board);
  if (board.document.documentType !== 'strategic_board_consent_pil') throw fail('The current EDNA board consent is unavailable.');
  await requireSignature(db, transaction, board.document);
  if (!reserve.document.capitalizationRecordedAt || reserve.document.capitalizationLedgerEventId !== CAPITALIZATION_APPROVAL_IDS.reserve
    || plan.document.approvalStatus !== 'approved' || plan.document.approvalDocumentId !== CAPITALIZATION_APPROVAL_IDS.reserve
    || reserve.document.reserveApproval?.planContentHash !== hash(plan.document.content) || !plan.document.effectiveAt) throw fail('The signed 1,600,000-share EIP approval has not been recorded against its adopted plan.');
  const pools = await transaction.get(db.collection('equity-pool'));
  if (pools.docs.length !== 1 || pools.docs[0].data().totalReserved !== 1600000 || pools.docs[0].data().approvalDocumentId !== CAPITALIZATION_APPROVAL_IDS.reserve) throw fail('The equity reserve ledger does not match the signed EIP approval.');
  return {kind: 'certificate' as const};
}

function vestedSharesAt(date: Date, terms: any) {
  const start = new Date(`${terms.vestingStartDate}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
  const part = (name: string) => Number(parts.find(value => value.type === name)?.value);
  let months = (part('year') - start.getUTCFullYear()) * 12 + part('month') - 1 - start.getUTCMonth();
  if (part('day') < start.getUTCDate()) months--;
  return months < terms.cliffMonths ? 0 : Math.floor(terms.sharesAfter * Math.min(Math.max(months, 0), terms.vestingMonths) / terms.vestingMonths);
}
/** Atomic with the authenticated signature. No source content or historical signature is rewritten. */
export function recordCapitalizationExecution(transaction: any, state: any, options: {documentId: string; requestId: string; timestamp: any; uid: string; contentHash: string}) {
  if (!state || state.kind === 'certificate') return;
  const {documentId, requestId, timestamp, uid, contentHash} = options;
  const proof = {documentId, requestId, signedAt: timestamp, recordedAt: timestamp, recordedBy: uid, documentHash: contentHash};
  if (state.kind === 'founder') {
    const vested = vestedSharesAt(timestamp.toDate(), state.terms);
    const next = {totalShares: 8000000, sharesOwned: 8000000, totalVested: vested, totalUnvested: 8000000 - vested,
      ownershipPercentage: 80, vestingStartDate: state.terms.vestingStartDate, vestingMonths: 48, cliffMonths: 12,
      shareReturnDocumentId: documentId, shareReturnRequestId: requestId, shareReturnRecordedAt: timestamp, updatedAt: timestamp};
    transaction.update(state.founderRef, next);
    transaction.create(state.eventRef, {...proof, eventType: 'founder_share_return', stakeholderId: state.founder.id,
      sharesReturned: 1000000, cashConsideration: 0, before: state.founder, after: next});
  } else {
    const nextPlan = {approvalStatus: 'approved', approvalDocumentId: documentId, approvalRequestId: requestId, approvedAt: timestamp,
      effectiveAt: timestamp, approvedBy: uid, updatedAt: timestamp};
    const nextPool = {totalReserved: 1600000, granted: state.balances.committed, available: state.balances.available,
      approvalDocumentId: documentId, approvalRequestId: requestId, approvedAt: timestamp, updatedAt: timestamp};
    transaction.update(state.plan.ref, nextPlan);
    if (state.createPool) transaction.create(state.poolRef, {...nextPool, exercised: 0, createdAt: timestamp});
    else transaction.update(state.poolRef, nextPool);
    transaction.create(state.eventRef, {...proof, eventType: 'equity_reserve_approval', planDocumentId: CAPITALIZATION_APPROVAL_IDS.plan,
      poolId: state.pool.id, reserveShares: 1600000, planContentHash: hash(state.plan.document.content),
      before: {planApprovalStatus: state.plan.document.approvalStatus || null, pool: state.createPool ? null : state.pool}, after: {plan: nextPlan, pool: nextPool}});
  }
}
