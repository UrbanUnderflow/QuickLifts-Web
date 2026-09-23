import React, { useRef, useState } from 'react';
import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../api/firebase/config';
import { X, Loader2 } from 'lucide-react';

export function closingActionKind(requirement: string) {
  if (/signator|signing title|director/i.test(requirement)) return 'signers';
  if (/price|exercise cost/i.test(requirement)) return 'price';
  if (/capitalization|denominator/i.test(requirement)) return 'capitalization';
  if (/share count|security class/i.test(requirement)) return 'shares';
  return 'approvals';
}
export const closingActionLabels = { shares: 'Set share terms', price: 'Set exercise price', capitalization: 'Review capitalization', approvals: 'Link approval evidence', signers: 'Set signer details' };
const fields = {
  shares: ['PIL share count', 'PIL security class'],
  price: ['PIL exercise price per share', 'Currency'],
  capitalization: ['Fully diluted share total', 'Treatment of convertible notes', 'Treatment of this warrant in the denominator', 'Capitalization certificate URL'],
  approvals: ['Approval or confirmation URL', 'Approval date', 'Approving body or reviewer'],
  signers: ['Authorized signer names and titles', 'Signer email addresses', 'Authority evidence or confirmation'],
};
type ClosingDocument = { id: string; title: string; content: string; closingWorkItems?: Record<string, { requirement: string; values: Record<string, string>; evidenceDocumentId: string; notes: string }> };
export default function EquityClosingAction({ document, requirement, documents, onClose, onRevise, onCapTable, onOpenDocument }: {
  document: ClosingDocument; requirement: string; documents: Array<{id: string; title: string}>;
  onClose: () => void; onRevise: (instructions: string) => void; onCapTable: () => void; onOpenDocument: (id: string) => void;
}) {
  const kind = closingActionKind(requirement);
  const key = Array.from(requirement).map(c => c.charCodeAt(0).toString(16)).join('');
  const saved = document.closingWorkItems?.[key];
  const baseline = useRef(saved);
  const [values, setValues] = useState<Record<string, string>>(saved?.values || {});
  const [evidenceDocumentId, setEvidenceDocumentId] = useState(saved?.evidenceDocumentId || '');
  const [notes, setNotes] = useState(saved?.notes || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const save = async (revise = false) => {
    setBusy(true); setMessage('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in to save these details.');
      if (!Object.values(values).some(v => v.trim()) && !evidenceDocumentId && !notes.trim()) throw new Error('Enter details or link an evidence document first.');
      for (const [field, value] of Object.entries(values)) {
        if (value && /URL$/.test(field)) { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use an http or https evidence link.'); }
        if (value && ['PIL share count', 'Fully diluted share total'].includes(field) && (!Number.isSafeInteger(Number(value.replace(/,/g, ''))) || Number(value.replace(/,/g, '')) <= 0)) throw new Error(`${field} must be a positive whole number.`);
        if (value && field === 'PIL exercise price per share' && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error('Enter a nonnegative exercise price.');
      }
      const next = { requirement, values, evidenceDocumentId, notes, savedAt: Timestamp.now(), savedBy: user.uid };
      await runTransaction(db, async tx => {
        const ref = doc(db, 'equity-documents', document.id);
        const snapshot = await tx.get(ref);
        if (!snapshot.exists() || !snapshot.data().closingRequirements?.includes(requirement)) throw new Error('This closing item changed. Reopen the document.');
        if (snapshot.data().content !== document.content) throw new Error('The document changed. Reopen it before saving details.');
        const previous = snapshot.data().closingWorkItems?.[key];
        if (JSON.stringify(previous || null) !== JSON.stringify(baseline.current || null)) throw new Error('Another person updated this item. Reopen it for the latest details.');
        tx.update(ref, { [`closingWorkItems.${key}`]: next, closingWorkHistory: [...(snapshot.data().closingWorkHistory || []), { requirement, previous: previous || null, values, evidenceDocumentId, notes, savedAt: Timestamp.now(), savedBy: user.uid }] });
      });
      baseline.current = next;
      if (revise) onRevise(`Update only the relevant PIL issuance terms using these supplied details. Preserve unrelated wording. Do not sign, approve, or infer missing values. Identify any closing requirements actually satisfied by the revised text and any that still need supporting approval evidence.\nClosing item: ${requirement}\n${Object.entries(values).map(([k,v]) => `${k}: ${v}`).join('\n')}\nLinked evidence document: ${evidenceDocumentId || 'None'}\nNotes: ${notes}`);
      else setMessage('Details saved. The document and approval status have not been changed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save.'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={closingActionLabels[kind]}><div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 text-white shadow-2xl">
    <div className="flex justify-between gap-4"><div><p className="text-xs text-zinc-400">PIL grant preparation</p><h3 className="text-lg font-semibold mt-1">{closingActionLabels[kind]}</h3></div><button aria-label="Close closing item" disabled={busy} onClick={onClose}><X className="w-5 h-5" /></button></div>
    <p className="text-sm text-zinc-400 mt-3 mb-5">{requirement}</p>
    {kind === 'capitalization' && <button className="text-blue-300 underline text-sm mb-4" onClick={onCapTable}>Open current capitalization setup</button>}
    <div className="space-y-4">{fields[kind].map(field => <label key={field} className="block text-sm text-zinc-300">{field}<input className="block w-full mt-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white" value={values[field] || ''} onChange={e => setValues({...values, [field]: e.target.value})} /></label>)}
    <label className="block text-sm text-zinc-300">Link a document already in this system<select className="block w-full mt-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2" value={evidenceDocumentId} onChange={e => setEvidenceDocumentId(e.target.value)}><option value="">Select a document</option>{documents.filter(d => d.id !== document.id).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
    {evidenceDocumentId && <button className="text-blue-300 text-sm underline" onClick={() => onOpenDocument(evidenceDocumentId)}>Open linked document</button>}
    <label className="block text-sm text-zinc-300">Notes / external approval evidence<textarea className="block w-full mt-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2" rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label></div>
    <p className="text-xs text-zinc-400 mt-4">These details are saved with this closing item. Required signatures and approval evidence remain separate from data entry.</p>
    {message && <p role="status" className="text-sm text-amber-200 mt-3">{message}</p>}
    <div className="flex flex-wrap gap-3 mt-5"><button disabled={busy} onClick={() => save()} className="px-4 py-2 rounded-lg bg-zinc-100 text-black text-sm font-medium disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save details'}</button><button disabled={busy} onClick={() => save(true)} className="px-4 py-2 rounded-lg border border-zinc-700 text-sm disabled:opacity-50">Save and edit document</button></div>
  </div></div>;
}
