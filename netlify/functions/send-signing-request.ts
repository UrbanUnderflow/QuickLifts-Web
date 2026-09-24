import { isSendableEquityDocument } from '../../src/lib/equityDocumentScope';
import {validatePreparedPackage} from '../../src/lib/equitySigningPackage';
import {getEquitySigningRequirements, requiresEquitySigningPackage} from '../../src/lib/equitySigningRequirements';
import {evaluateDocumentSignatures} from '../../src/lib/equityExecution';
import {CAPITALIZATION_APPROVAL_IDS, capitalizationActionHash, isCapitalizationApprovalDocument, readCapitalizationExecutionState} from '../../src/lib/equityCapitalizationApprovals';
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import {URL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {getEquityEmailDelivery, type EquityEmailDelivery} from '../../src/lib/equityEmailDelivery';
import { admin, getFirebaseAdminApp } from "./config/firebase";
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';

const fail = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
const isEquityRequest = (value: any) => Boolean(value && (Object.prototype.hasOwnProperty.call(value, 'equityDocumentId')
  || ['eip', 'option_agreement', 'board_consent', 'stockholder_consent', 'fast_agreement', 'advisor_nso_agreement', 'warrant', 'restricted_stock_agreement', 'stock_purchase_agreement'].includes(value.documentType)
  || String(value.documentType || '').startsWith('strategic_')));
const isClosed = (value: any) => Boolean(value?.invalidatedAt || value?.status === 'signed' || value?.signatureData || value?.signedAt);

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const resolveSigningBaseUrl = () => {
  // Netlify CLI sets this internal flag and URL for its local function runtime.
  if (process.env.NETLIFY_DEV === 'true') {
    try {
      const local = new URL(process.env.URL || 'http://localhost:8888');
      if (['http:', 'https:'].includes(local.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(local.hostname)
        && !local.username && !local.password) return local.origin;
    } catch { /* Fall back to this repository's configured local Netlify port. */ }
    return 'http://localhost:8888';
  }
  return process.env.CUSTOM_BASE_URL || 'https://fitwithpulse.ai';
};
const BASE_URL = resolveSigningBaseUrl();

type SupportingDocument = {
  id?: string;
  title?: string;
  documentType?: string;
  url?: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const resolveDocumentUrl = (url?: string) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

const normalizeSupportingDocuments = (documents: unknown): SupportingDocument[] => {
  if (!Array.isArray(documents)) return [];

  return documents
    .map(document => document as SupportingDocument)
    .filter(document => document?.title && document?.url)
    .map(document => ({
      id: document.id || document.url,
      title: String(document.title),
      documentType: String(document.documentType || 'supporting_document'),
      url: resolveDocumentUrl(document.url),
    }))
    .slice(0, 8);
};

const formatDocumentType = (documentType?: string) =>
  String(documentType || 'Supporting Document')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());

// Resolve branding based on which company the document belongs to
function resolveBranding(companyName: string) {
  const isTres = companyName?.toLowerCase().includes('tresproperties') ||
    companyName?.toLowerCase().includes('tres');
  return {
    senderName: isTres ? 'Tremaine Grant' : 'Pulse Intelligence Labs',
    displayCompany: isTres ? 'TresProperties LLC' : 'Pulse Intelligence Labs, Inc.',
    requestedBy: 'Tremaine Grant',
    requestedByCompany: isTres ? 'TresProperties LLC' : 'Pulse Intelligence Labs, Inc.',
    footerCompany: isTres ? 'TresProperties LLC' : 'Pulse Intelligence Labs, Inc.',
    accentColor: isTres ? '#3B82F6' : '#E0FE10',
    accentText: isTres ? '#FFFFFF' : '#000000',
  };
}

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const { documentId, sendAttemptId } = payload;
    let { documentName, recipientName, recipientEmail, companyName, previewMode, supportingDocuments: rawSupportingDocuments } = payload;
    if (typeof documentId !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(documentId)) throw fail(400, 'Invalid signing request.');
    const app = getFirebaseAdminApp(event);
    const db = admin.firestore(app);
    const requestRef = db.collection('signingRequests').doc(documentId);
    const snapshot = await requestRef.get();
    const saved = snapshot.data();
    const equity = isEquityRequest(saved) || isEquityRequest(payload);
    if (equity) {
      const token = (event.headers.authorization || event.headers.Authorization || '').match(/^Bearer (.+)$/i)?.[1];
      if (!token) throw fail(401, 'Sign in as an administrator to send equity documents.');
      let identity;
      try { identity = await admin.auth(app).verifyIdToken(token, true); }
      catch { throw fail(401, 'Your sign-in has expired.'); }
      if (!identity.email || !(await db.collection('admin').doc(identity.email).get()).exists) throw fail(403, 'Administrator access required.');
      if (!snapshot.exists || (!saved?.equityDocumentId && saved?.documentType !== 'strategic_signing_package')) throw fail(409, 'Create a linked equity signing request before sending.');
      if (isClosed(saved)) throw fail(409, 'This signing request is signed or invalidated.');
      if (saved.documentType !== 'strategic_signing_package' && requiresEquitySigningPackage({id: saved.equityDocumentId, documentType: saved.documentType})) throw fail(409, 'Send this document through its complete equity package with the signed approval attachments.');
      if (saved.documentType === 'strategic_signing_package') {
        if (!Array.isArray(saved.packageDocuments) || saved.packageDocuments.length > 24) throw fail(409, 'The package document list is invalid.');
        const sources = await Promise.all(saved.packageDocuments.map((item: any) => db.collection('equity-documents').doc(item.id).get()));
        const documents = sources.map(source => ({...source.data(), id: source.id}));
        const ids = [...new Set<string>(documents.flatMap((source: any) => source.signingRequestIds || []))];
        const childSnapshots = await Promise.all(ids.map(id => db.collection('signingRequests').doc(id).get()));
        const records = childSnapshots.map(child => ({...child.data(), id: child.id}));
        const errors = validatePreparedPackage({...saved, id: documentId}, documents, records);
        for (const source of documents.filter((item: any) => /board.consent/i.test(item.documentType || ''))) {
          if (!evaluateDocumentSignatures(source as any, records as any).verified) errors.push('Board consent signatures are no longer verified.');
        }
        if (errors.length) throw fail(409, errors.join(' '));
        if (saved.childRequestIds.every((id: string) => records.some((record: any) => record.id === id && record.status === 'signed'))) throw fail(409, 'This recipient has already signed every document in the package.');
      } else if (!saved.previewMode) {
        const document = (await db.collection('equity-documents').doc(saved.equityDocumentId).get()).data();
        if (document && !isSendableEquityDocument(document)) throw fail(409, 'Reference, operational, incoming, or archived documents cannot be sent from the PIL issuance workspace.');
        if (!document || document.status !== 'completed' || document.content !== saved.documentContent
          || document.needsResendSignature || !saved.signingGroupId
          || !Array.isArray(document.signingRequestIds) || !document.signingRequestIds.includes(documentId)) throw fail(409, 'This request is not part of the current document packet.');
        if (requiresEquitySigningPackage({...document, id: saved.equityDocumentId})) throw fail(409, 'Send this document through its complete equity package with the signed approval attachments.');
        if (getEquitySigningRequirements({...document, id: saved.equityDocumentId}).length) throw fail(409, 'Resolve the document closing requirements before sending.');
        if (isCapitalizationApprovalDocument(document) || document.capitalizationRevision !== undefined || saved.equityDocumentId === CAPITALIZATION_APPROVAL_IDS.certificate) {
          await db.runTransaction(async transaction => {
            const currentSnapshot = await transaction.get(db.collection('equity-documents').doc(saved.equityDocumentId));
            const currentRequest = (await transaction.get(requestRef)).data();
            const currentDocument = currentSnapshot.data();
            if (!currentDocument || !currentRequest || isClosed(currentRequest) || currentRequest.documentContent !== currentDocument.content
              || currentRequest.documentContent !== saved.documentContent || currentRequest.signingGroupId !== saved.signingGroupId
              || currentDocument.signingGroupId !== saved.signingGroupId || currentDocument.needsResendSignature) throw fail(409, 'This approval changed. Prepare its current signature request before sending.');
            await readCapitalizationExecutionState(db, transaction, saved.equityDocumentId, currentDocument);
            if (currentRequest.capitalizationActionHash !== capitalizationActionHash(currentDocument)) throw fail(409, 'The capitalization instructions changed. Prepare a new signature request.');
          });
        }
      }
      if (recipientEmail && String(recipientEmail).trim().toLowerCase() !== String(saved.recipientEmail || '').trim().toLowerCase()) throw fail(400, 'Recipient does not match the saved signing request.');
      ({ documentName, recipientName, recipientEmail, companyName, previewMode, supportingDocuments: rawSupportingDocuments } = saved);
    }
    if (saved && isClosed(saved)) throw fail(409, 'This signing request is signed or invalidated.');

    if (!documentId || !recipientEmail) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields." }) };
    }

    const branding = resolveBranding(companyName || '');
    const supportingDocuments = normalizeSupportingDocuments(rawSupportingDocuments);
    const supportingDocumentsHtml = supportingDocuments.length ? `
                <div class="supporting-documents">
                  <p class="document-label">Supporting Review Packet</p>
                  <p class="supporting-copy">
                    These documents are included so you can review the full equity context before signing.
                  </p>
                  ${supportingDocuments.map(document => `
                    <a class="supporting-link" href="${escapeHtml(document.url)}" target="_blank" rel="noreferrer">
                      <span>
                        <strong>${escapeHtml(document.title)}</strong>
                        <small>${escapeHtml(formatDocumentType(document.documentType))}</small>
                      </span>
                      <span class="supporting-arrow">Open</span>
                    </a>
                  `).join('')}
                </div>
    ` : '';

    const signingUrl = `${BASE_URL}/sign/${documentId}${previewMode ? '?preview=1' : ''}`;
    const subject = saved?.documentType === 'strategic_signing_package' ? `Action Required: Review and sign your equity package` : previewMode
      ? `🧪 Preview Signature Test: "${documentName}"`
      : `📝 Action Required: Please Sign "${documentName}"`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              margin: 0; 
              padding: 0; 
              background-color: #09090b; 
              color: #ffffff; 
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background-color: #18181b; 
              border-radius: 16px;
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #18181b 0%, #27272a 100%);
              padding: 40px 30px;
              text-align: center;
              border-bottom: 1px solid #27272a;
            }
            .header h1 {
              color: ${branding.accentColor};
              font-size: 28px;
              font-weight: 700;
              margin: 0 0 8px 0;
              letter-spacing: -0.5px;
            }
            .header p {
              color: #a1a1aa;
              font-size: 14px;
              margin: 0;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              font-size: 18px;
              color: #ffffff;
              margin-bottom: 20px;
            }
            .message {
              font-size: 16px;
              line-height: 1.6;
              color: #d4d4d8;
              margin-bottom: 30px;
            }
            .document-box {
              background-color: #27272a;
              border-radius: 12px;
              padding: 20px;
              margin: 20px 0;
              border-left: 4px solid ${branding.accentColor};
            }
            .document-label {
              color: #a1a1aa;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            .document-name {
              color: #ffffff;
              font-size: 18px;
              font-weight: 600;
            }
            .supporting-documents {
              background-color: #1f2937;
              border: 1px solid #374151;
              border-radius: 12px;
              padding: 20px;
              margin: 20px 0 30px 0;
            }
            .supporting-copy {
              color: #d4d4d8;
              font-size: 14px;
              line-height: 1.5;
              margin: 0 0 14px 0;
            }
            .supporting-link {
              display: block;
              color: #ffffff !important;
              text-decoration: none;
              background-color: #111827;
              border: 1px solid #374151;
              border-radius: 10px;
              padding: 12px 14px;
              margin-top: 10px;
            }
            .supporting-link strong {
              display: block;
              font-size: 14px;
              margin-bottom: 4px;
            }
            .supporting-link small {
              display: block;
              color: #a1a1aa;
              font-size: 12px;
            }
            .supporting-arrow {
              display: inline-block;
              color: ${branding.accentColor};
              font-size: 12px;
              font-weight: 700;
              margin-top: 8px;
              text-transform: uppercase;
            }
            .cta-button {
              display: inline-block;
              background-color: ${branding.accentColor};
              color: ${branding.accentText} !important;
              text-decoration: none;
              padding: 16px 32px;
              border-radius: 12px;
              font-weight: 600;
              font-size: 16px;
              text-align: center;
              margin: 10px 0 30px 0;
            }
            .footer {
              padding: 30px;
              text-align: center;
              background-color: #09090b;
              border-top: 1px solid #27272a;
            }
            .footer p {
              color: #71717a;
              font-size: 12px;
              margin: 0 0 8px 0;
            }
            .footer a {
              color: ${branding.accentColor};
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div style="padding: 20px; background-color: #09090b;">
            <div class="container">
              <div class="header">
                <h1>${branding.displayCompany}</h1>
                <p>Document Signing Request</p>
              </div>
              
              <div class="content">
                <p class="greeting">Hi ${escapeHtml(recipientName)},</p>
                
                <p class="message">
                  ${previewMode
                    ? `<strong>${branding.requestedBy}</strong> from ${branding.requestedByCompany} sent you a preview signing test for the following document:`
                    : `<strong>${branding.requestedBy}</strong> from ${branding.requestedByCompany} has requested your signature on the following document:`}
                </p>
                
                <div class="document-box">
                  <p class="document-label">Document</p>
                  <p class="document-name">${escapeHtml(documentName)}</p>
                </div>
                ${supportingDocumentsHtml}
                
                <p class="message">
                  ${previewMode
                    ? 'This is a sandbox preview of the signing flow. You can click through, sign, and test the full experience without affecting the live document packet.'
                    : saved?.documentType === 'strategic_signing_package'
                      ? 'Use this single link to review your equity package. Sign each required agreement individually, and open the supporting records for reference. Your progress is saved as you complete each document.'
                      : 'Please use the secure link below to review, download, and sign this document.'}
                </p>
                
                <div style="text-align: center;">
                  <a href="${signingUrl}" class="cta-button">
                    ${previewMode ? 'Open Preview Signing Flow →' : saved?.documentType === 'strategic_signing_package' ? 'Open Signing Package →' : 'Review & Sign Document →'}
                  </a>
                </div>
                
                <p class="message" style="font-size: 14px; color: #71717a;">
                  ${previewMode
                    ? 'This preview email is for testing only. It uses a sandbox signing request and will not update the actual live document status.'
                    : 'This is a secure, legally-binding electronic signature request. Your signature will be recorded along with timestamp and verification details for compliance purposes.'}
                </p>
              </div>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} ${branding.footerCompany}. All rights reserved.</p>
                <p>Questions? Reply to this email or reach out at <a href="mailto:tre@fitwithpulse.ai">tre@fitwithpulse.ai</a></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const attemptId = typeof sendAttemptId === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(sendAttemptId) ? sendAttemptId : randomUUID();
    let startingDelivery: EquityEmailDelivery | undefined;
    if (equity) {
      const alreadyAccepted = await db.runTransaction(async transaction => {
        const latestSnapshot = await transaction.get(requestRef);
        const latest = latestSnapshot.data();
        if (!latestSnapshot.exists || isClosed(latest) || latest?.recipientEmail !== saved?.recipientEmail
          || latest?.documentContent !== saved?.documentContent || latest?.equityDocumentId !== saved?.equityDocumentId) throw fail(409, 'This signature request changed. Review it before sending.');
        const previous = getEquityEmailDelivery(latest);
        if (previous.attemptId === attemptId && previous.messageId) return previous;
        const attempted = previous.attemptedAt as any;
        const attemptedMs = attempted?.toMillis?.() ?? (attempted?.seconds ? attempted.seconds * 1000 : new Date(attempted || 0).getTime());
        if (previous.status === 'sending' && Date.now() - attemptedMs < 120000) throw fail(409, 'This email is already being submitted. Check its delivery status before retrying.');
        if (previous.attemptId === attemptId) throw fail(409, 'This send attempt has already been recorded. Check its status, then use Resend to make a new attempt.');
        const now = new Date();
        startingDelivery = {status: 'sending', messageId: null, attemptId, recipientEmail, attemptedAt: now,
          reason: null, checkError: null, ...(previous.unresolvedFailure ? {unresolvedFailure: previous.unresolvedFailure} : {})};
        transaction.set(requestRef, {emailDelivery: startingDelivery, emailStatus: 'sending', messageId: null,
          emailDeliveryAttempts: [...(Array.isArray(latest.emailDeliveryAttempts) ? latest.emailDeliveryAttempts : []),
            ...(previous.attemptId || previous.messageId ? [previous] : [])].slice(-20), updatedAt: now}, {merge: true});
        return null;
      });
      if (alreadyAccepted) return {statusCode: alreadyAccepted.status === 'failed' ? 502 : 200,
        body: JSON.stringify({message: 'This email attempt is already recorded. Check its delivery status before retrying.', emailDelivery: alreadyAccepted, messageId: alreadyAccepted.messageId, skipped: true})};
    }

    let transportUncertain = false;
    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipientEmail,
      toName: recipientName || recipientEmail,
      subject,
      htmlContent,
      sender: {
        name: branding.senderName,
        email: SENDER_EMAIL,
      },
      tags: ['signing-request'],
      headers: {
        'X-Mailin-custom': JSON.stringify({
          sequence: 'signing-request',
          signingRequestId: documentId,
          sendAttemptId: attemptId,
          recipientEmail,
          previewMode: Boolean(previewMode),
        }),
      },
      idempotencyKey: buildEmailDedupeKey(['signing-request-v2', documentId, recipientEmail, attemptId]),
      idempotencyMetadata: {
        sequence: 'signing-request',
        documentId,
        recipientEmail,
        sendAttemptId: attemptId,
      },
      bypassDailyRecipientLimit: true,
      dailyRecipientMetadata: {
        sequence: 'signing-request',
        documentId,
      },
    }).catch(() => {
      transportUncertain = true;
      return {success: false, error: 'The email provider did not confirm the submission. Check delivery status before retrying.', messageId: undefined, skipped: false, suppressed: false, suppressionReason: undefined};
    });

    const accepted = sendResult.success && Boolean(sendResult.messageId) && !sendResult.suppressed;
    const reason = sendResult.suppressed
      ? `Email was not sent: ${sendResult.suppressionReason || 'the recipient is suppressed by the email service'}.`
      : sendResult.error || (!accepted ? 'Brevo did not return a message ID. Delivery is not confirmed; check status before retrying.' : null);
    const deliveryState = accepted ? 'accepted' : transportUncertain || (sendResult.success && !sendResult.suppressed) ? 'unknown' : 'failed';
    let recordedDelivery: EquityEmailDelivery | undefined;
    const now = new Date();
    try {
      const FieldValue = admin.firestore.FieldValue;
      await db.runTransaction(async transaction => {
        const latestSnapshot = await transaction.get(requestRef);
        const latest = latestSnapshot.data();
        // Delivery tracking must never overwrite a concurrent signature, invalidation, or later send.
        if (isClosed(latest)) return;
        if (equity && (!latestSnapshot.exists || latest?.recipientEmail !== saved?.recipientEmail
          || latest?.documentContent !== saved?.documentContent || latest?.equityDocumentId !== saved?.equityDocumentId
          || latest?.emailDelivery?.attemptId !== attemptId)) return;
        const children = accepted && latest?.documentType === 'strategic_signing_package'
          ? await Promise.all((latest.childRequestIds || []).map((id: string) => transaction.get(db.collection('signingRequests').doc(id)))) : [];
        if (equity) {
          recordedDelivery = {...startingDelivery!, status: deliveryState, messageId: sendResult.messageId || null, reason,
            ...(accepted ? {acceptedAt: now} : {}),
            ...(!accepted ? {unresolvedFailure: {reason: reason || 'Email delivery is not confirmed.', at: now, messageId: sendResult.messageId || null}} : {})};
          transaction.set(requestRef, {emailDelivery: recordedDelivery, emailStatus: deliveryState,
            messageId: sendResult.messageId || null, lastEmailError: accepted ? (recordedDelivery.unresolvedFailure?.reason || null) : reason,
            ...(accepted ? {status: ['viewed', 'opened'].includes(latest?.status) ? latest.status : 'sent', sentAt: latest?.sentAt || now, lastSentAt: now, sendCount: FieldValue.increment(1), supportingDocuments} : {}), updatedAt: now}, {merge: true});
        } else if (accepted) {
          transaction.set(requestRef, {status: latest?.status === 'viewed' ? 'viewed' : 'sent', sentAt: now, lastSentAt: now,
            emailStatus: 'sent', messageId: sendResult.messageId, sendCount: FieldValue.increment(1), supportingDocuments, updatedAt: now}, {merge: true});
        }
        for (const child of children) {
          const record = child.data();
          if (!record || record.packageId !== documentId || isClosed(record)) continue;
          transaction.update(child.ref, {status: ['viewed', 'opened'].includes(record.status) ? record.status : 'sent', sentAt: record.sentAt || now, lastSentAt: now, emailStatus: 'accepted', updatedAt: now});
        }
      });
    } catch (dbError) {
      console.error('Unable to persist signing email delivery status.');
      if (equity) return {statusCode: 503, body: JSON.stringify({message: accepted
        ? 'Brevo accepted the email, but its delivery status could not be saved. Check delivery status before sending again.'
        : 'Email delivery is not confirmed and its status could not be saved. Check delivery status before sending again.', messageId: sendResult.messageId || null})};
    }

    if (!accepted) return {statusCode: 502, body: JSON.stringify({message: reason, emailDelivery: recordedDelivery})};
    return {statusCode: 200, body: JSON.stringify({message: 'Brevo accepted the email. Delivery has not yet been confirmed.', messageId: sendResult.messageId,
      emailDelivery: recordedDelivery, skipped: sendResult.skipped || false})};

  } catch (error: any) {
    console.error("Error in send-signing-request function:", error);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        message: error.statusCode ? error.message : "Internal server error while sending email."
      })
    };
  }
};

export { handler };
