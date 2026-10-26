# Baseline 28 continuation: candidate validation

October 25, 2026. Continue from the original handoff; this is not a production release approval.

## Team-join baseline review (October 26)

The latest user instruction supersedes the old account-wide skip rule for **new athlete team joins**. Each new active athlete membership gets a separate baseline requirement after entry onboarding/consent. A completed historical baseline for the original team stays complete. Invite retries preserve the same join marker; a reactivated membership receives a new marker. Team-code, invitation and administrative-transfer paths record that marker.

The server selects pending joins from authenticated membership records and binds all writes to the displayed review ID. Drafts, retry reservations, submission IDs and final review records are scoped to that join. Old baseline records remain intact; the prior starting profile is retained in the server-owned review assignment before edits. Multiple pending teams are confirmed separately. Consent and health sharing are evaluated for the current team and are never preaccepted from another team.

Web team onboarding opens the shared baseline automatically, and the athlete workspace checks the server requirement before trusting cached progress. After confirmation the web flow checks for another pending team and otherwise returns to the team workspace. Both baseline URLs use the isolated intake shell.

The shared form labels available answers as prefilled, allows edits, and offers **Accept answers for this team**. Only retained performance answers and explicitly reported experience are available for prefill. External health references cannot reconstruct the 19 protected answers, and no new protected-answer storage or invented values were added. Missing health answers are identified explicitly. Unanswered experience stays unknown.

iOS observes membership changes and rechecks the baseline, preserving server-only completion verification and remounting the embedded form when the required review changes. Android refreshes on membership changes and onboarding completion; a previous account completion cannot override a new requirement, and failed checks offer retry. Android currently presents the existing required-baseline dialog and opens the shared assessment in the browser; iOS embeds the shared assessment.

Candidate checks: 45 API/content/profile regressions, 23 baseline/health/profile policy tests, 12 offline real-form scenarios and three actual-workspace route scenarios, TypeScript and scoped ESLint passed. The provisioning service's four pre-existing unused-symbol lint findings remain unchanged. Native build/test and hosted-build receipts are recorded separately when complete. The protected-answer custody, actual UMES recipient and physical-device release gates below remain unresolved; no production release is authorized by this candidate validation.

## October 26 continuation

Both requested branches and both `origin/main` refs were fetched. The web production ancestor remains `46ace5a748e1fa85e73b51e21e7bda4c5d2b6c74`; native remains at candidate `2516269619947b66f72dbd94327d92b012315dc5`. Earlier baseline and native validation below applies to those preserved implementations. No new native source change or physical-device proof is claimed.

The prior conversation was read to verify the user's direct instruction to defer AuntEdna and use named clinical staff for escalations. No later answer settling protected-answer custody or supplying a UMES contact was found. Those decisions were requested again; neither has been assumed.

Web commit `33ad1fdaaf13eef5bd1ee02e0b87dd570ac3edc7` fixes two clinical-contact integration issues: deactivation now uses the saved contact rather than requiring valid unsaved form edits, and the form shows the saved route returned by the server after activation/deactivation. Revision checks and audit writes remain enforced. Deactivation ignores submitted contact edits and preserves the saved recipient.

Validation for that change: six admin API tests passed, the real mobile-width contact component passed draft/activation/deactivation/stale-revision checks, 78 delivery/escalation tests passed, TypeScript passed, scoped ESLint passed, and whitespace checks passed. The browser regression includes an invalid unsaved email followed by successful deactivation without transmitting contact edits. No real recipient was activated and no email or SMS was sent.

Hosted Git build `6adf497cb656b586c4e2a871` completed with ready deploy `6adf497cb656b586c4e2a873` for that exact branch commit. Candidate: https://6adf497cb656b586c4e2a873--quickliftsapp.netlify.app/PulseCheck/baseline. No local Netlify production upload was used. These documentation updates were committed after the hosted code build.

The candidate baseline entry initialized and rendered its sign-in screen. Anonymous baseline API access returned 401. An authenticated read of the candidate's UMES Golf clinical-staff API returned 200, with the new `currentRoute: hotline` response, no saved contact, email configured and SMS unconfigured. The existing operator has no assignment; no assignment or protected submission was created to test the live database. Actual protected-answer delivery and live alert delivery remain unverified.

Production was rechecked through Netlify: deploy `6ade484ca99d20b6b4b435d9` remained ready at `46ace5a748e1fa85e73b51e21e7bda4c5d2b6c74`. The signed-in production provisioning dashboard rendered UMES and its existing coach-surveys controls. The development iPhone is still listed as unpaired by Xcode. Production publication, actual protected-answer delivery and physical iPhone sign-in/consent/return-to-training remain release gates.

### Web fallback and sign-in audit

The athlete web entry is `/PulseCheck/baseline`; saved records use the authenticated Firebase UID shared with the apps. Eligibility still requires the actual team/onboarding context. The approved 28-item release remains the candidate above, pending the protected-answer destination. Fixed the login page's return handling so both already-signed-in users and completed sign-ins preserve `/PulseCheck/baseline`, alongside the historical questionnaire path. Arbitrary external return destinations remain rejected. This later login fix is not part of the hosted `33ad1fdaa` build and has not been published to production.

The coach entry is an individually issued `/PulseCheck/coach-survey/baseline#token=…` link. Provisioning verifies the coach UID and team and puts that identity into the private invitation; the submitted response gets identity from that invitation. The general coach URL without its private token is insufficient. The link is a bearer capability, not authenticated proof of the respondent; forwarding it permits another person to submit for the linked account.

Live read-only checks found coach collection enabled in production and a tokenless baseline API response of 401. Admin writes and manual email switches are unset, as is the configured coach-survey origin. UMES Golf has zero coach enrollments and zero invitations. No invitations, enrollments, messages, accounts or grants were created by this audit. Coach link provisioning is not ready for rollout solely because the form is deployed.

The production Identity Platform configuration reports email authentication enabled and `signIn.email.passwordRequired: true`. Email/password is enabled; passwordless email-link authentication is disabled ([configuration semantics](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config)). The live login page nevertheless defaults to Magic link; its presence does not establish that it works. No email was sent and no actual institutional-mailbox sign-in round trip was performed. A saved institutional contact address is not automatically an authentication alias for a Google/Apple account. No phone-number sign-in implementation was found in the current web/native entry points; SMS alert delivery is a separate feature.

The actual login component passed five offline browser scenarios: existing session, password sign-in, simulated email-link completion, historical baseline return and external-return rejection. Firebase methods were mocked and all external requests blocked. These tests establish return-path behavior, not live email/SMS authentication. TypeScript, scoped login-page ESLint and whitespace checks passed.

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
- Baseline, version/history/migration, provider contract, profile, designated staff and escalation Node tests: 149 passed. Dedicated final logs are under `/tmp/baseline-*-tests.log` on this machine. The separate legacy clinical-escalation suite passed all nine tests with the TypeScript loader. Nora engagement and red-team gates also passed.
- Consent/access/profile policy tests: 34 passed.
- Published developer artifact/schema tests: 10 passed.
- Firestore emulator atomic-consent tests: 21 passed, including re-consent, signer/scope rejection, individual decisions, receipt preservation, retries and injected write failures.
- Real shared baseline component in offline Chromium: seven scenarios passed; 20 questionnaire prompts + eight experience ratings, mobile widths 320/390/430, enlarged text, interrupted final submission, off/decline/unready behavior, prior completion and native session bridge. No external traffic or clinical submissions.
- iOS simulator: PulseCheck full application build plus six focused health-policy/crisis-copy/combined-gate tests passed. The first attempt required installing Apple's missing Metal toolchain; a later compiler timeout was repaired in MainTabView. Physical device testing is not established; the attached development phone is unpaired.
- Android: PulseCheck and AthleticMind each passed 226 unit tests across 40 suites and debug assembly. AthleticMind also passed its full iOS simulator build. No physical-device delivery evidence is claimed.
- The actual provisioning clinical-contact component passed offline save/activate/deactivate and stale-request browser checks. No real email or SMS was sent.
- Baseline completion targets its own trusted Netlify deployment. The origin is baked into the Next API bundle at build time because Netlify does not expose DEPLOY_URL automatically at function runtime. Unit checks cover preview/production host validation and fallback behavior.
- Both repositories: scoped diff and whitespace checks passed.

## Live state inspected, read-only

Production Netlify site `quickliftsapp` / `05a6cac5-9994-4883-9e90-5adb69528bda` remained at deploy `6ade484ca99d20b6b4b435d9`, commit `46ace5a748e1fa85e73b51e21e7bda4c5d2b6c74`. Its repository/main configuration is correct. Signed-in production provisioning renders the UMES organization and its existing designated-clinical-staff draft form. Coach surveys remain present.

Verified UMES Golf team: `fc02cbd64a7fefd5adc97701482fe2d9b147f48ea6dd56168622132824475f95`. Organization: `9b72a5f5a31c1a16c91138ca9e7f8fa1d0c57b7062ef56851479274245fc0351`. Both active, AthleticMind brand. The team still has hotline routing and no saved designated contact. Brevo email credentials are present; Twilio SMS and outbound AuntEdna baseline credentials are absent.

## Hosted candidate receipt

Netlify hosted Git build `6ade69a117f6495918d971e2` produced ready branch deploy `6ade69a117f6495918d971e4` for web code commit `86014adab719074a9c66be422c9be26646770bde`. Native candidate commit is `2516269`. Both are pushed on `codex/baseline-28-health-checkpoint-2026-10-25`; main was not changed. This document was updated afterward to record evidence, without changing deployed code.

Exact candidate: https://6ade69a117f6495918d971e4--quickliftsapp.netlify.app/PulseCheck/baseline

The actual hosted baseline entry rendered and completed account initialization to its sign-in screen. Anonymous baseline API access returned 401. A read-only request authenticated as the existing operator returned 200 from the designated-clinical-staff admin API for UMES Golf: contact absent, email configured, SMS not configured. Authenticated baseline submission was not exercised on the live database; the operator had no existing assignment and none was created for testing. Offline browser and emulator checks provide the save/consent evidence, not a live protected-answer receipt.

Production remained on deploy `6ade484ca99d20b6b4b435d9` / commit `46ace5a748e1fa85e73b51e21e7bda4c5d2b6c74`. No production publication or local Netlify upload was performed.

## Remaining release decisions and evidence

1. **Protected baseline-answer custody:** the handoff prohibits storing the 19 protected answers in Pulse. With AuntEdna deferred, the user has been asked whether to explicitly authorize the existing restricted Pulse storage for clinical staff, or defer those questions. No answer has been assumed. Current code does not store them locally and must not be released as a finished default-on 28-item experience until that destination is settled.
2. **UMES contact:** the real primary clinical staff name, work email, phone and coverage hours have been requested. Do not fabricate or activate a recipient. No real or synthetic live alert has been sent.
3. Complete the resulting health delivery/deferral path and its tests, then use a hosted Netlify Git build. Do not run a local production upload. Preserve newer main changes and existing coach-surveys work.
4. Verify the published candidate identity and actual signed-in baseline/provisioning flow. Real alert confirmation requires a controlled authorized recipient; mocked delivery is not live delivery evidence.
5. Physical iPhone sign-in/consent/return-to-training remains separate from simulator build/test proof. Pair the development phone before claiming physical-device parity.
