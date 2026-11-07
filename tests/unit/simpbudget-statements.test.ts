import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, mapCsv, parseStatementAmount, normalizeStatementDate, applySuggestions, markDuplicates, validateTransaction, actualTotals, type StatementTransaction, type StatementImport } from '../../src/lib/simpbudget/statements';
const tx = (extra: Partial<StatementTransaction> = {}): StatementTransaction => ({ id: '1', date: '2026-11-01', description: 'Home Depot', amount: 100, kind: 'expense', spaceId: 'personal', reason: '', sourceRow: 2, reviewed: true, excluded: false, duplicate: false, splits: [], ...extra });
const statement = (extra: Partial<StatementImport> = {}): StatementImport => ({ id: 's1', accountId: 'a', fileName: 'test.csv', fingerprint: 'file1', guidance: '', createdAt: '2026-11-01', status: 'committed', transactions: [tx()], warnings: [], ...extra });
test('CSV handles BOM, quoted commas, escaped quotes, newlines, CRLF and empty cells', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b,c\r\n"one,two","say ""hi""\nnow",\r\n'), [['a','b','c'], ['one,two','say "hi"\nnow','']]);
  assert.throws(() => parseCsv('"unclosed')); assert.throws(() => parseCsv('"closed"bad'));
});
test('amount and date parsing rejects invalid or ambiguous data', () => {
  assert.equal(parseStatementAmount('($1,234.50)'), -1234.5);
  assert.equal(normalizeStatementDate('02/29/2024'), '2024-02-29');
  for (const value of ['1,23', '1.234', '', '(-2)', 'NaN']) assert.throws(() => parseStatementAmount(value));
  for (const value of ['2025-02-29', '11/01/26', '13/01/2026', '2026-11-31']) assert.throws(() => normalizeStatementDate(value));
});
test('CSV mapping supports signed amounts and debit/credit without dropping invalid rows', () => {
  assert.equal(mapCsv([['11/01/2026','shop','-12.01']], { date: 0, description: 1, amount: 2 }, { positiveExpenses: false })[0].amount, 12.01);
  const rows = mapCsv([['2026-11-01','shop','15',''], ['2026-11-02','refund','','5']], { date:0, description:1, debit:2, credit:3 });
  assert.deepEqual(rows.map(r => r.amount), [15, -5]); assert.equal(rows[1].reviewed, false);
  assert.throws(() => mapCsv([['bad','shop','2'], ['2026-11-01','valid','4']], { date:0, description:1, amount:2 }), /No rows were imported/);
  assert.throws(() => mapCsv([['2026-11-01','shop','2','3']], { date:0, description:1, debit:2, credit:3 }));
  assert.throws(() => mapCsv([], { date:0, description:0, amount:2 }));
});
test('suggestions preserve user review and never autoassign guidance or persist rules', () => {
  const spaces = [{ id:'personal', name:'Personal' }, { id:'pulse', name:'Pulse' }];
  const account = { id:'a', name:'Bank', type:'bank' as const, defaultSpaceId:'personal' };
  const original = tx({ reviewed:false, spaceId:'' });
  const [suggested] = applySuggestions([original], account, [], spaces, 'Transactions from Home Depot this month are for Pulse');
  assert.equal(suggested.suggestedSpaceId, 'pulse'); assert.equal(suggested.spaceId, ''); assert.equal(suggested.reviewed, false);
  const [ambiguous] = applySuggestions([original], account, [{ id:'r', contains:'Home Depot', spaceId:'personal' }], spaces, 'Transactions from Home Depot this month are for Pulse');
  assert.equal(ambiguous.suggestedSpaceId, undefined); assert.match(ambiguous.reason, /Conflicting/);
});
test('deduplication warns without dropping rows and scopes matches to accounts', () => {
  const imported = markDuplicates([statement()], statement({ id:'s2', fingerprint:'file2', transactions:[tx(),tx({id:'2'})] }));
  assert.equal(imported.transactions.length, 2); assert.ok(imported.transactions.every(t => t.duplicate));
  assert.equal(markDuplicates([statement()], statement({id:'s2',accountId:'b',fingerprint:'other'})).transactions[0].duplicate, false);
  assert.equal(markDuplicates([statement({status:'undone'})], statement({id:'s2'})).transactions[0].duplicate, false);
});
test('review and split validation uses exact cents and credits remain negative', () => {
  assert.ok(validateTransaction(tx({reviewed:false})));
  assert.ok(validateTransaction(tx({splits:[{spaceId:'personal',amount:99.99}]})));
  assert.equal(validateTransaction(tx({amount:0.3,splits:[{spaceId:'personal',amount:0.1},{spaceId:'pulse',amount:0.2}]})), null);
  assert.ok(validateTransaction(tx({kind:'refund'})));
  assert.equal(validateTransaction(tx({kind:'transfer',spaceId:''})), null);
  assert.equal(validateTransaction(tx({excluded:true,reviewed:false})), null);
});
test('actual totals only include committed reviewed expenses/refunds and never payments/income/plans', () => {
  assert.deepEqual(actualTotals([statement({transactions:[tx(),tx({amount:-20,kind:'refund'}),tx({amount:50,kind:'transfer'}),tx({amount:60,kind:'card_payment'}),tx({amount:-200,kind:'income'}),tx({excluded:true}),tx({reviewed:false}),tx({amount:30,splits:[{spaceId:'pulse',amount:10},{spaceId:'personal',amount:20}]})]}), statement({status:'review'}), statement({status:'undone'})]), {personal:100,pulse:10});
});
test('parser suggestions retain reasons, reconcile rules and reject unknown spaces', () => {
  const spaces = [{id:'personal',name:'Personal'},{id:'pulse',name:'Pulse'}];
  const account = {id:'a',name:'Bank',type:'bank' as const,defaultSpaceId:'personal'};
  const parsed = tx({suggestedSpaceId:'pulse',reason:'AI matched this upload guidance.',reviewed:false,spaceId:''});
  const [preserved] = applySuggestions([parsed],account,[],spaces);
  assert.equal(preserved.suggestedSpaceId,'pulse'); assert.equal(preserved.reason,parsed.reason);
  assert.equal(preserved.reviewed,false); assert.equal(preserved.spaceId,'');
  const [conflict] = applySuggestions([parsed],account,[{id:'r',contains:'Home Depot',spaceId:'personal'}],spaces);
  assert.equal(conflict.suggestedSpaceId,undefined); assert.match(conflict.reason,/Conflicting/);
  const [agreement] = applySuggestions([parsed],account,[{id:'r',contains:'Home Depot',spaceId:'pulse'}],spaces);
  assert.equal(agreement.suggestedSpaceId,'pulse'); assert.match(agreement.reason,/AI matched/); assert.match(agreement.reason,/Merchant rule/);
  const [invalid] = applySuggestions([tx({suggestedSpaceId:'deleted'})],account,[],spaces);
  assert.equal(invalid.suggestedSpaceId,'personal'); assert.match(invalid.reason,/Account default/);
});
test('advertised merchant-first upload guidance suggests TresProperties without assigning it', () => {
  const spaces = [{id:'personal',name:'Personal'},{id:'tres',name:'TresProperties'}];
  const account = {id:'a',name:'Bank',type:'bank' as const,defaultSpaceId:'personal'};
  const [suggestion,other] = applySuggestions([tx({spaceId:'',reviewed:false}),tx({description:'Coffee'})],account,[],spaces,'Home Depot transactions this month are likely for TresProperties');
  assert.equal(suggestion.suggestedSpaceId,'tres'); assert.equal(suggestion.spaceId,''); assert.equal(suggestion.reviewed,false);
  assert.equal(other.suggestedSpaceId,'personal');
});

test('batch provenance survives splitting and account-aware duplicates across files', async()=>{
  const {withStatementSource,combineStatementImports,splitStatementBatch}=await import('../../src/lib/simpbudget/statements');
  const a=withStatementSource(statement({id:'a1',batchId:'batch',accountId:'card1',status:'review'}),'Chase Ink');
  const b=withStatementSource(statement({id:'b1',batchId:'batch',accountId:'card2',status:'review',transactions:[tx({id:'2'})]}),'Chase Slate');
  const merged=combineStatementImports([a,b]);assert.equal(merged.transactions.length,2);
  assert.deepEqual(merged.transactions.map(t=>t.sourceAccountName),['Chase Ink','Chase Slate']);
  const saved=splitStatementBatch({...merged,status:'committed'});assert.equal(saved.length,2);
  assert.ok(saved.every(s=>s.status==='committed'&&s.transactions.length===1&&!s.members));
  assert.equal(markDuplicates([a],b).transactions[0].duplicate,false);
  assert.equal(markDuplicates([a],withStatementSource({...b,accountId:'card1'},'Chase Ink')).transactions[0].duplicate,true);
  assert.throws(()=>splitStatementBatch({...merged,transactions:[tx()]}),/source statement/);
});

test('Chase CSV preserves dates, signs, payments, source references and known budget suggestions',async()=>{
  const {parseChaseCsv}=await import('../../src/lib/simpbudget/statements');
  const rows=[['Transaction Date','Post Date','Description','Category','Type','Amount','Source document','Source row','Suggested budget','Review reason'],['01/01/2026','01/02/2026','Cloud','Business services','Sale','-15.25','January.pdf','PDF page 3','Pulse','Confirmed by owner'],['01/02/2026','01/03/2026','Payment','','Payment','50','','','','']];
  const parsed=parseChaseCsv(rows,[{id:'pulse',name:'Pulse'}])!;
  assert.equal(parsed[0].amount,15.25);assert.equal(parsed[0].date,'2026-01-01');assert.equal(parsed[0].sourceFileName,'January.pdf');assert.equal(parsed[0].suggestedSpaceId,'pulse');assert.equal(parsed[0].reviewed,false);
  assert.equal(parsed[1].kind,'card_payment');assert.equal(parsed[1].amount,-50);
});

test('monthly misc ledger matches actual allocations and excludes drafts, undone, payments and other months', async()=>{
 const {actualTransactions}=await import('../../src/lib/simpbudget/statements');
 const data=[statement({transactions:[tx(),tx({id:'split',amount:80,splits:[{spaceId:'personal',amount:30},{spaceId:'pulse',amount:50}]}),tx({id:'refund',amount:-5,kind:'refund'}),tx({id:'payment',kind:'card_payment'}),tx({id:'old',date:'2026-10-01'}),tx({id:'excluded',excluded:true})]}),statement({id:'draft',status:'review'}),statement({id:'undone',status:'undone'})];
 const before=JSON.stringify(data);const rows=actualTransactions(data,2026,11,'personal');
 assert.equal(rows.length,3);assert.equal(rows.reduce((s,r)=>s+r.allocatedAmount,0),125);assert.ok(rows.every(r=>r.statementId==='s1'));assert.equal(JSON.stringify(data),before);
 assert.equal(actualTransactions(data,2026,11,'pulse')[0].allocatedAmount,50);
});
