# Optional AuntEdna athlete baseline integration

AuntEdna delivery is deferred for the current rollout. Programs may configure their own designated clinical staff in provisioning. Staff alerts are a separate workflow and do not contain baseline answers. Do not activate a provider or infer a clinic from an institution name, product brand or key prefix.

## Current starting profile

Content version: `athlete-starting-point-v2`. Native gate transport version: `cau-operational-web-v1`. Ownership revision: `cau-routing-v3`.

The approved baseline contains 28 items: the 19 unchanged protected well-being/support questions, training goal `cau-starting-point-46`, and eight prior-experience/familiarity ratings. There are no mandatory challenges, purpose-acknowledgment questions, past-week performance ratings, or current-state ratings in this baseline. The daily check-in remains separate.

This is a self-reported starting profile for choosing an initial practice. It does not measure competency or cognitive ability. Unanswered experience is unknown. The protected questions are well-being/support intake; they are not a named validated clinical screening instrument.

`questionnaire.json` contains the exact 20 questionnaire prompts. The eight experience ratings are implemented in the shared skills component. Original question IDs are preserved. `routing.json` also retains historical routing decisions for removed questions; those IDs are not accepted as current answers.

Performance contains one questionnaire prompt and eight experience ratings. Well-being and support contains 19 prompts. Health is on by default, with explicit team override, organization default, then on when unset. Personal authorization and delivery readiness are separate. A pending health decision requires an actual choice with exact terms; acceptance requires a typed signature. Decline or revocation never becomes acceptance.

Completed historical combined baselines and v5 skills remain complete. Old unfinished drafts project goal/name and prior experience into a new namespace without rewriting old documents. New profiles use v6 `assessmentKind: self_report_starting_profile`; no competency, family ability, task evidence or overall ability scores are fabricated. Genuine prior task observations remain separately retained.

## Provider delivery, when explicitly configured later

Direction: Pulse server → `POST https://partner-api.auntedna.ai/partner/athletes/{externalId}/baseline`.

Headers: server-only Bearer partner key, `X-Pulse-Integration: true`, `Content-Type: application/json`.

`externalId` comes from the verified athlete account. The request contains only 19 protected field entries plus identity, submission ID, content/ownership versions and the provider-assigned university code. The training goal and eight experience ratings are excluded.

Test keys must start `ae_pk_test_` and use `SANDBOX`. Live keys must start `ae_pk_live_` and use a provider-approved code of 1–20 uppercase letters, digits, underscores or hyphens. SANDBOX cannot be used live. A prefix establishes environment only.

Live routing requires a server-owned `auntEdnaBaselineConnection` on the verified organization:

- `organizationId`: the owning organization ID.
- `teamIds`: explicitly authorized teams in that organization.
- `environment`: `live`.
- `universityCode`: the provider-approved code, also matching the organization's `universityCode`.
- `credentialEnv`: the approved `AUNTEDNA_PARTNER_LIVE_KEY` environment variable, optionally with an uppercase suffix.
- `approvalReference`: the operator's reference to provider approval of routing and credential scope.

No such connection is created by baseline assignment, an athlete request, or this release. There is no key-default clinic fallback. Never reuse CAU for UMES.

The request schema is in `baseline.schema.json`; the fictional example uses SANDBOX. Values use exact question choices. Skipped questions carry `state: skipped` and no value. `state: local` in an outbound answer is a wire label and does not authorize local persistence.

The performance mirror contains only the training goal and authenticated provider receipt references. Protected answers, free text, scores and answer hashes never enter performance drafts or the provider mirror. Changing protected-answer custody requires an explicit decision independent of staff notification routing.

## Receipts, retries and completion

Only an authenticated server response can confirm provider delivery. The adapter requires `success: true`, matching `externalId` and `submissionId`, nonempty `baselineId`, `athleteId`, `requestId`, a valid `receivedAt`, and boolean `created`. A replay with `created: false` is accepted. Browser-supplied receipts cannot complete the requirement.

Current live-flow submission IDs hash both the trusted assignment submission ID and content version. Sandbox IDs also include content version. Drafts, attempts and mirrors use separate version namespaces, so unfinished older content cannot overwrite the new attempt.

The provider call precedes mirror persistence. A persistence failure retries using the same idempotent submission identity. An interrupted combined submission retains its sharing choice. Canonical skills alone do not release the combined baseline gate.

Requests reject redirects and time out after 15 seconds. Provider bodies may contain answers and are never surfaced or logged. No clinical delivery is claimed without a matching receipt.

## Validation boundary

Offline integration tests exercise the actual 28-item UI with mocked identity/API responses, default-on/off/decline choices, interrupted submission, completed historical accounts, and the native session bridge. Unit and Firestore emulator tests cover ownership, exact consent evidence, scope, migration and retries. These checks do not establish live provider delivery.
