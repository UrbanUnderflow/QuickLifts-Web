# Nora app runtime and testing

Chat Simulation and the privacy suite obtain athlete-visible replies from `pulsecheck-chat`, the endpoint used by iOS and Android. Their separate grading/classification models assess evidence; they do not author the reply. Draft policy experiments remain explicitly separate and cannot establish app parity.

## Development setup

Set `NORA_RED_TEAM_STAGING_CHAT_ORIGIN` to the chosen app-handler origin and `NORA_RED_TEAM_EXPECTED_BUILD` to the candidate build. The adapter requires development Firebase and signed synthetic identities. It preflights runtime identity and the no-contact lock before the conversation call and verifies the reply metadata again. It fails visibly if the runtime is unavailable or mismatched, with no independent model fallback.

For local work, `scripts/serve-nora-app-runtime-local.ts` serves the actual handler on loopback port 3111. It uses development persistence and the existing authorized model bridge. It accepts synthetic development requests only. It does not verify deployed model credentials or external delivery. Run with the existing server credential configuration; never commit credential files. Restart it after server-code edits.

`scripts/check-nora-app-runtime.ts` exercises a cue and meal request. `scripts/run-nora-privacy-simulation.ts` runs the fifty fixtures; scenario IDs may be supplied for targeted retests. Local Chat Simulation points to the same local handler. Synthetic fixture records are cleaned up; the visible conversation is replayed as client history on each turn. This replay does not establish long-term memory persistence across sessions.

## Evidence boundaries

- Runtime reply: real app handler, synthetic account, same server rules and repairs.
- Privacy storage checks: the prototype evidence is supplemented by a real development-handler transcript check. It verifies absence of the protected fixture text, not every possible disclosure or every production sink.
- Clinical partner checks: mock contract tests until credentials and controlled partner testing are available.
- Native UI: requires device checks for rendering, action availability, uploads, saves and completion.
- Client compatibility: Android preserves replies carrying the recognized shared-runtime contract instead of rewriting them locally; legacy responses retain the compatibility guard. iOS preserves verified runtime replies through its final display step and fails visibly on server failure.

Action discovery now runs in the server and returns a persisted action list. Web, iOS and Android render known action types and resolve available modules locally. Meal actions carry a stable server message reference. Native action rendering and execution retain platform implementations. A new action or visual control requires native changes and an app release. Backend response fixes reach compatible clients through a backend deployment; mobile releases are not automated by red-team test success.

## Release

The existing release gate still requires matching candidate/build/catalog evidence, staging results, human review and device evidence. Daily checks now default to staging; scheduled checks use development records. Deployment configuration must provide the matching staging endpoint and development credentials. Do not interpret a local build or a prototype privacy pass as release approval.

Remaining work includes production storage separation, durable-memory integration evidence, native action persistence and completion checks, signed-in device journeys, and controlled deployed checks. These boundaries remain visible even when response-level tests pass.

## Original storage finding

A synthetic health-insurance identifier was observed in ordinary conversation history when sent through the real app handler against development Firebase. The privacy suite now checks for this exposure directly and records a failure when protected fixture text appears there. The in-memory prototype passing is insufficient. This is verified development-handler evidence, not a read of production athlete data. Restricted intake, transcript redaction, logs, derived notes, retention and clinical handoff storage still need an enforced end-to-end boundary before privacy protection can be approved.

## Protected persistence implementation (local, September 6)

The app handler classifies storage before conversation-derived signals and withholds restricted or uncertain turns. The native save gateways independently classify incoming conversation and derived-note payloads. Protected conversations cannot create ordinary summaries. Withheld turns retain a generic handling note and reference, not a recoverable clinical copy. No partner vault or full-conversation retrieval is enabled by this change.

iOS conversation and mental-note saves use the authenticated gateways. Proposed Firestore rules deny direct client writes to conversations, summaries and notes, with owner-only reads. Those rules pass emulator tests and are not deployed. Deploying the restrictive rules requires coordinating the gateways and compatible native clients; existing clients otherwise lose direct-save access. Historical records are not automatically migrated.

Development gateway verification passes for redacted conversation storage, rejected protected mental notes, rejected protected summaries and denied cross-account overwrites. iOS builds, all 151 Android unit tests and web type checks pass. The initial broader web run passed 601 of 605 checks. The four remaining tests were updated, after verifying the current implementations, to follow non-destructive sign-in cleanup, shared push-target helpers, current dashboard query handling and server-owned subscription entitlements. An executable dashboard URL test now verifies that team selection, filters and the hash survive navigation. The corrected broader run passed; final counts are recorded below.

Production deployment, signed-in device journeys, partner delivery, historical-data review and complete logging/retention verification remain release work. Synthetic model testing uses the authorized bridge; it does not establish production compliance.

Additional checks: 13 clinical escalation/access tests pass after updating the consent-version expectation to the existing v6 documents, preserving all crisis-language assertions. Eight API proxy checks pass after adding the protected persistence routes. Ordinary meal and practice inputs were confirmed present in development history, so ordinary storage remains available.

The expanded storage run found an unexplained score being classified as ordinary; unclear score meaning now fails closed. Subsequent endpoint errors exposed clinical-record and private-staff disclosures entering the performance fallback. Those requests now select the appropriate care boundary, with relevant record/privacy next steps, and the fallback regression checks pass. Transport/runtime errors remain failures in the report rather than silently substituting simulator replies.

All fifty catalog fixtures now have deterministic fallback regression coverage. This catches fallback relevance failures even when the live model happens to produce a passing first response. Clinical-record requests use the care boundary; unknown sources and recipients receive clarification or permission guidance; ordinary readiness and energy ratings receive a relevant response. The safety and engagement checks remain enforced.

## Final code validation

- Expanded web/Nora/clinical/database-rule run: 672 passed, 0 failed.
- Android unit tests: 151 passed, 0 failed; Kotlin compilation passed.
- iOS simulator build: succeeded. This is build evidence, not a signed-in device journey.
- Development persistence gateways: protected transcript redaction, note rejection, summary rejection and cross-account denial passed.
- Production deployment and restrictive production database rules remain unapplied.

Final live-model privacy run: all 50 scenarios passed against the local app handler and development Firebase, using the authorized model bridge. This result includes the actual ordinary-transcript exclusion check. It does not certify production storage, legal compliance, partner delivery or native signed-in behavior.

### September 6 native development follow-up

The signed-in Android native client test passed against the synthetic-only Netlify preview. The iOS simulator initially omitted the development Firebase header on chat requests; the native request now sends the authenticated Firebase project's mode. The signed simulator build passed and the meal action opened successfully through the actual app UI. Preparing a pre-onboarded fictional membership unblocked chat testing; this is not evidence that first-time onboarding is frictionless.

Meal cards now request a transient AI estimate through `nora-estimate-meal`, using Macra's ingredient-and-portion approach, strict structured output, and server-summed ingredient nutrition. The implementation is shared across web, iOS, and Android callers; Macra's own client analyzer remains a separate implementation. Estimates are labeled and editable, with explicit assumptions, and are saved only after confirmation. Five estimator tests pass, iOS and Android builds pass, and web type checking passes. A real development request returned complete nutrition. Production rollout, native photo testing, first-time onboarding, and the previously identified error-state copy remain separate open verification items.

The meal editor now expands inline on iOS and Android, matching web. Native UI defaults to an estimated-nutrition summary with optional detailed edits. Android instrumentation successfully opened the inline card, requested a live estimate, confirmed saving, read back the development meal and estimate provenance, and deleted its test record. The iOS inline save also succeeded through the simulator UI; development Firebase read-back confirmed the estimated values, assumptions and ingredient data. Reopened iOS conversation history currently presents a closed transcript without the action cards, which is an additional continuity gap.

### September 6 ordinary practice follow-up regression

The exact serving-cue follow-up initially returned `NORA_ENGAGEMENT_FALLBACK_FAILED`. The fallback now offers a concrete practice step, and the repetition rubric measures how much of the current answer repeats earlier content so a substantive expansion is not rejected merely for retaining the cue. Identical repeated replies still fail. All 83 focused engagement, practice and privacy-fallback checks pass. The synthetic-only preview returned 200 with the focus-cue action, and the iPhone simulator displayed the concrete follow-up successfully without a connection error. The iPhone did not display a practice button in this run; its action view filters exercises that cannot be loaded, so module availability and launch remain unverified. Production is unchanged.

### iPhone practice launch and completion verification

The missing button was caused by an empty development `sim-modules` and `mental-exercises` library. Seeded only the existing `focus-cue-word` module into development `sim-modules` from the repository library. No production records changed. iOS now shows loading and retry/unavailable states instead of silently hiding a failed lookup, and only enables active exercises. The signed simulator build passed.

Actual iPhone UI verification succeeded: Nora request → Practice a focus cue → Anchor Word introduction → cue selection → timed practice → Finish Early → reflection and post-rating → Done → original Nora chat. Development Firestore read-back confirmed a 64-second synthetic completion, configured duration 300 seconds, exercise ID, pre/post ratings, and reflection. This verifies the shortened-session save path, not all 15 timed rounds or physical-device behavior. The existing module copy and generic post-practice question still merit product review. Other exercise modules have not been seeded or tested in this pass.

### September 7 remaining-gap work

Partner credentials are intentionally deferred. Aunt Edna evidence remains mock wiring only, with no live delivery claim. Production rollout remains separate from development verification.

Implemented: ordinary iOS transport failures now offer retry without generic emergency instructions; Android meal saves and reloads retain ingredient details and estimate assumptions; both native photo pickers resize/compress into bounded JPEG uploads; optional iOS profile actions stay in the bottom safe area; Android practice lookup checks canonical sim-modules before legacy exercises and exposes retry when unavailable. Medication-memory fallback now addresses the record request without automatically describing it as a mental-health handoff.

Verified this pass: iOS photo selected through the actual picker, saved from inline chat, then downloaded from the saved reference (HTTP 200, image/jpeg, 23,854 bytes); Android live meal persistence and canonical practice-button tests both pass; 151 Android unit tests pass; 83 chat/engagement/escalation runtime checks pass, and the separate 83 focused privacy-fallback/engagement/practice checks pass. iOS builds pass. Full new-athlete onboarding, Android photo-picker round trip, complete exercise parity, and final rollout checks remain open. iOS focused test execution is tracked separately while running.

The two focused iOS tests executed and passed (photo bounds and connection-failure copy). The optional-profile Skip control was visibly available on iPhone without scrolling and was exercised in the synthetic account.

Onboarding UI follow-up: reset only the synthetic development membership (backup in /tmp/nora-membership-before-onboarding.json), entered a reserved fictional phone number, and reached the participation/privacy agreement screen successfully. The agreement acceptance step has not been submitted. This is a returning synthetic auth account with membership setup reset, not a new-user registration test. Optional profile Skip was confirmed to return to Today. No production deployment occurred.

With the user's explicit approval for the fictional development account, the participation and privacy notices were opened and accepted through iPhone UI. Continue reached Starting Point, Join Team returned to Today, and development Firestore showed onboardingStatus/entryOnboardingStep complete, both consent IDs saved, baseline ready. Relaunch returned to Today without repeating the team setup. Baseline assessment itself remains ready rather than completed; this run used an existing synthetic auth account, not new account registration.

### September 7 focused release check

Android Nora practice actions now load the existing module-backed player rather than the generic three-screen walkthrough. The cue module supports early finish in Nora only; junior defaults are unchanged. Completion records use measured elapsed time rather than the configured duration, and canonical module categories are retained. Android instrumented checks pass against the latest synthetic-only preview: meal estimate plus fictional photo selection callback, upload/download verification, and canonical cue selection, practice, early finish and confirmed save. The operating-system photo picker itself is replaced by a test registry in this Android test.

The shared regression set contains 264 tests: 262 passed on the first run; the two Firestore rules checks passed after starting their required local emulator. Both clients now target the updated development preview for testing. See nora-release-checklist.md for release ordering and explicit remaining evidence, including exact release revisions, older-client compatibility and full protocol timing/reflection parity. Production is unchanged.
