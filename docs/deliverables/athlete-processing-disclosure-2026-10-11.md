# Athletic Mind processing, emergency routing, and developer documentation

Status: local implementation, 11 October 2026. No deployment, real partner delivery, external messages, or live configuration changes. Expanded Athletic Mind participation terms remain prepared and inactive.

## Program scope and consent

The authoritative program setting is the saved organization's `productBrand`, resolved through the source team and membership. Display branding and legacy default brand fallbacks do not authorize partner processing. Ambiguous mixed membership must not select AuntEdna.

Web, iOS, and Android show the exact configured Athletic Mind participation text prominently. PulseCheck-only stock participation and health authorization have separate `v1-pulsecheck` defaults and require exact matching receipts. Custom wording is preserved. Separate health authorization, research, wearable, private-journal, and routine staff-sharing choices remain separate.

The prepared `athleticmind-automated-processing` document covers current onboarding answers, eligible new check-ins, and new Nora conversations. It states the automated-processing purpose, operational access, withdrawal boundary, and AuntEdna emergency responsibility. It is not imported into active defaults. No historical acceptance was reinterpreted as permission for the new exchange.

## Emergency responsibility

Explicit Athletic Mind programs use the existing AuntEdna clinical bridge. PulseCheck submits the emergency packet; AuntEdna owns clinical recipient selection, assignment, and after-hours handling. This does not require a separate campus-clinician routing model.

Explicit PulseCheck-only programs and unknown or ambiguous program scope receive athlete-facing crisis resources only. This emergency pathway does not register the athlete with AuntEdna, submit a partner case, or automatically notify coaches, trainers, or parents. Showing a resource does not contact the service. U.S. call/text 988 links are identified as U.S. resources, with local emergency-service guidance outside that scope. The app does not infer physical location from language or device locale.

The Athletic Mind path is gated by `ATHLETICMIND_EMERGENCY_HANDOFF_ENABLED=true` and live AuntEdna bridge configuration. The default-off or unavailable path retains resources and reports failed handoff explicitly. It does not claim accepted or active clinical care.

The emergency packet contains athlete contact/scoped IDs and bounded current concern/reason. It excludes full conversation history, unrelated mental notes, goals, date of birth, emergency contacts, and wearable/state snapshots. The bridge uses `POST /athletes` then `POST /escalations`, with the original escalation ID as the idempotency key. A live HTTP-success acknowledgment must explicitly confirm a case and acceptable delivery status. Failed or mock attempts cannot mark acceptance. Signed callbacks carry subsequent operational assignment/status separately from receipt.

## Private-record access

Private Athletic Mind escalation records and emergency records for any program are no longer exposed to client staff based on their role. The athlete retains access to their own records. Routine selected-recipient notification consent does not grant access to the full private record. Server reads and mutations enforce the same distinction. Routine PulseCheck staff behavior outside this emergency scope and unrelated authorized performance data remain intact.

The classifier endpoint authenticates the record owner before reading private history. The Vision Pro operator surface retains its safety eligibility stop while omitting raw escalation tier and incident identifiers. Server-only operational delivery diagnostics contain failure metadata rather than concern text.

## Snapshot exchange

Scheduled push and authenticated pull share one eligibility-enforcing assembler. Both global flags remain off. The assembler requires explicit active Athletic Mind scope, active membership, exact current participation text and signed receipt, and signer-owned append-only evidence. Push requires a valid durable receiver receipt before advancing its watermark. Pull is scoped by signed requests and never advances push delivery state. Immutable retries revalidate source permissions, source revisions, current onboarding, and consent before release.

Current coverage includes permitted, team-scoped scheduled Nora conversations and eligible source records. Main Nora storage lacks trusted team/organization provenance and stores restricted/redacted content; it cannot supply a complete raw conversation history. New messages in older conversations also lack trusted per-message ingestion evidence. The precise remaining source change is server-authored conversation team/organization binding and trusted per-message persistence consistent with the approved retention/storage contract. No assembler fallback guesses that scope or reconstructs withheld text. The payload explicitly reports incomplete Nora coverage. Optional wearable/journal adapters remain excluded.

Pull cache expiry has local Firestore TTL configuration. Delivery outboxes preserve receipts and immutable payloads; an approved payload-retention/redaction period is still needed before enabling that snapshot transport.

## External developer site

System Overview remains an internal handbook. The external developer experience is implemented in the existing app at `/developer`, `/developer/api`, `/developer/api/athleticmind-snapshots`, and `/developer/api/clinical-bridge`.

The public hub/catalog expose only integration metadata. API guides, schemas, and synthetic examples load server-side after password validation. Protected downloads use the same access grant. No account is needed. Password sessions are scoped to the integration, expire, and are invalidated by password configuration rotation. Rate limiting uses server-side state. Missing access configuration fails closed. External files are curated separately under `docs/developer`; internal handbook content, rollout notes, private business documents, credentials, and athlete data are not included.

`DEVELOPER_DOCS_PASSWORD_HASH`, `DEVELOPER_DOCS_PASSWORD_SALT`, and `DEVELOPER_DOCS_COOKIE_SECRET` configure access. These are server-only values. The local preview uses synthetic password configuration and a database emulator, never production credentials or records.

## Verification and activation boundary

Earlier scoped checks passed web consent tests, notification/runtime tests, native policy checks, snapshot assembly/delivery/pull/scheduler tests, protected-sharing tests, and server-only database-rule emulator tests. Emergency changes add tests for both explicit program types, missing scope, no automatic coach disclosure, receipt loss, false/mock acknowledgment, and private-record isolation. Native checks cover resource-only and received/failed messaging. Full device testing and signed-in production verification remain separate.

Before activating the Athletic Mind emergency receiver, confirm the real configured AuntEdna HTTPS base URL, live credential, case acknowledgment/idempotency behavior, and webhook secret/availability, including after-hours handling on AuntEdna's side. No local clinical-team designation is required. Snapshot activation additionally depends on its separate new participation rollout, receiver contract and documented source/retention limitations. Developer-site publication requires deployment and real documentation access configuration; no live password or share has been created.

## Final local evidence

- Emergency routing/bridge/read-action suite: 102 focused tests passed, including the actual outbound emergency packet against the published JSON Schema. Retry is an authenticated athlete/trusted reattempt with a stable case identity; no new automatic retry timer was introduced.
- Private-read controls: 9 emulator tests plus 2 classifier/operator runtime tests passed. Developer access/server-only database rules: 28 tests passed.
- Native emergency messaging: Android targeted checks passed; Swift parsed and isolated state checks passed. Full iOS XCTest/device validation was not run.
- Actual Next application preview: `http://127.0.0.1:3988/developer/api`, with the snapshot guide at `/developer/api/athleticmind-snapshots`. The separate emulator fixture uses synthetic data only.
- Browser verification covered both guides: wrong/right password, no account, per-document cookie isolation, protected direct downloads, guide links, six artifact tabs, return navigation, and 1440px/390px layouts without horizontal overflow. Locked HTML contains no protected artifact data.
- External package and screenshots: `/Users/tremainegrant/Documents/Codex/2026-10-11/realtime-voice-chat/outputs/developer/`. Local-only access details are in `local-preview-access.txt`; they are not production credentials.

## Partner API key management

The public access request form persists a pending review. Verified, non-revoked admin identity is required for approval, rotation, and revocation. Approval binds saved active organization/team scope, API, environment, expiry and quota. Random HMAC secrets are shown once and stored with AES-256-GCM encryption; lists expose only metadata. Rotation has an explicit bounded overlap and preserves the original expiry. Documentation passwords grant no administration or API authentication. Clinical provider bearer credentials remain separate.

The actual snapshot endpoint uses managed authentication, scope/environment validation, atomic quotas and metadata audits, and checks revocation again before release. Legacy credentials require explicit opt-in and matching environment. The isolated test environment supplies deterministic synthetic data only. Public request volume cannot disable admin key controls; independent bounded pagination is implemented.

Backend evidence: 38 emulator tests, two strict route/authentication tests, actual Next HTTP request/approval/list/rotation/revocation flow, and typecheck passed. Snapshot endpoint coverage includes 17 tests for issued-key signed requests, scope/environment denial, expiry, rotation, revocation, quotas and concurrent revocation. Deployment still requires server encryption configuration, environment selection, rules/TTL deployment and the existing activation prerequisites. No live keys or records were created.

Browser verification completed against the actual Next app and isolated emulators: public request persists pending, unauthenticated and documentation-cookie-only admin calls return 401, verified admin approves exact scope, one-time secret disappears after refresh/reload, rotation returns a distinct secret, dismissal clears it, and revocation completes. Desktop and mobile layouts were inspected with no mobile overflow. Only synthetic account onboarding metadata was corrected for the fixture; production account guards were unchanged. Local access instructions are in `outputs/developer/local-preview-access.txt`; no API secret was saved there or in screenshots.

## Production publication follow-up

The user pushed commit `26c1ca272` and authorized production publication and a Chai/AuntEdna partner credential. The partner model now separates identity from explicit program grants and offers the explicitly selected All Athletic Mind programs scope, including future programs. Every request rechecks persisted active team/organization scope with productBrand exactly athleticmind. Existing restricted credentials retain their original scope. No production organization was reclassified.

The initial Netlify upload failed at the Lambda-compatible 4 KB environment limit. The six new settings were moved into Google Secret Manager `pulse-partner-production`; Netlify keeps only a short reference. The actual runtime loader was verified against that production secret without exposing its values, including the chosen documentation password and 32-byte encryption key. Three Firebase-backed API routes use the established native function bridge with scoped 8 KiB body limits.

The live Firestore release was patched narrowly from its existing source: twelve new server-only collection exclusions and recursive denies, with unrelated rules preserved. Release ruleset `2f6d998c-38a6-409b-bf2c-a45b8760e804` was read back byte-for-byte. The three attempt/rate TTL fields are active. These configuration and local verification results do not by themselves establish a successful website deployment or credential issuance; the final production handoff records those separately.
