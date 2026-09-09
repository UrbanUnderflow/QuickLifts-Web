# CAU direct auntEDNA integration

Supersedes the temporary combined-store design. The combined POST endpoint is retired with 503 and no write. The web preview disables Submit pending the real questionnaire integration contract.

The current routing proposal follows the web grouping: 31 auntEDNA-designated fields, 30 PulseCheck/setup fields. This is not a legal HIPAA determination. The source's privacy/data-sharing schedule still requires review for sleep, recovery, readiness, and identifying metadata. Do not infer permission from screen headings.

`splitSubmission` produces disjoint payloads. auntEDNA receives its answer values. PulseCheck receives only its own answer values and per-question references. `attachAuntEdnaReceipt` binds the mirror to an external record ID and receipt ID. Source version and question ID identify what was asked. No auntEDNA values, answer hashes, summaries or scores are retained in the mirror. Identifiers and mirrors remain access-restricted.

These functions are model helpers, not a connected integration. No questionnaire endpoint/authentication/receipt-verification contract was found. The existing clinical-bridge and clinical-callback implement escalation/status workflows, not questionnaire intake. The preferred final transport is browser to auntEDNA, followed by an authenticated receipt to PulseCheck; a receipt received from the browser alone must not authorize a completed status. Implement idempotency and retry handling with auntEDNA before activation. Do not stage raw responses in PulseCheck logs, queues, request archives or Firestore.

Existing combined records were not deleted or migrated. They remain under the restricted server-only rules. Their remediation needs a verified auntEDNA destination; do not assume old backups or deploy artifacts are automatically removed.

Tests verify routing counts, no clinical-value sentinel in the PulseCheck payload, reference construction, and mismatched receipt rejection. No live end-to-end auntEDNA test is possible until the receiving contract is supplied.
