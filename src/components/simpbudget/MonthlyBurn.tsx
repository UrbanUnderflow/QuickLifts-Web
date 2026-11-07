import { monthlyBurn, type MonthlyBurnInput } from '../../lib/simpbudget/monthlyBurn';
const money=(value:number)=>value.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function MonthlyBurn(props:MonthlyBurnInput&{planLabel:string}){
  const result=monthlyBurn(props);
  return <section aria-label="Monthly burn" className="rounded-2xl border border-stone-200 bg-white p-5">
    <h2 className="font-semibold text-stone-900">Monthly burn</h2>
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <div><p className="text-sm text-stone-500">Planned monthly burn</p><p className="mt-1 text-2xl font-semibold">{money(result.planned)}</p><p className="mt-1 text-xs text-stone-500">{props.planLabel} · Accepted recurring expenses only. Suggestions excluded.</p></div>
      <div><p className="text-sm text-stone-500">Average monthly spending</p><p className="mt-1 text-2xl font-semibold">{result.average===null?'Not enough data':money(result.average)}</p><p className="mt-1 text-xs text-stone-500">{result.months.length?`${money(result.total)} ÷ ${result.months.length} completed calendar month${result.months.length===1?'':'s'} with recorded activity.`:'No full calendar months with eligible recorded spending in this window.'}</p></div>
    </div>
    <p className="mt-3 text-xs text-stone-500">{props.view==='month'?'Trailing 12-month window':'Selected date window'}: {result.start}–{result.end}. Actuals include imported purchases minus refunds. Current and partial calendar months are excluded; months without records are not counted as zero. Statement coverage may still be incomplete. Manual budget entries, transfers and card repayments are excluded. Plans are not added to actual spending.</p>
    {result.months.length>0&&<details className="mt-3 text-sm"><summary className="cursor-pointer text-stone-600 underline">View months in average</summary><ul className="mt-2 grid gap-2 sm:grid-cols-3">{result.months.map(row=><li key={row.month} className="flex justify-between gap-4 rounded-lg bg-stone-50 p-3"><span>{row.month}</span><strong>{money(row.amount)}</strong></li>)}</ul></details>}
  </section>;
}
