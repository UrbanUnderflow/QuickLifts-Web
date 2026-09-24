import {randomUUID} from 'crypto';
import type {Handler} from '@netlify/functions';
import {admin, getFirebaseAdminApp} from './config/firebase';
import {isSendableEquityDocument} from '../../src/lib/equityDocumentScope';
import {dateUnsignedEquityDocument} from '../../src/lib/equityDocumentDating';
import {capitalizationActionHash, isCapitalizationApprovalDocument, readCapitalizationExecutionState} from '../../src/lib/equityCapitalizationApprovals';
const fail = (statusCode: number, message: string) => Object.assign(new Error(message), {statusCode});
const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
const allowed = new Set(['strategic_board_consent_pil', 'strategic_capitalization_certificate', 'strategic_consideration_schedule', 'founder_share_return', 'equity_reserve_approval']);
export const handler: Handler = async event => {
  const reply = (statusCode: number, body: unknown) => ({statusCode, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, body: JSON.stringify(body)});
  if (event.httpMethod !== 'POST') return reply(405, {error: 'POST required.'});
  try {
    const token = (event.headers.authorization || event.headers.Authorization || '').match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw fail(401, 'Sign in as an administrator.');
    const app = getFirebaseAdminApp(event); const db = admin.firestore(app);
    let identity;
    try { identity = await admin.auth(app).verifyIdToken(token, true); } catch { throw fail(401, 'Your sign-in has expired.'); }
    if (!identity.email || !(await db.collection('admin').doc(identity.email).get()).exists) throw fail(403, 'Administrator access required.');
    let body; try { body = JSON.parse(event.body || '{}'); } catch { throw fail(400, 'Invalid request.'); }
    if (typeof body.documentId !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(body.documentId)) throw fail(400, 'Select a saved document.');
    const documentRef = db.collection('equity-documents').doc(body.documentId);
    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(documentRef); const document = snapshot.data();
      if (!snapshot.exists || !document) throw fail(404, 'Document not found.');
      if (!allowed.has(document.documentType) || !isSendableEquityDocument(document) || document.status !== 'completed' || !document.content?.trim() || document.requiresSignature !== true || document.closingRequirements?.length) throw fail(409, 'Complete this outgoing approval document before preparing its signature.');
      await readCapitalizationExecutionState(db, transaction, body.documentId, document);
      const capitalizationAction = isCapitalizationApprovalDocument(document) || document.capitalizationRevision === 1;
      const actionHash = capitalizationAction ? capitalizationActionHash(document) : null;
      const signers = document.preparedSigners;
      if (!Array.isArray(signers) || signers.length !== 1 || !/^\S+@\S+\.\S+$/.test(normalize(signers[0].email)) || normalize(signers[0].name) !== 'tremaine grant' || !signers[0].role?.trim()) throw fail(403, 'This approval must have one saved signer: Tremaine Grant, with a valid email address and signing role.');
      const existingIds = [...new Set<string>([...(document.signingRequestIds || []), ...(document.signingRequestId ? [document.signingRequestId] : [])])];
      if (existingIds.length > 1 || document.autoSigned || document.autoSignedAt || document.signedAt || document.signatureData || document.approvalStatus === 'approved') throw fail(409, 'This document already has signature or approval records. Review its existing request.');
      if (existingIds.length) {
        const existing = await transaction.get(db.collection('signingRequests').doc(existingIds[0])); const request = existing.data();
        if (!request || request.status === 'signed' || request.signatureData || request.signedAt) throw fail(409, 'This document is already signed or its signature record is unavailable.');
        if ((actionHash && request.capitalizationActionHash !== actionHash) || request.invalidatedAt || request.previewMode || request.packageId || document.needsResendSignature || request.documentContent !== document.content || request.equityDocumentId !== body.documentId || request.signingGroupId !== document.signingGroupId || normalize(request.recipientEmail) !== normalize(signers[0].email) || request.signerRole !== signers[0].role || !['pending', 'sent', 'delivered', 'opened', 'viewed', 'failed', 'deferred'].includes(request.status)) throw fail(409, 'The existing signature request does not match this document. Review it before replacing it.');
        if (request.expiresAt) { const expiry = request.expiresAt.toMillis?.() ?? new Date(request.expiresAt).getTime(); if (!Number.isFinite(expiry) || expiry <= Date.now()) throw fail(409, 'The existing signature request has expired.'); }
        return {delivery: {documentId: existing.id, recipientEmail: request.recipientEmail, recipientName: request.recipientName}, reused: true};
      }
      const exhibitIds = document.exhibits || [];
      if (!Array.isArray(exhibitIds) || exhibitIds.length > 12 || exhibitIds.some((id: unknown) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(id))) throw fail(409, 'Review this document’s supporting attachments.');
      const exhibits = await Promise.all(exhibitIds.map((id: string) => transaction.get(db.collection('equity-documents').doc(id))));
      const supportingDocuments = exhibits.map(exhibit => {
        const value = exhibit.data();
        if (!exhibit.exists || !value || value.status !== 'completed' || !value.content || !isSendableEquityDocument(value)) throw fail(409, 'A supporting attachment is unavailable.');
        return {id: exhibit.id, title: value.title, documentType: value.documentType, url: `/equity-doc/${exhibit.id}`};
      });
      const ref = db.collection('signingRequests').doc(); const now = admin.firestore.Timestamp.now(); const group = `self-${ref.id}`;
      const dated = dateUnsignedEquityDocument(document, new Date(now.seconds * 1000));
      const recipientEmail = normalize(signers[0].email); const recipientName = signers[0].name.trim();
      transaction.create(ref, {documentType: document.documentType, documentName: dated.title, documentContent: dated.content, documentDate: dated.documentDate, ...(actionHash ? {capitalizationActionHash: actionHash} : {}), equityDocumentId: body.documentId, recipientEmail, recipientName, signerRole: signers[0].role, signingOrder: 1, signingGroupId: group, supportingDocuments, status: 'pending', previewMode: false, companyName: 'Pulse Intelligence Labs, Inc.', createdAt: now});
      transaction.update(documentRef, {title: dated.title, content: dated.content, documentDate: dated.documentDate, documentDatedAt: now, ...(document.content !== dated.content || document.title !== dated.title ? {contentHistory: [...(document.contentHistory || []), {title: document.title, content: document.content, savedAt: now, reason: 'Date document for initial signature request'}]} : {}), signingRequestId: ref.id, signingRequestIds: [ref.id], signingGroupId: group, needsResendSignature: false, updatedAt: now});
      return {delivery: {documentId: ref.id, recipientEmail, recipientName}, reused: false};
    });
    return reply(200, {...result, delivery: {...result.delivery, sendAttemptId: randomUUID()}});
  } catch (error: any) { return reply(error.statusCode || 500, {error: error.statusCode ? error.message : 'Unable to prepare this signature request.'}); }
};
