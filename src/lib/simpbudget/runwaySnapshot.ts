import {bankCashFlow} from './cashFlow';
import {actualTransactions,type Account,type StatementImport} from './statements';
type Space={id:string;name:string};
type PeriodImport=StatementImport&{periodStart?:string;periodEnd?:string;statementPeriodStart?:string;statementPeriodEnd?:string};
const day=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))?value:'';
const nextDay=(value:string)=>new Date(Date.parse(value+'T00:00:00Z')+86400000).toISOString().slice(0,10);
const monthEnd=(month:string)=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
const referenceOnly=(value:string)=>/sweep|consolidated|reference.only/i.test(value);
/** A filename date is an estimate, never an assertion of live available funds. */
export function runwayStatementPeriod(item:PeriodImport) {
 const explicitEnd=day(item.statementPeriodEnd||item.periodEnd||'');
 if(explicitEnd)return {start:day(item.statementPeriodStart||item.periodStart||''),end:explicitEnd,basis:'statement metadata'};
 const monthly=item.fileName.match(/monthly-statement-(\d{4}-\d{2})\b/i);
 if(monthly)return {start:monthly[1]+'-01',end:monthEnd(monthly[1]),basis:'estimated from monthly statement filename'};
 const named=item.fileName.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i);
 if(named){const month=['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(named[0].split(/\s/)[0].toLowerCase())+1;const key=`${named[1]}-${String(month).padStart(2,'0')}`;return {start:key+'-01',end:monthEnd(key),basis:'estimated from monthly statement filename'};}
 const dated=item.fileName.match(/(?:^|[^0-9])(20\d{2})[-]?(\d{2})[-]?(\d{2})(?!\d)/);
 if(dated){const end=day(`${dated[1]}-${dated[2]}-${dated[3]}`);if(end)return {start:'',end,basis:'estimated from statement filename'};}
 return {start:'',end:'',basis:'statement date unavailable'};
}
function owner(account:Account,spaces:Space[]) {
 if(spaces.some(s=>s.id===account.defaultSpaceId))return account.defaultSpaceId;
 const name=/mercury/i.test(account.name)?'Pulse':/chase/i.test(account.name)&&/7323/.test(account.name)?'Personal':/chase/i.test(account.name)&&/7715/.test(account.name)?'TresProperties':'';
 return spaces.find(s=>s.name.toLowerCase()===name.toLowerCase())?.id||'';
}
function coversMonth(items:StatementImport[],month:string) {
 const periods=items.map(item=>runwayStatementPeriod(item)).filter(p=>p.end).sort((a,b)=>a.end.localeCompare(b.end));
 const intervals=periods.map((p,i)=>({...p,start:p.start||(i&&Date.parse(p.end)-Date.parse(periods[i-1].end)<=45*86400000?nextDay(periods[i-1].end):'')})).filter(p=>p.start);
 let cursor=month+'-01';const end=monthEnd(month);
 for(const p of intervals){if(p.start>cursor||p.end<cursor)continue;cursor=nextDay(p.end);if(cursor>end)return true;}return false;
}
export function buildRunwaySnapshots(imports:StatementImport[],accounts:Account[],spaces:Space[],today=new Date().toISOString().slice(0,10)) {
 const committed=imports.filter(i=>i.status==='committed'&&!referenceOnly(i.fileName));
 const bankAccounts=accounts.filter(a=>a.type==='bank'&&!referenceOnly(a.name));
 const unknownBanks=bankAccounts.filter(a=>!owner(a,spaces));
 const candidates=Array.from({length:12},(_,i)=>new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-2-i,1)).toISOString().slice(0,7));
 return spaces.map(space=>{
  const owned=bankAccounts.filter(a=>owner(a,spaces)===space.id);const notes:string[]=['Historical statement closing balances, not live available cash. Credit-card balances and sweep/consolidated reference statements are excluded.'];
  const accountSources=owned.map(account=>{const statements=committed.filter(i=>i.accountId===account.id).map(item=>({item,period:runwayStatementPeriod(item)})).filter(({period})=>period.end&&period.end<=today).sort((a,b)=>b.period.end.localeCompare(a.period.end));const latest=statements[0];return {accountId:account.id,name:account.name,statementId:latest?.item.id||'',date:latest?.period.end||'',balance:typeof latest?.item.closingBalance==='number'&&Number.isFinite(latest.item.closingBalance)?latest.item.closingBalance:null,dateBasis:latest?.period.basis||'statement date unavailable'};});
  const missing=accountSources.filter(a=>a.balance===null);const cash=owned.length&&!missing.length?accountSources.reduce((s,a)=>s+Math.round(a.balance!*100),0)/100:null;
  if(!owned.length)notes.push('No bank account ownership is established for this budget.');
  if(missing.length)notes.push(`Latest closing balance unavailable: ${missing.map(a=>a.name).join(', ')}.`);
  if(unknownBanks.length)notes.push(`Bank ownership unresolved: ${unknownBanks.map(a=>a.name).join(', ')}. Cash totals are incomplete.`);
  const dates=accountSources.map(a=>a.date).filter(Boolean).sort();const asOf=dates.at(-1)||null;
  if(new Set(dates).size>1)notes.push(`Balances come from different dates (${dates[0]} to ${dates.at(-1)}), not a simultaneous bank snapshot.`);
  if(accountSources.some(a=>a.dateBasis.startsWith('estimated')))notes.push('Statement dates and coverage are estimated from filenames; review source statements to confirm periods.');
  const relevant=new Set(owned.map(a=>a.id));for(const item of committed)if(item.transactions.some(tx=>(tx.splits.length?tx.splits.some(a=>a.spaceId===space.id):tx.spaceId===space.id)))relevant.add(item.accountId);
  const latestEnds=[...relevant].map(id=>committed.filter(i=>i.accountId===id).map(i=>runwayStatementPeriod(i).end).filter(Boolean).sort().at(-1)||'');
  const commonEnd=latestEnds.length&&latestEnds.every(Boolean)?latestEnds.sort()[0]:'';
  const window=candidates.filter(month=>!commonEnd||monthEnd(month)<=commonEnd).slice(0,3);
  const monthCoverage=window.map(month=>({month,missingAccounts:[...relevant].filter(id=>!coversMonth(committed.filter(i=>i.accountId===id),month)).map(id=>accounts.find(a=>a.id===id)?.name||id)}));
  const months=window.filter(month=>relevant.size>0&&(monthCoverage.find(m=>m.month===month)!.missingAccounts.length===0||committed.some(i=>i.transactions.some(tx=>tx.date.startsWith(month)&&(tx.splits.length?tx.splits.some(a=>a.spaceId===space.id):tx.spaceId===space.id))))).reverse();
  const partialCoverage=monthCoverage.filter(m=>months.includes(m.month)&&m.missingAccounts.length>0);
  for(const coverage of partialCoverage)notes.push(`${coverage.month} is an observed-data estimate; statement coverage is incomplete for ${coverage.missingAccounts.join(', ')}.`);
  let monthlySpend:number|null=null,monthlyIncome:number|null=null;
  if(months.length){const spends=months.map(month=>actualTransactions(committed,Number(month.slice(0,4)),Number(month.slice(5,7)),space.id).reduce((sum,t)=>sum+Math.round(t.allocatedAmount*100),0));monthlySpend=Math.round(spends.reduce((s,n)=>s+n,0)/months.length)/100;
   const groups=new Map<string,{months:Set<string>;amount:number}>();for(const month of months){const rows=bankCashFlow(committed,accounts,{start:month+'-01',end:monthEnd(month)},space.id).earnedRows;for(const tx of rows){const key=tx.description.toLowerCase().replace(/\d+/g,'').replace(/[^a-z]+/g,' ').trim();const group=groups.get(key)||{months:new Set<string>(),amount:0};group.months.add(month);group.amount+=Math.round(tx.allocatedAmount*100);groups.set(key,group);}}
   monthlyIncome=months.length>=2?Math.round([...groups.values()].filter(g=>g.months.size>=2).reduce((s,g)=>s+g.amount,0)/months.length)/100:null;
   notes.push(`Spending averages ${months.join(', ')} (${months.length} observed calendar months). Earned inflows must recur in at least two of these months; financing, prizes, refunds and withdrawals are not recurring income.`);
  } else notes.push('No completed calendar month has usable observed activity or established zero-activity coverage. Monthly estimates are unavailable.');
  if(months.length<3)notes.push('Fewer than three observed completed months are available; missing months are not treated as zero.');
  if(months.length&&months.at(-1)!==candidates[0])notes.push(`Latest calendar month ${candidates[0]} is not fully covered; partial-month activity is excluded from averages.`);
  return {id:space.id,name:space.name,cash,asOf,accountSources,monthlySpend,monthlyIncome,spending:monthlySpend,income:monthlyIncome,months,monthCoverage,unknownBankAccounts:unknownBanks.map(a=>a.name),cashComplete:cash!==null&&!unknownBanks.length,confidence:(cash===null?'unavailable':months.length<3||partialCoverage.length>0||unknownBanks.length>0?'partial':'estimated') as 'estimated'|'partial'|'unavailable',notes,coverageNotes:notes};
 });
}
