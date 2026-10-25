# Baseline 28 continuation: candidate validation

October 25, 2026. Continue from the original handoff; this is not a production release approval.

## User steering after the checkpoint

The user clarified that no provider is connected and AuntEdna is deferred. The requested current clinical route is the program's designated clinical staff member, entered by name, work email and phone in provisioning.

The existing contact UI was draft-only. The candidate adds explicit activation/deactivation and actual minimal email alerts, with SMS when Twilio is configured. Contact configuration does not grant record access. Coverage is respected; a backup email is attempted only after confirmed primary delivery failure. The acknowledgment window remains a planning note; timed reminders and clinician-response confirmation are not implemented or claimed. Unknown send outcomes are held for reconciliation rather than blindly duplicated. Incidents pin the contact revision; later edits cannot reroute or resend an existing case. Scope and contact configuration are rechecked in the transaction before each outbound channel.

Tier 2 still requires the current health authorization and event-specific acceptance. Tier 3 retains the independent safety basis, crisis wall and urgent resources. Staff notifications contain athlete name/contact information and an incident reference, with no conversation, journal or baseline answers. Only a channel acknowledgment with a message ID establishes that an alert was sent. Suppression and skipped sends do not count as delivery. iOS and Android distinguish staff alerts from provider receipt and clinician response.

No production contact, billing/access setting, consent receipt, clinical record or provider credential was changed during this continuation.

## Completed candidate work

- Current content is 20 questionnaire prompts plus eight experience ratings. The 19 protected prompts remain exactly equal to the preserved previous standard content. Goal q46 and all other stable IDs remain unchanged.
- Historical completion remains satisfied. Unfinished v1 drafts project name, goal and prior experience read-only into v2, revision zero; obsolete current-state/challenge fields do not migrate. Outbound submission IDs now include the content version as well as the trusted assignment identity.
- New v6 starting profiles remain unscored. Unanswered familiarity remains unknown through the answered-field list. Genuine cached task observations are retained separately when clearing broad taxonomy claims.
- Baseline UI uses program policy independently of provider readiness. Missing delivery never silently turns health off. A pending decision opens an in-place exact-terms consent flow, including the iOS embedded browser and individual athletes. Acceptance requires a typed signature; decline/revocation does not fabricate one.
- Team decisions reuse the existing atomic consent transaction and append-only evidence. Individual decisions use the existing client-denied private-user boundary. No protected baseline-answer storage was added.
- Scope validation verifies athlete identity, role, membership, team, organization and pilot ownership. The old membership fallback cannot choose another organization's policy or provider connection.
- Web, iOS and Android apply team override → organization default → on. Health-off consent preview counts now reflect active documents while retaining saved forms and historical receipts.
- Native charcoal background changes are preserved. The iOS tab-bar builder was split into smaller expressions after the full build exposed a compiler type-check timeout; appearance and interactions are preserved.
- Downloadable questionnaire, schema, examples and developer documentation match the 28-item content. Future AuntEdna configuration requires an explicit server-owned organization/team/code/credential approval mapping; none is activated.

## Validation evidence

- TypeScript: passed after dependency installation from the frozen pnpm lockfile.
- Scoped ESLint: passed. Repository-wide lint has 398 existing findings outside this change; no blanket cleanup was attempted.
- Baseline, version/history/migration, provider contract, profile, designated staff and escalation Node tests: passed. Dedicated final logs are under `/tmp/baseline-*-tests.log` on this machine.
- Consent/access/profile policy tests: 34 passed.
- Published developer artifact/schema tests: 10 passed.
- Firestore emulator atomic-consent tests: 21 passed, including re-consent, signer/scope rejection, individual decisions, receipt preservation, retries and injected write failures.
- Real shared baseline component in offline Chromium: seven scenarios passed; 20 questionnaire prompts + eight experience ratings, mobile widths 320/390/430, enlarged text, interrupted final submission, off/decline/unready behavior, prior completion and native session bridge. No external traffic or clinical submissions.
- iOS simulator: PulseCheck full application build plus six focused health-policy/crisis-copy/combined-gate tests passed. The first attempt required installing Apple's missing Metal toolchain; a later compiler timeout was repaired in MainTabView. Physical device testing is not established; the attached development phone is unpaired.
- Android: PulseCheck and AthleticMind unit tests/debug assembly passed. No physical-device delivery evidence is claimed.
- Both repositories: scoped diff and whitespace checks passed.

## Live state inspected, read-only

Production Netlify site `quickliftsapp` / `05a6cac5-9994-4883-9e90-5adb69528bda` remained at deploy `6ade484ca99d20b6b4b435d9`, commit `46ace5a748e1fa85e73b51e21e7bda4c5d2b6c74`. Its repository/main configuration is correct. Signed-in production provisioning renders the UMES organization and its existing designated-clinical-staff draft form. Coach surveys remain present.

Verified UMES Golf team: `fc02cbd64a7fefd5adc97701482fe2d9b147f48ea6dd56168622132824475f95`. Organization: `9b72a5f5a31c1a16c91138ca9e7f8fa1d0c57b7062ef56851479274245fc0351`. Both active, AthleticMind brand. The team still has hotline routing and no saved designated contact. Brevo email credentials are present; Twilio SMS and outbound AuntEdna baseline credentials are absent.

## Remaining release decisions and evidence

1. **Protected baseline-answer custody:** the handoff prohibits storing the 19 protected answers in Pulse. With AuntEdna deferred, the user has been asked whether to explicitly authorize the existing restricted Pulse storage for clinical staff, or defer those questions. No answer has been assumed. Current code does not store them locally and must not be released as a finished default-on 28-item experience until that destination is settled.
2. **UMES contact:** the real primary clinical staff name, work email, phone and coverage hours have been requested. Do not fabricate or activate a recipient. No real or synthetic live alert has been sent.
3. Complete the resulting health delivery/deferral path and its tests, then use a hosted Netlify Git build. Do not run a local production upload. Preserve newer main changes and existing coach-surveys work.
4. Verify the published candidate identity and actual signed-in baseline/provisioning flow. Real alert confirmation requires a controlled authorized recipient; mocked delivery is not live delivery evidence.
5. Physical iPhone sign-in/consent/return-to-training remains separate from simulator build/test proof. Pair the development phone before claiming physical-device parity.
