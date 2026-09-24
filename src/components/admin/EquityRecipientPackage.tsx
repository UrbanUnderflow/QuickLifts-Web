import React, {useEffect, useRef, useState} from 'react';
import {X, FileText, Send, CheckCircle2, AlertCircle, ExternalLink, Upload} from 'lucide-react';
import {auth, isUsingDevFirebase} from '../../api/firebase/config';
import {evaluateDocumentSignatures, type ExecutionRequest} from '../../lib/equityExecution';
import EquityDocumentUpload from './EquityDocumentUpload';
import EquityEmailDeliveryPanel, {type DeliveryControls, type DeliveryRequest, emailDeliveryIsUnconfirmed, emailDeliverySendInProgress} from './EquityEmailDeliveryPanel';
import EquityEmailSendConfirmation from './EquityEmailSendConfirmation';
import {getEquityEmailDelivery} from '../../lib/equityEmailDelivery';
import {getEquitySigningRequirements} from '../../lib/equitySigningRequirements';
import {isEquityDocumentLocked} from '../../lib/equityDocumentUpload';

type PackageDocument = {
  id: string; title: string; content: string; documentType: string; status: string;
  approvalStatus?: string; closingRequirements?: string[]; signingRequestIds?: string[];
  preparedSigners?: {name: string; email: string; role: string}[];
  archivedFromEquity?: boolean; exhibits?: string[]; requiresSignature?: boolean; contractualBuybackRevision?: number;
  signingRequestId?: string; signedAt?: unknown; autoSigned?: boolean; autoSignedAt?: unknown;
  signatureData?: unknown; updatedAt?: unknown; sourceFileName?: string;
  originalUpload?: {fileName: string; mimeType: string; dataUrl: string};
  capitalizationRevision?: number; prerequisiteDocumentIds?: string[];
  capitalizationRecordedAt?: unknown; capitalizationLedgerEventId?: string;
};
const signIds = ['pil-auntedna-vesting-shares-draft', 'pil-auntedna-20260909-04', 'pil-auntedna-20260909-07', 'pil-edna-reciprocal-buyback-agreement'];
const signLabels = ['Strategic Vesting Share Agreement', 'Reciprocal Strategic Equity Side Letter', 'PIL Warrant to EDNA', 'Reciprocal Buyback Agreement'];
const signTitles = ['PIL Strategic Vesting Share Agreement', 'Revised Reciprocal Strategic Equity Side Letter', 'PIL Strategic Partnership Warrant to EDNA', 'PIL and EDNA Reciprocal Share-Award Buyback Agreement'];
const signTypes = ['strategic_vesting_equity_agreement', 'strategic_equity_side_letter', 'strategic_warrant_pil_to_auntedna', 'strategic_reciprocal_buyback_agreement'];
const approvalTypes = ['strategic_board_consent_pil', 'strategic_capitalization_certificate', 'strategic_consideration_schedule'];
const approvalLabels = ['Board consent', 'Capitalization and share-reservation certificate', 'Consideration and buyback-cost schedule'];
const fallbackApprovalIds = ['pil-auntedna-20260909-05', 'XmKR9EaPEkeQZcQbaw0A', 'vUHlnWuAKMcQBplIHqPH'];
const milliseconds = (value: any): number => typeof value?.toMillis === 'function' ? value.toMillis() : typeof value?.seconds === 'number' ? value.seconds * 1000 : new Date(value || 0).getTime() || 0;
const boardId = 'pil-auntedna-20260909-05';
const capitalizationSteps = [
  {id: 'pil-founder-share-return-2026-09-23', documentType: 'founder_share_return', label: 'Founder share return', description: 'Return 1,000,000 shares and record your remaining 8,000,000 shares in the stock ledger.'},
  {id: 'pil-eip-reserve-approval-2026-09-23', documentType: 'equity_reserve_approval', label: 'EIP reserve approval', description: 'Approve the 1,600,000-share EIP reserve as sole director and sole stockholder.'},
];
const isReviewedCapitalization = (document: PackageDocument | undefined) => Boolean(document?.id === fallbackApprovalIds[1] && document.capitalizationRevision === 1
  && document.prerequisiteDocumentIds?.length === 3 && new Set(document.prerequisiteDocumentIds).size === 3
  && [boardId, ...capitalizationSteps.map(step => step.id)].every(id => document.prerequisiteDocumentIds?.includes(id)));
const capitalizationRecordRequirements = new Set([
  'Confirm authorized shares against charter, complete founder share return and reserve approvals, and certify outstanding shares and convertible-note treatment.',
  'Complete founder share return and reserve approvals, and certify outstanding shares and convertible-note treatment.',
]);
export default function EquityRecipientPackage({documents, requests, onClose, onSent, deliveryControls}: {
  documents: PackageDocument[]; requests: ExecutionRequest[]; onClose: () => void; onSent: () => void; deliveryControls: DeliveryControls;
}) {
  const [capitalizationId, setCapitalizationId] = useState('');
  const [considerationId, setConsiderationId] = useState('');
  const [pendingUpload, setPendingUpload] = useState<{file: File; documentId: string; documentType: string; title: string; preparedSigners: {name: string; email: string; role: string}[]} | null>(null);
  const [selfSending, setSelfSending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [deliveries, setDeliveries] = useState<Array<{documentId: string; recipientEmail: string; recipientName: string; sendAttemptId: string}>>([]);
  const [sent, setSent] = useState<string[]>([]);
  const [pendingSend, setPendingSend] = useState<{mode: 'self' | 'package'; documents: string[]; deliveries: Array<{documentId: string; recipientEmail: string; recipientName: string; sendAttemptId: string}>; accepted: string[]} | null>(null);
  const [sendError, setSendError] = useState('');
  const attemptId = useRef<string>('');
  const signDocuments = signIds.map(id => documents.find(d => d.id === id));
  const board = documents.find(d => d.id === boardId);
  const documentVerified = (document: PackageDocument | undefined) => Boolean(document && evaluateDocumentSignatures(document as any, requests).verified);
  const boardVerified = documentVerified(board);
  const capitalizationDocuments = capitalizationSteps.map(step => documents.find(document => document.id === step.id));
  const capitalizationApprovalRecorded = (document: PackageDocument | undefined) => documentVerified(document) && document?.approvalStatus === 'approved' && Boolean(document.capitalizationRecordedAt) && document.capitalizationLedgerEventId === document.id;
  const founderReturnVerified = capitalizationApprovalRecorded(capitalizationDocuments[0]);
  const reserveApprovalVerified = capitalizationApprovalRecorded(capitalizationDocuments[1]);
  const capitalizationPrerequisitesComplete = founderReturnVerified && reserveApprovalVerified && boardVerified;
  const recipients = [...new Map(signDocuments.flatMap(d => d?.preparedSigners || []).map(s => [s.email.trim().toLowerCase(), s])).values()];
  const references = [board, documents.find(d => d.id === capitalizationId), documents.find(d => d.id === considerationId)];
  useEffect(() => {
    const currentDocument = (type: string) => documents
      .filter(d => !d.archivedFromEquity && d.documentType === type)
      .sort((a, b) => Number(Boolean(board?.exhibits?.includes(b.id))) - Number(Boolean(board?.exhibits?.includes(a.id)))
        || milliseconds(b.updatedAt) - milliseconds(a.updatedAt) || a.id.localeCompare(b.id))[0];
    if (!documents.some(d => d.id === considerationId && !d.archivedFromEquity)) setConsiderationId(currentDocument(approvalTypes[2])?.id || '');
    if (!documents.some(d => d.id === capitalizationId && !d.archivedFromEquity)) setCapitalizationId(currentDocument(approvalTypes[1])?.id || '');
  }, [documents, board, considerationId, capitalizationId]);
  const blockers = [
    ...references.filter((d: any) => d?.requiresSignature && !evaluateDocumentSignatures(d, requests).verified).map(d => `${d!.title}: required signatures are not yet verified.`),
    ...signDocuments.flatMap((d, i) => !d ? [`Required agreement ${i + 1} is missing.`] : d.status !== 'completed' || !d.content?.trim() ? [`${d.title} is not complete.`] : getEquitySigningRequirements(d).map(item => `${d.title}: ${String(item)}`)),
    ...(!boardVerified ? ['PIL board consent must have verified signatures before this recipient package can be sent.'] : []),
    ...(!capitalizationId ? ['Upload the capitalization and share-reservation certificate.'] : references[1]?.approvalStatus !== 'approved' ? ['The capitalization certificate needs recorded approval.'] : []),
    ...(references[1] && !isReviewedCapitalization(references[1]) ? ['The capitalization certificate needs its revised calculation basis.'] : []),
    ...(!capitalizationPrerequisitesComplete ? ['Complete the founder share return, EIP reserve approval, and EDNA board consent shown under the capitalization certificate.'] : []),
    ...(!considerationId ? ['Upload the consideration and buyback-cost schedule.'] : references[2]?.approvalStatus !== 'approved' ? ['The consideration schedule needs recorded approval.'] : []),
    ...(!recipients.length || recipients.some(s => !s.email || !s.name) ? ['Complete the saved signer names and email addresses.'] : []),
  ];
  const beginUpload = (file: File, selected: PackageDocument | undefined, documentId: string, documentType: string, title: string, forApproval = false) => {
    if (busy || selfSending || pendingUpload || deliveries.length) return;
    if (isEquityDocumentLocked(selected)) {setMessage('This document has a signing record. Its saved version is locked.'); return;}
    setPendingUpload({file, documentId, documentType: selected?.documentType || documentType, title, preparedSigners: selected?.preparedSigners?.length ? selected.preparedSigners
      : forApproval ? [{name: 'Tremaine Grant', email: 'tre@fitwithpulse.ai', role: capitalizationSteps.some(step => step.documentType === documentType) ? 'Founder, Sole Stockholder, Sole Director and Chief Executive Officer' : 'Sole Director and Chief Executive Officer'}]
      : signDocuments[0]?.preparedSigners || []});
  };
  const sendToMe = async (documentId: string) => {
    if (busy || selfSending || pendingUpload) return;
    const existingRequest = (requests as DeliveryRequest[]).find(request => request.equityDocumentId === documentId && !request.invalidatedAt && emailDeliveryIsUnconfirmed(request));
    if (existingRequest) {await deliveryControls.check([existingRequest.packageId || existingRequest.id]); if (emailDeliverySendInProgress(existingRequest)) {setMessage('Your previous send is still being processed. Check delivery status in a moment.'); return;}}
    setSelfSending(documentId); setMessage('Preparing your signature request for review…'); setSendError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sign in before sending.');
      const headers = {'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-PulseCheck-Firebase-Mode': isUsingDevFirebase() ? 'dev' : 'prod'};
      const prepared = await fetch('/.netlify/functions/prepare-equity-self-signature', {method: 'POST', headers, body: JSON.stringify({documentId})});
      const result = await prepared.json();
      if (!prepared.ok) throw new Error(result.error || result.message || 'Unable to prepare your signature request.');
      if (!result.delivery?.recipientEmail || !result.delivery?.documentId) throw new Error('The prepared request is missing its recipient address. No email was sent.');
      deliveryControls.clearSubmissionIssue(documentId);
      setPendingSend({mode: 'self', documents: [documents.find(document => document.id === documentId)?.title || 'Approval document'], deliveries: [result.delivery], accepted: []});
      setMessage('Review the recipient address and confirm to send your signature email.');
      onSent();
    } catch (error) { const text = error instanceof Error ? error.message : 'Unable to prepare your signature request.'; setMessage(text); const document = documents.find(item => item.id === documentId); deliveryControls.recordSubmissionIssue({stage: 'prepare', documentId, documentName: document?.title || 'Approval document', recipientName: document?.preparedSigners?.[0]?.name, recipientEmail: document?.preparedSigners?.[0]?.email, message: text}); }
    finally { setSelfSending(null); }
  };
  const hasActiveRequest = (document: PackageDocument | undefined) => requests.some(request => document?.signingRequestIds?.includes(request.id) && !request.invalidatedAt && !request.previewMode && (request.sentAt || ['sent', 'delivered', 'opened', 'viewed'].includes(request.status)));
  const prerequisiteRow = (step: typeof capitalizationSteps[number], index: number) => {
    const document = capitalizationDocuments[index];
    const signed = documentVerified(document);
    const verified = capitalizationApprovalRecorded(document);
    const activeRequest = hasActiveRequest(document);
    const needsFounderReturn = index === 1 && !founderReturnVerified;
    const incomplete = !document || document.status !== 'completed' || !document.content?.trim() || Boolean(document.closingRequirements?.length);
    const disabled = busy || Boolean(selfSending) || Boolean(pendingUpload) || Boolean(deliveries.length);
    const label = verified ? 'Signed and recorded' : signed ? 'Signed. The share records still need to be recorded.' : !document ? 'Document needs to be uploaded' : needsFounderReturn ? 'Sign the founder return first' : incomplete ? 'Document needs completion' : activeRequest ? 'Awaiting your signature' : 'Ready for your signature';
    return <div key={step.id} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <div className="flex gap-2 items-start">
        {verified ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300 mt-0.5" /> : <span className="w-4 shrink-0 text-zinc-500">{index + 1}.</span>}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">{step.label}</p>
          {document?.preparedSigners?.map(signer => <p key={signer.email} className="mt-1 break-words text-xs text-blue-200">To: {signer.name} · {signer.email}</p>)}
          <p className="mt-1 text-xs text-zinc-400">{step.description}</p>
          <p className={`mt-2 text-xs ${verified ? 'text-emerald-300' : needsFounderReturn || incomplete || activeRequest ? 'text-amber-200' : 'text-zinc-300'}`}>{label}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 items-center">
            {document && <a href={`/equity-doc/${document.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-200">View document <ExternalLink className="h-3 w-3" /></a>}
            {!isEquityDocumentLocked(document) && <label className={`inline-flex items-center gap-1 text-xs text-zinc-400 ${disabled ? 'opacity-40' : 'cursor-pointer hover:text-zinc-100'}`}>
              <Upload className="h-3 w-3" />{document ? 'Replace' : 'Upload'}
              <input className="sr-only" type="file" accept=".pdf,.html,.htm,.txt" disabled={disabled} aria-label={`Upload ${step.label.toLowerCase()}`} onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; if (file) beginUpload(file, document, step.id, step.documentType, step.label, true);}} />
            </label>}
            {!signed && <button disabled={disabled || incomplete || needsFounderReturn} onClick={() => document && sendToMe(document.id)} className="rounded-lg border border-blue-500/40 px-3 py-1.5 text-sm text-blue-200 disabled:opacity-40">{selfSending === document?.id ? 'Preparing…' : activeRequest ? 'Resend for signature' : 'Send for signature'}</button>}
          </div>
          {!!document?.closingRequirements?.length && <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-amber-200">{document.closingRequirements.map(item => <li key={item}>{item}</li>)}</ul>}
        </div>
      </div>
    </div>;
  };
  const approvalRow = (document: PackageDocument | undefined, index: number) => {
    const execution = document && evaluateDocumentSignatures(document as any, requests);
    const verified = Boolean(execution?.verified);
    const locked = isEquityDocumentLocked(document) || Boolean(execution?.hasRecordedSignatures);
    const activeRequest = hasActiveRequest(document);
    const isCapitalization = index === 1;
    const revisedCertificate = isReviewedCapitalization(document);
    const capitalizationBlocked = isCapitalization && (!capitalizationPrerequisitesComplete || !revisedCertificate);
    const incomplete = Boolean(document?.closingRequirements?.length || document?.status !== 'completed' || !document?.content?.trim() || capitalizationBlocked);
    const otherRequirements = document?.closingRequirements?.filter(item => !isCapitalization || !capitalizationRecordRequirements.has(item)) || [];
    const disabled = busy || Boolean(selfSending) || Boolean(pendingUpload) || Boolean(deliveries.length);
    const label = !document ? 'Upload document' : verified ? 'Signed. Included in the EDNA package.' : isCapitalization && !capitalizationPrerequisitesComplete ? 'Complete the approvals below, then sign this certificate' : incomplete ? 'Needs completion before signing' : activeRequest ? 'Awaiting your signature' : 'Ready for your signature';
    return <div key={approvalTypes[index]} className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        {verified ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300 mt-0.5" /> : <FileText className="h-5 w-5 shrink-0 text-zinc-400 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{approvalLabels[index]}</p>
          {document?.preparedSigners?.map(signer => <p key={signer.email} className="mt-1 break-words text-xs text-blue-200">To: {signer.name} · {signer.email}</p>)}
          <p className={`mt-1 text-xs ${verified ? 'text-emerald-300' : incomplete || activeRequest ? 'text-amber-300' : 'text-zinc-400'}`}>{label}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
            {document && <a href={`/equity-doc/${document.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-200">View <ExternalLink className="w-3 h-3" /></a>}
            {document?.originalUpload && <a className="text-xs text-zinc-400 hover:text-zinc-100" href={document.originalUpload.dataUrl} download={document.originalUpload.fileName}>Original file</a>}
            {!locked && <label className={`inline-flex items-center gap-1.5 text-sm text-zinc-400 ${disabled ? 'opacity-40' : 'cursor-pointer hover:text-zinc-100'}`}>
              <Upload className="w-3.5 h-3.5" />{document ? 'Upload replacement' : 'Upload'}
              <input className="sr-only" type="file" accept=".pdf,.html,.htm,.txt" disabled={disabled} aria-label={`Upload ${approvalLabels[index].toLowerCase()}`} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) beginUpload(file, document, document?.id || fallbackApprovalIds[index], approvalTypes[index], approvalLabels[index], true); }} />
            </label>}
            {document && !verified && <button disabled={disabled || incomplete} onClick={() => sendToMe(document.id)} className="ml-auto rounded-lg border border-blue-500/40 px-3 py-1.5 text-sm text-blue-200 disabled:opacity-40">{selfSending === document.id ? 'Preparing…' : activeRequest ? 'Resend to me' : 'Send to me for signing'}</button>}
          </div>
        </div>
      </div>
      {isCapitalization && <details className="ml-8 mt-3 text-xs leading-relaxed text-zinc-300">
        <summary className={`cursor-pointer ${capitalizationPrerequisitesComplete ? 'text-emerald-300' : 'text-amber-200'}`}>{capitalizationPrerequisitesComplete ? 'Supporting approvals complete' : 'Complete the supporting approvals'} ({[founderReturnVerified, reserveApprovalVerified, boardVerified].filter(Boolean).length} of 3)</summary>
        <p className="mt-3">Sign the founder return first, then the reserve approval. Your verified signatures record the share return and approved reserve in the equity system.</p>
        <div className="mt-3 space-y-3">{capitalizationSteps.map(prerequisiteRow)}</div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 mt-3">
          <p className="text-sm font-medium text-zinc-100">3. EDNA board consent</p>
          <p className="mt-1 text-xs text-zinc-400">Approves the separate 400,000-share EDNA reserve once the founder return makes those shares available.</p>
          <p className={`mt-2 text-xs ${boardVerified ? 'text-emerald-300' : 'text-amber-200'}`}>{boardVerified ? 'Signed' : 'Your board signature is required'}</p>
          <div className="flex flex-wrap gap-3 items-center mt-3">
            {board && <a href={`/equity-doc/${board.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-200">View board consent <ExternalLink className="w-3 h-3" /></a>}
            {board && !boardVerified && <button disabled={disabled || board.status !== 'completed' || !board.content?.trim() || Boolean(board.closingRequirements?.length)} onClick={() => sendToMe(board.id)} className="rounded-lg border border-blue-500/40 px-3 py-1.5 text-sm text-blue-200 disabled:opacity-40">{selfSending === board.id ? 'Preparing…' : hasActiveRequest(board) ? 'Resend for signature' : 'Send for signature'}</button>}
          </div>
        </div>
        <p className="mt-3 text-zinc-400">{revisedCertificate ? 'The revised certificate explains the 10,000,000-share allocation basis and separately discloses the LAUNCH note’s future conversion. Once the three approvals are recorded, you can sign the certificate above.' : 'The certificate still needs its revised calculation basis before it can be signed.'}</p>
        <p className="mt-2 text-zinc-500">Signed supporting approvals are included with the EDNA package for reference.</p>
      </details>}
      {!!otherRequirements.length && <details className="ml-8 mt-2 text-xs text-amber-200"><summary className="cursor-pointer">What needs to be completed</summary><ul className="list-disc pl-4 mt-2 space-y-1">{otherRequirements.map(item => <li key={item}>{item}</li>)}</ul></details>}
    </div>;
  };
  const send = async () => {
    if (blockers.length || busy || selfSending || pendingUpload) return;
    setBusy(true); setMessage('Preparing the saved documents and checking approvals…');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sign in before sending.');
      const headers = {'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-PulseCheck-Firebase-Mode': isUsingDevFirebase() ? 'dev' : 'prod'};
      let prepared = deliveries;
      if (!prepared.length) {
        if (!attemptId.current) attemptId.current = crypto.randomUUID();
        const response = await fetch('/.netlify/functions/prepare-equity-package', {method: 'POST', headers, body: JSON.stringify({attemptId: attemptId.current, packageName: 'PIL and EDNA strategic equity package', documentIds: signIds, referenceDocumentIds: [boardId, capitalizationId, considerationId, ...capitalizationSteps.map(step => step.id)]})});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || result.message || 'Unable to prepare the package.');
        prepared = result.deliveries;
        if (!Array.isArray(prepared) || !prepared.length) throw new Error('No recipient packages were prepared.');
        setDeliveries(prepared);
      }
      setSendError('');
      deliveryControls.clearSubmissionIssue('edna-package');
      setPendingSend({mode: 'package', documents: [...signDocuments.map(document => document!.title), ...references.filter(Boolean).map(document => `${document!.title} (reference)`), ...capitalizationDocuments.filter(Boolean).map(document => `${document!.title} (reference)`)], deliveries: prepared, accepted: sent});
      setMessage('Review every recipient address and confirm to send the package.');
      onSent();
    } catch (error) { const text = error instanceof Error ? error.message : 'Unable to prepare the package.'; setMessage(text); deliveryControls.recordSubmissionIssue({stage: 'prepare', documentId: 'edna-package', documentName: 'PIL and EDNA strategic equity package', message: text}); }
    finally { setBusy(false); }
  };
  const confirmSend = async () => {
    if (!pendingSend || busy) return;
    setBusy(true); setSendError('');
    let attemptedDelivery: typeof pendingSend.deliveries[number] | undefined;
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sign in before sending.');
      for (const delivery of pendingSend.deliveries) {
        if (pendingSend.accepted.includes(delivery.documentId)) continue;
        attemptedDelivery = delivery;
        const existing = (requests as DeliveryRequest[]).find(request => request.id === delivery.documentId);
        if (emailDeliverySendInProgress(existing)) {void deliveryControls.check([delivery.documentId]); throw new Error('Your previous send is still being processed. Check delivery status in a moment.');}
        const sendPayload = existing && (getEquityEmailDelivery(existing).status === 'failed' || emailDeliveryIsUnconfirmed(existing)) ? {...delivery, sendAttemptId: crypto.randomUUID()} : delivery;
        const response = await fetch('/.netlify/functions/send-signing-request', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-PulseCheck-Firebase-Mode': isUsingDevFirebase() ? 'dev' : 'prod'}, body: JSON.stringify(sendPayload)});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || result.message || `Unable to send to ${delivery.recipientEmail}.`);
        deliveryControls.clearSubmissionIssue('', delivery.documentId);
        setPendingSend(previous => previous && ({...previous, accepted: [...previous.accepted, delivery.documentId]}));
        if (pendingSend.mode === 'package') setSent(previous => [...new Set([...previous, delivery.documentId])]);
      }
      setMessage(`Submitted to Brevo for ${pendingSend.deliveries.map(delivery => delivery.recipientEmail).join(', ')}. Delivery confirmation appears below.`);
      const ids = pendingSend.deliveries.map(delivery => delivery.documentId);
      setPendingSend(null);
      onSent();
      void deliveryControls.check(ids);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to send. The prepared request is retained.';
      if (attemptedDelivery) {const request = requests.find(item => item.id === attemptedDelivery!.documentId); deliveryControls.recordSubmissionIssue({stage: 'send', documentId: request?.equityDocumentId || 'edna-package', documentName: pendingSend.documents[0] || 'Signature package', requestId: attemptedDelivery.documentId, recipientName: attemptedDelivery.recipientName, recipientEmail: attemptedDelivery.recipientEmail, message: text});}
      setSendError(text); setMessage(text); onSent();
    } finally { setBusy(false); }
  };
  const packageDocumentIds = new Set(['edna-package', ...signIds, ...fallbackApprovalIds, ...capitalizationSteps.map(step => step.id), capitalizationId, considerationId]);
  const packageRequests = (requests as DeliveryRequest[]).filter(request => packageDocumentIds.has(request.equityDocumentId || '') || request.documentType === 'strategic_signing_package');
  const allSent = deliveries.length > 0 && deliveries.every(d => sent.includes(d.documentId));
  const working = busy || Boolean(selfSending) || Boolean(pendingUpload);
  return <><div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="recipient-package-title">
    <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl border border-zinc-700 bg-zinc-950 text-zinc-100">
      <div className="p-6 border-b border-zinc-800 flex justify-between gap-4">
        <div><h2 id="recipient-package-title" className="text-xl font-semibold">EDNA signing package</h2><p className="mt-1 text-sm text-zinc-400">Sign your three approvals, then send the full package.</p></div>
        <button aria-label="Close package" onClick={onClose} disabled={working}><X /></button>
      </div>
      <div className="p-6 space-y-7">
        <EquityEmailDeliveryPanel requests={packageRequests} controls={deliveryControls} documentIds={[...packageDocumentIds]} />
        <section aria-labelledby="your-approvals-title">
          <div className="flex items-center justify-between gap-3 mb-2"><h3 id="your-approvals-title" className="font-semibold">Your approvals</h3><span className="text-xs text-zinc-400">{references.filter(document => document && evaluateDocumentSignatures(document as any, requests).verified).length} of 3 signed</span></div>
          <p className="text-sm text-zinc-400 mb-4">Signed copies are automatically included for EDNA to read.</p>
          <div className="rounded-xl border border-zinc-800 p-4 divide-y divide-zinc-800">{references.map(approvalRow)}</div>
          <p className="text-xs text-zinc-500 mt-3">Document dates are filled when sent. Signatures record the actual signing date.</p>
        </section>
        <section aria-labelledby="edna-signatures-title">
          <h3 id="edna-signatures-title" className="font-semibold mb-2">For both parties to sign</h3>
          <p className="text-sm text-zinc-400 mb-4">One email per signer, with all four documents and your signed approvals.</p>
          <div className="rounded-xl border border-zinc-800 px-4 divide-y divide-zinc-800">{signDocuments.map((document, i) => <div key={signIds[i]} className="py-3 flex items-center gap-3"><FileText className="w-4 h-4 shrink-0 text-zinc-400" /><p className="text-sm flex-1">{signLabels[i]}</p>{document ? <a className="text-sm text-blue-200 inline-flex gap-1 items-center" href={`/equity-doc/${document.id}`} target="_blank" rel="noreferrer">View <ExternalLink className="w-3 h-3" /></a> : <span className="text-xs text-amber-300">Missing</span>}{document?.originalUpload && <a className="text-xs text-zinc-400 hover:text-zinc-100" href={document.originalUpload.dataUrl} download={document.originalUpload.fileName}>Original</a>}{!isEquityDocumentLocked(document) && <label className={`text-xs text-zinc-400 ${working || deliveries.length ? 'opacity-40' : 'cursor-pointer hover:text-zinc-100'}`}>{document ? 'Replace' : 'Upload'}<input className="sr-only" type="file" accept=".pdf,.html,.htm,.txt" aria-label={`Upload ${signLabels[i]}`} disabled={working || Boolean(deliveries.length)} onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; if (file) beginUpload(file, document, signIds[i], signTypes[i], signTitles[i]);}} /></label>}</div>)}</div>
        </section>
        <details className="text-sm"><summary className="cursor-pointer text-zinc-400">Recipients ({recipients.length})</summary><div className="mt-2">{recipients.map(s => <p key={s.email} className="py-1">{s.name} <span className="text-zinc-400">· {s.email}</span></p>)}</div></details>
        {!!blockers.length && <details className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><summary className="cursor-pointer text-sm text-amber-200">Complete approvals before sending to EDNA</summary><ul className="list-disc pl-5 text-xs text-amber-100/80 space-y-2 mt-3">{[...new Set(blockers)].map(item => <li key={item}>{item}</li>)}</ul></details>}
        {message && <p role="status" className="text-sm text-blue-200">{message}</p>}
      </div>
      <div className="p-5 border-t border-zinc-800 flex justify-end gap-3"><button onClick={onClose} disabled={working} className="px-4 py-2 rounded-lg border border-zinc-700 text-sm">Close</button><button disabled={working || !!blockers.length || allSent} onClick={send} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm disabled:opacity-40 inline-flex gap-2 items-center">{allSent ? <CheckCircle2 className="w-4" /> : blockers.length ? <AlertCircle className="w-4" /> : <Send className="w-4" />}{busy ? 'Sending package…' : allSent ? 'Submitted. Check delivery above' : deliveries.length ? 'Retry unsent recipients' : 'Send EDNA package'}</button></div>
    </div>
  </div>{pendingSend && <EquityEmailSendConfirmation documents={pendingSend.documents} recipients={pendingSend.deliveries.filter(delivery => !pendingSend.accepted.includes(delivery.documentId))} busy={busy} error={sendError} warning={pendingSend.deliveries.some(delivery => emailDeliveryIsUnconfirmed((requests as DeliveryRequest[]).find(request => request.id === delivery.documentId))) ? 'Previous delivery could not be verified. Sending again may deliver a duplicate email.' : undefined} confirmLabel={pendingSend.deliveries.some(delivery => emailDeliveryIsUnconfirmed((requests as DeliveryRequest[]).find(request => request.id === delivery.documentId))) ? 'Confirm resend' : undefined} onCheckDelivery={() => {void deliveryControls.check(pendingSend.deliveries.map(delivery => delivery.documentId));}} onConfirm={() => {void confirmSend();}} onCancel={() => {setPendingSend(null); setSendError('');}} />}{pendingUpload && <EquityDocumentUpload {...pendingUpload} onClose={() => setPendingUpload(null)} onSaved={id => {
    if (pendingUpload.documentType === approvalTypes[1]) setCapitalizationId(id);
    if (pendingUpload.documentType === approvalTypes[2]) setConsiderationId(id);
    setPendingUpload(null); setMessage('Document saved. It is ready for review in your package.'); onSent();
  }} />}</>;
}
