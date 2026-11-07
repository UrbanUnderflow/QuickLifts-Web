# Statement review workflow

Statements live under the signed-in SimpBudget user, in `statementAccounts`, `statementRules`, and `statementImports`. Existing `budgets` and `budgetSpaces` are not migrated or changed by this workflow. Only committed, reviewed expense/refund transactions count toward statement actuals. Planned monthly budgets are displayed separately. Transfers, card payments, income, exclusions, review drafts, and undone imports do not count as expenses.

## Import and review

The main Import statement button opens a modal. Dropping or browsing for a file stages it locally and shows a preview. The prompt and account selection appear after staging. Only Analyze sends PDFs/images and the prompt to the extractor; CSV analysis remains local. The separate legacy admin-budget copy action is collapsed and explicitly labeled.

The review modal shows transaction rows with category dropdowns. Drag a row to a budget tile, or select multiple rows and click a tile. Successfully assigned rows leave the unsorted list; Undo last sort restores the previous draft state. View sorted allows inspection and reassignment. Transfers, card payments, and income can be set aside through the category menu. Optional Edit controls preserve corrections and exact-cent splits. Finish import commits the draft; Save for later and closing the modal save review state. The in-modal undo stack is session-local; reopening a saved review still allows reassignment through View sorted. Categories are optional transaction metadata and do not change existing planned-budget records.

- Batches: up to 40 files, with a source account per file and one combined review. Every row retains transaction date, source account ID/name, original file name, and source row/page. Each source is stored separately; batch save/commit/undo validates all revisions and writes atomically. Failed analysis saves no partial batch. History resumes the full batch. Source, suggested budget, and transaction-type filters support bulk sorting.
- CSV: browser-local parsing, explicit column and amount-sign mapping; generic files in a batch must have matching headers. Chase card exports are recognized automatically with expense-negative signs, payment types and categories preserved. Optional Source document, Source row, Suggested budget, Review reason, and Statement net columns support locally reconciled statement conversions without confirming rows. ISO dates or US MM/DD/YYYY; invalid rows fail the import with row errors instead of disappearing.
- PDF (including scans), PNG, JPEG, WebP: authenticated Netlify extraction via OpenAI. Original files are archived privately after the review is created. A failed archive leaves the saved review available for attachment retry without another import. Extracted transaction descriptions, provenance, and upload guidance are persisted in the owner's Firestore account.
- Limits: 4 MB per file, 500 extracted AI rows or 2,000 CSV rows, and 650 KB serialized per source; PDF/image extraction has a transactional 60-attempt/hour owner quota. Large or unclear documents should be split or exported as CSV.
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

## Original statement attachments

Each persisted import is the statement record; transaction `sourceImportId` is its foreign key. A batch is only a UI aggregate. `statementDocuments/{statementId}` stores the original metadata (name, MIME type, SHA-256, byte count and attachment time). An imported CSV can coexist under `{statementId}__import` without blocking attachment of its original PDF. Both reference the same statement and existing transactions.

The authenticated `simpbudget-statement-document` endpoint scopes every request to the verified token owner, checks the parent import exists, bounds and validates files, and never writes transaction/import records. Small originals (maximum 4 MB) are stored as up to eight 512 KiB binary chunks in the same owner's Firestore `statementDocumentChunks` collection; metadata and all chunks commit atomically. This avoids a new storage bucket, public bearer URLs or storage permission changes. Originals remain private under existing owner access, including after undo. Download verifies SHA-256 and size, uses no-store responses, and creates a temporary browser blob URL revoked when closed. This bounded archival approach adds database storage/read costs; larger documents should use a separately reviewed object-storage design.

Open Import history → the existing batch → Statement documents → Attach original statements. Select up to 40 files and verify the explicit per-file statement mapping. Matching names preselect only a unique statement; ambiguous names require selection. Identical retries are idempotent; a different file cannot replace an attached original. View statement is available on each linked transaction and in the document list. Existing budgets, categories, splits, exclusions, statuses, revisions, and totals are untouched. Legacy imports are not reanalyzed.

The selected budget’s Misc Expenses table projects committed monthly statement transactions directly, including signed refunds and only that budget’s share of splits. Cards and source filenames accompany each row; View statement opens the associated original. Imported actuals are explicitly separate from editable planned misc figures and never copied into budget documents. Undoing an import removes its projected rows.

Transaction Details is available from both monthly misc rows and statement review/history. It shows the original amount, selected budget share, split allocations, category, account, original file/page, and a source-document action. Source distinguishes self-reported manual entries, CSV imports, and document extraction. Legacy normalized CSVs retain their documented PDF provenance; merely attaching a PDF does not rewrite the transaction’s source classification.
