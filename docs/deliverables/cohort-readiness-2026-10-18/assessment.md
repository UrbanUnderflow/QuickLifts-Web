# PulseCheck and AthleticMind cohort readiness audit

> Current launch status: [launch-gate matrix](launch-gates.md). This document preserves the earlier audit/remediation evidence; consult the matrix for subsequent fixes and remaining release dependencies.
> Current follow-up: see [scoped remediation report](remediation-report.md). Production membership rules and four legacy team agreement corrections are now verified; web/native fixes and their distinct release/verification status are recorded there. The observations below are the historical audit baseline, not a claim that all remain unchanged.

Date: October 18, 2026 (America/New_York). Initial audit scope: read-only source, focused local tests, deployment metadata, public HTTP checks and aggregate production configuration. A subsequent explicitly authorized correction updated only organization productBrand at 09:28 ET. No deployment, message, enrollment or clinical transfer was performed.

## Verified configuration correction · October 18, 09:28 ET

The user explicitly assigned Clark Atlanta University to AthleticMind and every other existing organization to PulseCheck. The saved Clark Atlanta record was uniquely identified as `0mXTn4DUYYL7t2K9AzZP`. One atomic batch updated only `productBrand`, guarded by each document's read version. Every organization was read back and compared against its entire prior document; no other field changed.

| Organization | Verified productBrand |
| --- | --- |
| Clark Atlanta University | athleticmind |
| The Athletic Mind Council | pulsecheck |
| Building Bodies | pulsecheck |
| Hampton University Athletics | pulsecheck |
| Tremaine Coaching | pulsecheck |
| HyperCharge Wellness | pulsecheck |
| 4D Cycling | pulsecheck |

All 10 teams were checked through the current server resolver against live records: Clark Atlanta's 3 teams resolve to AuntEdna; the other 7 resolve to 988. These are routing-configuration results, not delivery confirmation. Nine focused product/branding tests passed. The current missing-product count is **0/7**.

Recoverable field-level [before-state](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/deliverables/cohort-readiness-2026-10-18/product-brand-before.json) and [verified readback](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/deliverables/cohort-readiness-2026-10-18/product-brand-verified.json) are saved without credentials. appBranding and all other organization fields were preserved; membership and consent records were not written.

**Consequences and remaining work:** six organizations now explicitly select the PulseCheck/988 product instead of the previous implicit AthleticMind fallback. Clark Atlanta explicitly qualifies for AthleticMind consent scoping. Existing incident routes are preserved by the current incident resolver; this change neither rewrites cases nor confirms delivery. Stock consent selection can change for PulseCheck, while customized documents remain preserved. Previously accepted evidence was not changed: review the actual terms/version refresh and any required reacceptance on web/iOS/Android, including cached configuration. Product choice alone does not change display branding. R01's existing-record gap is corrected; inconsistent missing/invalid defaults and future-provisioning safeguards still require code work. All other launch blockers remain open.

## Consent verification follow-up · October 18, 09:32 ET

The [standalone consent verification report](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/deliverables/cohort-readiness-2026-10-18/consent-verification.md) supersedes the earlier “consent refresh unverified” status with specific results. No further production writes occurred.

- Mapping remains correct. Standard web/iOS/Android documents match exactly. Revised stock PulseCheck terms require new exact receipts under the intended/native policy; Clark Atlanta's matching existing terms remain valid under that policy without a new signature solely from product assignment.
- Four PulseCheck teams retain v3 agreements mentioning AuntEdna (two active, two ready-for-activation). They are preserved by the selector and do not automatically gain a separate health decision. Review these before claiming consent migration complete.
- Synthetic checks reproduce a web legacy participation-receipt bypass and confirm read-failure/open-session refresh gaps. See C02–C05 in the follow-up.
- **New P1 deployment finding:** downloaded active Firestore rules differ from local rules. Isolated emulator tests against the exact deployed source confirm protected consent-event records, but permit unrelated signed-in users to read parent membership consent summaries. Local rules deny the same request. This is not an observed production exploit. Prepare scoped reconciliation with supported-client testing; do not blindly deploy all local differences.
- Released authenticated browser/device save-and-reopen behavior remains unverified because no isolated athlete session/environment was established and no Android device was connected. No real consent evidence or enrollment was changed.

## Decision

**Hold broad cohort expansion until the P1 findings below are resolved and the exact released web/iOS/Android combination passes controlled cohort journeys.** There is a substantial working foundation: organization/team structure, transactional server provisioning, separate product/display identity, consent evidence, role-scoped rules, native onboarding, and controlled main support routing. The main weaknesses are inconsistent enforcement across alternate paths, incomplete recovery from partial failures, and missing release evidence.

A supervised adult US pilot is a possible next stage only after its applicable P1 controls pass and someone owns onboarding, incident response and failed-delivery reconciliation. This audit does not establish that an existing cohort is experiencing a breach, that every record represents a real customer, or that the product is production-ready. It identifies reproducible source-level failure paths and current configuration gaps. Do not activate a care-dependent AthleticMind cohort based on branding, a successful email send, or a provider simulation.

| Area | Assessment | Practical meaning |
| --- | --- | --- |
| Provisioning and enrollment | Strong foundations, incomplete recovery | Server transaction exists; the main wizard and invitation replacement use different, non-atomic paths. |
| Product selection and white labeling | Existing records corrected; safeguards remain open | Seven organizations now explicitly configured. Future missing/invalid defaults remain inconsistent; native consent refresh and display behavior still need verification. |
| Permissions and clinical handoff | Expansion blocker | Main route is guarded; an alternate Admin SDK endpoint bypasses key context/consent checks, and its responder queue conflicts with restrictive rules. |
| Athlete app | Requires fixes and released-device proof | Android logout leaves push tokens; iOS membership-read failure can bypass refresh; onboarding completion has partial-write gaps. |
| Operations, monitoring and closure | Incomplete evidence | Monitoring code exists, but current delivery receipts, on-call response, full cohort closure and data-deletion completion are unverified. |
| Public AthleticMind site | Reachable; care capability must be substantiated | Published revision matches source. Marketing illustrates a care journey that needs an actually operable recipient and acknowledgement pathway. |

## Evidence and limits

Audited revisions:

- QuickLifts-Web: `052189804b42a6f1a4f873d54de9f15aef90c63b`. Unrelated pre-existing PipeLists changes were preserved.
- PulseCheck: `1fad4157ac57c6f6fd86af6e03cf906af9d6e9f1`. Canonical Android code is in this repository's `android/`, per its instructions; the separate Pulse-Android directory was not treated as the shipping source.
- AthleticMind-Web: `9baa6390560e99317c1aa61930630c7b3ca155ec`.

Initial read-only production observations from Firebase project `quicklifts-dd3f1` (before the correction above):

- 7 organization documents: 5 active, 2 ready-for-activation; **7/7 missing productBrand**, 0 with appBranding overrides.
- 10 team documents: 5 active, 3 ready-for-activation, 2 provisioning; all point to an existing organization. Team-level productBrand absence is not independently a defect because organization configuration is authoritative.
- 69 membership documents: 20 `active`, 2 `removed`, 47 with no `status`. This is a migration inventory signal, not proof of 47 unauthorized memberships: legacy status normalization must be checked before remediation. No athlete content was needed for these counts.
- Update modal `company-config/pulsecheck-app-update-modal.isEnabled` is false. Both `pulsecheck-version` and `pulsecheck-versions` contain version `2.15`, critical true, no build number. This does not establish what builds athletes currently run. Current client critical-update precedence also means modal disabled alone does not prove all critical notices are disabled.

Netlify API reports published deploys in `ready` state:

| Site | Published deploy | Commit | Created (UTC) |
| --- | --- | --- | --- |
| fitwithpulse.ai | `6ad0f9aa0394ace6ef91567b` | QuickLifts revision above | 2026-10-15 16:04:58 |
| theathleticmind.ai | `6ad2d24d9572266f24570ef0` | AthleticMind revision above | 2026-10-17 01:41:33 |

Both public home URLs returned HTTP 200 during this audit. Deployment commit metadata does not prove the currently installed Firestore rules, runtime secret configuration, every function's behavior, or signed-in workflows. No native app-store distribution status, physical-device journey, provider delivery, browser-rendered authenticated dashboard, or rules-emulator exercise was verified here.

Local validation:

- 39 provisioning/product/branding/removal/invite-management cases passed; this includes rechecking the earlier 12 product cases.
- 79 security/clinical cases passed after rerunning a loader-dependent helper suite with `--import tsx`; one stale source assertion failed because it expects staff access now intentionally denied by rules.
- 30 Nora engagement-policy cases passed.
- 13 focused Android unit tests passed: branding 3, consent policy 6, sport/auth payload 4.
- Seven invite-redemption-error cases failed before meaningful handler assertions because the temporary runtime could not resolve consent defaults JSON. This is a validation harness gap, not proof the deployed handler cannot load the file.
- No broad build, iOS compile, simulator or physical-device validation. Passing mocks and source checks are narrower evidence than permission or delivery tests against an actual deployment.

## Ranked findings register

The original 18 findings below are supplemented by the five consent findings C01–C05 in the follow-up report. C01 is a newly verified deployed-rule privacy gap, while several others deepen existing findings.

P1 means block affected cohort expansion until fixed and verified. P2 means resolve before unattended scale or explicitly constrain a supervised pilot. Findings are source-confirmed unless labeled configuration observation or verification gap. Security findings were not exploited against production.

### R01 · P1 · Existing-record product gap corrected; default safeguards remain open

**Journey/failure:** enrollment → terms → support. `normalizeProductBrand` treats missing/invalid values as AthleticMind, but the web AthleticMind consent gate requires explicit `configuredProductBrand === 'athleticmind'`. Stock consent selection also retains existing documents unless PulseCheck is explicit. A record can therefore imply different product treatment at different surfaces. The initial live 7/7 absence was corrected by the authorized field update above. Every current organization now has explicit productBrand; missing/invalid fallback inconsistency remains in source and could recur for future programs.

**Evidence:** [productConfig.js:6](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/lib/pulsecheck/productConfig.js:6), [consentPolicy.ts:34](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/consentPolicy.ts:34), [consentPolicy.ts:49](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/consentPolicy.ts:49).

**Fix/validation:** require explicit product choice for new programs; assign each legacy organization from confirmed program intent, never name/logo inference. Share one unknown/mixed-state policy across web, server and native. Test explicit products, missing/invalid config, multi-organization membership and product changes with existing incidents. Treat appBranding as presentation only. The authorized existing-record correction is complete. Further code changes and consent migration require separately scoped implementation.

### R02 · P1 · Alternate clinical endpoint trusts caller-selected team

**Journey/failure:** athlete concern → clinician. Identity is checked, but an athlete can provide a foreign team ID; the server resolves that team's clinician, delivers supplied evidence and returns clinician contact details. Clinician selection also omits revocation and assigned-athlete scope checks. Admin SDK writes bypass client rules.

**Evidence:** [record-clinical-escalation.js:143](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:143), [identity/context:329](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:329), [delivery:466](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:466), [response:578](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:578).

**Fix/validation:** resolve active athlete membership and organization status server-side, then responder scope. Foreign, archived, revoked and assigned-out cases must produce no clinical writes or delivery. Test using isolated synthetic identities.

### R03 · P1 · Alternate clinical route bypasses routine transfer consent

**Journey/failure:** routine support request → disclosure. The same endpoint accepts tiers 1/2/3 and captures only a best-effort root-user consent snapshot before delivery. It does not enforce the current health authorization and named-recipient event consent used by the main handoff.

**Evidence:** [accepted tiers:341](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:341), [non-blocking consent:380](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:380).

**Fix/validation:** restrict this endpoint to its approved emergency purpose or reuse the canonical authorization policy. Test refused, revoked, expired and missing health authorization; mismatched document versions/bodies; recipient mismatch; both products. Keep the emergency safety basis distinct from routine permission.

### R04 · P1 · Clinician acknowledgement path conflicts with rules

**Journey/failure:** notification → queue → acknowledgement. Clinical emails link to a queue that reads and updates clinical records directly, while rules deny staff reads/acknowledgements of AthleticMind or Tier 3 records. Privacy restrictions should remain intact; the responder workflow needs a compatible access model.

**Evidence:** [email URL:311](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:311), [staff queue:201](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/staff/clinical-escalations.tsx:201), [ack write:396](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckClinicalEscalation.ts:396), [rules:549](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/firestore.rules:549), [rules:2188](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/firestore.rules:2188).

**Fix/validation:** provide a minimal responder projection with authenticated server acknowledgement or verified provider receipts. Prove scoped responder access and cross-team denial in emulator and signed-in candidate walkthroughs. A sent email is not acknowledgement or completed care.

### R05 · P1 · Retry can turn failed clinical delivery into deduped success

**Journey/failure:** channel outage → retry. Any matching dedupe record is returned immediately, even if paging or safety activation failed after the record was created. Retry does not resume the failed stage; concurrent query-then-create requests can also duplicate incidents.

**Evidence:** [dedupe lookup:127](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:127), [early return:359](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:359), [write:437](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:437), [failure responses:552](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/record-clinical-escalation.js:552).

**Fix/validation:** transactional incident claim with persisted per-stage status and resumable delivery. Inject email, SMS and safety-write failures; prove retry repairs the failed stage without repeating successful deliveries, and distinguish recorded/paged/acknowledged/resolved.

### R06 · P1 · Invite-accepted sender accepts unauthenticated recipient/content

**Journey/failure:** enrollment notification. Public POST parses caller-provided coach email and names then invokes branded email delivery without identity or persisted membership validation; it bypasses the daily recipient limit. This is an abuse-capable source path, not evidence of observed abuse.

**Evidence:** [handler:159](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/send-pulsecheck-invite-accepted-email.ts:159), [send:214](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/send-pulsecheck-invite-accepted-email.ts:214), [limit bypass:249](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/send-pulsecheck-invite-accepted-email.ts:249).

**Fix/validation:** require internal authenticated invocation and derive recipient/content from the committed enrollment. Unauthenticated, spoofed-recipient and replay requests must not send; actual enrollment must produce one authorized notification.

### R07 · P1 · Invite callback destination comes from untrusted Origin

**Journey/failure:** valid invitation redemption with coach notification enabled. Server posts athlete/coach contact and team context to a URL built from the request Origin. An authenticated request satisfying the new-join prerequisites can choose that destination. The unawaited callback also has no durable recovery after redemption succeeds.

**Evidence:** [redeem.ts:940](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/api/pulsecheck/team-invite/redeem.ts:940).

**Fix/validation:** use an internal call or fixed trusted destination and durable outbox. A forged Origin must receive nothing; notification outage followed by replay must deliver once without repeating enrollment. Scope the data sent to what the recipient needs.

### R08 · P1 · Android logout leaves previous account's push token

**Journey/failure:** athlete A signs out, athlete B uses the device. Android writes installation token into A's user record, then signs out without unregistering it. Server reminders still read the legacy field, so A's notifications may reach the same installation after B signs in.

**Evidence:** [PulseCheckApplication.kt:70](/Users/tremainegrant/Documents/GitHub/PulseCheck/android/app/src/main/java/com/fitwithpulse/pulsecheck/PulseCheckApplication.kt:70), [PulseCheckAuthClient.kt:481](/Users/tremainegrant/Documents/GitHub/PulseCheck/android/app/src/main/java/com/fitwithpulse/pulsecheck/PulseCheckAuthClient.kt:481), [server consumption:110](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/scheduled-mental-assignment-reminder.ts:110).

**Fix/validation:** authenticated device ownership with unregister-before-logout and offline failure handling; migrate legacy token senders. Test A logout → B login, offline logout and token rotation on a physical Android device. iOS already unregisters before signout.

### R09 · P1 · iOS membership-read failure can bypass consent refresh

**Journey/failure:** existing entitled athlete opens the app while membership fetch fails. Error becomes an empty membership list, then no onboarding context, then subscription access can release the athlete UI. Required refresh is indistinguishable from no membership.

**Evidence:** [ContentView.swift:1914](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/ContentView.swift:1914), [empty context:1564](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/ContentView.swift:1564), [access gate:1320](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/ContentView.swift:1320), [release:1371](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/ContentView.swift:1371).

**Fix/validation:** preserve explicit unresolved/error state until authoritative membership/configuration resolves. Test newly required terms for an entitled account under denied reads, offline launch and stale cache. Android's main loader already exposes retry rather than resolving the failure as no membership.

### R10 · P1 · iOS account deletion is not complete data closure

**Journey/failure:** athlete requests deletion. Settings calls native deletion, which handles a small set of top-level collections then deletes Auth. Nested data and cohort/intake/health records are not covered by that path. No auth-delete cleanup was located in the inspected function sources. Separately, the web delete-account handler only covers users recursively and FitWithPulse workout sessions.

**Evidence:** [SettingsView.swift:132](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/Views/Settings/SettingsView.swift:132), [native orchestration:2441](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/Services/PulseCheckFirebaseService.swift:2441), [collection coverage:2516](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/Services/PulseCheckFirebaseService.swift:2516), [web handler:18](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/delete-account.ts:18).

**Fix/validation:** durable server-owned closure job, approved retention exceptions, inventory of nested/top-level/storage/provider records and retry progress. Test interrupted closure and >500 records; confirm membership, notification and entitlement revocation. Do not promise complete erasure without proving the applicable disposition. Android deletion parity remains unverified.

### R11 · P2 · Onboarding completion is split across writes

**Journey/failure:** consent completion interrupted by a later write failure. iOS writes global completion before consent/member/pilot completion; Android can complete membership before user/pilot completion. Reload can hide the remaining onboarding context; retries can append new audit event IDs.

**Evidence:** [iOS completion:1784](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/Views/Onboarding/PulseCheckAthleteTeamOnboardingView.swift:1784), [iOS subsequent writes:1822](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/Views/Onboarding/PulseCheckAthleteTeamOnboardingView.swift:1822), [Android completion:196](/Users/tremainegrant/Documents/GitHub/PulseCheck/android/app/src/main/java/com/fitwithpulse/pulsecheck/PulseCheckTeamOnboarding.kt:196).

**Fix/validation:** atomic bounded completion or server idempotent workflow with repair state. Fail each write boundary, restart, retry and prove consent evidence, membership, user and pilot converge.

### R12 · P2 · Configuration read failures silently select fallback terms

**Journey/failure:** consent screen opens with failed organization/pilot read. Native clients suppress these errors and fall back to operational/null-brand behavior, retaining stock AuntEdna documents unless PulseCheck is explicit.

**Evidence:** [ContentView.swift:1576](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/ContentView.swift:1576), [Android config reads:254](/Users/tremainegrant/Documents/GitHub/PulseCheck/android/app/src/main/java/com/fitwithpulse/pulsecheck/PulseCheckTeamOnboarding.kt:254), [Android consent selection:99](/Users/tremainegrant/Documents/GitHub/PulseCheck/android/app/src/main/java/com/fitwithpulse/pulsecheck/PulseCheckTeamInviteClient.kt:99).

**Fix/validation:** do not present signing as resolved configuration until the authoritative product and study posture load. Test denied pilot read, missing brand and stale terms separately from intentional research decline.

### R13 · P2 · Provisioning wizard does not use the transactional creation path

**Journey/failure:** administrator creates organization/team, loses response or reloads. Wizard keeps organization ID only in React state and calls separate random-ID creates. Existing transactional server provisioning does not protect this UI path.

**Evidence:** [wizard:1908](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/admin/pulsecheckProvisioning.tsx:1908), [team create:1977](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/admin/pulsecheckProvisioning.tsx:1977), [service org create:3148](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/service.ts:3148), [service team create:3272](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/service.ts:3272).

**Fix/validation:** persisted operation/draft ID and idempotent server creation. Simulate lost acknowledgements, repeated submits, refresh/back and intentional same-name separate customers. Distinguish provisioned shell from launch-ready cohort.

### R14 · P2 · Invite replacement revokes first, creates later

**Journey/failure:** replace activation/invite link → write failure. Existing links are revoked before replacement exists; parallel requests can create multiple active links.

**Evidence:** [admin replacement:3536](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/service.ts:3536), [team replacement:3840](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/service.ts:3840), [new write:3883](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/pulsecheckProvisioning/service.ts:3883).

**Fix/validation:** atomic replacement with deterministic operation ID; fault-inject between revoke/create and race concurrent replacement requests.

### R15 · P2 · Legacy clinical authorization bypasses ended participation check

**Journey/failure:** offboarded/misconfigured athlete → routine transfer. Helper returns true for absent health documents before checking participationEnded; main caller only applies the helper with a team ID.

**Evidence:** [clinical-authorization.js:5](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/lib/clinical-authorization.js:5), [main invocation:3419](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/pulsecheck-escalation.js:3419).

**Fix/validation:** reject ended participation first; require an explicit approved legacy basis rather than absence as permission. Test missing team/docs, withdrawn membership and archived cohort independently of emergency routing.

### R16 · P2 · iOS display branding refresh is tied to authentication

**Journey/failure:** athlete joins a team while already signed in or organization display configuration changes. Only auth-listener refresh was located, so display can remain stale until an authentication change.

**Evidence:** [AppBrandingService.swift:23](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/Services/AppBrandingService.swift:23); [Android foreground refresh:431](/Users/tremainegrant/Documents/GitHub/PulseCheck/android/app/src/main/java/com/fitwithpulse/pulsecheck/MainActivity.kt:431).

**Fix/validation:** refresh on membership change and foreground while preserving stale-response/account guards. Test both installed app identities, signed-in redemption, switching accounts and conflicting memberships.

### R17 · P1 release gate · Released client/rules/care-delivery compatibility remains unproven

**Journey/failure:** distributing new cohorts into a mixed population of app versions. Current release checklist explicitly leaves exact production candidate and oldest supported released-binary gates unresolved. Live update feed is still 2.15 without build identity. Published web commit matches source, but this does not establish matching rules, native distribution, enabled partner capability or verified care receipts.

**Evidence:** [nora-release-checklist.md:1](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/nora-release-checklist.md:1), [VersionService.swift:196](/Users/tremainegrant/Documents/GitHub/PulseCheck/PulseCheck/Services/VersionService.swift:196), live observations above.

**Fix/validation:** freeze release matrix and test oldest supported released binary through real available store update. Verify protected saves, denied cross-account writes, live route configuration and authorized recipient acknowledgement. Preserve restrictive privacy rules; plan compatibility rollout rather than opening permissions. Partner simulation cannot close this gate.

### R18 · P2 · Test harness and stale assertion obscure meaningful regressions

**Journey/failure:** prelaunch validation. Seven redemption tests cannot load consent JSON; one rules source assertion expects access intentionally removed. These failures reduce confidence in the exact paths most important for onboarding and clinical access.

**Evidence:** [redemption test:14](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/tests/api/pulsecheck/team-invite-redemption-errors.runtime.test.cjs:14), [runtime harness:37](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/tests/api/firebase-admin/_runtimeHarness.cjs:37), saved test logs in this directory.

**Fix/validation:** preserve JSON assets in compiled fixture runtime; update the assertion to the intended privacy model and add real emulator denial/acknowledgement tests. Require all selected checks to execute rather than count setup failures as behavior failures.

## What already works and should be preserved

- Server provisioning transaction protects organization/team ancestry and rejects reassigning an existing team: [provisionOrganizationAndTeam.js:492](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/lib/server/pulsecheck/provisionOrganizationAndTeam.js:492).
- Authenticated branding resolver validates active membership/team/org context; mixed context retains app identity. Product behavior comes from persisted team→organization, not logos or caller-supplied product claims: [program-product-config.js:3](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/lib/program-product-config.js:3).
- Main routine handoff verifies current health authorization and signer-owned evidence before reading conversation content. Main emergency route suppresses coach notification and requires explicit enablement plus verified live bridge receipt: [pulsecheck-escalation.js:3334](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/pulsecheck-escalation.js:3334), [authorization:3418](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/pulsecheck-escalation.js:3418), [receipt:3576](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/pulsecheck-escalation.js:3576), [coach suppression:3720](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/pulsecheck-escalation.js:3720). Older assumptions about core Tier 3 coach delivery are superseded by this source.
- Consent events are signer-owned and append-only; native comparison includes version/body and distinguishes health authorization and optional research decisions. Keep participation, processing, health authorization, research, routine named-recipient sharing and emergency routing separate.
- Athlete removal has transactional pilot withdrawal, entitlement reconciliation with other memberships and audit evidence: [remove-athlete-from-team.ts:279](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/api/admin/pulsecheck/remove-athlete-from-team.ts:279).
- Nora has a canonical role/safety contract and passing local policy checks. This is meaningful engineering evidence, not measured clinical effectiveness or proof of live-model behavior.
- Protocol monitoring has a six-hour schedule and delivery-failure logging: [netlify.toml:689](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify.toml:689), [monitoring:555](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/netlify/functions/scheduled-pulsecheck-protocol-monitoring.ts:555). Current successful runs and operator response were not verified.

## Pre-cohort launch checklist

Each item needs a named owner, candidate revision/build, date and attached evidence. A checked code review alone cannot close a live/device item.

1. **Program configuration:** explicit product for every launching organization; verified team ancestry/status, display identity, age/country scope, study posture, responder configuration and staff role/athlete scope. Resolve legacy records deliberately.
2. **Access and disclosure:** fix R02–R07; negative tests across teams/products and removed staff; consent refusal/revocation/expiry/version update; no research enrollment from willingness alone; minimum necessary named-recipient handoff; separately verified emergency basis.
3. **Athlete onboarding:** both platforms, both products, new/existing account, signed-in invite, expired/revoked/reused invite, interruption/reopen, declined optional terms, denied config reads and changed consent. Confirm all completion records agree.
4. **Support operations:** real configured recipient, coverage hours, escalation timeout, backup owner, failed-delivery alert and acknowledgement receipt. Confirm athlete copy distinguishes recorded request, delivery and human follow-up. Do not send real messages as an unauthorised audit test.
5. **Release compatibility:** exact backend, rules, web, iOS, Android and minimum supported versions; actual store availability; older supported binary upgrade and protected saves; rollback that preserves privacy.
6. **Device behavior:** push permission denied/granted, A→B account switch, offline logout, notification previews, microphone/media permissions, stale wearable data, background/reopen. Fix R08/R09 before expansion.
7. **Lifecycle:** membership removal and full cohort closure revoke invites/staff access, stop recurring reminders/sharing, reconcile entitlements, and apply approved retention/deletion. Verify iOS closure and Android parity.
8. **Monitoring:** cohort-level enrollment/consent completion, assignment failures, API authorization/error rate, failed/aged handoffs, push failure and stale wearable data. Exercise one synthetic failure and verify the responsible person sees it.
9. **Governance:** named approval for retention, minors safeguarding, non-US resources if applicable, vendor processing and full-thread sharing. These remain open decisions in [Nora contract §13](/Users/tremainegrant/Documents/GitHub/PulseCheck/docs/nora/NORA_CONTRACT.md); do not silently expand beyond its pilot constraints.
10. **Customer-facing promises:** compare the actually enabled care pathway to [AthleticMind public care journey:35](/Users/tremainegrant/Documents/GitHub/AthleticMind-Web/public/athleticmind/index.html:35) and clinical workspace claims at line 53. Confirm partner access and follow-through or constrain the cohort offer accordingly.

## Staged remediation and practical improvements

**Stage 1: remove expansion blockers.** Engineering/security owns canonical clinical authorization, responder projection/acknowledgement, durable delivery, invite sender/callback protection and native gating/push ownership. Product/implementation owner confirms every organization's intended product and terms. Exit: P1 regression tests pass and reviewed migration plan exists; no speculative migration based on logos.

**Stage 2: make enrollment resumable.** Unify the wizard with idempotent server provisioning, atomic invite replacement and server-owned onboarding completion. Add a small launch preflight screen showing explicit product, current terms, active responder, support mode, supported app builds and pending setup errors. “Created” and “ready to enroll” should be separate states. Exit: lost-response/restart/concurrent-submit tests converge without duplicate organizations, memberships or notices.

**Stage 3: prove the released journey.** Fix the validation harness, run permission emulator coverage, freeze candidate matrix and execute synthetic end-to-end journeys on actual iOS/Android devices. Verify deployed rules and authenticated dashboards, partner acknowledgement and failed-stage recovery under separately authorized delivery testing. Exit: evidence packet for each product/platform, including oldest supported build.

**Stage 4: supervised cohort then measured expansion.** Assign one onboarding owner and one support-operations owner. Watch enrollment conversion, time to complete required decisions, assignment delivery failures and unacknowledged handoff age. Set acceptable thresholds before launch, then review a complete onboarding/support cycle before increasing cohorts. Use the canonical Proof Package definitions for outcome reporting; do not substitute app activity counts for clinical effectiveness or weekly coverage measures.

**Stage 5: operational closure and maintenance.** Durable cohort offboarding, approved data retention/deletion jobs, periodic staff-access review, stale-device cleanup, config drift alerts and a release compatibility inventory. Review open governance decisions before adding minors, countries or new disclosure purposes.

## Remaining uncertainties

This audit does not establish which organizations are real/current launch candidates, whether absent membership status is legitimate legacy state, full deployed-rule behavioral coverage beyond the consent checks above, responder credentials/coverage, live partner receipts, app-store rollout/adoption, physical-device behavior, all library exercise parity, data backup/restore recovery, storage/provider deletion or complete tenant isolation across every legacy endpoint. These are explicit verification work items, not inferred successful controls. No production exploitation was attempted. Source fixes are recommendations only and require a separate implementation task. The sole production change was the explicitly authorized seven-organization productBrand correction recorded above.
