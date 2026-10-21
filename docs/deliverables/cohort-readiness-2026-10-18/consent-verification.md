# Consent refresh and reacceptance verification

> Current launch status: [launch-gate matrix](launch-gates.md). This document preserves the earlier audit/remediation evidence; consult the matrix for subsequent fixes and remaining release dependencies.
> Current follow-up: see [scoped remediation report](remediation-report.md). Production membership rules and four legacy team agreement corrections are now verified; web/native fixes and their distinct release/verification status are recorded there. The observations below are the historical audit baseline, not a claim that all remain unchanged.

October 18, 2026. Follow-up to the authorized product configuration correction. This verification made no production writes, enrollment changes, consent submissions, deliveries or deployments. It used current source, projected live consent/configuration metadata, exact deployed Firestore rules and isolated synthetic tests. Athlete names, account IDs, signatures, intake answers and health content are omitted from the report.

## Outcome

**The product assignments are verified. Consent refresh is not yet verified end to end and has concrete blockers.** Standard terms and native exact-receipt checks behave as intended in local tests. However, legacy team terms remain unchanged, web access checks can accept an old participation receipt, failed reads can bypass or mis-scope consent, already-open sessions can retain old configuration, and deployed membership rules expose consent-summary metadata too broadly.

Verification entails five separate questions: (1) which terms this athlete's current team/product actually requires, (2) whether their saved receipt matches those terms, (3) when each app reevaluates that match, (4) whether the server independently enforces the relevant permission, and (5) whether the released app actually displays, saves and restores the correct decision. The first four were checked to the extent described below. Released authenticated journeys remain unverified.

## What the product change actually means

- **PulseCheck, exact current stock terms:** participation and health documents become `v1-pulsecheck`; title/body/version/category selection is exact. Old `v1` receipts and completed-ID flags cannot satisfy the intended replacement policy. A fresh decision is needed for those replacement documents, but health authorization may be declined or revoked while participation continues.
- **Clark Atlanta, AthleticMind:** the selector retains the existing stock `v1` documents. Assigning `athleticmind` alone does not invalidate a matching receipt or require a new signature. Existing incomplete/outdated decisions can still require action independently of this product assignment.
- **Customized or older team documents:** preserved unless they exactly match the current stock originals. A PulseCheck assignment does not rewrite their wording or automatically introduce a separate health decision. These need deliberate terms/scope review before deciding whether to retain, revise or replace them.
- **Optional research:** accepting a general willingness choice does not establish dataset eligibility; study-specific consent and configured research status remain separate. Routine recipient-specific handoff and urgent safety routing also retain separate requirements. Program participation/processing language is not blanket authorization for every disclosure.

The standard participation, health and research document ID/title/body/version/category values match exactly across web JSON, extracted current Swift model and Android source for both products: [parity evidence](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/deliverables/cohort-readiness-2026-10-18/consent-document-parity.json).

## Verification matrix

“Verified” states its evidence level. “Failed” means the tested or source-traced behavior does not satisfy the expected control. “Unverified” requires additional environment/account/device evidence.

| Check | Result | Evidence and consequence |
| --- | --- | --- |
| Organization mapping | **Verified live metadata** | 1 AthleticMind organization, 6 PulseCheck; mapping unchanged during this verification. Prior correction verified all 10 team resolutions. |
| Standard document parity | **Verified source comparison** | Six product/document combinations match web/iOS/Android exactly. |
| Old stock receipt after PulseCheck switch | **Verified policy tests; web access gap below** | Exact helper and native models reject old receipt and bare completed ID for `v1-pulsecheck`. |
| Clark Atlanta matching receipt | **Verified policy/source** | Same document/version/body remains valid; no blanket re-sign requirement caused by product field. |
| Customized/legacy documents | **Verified live metadata; migration incomplete** | Four PulseCheck teams retain v3 agreements mentioning AuntEdna; two are active, two ready-for-activation. |
| Fresh enrollment requirements | **Source traced; submission unverified** | Loaders resolve team/org requirements. Existing custom team arrays take precedence; no real enrollment was created. |
| Optional decline/revocation | **Verified local tests** | Health/research refusal can complete the optional decision without becoming acceptance. Participation refusal does not satisfy participation. |
| Study eligibility | **Verified local tests** | Willingness alone fails eligibility; study-specific document required. |
| Returning session/restart | **Source traced; rendered result unverified** | Native foreground checks rerun; fresh web load resolves configuration. No released-device journey was performed. |
| Already-open session | **Failed refresh expectation** | Web gate has no product-change listener. iOS skips reload while an onboarding context is open. Android foreground reruns but rendered state transition is unverified. |
| Web legacy participation receipt | **Failed synthetic reproduction** | Access helper accepts legacy completed ID with absent version or `v1` for `v1-pulsecheck`, while exact receipt helper rejects it. Stock health can independently block; this remains material for participation-only terms or current health plus stale participation. |
| Failed reads | **Failed on web/iOS; mixed Android** | Web gate clears pending state after failure; iOS membership failures become no memberships. Android membership/team failures block with retry. Both natives discard organization/pilot read errors and may choose fallback terms. |
| Append-only signer evidence | **Verified isolated emulator using local and exact deployed rules** | Signer append/read succeeds; edit/delete and coach read/forgery fail. |
| Membership consent-summary privacy | **Failed against exact deployed rules in emulator** | Unrelated signed-in account can read parent membership consent summary; local rules deny it. No production exploit performed. |
| Server routine transfer authorization | **Partial source/test verification** | Exact accepted health receipt plus signer event required when health document exists. Missing-health legacy fallback and alternate clinical endpoint gaps remain. No handoff sent. |
| Reacceptance save/reopen and released apps | **Unverified** | No confirmed isolated athlete session, no connected Android device; iOS simulator exists but account/environment is not verified safe. |

## Live metadata findings

At 09:32 ET, projected records confirmed the mapping. Of seven PulseCheck teams, four retain these two documents:

- `pulsecheck-operational-participation-notice-v1`, version `v3`.
- `pulsecheck-operational-privacy-and-sharing-v1`, version `v3`.

Both mention AuntEdna and resolve as participation documents, with no separate health-authorization category in those team arrays. The product selector leaves them unchanged. This is an observed configuration consequence, not a determination that the agreements are legally invalid.

The read-only inventory evaluated **60 candidate athlete memberships**, excluding explicit removed/inactive/revoked/archived states and revokedAt. Of these, 42 lack explicit status and are shown only as legacy candidates, not confirmed active users. Counts are memberships, not unique athletes:

| Product | Candidates | Explicit active memberships | Candidates whose current documents are incomplete | Active membership + active team with incomplete current documents |
| --- | ---: | ---: | ---: | ---: |
| AthleticMind | 46 | 12 | 45 | 12 |
| PulseCheck | 14 | 6 | 10 | 4 |

Nine PulseCheck candidate memberships resolve to revised stock `v1-pulsecheck` participation/health documents, and all nine lack completion under the exact current receipt evaluator. Five resolve to retained v3 team agreements; four of those five satisfy the legacy completion evaluator. Clark Atlanta's documents do not change solely from the product assignment; its incomplete states must not be attributed to this switch.

These counts execute the current policy against projected metadata; they do not prove the actual deployed UI will prompt, establish legal consent validity, or identify people to contact. No consent-event subcollections or signer names were read for the inventory. [Redacted metadata evidence](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/deliverables/cohort-readiness-2026-10-18/consent-live-metadata.json).

## Concrete blockers and source evidence

### C01 · P1 · Deployed consent-summary privacy differs from local protections

The active Firestore ruleset is `2f6d998c-38a6-409b-bf2c-a45b8760e804`, updated October 11 at 21:44 UTC. Its hash differs from the current local rules. The deployed event subcollection is signer-only and append-only, but parent memberships allow every signed-in user to read, including consent summary/signature metadata. Synthetic tests reproduce this against the downloaded rules and show denial under current local rules.

Evidence: [deployed rules snapshot:580](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/deliverables/cohort-readiness-2026-10-18/deployed-firestore.rules.snapshot:580), [release/hash evidence](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/deliverables/cohort-readiness-2026-10-18/consent-deployed-rules.json), [privacy test log](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/deliverables/cohort-readiness-2026-10-18/consent-summary-privacy.log).

Next: prepare a scoped rules reconciliation and supported-client compatibility check. Do not blindly deploy the whole local rules file: the diff includes unrelated changes and native write-contract implications. Then verify cross-account denial against the authorized candidate deployment.

### C02 · P1 · Web receipt completion is inconsistent

`hasCompletedRequiredConsents` falls back to completed IDs/numeric version comparison for participation. `v1` and `v1-pulsecheck` compare as the same numeric version. The exact helper requires a new receipt. The weaker path is consumed by the main app gate, so it is not merely an unused utility.

Evidence: [accessState.ts:76](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/accessState.ts:76), [hydration:580](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/service.ts:580), [app gate:447](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/PulseCheck.tsx:447), [synthetic result](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/deliverables/cohort-readiness-2026-10-18/consent-access-gate-repro.log).

Next: use one exact document/receipt evaluator across hydration, access and submission. Preserve optional decline semantics. Test missing receipt, changed body, product suffix and custom-document cases.

### C03 · P1 · Read failure can bypass or change the required terms

Web catch clears pending state and marks the gate checked. iOS membership fetch failure yields an empty list. Both natives suppress organization/pilot read errors. A failed authoritative read is not confirmation that there is no consent requirement or that generic terms apply.

Evidence: [web catch:483](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/PulseCheck.tsx:483), [iOS membership:1914](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/ContentView.swift:1914), [iOS scope reads:1576](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/ContentView.swift:1576), [Android scope:253](/Users/tremainegrant/Documents/GitHub/PulseCheck/android/app/src/main/java/com/fitwithpulse/pulsecheck/PulseCheckTeamOnboarding.kt:253).

Next: retain unresolved state and retry; require confirmed program scope before selecting/signing terms. Test permission denial, unavailable network and stale cache separately.

### C04 · P1 before claiming migration complete · Retained team agreements need an explicit decision

Exact stock replacement intentionally preserves custom/legacy content. The four live PulseCheck team arrays therefore do not acquire the new stock health document. Main routine handoff uses raw team documents; if none is health authorization, its helper returns true before participationEnded and skips signer-evidence checking. This existing legacy behavior needs an explicitly approved basis, not an assumption that the product field migrated consent.

Evidence: [selector:46](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/consentPolicy.ts:46), [server document selection:3423](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/pulsecheck-escalation.js:3423), [legacy fallback:5](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/lib/clinical-authorization.js:5).

Next: review the retained terms with the program/governance owner; approve any revised document set/version before triggering reacceptance. Do not modify historical signed evidence. The separate alternate clinical endpoint bypass findings remain open.

Conditional additional mismatch: if a PulseCheck team stores current stock v1 health terms, the client transforms them to v1-pulsecheck while the server routine gate compares raw v1/body. That can reject a valid new client receipt. The present four legacy team arrays are a different case; no claim is made that this conditional mismatch affected a live handoff.

### C05 · P2 · Open sessions can keep stale consent context

Web's gate effect depends on user/loading/marketing, not organization updates. iOS refresh exits when onboarding context already exists. Native foreground hooks help when no active context blocks refresh but do not prove safe mid-form changes.

Evidence: [web dependencies:501](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/PulseCheck.tsx:501), [iOS refresh guard:1184](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/ContentView.swift:1184), [Android foreground loading:650](/Users/tremainegrant/Documents/GitHub/PulseCheck/android/app/src/main/java/com/fitwithpulse/pulsecheck/MainActivity.kt:650).

Next: validate current scope/document revision before submission; refresh or invalidate stale form state. Exercise an already-open sheet, foreground, restart and a second device with synthetic accounts.

## Tests and remaining device work

Completed: 10 web consent/access tests; 6 clinical/product tests; 6 Android consent tests; 15 extracted Swift assertions; six product/document parity comparisons across all three sources; one local-rules and one exact-deployed-rules consent-event emulator test; two privacy-comparison tests. The privacy comparison tests pass by proving the deployed allow/local deny behavior, so their green status is evidence of a defect, not a security pass. Synthetic access-gate reproduction likewise confirms a defect.

All emulator work used isolated `demo-` projects and port 8197, not the already occupied 8188. [Commands](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/deliverables/cohort-readiness-2026-10-18/consent-test-commands.txt) and logs are saved alongside this report. Extracted Swift checks exercise the model only, not the compiled app or rendered screen.

The available browser inventory contained staff/admin context, not a verified isolated athlete session. A booted iOS simulator has PulseCheck installed; launching it can automatically refresh notification state and sync health data, so it was not used with an unknown account/environment. No Android device was attached. These are concrete limits on safe runtime verification.

To close the remaining proof: provide or establish two isolated athlete accounts in a designated test environment, one per product, plus the exact released iOS/Android builds. Verify fresh enrollment, old and current receipts, optional decline, already-open session, config-read failure, reopen, and persisted receipt/event agreement. Any test that actually accepts/submits consent or changes enrollment needs separately authorized synthetic fixtures; this request authorized verification without those writes. Device proof should follow the source/rules fixes and approved legacy-term decision, not substitute for them.
