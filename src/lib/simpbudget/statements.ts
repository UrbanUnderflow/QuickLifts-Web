/** Statement actuals stay separate from planned budgets. All amounts are expense-positive. */
export type TransactionKind = 'expense' | 'refund' | 'transfer' | 'card_payment' | 'income';
export interface Account { id: string; name: string; type: 'bank' | 'card'; defaultSpaceId: string }
export interface Rule { id: string; contains: string; spaceId: string }
export interface StatementTransaction {
  sourceAccountId?: string; sourceAccountName?: string; sourceFileName?: string; sourceImportId?: string;
  category?: string;
  id: string; date: string; description: string; amount: number; kind: TransactionKind;
  spaceId: string; suggestedSpaceId?: string; reason: string; sourceRow: number | string;
  reviewed: boolean; excluded: boolean; duplicate: boolean; splits: { spaceId: string; amount: number }[];
}
export interface StatementImport {
  batchId?: string;
  /** UI-only aggregate; persisted as separate source documents in one transaction. */
  members?: StatementImport[];
  id: string; accountId: string; fileName: string; fingerprint: string; guidance: string;
  revision?: number; createdAt: string; status: 'review' | 'committed' | 'undone'; transactions: StatementTransaction[];
  openingBalance?: number; closingBalance?: number; statementTotal?: number; warnings: string[];
}
export interface CsvMapping { date: number; description: number; amount?: number; debit?: number; credit?: number }
const cents = (value: number) => Math.round(value * 100);
const normalized = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false;
  const pushRow = () => { row.push(field); if (row.some(cell => cell.trim() !== '')) rows.push(row); row = []; field = ''; closed = false; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === ',' ) { row.push(field); field = ''; closed = false; }
    else if (ch === '\r' || ch === '\n') { if (ch === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else if (ch === '"') { if (field || closed) throw new Error('CSV contains an unexpected quote.'); quoted = true; }
    else { if (closed && ch.trim()) throw new Error('CSV has text after a closing quote.'); if (!closed) field += ch; }
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (field || row.length || closed) pushRow();
  return rows;
}

export function normalizeStatementDate(value: string): string {
  const raw = value.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (match) [, y, m, d] = match.map(Number);
  else {
    match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
    if (!match) throw new Error('Date must be YYYY-MM-DD or MM/DD/YYYY.');
    m = Number(match[1]); d = Number(match[2]); y = Number(match[3]);
  }
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  if (y! < 1900 || y! > 2200 || date.getUTCFullYear() !== y! || date.getUTCMonth() !== m! - 1 || date.getUTCDate() !== d!) throw new Error('Invalid calendar date.');
  return `${y!}-${String(m!).padStart(2, '0')}-${String(d!).padStart(2, '0')}`;
}

export function parseStatementAmount(value: string): number {
  let raw = value.trim();
  if (!raw) throw new Error('Amount is missing.');
  const parenthesized = /^\(.*\)$/.test(raw);
  if (parenthesized) raw = raw.slice(1, -1).trim();
  raw = raw.replace(/^\$\s*/, '');
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) throw new Error('Amount must be a number with at most two decimal places.');
  if (parenthesized && /^[+-]/.test(raw)) throw new Error('Amount has conflicting signs.');
  const result = Number(raw.replace(/,/g, '')) * (parenthesized ? -1 : 1);
  if (!Number.isFinite(result) || Math.abs(result) > 1000000000) throw new Error('Amount is outside the supported range.');
  return cents(result) / 100;
}

/** Pass data rows only, after removing the CSV header. No invalid transaction is silently dropped. */
export function mapCsv(rows: string[][], mapping: CsvMapping, options: { positiveExpenses?: boolean } = {}): StatementTransaction[] {
  const indices = Object.values(mapping).filter((n): n is number => n !== undefined);
  if (indices.some(n => !Number.isInteger(n) || n < 0) || new Set(indices).size !== indices.length) throw new Error('Choose distinct valid CSV columns.');
  const hasAmount = mapping.amount !== undefined;
  if (!hasAmount && mapping.debit === undefined && mapping.credit === undefined) throw new Error('Choose an amount column or debit/credit columns.');
  if (hasAmount && (mapping.debit !== undefined || mapping.credit !== undefined)) throw new Error('Choose either signed amounts or debit/credit columns.');
  const errors: string[] = [];
  const result = rows.map((row, index): StatementTransaction | null => {
    try {
      if (indices.some(n => n >= row.length)) throw new Error('Mapped column is missing.');
      const date = normalizeStatementDate(row[mapping.date] ?? '');
      const description = (row[mapping.description] ?? '').trim();
      if (!description || description.length > 1000) throw new Error('Description is missing or too long.');
      let amount: number;
      if (hasAmount) amount = parseStatementAmount(row[mapping.amount!]) * (options.positiveExpenses === false ? -1 : 1);
      else {
        const debitText = mapping.debit === undefined ? '' : row[mapping.debit].trim();
        const creditText = mapping.credit === undefined ? '' : row[mapping.credit].trim();
        if (!debitText && !creditText) throw new Error('Debit and credit are both empty.');
        const debit = debitText ? parseStatementAmount(debitText) : 0;
        const credit = creditText ? parseStatementAmount(creditText) : 0;
        if (debit < 0 || credit < 0 || (debit !== 0 && credit !== 0)) throw new Error('Debit/credit columns must contain one nonnegative amount per row.');
        amount = (cents(debit) - cents(credit)) / 100;
      }
      return { id: `row-${index + 2}`, date, description, amount, kind: amount < 0 ? 'refund' : 'expense', spaceId: '', reason: amount < 0 ? 'Credit detected. Review whether this is a refund, income, or transfer.' : 'Needs review.', sourceRow: index + 2, reviewed: false, excluded: false, duplicate: false, splits: [] };
    } catch (error) { errors.push(`Row ${index + 2}: ${(error as Error).message}`); return null; }
  });
  if (errors.length) throw new Error(`${errors.slice(0, 10).join(' ')}${errors.length > 10 ? ` Plus ${errors.length - 10} more invalid rows.` : ''} No rows were imported.`);
  return result as StatementTransaction[];
}

/** Guidance remains a suggestion, never a saved rule or automatic assignment. */
export function applySuggestions(transactions: StatementTransaction[], account: Account, rules: Rule[], spaces: { id: string; name: string }[], guidance = ''): StatementTransaction[] {
  const valid = new Set(spaces.map(s => s.id));
  const namedSpaces = spaces.filter(s => normalized(guidance).includes(normalized(s.name)));
  const merchantMatch = /(?:from|at|merchant)\s+["']?(.+?)["']?\s+(?:this month|in this month|should|are|is|to|for|likely|go|belongs)/i.exec(guidance);
  const leadingMerchant = /^\s*["']?(.+?)["']?\s+transactions\s+(?:this month\s+)?(?:are|should|go|belong)/i.exec(guidance);
  const merchant = (merchantMatch?.[1] || leadingMerchant?.[1])?.trim();
  return transactions.map(tx => {
    const matches = rules.filter(r => r.contains.trim() && valid.has(r.spaceId) && normalized(tx.description).includes(normalized(r.contains)));
    const targets = new Set(matches.map(r => r.spaceId));
    const parserSuggestion = tx.suggestedSpaceId && valid.has(tx.suggestedSpaceId) ? tx.suggestedSpaceId : undefined;
    if (parserSuggestion) targets.add(parserSuggestion);
    const guidanceApplies = merchant && normalized(tx.description).includes(normalized(merchant));
    if (guidanceApplies && namedSpaces.length === 1) targets.add(namedSpaces[0].id);
    let suggestedSpaceId: string | undefined; let reason = tx.reason || 'Needs review.';
    if (targets.size > 1 || (guidanceApplies && namedSpaces.length > 1)) reason = 'Conflicting suggestions. Choose a Budget Space.';
    else if (targets.size === 1) {
      suggestedSpaceId = [...targets][0];
      const reasons: string[] = [];
      if (parserSuggestion) reasons.push(tx.reason || 'Suggested by statement parsing. Review before committing.');
      if (guidanceApplies && namedSpaces.length === 1) reasons.push('Suggested from guidance for this upload. Review before committing.');
      if (matches.length) reasons.push(`Merchant rule matched: ${matches.map(r => r.contains).join(', ')}. Review before committing.`);
      reason = reasons.join(' ');
    }
    else if (valid.has(account.defaultSpaceId)) { suggestedSpaceId = account.defaultSpaceId; reason = 'Account default suggestion. Review before committing.'; }
    else if (guidance.trim()) reason = 'Upload guidance requires manual review; no unambiguous merchant match.';
    const { suggestedSpaceId: _previous, ...rest } = tx;
    return suggestedSpaceId ? { ...rest, suggestedSpaceId, reason } : { ...rest, reason };
  });
}

export function transactionFingerprint(accountId: string, tx: Pick<StatementTransaction, 'date' | 'description' | 'amount'>): string {
  return JSON.stringify([accountId, tx.date, normalized(tx.description), cents(tx.amount)]);
}

export function markDuplicates(imports: StatementImport[], newImport: StatementImport): StatementImport {
  const seen = new Set<string>();
  for (const item of imports) if (item.id !== newImport.id && item.status !== 'undone') for (const tx of item.transactions) if (!tx.excluded) seen.add(transactionFingerprint(tx.sourceAccountId || item.accountId, tx));
  const sameFile = imports.some(item => item.id !== newImport.id && item.status !== 'undone' && item.accountId === newImport.accountId && item.fingerprint && item.fingerprint === newImport.fingerprint);
  const transactions = newImport.transactions.map(tx => { const key = transactionFingerprint(tx.sourceAccountId || newImport.accountId, tx); const duplicate = sameFile || seen.has(key); seen.add(key); return { ...tx, duplicate }; });
  return { ...newImport, transactions };
}

/** Keep account/file provenance on every row, including after batch sorting or splitting. */
export function withStatementSource(item: StatementImport, accountName: string): StatementImport {
  return {...item, transactions:item.transactions.map(tx=>({...tx, sourceAccountId:item.accountId,
    sourceAccountName:accountName, sourceFileName:tx.sourceFileName || item.fileName, sourceImportId:item.id}))};
}

export function combineStatementImports(members: StatementImport[]): StatementImport {
  if (!members.length) throw new Error('No statements to combine.');
  if (members.length===1) return members[0];
  if (members.some(m=>m.status!==members[0].status)) throw new Error('These statements have different statuses. Open them separately.');
  return {...members[0], id:members[0].batchId || members[0].id, accountId:'',
    fileName:`${members.length} statements`, fingerprint:'', members,
    openingBalance:undefined, closingBalance:undefined, statementTotal:undefined,
    transactions:members.flatMap(m=>m.transactions).sort((a,b)=>a.date.localeCompare(b.date)),
    warnings:members.flatMap(m=>m.warnings.map(w=>`${m.fileName}: ${w}`))};
}

export function splitStatementBatch(value: StatementImport): StatementImport[] {
  if (!value.members) return [value];
  const ids=new Set(value.members.map(m=>m.id));
  if (value.transactions.some(tx=>!tx.sourceImportId || !ids.has(tx.sourceImportId))) throw new Error('A transaction is missing its source statement.');
  return value.members.map(member=>({...member,status:value.status,
    transactions:value.transactions.filter(tx=>tx.sourceImportId===member.id)}));
}

/** Chase CSV exports encode purchases negative and payments positive. Preserve category/type. */
export function isChaseCsv(rows: string[][]): boolean {
  const header=rows[0]?.map(h=>h.trim().toLowerCase()) || [];
  return ['transaction date','post date','description','category','type','amount'].every(h=>header.includes(h));
}

export function parseChaseCsv(rows: string[][], spaces: {id:string;name:string}[] = []): StatementTransaction[] | null {
  const header=rows[0]?.map(h=>h.trim().toLowerCase()) || [];
  const index=(name:string)=>header.indexOf(name);
  if (!isChaseCsv(rows)) return null;
  const mapped=mapCsv(rows.slice(1),{date:index('transaction date'),description:index('description'),amount:index('amount')},{positiveExpenses:false});
  return mapped.map((tx,i)=>{
    const type=rows[i+1][index('type')].trim().toLowerCase();
    const kind:TransactionKind=type==='payment'?'card_payment':tx.amount<0?'refund':'expense';
    const optional=(name:string)=>index(name)>=0?rows[i+1][index(name)]?.trim():undefined;
    const suggestion=spaces.find(s=>normalized(s.name)===normalized(optional('suggested budget')||''));
    return {...tx,kind,category:rows[i+1][index('category')].trim() || undefined,
      sourceFileName:optional('source document'),sourceRow:optional('source row')||tx.sourceRow,
      ...(suggestion?{suggestedSpaceId:suggestion.id}:{}),
      reason:optional('review reason') || (kind==='card_payment'?'Chase identifies this as a card payment; exclude from spending.':'Chase CSV transaction; review its budget.')};
  });
}

export function validateTransaction(tx: StatementTransaction): string | null {
  if (tx.excluded) return null;
  try { if (normalizeStatementDate(tx.date) !== tx.date) return 'Use an ISO transaction date.'; } catch { return 'Choose a valid transaction date.'; }
  if (!tx.description.trim()) return 'A description is required.';
  if (!Number.isFinite(tx.amount) || Math.abs(tx.amount) > 1000000000 || Math.abs(tx.amount * 100 - cents(tx.amount)) > 0.00001) return 'Amount must be valid cents.';
  if (!['expense', 'refund', 'transfer', 'card_payment', 'income'].includes(tx.kind)) return 'Choose a transaction kind.';
  if (!tx.reviewed) return 'Review this transaction before committing.';
  if (tx.kind === 'refund' || tx.kind === 'income') { if (tx.amount > 0) return 'Refunds and income must use negative amounts.'; }
  if (tx.kind === 'expense' && tx.amount < 0) return 'Expenses must use positive amounts.';
  if (tx.kind === 'transfer' || tx.kind === 'card_payment') return null;
  if (tx.splits.length) {
    if (tx.splits.some(s => !s.spaceId || !Number.isFinite(s.amount) || Math.abs(s.amount * 100 - cents(s.amount)) > 0.00001 || (tx.amount >= 0 ? s.amount < 0 : s.amount > 0))) return 'Each split needs a Budget Space and a valid amount with the transaction sign.';
    if (tx.splits.reduce((sum, s) => sum + cents(s.amount), 0) !== cents(tx.amount)) return 'Split amounts must equal the transaction amount.';
  } else if (!tx.spaceId) return 'Choose a Budget Space.';
  return null;
}

/** Imported actual expenses only. Income, transfers and card settlements never inflate expenses. */
export function actualTotals(imports: StatementImport[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of imports) if (item.status === 'committed') for (const tx of item.transactions) {
    if (tx.excluded || !tx.reviewed || !['expense', 'refund'].includes(tx.kind) || validateTransaction(tx)) continue;
    for (const split of tx.splits.length ? tx.splits : [{ spaceId: tx.spaceId, amount: tx.amount }]) totals[split.spaceId] = (cents(totals[split.spaceId] || 0) + cents(split.amount)) / 100;
  }
  return totals;
}
