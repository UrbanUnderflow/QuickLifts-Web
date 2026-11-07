import React, { useMemo, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { Bell, X } from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { simpBudgetDb } from '../../api/firebase/simpBudgetConfig';
import { categoryAudit, applyCategoryAuditBatch, type CategorySuggestion } from '../../lib/simpbudget/categoryAudit';
import type { StatementImport } from '../../lib/simpbudget/statements';

export default function AuditNotifications({ uid, imports, onOpenSource, recurring, recurringPeriod, onReviewRecurring }: { uid: string; imports: StatementImport[]; onOpenSource: (id: string) => void; recurring: {id:string;name:string;suggestions:number;reviews:number}[]; recurringPeriod:string; onReviewRecurring:(id:string)=>boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef=useRef(false);
  const [message, setMessage] = useState('');
  const [limit, setLimit] = useState(30);
  const suggestions = useMemo(() => categoryAudit(imports), [imports]);
  const notificationCount = suggestions.length + recurring.reduce((sum, item) => sum + item.suggestions + item.reviews, 0);
  const visibleSuggestions=suggestions.slice(0,limit);
  const act = async (requested: CategorySuggestion[], action: 'accept'|'dismiss') => {
    if (busyRef.current || !requested.length) return;
    busyRef.current=true; setBusy(true); setMessage('');
    try {
      const ids=[...new Set(requested.map(suggestion=>suggestion.statementId))];
      if(ids.length>400) throw new Error('This selection spans too many statements. Use Accept visible in smaller groups.');
      const refs=ids.map(id=>doc(simpBudgetDb,'simpbudget-users',uid,'statementImports',id));
      await runTransaction(simpBudgetDb, async transaction => {
        // Read every statement before any write; Firestore retries against fresh revisions.
        const snapshots=await Promise.all(refs.map(ref=>transaction.get(ref)));
        if(snapshots.some(snapshot=>!snapshot.exists())) throw new Error('A statement is no longer available. Nothing was changed.');
        const updated=applyCategoryAuditBatch(snapshots.map(snapshot=>snapshot.data() as StatementImport),requested,action);
        updated.forEach(item=>transaction.update(refs[ids.indexOf(item.id)],{transactions:item.transactions,revision:item.revision}));
      });
      setMessage(action==='accept'?`${requested.length} categor${requested.length===1?'y':'ies'} updated. Amounts, budgets and notes are unchanged.`:'Suggestion dismissed. The category is unchanged.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save. Please try again.'); }
    finally { busyRef.current=false; setBusy(false); }
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
          {recurring.length > 0 && <section className="mb-6"><h3 className="mb-3 font-semibold">Recurring review · {recurringPeriod}</h3><div className="space-y-3">{recurring.map(item => <article key={item.id} className="rounded-xl border border-sky-200 bg-sky-50 p-4"><h4 className="font-semibold">{item.name}</h4><p className="mt-1 text-sm">{item.suggestions} suggested recurring expenses · {item.reviews} existing {item.reviews===1?'item needs':'items need'} review</p><button className="mt-3 rounded-lg border border-sky-300 px-3 py-2 text-sm" onClick={() => { if(onReviewRecurring(item.id)) setOpen(false); }}>Review month</button></article>)}</div></section>}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Category suggestions · {suggestions.length}</h3><div className="flex flex-wrap gap-2"><button disabled={busy||!suggestions.length} onClick={()=>void act(suggestions,'accept')} className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-50">Accept all ({suggestions.length})</button><button disabled={busy||!visibleSuggestions.length} onClick={()=>void act(visibleSuggestions,'accept')} className="rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50">Accept visible ({visibleSuggestions.length})</button></div></div><p className="mb-3 text-xs text-stone-500">All includes every category suggestion across dates and budgets. Visible means the {visibleSuggestions.length} suggestions currently loaded below, including any added with Show more.</p>
          {!suggestions.length && <p className="text-sm text-stone-600">No category suggestions from the current merchant checks. This does not mean every transaction has been audited.</p>}
          <div className="space-y-3">{visibleSuggestions.map(suggestion => <article key={suggestion.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h4 className="break-words text-sm font-semibold">{suggestion.description}</h4>
            <p className="mt-1 text-xs text-stone-600">{suggestion.date} · {suggestion.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · {suggestion.source}</p>
            <p className="mt-3 text-sm"><span className="text-stone-500">{suggestion.current}</span> → <strong>{suggestion.proposed}</strong></p>
            <p className="mt-2 text-sm text-stone-700">{suggestion.explanation}</p>
            <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void act([suggestion], 'accept')} className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-50">Accept category</button><button disabled={busy} onClick={() => void act([suggestion], 'dismiss')} className="rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50">Dismiss</button><button onClick={() => { setOpen(false); onOpenSource(suggestion.statementId); }} className="px-2 py-2 text-sm underline">View statement</button></div>
          </article>)}</div>
          {suggestions.length > limit && <button disabled={busy} className="mt-4 rounded-lg border px-4 py-2 text-sm disabled:opacity-50" onClick={() => setLimit(value => value + 30)}>Show more suggestions</button>}
        </div>
      </DialogPanel></div>
    </Dialog>
  </>;
}
