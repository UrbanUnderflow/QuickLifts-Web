# Clinical bridge

A focused handoff between PulseCheck and AuntEdna for Athletic Mind. PulseCheck submits the concern needed to create a case. AuntEdna owns clinical recipient selection, assignment, and after-hours handling. PulseCheck receives limited operational status through signed callbacks. All examples are synthetic.

## Integration scope

For explicitly configured Athletic Mind programs, emergency handoffs use this bridge and keep athlete-facing crisis resources available. A successful case receipt confirms receipt, not that a clinician has begun care. Assignment and later clinical workflow states require separate provider updates.

PulseCheck-only programs and unknown program configurations display crisis resources without registering the athlete with AuntEdna or sending an emergency case. The emergency pathway never automatically discloses the concern to a coach, trainer, or parent. Routine human notifications follow separate recipient-specific consent.

## Authentication and destinations

PulseCheck calls the agreed AuntEdna HTTPS base URL using `Authorization: Bearer <partner credential>` and `Content-Type: application/json`. Partner credentials are provisioned separately from documentation access. The developer access-request workflow currently issues Athletic Mind snapshot HMAC credentials; AuntEdna clinical bridge bearer credentials and webhook secrets are provisioned through the separate provider integration channel.

AuntEdna sends callbacks to the `pulseApiCallback` URL in each case packet. The PulseCheck endpoint is `POST https://fitwithpulse.ai/.netlify/functions/clinical-callback`. Use the callback URL supplied with the packet for the agreed environment.

## Register the athlete

`POST {AuntEdna base URL}/athletes`

Use `externalId` as the stable PulseCheck athlete ID. The request includes available name/email and scoped organization/team IDs. Repeated registration must be idempotent. Return HTTP 2xx with `{ "success": true, "data": { ... }, "requestId": "..." }`; an explicit error or missing success acknowledgment is a failure.

## Receive an emergency handoff

`POST {AuntEdna base URL}/escalations`

The header `Idempotency-Key` equals the packet's `escalationRecordId`. Preserve that identity across retries and return the existing case after acknowledgment loss.

The [handoff example](examples/emergency-handoff.synthetic.json) and [payload schema](emergency-handoff.schema.json) describe the emergency packet. It contains scoped IDs, available contact information, tier/category, the current concern excerpt, classification reason, a brief handoff summary, consent basis, and callback URL. The current emergency path excludes full conversation history, unrelated mental notes, wearable snapshots, and optional profile history. Concern excerpts and classification reasons are bounded to 2,000 and 1,000 characters respectively.

Return HTTP 2xx using the [case receipt](examples/case-receipt.synthetic.json): `success: true`, a nonempty `data.escalationId`, and a status of `received`, `processing`, or `assigned`. Other status values do not confirm this emergency handoff. The receiver must preserve the relationship between this provider case ID and the submitted `escalationRecordId`. A rejected, failed, or unconfirmed response does not establish acceptance.

## Status and resolution operations

The existing bridge also calls these provider endpoints:

- `GET /health`: availability response for the agreed receiver.
- `GET /athletes/{externalId}/status`: coarse operational status.
- `GET /athletes/{externalId}/care-state`: agreed care workflow state.
- `POST /escalations/{caseId}/resolve`: confirmed resolution, using `status` and an optional coordination note. Clinical notes remain in AuntEdna.

These operations use the same response envelope. They are provider endpoints called by PulseCheck, not public PulseCheck APIs. Do not return clinical notes, intake answers, or appointment details in operational status responses.

## Send a signed callback

Use the [callback schema](webhook.schema.json) and [callback example](examples/webhook.synthetic.json). Each event needs a unique `webhookEventId`, supported `event`, and the PulseCheck escalation ID or provider case ID for reconciliation. Include `occurredAt`; optional assignment labels must be safe operational labels.

Send `X-AuntEdna-Signature: t=<unix seconds>,v1=<hex digest>`. Calculate HMAC-SHA256 over `<timestamp>.<exact raw JSON body>` using the agreed webhook secret. Keep body bytes unchanged after signing. The default timestamp tolerance is five minutes; use the tolerance agreed for the environment.

Supported events include `escalation.created`, `triage.requested`, `clinician.assigned`, `appointment.booked`, `crisis.invoked`, `watchlist.entered`, `watchlist.updated`, `watchlist.removed`, `watchlist.cleared_for_training`, `checkin.scheduled`, `checkin.completed`, `checkin.missed`, and `case.resolved`.

PulseCheck stores only allowlisted operational fields. Extra clinical content is discarded; do not send it. A callback reporting assignment is distinct from the earlier case-creation receipt.

## Acknowledgments, retries, and errors

For case creation, timeouts, network failures, missing case IDs, or unsuccessful acknowledgments remain failed delivery. Reuse the original case identity on retry. A failed handoff does not trigger a coach fallback or imply active clinical care. Athlete-facing resources remain available throughout.

For callbacks, retry non-2xx responses with the same event ID and a newly signed timestamp. Duplicate processed events return 200 without duplicate work. An unmatched but valid event may return 200 and be retained for reconciliation; successful delivery does not guarantee a case match. Coordinate unmatched events using the supplied IDs.

Callback HTTP statuses:

- `200`: processed, duplicate, or retained for reconciliation.
- `400`: malformed or unsupported event.
- `401`: signature authentication failed.
- `503`: receiver or signing configuration unavailable.

## Versioning

The emergency packet currently uses `payloadVersion: pulse-manas-v1-draft`. This wire identifier is retained for compatibility. The separate consent disclosure version is `pulsecheck-clinical-handoff-v1`. Validate the published schema and coordinate any breaking field, authentication, or event-vocabulary change before switching versions. Daily automated snapshots use their own `athleticmind-snapshot-v1` contract.
