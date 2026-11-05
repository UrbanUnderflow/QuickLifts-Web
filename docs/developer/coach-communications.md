# Coach Communication: local release candidate

Updated 2026-11-05. This is source prepared for GitHub review. No deployment, production settings, accounts, contacts, baselines or messages were changed by this integration.

## Implemented behavior

The coach dashboard's Communication tab includes separate SMS and existing in-app channels. Coaches select up to 25 eligible athletes, review the text, then queue individual SMS messages. Incoming replies and outgoing statuses appear per athlete. History loads in pages of 200. Recent groups remain visible after navigation/reload; authorized coaches can cancel recipients that are still queued and pause an athlete's texts. The existing in-app navigation unread count is not yet an SMS unread count. New inbound messages appear on refresh.

Group submission is atomic and never contacts Twilio. It writes a group, per-recipient jobs and message records in the existing recursively client-denied namespace: `pulsecheck-restricted-questionnaire-submissions/coach-communications-v1`. Each job stores a hash of the reviewed number and sender binding. No phone number or private baseline answer is returned to the coach inbox.

Request-ID dedupe handles network retries. A server-owned intent record also deduplicates identical author/team/text/recipient groups after reload for ten minutes, and for as long as the prior group has queued, sending or unknown jobs. A coach cannot create a fresh duplicate merely because the browser lost its request ID. A known pre-queue validation error returns `notQueued:true`, so the UI safely allows edits. An uncertain response keeps the same request for retry and exposes the server group history.

The Netlify scheduled worker inspects up to three queued jobs each minute. It stops starting jobs after a 15-second budget, within the provider's documented 30-second scheduled-function limit. Each provider request has a five-second timeout. It verifies the organization, team, staff capability, roster scope, active athlete, unchanged phone, explicit texting restrictions and suppression again in the claim transaction. At most one worker crosses the provider boundary for each job. Withdrawal, pause or phone changes block queued work. Cancellation only affects unclaimed jobs.

A stale sending reservation becomes unknown after two minutes, never queued again. Network uncertainty remains unknown. These records require operator review unless a signed provider callback resolves them. Automatic retry of an unknown provider call is intentionally prohibited. There is no generic coach button to mark an uncertain text unsent and resend it.

Twilio status callbacks bind the exact configured URL, job ID, account, sender, destination hash and provider SID. Accepted/queued/sending/sent/delivered/failed/undelivered/canceled events update the message and group. Duplicate or late events cannot regress a final status. A callback can arrive before the original API response without losing the delivered result. Incoming SMS still uses the existing signature validator and deduplicates provider SIDs.

## Consent and opt-outs

Team texting consent is handled outside the app. An absent in-app consent record does not block an otherwise authorized send. The server can resolve one unambiguous, valid profile phone number without creating a contact or consent record. Existing contact numbers are never silently replaced. Explicit withdrawal, denial, revocation, pause, disabled contacts and shared STOP suppressions continue to block texting. Staff authorization, active team membership and phone validation remain required.

Athletes can open `/PulseCheck/text-preferences?teamId=...` from their team workspace. Turning texts on requires explicit versioned agreement plus a recent server-verified Firebase phone sign-in, matching the account's current linked phone. A contact field or client-submitted number cannot establish proof. Turning texts off requires the signed-in athlete's membership but does not require receiving another code. Every change has a server-side consent event. Coaches can pause eligible roster contacts but cannot grant consent or alter the athlete's number.

Consent version `team-texts-v1` is saved with the exact rendered text. A new opt-in uses purpose `team-communications`, server timestamp and evidence event ID. STOP uses the existing shared `coach-surveys-v1/sms-suppressions` namespace. START never automatically clears a previous STOP. Restart after STOP still requires support review; this candidate does not implement a suppression-reset administrator endpoint. Login SMS, survey collection permission, health consent and optional team messaging remain separate.

One shared sender/destination pair maps to one team and athlete. Conflicting team routes fail closed. Multiple-team messaging from one number needs an explicit routing design; no heuristic sends private replies to another team.

## Configuration required after approval

All values must be set in Netlify Functions scope for the production deploy context only. Nothing was configured during implementation.

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- `COACH_COMMUNICATIONS_FIREBASE_MODE=prod`.
- `COACH_COMMUNICATIONS_SMS_WEBHOOK_URL`: exact HTTPS incoming URL ending `/api/coach/communications/sms-webhook`.
- `COACH_COMMUNICATIONS_STATUS_WEBHOOK_URL`: exact HTTPS callback URL ending `/api/coach/communications/status-webhook`, with no existing query string or fragment. Each send adds its job ID.
- `COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED=true`: independent callback/STOP reception gate; keep on during a sending pause.
- `COACH_COMMUNICATIONS_SMS_ENABLED=true` and `COACH_COMMUNICATIONS_WORKER_ENABLED=true`: both required for queuing and processing.

The worker uses Netlify's scheduled-function mechanism and the existing production Firestore initializer. It does not assume the build-only `CONTEXT` variable exists at runtime. Production gates must remain unset in previews and local development; the API does not queue development-mode jobs. Emulator tests call the service with a fake transport. Never invoke the real worker with production gates/credentials as a local test.

Existing Twilio account, sender ownership/registration, callback routing and current provider opt-outs remain unverified. Production Netlify metadata currently has none of these settings. Do not overwrite another SMS product's number webhook without preserving its routing. This handler preserves shared survey suppression but is not a dispatcher for every existing SMS product.

## Tests completed

- `node --import tsx --test tests/unit/coach-communications.test.ts`: 24 service tests, including queue atomicity, reload dedupe, concurrent workers, unknown outcomes, stale claims, transactional permission changes, contact/STOP changes, rate limits, conflicting routes, callback signature/SID/destination checks and ordering, consent proof, withdrawal and coach pause.
- Local Firestore/Auth emulators, project `demo-pulsecheck-communications`, ports 8089/9198: twelve integration and authenticated route tests against the actual repository rules. Client access denial, concurrent queue/worker behavior, equal-timestamp paging, cancellation/roster isolation, real emulator token verification, phone-owned consent, account closure and organization purge pass. The route harness substitutes only the Firebase app initializer; token verification, authorization and handlers execute against local emulators. Only synthetic records and fake transport are used.
- `node tests/e2e/coach-communications-local.cjs`: actual component in desktop/mobile browser with fake HTTP. Group review/queue, reload history, known validation recovery, lost-response retry, ineligible recipients, reply selection and horizontal overflow pass.
- Whole-project `tsc --noEmit --incremental false` and scoped lint pass. The scheduled worker bundles with esbuild.

The patch is integrated into an isolated copy of production commit `ac715f118a640f3345a0f5ebcbc3162f7a8d3d3b`, recovered from the clean local November 1 deployment checkout. The full Next production build passes with existing public Firebase web configuration only, without production service credentials. The built dashboard and preference pages return HTTP 200; unauthenticated API calls return 401 with private/no-store. These are local checks, not a deployment or an authenticated production-browser/native test.

## Closure and retention

Durable account closure drains operational SMS messages, contacts, routes, jobs and related group metadata in bounded retryable steps. Organization purge erases team operational SMS data within its existing 90-day lifecycle. Other recipients' history is preserved. Consent events, shared STOP suppressions and provider-held records remain explicitly subject to retention review. No new ordinary-message expiry duration is assumed.

Sender and athlete profiles must exist and have no closure tombstone. Enqueue, claim, consent and incoming writes recheck closure inside their transactions. Closed or orphaned queue jobs become blocked; stale sends become unknown without resending or recreating erased conversations. A send already crossing the provider boundary cannot be recalled by account closure.

Legacy admin deletion now stages a separate SMS-only recovery record before deleting Auth. Its existing synchronous 200/500 behavior, missing-user handling and email-suppression release on failure are preserved. The recovery worker never disables/deletes Auth, revokes memberships, or erases unrelated account data. It verifies Auth absence before draining SMS records, including after a crash before confirmation or profile deletion. A rotating scan prevents still-existing accounts or failures from starving later cleanup. Seven handler regressions and two additional Firestore integration tests cover this path.

A failed or uncertain admin deletion leaves its SMS recovery marker in place: no SMS records are erased while Auth still exists, but team texting is paused pending operational review. Support must verify the deletion outcome and that no delete request is still running before releasing an abandoned marker; retries can complete the existing admin deletion. This is an intentional fail-closed SMS safeguard, not a queued background account deletion. Completion retains a minimal UID/status tombstone, with evidence disposition still subject to the policy decision below.

Still required before release: Ordinary-message expiry and consent/provider-record disposition require a documented retention decision. Provider credentials, number/registration and webhook routing remain unverified; an approved provider test is outstanding. Full authenticated browser/native phone-link behavior is not established by the emulator route tests. Manual inbox refresh and support review for unknown delivery/STOP restart remain operational limitations.

Provider references: [Twilio delivery callbacks](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status), [Netlify schedules and 30-second limit](https://docs.netlify.com/build/functions/scheduled-functions/), [runtime environment scopes](https://docs.netlify.com/build/functions/environment-variables/).
