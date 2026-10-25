# Coach surveys: local implementation and release holds

Implemented on isolated branch `codex/coach-survey-flows`, starting from `ae65088fa522ad4317a103c35b4b8b016d59061b`. No push, merge, deploy, credentials, grants, real recipients or sends performed. Existing UMES onboarding is unchanged. `_app.tsx` adds only two exact standalone coach route matches so these pages do not initialize shared auth/analytics/Firebase clients.

## Content and local review

- `/PulseCheck/coach-survey/baseline?review=1`: six approved firsthand readiness/process/needs questions, exclusive “No consistent process” / “Nothing currently”, up to three priorities, optional Other text, free-writing comments.
- `/PulseCheck/coach-survey/check-in?review=1`: two approved questions about usefulness and whether AthleticMind informed a coaching action during the past three weeks; includes non-use choices and free-writing comments.
- Review mode exists only in Next development. It uses memory only and explicitly confirms nothing was saved. Production ignores `review=1`.
- Original Portrait ten-item source is retained in `questionnaire.ts` for provenance. The new flows are operational feedback, not Dr. T's source instrument, a validated clinical questionnaire, or a Support Environment index. No scoring or diagnostic interpretation.
- Source history: Sept22 “Onboarding Moving Forward”, `Portrait_CAU_Athlete_Support_Stakeholder_Questionnaires (1).docx`, pages 2–3. Original monthly frequency superseded by user’s 21-day request. The initial proposed three-item subset was superseded by the approved two firsthand-experience questions.

## Collection and linkage

All records live under the existing server-only collection `pulsecheck-restricted-questionnaire-submissions/coach-surveys-v1`, with subcollections `invitations`, `responses`, `periods`, `enrollments`, `delivery-packets`, `deliveries`, and `stop-tokens`. Current checked-in rules deny client reads/writes recursively and exclude this collection from the broad signed-in fallback. No rules changed. Verify deployed rules before enabling collection; local source inspection is not deployed-rule evidence.

Public entry uses an opaque random 256-bit bearer token in a URL fragment, immediately scrubbed from history. Only the SHA-256 token digest identifies the invitation document. The token travels to the API via Authorization, never query strings. Do not add analytics, link tracking or third-party scripts to these routes. Verify mail/text providers preserve fragments and disable link tracking before launch. Links are bearer capabilities; forwarded links can submit, but can never retrieve answers. If stronger recipient identity is required, decide on authenticated sign-in before release.

The server sets participant/program/period/baseline linkage from trusted invitations. An immutable response and period claim are created together in a Firestore transaction. Duplicate clicks, network retries, concurrency and reissued links for one period cannot overwrite or create another response. The API returns only completion status, never answers. Check-ins require a matching completed baseline. A stopped enrollment prevents periodic submission. Refresh after token removal requires reopening the original message link; answers remain only while the page is open. No localStorage of answers. Comments cap at 1,000 characters and Other text at 300, with clear privacy hints.

## Delivery setup

`prepareCoachSurveySetup` prepares a reviewable baseline invitation and periodic enrollment entirely in memory. Both are disabled; it performs no writes or sends. Baseline links must be provisioned by an authorized administrator after verified coach identity and program affiliation. Do not log generated setup bundles. The coach survey controls are embedded in `/admin/pulsecheckProvisioning` under each team’s **Coach surveys** card; its API is `/api/admin/pulsecheck/coach-surveys`. Both admin reads and writes remain gated off for release. `coachSurveyStatus` keeps baseline completion, periodic paused/scheduled/stopped state, and last delivery state separate in that administrative surface.

Enrollment IDs are deterministic per participant/program to prevent duplicate campaigns for the same coach. Enrollment requires: verified coach UID, program/team IDs, baseline response ID, selected email/SMS destinations, per-channel consent and recipient verification evidence, suppression state, explicit first send date, IANA timezone, local hour, pilot end date, and approved message version. End date is mandatory; stopping sets `enabled=false` and `stoppedAtMs`. The stop link requires a confirming POST; link scanners cannot unsubscribe through GET. Stop applies to both channels for that enrollment. In-flight provider acceptance cannot be recalled.

The hourly Netlify function is disabled by `DELIVERY_RELEASE_APPROVED=false` plus `COACH_SURVEY_DELIVERY_ENABLED`. Its dependencies and Firebase initialize only after both gates pass. The runner uses 21 calendar days from the explicit first periodic date, preserving local time across DST. It sends only on that calendar date at/after the chosen local hour; outages spanning the date are not automatically caught up. Maximum pilot capacity is 100 enrollment records; larger collections fail closed until pagination is reviewed. Only current-period deliveries run, no historical burst.

Each enrollment/period has one token shared across selected channels. The delivery packet contains raw bearer links in the denied private namespace so retries use the same invitation. Define retention/cleanup for these packets and stop tokens before launch. Per-channel transaction claims plus Brevo idempotency prevent normal duplicate dispatch. Provider acceptance followed by process failure remains `sending`/`uncertain` and is held for manual reconciliation, never automatically resent. Only known pre-provider errors retry, at most three attempts and one hour apart within the due date. Pauses, destination changes, consent/suppression state and active coach/team/organization access are rechecked before dispatch. A completed baseline is required.

Brevo uses the existing `sendBrevoTransactionalEmail`, including fail-closed account-deletion suppression, global idempotency and existing recipient daily limits. No bypass is enabled. Twilio uses the existing `sendTwilioSms`, with `SMS_RELEASE_APPROVED=false` pending provider registration/verification. The local webhook `/api/pulsecheck/coach-survey/sms-webhook` uses the official Twilio SDK to validate all parameters against the configured exact HTTPS URL, account and recipient sender number. STOP creates a phone-hashed global coach-SMS suppression; duplicate MessageSids are ignored. START records opt-in intent but never resumes a campaign or erases STOP. HELP does not change suppression; empty TwiML sends no reply. SMS dispatch requires a verified clear suppression record, enabled webhook reception, renewed channel checks and release approval. Admin setup can initialize clear state after explicit provider verification, but cannot clear an existing STOP. No provider account, purchase, key or permission was created.

Draft email: subject “Your AthleticMind coach check-in”; body “Your three-week AthleticMind coach check-in is ready. Share your experience in two questions, with space for additional thoughts.” Links: “Open your coach check-in” and “Stop these check-ins”.

Draft SMS: “AthleticMind: Your 3-week coach check-in is ready: [link] Reply STOP to opt out. Manage check-ins: [stop link]”. Review message text, sender identity, SMS length/multipart behavior, consent and first-send details before enabling.

## Remaining release actions and approvals

1. Confirm exact coaches/verified destinations, channel choice per coach, consent, first periodic date/local hour/timezone, and pilot end/stop owner. Decide whether cadence is fixed program-wide or anchored to each baseline completion (current code uses explicit per-coach first periodic date).
2. Approve message wording, sender identity, bearer-link model, private schema/retention, authorized results audience and provisioning UI/workflow. Private results are available only through the existing same-environment admin-document authority; no new role grants were introduced.
3. Confirm deployed deny rules and public endpoint rate-limit protections for the reused namespace; run Firestore emulator security/transaction tests. Current tests use synthetic in-memory transactions, not a live/emulator Firebase connection.
4. Register and verify the implemented signed SMS opt-out webhook and provider link tracking/fragment behavior with synthetic provider sandbox checks. Keep SMS held until done. Decide missed-run/manual reconciliation operations and retention cleanup.
5. Review and release the implemented authenticated admin provisioning/status/results surface, then create only approved private enrollment records. Admin writes additionally require `COACH_SURVEY_ADMIN_WRITES_ENABLED=true`. Neither a public configuration endpoint nor live grants were added.
6. Review scoped changes against current security/onboarding branch, perform production compilation in release environment, then obtain explicit push/merge/deploy and enablement approval. Enable collection via `COACH_SURVEY_COLLECTION_ENABLED=true` only after storage review; choose server Firebase mode explicitly. Delivery remains separately gated. No automatic baseline message sending implemented.

## Validation

Run `node --test tests/unit/coach-surveys.test.cjs` and `node node_modules/typescript/bin/tsc --noEmit`. Local browser QA is in `tests/e2e/coach-surveys-local.cjs` (requires local Next on 127.0.0.1:3217; all non-local requests blocked). Screenshots are in `output/coach-surveys/`. No synthetic data reaches real Firebase or messaging providers.

### Local results (2026-10-25)

- 13/13 targeted synthetic unit/API checks passed, including withheld collection access, validation, concurrent/duplicate/reissued submissions, wrong/expired/stopped links, baseline linkage, DST cadence, per-channel idempotency, uncertain-outcome holds, retry cap and disabled setup preparation.
- Repository `tsc --noEmit` passed after final implementation changes.
- Chromium local QA passed at 320/390px mobile and 1280px desktop: keyboard radio navigation, exclusive choices, three-choice cap, both completion paths, missing-link state, token scrubbing, failed-submit answer retention and successful retry. Zero browser page errors. All non-local requests were blocked; submission API was intercepted with synthetic responses for failure/retry.
- Firestore emulator tests, live admin provisioning/results, real provider sandbox sends, and real-device verification remain unperformed. Full production build was attempted; see continuation results below.
- Original checkout had concurrent athlete baseline/onboarding edits by completion; none were touched or copied into this isolated branch.


## Administration and SMS continuation

`/admin/coachSurveys` now redirects to the existing provisioning dashboard. There is no separate survey administration portal. The embedded panel receives the selected team and its pilots directly; operators never enter raw team or program IDs. Production uses the existing application shell; the API independently verifies a revoked-token-aware identity and an existing `admin/{email}` record in the same server-selected Firebase environment. It rejects account closures and has no localhost bypass or cross-project fallback. Active coach/team/organization affiliation is required for setup, links and enablement. Existing enrollment pause/stop remains possible after membership removal. Private responses are rendered as escaped text, with baseline, campaign and last-delivery state shown separately.

The administrator selects account-backed contacts, attests destination verification and channel consent, records an evidence reference, and saves paused settings. Reissuing a baseline link atomically revokes the old link; completed baselines cannot be reissued. Configuration actions create private audit events. Delivery enable remains hard-blocked by release approval. Stopped enrollments and SMS STOP records cannot be resumed merely by saving settings; a renewed-consent restart remains a separate operational decision.

The Twilio SDK was added as `twilio@^6.2.0`; nested lockfile resolution preserves every pre-existing package version. Local dependencies were isolated rather than installing into the original checkout. Signature tests use only a synthetic secret. Guidance: [Twilio webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security) and [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out).

Additional release configuration, not applied: `COACH_SURVEY_SMS_WEBHOOK_ENABLED=true` and `COACH_SURVEY_TWILIO_WEBHOOK_URL` must match the exact registered HTTPS endpoint. Existing Twilio account/token/from-number variables are reused. Keep opt-out reception enabled independently of paused delivery after launch. No webhook was registered and no sender/provider settings were changed.

Read-only deployed-rule verification was attempted for `quicklifts-dd3f1` using the existing Firebase CLI session. It stopped before a network request because the local access token was missing or expired. No refresh, permission change or secret disclosure occurred. Minimum evidence: a current authorized Firebase CLI session, or an owner-supplied deployed `cloud.firestore` release/ruleset export proving recursive deny and fallback exclusion for the reused namespace. Status: blocked pending authentication/evidence, not denied by approval review.

### Continuation verification (2026-10-25)

- **22/22 synthetic unit/API tests pass.** Added same-project admin authorization/revocation checks, paused provisioning, link replacement, audit events, removed-member stop, team/program-scoped private results, official-SDK signature acceptance/tamper rejection, STOP dedupe/START hold, initial provider-state synchronization, and default-disabled admin/webhook routes.
- **TypeScript passes** after the administration and webhook additions; `git diff --check` passes.
- **Full Next production build attempted:** type validation and optimized compilation succeeded; page-data collection failed for the existing `/HaveYouPaid` route because the isolated checkout has no production Firebase public configuration. No credentials or environment files were borrowed. External font optimization also warned because network access was restricted. Full-build success is not claimed; rerun in the authorized release environment.
- Mobile review includes the private administration setup, separate baseline/campaign status, and synthetic response display. The browser test is local-only and blocks external requests.
- No live reads of response data, live provisioning, webhook registration, permission changes, email/SMS sends, or deployments were performed.

### Preview access check

Inspected the user's Library screenshot locally. It shows the baseline page still rendered while the in-app browser address field reports “Couldn’t open this address” for the periodic URL. The server remained running. Opened both exact preview URLs in fresh, visible Mac in-app browser tabs and verified their rendered headings and controls; kept both tabs open as deliverables. No tunnel, deployment, restart or access-permission change was required. The screenshot alone does not establish the cause of the failed address-bar navigation.


## Provisioning integration correction

At the user's request, management now lives in the existing provisioning dashboard's team card, beside Coach report delivery. `TeamCoachSurveys` reuses provisioning controls and receives team/pilot context. Backend setup rejects pilots belonging to another team. Periodic delivery additionally requires an active provisioning pilot that has not ended. The original coach-facing questionnaire routes remain unchanged. The obsolete standalone admin route redirects to provisioning, and its custom application-shell bypass was removed.

An isolated synthetic component browser test verifies the embedded panel at mobile size, pilot selection, private results and disabled delivery. This is component verification, not a signed-in live provisioning session. No original-checkout onboarding changes were touched.

### Final integration verification

- 25/25 targeted tests pass; TypeScript and `git diff --check` pass.
- Embedded provisioning panel browser fixture passes: team context, pilot dropdown, private response display, release gate and mobile layout. Coach-facing baseline/check-in browser regressions also pass.
- Full production build now passes (exit 0), using only the 12 existing `NEXT_PUBLIC_FIREBASE_*` / `NEXT_PUBLIC_DEV_FIREBASE_*` public web configuration fields supplied directly to the build child process. No credentials or environment files were copied and no authentication refresh occurred. The earlier missing-public-config build blocker is resolved.
- Signed-in live provisioning and deployed-rule verification remain unperformed. The deployed-rule authentication blocker and release approvals remain unchanged. No deployment or delivery enablement occurred.

## Approved development user test — October 25

After explicit action-time approval, re-read the current development rules, compiled a narrow change, rechecked the release for concurrent changes, and updated only `quicklifts-dev-01` / `cloud.firestore`. Added recursive direct-client deny for the coach survey namespace and excluded it from the signed-in fallback. Verified release ruleset `aff6562b-e652-47b2-b6cb-282d099d5c44`. Ten synthetic Rules API evaluations (anonymous and signed-in get/list/create/update/delete) passed their DENY expectations; authorized server lookup of a nonexistent synthetic response returned 404, confirming access rather than a permission failure. Production rules were not changed.

Built the isolated artifact with `scripts/build-coach-survey-user-test.cjs`: only the two survey pages and collection handler; fixed development Firebase selection; no scheduled or sending function. Deployed a draft alias on existing Netlify site quickliftsapp, without replacing production: `https://coach-survey-user-test--quickliftsapp.netlify.app`. Latest deploy at this checkpoint: `6ade3392a8f8f3d6cffd19b2`. No shared Netlify environment values were changed.

Created exactly two user test invitations in the private development namespace, expiring `2026-11-01T16:50:47.794Z`, with synthetic participant/program identifiers and no recurring enrollment. Bearer links are retained outside the repository in a mode-0600 local manifest. Both HTTPS page routes return 200. The baseline invitation GET returns 200/completed:false. The periodic invitation GET returns 409 requiring the baseline first, as designed. Neither invitation was submitted/consumed. 25/25 local synthetic unit tests pass.

Automatic approval review denied creation of two additional QA invitations beyond the two approved user links. That operation did not execute; issuance was narrowed to exactly the approved pair. Additional deployed synthetic submission testing is pending explicit approval for a separate QA pair. Email/SMS have not been sent. The preview currently contains the coach-facing routes only; signed-in results in the existing provisioning dashboard still require completion/verification of the development administration test path. Do not describe the end-to-end test or delivery as completed.

### QA and one-time delivery continuation

Fresh explicit approval permitted the separate QA pair. Both deployed API POSTs returned 200/completed:true. Development readback confirmed one baseline with six answers and one check-in with two answers, both with the synthetic QA comment; the user's pair remained unused at that check. No messages were sent for QA invitations.

Added a development-only private test-results section inside the existing provisioning dashboard, behind the same admin API authorization; it filters the fixed test program and two synthetic participant IDs. No role or membership grants. TypeScript and 26 synthetic unit tests pass. This code is local; the survey-only HTTPS artifact does not include the provisioning dashboard.

Exactly one Brevo email was accepted for the approved user destination. Subsequent provider events confirm delivered (2026-10-25T17:00:30Z); no resend. Provider message ID and outcome are retained in the private local send journal. The initial attempt failed before the provider because Firestore initialization rejected a custom SDK credential; the exact idempotency record was checked absent before correcting the supported OAuth Firestore client and sending with the same key.

SMS was not dispatched: the required existing TWILIO_ACCOUNT_SID lookup returns HTTP404 for site-scoped and account-shared Netlify configuration, and no legacy site value was present. No send claim or provider request occurred. No credentials, provider account, sender, or configuration were created or changed. Broad credential preflight was rejected by automatic review; a narrower actual-send path limited to the three necessary Twilio settings was allowed but stopped at this missing configuration.

## Provisioning cadence, manual baseline delivery and sticky progress

Inspected all three user-provided screenshots locally. Progress now sticks to the viewport top after scrolling, with device safe-area padding and scroll margins for focused controls. Both forms pass 320/390/1280px sticky/focus/overflow checks. The sticky change alone was published to the approved isolated test alias; production is unchanged.

Local provisioning now has a team interval control and per-coach overrides (1–365 whole days), defaulting to 21 days. Reset returns to inheritance. Effective interval/source and next configured date appear alongside each enrollment; paused/stopped state remains explicit. A cadence change begins a fresh full interval from the change's local calendar date, never a catch-up send. Team changes affect only inheriting coaches. Existing invitations retain their issued recall days; new invitations, questions and email wording use the effective interval. Calendar cadence preserves local send hour across DST. All recurring gates remain off.

Baseline provisioning now offers Copy baseline link, explicit confirmed Regenerate, and Preview baseline email followed by Send baseline email. Copy reuses a valid unconsumed private invitation; completed/expired status is shown. Regeneration revokes the old invitation. Preview shows the account-backed recipient and exact message; a server-computed confirmation fingerprint detects changed recipients/links/copy before sending. Manual sends require the additional COACH_SURVEY_MANUAL_EMAIL_ENABLED gate, default off, and the existing authenticated admin/write gates. No automatic baseline send was added. Account contacts, team membership and pilot linkage remain checked server-side.

Coach email HTML and text templates use the parent-provided separate baseline/check-in prose. Baseline begins “Please complete this short baseline questionnaire.” The periodic recall phrase follows the interval, default “past three weeks”. Both include the approved button and Manage survey reminders link. Templates are prepared, not newly sent. The initial combined internal test email remains the only sent email; no SMS was sent.

34 targeted tests pass, including inheritance/reset, STOP preservation, DST/overdue changes, cross-team isolation, interval snapshots, send idempotency, baseline-link reuse/replacement and default-off manual email. TypeScript passes. Provisioning's synthetic mobile component test passes. A new full build is in progress at this checkpoint; the preceding full build passed. Signed-in provisioning verification remains outstanding. Separate coach-facing test emails await explicit send approval and a working test reminder-management destination; the existing user test pair has no recurring enrollment and must not be falsely presented as one.

The cadence/manual-control full build completed successfully (exit 0). Separate baseline and check-in HTML/text previews passed mobile rendering and are saved in output/coach-surveys. The one-time test reminder footer now has a development-only no-write path: an existing, unexpired test invitation can confirm reminders are off without creating enrollment or changing responses. Normal enrollment STOP behavior is unchanged. TypeScript and all 34 tests pass after this small route addition. The isolated preview update containing that route is underway; verify completion before issuing coach-facing preview emails. Those emails are still pending explicit approval.

### Terminal preview verification

Final isolated test deploy completed: `6ade394ae87e2af4aa3f492d`. Verified served sticky/focus CSS and POSTed the existing synthetic QA capability to the reminder route: HTTP200/stopped:true. This test-only branch performs no writes. Readback confirms both QA completions remain present, userResponseCount=0, and testEnrollments=0. No new tokens or messages were created during this verification.

36 local synthetic tests pass, including recipient-backed baseline preview, stable reused invitation confirmation, changed-contact fingerprint, explicit expired-link regeneration and completed-baseline refusal. The updated provisioning route loads on `http://127.0.0.1:3218/admin/pulsecheckProvisioning` with development configuration supplied to the server process only; admin writes/manual sends are disabled. Browser visibly shows “Sign in to continue”. Exact existing development admin authority was verified for `tremaine.grant@gmail.com`; `tre@fitwithpulse.ai` has no existing development admin record. No grants changed.

Signed-in UI verification is pending user sign-in at that URL. Live cadence/copy actions additionally lack a provisioned synthetic team/coach enrollment: the approved QA pair deliberately has no enrollment. Those mutations were tested locally with synthetic in-memory team/coach fixtures, not against real coaches. Do not create roles/memberships or use real coach data to overcome that gap without approved scope.
