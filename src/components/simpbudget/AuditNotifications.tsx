import React, { useMemo, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { Bell, X } from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { simpBudgetDb } from '../../api/firebase/simpBudgetConfig';
import { categoryAudit, applyCategorySuggestion, type CategorySuggestion } from '../../lib/simpbudget/categoryAudit';
import type { StatementImport } from '../../lib/simpbudget/statements';

export default function AuditNotifications({ uid, imports, onOpenSource, recurring, recurringPeriod, onReviewRecurring }: { uid: string; imports: StatementImport[]; onOpenSource: (id: string) => void; recurring: {id:string;name:string;suggestions:number;reviews:number}[]; recurringPeriod:string; onReviewRecurring:(id:string)=>boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [limit, setLimit] = useState(30);
  const suggestions = useMemo(() => categoryAudit(imports), [imports]);
  const notificationCount = suggestions.length + recurring.reduce((sum, item) => sum + item.suggestions + item.reviews, 0);
  const act = async (suggestion: CategorySuggestion, action: 'accept'|'dismiss') => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const ref = doc(simpBudgetDb, 'simpbudget-users', uid, 'statementImports', suggestion.statementId);
      await runTransaction(simpBudgetDb, async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error('This statement is no longer available.');
        const current = snapshot.data() as StatementImport;
        if (current.status !== 'committed') throw new Error('This import is no longer committed.');
        const row = current.transactions.find(tx => tx.id === suggestion.transactionId);
        if (!row || !categoryAudit([current]).some(item => item.id === suggestion.id && item.signature === suggestion.signature)) throw new Error('This transaction changed. Reload before reviewing it.');
        const updated = applyCategorySuggestion(row, suggestion, action);
        transaction.update(ref, { transactions: current.transactions.map(tx => tx.id === row.id ? updated : tx), revision: (current.revision || 0) + 1 });
      });
      setMessage(action === 'accept' ? `Category changed to ${suggestion.proposed}. Amount and budget are unchanged.` : 'Suggestion dismissed. The category is unchanged.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save. Please try again.'); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" aria-label={`Notifications, ${notificationCount} suggestions and reviews`} aria-haspopup="dialog" onClick={() => setOpen(true)} className="relative flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium">
      <Bell className="h-4 w-4" aria-hidden="true" /> Notifications
      {notificationCount > 0 && <span className="rounded-full bg-sky-100 px-2 text-sky-900">{notificationCount}</span>}
    </button>
    <Dialog open={open} onClose={() => setOpen(false)} className="relative z-[85]">
      <div className="fixed inset-0 bg-stone-950/35" aria-hidden="true" />
      <div className="fixed inset-0 flex justify-end"><DialogPanel className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <div className="border-b p-5"><div className="flex items-center justify-between gap-3"><DialogTitle className="text-xl font-semibold">Notifications</DialogTitle><button aria-label="Close notifications" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
          <Description className="mt-2 text-sm text-stone-600">Category review across all imported dates and budgets. Suggestions use merchant descriptions; review the source before accepting. Nothing changes automatically.</Description>
          <p role="status" className="mt-2 text-sm text-sky-800">{message}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {recurring.length > 0 && <section className="mb-6"><h3 className="mb-3 font-semibold">Recurring review · {recurringPeriod}</h3><div className="space-y-3">{recurring.map(item => <article key={item.id} className="rounded-xl border border-sky-200 bg-sky-50 p-4"><h4 className="font-semibold">{item.name}</h4><p className="mt-1 text-sm">{item.suggestions} suggested recurring expenses · {item.reviews} existing items need review</p><button className="mt-3 rounded-lg border border-sky-300 px-3 py-2 text-sm" onClick={() => { if(onReviewRecurring(item.id)) setOpen(false); }}>Review month</button></article>)}</div></section>}
          <h3 className="mb-3 font-semibold">Category suggestions · {suggestions.length}</h3>
          {!suggestions.length && <p className="text-sm text-stone-600">No category suggestions from the current merchant checks. This does not mean every transaction has been audited.</p>}
          <div className="space-y-3">{suggestions.slice(0, limit).map(suggestion => <article key={suggestion.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h4 className="break-words text-sm font-semibold">{suggestion.description}</h4>
            <p className="mt-1 text-xs text-stone-600">{suggestion.date} · {suggestion.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · {suggestion.source}</p>
            <p className="mt-3 text-sm"><span className="text-stone-500">{suggestion.current}</span> → <strong>{suggestion.proposed}</strong></p>
            <p className="mt-2 text-sm text-stone-700">{suggestion.explanation}</p>
            <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void act(suggestion, 'accept')} className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-50">Accept category</button><button disabled={busy} onClick={() => void act(suggestion, 'dismiss')} className="rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50">Dismiss</button><button onClick={() => { setOpen(false); onOpenSource(suggestion.statementId); }} className="px-2 py-2 text-sm underline">View statement</button></div>
          </article>)}</div>
          {suggestions.length > limit && <button className="mt-4 rounded-lg border px-4 py-2 text-sm" onClick={() => setLimit(value => value + 30)}>Show more suggestions</button>}
        </div>
      </DialogPanel></div>
    </Dialog>
  </>;
}
