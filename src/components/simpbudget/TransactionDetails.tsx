import { receiptLabels, type ReceiptType } from '../../lib/simpbudget/cashFlow';
import React from 'react';
import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';

export type TransactionDetail = {
  date: string; description: string; amount: number; allocatedAmount?: number;
  receiptType?:ReceiptType; category?: string; kind?: string; budget?: string; account?: string;
  sourceType: 'document'|'csv'|'self_reported'; sourceFileName?: string; sourceRow?: string|number;
  statementId?: string; notes?: string; splits?: {name:string;amount:number}[];
};
const money=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function TransactionDetails({detail,onClose,onOpenSource}:{detail:TransactionDetail|null;onClose:()=>void;onOpenSource:(id:string)=>void}) {
  return <Dialog open={!!detail} onClose={onClose} className="relative z-[80]">
    <div className="fixed inset-0 bg-stone-950/45 backdrop-blur-sm" aria-hidden="true"/>
    <div className="fixed inset-0 flex items-center justify-center p-4"><DialogPanel className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><DialogTitle className="text-xl font-semibold">Transaction details</DialogTitle><Description className="mt-1 text-sm text-stone-500">{detail?.description}</Description></div><button aria-label="Close transaction details" onClick={onClose} className="px-2 text-2xl">×</button></div>
      {detail&&<><dl className="my-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">{[
        ['Date',detail.date||'Not entered'],['Amount',money(detail.amount)],['Category',detail.category||'Not specified'],['Budget',detail.budget||'Not assigned'],
        ...(detail.allocatedAmount!==undefined&&detail.allocatedAmount!==detail.amount?[['This budget’s share',money(detail.allocatedAmount)]]:[]),
        ['Source',detail.sourceType==='self_reported'?'Self-reported':detail.sourceType==='document'?'Extracted from a document':'Imported from CSV'],
        ['Card / payment',detail.account||'Not specified'],
        ...(detail.sourceFileName?[['Source document',detail.sourceFileName]]:[]),
        ...(detail.sourceRow?[['Source location',String(detail.sourceRow)]]:[]),
        ...(detail.kind?[['Transaction type',detail.kind.replace(/_/g,' ')]]:[]),
        ...(detail.receiptType?[['Money received',receiptLabels[detail.receiptType]]]:[]),
        ...(detail.notes?[['Notes',detail.notes]]:[]),
      ].map(([label,value])=><React.Fragment key={label}><dt className="text-stone-500">{label}</dt><dd className="break-words font-medium">{value}</dd></React.Fragment>)}</dl>
      {!!detail.splits?.length&&<div className="mb-5 rounded-lg bg-stone-50 p-3 text-sm"><p className="mb-2 font-semibold">Budget split</p>{detail.splits.map((s,i)=><p key={i}>{s.name}: {money(s.amount)}</p>)}</div>}
      {detail.statementId?<button className="rounded-lg bg-stone-900 px-4 py-3 text-sm font-semibold text-white" onClick={()=>onOpenSource(detail.statementId!)}>View source document</button>:<p className="text-sm text-stone-500">Manually entered. No source document is attached.</p>}</>}
    </DialogPanel></div>
  </Dialog>;
}
