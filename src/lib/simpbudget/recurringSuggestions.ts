import { actualTransactions, type StatementImport } from './statements';
import { recurringMerchantKey, recurringMatch,recurringBillIdentity } from './merchantMatching';
export { recurringMerchantKey } from './merchantMatching';
const monthKey=(serial:number)=>`${Math.floor(serial/12)}-${String(serial%12+1).padStart(2,'0')}`;
export function recurringSuggestions(imports:StatementImport[],spaceId:string,year:number,month:number,existing:{label:string}[]) {
  const groups=new Map<string,{label:string;bill:boolean;amounts:Map<number,number[]>}>();
  const end=year*12+month-1;
  for(let offset=0;offset<6;offset++) {
    const serial=end-offset;
    for(const row of actualTransactions(imports,Math.floor(serial/12),serial%12+1,spaceId)) {
      if(row.kind!=='expense'||row.allocatedAmount<=0||/dispute|reversal|chargeback|overdraft|late fee|late payment fee|returned payment|insufficient funds|\bnsf\b|interest charge/i.test(row.description))continue;
      const identity=recurringBillIdentity(row.description),key=recurringMerchantKey(row.description);
      const group=groups.get(key)||{label:identity?.label||row.description,bill:!!identity,amounts:new Map<number,number[]>()};
      group.amounts.set(serial,[...(group.amounts.get(serial)||[]),row.allocatedAmount]);groups.set(key,group);
    }
  }
  return [...groups].flatMap(([key,group])=>{
    if(existing.some(row=>recurringMatch(group.label,row.label).matched||recurringMatch(row.label,group.label).matched))return [];
    const months=[...group.amounts.keys()].sort((a,b)=>a-b);
    if(!months.length||months.at(-1)!<end-1)return [];
    const evidence=months.map(n=>({month:monthKey(n),amount:group.amounts.get(n)!.reduce((sum,a)=>sum+Math.round(a*100),0)/100,charges:group.amounts.get(n)!.length}));
    const amounts=evidence.map(row=>row.amount).sort((a,b)=>a-b),median=amounts[Math.floor(amounts.length/2)];
    const variable=amounts.some(n=>Math.abs(n-median)>Math.max(2,median*.2));
    const multiple=evidence.some(row=>row.charges>1);
    const consecutive=months.some((n,i)=>i>=2&&months[i-1]===n-1&&months[i-2]===n-2);
    if(!group.bill&&(months.length<3||!consecutive||multiple||variable))return [];
    const confidence:'single-bill'|'limited-history'|'established'=months.length===1?'single-bill':months.length>=3&&consecutive?'established':'limited-history';
    const latest=evidence.at(-1)!;
    const explanation=[group.bill?(months.length===1?'Possible recurring bill: only one month of charges is available; recurrence is not confirmed.':`Recognized biller with charges in ${months.length} months${confidence!=='established'?'; limited recurring history':''}.`):`One consistent charge in each of ${months.length} months supports a recurring suggestion.`,variable?'Monthly amounts vary; a fixed-price subscription is not assumed.':'',multiple?'Some months contain multiple charges. The proposed amount is their monthly total; review for separate services or duplicate charges.':'',`Proposed amount uses ${latest.month}${latest.month!==monthKey(end)?'; no charge was found in the selected month':''}. Acceptance adds a plan, not new spending.`].filter(Boolean).join(' ');
    return [{key,label:group.label,amount:latest.amount,months:months.length,firstMonth:evidence[0].month,lastMonth:latest.month,amountMonth:latest.month,evidence,confidence,variable,charges:latest.charges,reviewRequired:group.bill&&(confidence!=='established'||multiple||variable),explanation}];
  }).sort((a,b)=>b.months-a.months||a.label.localeCompare(b.label));
}
