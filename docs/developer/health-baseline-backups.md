# Private health-baseline backups

October 27, 2026. The user explicitly authorized a private Pulse backup of the health answers, an admin tracking page, and removal of the Pulse answer copy after AuntEdna confirms receipt. This supersedes the earlier instruction to keep all 19 protected answers out of Pulse storage. It does not authorize coach access, model training, research use, or guessed provider routing.

## Athlete behavior

Both baseline sections must be finished before submission. The review page names unfinished sections and sends no request until those are complete. An explicit health-sharing decline or disabled health section remains valid; this change never creates health authorization.

For an athlete with current health authorization, submission atomically stores a private health backup and the non-clinical completion record. An unavailable external connection no longer prevents saving. The athlete sees “Saved privately in Pulse.” AuntEdna receipt is stated only after the server validates a matching provider receipt. Provider delivery, baseline completion, staff alerting and clinical care remain different outcomes.

The former “Your program’s health connection is not ready” status card and client-side provider-readiness blocker are removed. Database failures still return a retryable save error; no success is shown for an uncommitted backup.

## Storage and access

Backups have kind `health_backup` in the existing `pulsecheck-restricted-questionnaire-submissions` collection. The deterministic ID binds the authenticated athlete and immutable submission identity. Protected answers live only in the server-owned backup payload. Performance mirrors contain a backup reference and delivery state, never the health values or answer hashes. The provider payload still excludes the performance goal and eight experience ratings.

The existing deployed Firestore rules deny direct browser/client reads and writes to this collection, including admin browser sessions. New management APIs require verified-email Firebase admin identity, current administrator authorization and account availability. They return metadata only, never the answers. No new client rules or index grants are required.

Metadata and receipt history remain after answer cleanup. Existing account-closure policy retains clinical records/backups for documented disposition; the new records retain externalId for that review, and closure blocks future transmission. This feature does not claim automatic clinical-backup erasure on account closure.

## Admin management

Page: `/admin/pulsecheckBaselineBackups`, linked from admin home and provisioning.

API: `/api/admin/pulsecheck/baseline-backups`.

- GET supports bounded `limit` and document-ID `cursor` pagination. Counts/search describe loaded records, not global totals.
- POST `{action:"retry",backupId}` attempts delivery or receipt reconciliation using the original immutable payload and idempotency identity. Current membership, sharing authorization, closure state and approved destination are rechecked. An active lease fences concurrent attempts; expired leases can be recovered.
- POST `{action:"delete",backupId}` removes the private answer payload only after a valid, matching AuntEdna receipt is already stored and no attempt is active. A browser cannot supply a receipt or manually mark a record verified. Receipt/audit metadata remains.

AuntEdna athlete IDs differ from Pulse UIDs. Matching uses the documented externalId and submissionId; the UI never treats these different identity systems as interchangeable.

## Current live connection findings

On October 27, both `https://partner-api.auntedna.ai/partner/health` and the existing clinical-bridge alias `https://partner-api.manasinsights.me/partner/health` returned HTTP 200 with status `ok`. The documented baseline resource responded to GET with HTTP 405, consistent with its POST-only contract. These checks establish service reachability, not authenticated baseline acceptance.

Production Netlify function configuration had no `AUNTEDNA_*` or `CLINICAL_BRIDGE_*` sending credential. The UMES organization had neither `universityCode` nor `auntEdnaBaselineConnection`. No corresponding clinical secret was found in the production Secret Manager metadata. No real or synthetic clinical POST was sent to AuntEdna for this verification.

The existing AuntEdna partner portal manages the separate credential AuntEdna uses to access Pulse. That incoming credential is not an AuntEdna-issued sending key. Do not reuse it as an outbound bearer credential.

To enable actual delivery, obtain the AuntEdna-issued live sending key and provider-approved university code/team scope. Configure the server-owned organization connection described in `auntedna/README.md`, then retry a retained backup through the authorized admin workflow. Never infer a provider destination from an institution name or another university’s setup.

## Validation boundaries

Local tests cover atomic backup/completion, private-field isolation, real Firestore client denial, current consent and membership, closure, pinned route/rejoin changes, immutable retry identity, receipt mismatches, expired/concurrent attempts, cleanup and paging. API tests cover non-admin/unverified/revoked/wrong-UID actors and browser-forged verification data. Browser tests cover incomplete sections, private-save versus provider-confirmation wording, metadata-only dashboard rendering, retries, deletion confirmation/conflicts, paging and mobile layout.

Provider acceptance and subsequent clinical handling are not established by these local tests. Hosted publication receipts and live read-only checks are recorded in the task validation report. No live health answers or consent decisions were created or removed by the agent.

## Published verification receipt

Netlify production deploy `6ae0988919ef8a4792992f3a` was published on October 27 at 12:43:21 UTC from runtime commit `e8d6e128780ae58fc610346aefd9f09f7e6eceea`. Its ready/locked identity was read back. Later documentation commits do not change this runtime.

The live admin page returned HTTP 200. Anonymous and invalid-token admin requests returned 401. A read authenticated as the existing verified operator returned 200 with an empty, metadata-only backup list; no test account or backup was created. The live public coach-registration API remained closed with 503, and anonymous athlete-baseline access remained protected with 401. The served baseline bundle contains the private-save wording and incomplete-section guard, with the old setup-status card absent.

Checks for this change: 12 Firestore emulator scenarios, 50 unit/API cases, 25 deployment-bridge regressions, 14 real-component baseline browser scenarios and the backup-dashboard browser workflow passed. TypeScript, scoped ESLint and diff checks passed. Browser tests used synthetic data and blocked external traffic. Both branded native apps had already passed build/unit/login checks and successful physical iPhone APNs/token persistence before this shared web rollout.
