import React, { useMemo, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { Bell, X } from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { simpBudgetDb } from '../../api/firebase/simpBudgetConfig';
import { categoryAudit, applyCategoryAuditBatch, type CategorySuggestion } from '../../lib/simpbudget/categoryAudit';
import {notificationSummary,type RecurringNotification,type ExtraNotificationAction} from '../../lib/simpbudget/notificationSummary';
import type { StatementImport } from '../../lib/simpbudget/statements';

export default function AuditNotifications({ uid, imports, onOpenSource, recurring, onReviewRecurring,extraActions=[] }: { uid: string; imports: StatementImport[]; onOpenSource: (id: string) => void; recurring:RecurringNotification[]; onReviewRecurring:(id:string,year:number,month:number)=>boolean;extraActions?:ExtraNotificationAction[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef=useRef(false);
  const [message, setMessage] = useState('');
  const [limit, setLimit] = useState(30);
  const [recurringLimit,setRecurringLimit]=useState(12);
  const [actionLimit,setActionLimit]=useState(12);
  const suggestions = useMemo(() => categoryAudit(imports), [imports]);
  const summary=notificationSummary(suggestions.length,recurring,extraActions);
  const notificationCount=summary.total;
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
    <button type="button" aria-label={`Notifications, ${notificationCount} actions need attention`} aria-haspopup="dialog" onClick={() => setOpen(true)} className="relative flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium">
      <Bell className="h-4 w-4" aria-hidden="true" /> Notifications
      {notificationCount > 0 && <span className="rounded-full bg-sky-100 px-2 text-sky-900">{notificationCount}</span>}
    </button>
    <Dialog open={open} onClose={() => setOpen(false)} className="relative z-[85]">
      <div className="fixed inset-0 bg-stone-950/35" aria-hidden="true" />
      <div className="fixed inset-0 flex justify-end"><DialogPanel className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <div className="border-b p-5"><div className="flex items-center justify-between gap-3"><DialogTitle className="text-xl font-semibold">{notificationCount} {notificationCount===1?'action needs':'actions need'} attention</DialogTitle><button aria-label="Close notifications" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
          <Description className="mt-2 text-sm text-stone-600">Pending reviews, import actions and save issues across all budgets and available months. Review each suggestion before accepting; nothing changes automatically.</Description>
          <p role="status" className="mt-2 text-sm text-sky-800">{message}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {notificationCount===0&&<p className="mb-5 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">No pending actions from the current checks. This does not certify that every transaction or statement is complete.</p>}
          {summary.extraItems.length>0&&<section className="mb-6" aria-label="Imports and save issues"><h3 className="mb-3 font-semibold">Imports & system actions · {summary.extraCount}</h3><div className="space-y-3">{summary.extraItems.slice(0,actionLimit).map(item=><article key={item.id} className="rounded-xl border border-rose-200 bg-rose-50/50 p-4"><h4 className="font-semibold">{item.title} <span className="text-sm font-normal">({item.count})</span></h4><p className="mt-1 text-sm text-stone-700">{item.description}</p><button className="mt-3 rounded-lg border border-rose-300 px-3 py-2 text-sm" onClick={()=>{setOpen(false);item.onAction();}}>{item.label}</button></article>)}</div>{summary.extraItems.length>actionLimit&&<button className="mt-3 rounded-lg border px-3 py-2 text-sm" onClick={()=>setActionLimit(value=>value+12)}>Show more system actions ({summary.extraItems.length-actionLimit})</button>}</section>}
          {summary.recurringItems.length>0&&<section className="mb-6" aria-label="Recurring reviews"><h3 className="mb-3 font-semibold">Recurring suggestions & reviews · {summary.recurringCount}</h3><p className="mb-3 text-xs text-stone-500">Across {summary.recurringItems.length} budget-month {summary.recurringItems.length===1?'view':'views'}. The same bill can need a separate review in each month.</p><div className="space-y-3">{summary.recurringItems.slice(0,recurringLimit).map(item=><article key={`${item.id}:${item.year}:${item.month}`} className="rounded-xl border border-sky-200 bg-sky-50 p-4"><h4 className="font-semibold">{item.name} · {new Date(Date.UTC(item.year,item.month-1,1)).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})}</h4><p className="mt-1 text-sm">{item.suggestions} suggested recurring expenses · {item.reviews} existing {item.reviews===1?'item needs':'items need'} review</p><button className="mt-3 rounded-lg border border-sky-300 px-3 py-2 text-sm" onClick={()=>{if(onReviewRecurring(item.id,item.year,item.month))setOpen(false);}}>Review {item.name} · {item.year}-{String(item.month).padStart(2,'0')}</button></article>)}</div>{summary.recurringItems.length>recurringLimit&&<button className="mt-3 rounded-lg border px-3 py-2 text-sm" onClick={()=>setRecurringLimit(value=>value+12)}>Show more recurring months ({summary.recurringItems.length-recurringLimit})</button>}</section>}
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
