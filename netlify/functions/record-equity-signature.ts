import { isSendableEquityDocument } from '../../src/lib/equityDocumentScope';
import {validatePreparedPackage} from '../../src/lib/equitySigningPackage';
import {getEquitySigningRequirements, requiresEquitySigningPackage} from '../../src/lib/equitySigningRequirements';
import {evaluateDocumentSignatures} from '../../src/lib/equityExecution';
import {capitalizationActionHash, isCapitalizationApprovalDocument, isReviewedCapitalizationDocument, readCapitalizationExecutionState, recordCapitalizationExecution} from '../../src/lib/equityCapitalizationApprovals';
import type { Handler } from '@netlify/functions';
import { createHash } from 'crypto';
import { admin, getFirebaseAdminApp } from './config/firebase';

const fail = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
const fonts = ['Brush Script MT', 'Segoe Script', 'Lucida Handwriting'];
const milliseconds = (value: any) => value?.toMillis?.() ?? (value ? new Date(value).getTime() : NaN);

export const handler: Handler = async event => {
  const reply = (statusCode: number, body: unknown) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST required.' });
  try {
    const token = (event.headers.authorization || event.headers.Authorization || '').match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw fail(401, 'Sign in to sign this document.');
    const app = getFirebaseAdminApp(event);
    let identity;
    try { identity = await admin.auth(app).verifyIdToken(token, true); }
    catch { throw fail(401, 'Your sign-in has expired. Sign in again.'); }
    if (!identity.email_verified || !identity.email) throw fail(403, 'Use an account with a verified recipient email.');
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { throw fail(400, 'Invalid request.'); }
    const { requestId, typedName, signatureFont } = body;
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(requestId) || typeof typedName !== 'string' || !typedName.trim() || typedName.length > 200 || !fonts.includes(signatureFont)) throw fail(400, 'Provide a request, legal name, and signature style.');
    const db = admin.firestore(app);
    const requestRef = db.collection('signingRequests').doc(requestId);
    const receipt = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists) throw fail(404, 'Signing request not found.');
      const request = snapshot.data()!;
      if (!request.equityDocumentId || request.previewMode || request.invalidatedAt || !['pending', 'sent', 'delivered', 'opened', 'viewed', 'signed'].includes(request.status)) throw fail(409, 'This request is not open for signing.');
      if (request.expiresAt && (!Number.isFinite(milliseconds(request.expiresAt)) || milliseconds(request.expiresAt) <= Date.now())) throw fail(410, 'This signing request has expired.');
      if (String(request.recipientEmail || '').trim().toLowerCase() !== identity.email.toLowerCase()) throw fail(403, 'Sign in with the email address this request was sent to.');
      const document = await transaction.get(db.collection('equity-documents').doc(request.equityDocumentId));
      const saved = document.data();
      if (saved && !isSendableEquityDocument(saved)) throw fail(409, 'Reference, operational, incoming, or archived documents cannot be signed in the PIL issuance workspace.');
      if (!document.exists || saved?.status !== 'completed' || !request.documentContent || request.documentContent !== saved.content || saved.needsResendSignature || !request.signingGroupId || !Array.isArray(saved.signingRequestIds) || !saved.signingRequestIds.includes(requestId)) throw fail(409, 'The document changed or this signing request was replaced. Request a new link.');
      const signingDocument = {...saved, id: request.equityDocumentId};
      if (request.status === 'signed') {
        if (!isReviewedCapitalizationDocument(request.equityDocumentId, saved) || request.capitalizationActionHash !== capitalizationActionHash(saved)) throw fail(409, 'This request is not open for signing.');
        const completedRequests = await Promise.all(saved.signingRequestIds.map(async (id: string) => ({...(await transaction.get(db.collection('signingRequests').doc(id))).data(), id})));
        if (!evaluateDocumentSignatures(signingDocument as any, completedRequests).verified
          || request.signatureData?.verifiedUid !== identity.uid || request.signatureData?.documentHash !== createHash('sha256').update(saved.content).digest('hex')
          || saved.approvalStatus !== 'approved' || saved.approvalRequestId !== requestId) throw fail(409, 'The existing approval signature needs review.');
        if (isCapitalizationApprovalDocument(saved)) {
          const audit = (await transaction.get(db.collection('equity-ledger-events').doc(request.equityDocumentId))).data();
          if (!audit || audit.requestId !== requestId || audit.documentHash !== request.signatureData.documentHash
            || !saved.capitalizationRecordedAt || saved.capitalizationLedgerEventId !== request.equityDocumentId) throw fail(409, 'The signed approval needs its matching stock-ledger record.');
        }
        return {signatureData: {...request.signatureData, timestamp: new Date(milliseconds(request.signatureData.timestamp)).toISOString()}, alreadySigned: true};
      }
      const capitalizationState = await readCapitalizationExecutionState(db, transaction, request.equityDocumentId, saved);
      if (capitalizationState && request.capitalizationActionHash !== capitalizationActionHash(saved)) throw fail(409, 'The capitalization instructions changed. Request a new signature link.');
      if (getEquitySigningRequirements(signingDocument).length) throw fail(409, 'This document has outstanding closing requirements.');
      if (requiresEquitySigningPackage(signingDocument) && !request.packageId) throw fail(409, 'Sign this document through its complete equity package with the signed approval attachments.');
      if (request.packageId) {
        const rootSnapshot = await transaction.get(db.collection('signingRequests').doc(request.packageId));
        const root = rootSnapshot.data();
        if (!root || !Array.isArray(root.packageDocuments) || root.packageDocuments.length > 24) throw fail(409, 'This signing package is unavailable.');
        const sourceSnapshots = await Promise.all(root.packageDocuments.map((item: any) => transaction.get(db.collection('equity-documents').doc(item.id))));
        const sources = sourceSnapshots.map(source => ({...source.data(), id: source.id}));
        const ids = [...new Set<string>(sources.flatMap((source: any) => source.signingRequestIds || []))];
        const records = (await Promise.all(ids.map(id => transaction.get(db.collection('signingRequests').doc(id))))).map(record => ({...record.data(), id: record.id}));
        const errors = validatePreparedPackage({...root, id: rootSnapshot.id}, sources, records);
        for (const source of sources.filter((item: any) => /board.consent/i.test(item.documentType || ''))) {
          if (!evaluateDocumentSignatures(source as any, records as any).verified) errors.push('Board consent signatures are no longer verified.');
        }
        if (errors.length) throw fail(409, errors.join(' '));
      }
      const peers = await Promise.all(saved.signingRequestIds.map((id: string) => transaction.get(db.collection('signingRequests').doc(id))));
      if (peers.some(peer => !peer.exists || peer.data()?.signingGroupId !== request.signingGroupId || peer.data()?.equityDocumentId !== request.equityDocumentId || peer.data()?.previewMode || peer.data()?.invalidatedAt || peer.data()?.documentContent !== saved.content)) throw fail(409, 'The signing packet is inconsistent. Request a new link.');
      const timestamp = admin.firestore.Timestamp.now();
      const signatureData = {
        typedName: typedName.trim(), signatureFont, timestamp,
        verificationMethod: 'firebase-auth', verifiedEmail: identity.email.toLowerCase(), verifiedUid: identity.uid,
        documentHash: createHash('sha256').update(saved.content).digest('hex'),
        ipAddress: event.headers['x-nf-client-connection-ip'] || 'Unavailable',
        userAgent: event.headers['user-agent'] || 'Unavailable',
      };
      const supportingApproval = ['strategic_capitalization_certificate', 'strategic_consideration_schedule'].includes(saved.documentType) || isCapitalizationApprovalDocument(saved);
      if (supportingApproval) {
        const signer = saved.preparedSigners?.[0];
        if (saved.requiresSignature !== true || saved.preparedSigners?.length !== 1 || saved.signingRequestIds.length !== 1 || !signer || String(signer.name || '').trim().toLowerCase() !== 'tremaine grant' || String(signer.email || '').trim().toLowerCase() !== identity.email.toLowerCase() || signer.role !== request.signerRole || saved.signingGroupId !== request.signingGroupId) throw fail(409, 'This approval requires its saved sole authorized signer.');
      }
      recordCapitalizationExecution(transaction, capitalizationState, {documentId: request.equityDocumentId, requestId, timestamp, uid: identity.uid, contentHash: signatureData.documentHash});
      transaction.update(requestRef, { status: 'signed', signedAt: timestamp, signatureData, lastSignerActivityAt: timestamp, updatedAt: timestamp });
      if (supportingApproval) transaction.update(document.ref || db.collection('equity-documents').doc(request.equityDocumentId), {approvalStatus: 'approved', approvalRequestId: requestId, approvedAt: timestamp, approvedBy: identity.uid, ...(isCapitalizationApprovalDocument(saved) ? {capitalizationRecordedAt: timestamp, capitalizationLedgerEventId: request.equityDocumentId} : {}), updatedAt: timestamp});
      return {signatureData: {...signatureData, timestamp: timestamp.toDate().toISOString()}, alreadySigned: false};
    });
    return reply(200, {...receipt, signedAt: receipt.signatureData.timestamp});
  } catch (error: any) {
    return reply(error.statusCode || 500, { error: error.statusCode ? error.message : 'Unable to record signature. Please try again.' });
  }
};
