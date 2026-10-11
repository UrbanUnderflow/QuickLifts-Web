# Athletic Mind snapshots

Exchange a scoped athlete snapshot through scheduled delivery or an authenticated request. Version `athleticmind-snapshot-v1` covers one athlete and team per snapshot. Access is available to configured partners; a documentation password does not grant API access. All examples in this guide are synthetic.

## Overview

Snapshots include current onboarding answers, eligible check-ins, permitted Nora messages, limited support-status codes, and deterministic counts. Exchange requires an active Athletic Mind program, matching athlete membership, and current participation permission. PulseCheck-only programs are excluded. Each response reports its source coverage; the current contract does not guarantee complete Nora history. Wearable and private-journal data are excluded from this version.

## Request access and manage credentials

Submit an API access request from the developer catalog. A request records your organization, contact, and intended use for administrator review; it does not grant API access or send an automatic approval email. Documentation access is separate.

An administrator approves the saved organization, permitted teams, `athleticmind.snapshot.read` scope, environment, expiration, and request limit. Partners cannot select their own effective scopes. The issued key ID and HMAC secret are shown once to the approving administrator for secure delivery through the agreed channel. The secret cannot be retrieved later; rotate the key if it is lost. Key listings contain metadata only.

Test and production credentials are separate. Test credentials are restricted to synthetic organizations, teams, and athletes in the configured sandbox. They cannot read production athlete data. Use the base URL supplied for the key's environment; a request cannot switch environments through headers or body fields.

Keys expire at their approved time. Revocation blocks later authentication and is checked again before a snapshot is released. Rotation issues a new key ID and secret with the same scopes and remaining expiration. The administrator chooses an overlap of zero to 60 minutes for the old key, bounded by its existing expiration. After that window the old key is rejected. Move callers to the new key during the overlap. If a key is compromised, revoke it rather than retaining an overlap.

Per-key request limits are enforced atomically. HTTP `429` indicates the request limit was reached. Lifecycle and authentication audits contain identifiers and operational metadata, without secrets or athlete payloads. Production secrets are encrypted at rest for HMAC verification and are never returned by listing APIs.

## Authentication

Pull requests use a partner-specific key ID and a separately provisioned HMAC secret. Send `X-AuntEdna-Key-Id` and `X-AuntEdna-Signature: t=<unix seconds>,v1=<hex digest>`.

Calculate HMAC-SHA256 over the exact UTF-8 string `<timestamp>.POST./.netlify/functions/auntedna-snapshot-pull.<raw JSON body>`. Preserve JSON bytes after signing. The timestamp must be within five minutes of server time. Keys are limited to agreed organizations and teams. Never embed production secrets in client-side code or documentation links.

Scheduled deliveries use `Authorization: Bearer <partner credential>`, `Idempotency-Key: <snapshotId>`, and `X-Snapshot-Contract: athleticmind-snapshot-v1`.

## Request a snapshot

`POST https://fitwithpulse.ai/.netlify/functions/auntedna-snapshot-pull`

Send a unique `requestId`, `teamId`, `athleteId`, `windowStart`, and `windowEnd`. IDs use 1–128 ASCII letters, numbers, underscores, or hyphens. Window bounds are UTC ISO 8601 timestamps ending in `Z`; the start is inclusive and the end is exclusive. The window must be positive, no longer than seven days, and cannot end in the future. The request-body limit is 8,192 bytes.

See [request example](examples/pull-request.synthetic.json) and [response example](examples/pull-response.synthetic.json). The response contains `snapshot` and `receipt`. A retrieval receipt does not represent scheduled delivery or clinical acceptance.

## Receive a scheduled snapshot

The delivery destination is the HTTPS endpoint agreed during partner setup. PulseCheck posts the snapshot body shown in the [snapshot example](examples/snapshot.synthetic.json). Validate against the [JSON Schema](snapshot.schema.json).

Persist the snapshot before acknowledging with HTTP 2xx and a JSON body containing the same `snapshotId`, a nonempty `receiptId`, and `status` of `accepted` or `stored`. See the [receipt example](examples/push-ack.synthetic.json). A repeated idempotency key must return the same receipt without duplicate processing. A successful HTTP status without a valid receipt does not confirm delivery.

## Payload fields

`scope` identifies the organization, team, athlete, and membership. `window` describes the returned scan interval. `consent` identifies the participation evidence governing this exchange. `onboarding.responses` preserves the source form's question IDs and JSON value types; use `formVersion` and the agreed form dictionary to interpret answers.

`checkIns` contains categorical source values and optional reflection. `noraMessages` contains the full available permitted text for each included message, grouped by `conversationId`. `supportStatus` contains operational codes only. Missing optional fields mean absent or unavailable, never zero.

`summary.method` is `deterministic_counts_only`. Counts describe this slice, which may overlap earlier snapshots. They are not clinical conclusions or unique daily totals. `coverage.missing` explains exclusions. `completeFullNoraTranscript` is false in this version. Do not treat an empty array as evidence that no concern exists.

## Windows, late data, and retries

Daily windows use the program's agreed IANA timezone and local cutoff. Daylight-saving transitions can create 23- or 25-hour days. The scan can overlap previous windows to capture late updates. Deduplicate each record using `(sourceId, revision)` and each envelope using `snapshotId`. `sourceIngestedAt` is a source-document update time, not a per-message ingestion timestamp.

Scheduled retries preserve their original envelope. Removed or changed included sources block that envelope and require reconciliation; no obsolete content is resent. Only a valid receiver receipt advances successful delivery state. Pull requests never advance scheduled delivery state.

For a pull retry within 24 hours, reuse the request ID and exact body with a freshly signed timestamp. The server rechecks eligibility and source permission before replay. New additional records do not invalidate an otherwise unchanged replay. Changed or removed included records require a new request ID. Reusing an expired request ID returns a conflict. Active equivalent cached responses preserve their original content and `generatedAt`.

Responses are limited to 512 KiB; pagination is unavailable. Narrow the requested window for an oversized response. An individually oversized source requires partner support rather than truncation.

## Errors

Errors use `{ "error": "machine_readable_code" }`.

- `400`: invalid request or time window.
- `401`: missing, expired, or invalid request authentication.
- `403`: scope, current permission, or cached-payload validation failure.
- `409`: reused request conflict, in-progress request, expired request ID, or changed source/permission. `snapshot_sources_changed_use_new_request_id` requires a new request ID.
- `410`: cached snapshot expired; request a fresh snapshot with a new ID.
- `413`: request or response size limit exceeded.
- `429`: per-key request limit exceeded; wait before retrying.
- `503`: exchange unavailable for this integration. Retry only according to the agreed support process.

## Versioning and responsibilities

Check `schemaVersion` before processing. Reject unsupported versions rather than guessing field meanings. `snapshotId` hashes canonical content with `snapshotId` and `generatedAt` excluded. Schema and examples describe the same version.

Automated exchange does not authorize disclosure to coaches, trainers, parents, or team clinicians. Human disclosure requires the applicable recipient-specific permission. Athletic Mind emergency handoffs use the separate clinical bridge contract; AuntEdna owns clinical assignment and after-hours handling. Follow the agreed data-use, retention, and deletion responsibilities for all received information.
