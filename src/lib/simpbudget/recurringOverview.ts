import {type StatementImport} from './statements';
import {projectedRecurring} from './recurringProjection';
import {recurringSuggestions} from './recurringSuggestions';
import {validateRecurringMonth} from './recurringValidation';
export type OverviewRecurringRow={id:string;label:string;amount:string};
export type OverviewRecurringMonth={budgetSpaceId:string;year:number;month:number;recurringExpenses:OverviewRecurringRow[]};
type Space={id:string;name:string};
type Validation=ReturnType<typeof validateRecurringMonth>[number];
type Suggestion=ReturnType<typeof recurringSuggestions>[number];
export type RecurringOverviewRow={budgetId:string;name:string;year:number;month:number;kind:'explicit'|'accepted'|'suggestion';row:OverviewRecurringRow;amount:number;status:string;validation?:Validation;suggestion?:Suggestion;sourceYear?:number;sourceMonth?:number};
const monthKey=(year:number,month:number)=>`${year}-${String(month).padStart(2,'0')}`;
/** Global recurring actions are independent of the page's selected budget or month. */
export function recurringOverview(imports:StatementImport[],records:OverviewRecurringMonth[],spaces:Space[],selectedYear:number,selectedMonth:number,today=new Date().toISOString().slice(0,10)){
 const monthsByBudget=new Map(spaces.map(s=>[s.id,new Set<string>()]));
 for(const record of records)if(record.month>=1&&record.month<=12)monthsByBudget.get(record.budgetSpaceId)?.add(monthKey(record.year,record.month));
 for(const item of imports){if(item.status!=='committed')continue;for(const tx of item.transactions){if(!/^\d{4}-\d{2}-\d{2}$/.test(tx.date))continue;for(const allocation of tx.splits.length?tx.splits:[{spaceId:tx.spaceId}])monthsByBudget.get(allocation.spaceId)?.add(tx.date.slice(0,7));}}
 const selectedKey=monthKey(selectedYear,selectedMonth);
 if(selectedKey<=today.slice(0,7))for(const months of monthsByBudget.values())months.add(selectedKey);
 const suggestionMap=new Map<string,{budgetId:string;name:string;year:number;month:number;key:string;suggestion:Suggestion}>();
 const reviewActions:{budgetId:string;name:string;year:number;month:number;row:OverviewRecurringRow;validation:Validation}[]=[];
 const rows:RecurringOverviewRow[]=[];
 for(const space of spaces){
  const selectedIncluded=monthsByBudget.get(space.id)!.has(selectedKey);
  // A selected future month can render its empty sheet, but creates no global actions.
  const months=[...monthsByBudget.get(space.id)!].sort();
  if(!selectedIncluded)months.push(selectedKey);
  for(const key of months){
   const year=Number(key.slice(0,4)),month=Number(key.slice(5,7));
   const explicit=records.find(r=>r.budgetSpaceId===space.id&&r.year===year&&r.month===month)?.recurringExpenses||[];
   const inherited=projectedRecurring(imports,records,space.id,year,month,explicit);
   const effective=[...explicit,...inherited];
   const validations=validateRecurringMonth(imports,space.id,year,month,effective);
   const suggestions=recurringSuggestions(imports,space.id,year,month,effective);
   const actionMonth=monthsByBudget.get(space.id)!.has(key);
   if(actionMonth){
    // A suggestion belongs to its latest actual charge month, not an empty later month.
    for(const suggestion of suggestions){if(suggestion.amountMonth!==key)continue;const identity=`${space.id}|${suggestion.key}`;suggestionMap.set(identity,{budgetId:space.id,name:space.name,year,month,key:suggestion.key,suggestion});}
    for(const validation of validations)if(validation.status!=='Matched'&&explicit.some(row=>row.id===validation.id))reviewActions.push({budgetId:space.id,name:space.name,year,month,row:effective.find(row=>row.id===validation.id)!,validation});
   }
   if(key===selectedKey){
    for(const row of effective){const validation=validations.find(v=>v.id===row.id)!;const source=inherited.find(v=>v.id===row.id);rows.push({budgetId:space.id,name:space.name,year,month,kind:source?'accepted':'explicit',row,amount:Number(row.amount.replace(/,/g,''))||0,status:source?'Accepted across months':validation.status,validation,...(source?{sourceYear:source.sourceYear,sourceMonth:source.sourceMonth}:{})});}
    for(const suggestion of suggestions)rows.push({budgetId:space.id,name:space.name,year,month,kind:'suggestion',row:{id:`suggestion:${suggestion.key}`,label:suggestion.label,amount:suggestion.amount.toFixed(2)},amount:suggestion.amount,status:'Suggested recurring',suggestion});
   }
  }
 }
 const suggestionActions=[...suggestionMap.values()].sort((a,b)=>b.year-a.year||b.month-a.month||a.name.localeCompare(b.name));
 const summariesMap=new Map<string,{id:string;budgetId:string;name:string;year:number;month:number;suggestions:number;reviews:number}>();
 for(const [kind,actions] of [['suggestions',suggestionActions],['reviews',reviewActions]] as const)for(const action of actions){const key=`${action.budgetId}|${monthKey(action.year,action.month)}`;const summary=summariesMap.get(key)||{id:action.budgetId,budgetId:action.budgetId,name:action.name,year:action.year,month:action.month,suggestions:0,reviews:0};summary[kind]++;summariesMap.set(key,summary);}
 const summaries=[...summariesMap.values()].sort((a,b)=>b.year-a.year||b.month-a.month||a.name.localeCompare(b.name));
 return {summaries,suggestionActions,reviewActions,rows,totals:{suggestions:suggestionActions.length,reviews:reviewActions.length}};
}
