import { actualTransactions, type StatementImport } from './statements';
export const recurringMerchantKey = (label:string) => label.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function recurringSuggestions(imports:StatementImport[],spaceId:string,year:number,month:number,existing:{label:string}[]) {
  const groups=new Map<string,{label:string;amounts:Map<number,number[]>}>();
  const end=year*12+month-1;
  for(let offset=0;offset<6;offset++) {
    const serial=end-offset;
    for(const row of actualTransactions(imports,Math.floor(serial/12),serial%12+1,spaceId)) {
      if(row.kind!=='expense'||row.allocatedAmount<=0)continue;
      const key=recurringMerchantKey(row.description);
      const group=groups.get(key)||{label:row.description,amounts:new Map<number,number[]>()};
      group.amounts.set(serial,[...(group.amounts.get(serial)||[]),row.allocatedAmount]);groups.set(key,group);
    }
  }
  const known=new Set(existing.map(row=>recurringMerchantKey(row.label)));
  return [...groups].flatMap(([key,group])=>{
    if(known.has(key))return [];
    const months=[...group.amounts.keys()].sort((a,b)=>a-b);
    if(months.length<3||months.at(-1)!<end-1||!months.some((n,i)=>i>=2&&months[i-1]===n-1&&months[i-2]===n-2))return [];
    // Multiple purchases in one month are not strong evidence of a monthly bill.
    if(months.some(n=>group.amounts.get(n)!.length!==1))return [];
    const amounts=months.map(n=>group.amounts.get(n)![0]).sort((a,b)=>a-b);
    const median=amounts[Math.floor(amounts.length/2)];
    if(amounts.some(n=>Math.abs(n-median)>Math.max(2,median*.2)))return [];
    return [{key,label:group.label,amount:group.amounts.get(months.at(-1)!)![0],months:months.length,firstMonth:`${Math.floor(months[0]/12)}-${String(months[0]%12+1).padStart(2,'0')}`,lastMonth:`${Math.floor(months.at(-1)!/12)}-${String(months.at(-1)!%12+1).padStart(2,'0')}`}];
  }).sort((a,b)=>b.months-a.months||a.label.localeCompare(b.label));
}
