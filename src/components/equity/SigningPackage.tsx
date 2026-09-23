import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { Check, FileText, ArrowRight, RefreshCw } from 'lucide-react';
import { db } from '../../api/firebase/config';

export interface PackageDocument {
  id: string;
  title: string;
  documentType: string;
  mode: 'sign' | 'reference';
  requestId?: string;
  content: string;
  signatureEvidence?: {
    id: string;
    recipientName: string;
    signerRole?: string;
    signedAt?: unknown;
    signatureData?: { typedName?: string; timestamp?: unknown; verificationMethod?: string };
  }[];
}

interface Props {
  request: { id: string; documentName: string; recipientName: string; recipientEmail: string; packageDocuments?: PackageDocument[] };
}
type Progress = { state: 'pending' | 'signed' | 'unavailable'; message?: string };
const milliseconds = (value: any) => value?.toMillis ? value.toMillis() : value?.seconds ? value.seconds * 1000 : new Date(value).getTime();
const signatureDate = (value: unknown) => {
  const timestamp = milliseconds(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
};

export const packageSigningKey = (item: PackageDocument, index: number) => item.requestId || `missing-request:${index}`;

export const hasVerifiedPackageSignature = (child: Record<string, any>, recipientEmail: string): boolean => {
  const signature = child.signatureData;
  const signedAt = milliseconds(child.signedAt);
  const signatureAt = milliseconds(signature?.timestamp);
  return child.status === 'signed'
    && typeof signature?.typedName === 'string' && Boolean(signature.typedName.trim())
    && signature.verificationMethod === 'firebase-auth'
    && typeof signature.verifiedEmail === 'string'
    && signature.verifiedEmail.trim().toLowerCase() === recipientEmail.trim().toLowerCase()
    && typeof signature.verifiedUid === 'string' && Boolean(signature.verifiedUid.trim())
    && Number.isFinite(signedAt) && signedAt > 0 && signedAt <= Date.now() + 60000
    && Number.isFinite(signatureAt) && signatureAt > 0 && signatureAt <= Date.now() + 60000;
};

export default function SigningPackage({ request }: Props) {
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [refreshing, setRefreshing] = useState(true);
  const documents = request.packageDocuments || [];
  const refresh = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.all(documents.filter(item => item.mode === 'sign').map(async (item, index) => {
      const key = packageSigningKey(item, index);
      try {
        if (!item.requestId) throw new Error('No signing request');
        const snapshot = await getDoc(doc(db, 'signingRequests', item.requestId));
        const child = snapshot.data();
        if (!child || child.packageId !== request.id || child.equityDocumentId !== item.id || child.documentContent !== item.content || child.invalidatedAt || child.previewMode || child.recipientEmail?.toLowerCase() !== request.recipientEmail.toLowerCase()) {
          return [key, { state: 'unavailable', message: 'This document was replaced or is unavailable. Contact the sender.' }] as const;
        }
        if (hasVerifiedPackageSignature(child, request.recipientEmail)) return [key, { state: 'signed' }] as const;
        if (child.expiresAt && (!Number.isFinite(milliseconds(child.expiresAt)) || milliseconds(child.expiresAt) <= Date.now())) return [key, { state: 'unavailable', message: 'This signing request has expired. Contact the sender for a new link.' }] as const;
        if (!['pending', 'sent', 'delivered', 'opened', 'viewed'].includes(child.status)) return [key, { state: 'unavailable', message: 'This document is not available for signing. Contact the sender.' }] as const;
        return [key, { state: 'pending' }] as const;
      } catch {
        return [key, { state: 'unavailable', message: 'Unable to check this document. Refresh or contact the sender.' }] as const;
      }
    }));
    setProgress(Object.fromEntries(results));
    setRefreshing(false);
  }, [request.id, request.recipientEmail, request.packageDocuments]);
  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
  const required = documents.filter(item => item.mode === 'sign');
  const references = documents.filter(item => item.mode === 'reference');
  const signedCount = required.filter((item, index) => progress[packageSigningKey(item, index)]?.state === 'signed').length;
  return <div className="min-h-screen bg-[#0d1117] text-white">
    <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-5"><div className="mx-auto flex max-w-4xl items-center gap-3"><img src="/PulseLogo.png" alt="Pulse" className="h-8" /><span className="text-zinc-400">Document package</span></div></header>
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <div><p className="mb-2 text-sm text-zinc-400">Prepared for {request.recipientName}</p><h1 className="text-3xl font-semibold">{request.documentName}</h1><p className="mt-3 text-zinc-400">Review and sign each agreement. Supporting documents are available below for reference.</p></div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5" aria-live="polite">
        <div><p className="font-semibold">{refreshing ? 'Checking signatures…' : `${signedCount} of ${required.length} required signatures complete`}</p>{!refreshing && required.length > 0 && signedCount === required.length && <p className="mt-1 text-sm text-green-300">Your signatures are complete. The sender will coordinate remaining signatures and closing.</p>}</div>
        <button onClick={() => void refresh()} disabled={refreshing} className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={16} />Refresh status</button>
      </div>
      <section aria-labelledby="required-documents"><h2 id="required-documents" className="mb-4 text-xl font-semibold">Your signatures</h2><div className="space-y-3">{required.map((item, index) => {
        const key = packageSigningKey(item, index);
        const state = progress[key];
        return <article key={key} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">{state?.state === 'signed' ? <Check size={18} className="text-green-300" /> : index + 1}</span><div><h3 className="font-medium">{item.title}</h3><p className="mt-1 text-sm text-zinc-400">{!state ? 'Checking status…' : state.state === 'signed' ? 'Signed by you' : state.state === 'pending' ? 'Your signature is needed' : state.message}</p></div></div>{state && state.state !== 'unavailable' && item.requestId && <Link href={`/sign/${encodeURIComponent(item.requestId)}`} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">{state.state === 'signed' ? 'View signed document' : 'Review and sign'}<ArrowRight size={16} /></Link>}</div></article>;
      })}</div>{required.length === 0 && <p className="text-zinc-400">No signature documents are available. Contact the sender.</p>}</section>
      {references.length > 0 && <section aria-labelledby="reference-documents"><h2 id="reference-documents" className="text-xl font-semibold">Reference documents</h2><p className="mb-4 mt-2 text-sm text-zinc-400">These documents support your agreements. No signature is requested from you.</p><div className="space-y-3">{references.map(item => <details key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"><summary className="cursor-pointer font-medium"><FileText className="mr-2 inline-block text-blue-300" size={19} />{item.title}<span className="ml-3 text-sm font-normal text-zinc-400">Read document</span></summary><div className="mt-5 max-h-[65vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-white p-6 text-sm leading-7 text-zinc-900">{item.content}</div>{Boolean(item.signatureEvidence?.length) && <div className="mt-4 rounded-xl border border-green-900 bg-green-950/20 p-4"><p className="text-sm font-semibold text-green-300">Recorded signatures</p><ul className="mt-2 space-y-2">{item.signatureEvidence?.map(evidence => <li key={evidence.id} className="text-sm text-zinc-300">{evidence.signatureData?.typedName || evidence.recipientName}{evidence.signerRole ? ` · ${evidence.signerRole}` : ''}{signatureDate(evidence.signedAt) ? ` · ${signatureDate(evidence.signedAt)}` : ''}</li>)}</ul></div>}</details>)}</div></section>}
    </main>
  </div>;
}
