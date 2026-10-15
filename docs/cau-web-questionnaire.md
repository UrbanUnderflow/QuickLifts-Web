# CAU direct auntEDNA integration

## Current 48-item baseline — October 14, 2026

The approved Starting Point now contains 24 questionnaire prompts and the existing 24 mental-skills ratings/activities (8 current-state, 8 familiarity, 8 activities). Questionnaire IDs retain the approved printed numbers 01–10 and 35–48. There are no additional conditional prompts. Questions remain optional, and the existing performance-only path remains available.

The shared web route is also the required-baseline experience opened by iOS and Android. Its two privacy sections contain 5 PulseCheck questionnaire items plus 24 skills interactions, and 19 auntEDNA questionnaire items. The presentation groups by existing privacy ownership, so its order differs from the printed document. Previously completed skill baselines can still be reused. Annual clinical screening remains separate.

`cau-starting-point-v2` identifies content, saved drafts, submissions and provider payloads. Native status transport remains `cau-operational-web-v1`; GET also returns `questionnaireVersion`. Every POST must identify the current content version. Old completed baselines still satisfy the gate; incomplete old drafts remain preserved in their original namespace and are not interpreted as new answers. New external submission identifiers are version-isolated for safe retries. Archived question/routing JSONs preserve historical definitions.

Administrative information is metadata, not added questionnaire answers. Sensitive/mixed responses retain the external-provider routing and current health-authorization check. New sensitive fields do not inherit earlier private-retention eligibility. No collection activation or team intake migration is part of this source update. Team-owned custom intake remains a separate configuration.

Native demo fixtures mirror the 24 questionnaire items; their labels identify that limited preview accurately. Run `python3 scripts/generate-cau-questionnaire-demo.py --check` in PulseCheck to verify source parity.

Validation for this revision: 28 questionnaire/API/partner tests and 8 mental-skills tests passed; TypeScript and scoped UI lint passed. A local browser walkthrough completed all 24 questionnaire answers and the 24 skills interactions, verified content-version requests and the success screen, and reported no browser errors. Authentication and API responses were mocked; no live records or partner calls were made. Native JSON/generator parity, Swift syntax parsing and Android Kotlin compilation passed. Deployment, live provider acceptance, full iOS build and device verification remain unverified.

The older integration notes below describe the historical version and its verification. They do not establish deployment or acceptance of the new content.

Updated September 16, 2026 against the supplied auntEDNA Partner API Integration Guide dated September 11.

## Routing and transport

The audited `cau-routing-v2` map contains 48 auntEDNA health/support fields and 13 PulseCheck performance/setup fields. The injury narrative is conditional. These are privacy routing decisions, not legal HIPAA classifications. Source data-sharing alignment for items 34–37 remains unresolved.

`auntedna-partner.ts` implements POST https://partner-api.auntedna.ai/partner/athletes/{externalId}/baseline using the server-only Bearer key and X-Pulse-Integration: true. It adds universityCode to the auntEDNA-only payload. The guide's routing-v1 example does not override our corrected v2 map; its contract accepts new question IDs. Test configuration is restricted to SANDBOX and live configuration to CAU. Redirects are rejected, requests time out, and provider error bodies are never surfaced or logged.

The adapter validates the response athlete/submission linkage and required receipt fields. `baselineMirror` preserves only PulseCheck values and auntEDNA baselineId/athleteId references. requestId is diagnostic metadata, not a fabricated receiptId. No health answers, hashes, summaries, or scores enter the mirror.

`cau-delivery.ts` coordinates external delivery and an injected atomic local record store. It calls auntEDNA before local persistence, saves only the mirror, and safely retries the same submission after local persistence failure. The authenticated route now connects a restricted Firestore mirror store. This has been exercised with a mocked store, not a live Firebase write. A separate restricted attempt record reserves only the PulseCheck snapshot and sharing choice for retry consistency. Existing combined records have not been migrated or deleted.

## Identity and activation

The provider requires externalId to equal the PulseCheck user ID used for escalations. Name/email are self-reported and must not authorize attachment to an existing PulseCheck account. The current public questionnaire therefore needs an account-bound invitation or authenticated sign-in before real collection. The browser must not choose arbitrary athlete IDs or supply its own trusted receipt.

Keep the API key server-side. Do not embed it in the web bundle, committed fixtures, logs, or documentation. Separate sandbox IDs from real athlete IDs. The live key has not been used.

The route now requires Firebase sign-in and an explicit server-provisioned assignment. Account binding is derived from the verified token. Current signer-owned health authorization is checked against team terms before clinical delivery. Athletes may complete performance only; that completes the requirement without clinical disclosure. Collection still defaults off through CAU_QUESTIONNAIRE_COLLECTION_ENABLED. Activation requires the selected cohort, secret configuration, a verified restricted Firestore mirror save, and end-to-end browser validation. Existing escalation behavior was not changed; the supplied guide now requires universityCode there as well, so that separate flow needs review before switching to this partner endpoint.

## Verification

A fictional submission was accepted by the actual sandbox API on September 16. A second identical request returned created:false and the same baselineId. This verifies API acceptance and idempotency, not counsellor UI display or production persistence. See `cau-auntedna-sandbox-receipt.json` for identifiers that can be provided to the partner team. No message has been sent to them.

Focused tests cover audited partitioning, environment separation, receipt mismatches, error-body suppression, retry behavior, and mirror-only persistence. Full application build/deployment and real-athlete collection remain unverified.

## Required intake gate

The web flow requires existing PulseCheck sign-in and returns to the questionnaire after login. iOS and Android check the same authenticated GET route and block normal app use only for explicitly assigned, incomplete accounts. Browser completion resolves the gate on return or manual recheck. Help, emergency support, and sign out remain available. Known pending assignments survive offline failures. A first-ever status failure does not globally lock unknown/unassigned users. The gates open the authenticated browser flow; they do not embed a second native questionnaire or store health answers on device.

Assignments live in the existing client-denied restricted collection, under assignment_{uid}. Required fields: kind=assignment, enabled=true, version=cau-operational-web-v1, a stable submissionId, teamId, environment=test|live, and universityCode=SANDBOX|CAU. Only active membership remains eligible. `scripts/assign-cau-questionnaire.cjs` defaults to a read-only plan and requires explicit --apply; it refuses to overwrite an existing assignment. No assignments were activated by this implementation.

Mirrors use baseline_{uid}_{version}. Attempt records use attempt_{uid}_{version}; they contain only PulseCheck values and metadata. Clinical values pass through server memory to auntEDNA and are not staged, logged, queued, or written to Firebase. Both kinds remain client-denied. Completion means the operational flow was resolved, including the permitted performance-only choice, not that clinical consent was forced.

Server settings: AUNTEDNA_PARTNER_TEST_KEY and AUNTEDNA_PARTNER_LIVE_KEY are function secrets. CAU_QUESTIONNAIRE_COLLECTION_ENABLED must be true only after validation. No live key or real data was used. The integration has not been deployed in this work; mobile builds have not been distributed.
