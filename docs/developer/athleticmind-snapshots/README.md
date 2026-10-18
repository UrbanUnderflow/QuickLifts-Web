# Athletic Mind snapshots

Exchange a scoped athlete snapshot through scheduled delivery or an authenticated request. Version `athleticmind-snapshot-v2` covers one athlete and team per snapshot. Access is available to configured partners; a documentation password does not grant API access. All examples in this guide are synthetic.

## Overview

Snapshots include current onboarding answers, eligible check-ins, permitted Nora messages, limited support-status codes, separately authorized journal entries, and deterministic counts. Exchange requires an active Athletic Mind program, matching athlete membership, and current participation permission. PulseCheck programs and programs without an explicit Athletic Mind configuration are excluded. Each response reports its source coverage; the current contract does not guarantee complete Nora history. Wearable data and unshared journal entries are excluded. Optional entry-authorized journals use the separate permission rules below.

Version 2 adds entry-authorized journals and content-free withdrawal notices. Receivers must validate the v2 schema and support permission-specific withdrawal handling before enabling v2 exchange. Version 1 does not authorize these journal fields.

## Request access and manage credentials

Submit an API access request from the developer catalog. A request records your organization, contact, and intended use for administrator review; it does not grant API access or send an automatic approval email. Documentation access is separate.

A credential belongs to the partner, independently of any one program. An administrator confirms the partner identity, `athleticmind.snapshot.read` permission, environment, expiration, request limit, and program-access mode. Partners cannot approve their own access.

With **All Athletic Mind programs** access, the same credential covers current and future active programs explicitly configured as Athletic Mind. Each request checks the current saved program and team configuration. PulseCheck programs and programs with missing or different brand configuration remain excluded; changing a program away from Athletic Mind removes its eligibility. This access mode does not require an existing Athletic Mind program at the time the credential is issued.

Alternatively, the administrator can approve specific saved program and team grants. A credential with an empty explicit-grants list has no athlete data access. Administrators can later add or remove grants or change the access mode without issuing a new credential. Existing restricted credentials retain their saved access until explicitly changed. Every snapshot still requires current athlete membership, eligibility, and the applicable consent; a broad partner scope never replaces those checks. The issued key ID and HMAC secret are shown once to the approving administrator. AuntEdna also has a dedicated partner portal at `/developer/api/partner/auntedna`, where its separately provisioned password opens a masked **Secret key** card. Reveal and Copy require an active partner session and server authorization for that exact key. The shared documentation password grants documentation access only. Key listings contain metadata only. Rotate a compromised key.

Test and production credentials are separate. Test credentials are restricted to synthetic organizations, teams, and athletes in the configured sandbox. They cannot read production athlete data. Use the base URL supplied for the key's environment; a request cannot switch environments through headers or body fields.

Keys expire at their approved time. Revocation blocks later authentication and is checked again before a snapshot is released. Rotation issues a new key ID and secret with the same scopes and remaining expiration. An administrator or an authenticated AuntEdna partner can rotate the credential. In the partner portal, choose Rotate key, select an overlap of zero to 60 minutes, and confirm. The overlap is bounded by the existing expiration. Partner rotation keeps the portal password and access grants, updates the portal to the replacement Key ID, and signs out other portal sessions. Copy both the new Key ID and secret into the integration. After that window the old key is rejected. Move callers to the new key during the overlap. If a key is compromised, revoke it rather than retaining an overlap.

Per-key request limits are enforced atomically. HTTP `429` indicates the request limit was reached. Lifecycle and authentication audits contain identifiers and operational metadata, without secrets or athlete payloads. Production secrets are encrypted at rest for HMAC verification and are never returned by listing APIs.

## Authentication

Pull requests use a partner-specific key ID and a separately provisioned HMAC secret. Send `X-AuntEdna-Key-Id` and `X-AuntEdna-Signature: t=<unix seconds>,v1=<hex digest>`.

Calculate HMAC-SHA256 over the exact UTF-8 string `<timestamp>.POST./.netlify/functions/auntedna-snapshot-pull.<raw JSON body>`. Preserve JSON bytes after signing. The timestamp must be within five minutes of server time. Keys are limited to their approved program-access mode and current eligibility checks. Never embed production secrets in client-side code or documentation links.

Scheduled deliveries use `Authorization: Bearer <partner credential>`, `Idempotency-Key: <snapshotId>`, and `X-Snapshot-Contract: athleticmind-snapshot-v2`.

## Request a snapshot

`POST https://fitwithpulse.ai/.netlify/functions/auntedna-snapshot-pull`

Send a unique `requestId`, `teamId`, `athleteId`, `windowStart`, and `windowEnd`. IDs use 1–128 ASCII letters, numbers, underscores, or hyphens. Window bounds are UTC ISO 8601 timestamps ending in `Z`; the start is inclusive and the end is exclusive. The window must be positive, no longer than seven days, and cannot end in the future. The request-body limit is 8,192 bytes.

See [request example](examples/pull-request.synthetic.json) and [response example](examples/pull-response.synthetic.json). The response contains `snapshot` and `receipt`. A retrieval receipt does not represent scheduled delivery or clinical acceptance.

## Receive a scheduled snapshot

The delivery destination is the HTTPS endpoint agreed during partner setup. PulseCheck posts the snapshot body shown in the [snapshot example](examples/snapshot.synthetic.json). Validate against the [JSON Schema](snapshot.schema.json).

Persist the snapshot before acknowledging with HTTP 2xx and a JSON body containing the same `snapshotId`, a nonempty `receiptId`, and `status` of `accepted` or `stored`. See the [receipt example](examples/push-ack.synthetic.json). A repeated idempotency key must return the same receipt without duplicate processing. A successful HTTP status without a valid receipt does not confirm delivery.

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

## Windows, late data, and retries

Daily windows use the program's agreed IANA timezone and local cutoff. Daylight-saving transitions can create 23- or 25-hour days. The scan can overlap previous windows to capture late updates. Deduplicate each record using `(sourceId, revision)` and each envelope using `snapshotId`. `sourceIngestedAt` is a source-document update time, not a per-message ingestion timestamp.

Scheduled retries preserve their original envelope. Removed or changed included sources block that envelope and require reconciliation; no obsolete content is resent. Only a valid receiver receipt advances successful delivery state. Pull requests never advance scheduled delivery state.

For a pull retry within 24 hours, reuse the request ID and exact body with a freshly signed timestamp. The server rechecks eligibility and source permission before replay. New additional records do not invalidate an otherwise unchanged replay. Changed or removed included records require a new request ID. A final journal permission/revision failure returns `journal_sources_changed_use_new_request_id` (HTTP 409); a frozen source mismatch can return `snapshot_sources_changed_use_new_request_id`. Reusing an expired request ID returns a conflict. Active equivalent cached responses preserve their original content and `generatedAt`.

Responses are limited to 512 KiB; pagination is unavailable. Narrow the requested window for an oversized response. An individually oversized source requires partner support rather than truncation.

## Errors

Errors use `{ "error": "machine_readable_code" }`.

- `400`: invalid request or time window.
- `401`: missing, expired, or invalid request authentication.
- `403`: scope, current permission, or cached-payload validation failure.
- `409`: reused request conflict, in-progress request, expired request ID, or changed source/permission. `snapshot_sources_changed_use_new_request_id` and `journal_sources_changed_use_new_request_id` require a new request ID.
- `410`: cached snapshot expired; request a fresh snapshot with a new ID.
- `413`: request or response size limit exceeded.
- `429`: per-key request limit exceeded; wait before retrying.
- `503`: exchange unavailable for this integration. Retry only according to the agreed support process.

## Versioning and responsibilities

Check `schemaVersion` before processing. Reject unsupported versions rather than guessing field meanings. `snapshotId` hashes canonical content with `snapshotId` and `generatedAt` excluded. Schema and examples describe the same version.

Automated exchange does not authorize disclosure to coaches, trainers, parents, or team clinicians. Human disclosure requires the applicable recipient-specific permission. Athletic Mind emergency handoffs use the separate clinical bridge contract; AuntEdna owns clinical assignment and after-hours handling. Follow the agreed data-use, retention, and deletion responsibilities for all received information.
