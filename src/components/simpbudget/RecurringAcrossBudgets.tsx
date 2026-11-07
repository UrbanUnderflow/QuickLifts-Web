import React from 'react';
import type {RecurringOverviewRow} from '../../lib/simpbudget/recurringOverview';
import layout from './BudgetLayout.module.css';
const money=(amount:number)=>amount.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function RecurringAcrossBudgets({rows,period,onReview}:{rows:RecurringOverviewRow[];period:string;onReview:(id:string,year:number,month:number)=>void}){
 const accepted=rows.filter(row=>row.kind!=='suggestion');
 const total=accepted.reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100;
 return <section aria-label="Recurring expenses across all budgets" className="min-w-0 rounded-lg border border-stone-200 bg-white">
  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 p-5"><div><h2 className="font-semibold">Recurring expenses across all budgets</h2><p className="mt-1 text-sm text-stone-600">{period} · {accepted.length} accepted · {rows.length-accepted.length} suggestions</p></div><div className="text-right"><p className="text-xs text-stone-500">Accepted monthly total</p><p className="text-xl font-semibold tabular-nums">{money(total)}</p></div></div>
  <div className="overflow-x-auto p-4"><table className={`${layout.transactions} w-full text-sm`}><thead><tr className="text-left text-xs uppercase text-stone-500"><th className="p-3">Expense</th><th className="p-3">Budget</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>
   {rows.map(item=><tr key={`${item.budgetId}:${item.kind}:${item.row.id}`} className={`border-t border-stone-200 ${item.kind==='suggestion'?'bg-amber-50/70':''}`}><td data-label="Expense" className="p-3 font-medium">{item.row.label}</td><td data-label="Budget" className="p-3">{item.name}</td><td data-label="Amount" className="p-3 tabular-nums">{money(item.amount)}<span className="block text-xs text-stone-500">{item.kind==='suggestion'?'Proposed':item.kind==='accepted'?'Month actual':'Accepted plan'}</span></td><td data-label="Status" className="p-3"><span className={item.kind==='suggestion'||(item.kind!=='accepted'&&item.status!=='Matched')?'text-amber-900':'text-emerald-800'}>{item.kind==='suggestion'?'Suggested recurring':item.kind==='accepted'&&item.status==='Matched'?'Accepted across months':item.status}</span>{item.kind==='explicit'&&item.validation&&item.validation.matches.length>0&&item.status!=='Matched'&&<span className="block text-xs text-stone-600">Matched charges: {money(item.validation.amount)}</span>}</td><td data-label="Action" className="p-3"><button className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50" onClick={()=>onReview(item.budgetId,item.year,item.month)}>Review {item.name}</button></td></tr>)}
   {!rows.length&&<tr><td colSpan={5} className="p-6 text-center text-stone-500">No accepted recurring expenses or suggestions for {period}.</td></tr>}
  </tbody></table></div>
  <p className="px-5 pb-4 text-xs text-stone-500">Suggestions stay outside the accepted total. Review a budget to accept suggestions or update an amount. Monthly plans are separate from recorded spending.</p>
 </section>;
}
