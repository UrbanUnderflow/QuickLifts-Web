import React from 'react';
import {Mail, Send} from 'lucide-react';

export default function EquityEmailSendConfirmation({documents, recipients, busy, error, onConfirm, onCancel, onCheckDelivery, warning, confirmLabel}: {
  documents: string[]; recipients: Array<{recipientName?: string; recipientEmail: string}>;
  busy: boolean; error?: string; onConfirm: () => void; onCancel: () => void; onCheckDelivery?: () => void; warning?: string; confirmLabel?: string;
}) {
  return <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-equity-send-title">
    <div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
      <h2 id="confirm-equity-send-title" className="text-lg font-semibold flex gap-2 items-center"><Mail className="w-5 h-5 text-blue-300" />Confirm signature email</h2>
      <p className="mt-2 text-sm text-zinc-400">Review the documents and destination before sending.</p>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Documents</p>
      <ul className="mt-2 space-y-2 text-sm">{documents.map((title, index) => <li key={`${index}-${title}`}>{title}</li>)}</ul>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Send to</p>
      <div className="mt-2 space-y-2">{recipients.map((recipient, index) => <div key={`${index}-${recipient.recipientEmail}`} className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3"><p className="text-sm font-medium">{recipient.recipientName || 'Signer'}</p><p className="mt-1 break-all text-sm text-blue-200">{recipient.recipientEmail}</p></div>)}</div>
      {warning && <p className="mt-4 rounded-lg border border-amber-600/40 bg-amber-950/30 p-3 text-sm text-amber-200">{warning}</p>}
      {error && <div className="mt-4"><p role="alert" className="text-sm text-red-200">{error}</p>{onCheckDelivery && <button type="button" disabled={busy} onClick={onCheckDelivery} className="mt-2 text-sm text-blue-200 underline">Check delivery status</button>}</div>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm disabled:opacity-50">Cancel</button><button type="button" autoFocus disabled={busy || !recipients.length || recipients.some(recipient => !recipient.recipientEmail)} onClick={onConfirm} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-50"><Send className="h-4 w-4" />{busy ? 'Sending…' : confirmLabel || 'Confirm send'}</button></div>
    </div>
  </div>;
}
