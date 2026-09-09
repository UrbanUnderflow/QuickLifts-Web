# Nora release check

Status: development verification; production has not changed. Aunt Edna live delivery is intentionally deferred. Mock partner wiring is not live-delivery evidence.

## Verified paths

- iOS: inline meal estimate, confirmation/save, photo picker/upload and stored image read-back; cue exercise launch, shortened completion save and return to chat; team membership setup and persistence after reopening.
- Android: inline meal estimate, ingredient/assumption persistence, photo-selection callback through compression/upload and image read-back; canonical cue module lookup, real cue-word player, shortened completion/save and return to action view. Android photo test supplies a fictional picker result; it does not automate the operating system picker.
- Shared tests: 262 passed initially; the two rule tests required starting the local Firestore emulator, then passed. Combined 264 checks passed. Android 151 unit tests and iOS two focused error-copy/photo tests passed in this workstream.

## Rollout order and release gates

1. Freeze exact candidate revisions for web/backend, iOS and Android; record which app capabilities each supports. Current dirty workspace is not an identified release candidate.
2. Deploy authenticated conversation, derived-data and meal-estimate endpoints before distributing clients that require them. Verify ordinary saves, withheld disclosures and denied cross-account writes using synthetic accounts against the deployed candidate.
3. Distribute native candidates and exercise meal upload, practice, completion, reopening and onboarding. Ensure unsupported older app versions are upgraded or explicitly blocked before removing their direct-write path.
4. Enable restrictive conversation/notes/summary database rules only alongside the supported-client policy. Do not restore unrestricted writes as a rollback. A rollback must preserve privacy protections or pause affected writes.
5. Verify production reads and writes with a controlled synthetic account and monitor failures. Record release approval and exact evidence; development passes alone do not approve release.
6. Keep Aunt Edna live handoff unavailable while credentials are absent. Display simulation evidence distinctly and never claim care delivery. Partner activation later requires callback-secret configuration, signed callback validation and controlled delivery confirmation.

## Limits still requiring separate evidence

- These checks use simulators/emulators, not physical devices.
- Complete library parity is not established by one cue exercise. The Android reusable focus player and iOS player still have different timing/presentation and reflection flows; compare those before claiming one-to-one exercise parity.
- New account registration, every baseline assessment path, and Android's actual OS photo picker remain outside this verified slice.
- No production gate has passed for a frozen release revision. The remaining rollout decisions and evidence must remain visible rather than being converted to an unconditional release pass.

## September 7 follow-up

- Android cue practice now includes the 1–5 before/after ratings and authored reflection questions. The emulator journey verified saved `preExerciseMood: 3`, `postExerciseMood: 4`, and `reflection.anchor-strength: 5`, plus measured elapsed time. The duration excludes reflection and rating time. Cue rounds use the same 20-second rounding of configured duration as iOS. This check used Finish Early; a full-length run and every module remain outside this evidence.
- Critical update notices now override the optional-notice visibility switch in both candidate clients. Existing update UI prevents dismissing a critical release and compares installed version/build. This change cannot retrofit binaries already installed on athletes' phones.
- The shared suite reran together with the rules emulator: 264 passed, zero failures or skips.
- Rollout remains blocked until the actual oldest supported released binaries are exercised against the candidate endpoint/rules and their critical-update feed. No archived release binaries were found in the checked repository file inventory. Xcode Archives does contain prior iPhone device builds, including version 2.27 build 2; their App Store distribution status and oldest-supported status remain unverified. Those device builds require a physical iPhone for execution. A candidate-only update test cannot establish old-binary behavior. Maintain current production permissions until the migration and supported-build evidence are approved; do not mark the release gate passed from these development checks.

## Physical iPhone onboarding and update preparation

The user installed App Store 2.27 (2). Production membership inspection confirmed Volleyball was removed and revoked, with onboarding already complete. A detached checkout of 4aef8f3 with only the ContentView membership-routing diff built and installed successfully. The user confirmed normal entry and normal entry after closing/reopening. No account record was changed. This verifies the focused fix on the physical phone; it is not an unchanged App Store binary test.

Read-only production update-feed inspection: the modal is disabled; both release collections list 2.15 as critical with no build number. The previously installed App Store 2.27 (2) is newer, so that entry would not trigger an update even with the modal enabled. The released client queries the shared collections without account targeting. A private account-scoped forced-update experiment is therefore unavailable for that binary.

Controlled update test procedure:
1. Keep the global production feed unchanged during preparation.
2. Validate the candidate's critical-update display, dismissal prevention, reopen behavior, same-version build comparison, and failed-fetch handling in isolated development fixtures. Label this candidate evidence, not old-binary evidence.
3. Confirm the replacement is actually available in the appropriate app store before publishing its real version/build as a critical update. Never use a fictional higher production release to force a test.
4. For an unchanged released binary, verify the notice during the authorized real rollout. Reinstall the current App Store app on the test phone at that point, verify the mandatory notice, follow the store update, and confirm normal entry and successful protected saves.
5. Keep stricter production permissions gated until supported-client adoption and save behavior are established. Existing released clients fail open if the release feed cannot be read; the notice alone is not a server-side security boundary. Server rules remain the final protection, and their migration needs a deliberate rollout window.

Next decision: implement isolated candidate update-screen coverage now, while keeping the unchanged App Store forced-update check pending a real available replacement release. No production feed mutation was made.
