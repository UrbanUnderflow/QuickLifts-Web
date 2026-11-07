# Statement review workflow

Statements live under the signed-in SimpBudget user, in `statementAccounts`, `statementRules`, and `statementImports`. Existing `budgets` and `budgetSpaces` are not migrated or changed by this workflow. Only committed, reviewed expense/refund transactions count toward statement actuals. Planned monthly budgets are displayed separately. Transfers, card payments, income, exclusions, review drafts, and undone imports do not count as expenses.

## Import and review

- CSV: one file at a time, browser-local parsing, explicit column and amount-sign mapping. ISO dates or US MM/DD/YYYY; invalid rows fail the import with row errors instead of disappearing.
- PDF (including scans), PNG, JPEG, WebP: authenticated Netlify extraction via OpenAI. Original files are held only for the extraction request and not saved by this workflow. Extracted transaction descriptions, provenance, and upload guidance are persisted in the owner's Firestore account.
- Limits: 4 MB and 500 rows per file; PDF/image extraction has a transactional 20-attempt/hour owner quota. Large or unclear documents should be split or exported as CSV.
- Per-upload guidance suggests buckets without creating permanent rules. CSV guidance uses conservative merchant matching. PDF/image guidance uses the extractor. Suggestions, account defaults, and merchant rules never silently confirm a row; conflicting evidence stays unsorted.
- Duplicate rows and repeated files are warned about, never silently removed. The user explicitly excludes a duplicate or keeps/reviews it.
- Splits must equal the original signed amount to the cent. Refunds are negative; spending is positive. Review source totals against the statement before committing.
- Save review persists edits. Switching import histories saves the active review; leaving the page warns while a review is open. Commit/undo changes one document atomically. Revision checks prevent stale tabs from overwriting a newer version. A lost response can be recovered by reloading history; it cannot duplicate a second ledger write.
- Undo retains the import for audit and removes its contribution to actuals. Re-uploading an undone file starts a new review.

## Security and runtime

`/.netlify/functions/simpbudget-parse-statement` requires a revoked-session-checked SimpBudget bearer token. The server resolves space ownership and labels, validates MIME signatures/size/encoding, validates model output, does not accept remote URLs, and suppresses upstream errors containing payloads or credentials. OpenAI response storage is disabled. Existing Firestore owner rules govern statement collections; a separate server-only collection holds extraction quotas. No rule deployment or budget backfill is needed.

Production needs valid SimpBudget Admin credentials and a funded OpenAI API credential. Missing or exhausted extraction credits produce an explicit CSV fallback, not a successful empty import. Provider extraction is probabilistic; all rows require review.

## Checks

Run with the repository Node runtime:

```
node --import tsx --test tests/unit/simpbudget-statements.test.ts
node --test tests/api/simpbudget/statement-parser.runtime.test.cjs tests/ui/simpbudget-statements.test.cjs tests/unit/simpbudget-import-safety.test.cjs tests/ui/simpbudget-rename-modal.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src/pages/SimpBudget.tsx src/components/simpbudget/StatementWorkspace.tsx src/lib/simpbudget/statements.ts netlify/functions/simpbudget-parse-statement.ts --max-warnings 0
node node_modules/next/dist/bin/next build
```

Unit/UI/API tests use synthetic fixtures and mock Firestore/provider calls. They do not prove live credentials or extraction health. Verify production with synthetic documents, then undo verification imports so spending totals remain unchanged. Never use real user statements in test logs or fixtures.
