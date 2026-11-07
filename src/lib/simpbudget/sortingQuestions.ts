import type { StatementTransaction } from './statements';
export type SortingDecision = { id:string; spaceId:string|null; exclude:boolean };
export type SortingQuestion = { key:string; rows:StatementTransaction[]; suggestedSpaceId:string };
/** Only unresolved spending participates. Transfers and possible duplicates require separate review. */
export function sortingQuestions(rows:StatementTransaction[]):SortingQuestion[] {
  const groups=new Map<string,SortingQuestion>();
  for(const row of rows){
    if(row.reviewed||row.excluded||row.duplicate||row.splits.length||!['expense','refund'].includes(row.kind))continue;
    const merchant=row.description.replace(/\d.*$/,'').replace(/\*.*$/,'').trim().toLowerCase();
    const base=row.suggestedSpaceId?`${row.suggestedSpaceId}:${row.category||'Other'}`:`unknown:${merchant}`;
    let key=base,index=0;
    while((groups.get(key)?.rows.length||0)>=20)key=`${base}:${++index}`;
    if(!groups.has(key))groups.set(key,{key,rows:[],suggestedSpaceId:row.suggestedSpaceId||''});
    groups.get(key)!.rows.push(row);
  }
  return [...groups.values()];
}
export function applySortingDecisions(rows:StatementTransaction[],decisions:SortingDecision[],spaces:{id:string}[],answer:string):StatementTransaction[]{
  const eligible=new Set(sortingQuestions(rows).flatMap(q=>q.rows.map(r=>r.id)));
  const allowed=new Set(spaces.map(s=>s.id)); const seen=new Set<string>();
  for(const d of decisions){if(!eligible.has(d.id)||seen.has(d.id)||typeof d.exclude!=='boolean'||(!d.exclude&&!allowed.has(d.spaceId||'')))throw new Error('The sorting proposal is out of date or invalid. Review these transactions again.');seen.add(d.id);}
  const choices=new Map(decisions.map(d=>[d.id,d]));
  return rows.map(row=>{const choice=choices.get(row.id);return choice?{...row,spaceId:choice.exclude?'':choice.spaceId!,excluded:choice.exclude,reviewed:true,reason:`Sorting answer: ${answer.slice(0,2000)}`} :row;});
}
