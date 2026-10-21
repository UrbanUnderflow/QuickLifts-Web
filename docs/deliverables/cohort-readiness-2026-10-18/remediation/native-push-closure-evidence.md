# Native, push ownership, and account closure remediation evidence

Updated 2026-10-18. Native candidate source committed as `97a2aa8`. Source and local evidence; production deployment is coordinated separately by the parent audit.

## Implemented

- iOS and Android team onboarding progress and completion call the authenticated `pulsecheck-consent-save` function with current scope and full document content. No native consent event/member/user completion sequence remains in those paths. HTTP409 refreshes changed context; existing stock/custom requirements and optional declines remain.
- iOS foreground and membership changes refresh persisted display branding. Cross-user coach identity readers use the minimized public-profile API; offerings use an explicitly published coach-offerings projection. Android unavailable private metrics render unavailable instead of invented zeros.
- Android installation IDs, canonical token ownership, logout suppression, persistent pending rotation, auth/generation checks, and owner-tagged data-only delivery prevent stale previews across account switches. Canonical server sender paths replace legacy profile-token fallbacks. Generic FWP senders reject tokens associated with PulseCheck installations without suppressing unrelated FWP-only tokens. Copied snapshot tokens with no current owner mapping fail closed after logout.
- Closure requests require recent auth, atomically persist a durable server-only job and closing marker, and disable/revoke Auth. Scheduled cleanup resumes in bounded pages, recursively deletes owned records and tokens, preserves signer/clinical evidence pending retention disposition, and keeps a minimal closed user tombstone plus durable job. Native screens truthfully say closure requested, not complete erasure.
- Local Oura/WHOOP/Polar/Google Health connection and OAuth credentials, health source/snapshot/revision/trace records and jobs are included. Provider sync batches and token persistence transactionally read the closure job, preventing recreation after cleanup. Provider-held records and backups remain a retention/revocation review dependency.

## Local validation

- Android 198 unit tests plus debug assembly pass after public-profile changes and API36 bump.
- Signed release bundle5 (1.0.4), targetSDK36, existing RevenueCat dependency resolves Billing8.0.0. Signature verification passed. SHA256 `90a4251ccf614370c09efb6a6b14552d1913625e3498d3affda45efd1693566c`.
- Fresh Android AVD `Cohort_Clean_API36`: install and cold start succeeded; process remains running, no AndroidRuntime crash. No existing athlete account was used.
- iOS simulator build succeeds after profile/offerings changes. Existing phone-to-consent UI overlay test passes on new isolated iPhone17/iOS26.5 simulator (injected saves, not backend persistence). Final Release arm64 archive2.28(2) succeeded from committed source97a2aa8 with established Apple Development identity persisted at `/Users/tremainegrant/Documents/Codex/2026-10-18/cohort-release/PulseCheck-iOS-2.28-build2-97a2aa8.xcarchive`; automatic distribution export is blocked.
- 14 coach messaging contract tests, 46 provider regressions, 5 account-closure tests, 9 installation/generic ownership tests, and 31 existing push regressions passed. Closure fixtures cover601 records, interrupted cleanup, retained signer evidence, isolated other user, and closure between fetch and transactional persist.
- 59 changed/new JavaScript files syntax checked. No live records were deleted and no participant push/message was sent.

## Evidence limits

- Native atomic consent save/reopen has not been exercised against a real or emulator-authenticated athlete session. Native has no existing Firebase emulator transport/sign-in fixture. Existing iOS phone-to-consent harness tests layout with injected saves, not server commit. Server atomic transaction tests are separate evidence.
- Play production was verified at4(1.0.3), internal testing at1; all bundle codes1–4 only. Candidate5 avoids a collision. Upload status is recorded below when complete.
- App Store Connect showed public2.25 and an updated Apple Developer Program License Agreement requiring Account Holder acceptance. TestFlight navigation then required renewed Apple sign-in. No agreement accepted and no iOS upload performed.
- Account closure intentionally ends in `retention_review`, not total-erasure completion. Remote provider-held copies, clinical/consent retention, and backups need approved disposition.

## Firebase deployment exports

`sendCoachAthleteMessageNotification`, `scheduledDailyReflection`, `sendTestReflectionNotification`, `onCurriculumAssignmentCreated`, `onCurriculumAssignmentUpdated`, `scheduledDailyReminder`, `scheduledCheckpoints`, `sendNewUserJoinedChallengeNotification`, `onChallengeStatusChange`, `sendWorkoutStartNotification`, `onMainChallengeStatusChange`, `sendDirectMessageNotification`, `sendRoundTableNotification`, `sendRoundTableNotificationAlt`, `sendClubChatNotification`, `sendCheckinCalloutNotification`, `handleReferralBonus`, `sendChainReactionNotification`, `sendSingleNotification`, `onCoachNotificationCreated`, `onPulseCheckTeamShowingUpSprintUpdated`.

The generic notification logger's log-only users are unaffected; do not deploy unrelated exports merely because they import logging utilities.

Production discovery during scoped deployment found six exports were not previously present: `onCurriculumAssignmentCreated`, `onCurriculumAssignmentUpdated`, `scheduledDailyReminder`, `scheduledCheckpoints`, `sendTestReflectionNotification`, `scheduledDailyReflection`. Their source is hardened but they must remain inactive rather than introducing new participant delivery workflows. The other15 exports are the existing production delivery surface. Parent deployment evidence owns final remote state.

## Android upload verification

Play accepted signed bundle5(1.0.4), targetSDK36, into the existing Internal testing track, draft release2. Preview and confirm presents no blocking error and enables Save and publish. Four nonblocking warnings: existing advertising-ID declaration/active manifest mismatch,17 fewer supported devices compared with old internal1, larger APK, and missing native debug symbols. No policy declaration was modified. Final internal availability is held until matching web endpoints are verified ready. Public production remains4(1.0.3).

Draft review: https://play.google.com/console/u/1/developers/7852596421344603650/app/4974345885339372269/tracks/4700322704264765603/releases/2/review

## Persisted release artifacts

- Android: `/Users/tremainegrant/Documents/Codex/2026-10-18/cohort-release/PulseCheck-Android-1.0.4-code5-97a2aa8.aab`; SHA256 `90a4251ccf614370c09efb6a6b14552d1913625e3498d3affda45efd1693566c`.
- Final iOS archive zip: `/Users/tremainegrant/Documents/Codex/2026-10-18/cohort-release/PulseCheck-iOS-2.28-build2-97a2aa8.xcarchive.zip`; SHA256 `fc75191dec7ae138d9d3cea6c69ea2fa88c3000bd3524a649c516e1cab2d6005`. Unzipped archive also retained.
- Checksums and export options/status are in the same directory. Automatic App Store export feasibility failed with `Unable to process request - PLA Update available` and `No signing certificate iOS Distribution found`. Existing automatic provisioning cannot obtain distribution signing until Account Holder reviews/accepts the updated Apple Developer Program License Agreement. No IPA or Apple upload.
- Final server push ownership guard is committed as `59a047253`; parent coordinates matching deployment. Android publication remains held pending final endpoint readiness verification.

## Final bounded personal-data inventory followup

Cleanup now includes `conversationSummaries` and `dailySentimentAnalysis` by userId, `state-snapshots` and `conversation-derived-signal-events` by athleteId, `pulsecheck-morning-checkins` by athleteUserId, plus recursive `mental-check-ins/{uid}` and `user-mental-notes/{uid}`. Clinical and consent evidence retention is unchanged. Shared Nora caller verification checks revoked tokens and the durable closure job. Both `nora-save-conversation` and `nora-save-derived` commit through the transactional closure guard, so closure during classification cannot recreate deleted records.16 focused tests pass, including other-user preservation, closed caller rejection, midflight write prevention, and normal owner writes. Native97a2aa8 artifacts and Play draft are unchanged. Main chat conversation, state, signal, reminder-preference, and coach-handoff personal writes now use the same transactional closure guard. Imported assignment rematerialization receives a scoped database adapter that guards direct, batched, and transactional writes. Cleanup additionally covers mental-exercise-assignments and sim-assignments by athleteUserId and pulsecheck-training-plans by athleteId. New query targets are appended, preserving persisted cleanup step indexes. The combined Nora runtime, engagement, endpoint persistence, and closure suite passes 77 tests; fixtures include delayed assignment writes, prior job resumption, other-user preservation, and closed caller rejection. Clinical incident records retain their existing retention behavior.

Parent verification: the separate Nora storage rules suite passed 2/2 with the configured isolated emulator (`/tmp/cohort-final-nora-storage-rules.log`). The final web candidate is `84832b2f6`; final publication and Android internal availability are tracked in `../launch-gates.md`.

## Final Android internal distribution — 2026-10-18 14:53 UTC

After the parent verified web commit `84832b2f6` published and passed live endpoint checks, published the existing validated internal release **5 (1.0.4)**. Google Play Console shows the internal track **Active**, latest release **5 (1.0.4)**, **Available to internal testers**, released Oct 18 at 10:53 AM Eastern. Reload confirmed the same available status. Production was then inspected separately and remains **Active**, latest release **4 (1.0.3)**. No production promotion, tester access changes, policy declarations, or legal acceptance occurred. The four existing review warnings remain documented above.

Published candidate is the persisted signed AAB from native source `97a2aa8` with the checksum recorded above. Play Console availability is verified; an actual tester-device installation from Play has not been exercised. Screenshot of the available internal release was captured in the browser tool output; the browser screenshot API did not provide a persistent image path. The internal release page remains open: https://play.google.com/console/u/1/developers/7852596421344603650/app/4974345885339372269/tracks/4700322704264765603?tab=releases

## Apple agreement follow-up — 2026-10-18 15:12 UTC

User reported accepting the updated Apple agreement. Retried existing archive `2.28 (2)` / source `97a2aa8`: automatic signing and App Store export now **succeeded**. Signed IPA persisted at `/Users/tremainegrant/Documents/Codex/2026-10-18/cohort-release/PulseCheck-iOS-2.28-build2-97a2aa8.ipa`, SHA256 `88aff4a65b0843b2fe1afc487d598787283bf6ae6b08bb42f975668857376433`.

Upload through the existing Xcode account failed with Apple error **You do not have required contracts to perform an operation**, ID `62a5d40e-5f30-4cfd-8140-24171d9397ec`. This supersedes the earlier missing signing/export blocker; the remaining issue is Apple upload contract state, not local archive generation. App Store Connect browser session remains expired; user sign-in was requested to inspect the exact agreement requirement. Could be propagation or a distinct outstanding agreement; not yet determined. Vendor framework dSYM warnings were also returned, separately from the blocking contract error. No successful upload, processing, or internal TestFlight availability is claimed. Existing simulator identity remains untouched; no designated synthetic authenticated native session is available.

One bounded retry at **15:14:42 UTC** returned the same Apple contracts error, request ID `d4a005fc-416e-4ccd-8ddf-13a6d6d8c225`. Stopped retries. Export and both upload logs are preserved in the cohort-release artifact directory. Smallest next action: sign in to the open App Store Connect tab, complete account verification, and inspect Business/Agreements for the account; any outstanding legal acceptance must be performed by the Account Holder. No new terms were accepted by the agent.

At **15:33:00 UTC**, retried once after the parent verified Apple Developer account showed the October 13, 2026 agreement accepted October 18. Apple upload still returned **required contracts** error, ID `9ae5d7b9-8c91-4f79-b287-c05006fa2f6a`. Persistent log: `cohort-release/cohort-ios-upload-confirmed-agreement.log`. This confirms developer-portal acceptance alone has not cleared the upload service contract gate; parent is inspecting authenticated App Store Connect agreement state. No successful upload or TestFlight availability.
