import { bankCashFlow } from './cashFlow';
import { validateTransaction, type Account, type StatementImport, type StatementTransaction } from './statements';

export type InsightSpace = { id:string; name:string };
export type InsightRange = { start:string; end:string; label?:string };
export type InsightGroup = { label:string; amount:number; count:number; months:number; statementId:string };
export type InsightEvidence = StatementTransaction & { statementId:string; budgetNames:string[] };
const money=(value:number)=>value.toLocaleString('en-US',{style:'currency',currency:'USD'});
const cents=(value:number)=>Math.round(value*100);
/** Recognize a few branded statement variations without conflating unrelated merchants. */
export function insightMerchant(description:string) {
  if(/\buber[\s*.-]*eats\b|\bubereats\b/i.test(description))return 'Uber Eats';
  if(/\buber\s*(?:trip|\*trip)\b/i.test(description))return 'Uber rides';
  if(/\btesla\b.*\bsupercharger\b/i.test(description))return 'Tesla Supercharger';
  return description.replace(/^AplPay\s+/i,'').replace(/\s+/g,' ').trim().slice(0,100);
}
export function buildSpendingInsights(imports:StatementImport[],accounts:Account[],spaces:InsightSpace[],range:InsightRange) {
  const names=new Map(spaces.map(space=>[space.id,space.name]));
  const rows:InsightEvidence[]=[];
  let omitted=0;
  for(const item of imports){
    if(item.status!=='committed')continue;
    for(const tx of item.transactions){
      if(tx.date<range.start||tx.date>range.end||!['expense','refund'].includes(tx.kind))continue;
      if(tx.excluded||tx.duplicate||!tx.reviewed||validateTransaction(tx)){omitted++;continue;}
      rows.push({...tx,statementId:item.id,budgetNames:[...new Set((tx.splits.length?tx.splits:[{spaceId:tx.spaceId,amount:tx.amount}]).map(split=>names.get(split.spaceId)||'Unrecognized budget'))]});
    }
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const groups=(key:(row:InsightEvidence)=>string):InsightGroup[]=>{
    const map=new Map<string,{amount:number;count:number;months:Set<string>;statementId:string}>();
    for(const row of rows){const label=key(row);const entry=map.get(label)||{amount:0,count:0,months:new Set<string>(),statementId:row.statementId};entry.amount+=cents(row.amount);entry.count++;entry.months.add(row.date.slice(0,7));map.set(label,entry);}
    return [...map].map(([label,value])=>({label,amount:value.amount/100,count:value.count,months:value.months.size,statementId:value.statementId})).sort((a,b)=>b.amount-a.amount||a.label.localeCompare(b.label));
  };
  const budgetMap=new Map<string,InsightGroup>();
  for(const row of rows)for(const split of row.splits.length?row.splits:[{spaceId:row.spaceId,amount:row.amount}]){
    const label=names.get(split.spaceId)||'Unrecognized budget';const current=budgetMap.get(split.spaceId)||{label,amount:0,count:0,months:0,statementId:row.statementId};current.amount=(cents(current.amount)+cents(split.amount))/100;current.count++;budgetMap.set(split.spaceId,current);
  }
  const budgets=[...budgetMap.values()].sort((a,b)=>b.amount-a.amount);
  const categories=groups(row=>row.category?.trim()||'Uncategorized');
  const merchants=groups(row=>insightMerchant(row.description));
  const months=groups(row=>row.date.slice(0,7)).sort((a,b)=>a.label.localeCompare(b.label));
  const gross=rows.reduce((sum,row)=>sum+(row.amount>0?cents(row.amount):0),0)/100;
  const credits=-rows.reduce((sum,row)=>sum+(row.amount<0?cents(row.amount):0),0)/100;
  const net=(cents(gross)-cents(credits))/100;
  const cash=bankCashFlow(imports,accounts,range,'all');
  const repeats=merchants.filter(group=>group.months>=3&&group.amount>0).slice(0,8);
  const largest=[...rows].filter(row=>row.amount>0).sort((a,b)=>b.amount-a.amount).slice(0,6);
  const narrative:string[]=[];
  if(rows.length){
    narrative.push(`Across all budgets, the imported records show ${money(net)} in spending after ${money(credits)} in refunds and credits, from ${rows.length} transactions in this period.`);
    if(budgets[0])narrative.push(`${budgets[0].label} has the largest recorded spending allocation at ${money(budgets[0].amount)}${net>0&&budgets[0].amount>=0?` (${Math.round(budgets[0].amount/net*100)}% of net spending)`:''}. These allocations describe where you chose to place expenses, not whether they qualify for a tax deduction.`);
    if(categories[0])narrative.push(`The largest recorded category is ${categories[0].label} at ${money(categories[0].amount)}. ${categories[0].label.toLowerCase()==='other'||categories[0].label==='Uncategorized'?'Refining these categories would make the story more informative.':'This is an observed concentration of spending, not a judgment about its value.'}`);
  }
  const reflections:string[]=[];
  if(repeats.length)reflections.push(`${repeats[0].label} appears in ${repeats[0].months} different months. That could reflect a recurring commitment or repeated purchases; the statements alone do not establish a subscription.`);
  if(largest[0]&&gross>0)reflections.push(`Your largest purchase is ${money(largest[0].amount)} (${Math.round(largest[0].amount/gross*100)}% of gross purchases). A large one-time purchase can make this period look unlike your usual routine.`);
  if(cash.other>0)reflections.push(`${money(cash.other)} of bank money received is classified as other receipts, compared with ${money(cash.earned)} of earned receipts. Available cash and earned income tell different stories; neither total alone establishes profit or taxable income.`);
  return {rows,budgets,categories,merchants,months,repeats,largest,gross,credits,net,cash,narrative,reflections,omitted,
    coverage:{firstDate:rows[0]?.date||'',lastDate:rows.at(-1)?.date||'',monthsWithActivity:months.length,statementCount:new Set(rows.map(row=>row.statementId)).size,accountCount:new Set(rows.map(row=>row.sourceAccountId||imports.find(item=>item.id===row.statementId)?.accountId)).size}};
}
export type SpendingInsightsResult=ReturnType<typeof buildSpendingInsights>;

export type InsightFact={id:string;kind:'total'|'budget'|'category'|'merchant'|'month'|'coverage';label:string;amount:number;count:number;months:number};
/** Restrict provider input to summarized facts, never ledger rows or notes. */
export function sanitizeInsightLabel(value:string) {
  if(/\b(?:zelle|cash app|apple cash|payroll|withdrawal)\b/i.test(value))return 'Recorded payments';
  return value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'').replace(/https?:\/\/\S+/g,'').replace(/\b(?:web id|ppd id|ccd id|account|card|transaction#).*$/i,'').replace(/\d.*$/,'').replace(/[^A-Za-z &'()./-]/g,' ').replace(/\s+/g,' ').trim().split(' ').slice(0,8).join(' ').slice(0,80)||'Merchant';
}
export function insightFacts(result:SpendingInsightsResult):InsightFact[] {
  const facts:Omit<InsightFact,'id'>[]=[
    {kind:'total',label:'Spending after refunds and credits',amount:result.net,count:result.rows.length,months:result.months.length},
    {kind:'total',label:'Gross purchases',amount:result.gross,count:result.rows.filter(row=>row.amount>0).length,months:result.months.length},
    {kind:'total',label:'Refunds and credits',amount:result.credits,count:result.rows.filter(row=>row.amount<0).length,months:result.months.length},
    {kind:'total',label:'Earned bank receipts',amount:result.cash.earned,count:result.cash.earnedRows.length,months:0},
    {kind:'total',label:'Other bank receipts, including financing and withdrawals',amount:result.cash.other,count:result.cash.otherRows.length,months:0},
    ...result.budgets.slice(0,20).map(group=>({...group,kind:'budget' as const})),
    ...result.categories.slice(0,10).map(group=>({...group,kind:'category' as const})),
    ...result.merchants.slice(0,12).map(group=>({...group,kind:'merchant' as const})),
    ...result.months.slice(-24).map(group=>({...group,kind:'month' as const})),
  ];
  return facts.map((fact,index)=>({id:`f${index+1}`,kind:fact.kind,label:fact.kind==='month'?fact.label:sanitizeInsightLabel(fact.label),amount:fact.amount,count:fact.count,months:fact.months}));
}
