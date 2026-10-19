# Athletic Mind snapshot integration

Contract: `athleticmind-snapshot-v2`. Prepared 11 October 2026 for AuntEdna engineering. Production exchange is disabled. This package contains synthetic examples only. The AuntEdna receiving URL and credentials still require verification; a placeholder is never a destination for participant data.

## Scope and acceptance

Each snapshot covers one athlete in one team. The server resolves that team’s organization and requires the organization’s saved `productBrand` to equal `athleticmind`, active organization/team/athlete membership, and matching organization membership. PulseCheck-only organizations are excluded. Mixed membership does not authorize exchange of another team’s records. Missing configuration fails closed.

Eligibility requires the exact new participation document `athleticmind-automated-processing`, version `v1`, its body and other identity fields, an accepted signed decision, and matching athlete-owned consent-event evidence. Old acceptances and display branding cannot authorize this exchange. The existing base participation version remains required. Journal exchange additionally requires the exact server-owned `athleticmind-journal-sharing-v1` entry permission; it does not reinterpret old participation or local sharing settings. Withdrawal or revoked membership blocks later requests and retries.

The purpose is automated support processing by AuntEdna within Athletic Mind. Permission to deliver this package does not authorize disclosure of private concerns to a coach, trainer, parent, or team clinician. Routine human disclosure requires permission for that particular recipient and information. For explicitly configured Athletic Mind programs, PulseCheck sends emergency handoffs to the existing AuntEdna clinical bridge. AuntEdna owns clinical recipient selection, assignment, and after-hours handling. Coaches are outside automatic emergency disclosure. PulseCheck-only programs surface athlete crisis resources without AuntEdna transfer or automatic staff disclosure. Missing configuration preserves those resources and does not select AuntEdna. Displaying crisis resources does not contact a service. This snapshot package remains separate from that emergency handoff.

## Receiver implementation

Receive an HTTPS `POST` at an agreed path under the existing AuntEdna clinical bridge base URL. The proposed path remains a configuration placeholder until verified. The body is the raw snapshot in [snapshot.synthetic.json](examples/snapshot.synthetic.json), validated by [snapshot.schema.json](snapshot.schema.json). Headers are `Content-Type: application/json`, `Authorization: Bearer <agreed bridge credential>`, `Idempotency-Key: <snapshotId>`, and `X-Snapshot-Contract: athleticmind-snapshot-v2`.

Persist each snapshot durably before returning HTTP 2xx and JSON matching [push-ack.synthetic.json](examples/push-ack.synthetic.json): the same `snapshotId`, a nonempty `receiptId`, and `status` equal to `accepted` or `stored`. An accepted acknowledgment must mean durable acceptance, not merely that a request was received. Repeated idempotency keys must yield the same receipt without creating duplicate work. Return an error if the same key arrives with different immutable content. A 2xx response without this receipt does not advance successful delivery state.

## Check your key before snapshot activation

`POST https://fitwithpulse.ai/.netlify/functions/auntedna-snapshot-auth-check` verifies a managed partner key for one approved team. Send only `{ "teamId": "<approved-team-id>" }`. The body limit is 1,024 bytes. This check uses the same `athleticmind.snapshot.read` permission, current program/team eligibility, key expiry/revocation checks, and shared per-key request limit as snapshot pull. It remains available while snapshot exchange is disabled. Legacy environment-registry credentials are unsupported here.

Sign the exact UTF-8 string `<timestamp>.POST./.netlify/functions/auntedna-snapshot-auth-check.<raw JSON body>`. The auth-check path is part of the signature; a signature for the pull endpoint will fail. Keep the JSON bytes unchanged. The timestamp must be within five minutes of server time. The server selects the environment; the request cannot change it.

Server-side Node.js example (supply the issued key ID, secret, and approved team ID through secure environment variables):

```js
const { createHmac } = require('node:crypto');
const path = '/.netlify/functions/auntedna-snapshot-auth-check';
const body = JSON.stringify({ teamId: process.env.APPROVED_TEAM_ID });
const timestamp = Math.floor(Date.now() / 1000);
const digest = createHmac('sha256', process.env.AUNTEDNA_HMAC_SECRET)
  .update(`${timestamp}.POST.${path}.${body}`)
  .digest('hex');
async function checkKey() {
  const response = await fetch(`https://fitwithpulse.ai${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AuntEdna-Key-Id': process.env.AUNTEDNA_KEY_ID,
      'X-AuntEdna-Signature': `t=${timestamp},v1=${digest}`,
    },
    body,
  });
  console.log(response.status, await response.json());
}
checkKey().catch(() => { process.exitCode = 1; });
```

Example successful authentication while pull is disabled:

```json
{
  "authenticated": true,
  "contractVersion": "athleticmind-snapshot-v2",
  "snapshotPullStatus": "snapshot_pull_disabled"
}
```

`authenticated: true` confirms the credential and this team's current partner scope. The response contains no athlete identifiers or content, and the check reads no athlete records. It creates only the normal authentication audit and rate-limit record. It never enables exchange, assembles a snapshot, or advances delivery state.

`snapshotPullStatus` is one of `snapshot_pull_disabled`, `program_snapshot_pull_disabled`, `receiver_verification_required`, `synthetic_fixture_source_unconfigured` (test environment only), or `athlete_eligibility_required`. The last value means deployment and receiver gates passed at check time; every actual pull still separately validates the requested athlete's membership, current consent, and source permissions. This check does not establish athlete eligibility or confirm receiver delivery.

HTTP `400` means invalid body, `401` invalid authentication, `403` missing/currently ineligible program scope, `405` wrong method, `413` oversized body, `429` shared key quota reached, and `503` configuration or service unavailable. A disabled pull can still produce HTTP `200` here because this endpoint checks authentication without releasing athlete data.

## AuntEdna pull endpoint

`POST /.netlify/functions/auntedna-snapshot-pull` accepts [pull-request.synthetic.json](examples/pull-request.synthetic.json). Supply a unique `requestId`, `teamId`, `athleteId`, `windowStart`, and `windowEnd`. Both bounds are explicit UTC ISO 8601 timestamps ending in `Z`; the interval is start-inclusive, end-exclusive, at most seven days, and cannot end in the future. Request one athlete and team per call. The response is `{ "snapshot": <snapshot>, "receipt": { "requestId": "...", "snapshotId": "...", "replayed": false } }`. The receipt describes retrieval, not scheduled push delivery.

Authenticate with `X-AuntEdna-Key-Id` and `X-AuntEdna-Signature: t=<unix seconds>,v1=<lowercase hex HMAC-SHA256>`. Sign the exact UTF-8 string `<timestamp>.POST./.netlify/functions/auntedna-snapshot-pull.<exact raw JSON body>`, including literal periods. Keep JSON bytes unchanged after signing. Signed timestamps must be within five minutes of server time. The request body limit is 8,192 bytes. IDs contain 1–128 ASCII letters, digits, underscores, or hyphens. Use an admin-approved managed key from `/admin/partner-api-keys`. Legacy credentials are accepted only when `ATHLETICMIND_SNAPSHOT_PULL_LEGACY_AUTH_ENABLED=true`; registry `ATHLETICMIND_SNAPSHOT_PULL_CLIENTS_JSON` maps each non-managed key ID to `{secretEnv, organizationId, teamIds, environment}`. `secretEnv` names a secret environment variable; `environment` must exactly match the server environment. Caller-supplied team IDs never widen these scopes.

Retries within 24 hours reuse the same request ID and exact request fields in the same JSON key order with a freshly signed timestamp. Expired request IDs require a new ID. The server rechecks eligibility and source permission before replaying a cached immutable result. Every previously included source revision and the onboarding answers must still be permitted. A changed or removed source returns HTTP 409 with `snapshot_sources_changed_use_new_request_id`; request a newly assembled snapshot with a new request ID. A final journal permission/revision change returns HTTP 409 `journal_sources_changed_use_new_request_id`. A final consent change returns HTTP 403. New additional permitted records do not invalidate an otherwise unchanged replay. Changed parameters with the same request ID must be treated as a conflict. Pull never advances the scheduled push watermark. HTTP 400 means invalid request/window; 401 means invalid authentication; 403 means scope or eligibility failure; 409 means conflicting, in-progress, expired, or consent-changed request; 410 means the cached snapshot expired; 413 means a size limit; 503 means disabled or temporarily unavailable. Responses use `{ "error": "machine_readable_code" }`. A 512 KiB snapshot limit applies; pagination is not implemented. On oversize, narrow the interval. A single source record or onboarding response that remains too large requires operator intervention; narrowing cannot always solve it.

## Daily windows, retries and receipts

Each program configures an explicit IANA `timeZone`, daily local `cutoff` (default `00:00`), and `lookbackHours` (default 48, allowed 0–168). Midnight is program-local. The previous local day can span 23 or 25 hours. For an ambiguous cutoff the first occurrence is selected; for a nonexistent cutoff the first available later local minute is selected. A scheduler invocation after the cutoff is distinct from a guarantee of delivery at the exact minute.

The initial push begins at verified acceptance. Later pushes scan from the prior successful boundary minus lookback to the new cutoff, bounded to seven days and clipped to acceptance. The snapshot’s `window` describes this scan interval, including overlap. Gaps beyond seven days require operator backfill. Snapshot IDs hash canonical snapshot content before `snapshotId` and `generatedAt` are added. `generatedAt` is excluded from identity. A durable outbox preserves the envelope for retries; the receiver must deduplicate both snapshot IDs and `(sourceId, revision)` records across overlapping snapshots and pull/push.

Only a verified live receipt advances `deliveredThrough`. Failed delivery, simulated delivery, and pull leave it unchanged. The bridge timeout defaults to 10 seconds and can be configured from 1 to 30 seconds. Reconciliation must retain failed attempts for retry; the receiver must expect delivery after acknowledgment loss. Large push envelopes over 512 KiB fail closed rather than truncate. The scheduler wakes every 15 minutes and resumes a bounded sweep, with at most 20 work steps and a 45-second work budget per invocation. Empty teams also consume work steps. This is a throughput bound, not a per-snapshot retry cap. Failed records are retried on later sweeps. There is no exponential backoff or terminal attempt cap in v1. Each attempt uses a 120-second lease and preserves the immutable envelope. Retries revalidate the included sources and onboarding answers before sending. A removed, restricted, or changed included source blocks that envelope with `snapshot_sources_changed`; changed consent blocks it with `consent_changed`; the final optional-journal recheck can block it with `journal_sources_changed`. These blocked jobs require operator reconciliation rather than automatically rewriting a previously issued idempotency key. Large programs can take multiple invocations; confirm capacity and alerting before activation.

## Clark Atlanta delivery setup

As of 19 October 2026, CAU Volleyball (`GlKi00GszJxnSnY8eh80`, organization `0mXTn4DUYYL7t2K9AzZP`) is configured for `America/New_York`, with a daily cutoff of `00:00` local time and a 48-hour overlap for late updates. Midnight closes the preceding local calendar day. Daylight-saving time is handled through the IANA timezone; this is not a fixed UTC offset. The scheduler checks every 15 minutes, so the cutoff defines the data window rather than a guaranteed delivery instant. Overlap requires `(sourceId, revision)` deduplication.

Push and pull remain disabled. Activation requires AuntEdna's verified receiver and v2 receipt/withdrawal behavior, the agreed retention/deletion process, and current athlete-owned participation permission for this exchange. Existing program participation alone does not establish the expanded snapshot permission. The separate signed auth-check endpoint can verify the existing production key before those activation steps are complete.

### Dedicated daily-push connection

AuntEdna supplies its receiving HTTPS URL and a dedicated Bearer key through the secure integration channel. Pulse configures the dedicated snapshot destination and credential separately from clinical handoff credentials. A snapshot credential is not an HMAC pull secret, baseline key or documentation password.

All four server-only settings are required when selecting this dedicated connection: `ATHLETICMIND_SNAPSHOT_PUSH_BASE_URL`, `ATHLETICMIND_SNAPSHOT_PUSH_PATH`, `ATHLETICMIND_SNAPSHOT_PUSH_API_KEY`, and `ATHLETICMIND_SNAPSHOT_PUSH_CREDENTIAL_MODE=live`. The base URL and appended path must match the team's verified receiver record exactly. Incomplete dedicated configuration blocks delivery; it never falls back to the clinical handoff key. Existing integrations with no dedicated settings retain their prior clinical-bridge configuration. The global and team activation flags remain separate and stay disabled until verification is complete.

## Snapshot field reference

The [JSON Schema](snapshot.schema.json) defines the exact field types and accepted values. The tables below explain how to use them. Every response represents one athlete and one team. IDs identify records; they are not athlete names. UTC timestamps use ISO 8601 strings ending in `Z`.

| Field | Source and meaning | Units and missing values |
| --- | --- | --- |
| `schemaVersion` | Contract version to validate before processing. | Exact version string. Reject an unsupported version. |
| `synthetic` | Identifies a synthetic example or fixture. | Boolean. Production participant snapshots use `false`. |
| `snapshotId` | SHA-256 hash of canonical snapshot content, excluding `snapshotId` and `generatedAt`. | 64 hexadecimal characters. Use for envelope deduplication. |
| `generatedAt` | Time the server assembled this immutable snapshot. A replay retains the original value. | UTC timestamp. This is not the age of every source record. |
| `scope.organizationId`, `teamId`, `athleteId`, `membershipId` | Current saved program, team, athlete, and matching active athlete membership. | IDs. Caller fields never override the saved organization or membership. |
| `window.start`, `window.end` | Requested scan interval, including any scheduled overlap. | UTC timestamps. Start inclusive, end exclusive. Maximum seven days. |
| `consent.id`, `version` | Exact participation document accepted for automated Athletic Mind processing. | Document identifiers. Earlier or different terms do not satisfy the current requirement. |
| `consent.eventId` | First server-recorded consent event in the current uninterrupted run of the same signed acceptance. | Athlete-owned event ID. Repeated saves of the same acceptance do not move its original boundary. |
| `consent.latestEvidenceEventId` | Latest matching athlete-owned event used to revalidate the current decision. | Event ID. A later withdrawal or changed decision blocks release. |
| `consent.acceptedAt` | Later of the signed decision time and the first matching server-recorded evidence time. | UTC timestamp. Applies to the post-acceptance source boundary. |
| `consent.documentHash` | Hash of the accepted document's exact identity fields and text. | SHA-256 hexadecimal string. |
| `onboarding.sourceId` | Athlete onboarding object on the current team-membership record. | Stable source identifier. |
| `onboarding.formVersion` | Saved intake form version for interpreting question IDs. | String or `null` if unavailable. |
| `onboarding.completedAt` | Saved intake completion time. | UTC timestamp or `null`. |
| `onboarding.responses` | Current saved answer object, preserving question IDs and JSON value types. | Use the program's form dictionary for units and answer choices. An empty object means no answers were available. No historical answer revisions are supplied. |
| `checkIns` | Eligible morning/evening components of the current scoped check-in source. | Array. Each included component is one record. |
| `noraMessages` | Available permitted messages from verified team-scoped Nora sources. | Array of individual messages, never a generated transcript summary. |
| `journalEntries` | Current saved journal versions with matching optional entry permission. | Array. See the separate journal field and permission tables. |
| `journalWithdrawals` | Content-free notices ending a prior entry permission. | Array. Notices may repeat outside the scan window. |
| `supportStatus` | Allowlisted operational status fields from scoped support records. | Array. No clinical notes, handoff packet, or recipient details. |
| `coverage.missing` | Reasons information was excluded or coverage is incomplete. | Array of machine-readable reason codes. Read even when record arrays are nonempty. |
| `coverage.optionalSourcesIncluded` | Optional source categories actually included under their separate permission checks. | Contains `entry_authorized_journals` when journal text is included; otherwise empty. |
| `coverage.completeFullNoraTranscript` | Whether this contract guarantees complete Nora history. | Always `false` in this version. |
| `ingestion.selection` | Source selection uses event time or Firestore document-update time. | Fixed contract value. |
| `ingestion.deduplicationKey` | Record identity for deduplication is `sourceId_and_revision`. | Fixed contract value. |
| `ingestion.requiresRevisionDeduplication` | Repeated source records can appear in overlapping requests and deliveries. | Always `true`. |

### Record identity and time

Every included check-in, Nora message, and support-status record carries the following fields. Optional journal records follow the same source identity rules, with additional entry permission evidence described below.

| Field | Meaning | Receiver rule |
| --- | --- | --- |
| `sourceId` | Stable source path, including the check-in period or message ID when one source document contains multiple records. | Deduplicate by this ID and `revision`; do not treat a new envelope as a new source record. |
| `revision` | SHA-256 of the emitted record content excluding its document-ingestion timestamp. | The same source ID with a new revision represents changed permitted content. |
| `eventAt` | Selected source event time: check-in updated/created time, original Nora message timestamp, or support record activity time. | Preserve it separately from arrival time. |
| `sourceIngestedAt` | Firestore source-document update time. | It is not an immutable per-message ingestion timestamp. A conversation update may re-include unchanged messages. |

For check-ins, ordinary Nora messages, and support status, both source document creation and the selected event must satisfy the base participation acceptance boundary. Explicitly shared older journal entries use the separate permission-time rule below. A source enters the scan when its event time or document-update time falls in the window. Its original event must precede the end boundary, and the source update cannot be in the future. Missing trustworthy server timestamps exclude a record. A later document update can bring a post-acceptance event into a subsequent scan, but the contract does not guarantee recovery of all historical late arrivals.

### Check-in fields

| Field | Meaning | Units and interpretation |
| --- | --- | --- |
| `period` | `morning` or `evening`. | One component of a saved check-in. |
| `dayKey` | Source's calendar-day key. | String or `null`. Use the configured program timezone to interpret a local day. |
| `level` | Source check-in category. | Categorical string; not a clinical risk score. |
| `levelLabel` | Saved display label for `level`, when present. | Text. |
| `subjectiveRecoveryLevel` | Athlete's saved self-report score, when present. | Unitless number. Interpret its range using the source form dictionary; never substitute a device measurement. |
| `subjectiveRecoveryLabel` | Saved label for the self-report recovery choice. | Text, when present. |
| `reflection` | Athlete's available check-in writing. | Full source text, when present. |

Mixed morning/evening records with ambiguous component scope are excluded. A check-in from a different team or an unscoped legacy collection is not added to fill a gap.

### Nora message fields

| Field | Meaning | Interpretation |
| --- | --- | --- |
| `conversationId` | Source conversation identifier. | Groups messages; does not imply a complete conversation was returned. |
| `speaker` | `athlete` or `nora`. | Derived from a recognized source message role. Unknown speakers are excluded. |
| `text` | Full available permitted message text. | Preserve original meaning; no inferred or reconstructed text is supplied. |

Scheduled Nora conversations with verified team scope are supported. Main Nora messages require verified athlete, team, and organization scope. Restricted, revoked, or redacted source content is omitted. `coverage.missing` can therefore describe incomplete Nora coverage even when some messages are present. A shared journal entry and a Nora message are separate source types; receiving one does not establish access to the other.

### Support-status fields

`status`, `incidentStatus`, and `handoffStatus` are optional allowlisted source codes. The schema lists their accepted values. They describe recorded workflow state, not a diagnosis, verified human review, or a guarantee of care. A delivery acknowledgment confirms only the stated receipt stage. Use the separate clinical bridge contract for assignment and case-status updates.

### Deterministic summary fields

| Field | Meaning | Units and missing values |
| --- | --- | --- |
| `summary.method` | `deterministic_counts_only`. | No model-generated narrative, diagnostic inference, or trend classification. |
| `summary.checkInCount` | Included morning/evening check-in records. | Nonnegative integer count. |
| `summary.checkInLevelCounts` | Included record counts keyed by source category. | Map of category to nonnegative integer. |
| `summary.noraMessageCount` | Included athlete and Nora messages. | Nonnegative integer count. |
| `summary.athleteMessageCount` | Included messages whose speaker is `athlete`. | Nonnegative integer count. |
| `summary.supportStatusCount` | Included support-status records. | Nonnegative integer count. |
| `summary.journalEntryCount` | Included permission-authorized journal entries. | Nonnegative integer count. |
| `summary.journalWithdrawalCount` | Included content-free withdrawal notices, including repeated historical notices. | Nonnegative integer count, not newly withdrawn entries in the window. |
| `summary.latestSourceEventAt` | Latest event time across included check-ins, Nora messages, support status, and journal entries. Withdrawal notices do not contribute. | UTC timestamp or `null` when none were included. |
| `summary.sourceAgeAtWindowEndMs` | Window-end time minus the latest included event time. | Milliseconds or `null`. This measures the newest included event, not the freshness of all records. |

Counts describe this returned slice. Overlapping scans and replayed snapshots can contain the same records. Derive longitudinal counts only after deduplication, and retain coverage information alongside any derived result. Empty arrays and zero counts mean no included records in that slice; they do not establish that the athlete had no concern. Omitted optional fields and explicit `null` values mean absent or unavailable according to the schema, never numeric zero.

### Coverage and exclusions

| Coverage reason | Meaning |
| --- | --- |
| `wearables_not_included_permission_unverified` | Wearable/device sources are outside this payload's verified permission adapters. |
| `legacy_mental_checkins_unscoped` | Legacy mental check-ins cannot be safely assigned to this team scope. |
| `source_server_timestamps_missing` | A source lacks trustworthy creation/update or event timestamps. |
| `unscoped_or_other_team_checkins_excluded`, `checkin_component_scope_ambiguous` | Check-in ownership or morning/evening component scope does not match unambiguously. |
| `pulsecheck-nora-conversations_unscoped_or_other_team_excluded`, `conversations_unscoped_or_other_team_excluded` | A scheduled or main Nora source lacks matching scope. |
| `legacy_nora_conversation_provenance_unverified`, `legacy_nora_message_provenance_unverified` | Ordinary main-Nora provenance cannot be verified. The affected legacy conversation is excluded. |
| `journal_derived_nora_conversation_excluded` | Journal-derived conversation content is excluded from ordinary Nora messages. Entry sharing uses its separate permission path. |
| `invalid_nora_message_excluded` | A message lacks an accepted ID, text, or speaker role. |
| `nora_restricted_or_revoked_content_unavailable` | Source content is restricted, revoked, or redacted. |
| `unscoped_or_other_team_support_status_excluded` | A support record is outside the verified athlete/program scope. |
| `journal_permission_missing_or_other_scope`, `journal_permission_timestamp_invalid`, `journal_permission_not_shared` | An optional journal permission is absent, belongs to another scope, lacks valid timing, or is not currently shared. |
| `journal_entry_invalid` | The saved journal's content or timestamps cannot be validated. |
| `onboarding_responses_missing` | Current onboarding answers are unavailable. |
| `no_per_message_ingestion_history`, `full_nora_coverage_not_guaranteed` | The source model cannot guarantee a complete, historically ordered Nora transcript. |

These reasons describe coverage rather than a complete census of private records. The response does not list the IDs or contents of never-shared journal entries. Missing record arrays are not replaced with information from another athlete, team, or source.

## Optional journal sharing

Saved journal entries are private by default. Automated safety screening runs separately from optional Nora sharing and scheduled partner snapshots. A safety check does not give the snapshot API permission to export an unshared journal entry.

The athlete has two separate choices:

- **Personal Nora sharing:** the selected saved entry can be used by Nora under the personal sharing disclosure. This scope has no program/team grant and does not authorize AuntEdna snapshot exchange.
- **Athletic Mind program sharing:** the athlete selects an eligible program and accepts its explicit journal-sharing disclosure. This authorizes Nora use and automated PulseCheck/AuntEdna processing of that exact entry version for that program. Current Athletic Mind participation permission, membership, and partner access must also remain valid.

Sharing one entry does not switch on future sharing. A separately accepted future-entry preference applies only to newly created entries under the selected scope, while its permission and program eligibility remain valid. Earlier entries keep their own choices. Turning the preference off stops automatic sharing of later entries; it does not revoke entries already shared. An older device setting or legacy share flag does not establish this permission.

The server records the exact disclosure version, entry revision, athlete identity, program scope, and acceptance evidence. The additional journal disclosure is `athleticmind-journal-sharing-v1`; the current base automated-processing participation permission remains independently required. Earlier writing may be shared deliberately as a specific entry. Its new accepted sharing time governs entry into the exchange; its original writing time is retained.

### Journal entry fields

`journalEntries` contains only current saved entry text with a valid matching server-held permission. It does not contain every journal entry, journal safety-screening text, photos, food-image contents, device data, or a reconstruction from Nora history.

| Field | Meaning | Units and missing values |
| --- | --- | --- |
| `sourceId` | Stable saved-entry source identifier. | Use with permission event and revision to reconcile received versions. |
| `entryId` | Saved journal entry ID. | String. |
| `type` | Source journal category, such as evidence, gratitude, freewrite, workout, food, or injury. | Legacy missing type normalizes to `evidence`. A category is not a diagnosis or clinical assessment. |
| `moment` | Full permitted entry writing. | String, including an empty string when the original allowed entry has no written content. |
| `action` | Additional saved writing, when present. | String or `null`. Kept separate from `moment`; never generated. |
| `createdAt` | Original entry creation time. | UTC timestamp; it may precede the later explicit sharing decision. |
| `updatedAt` | Current entry content's update time, falling back to its creation time. | UTC timestamp. |
| `eventAt` | Later of the current entry update and accepted sharing time. | UTC timestamp used for the journal scan. |
| `sourceIngestedAt` | Later of the saved entry's Firestore update time and the permission update time. | UTC timestamp; not a per-message ingestion ledger. |
| `sharing.status` | Current entry-specific sharing status. | Always `shared`; withdrawn entries are represented in `journalWithdrawals`. |
| `sharing.permissionVersion` | Exact optional journal-sharing disclosure version. | `athleticmind-journal-sharing-v1`. |
| `sharing.permissionEventId` | Server-recorded permission event authorizing this exact entry revision. | ID. Re-sharing after a withdrawal produces a distinct permission event. |
| `sharing.sharedAt` | Time that entry permission was saved. | UTC timestamp. |
| `revision` | Hash of emitted entry content and its permission information, excluding ingestion time. | SHA-256. A different permission event or permitted content changes the revision. |

The entry's exact revision must match its current permission. Entry text is included when its effective event time, entry document update, or permission update falls in the requested interval, and the effective event precedes the end boundary. Private entries and entries without valid current permission are not read into the response.

### Withdrawal, editing, and deletion

Stopping sharing ends future release of that entry's text. Editing invalidates its previous entry permission; the athlete reviews and shares the updated version separately. Deleting ends future release and removes the source entry. Cached pull responses and frozen scheduled deliveries recheck journal permission and revision before release, so an old envelope cannot bypass a later change.

`journalWithdrawals` carries content-free notices for previously permitted entries. These notices can repeat outside the requested time window so a narrow scan does not silently miss a withdrawal. They contain no journal text.

| Field | Meaning | Receiver action |
| --- | --- | --- |
| `sourceId` | Entry whose prior permission ended. | Locate the received entry version. |
| `permissionEventId` | Exact prior grant being withdrawn. | Apply only to the matching received permission event, not a later re-share. |
| `withdrawnAt` | Server-recorded or verified source-change time of withdrawal. | UTC timestamp. Preserve for reconciliation. |
| `reason` | `unshared`, `entry_deleted`, or `entry_changed`. | Stop using the affected version according to the agreed withdrawal process. |
| `revision` | Hash of the withdrawal notice. | Deduplicate repeated notices. |

A new shared entry and a withdrawal for an older permission event may appear together. Apply the old withdrawal only to that old permission event. Never let it erase a later authorized version solely because `sourceId` matches.

Withdrawal prevents future authorized text releases; it cannot recall bytes already received. AuntEdna must apply the agreed retention, access, withdrawal, and deletion process to previously received records. If a program loses eligibility or access, successful future snapshots may stop entirely, so the API cannot guarantee delivery of a later withdrawal notice. The operational withdrawal channel and reconciliation process remain necessary.

### Nora, safety screening, and people

Asking Nora about a shared entry sends the server's saved permitted text, not replacement writing supplied by the client. Saving the sharing decision and receiving a Nora response are separate steps. If Nora's response fails, the saved sharing decision remains active until changed.

Journal-derived Nora conversations are excluded from `noraMessages`; the entry is exported only through `journalEntries` with its own permission evidence. Untrusted legacy Nora provenance is excluded rather than assumed to be ordinary chat. Current coverage remains partial.

Routine sharing with coaches, trainers, parents, or team clinicians still requires the applicable recipient-specific permission. Urgent safety processing is a separate immediate path, not a daily snapshot workflow: explicitly configured Athletic Mind uses the existing AuntEdna clinical bridge and athlete resources; PulseCheck or missing program configuration retains resources without automatic AuntEdna or staff disclosure. AuntEdna owns clinical recipient selection, assignment, and after-hours handling. Showing resources or recording a safety state does not confirm that a clinician has received or accepted a case.


## Activation prerequisites

Agree and verify the real receiver URL, path, authentication, durable receipt contract, retention/access responsibilities, and clinical disclosure procedures. Pull request IDs expire after 24 hours. Cached payloads expire 24 hours after their latest equivalent successful request, which preserves their original immutable content; Firestore TTL configuration must be deployed for eventual physical deletion. Durable delivery outboxes currently retain their payloads and receipts. An approved payload-redaction retention period and cleanup process are required before live activation, while preserving the metadata needed for idempotency. Expiration of API access alone is not deletion. Verify the approved revised consent flow and athlete-owned evidence before activating terms. Configure each program’s timezone/cutoff, verified recipient, and scoped pull keys. Validate mixed-membership isolation, withdrawal, retry/receipt behavior, and source coverage with synthetic records. Receiver v2 validation and permission-specific withdrawal reconciliation are required for journal exchange. Full main-Nora scope/retention and wearable permission adapters remain separate prerequisites for broader coverage.

Production push requires `ATHLETICMIND_SNAPSHOT_PUSH_ENABLED=true`, program delivery enabled, AuntEdna bridge provider with live credentials, and a verified matching receiver. Production pull requires `ATHLETICMIND_SNAPSHOT_PULL_ENABLED=true`, program `pullEnabled=true`, scoped credentials, and recipient verification. Keep both disabled until these checks are complete. No real athlete data belongs in mock or placeholder transport.


## Disabled configuration example

This illustrative program configuration is stored under the existing team record’s `snapshotDelivery`. It is documentation, not a migration or live configuration change. The `mock://` URI documents a placeholder and is rejected by production HTTP delivery. Local simulation uses an injected synthetic transport with explicitly synthetic scope and payload, without an HTTP request.

```json
{
  "enabled": false,
  "pullEnabled": false,
  "timeZone": "America/New_York",
  "cutoff": "00:00",
  "lookbackHours": 48,
  "receiver": {
    "status": "unverified",
    "baseUrl": "mock://auntedna/snapshots",
    "path": "/snapshots",
    "contractVersion": "athleticmind-snapshot-v2",
    "verifiedAt": null,
    "verifiedBy": null
  }
}
```

Deployment environment example, with no credentials:

```dotenv
ATHLETICMIND_SNAPSHOT_PUSH_ENABLED=false
ATHLETICMIND_SNAPSHOT_PULL_ENABLED=false
ATHLETICMIND_SNAPSHOT_PULL_LEGACY_AUTH_ENABLED=false
ATHLETICMIND_SNAPSHOT_PULL_CLIENTS_JSON={}
ATHLETICMIND_SNAPSHOT_SANDBOX_ENABLED=false
PARTNER_API_ENVIRONMENT=production
# Keep existing clinical bridge configuration intact.
# Set CLINICAL_BRIDGE_SNAPSHOT_PATH only after receiver verification.
```

Provision real push credentials through the existing clinical bridge secret configuration. Configure pull secrets separately with named environment references. Changing a display name never changes integration eligibility.

## Developer documentation

External partner documentation belongs at `/developer/api/athleticmind-snapshots`, with the API catalog at `/developer/api`. Its password-gated guides and downloads do not require a Pulse account. The external curated source is `docs/developer/athleticmind-snapshots`; it excludes internal rollout notes and operational configuration details from this engineering package. System Overview remains the internal handbook. Documentation access grants no snapshot API access. Exchange production API credentials through the agreed secure channel.

## Managed partner keys

Public `/developer/api/request-access` submissions persist pending review; they grant no access and send no email. `/admin/partner-api-keys` requires a verified-email Firebase admin identity and checks token revocation. Approval selects a stable partner identity, `athleticmind.snapshot.read`, test or production environment, expiry, and per-minute quota. Program access can be explicit organization/team grants, including none, or the separately selected All Athletic Mind programs scope. That scope includes future active programs only when their saved organization productBrand is exactly athleticmind. PulseCheck and unconfigured programs remain excluded. Existing single-organization credentials retain their exact restricted scope. Clinical provider bearer credentials remain separate.

Production uses `PULSE_PARTNER_CONFIG_SECRET=pulse-partner-production`, a Google Secret Manager bundle accessed by the existing production Firebase service account. The bundle contains the six server-only partner-key and developer-documentation settings; no secret is embedded in source or browser assets. Runtime loading caches for five minutes and fails closed on refresh errors. Keeping a short reference avoids the Netlify Lambda-compatible 4 KB environment limit. Local fixtures may still supply the six settings directly.

Set server-only `PARTNER_API_KEY_ENCRYPTION_KEYS_JSON` to a version-to-base64 registry of 32-byte AES keys and `PARTNER_API_KEY_ACTIVE_ENCRYPTION_VERSION` to the issuance version. Preserve old encryption versions while their API keys remain valid. Secrets are generated cryptographically, encrypted using AES-256-GCM with the key ID bound as authenticated data, and revealed in the approval/rotation response or through the explicitly configured partner portal. Metadata lists never return plaintext or encrypted secrets. The AuntEdna portal binds a separate password and revocable session to its existing production key. It authorizes each reveal against the current partner identity, key status, expiration, and portal credential version. The shared documentation password cannot authorize a reveal. Deliver the separate portal password through the agreed secure channel; keep it out of documentation and source files.

Administrators can change program access independently of partner identity; changing access revokes any still-valid overlapping predecessor credentials. Each request and retry rechecks the saved team-to-organization relationship and current explicit Athletic Mind eligibility. Rotation preserves scope, environment, quota and original expiry; the old key has an explicit overlap of zero to sixty minutes, bounded by its existing expiry. Revocation and expiry deny requests. Atomic per-key quotas and metadata-only audits cover managed and explicitly enabled legacy access. The server fixes `PARTNER_API_ENVIRONMENT` to `test` or `production`; callers cannot select it.

A separate test environment may enable `ATHLETICMIND_SNAPSHOT_SANDBOX_ENABLED=true` and the pull flag with synthetic organization/team/athlete scope. This supplies deterministic synthetic records without reading athlete source collections. A test key cannot release production records. The local preview uses emulators and an ephemeral encryption registry; restarting that fixture can invalidate its old synthetic keys.

Before deployment, configure the encryption registry and fixed environment, deploy the server-only collection rules and rate-limit TTL configuration, and verify the complete signed-request flow in the intended environment. Production activation still requires the snapshot prerequisites above. No real key, live API activation, or deployment is part of this implementation.
