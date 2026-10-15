# AuntEdna athlete baseline

## Starting Point contract

Content revision: `cau-starting-point-v2`. Ownership revision: `cau-routing-v3`.

The full athlete experience contains **48 items**: 24 questionnaire prompts and 24 mental-skills ratings or activities. The skills module contains 8 current-state ratings, 8 skill-familiarity ratings, and 8 activities. The breath activity and its response count as one item. There are no additional conditional questionnaire prompts in this revision. Questionnaire responses may be skipped. Annual clinical screening is a separate workflow.

The downloadable `questionnaire.json` contains the exact 24 prompts, response choices, recall periods, and selection limits. IDs retain their approved printed numbers: `cau-starting-point-01` through `cau-starting-point-10`, then `cau-starting-point-35` through `cau-starting-point-48`. Items 11–34 belong to the separate skills module and are not missing questionnaire fields.

The web experience groups items by privacy ownership: 5 questionnaire prompts plus 24 skills interactions in Performance, and 19 questionnaire prompts in Well-being and support. iOS and Android open this shared required-baseline web flow. Existing completed skills may be reused, and athletes may complete performance only.

## Delivery boundary

Pulse sends **19 protected questionnaire fields** to AuntEdna. The five Pulse questionnaire fields and the 24 skills interactions are not included in this endpoint's request. The `routing.json` download identifies each questionnaire field's custodian.

Health delivery requires the athlete's current, signer-owned health-sharing authorization and an explicit sharing choice. A support preference is not authorization. When the athlete completes performance only, Pulse makes no baseline request to AuntEdna and records protected field references as `not_shared`.

Pulse's completion mirror retains its five questionnaire fields and provider receipt references. Protected answers are not copied into performance drafts or the mirror. The new protected IDs are external-only under the current private-retention policy. Administrative observations remain metadata; they do not add questionnaire answers to the partner request.

## Submit a baseline

Direction: Pulse server → AuntEdna partner API.

`POST https://partner-api.auntedna.ai/partner/athletes/{externalId}/baseline`

Headers:

```http
Authorization: Bearer <AUNTEDNA_PARTNER_KEY>
X-Pulse-Integration: true
Content-Type: application/json
```

`externalId` is the authenticated PulseCheck user ID for the live assignment. The browser cannot select another athlete's ID. In the isolated team-test flow, synthetic athlete identifiers and synthetic identity values are used instead.

The adapter requires an `ae_pk_test_` key with `universityCode: "SANDBOX"`, or an `ae_pk_live_` key with `universityCode: "CAU"`. Credentials are server-side. The snapshot-signing secret displayed in the partner portal is a different credential and must not be used as this Bearer key.

The body contains:

| Property | Meaning |
| --- | --- |
| `submissionId` | Stable, content-isolated identifier for retries. |
| `version` | `cau-starting-point-v2`. |
| `ownershipVersion` | `cau-routing-v3`. |
| `identity` | Name, email, and `verification: "self_reported"`. Identity details do not authorize account linkage. |
| `fields` | All 19 AuntEdna field entries, each keyed by its question ID. |
| `universityCode` | `SANDBOX` or `CAU`, matching the configured environment. |

Each supplied answer is `{ "questionId": "…", "state": "local", "value": … }`. `local` is the request's field-state label, not a claim that Pulse persists the protected answer. Single-choice answers use the exact choice string. Multi-select answers use an array of exact choice strings, within the questionnaire's selection limit. An unanswered field is `{ "questionId": "…", "state": "skipped" }`, without a value. No active question has a conditional `not_applicable` state in this revision.

Use `baseline.schema.json` with `examples/baseline.synthetic.json` to inspect the outbound wire shape. The example contains fictional identity and answers only.

## Receipt and retries

A successful provider response uses this envelope:

```json
{
  "success": true,
  "data": {
    "baselineId": "baseline_synthetic_001",
    "athleteId": "athlete_synthetic_001",
    "externalId": "synthetic-athlete-001",
    "submissionId": "synthetic-starting-point-v2-001",
    "receivedAt": "2026-10-14T16:00:00.000Z",
    "created": true
  },
  "requestId": "request_synthetic_001"
}
```

The adapter checks that `externalId` and `submissionId` match the request. It requires nonempty baseline/athlete/request identifiers, a parseable receipt timestamp, and a boolean `created`. `requestId` is diagnostic metadata, not a replacement for a baseline receipt. Browser-supplied receipts do not authorize completion.

Retries use the same athlete, content version, submission ID, and answers. Provider idempotency must return the original baseline receipt for the same submission. A retry may return `created: false`. Pulse contacts the provider before persisting the local completion mirror; a local persistence failure can therefore require retrying an already accepted provider request. Protected answers are not queued locally for that retry, so the browser must retain them until completion is confirmed.

The adapter rejects redirects and uses a 15-second timeout. Network failures, invalid receipts, HTTP 429 and server errors are retryable adapter failures. Provider error bodies can contain answers and are neither logged nor returned to the browser. Pulse reports failure rather than claiming completion without a matching receipt.

## Versioning and client compatibility

The authenticated Pulse status endpoint is `/api/pulsecheck/questionnaire/cau`. It remains an internal athlete-client endpoint, not an AuntEdna partner ingestion endpoint.

- Status `version` remains `cau-operational-web-v1` for existing iOS/Android gate compatibility.
- Status also returns `questionnaireVersion: "cau-starting-point-v2"`.
- All questionnaire POST actions, including draft and skill saves, must include that `questionnaireVersion`. Stale or missing versions receive HTTP 409 before mutation.
- Performance drafts use `version: "cau-starting-point-v2"` and `flowVersion: 4`.
- Partner payload `version` is the content version, `cau-starting-point-v2`, not the native transport version.
- New drafts, attempts, baseline records and external submission IDs are isolated from the old content revision. In the live flow, the new submission ID is `sp2-` plus the SHA-256 hex digest of the assignment's stable submission ID.
- Historical completed baselines still satisfy the requirement. Old incomplete drafts are preserved in their original namespace and are not reinterpreted as new answers.

Do not map an old numbered ID to a new ID by number alone. Wording, options, timeframes and ownership can differ. Existing source records retain their original version.

## Availability and verification

This guide describes the implemented source contract. Local tests cover content counts, answer validation, ownership separation, version isolation, stale-client rejection, receipts, retries, and completion. A local browser walkthrough completed the full 48-item flow with mocked authentication and API responses.

Production deployment and AuntEdna acceptance of this new content version and its IDs have not yet been verified. The collection flag, cohort assignment and current consent requirements still control real-athlete availability. Documentation access does not activate collection or authorize data transfer.

## Related guides

- [Athletic Mind snapshots](/developer/api/athleticmind-snapshots)
- [Clinical bridge](/developer/api/clinical-bridge)
- [Partner credential portal](/developer/api/partner/auntedna)

## Questionnaire ownership

The following mapping is generated from the current questionnaire and routing definitions.

| ID | Prompt | Custodian |
| --- | --- | --- |
| `cau-starting-point-01` | I understand the purpose of this onboarding questionnaire and how my responses will be used. | PulseCheck |
| `cau-starting-point-02` | Which statement best describes why you are participating today? | auntEDNA |
| `cau-starting-point-03` | What do you personally want to gain from this experience? | auntEDNA |
| `cau-starting-point-04` | I feel that I have a real choice in how I participate in this experience. | auntEDNA |
| `cau-starting-point-05` | I felt mentally ready to meet my volleyball demands. | PulseCheck |
| `cau-starting-point-06` | I felt physically ready to meet my volleyball demands. | auntEDNA |
| `cau-starting-point-07` | I had enough energy for my daily responsibilities. | auntEDNA |
| `cau-starting-point-08` | I felt rested and recovered enough for my responsibilities. | auntEDNA |
| `cau-starting-point-09` | I felt motivated to participate in volleyball. | PulseCheck |
| `cau-starting-point-10` | I felt connected to my sport. | PulseCheck |
| `cau-starting-point-35` | I felt emotionally balanced. | auntEDNA |
| `cau-starting-point-36` | I was able to manage the demands placed on me. | auntEDNA |
| `cau-starting-point-37` | I felt hopeful about the week ahead. | auntEDNA |
| `cau-starting-point-38` | Stress interfered with my ability to function the way I wanted. | auntEDNA |
| `cau-starting-point-39` | On most nights during the past seven days, approximately how much sleep did you get? | auntEDNA |
| `cau-starting-point-40` | Which areas affected you most during the past seven days? | auntEDNA |
| `cau-starting-point-41` | I feel that I belong on this team. | auntEDNA |
| `cau-starting-point-42` | I feel respected within my athletic environment. | auntEDNA |
| `cau-starting-point-43` | I can ask for help without being viewed as weak. | auntEDNA |
| `cau-starting-point-44` | I know where to go for confidential mental-health support at CAU. | auntEDNA |
| `cau-starting-point-45` | I trust that my individual mental-health information will remain private from coaches and performance personnel. | auntEDNA |
| `cau-starting-point-46` | What would you most like to strengthen through mental-performance training? | PulseCheck |
| `cau-starting-point-47` | What would you most like support with? | auntEDNA |
| `cau-starting-point-48` | If additional support may be helpful, how would you prefer the platform to respond? | auntEDNA |
