import React, {useEffect, useState} from 'react';
import {doc, runTransaction, Timestamp} from 'firebase/firestore';
import {auth, db} from '../../api/firebase/config';
import {extractEquityUpload, isEquityDocumentLocked} from '../../lib/equityDocumentUpload';
import capitalizationDocuments from '../../content/equity/edna-capitalization-approvals.json';

type Signer = {name: string; email: string; role: string};
export default function EquityDocumentUpload({file, documentId, documentType, title, preparedSigners, onSaved, onClose}: {
  file: File; documentId: string; documentType: string; title: string; preparedSigners: Signer[];
  onSaved: (id: string) => void; onClose: () => void;
}) {
  const [extracted, setExtracted] = useState<Awaited<ReturnType<typeof extractEquityUpload>> | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  useEffect(() => {
    let active = true;
    const url = URL.createObjectURL(file); setSourceUrl(url);
    extractEquityUpload(file).then(value => {if (active) setExtracted(value);}).catch(error => {if (active) setError(error.message || 'Unable to read this document.');});
    return () => {active = false; URL.revokeObjectURL(url);};
  }, [file]);
  const save = async () => {
    if (!extracted || saving) return;
    setSaving(true); setError('');
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sign in before uploading.');
      if (!preparedSigners.length) throw new Error('The saved signer names and email addresses are missing.');
      await runTransaction(db, async transaction => {
        const ref = doc(db, 'equity-documents', documentId);
        const snapshot = await transaction.get(ref);
        const previous = snapshot.data();
        if (isEquityDocumentLocked(previous)) throw new Error('This document has approval or signing records. Its saved version is locked.');
        if (previous && previous.documentType !== documentType) throw new Error('This file belongs to a different document type.');
        const now = Timestamp.now();
        const prepared = Object.values(capitalizationDocuments).find(item => item.id === documentId && item.documentType === documentType
          && item.content.trim().replace(/\s+/g, ' ') === extracted.text.trim().replace(/\s+/g, ' '));
        const planId = 'pulse-eip-amendment-2026-09-14-v2';
        const plan = prepared?.documentType === 'equity_reserve_approval' ? await transaction.get(doc(db, 'equity-documents', planId)) : null;
        if (plan && (!plan.exists() || !plan.data()?.content)) throw new Error('The saved Plan Amendment must be available before this approval can be uploaded.');
        const planHash = plan ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plan.data()!.content)))).map(value => value.toString(16).padStart(2, '0')).join('') : null;
        // The final supplied certificate replaces the preparation draft's charter placeholder.
        // Its remaining capitalization prerequisites continue to block certification.
        let closingRequirements = (previous?.closingRequirements || []).map((item: string) =>
          documentId === 'XmKR9EaPEkeQZcQbaw0A' && file.name === 'PIL_Capitalization_and_Share_Reservation_Certificate_EDNA_2.pdf'
            && extracted.text.includes('10434585') && extracted.text.includes('$0.00001')
            ? item.replace('Confirm authorized shares against charter, complete ', 'Complete ')
            : item);
        if (prepared?.documentType === 'strategic_capitalization_certificate') closingRequirements = closingRequirements.filter((item: string) => ![
          'Confirm authorized shares against charter, complete founder share return and reserve approvals, and certify outstanding shares and convertible-note treatment.',
          'Complete founder share return and reserve approvals, and certify outstanding shares and convertible-note treatment.',
        ].includes(item));
        const founderId = 'pil-founder-share-return-2026-09-23';
        const reserveId = 'pil-eip-reserve-approval-2026-09-23';
        const capitalizationMetadata = !prepared ? {} : {
          capitalizationRevision: 1,
          ...(documentType === 'founder_share_return' ? {founderReturn: {sharesBefore: 9000000, sharesReturned: 1000000, sharesAfter: 8000000, vestingStartDate: '2025-12-11', vestingMonths: 48, cliffMonths: 12}, prerequisiteDocumentIds: []} : {}),
          ...(documentType === 'equity_reserve_approval' ? {reserveApproval: {planDocumentId: planId, reserveShares: 1600000, founderReturnDocumentId: founderId, planContentHash: planHash}, prerequisiteDocumentIds: [founderId], exhibits: [planId]} : {}),
          ...(documentType === 'strategic_capitalization_certificate' ? {prerequisiteDocumentIds: [founderId, reserveId, 'pil-auntedna-20260909-05']} : {}),
        };
        const source = {fileName: file.name, mimeType: /\.pdf$/i.test(file.name) ? 'application/pdf' : file.type || 'text/plain', dataUrl: extracted.dataUrl, uploadedAt: now, uploadedBy: uid};
        const next = {
          ...(previous || {}), title: prepared?.title || previous?.title || title, content: extracted.content, documentType,
          status: 'completed', approvalStatus: 'pending', requiresSignature: true, autoSigned: false,
          preparedSigners: previous?.preparedSigners?.length ? previous.preparedSigners : preparedSigners,
          closingRequirements, signingRequestIds: [],
          equityDirection: 'outgoing', stakeholderName: previous?.stakeholderName || 'PIL and AuntEdna.ai (EDNA, Inc.)', sourceFileName: file.name,
          originalUpload: source, updatedAt: now, updatedBy: uid, createdAt: previous?.createdAt || now,
          ...capitalizationMetadata,
          contentHistory: [...(previous?.contentHistory || []), ...(previous ? [{title: previous.title || title, content: previous.content || '', closingRequirements: previous.closingRequirements || [], originalUpload: previous.originalUpload || null, replacedAt: now, replacedBy: uid}] : [])],
        };
        // An arbitrary replacement must not inherit instructions that would move shares.
        if (!prepared && previous?.capitalizationRevision) {
          for (const field of ['capitalizationRevision', 'founderReturn', 'reserveApproval', 'prerequisiteDocumentIds']) delete (next as any)[field];
          if (!closingRequirements.includes('Review the replacement document and its capitalization instructions before signing.')) closingRequirements.push('Review the replacement document and its capitalization instructions before signing.');
        }
        if (new TextEncoder().encode(JSON.stringify(next)).byteLength > 900000) throw new Error('This file and its document history exceed the upload limit. Use a smaller source file.');
        transaction.set(ref, next);
      });
      onSaved(documentId);
    } catch (error) {setError(error instanceof Error ? error.message : 'Unable to save the document.');}
    finally {setSaving(false);}
  };
  return <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="upload-equity-title">
    <div className="bg-zinc-950 border border-zinc-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto text-zinc-100">
      <div className="p-5 border-b border-zinc-800"><h2 id="upload-equity-title" className="font-semibold text-lg">Review uploaded document</h2><p className="text-sm text-zinc-400 mt-1">{file.name}</p></div>
      <div className="p-5 space-y-4">
        {!extracted && !error && <p role="status" className="text-sm text-zinc-400">Reading the document…</p>}
        {extracted && <><div className="flex items-center justify-between gap-4"><p className="text-sm text-zinc-400">Review the text that will be sent for signing.</p><a href={sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-200 shrink-0">Open original</a></div><pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white text-zinc-900 p-6 font-serif text-sm leading-relaxed">{extracted.text}</pre></>}
        {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      </div>
      <div className="p-5 border-t border-zinc-800 flex justify-end gap-3"><button onClick={onClose} disabled={saving} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm">Cancel</button><button onClick={save} disabled={!extracted || saving} className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save document'}</button></div>
    </div>
  </div>;
}
