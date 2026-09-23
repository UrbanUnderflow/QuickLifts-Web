import type {Handler} from '@netlify/functions';
import {createHash} from 'crypto';
import {admin, getFirebaseAdminApp} from './config/firebase';
import {evaluateDocumentSignatures} from '../../src/lib/equityExecution';
import {dateUnsignedEquityDocument} from '../../src/lib/equityDocumentDating';
import {getEquitySigningRequirements, getEquityIssuanceRequirements} from '../../src/lib/equitySigningRequirements';
import {normalizePackageEmail, packageRecipients, validatePackageSources, type PackageSource} from '../../src/lib/equitySigningPackage';
const fail = (statusCode: number, message: string) => Object.assign(new Error(message), {statusCode});
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
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
    const {documentIds, referenceDocumentIds, attemptId} = body;
    if (!safeId(attemptId) || !Array.isArray(documentIds) || !Array.isArray(referenceDocumentIds) || !documentIds.every(safeId) || !referenceDocumentIds.every(safeId) || documentIds.length < 1 || documentIds.length > 8 || referenceDocumentIds.length > 12) throw fail(400, 'Select valid package documents and a preparation attempt.');
    const selectionHash = createHash('sha256').update(JSON.stringify({documentIds, referenceDocumentIds})).digest('hex');
    const packageId = createHash('sha256').update(`${identity.uid}:${attemptId}`).digest('hex');
    const manifestRef = db.collection('equitySigningPackages').doc(packageId);
    const result = await db.runTransaction(async transaction => {
      const previous = await transaction.get(manifestRef);
      if (previous.exists) {
        if (previous.data()?.selectionHash !== selectionHash) throw fail(409, 'This preparation attempt belongs to another selection.');
        return previous.data()!.result;
      }
      const snapshots = await Promise.all([...documentIds, ...referenceDocumentIds].map(id => transaction.get(db.collection('equity-documents').doc(id))));
      if (snapshots.some(s => !s.exists)) throw fail(404, 'A selected document is missing.');
      const sources = snapshots.map(s => ({...s.data(), id: s.id})) as PackageSource[];
      const signable = sources.slice(0, documentIds.length); const references = sources.slice(documentIds.length);
      if (Buffer.byteLength(JSON.stringify(sources.map(source => ({id: source.id, title: source.title, content: source.content}))), 'utf8') > 600000) throw fail(400, 'This package is too large. Divide it into smaller packages.');
      const evidenceIds = [...new Set(references.flatMap(d => d.signingRequestIds || []))];
      const evidence = await Promise.all(evidenceIds.map(id => transaction.get(db.collection('signingRequests').doc(id))));
      const evidenceRecords = evidence.filter(s => s.exists).map(s => ({...s.data(), id: s.id}));
      const verifiedBoards = new Set(references.filter(d => (/board.consent/i.test(d.documentType || '') || d.requiresSignature === true) && evaluateDocumentSignatures(d as any, evidenceRecords as any).verified).map(d => d.id));
      const errors = validatePackageSources(signable, references, verifiedBoards);
      if (errors.length) throw fail(409, errors.join('\n'));
      if (signable.some(document => (document as any).signatureData || (document as any).autoSignedAt || document.approvalStatus === 'approved')) throw fail(409, 'A selected signature document already has signature or approval records.');
      const now = admin.firestore.Timestamp.now();
      const datedSignable = signable.map(document => dateUnsignedEquityDocument(document, new Date(now.seconds * 1000)));
      const datedSources = [...datedSignable, ...references];
      const recipients = packageRecipients(signable);
      const roots = new Map(recipients.map(recipient => [recipient.email, db.collection('signingRequests').doc()]));
      const children: Array<{id: string; documentId: string; recipientEmail: string; data: any}> = [];
      for (const document of datedSignable) {
        const original = signable.find(source => source.id === document.id)!;
        const group = `${packageId}-${document.id}`;
        const requestIds: string[] = [];
        document.preparedSigners!.forEach((signer, index) => {
          const ref = db.collection('signingRequests').doc(); const email = normalizePackageEmail(signer.email); requestIds.push(ref.id);
          children.push({id: ref.id, documentId: document.id, recipientEmail: email, data: {documentType: document.documentType, documentName: document.title, documentContent: document.content, documentDate: document.documentDate, equityDocumentId: document.id, recipientEmail: email, recipientName: signer.name.trim(), signerRole: signer.role.trim(), signingOrder: index + 1, signingGroupId: group, packageId: roots.get(email)!.id, packageBatchId: packageId, status: 'pending', previewMode: false, companyName: 'Pulse Intelligence Labs, Inc.', createdAt: now}});
        });
        transaction.update(db.collection('equity-documents').doc(document.id), {title: document.title, content: document.content, documentDate: document.documentDate, documentDatedAt: now, closingRequirements: getEquitySigningRequirements(document), issuanceRequirements: getEquityIssuanceRequirements(document), ...(original.content !== document.content || original.title !== document.title ? {contentHistory: [...((original as any).contentHistory || []), {title: original.title, content: original.content, savedAt: now, reason: 'Date document for initial signature package'}]} : {}), signingGroupId: group, signingRequestId: requestIds[0], signingRequestIds: requestIds, needsResendSignature: false, updatedAt: now});
      }
      for (const child of children) transaction.create(db.collection('signingRequests').doc(child.id), child.data);
      const deliveries = recipients.map(recipient => {
        const root = roots.get(recipient.email)!;
        const own = children.filter(child => child.recipientEmail === recipient.email);
        const packageDocuments: any[] = datedSources.flatMap<any>(document => {
          const ownChildren = own.filter(child => child.documentId === document.id);
          const snapshot = {id: document.id, title: document.title || document.id, documentType: document.documentType || 'supporting_document', content: document.content!};
          if (ownChildren.length) return ownChildren.map(child => ({...snapshot, mode: 'sign', requestId: child.id}));
          return [{...snapshot, mode: 'reference', signatureEvidence: evidenceRecords.filter((r: any) => r.equityDocumentId === document.id).map((r: any) => ({id: r.id, recipientName: r.recipientName || '', signerRole: r.signerRole || '', signedAt: r.signedAt || null, signatureData: r.signatureData ? {typedName: r.signatureData.typedName || '', timestamp: r.signatureData.timestamp || null, verificationMethod: r.signatureData.verificationMethod || ''} : null}))}];
        });
        if (packageDocuments.length > 24) throw fail(400, 'This recipient package has too many documents or signature roles. Divide it into smaller packages.');
        const documentName = typeof body.packageName === 'string' && body.packageName.trim() ? body.packageName.trim().slice(0, 160) : 'PIL Equity Document Package';
        transaction.create(root, {documentType: 'strategic_signing_package', documentName, recipientName: recipient.name, recipientEmail: recipient.email, packageBatchId: packageId, packageDocuments, childRequestIds: own.map(child => child.id), status: 'pending', previewMode: false, companyName: 'Pulse Intelligence Labs, Inc.', createdAt: now});
        return {documentId: root.id, recipientEmail: recipient.email, recipientName: recipient.name, sendAttemptId: `${packageId}-${root.id}`};
      });
      const result = {packageId, deliveries, requestIds: children.map(child => child.id)};
      transaction.create(manifestRef, {selectionHash, createdBy: identity.uid, createdAt: now, result});
      return result;
    });
    return reply(200, result);
  } catch (error: any) { return reply(error.statusCode || 500, {error: error.statusCode ? error.message : 'Unable to prepare the package.'}); }
};
