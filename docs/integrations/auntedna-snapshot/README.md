# Athletic Mind snapshot integration

Contract: `athleticmind-snapshot-v1`. Prepared 11 October 2026 for AuntEdna engineering. Production exchange is disabled. This package contains synthetic examples only. The AuntEdna receiving URL and credentials still require verification; a placeholder is never a destination for participant data.

## Scope and acceptance

Each snapshot covers one athlete in one team. The server resolves that team’s organization and requires the organization’s saved `productBrand` to equal `athleticmind`, active organization/team/athlete membership, and matching organization membership. PulseCheck-only organizations are excluded. Mixed membership does not authorize exchange of another team’s records. Missing configuration fails closed.

Eligibility requires the exact new participation document `athleticmind-automated-processing`, version `v1`, its body and other identity fields, an accepted signed decision, and matching athlete-owned consent-event evidence. Old acceptances and display branding cannot authorize this exchange. The revised document is prepared but inactive pending activation prerequisites. Withdrawal or revoked membership blocks later requests and retries.

The purpose is automated support processing by AuntEdna within Athletic Mind. Permission to deliver this package does not authorize disclosure of private concerns to a coach, trainer, parent, or team clinician. Routine human disclosure requires permission for that particular recipient and information. For explicitly configured Athletic Mind programs, PulseCheck sends emergency handoffs to the existing AuntEdna clinical bridge. AuntEdna owns clinical recipient selection, assignment, and after-hours handling. Coaches are outside automatic emergency disclosure. PulseCheck-only programs surface athlete crisis resources without AuntEdna transfer or automatic staff disclosure. Missing configuration preserves those resources and does not select AuntEdna. Displaying crisis resources does not contact a service. This snapshot package remains separate from that emergency handoff.

## Receiver implementation

Receive an HTTPS `POST` at an agreed path under the existing AuntEdna clinical bridge base URL. The proposed path remains a configuration placeholder until verified. The body is the raw snapshot in [snapshot.synthetic.json](examples/snapshot.synthetic.json), validated by [snapshot.schema.json](snapshot.schema.json). Headers are `Content-Type: application/json`, `Authorization: Bearer <agreed bridge credential>`, `Idempotency-Key: <snapshotId>`, and `X-Snapshot-Contract: athleticmind-snapshot-v1`.

Persist each snapshot durably before returning HTTP 2xx and JSON matching [push-ack.synthetic.json](examples/push-ack.synthetic.json): the same `snapshotId`, a nonempty `receiptId`, and `status` equal to `accepted` or `stored`. An accepted acknowledgment must mean durable acceptance, not merely that a request was received. Repeated idempotency keys must yield the same receipt without creating duplicate work. Return an error if the same key arrives with different immutable content. A 2xx response without this receipt does not advance successful delivery state.

## AuntEdna pull endpoint

`POST /.netlify/functions/auntedna-snapshot-pull` accepts [pull-request.synthetic.json](examples/pull-request.synthetic.json). Supply a unique `requestId`, `teamId`, `athleteId`, `windowStart`, and `windowEnd`. Both bounds are explicit UTC ISO 8601 timestamps ending in `Z`; the interval is start-inclusive, end-exclusive, at most seven days, and cannot end in the future. Request one athlete and team per call. The response is `{ "snapshot": <snapshot>, "receipt": { "requestId": "...", "snapshotId": "...", "replayed": false } }`. The receipt describes retrieval, not scheduled push delivery.

Authenticate with `X-AuntEdna-Key-Id` and `X-AuntEdna-Signature: t=<unix seconds>,v1=<lowercase hex HMAC-SHA256>`. Sign the exact UTF-8 string `<timestamp>.POST./.netlify/functions/auntedna-snapshot-pull.<exact raw JSON body>`, including literal periods. Keep JSON bytes unchanged after signing. Signed timestamps must be within five minutes of server time. The request body limit is 8,192 bytes. IDs contain 1–128 ASCII letters, digits, underscores, or hyphens. Use an admin-approved managed key from `/admin/partner-api-keys`. Legacy credentials are accepted only when `ATHLETICMIND_SNAPSHOT_PULL_LEGACY_AUTH_ENABLED=true`; registry `ATHLETICMIND_SNAPSHOT_PULL_CLIENTS_JSON` maps each non-managed key ID to `{secretEnv, organizationId, teamIds, environment}`. `secretEnv` names a secret environment variable; `environment` must exactly match the server environment. Caller-supplied team IDs never widen these scopes.

Retries within 24 hours reuse the same request ID and exact request fields in the same JSON key order with a freshly signed timestamp. Expired request IDs require a new ID. The server rechecks eligibility and source permission before replaying a cached immutable result. Every previously included source revision and the onboarding answers must still be permitted. A changed or removed source returns HTTP 409 with `snapshot_sources_changed_use_new_request_id`; request a newly assembled snapshot with a new request ID. A final consent change returns HTTP 403. New additional permitted records do not invalidate an otherwise unchanged replay. Changed parameters with the same request ID must be treated as a conflict. Pull never advances the scheduled push watermark. HTTP 400 means invalid request/window; 401 means invalid authentication; 403 means scope or eligibility failure; 409 means conflicting, in-progress, expired, or consent-changed request; 410 means the cached snapshot expired; 413 means a size limit; 503 means disabled or temporarily unavailable. Responses use `{ "error": "machine_readable_code" }`. A 512 KiB snapshot limit applies; pagination is not implemented. On oversize, narrow the interval. A single source record or onboarding response that remains too large requires operator intervention; narrowing cannot always solve it.

## Daily windows, retries and receipts

Each program configures an explicit IANA `timeZone`, daily local `cutoff` (default `00:00`), and `lookbackHours` (default 48, allowed 0–168). Midnight is program-local. The previous local day can span 23 or 25 hours. For an ambiguous cutoff the first occurrence is selected; for a nonexistent cutoff the first available later local minute is selected. A scheduler invocation after the cutoff is distinct from a guarantee of delivery at the exact minute.

The initial push begins at verified acceptance. Later pushes scan from the prior successful boundary minus lookback to the new cutoff, bounded to seven days and clipped to acceptance. The snapshot’s `window` describes this scan interval, including overlap. Gaps beyond seven days require operator backfill. Snapshot IDs hash canonical snapshot content before `snapshotId` and `generatedAt` are added. `generatedAt` is excluded from identity. A durable outbox preserves the envelope for retries; the receiver must deduplicate both snapshot IDs and `(sourceId, revision)` records across overlapping snapshots and pull/push.

Only a verified live receipt advances `deliveredThrough`. Failed delivery, simulated delivery, and pull leave it unchanged. The bridge timeout defaults to 10 seconds and can be configured from 1 to 30 seconds. Reconciliation must retain failed attempts for retry; the receiver must expect delivery after acknowledgment loss. Large push envelopes over 512 KiB fail closed rather than truncate. The scheduler wakes every 15 minutes and resumes a bounded sweep, with at most 20 work steps and a 45-second work budget per invocation. Empty teams also consume work steps. This is a throughput bound, not a per-snapshot retry cap. Failed records are retried on later sweeps. There is no exponential backoff or terminal attempt cap in v1. Each attempt uses a 120-second lease and preserves the immutable envelope. Retries revalidate the included sources and onboarding answers before sending. A removed, restricted, or changed included source blocks that envelope with `snapshot_sources_changed`; changed consent blocks it with `consent_changed`. These blocked jobs require operator reconciliation rather than automatically rewriting a previously issued idempotency key. Large programs can take multiple invocations; confirm capacity and alerting before activation.

## Field and coverage semantics

All timestamps are UTC ISO 8601. `eventAt` is the selected source event time: Nora’s original message timestamp, check-in updated/created time, or support status activity time. `sourceIngestedAt` is the Firestore document update time, not a per-message ingestion timestamp. Both source document creation and selected event must follow acceptance. Records enter the window by event time **or** document update time. Late messages with an older original timestamp can arrive through a later document update, provided the original event is after acceptance. A document update can reemit older messages with new revisions; deduplicate revisions while retaining stable source identity. There is no immutable per-message ingestion ledger or guarantee of complete historical recovery.

`sourceId` identifies the source path and message/check-in period; `conversationId` groups Nora messages. `speaker` is `athlete` or `nora`. `text` carries full available permitted message text, not a generated summary. Team-scoped scheduled Nora is supported. Main Nora records lacking verified team/organization scope and restricted/redacted content are excluded. `completeFullNoraTranscript` is always false in v1; consumers must read `coverage.missing` and must never interpret this package as the athlete’s complete Nora history.

Current onboarding answers are a snapshot, not historical answer revisions. `responses` retains the form’s question IDs and original JSON value types; interpret them using `formVersion` and the agreed form dictionary. Unknown keys remain uninterpreted. `completedAt: null` means unavailable. Check-in `level` and labels are categorical source values; `subjectiveRecoveryLevel`, when present, is a unitless source score, not a validated clinical scale. Its range/meaning require the program form dictionary. Reflection is free text. Omitted optional fields mean unavailable or absent, never zero.

`summary.method` is `deterministic_counts_only`: counts describe the returned, potentially overlapping slice, not unique daily totals or clinical conclusions. `checkInLevelCounts` maps source category to count. `latestSourceEventAt` is the latest included check-in/message/status time. `sourceAgeAtWindowEndMs` is elapsed milliseconds from that event to the end boundary, or null when none exist. No model-generated narrative, diagnostic inference, or longitudinal trend is supplied. Consumers can derive trends only after deduplication and with coverage limits acknowledged.

`supportStatus` contains only permitted status codes, not clinical notes or private handoff packets. Empty arrays mean no included records for the slice; coverage reasons explain exclusions. Wearable, recovery-device, and private-journal sources are excluded until explicit permission adapters are implemented and verified. `optionalSourcesIncluded` is empty. A zero count is a count of returned records, never proof that no concern exists.

## Activation prerequisites

Agree and verify the real receiver URL, path, authentication, durable receipt contract, retention/access responsibilities, and clinical disclosure procedures. Pull request IDs expire after 24 hours. Cached payloads expire 24 hours after their latest equivalent successful request, which preserves their original immutable content; Firestore TTL configuration must be deployed for eventual physical deletion. Durable delivery outboxes currently retain their payloads and receipts. An approved payload-redaction retention period and cleanup process are required before live activation, while preserving the metadata needed for idempotency. Expiration of API access alone is not deletion. Verify the approved revised consent flow and athlete-owned evidence before activating terms. Configure each program’s timezone/cutoff, verified recipient, and scoped pull keys. Validate mixed-membership isolation, withdrawal, retry/receipt behavior, and source coverage with synthetic records. Full main-Nora scope/retention and optional-source permission adapters remain separate prerequisites for broader coverage.

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
    "contractVersion": "athleticmind-snapshot-v1",
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
