# CAU team sandbox test

The internal test uses https://pulsecheck-cau-team-test.netlify.app/PulseCheck/questionnaire/cau with a separately shared invitation fragment. It requires existing PulseCheck email/password sign-in. Invitation possession does not grant access to another tester's answers or receipt.

The campaign is team-20260918 and expires October 2, 2026 at 23:59:59 UTC. Each account receives one submission for this campaign; retries return the same receipt. Use fictional answers only. Real account name/email are replaced with synthetic identity before auntEDNA receives anything. The sandbox ID is deliberately distinct from the user's real provider ID.

The test-specific endpoint sends only the 48 auntEDNA-routed fields to SANDBOX with the test key. PulseCheck stores its 13 fields and provider references under sandbox-prefixed records in the existing client-denied restricted collection. It never creates an athlete assignment or resolves a real app blocker. Its attempt record contains only the non-clinical snapshot.

No IRB questionnaire, live clinic, app gate activation, or skills-assessment task is included. This is the operational Mental Performance / Mental Health questionnaire pair.

After completing both sections, submit once and copy the receipt. Give Chai baselineId, athleteId, externalId, submissionId and requestId. A coordinator can match that submission to the restricted PulseCheck record, verify 13 local fields and external references, and compare auntEDNA storage on their side. Do not send clinical answers in a team chat.

Hosting is isolated on Netlify project 1905438b-7fba-4baa-a8f7-705d28354157. The builder is scripts/build-cau-team-test.cjs. Supply CAU_PUBLIC_ENV_FILE as a local JSON map of build settings; only NEXT_PUBLIC_ values are placed in the browser bundle. Partner key and invitation are function secrets, never bundled. Required server settings: CAU_TEAM_TEST_INVITE, CAU_TEAM_TEST_CAMPAIGN, CAU_TEAM_TEST_EXPIRES_AT, AUNTEDNA_PARTNER_TEST_KEY and the existing centralized Firebase credential variables. Disable or expire the campaign to close access.

## Verified September 18, 2026

Completed both sections in the deployed browser using a dedicated fictional account. auntEDNA returned baselineId 8fc8091b-a866-421a-b821-f8938b4c6be4. Admin readback verified 13 PulseCheck fields, 48 external references, absence of the unique health-answer test marker in both local records, and Firestore denial of a direct authenticated-client read (403). The browser displayed the receipt. The new receipt still needs Chai's independent visual confirmation; his prior confirmation covered the earlier September 16 sandbox submission. See cau-team-test-verification.json.

18 focused checks passed and the TypeScript check passed. The original main-site preview configuration was restored by removing only the four settings introduced during this task. No original environment keys or unrelated code changes were altered.

## Performance draft resume

Performance Continue and automatic advance now wait for an authenticated draft save. Drafts use separate sandbox campaign/account records (and assignment-gated account/version records on the ordinary route), not completed baselines. The server validates the PulseCheck field allowlist and rejects clinical fields. It retains name, Performance answers, position, section completion, version, revision and update time. GET restores the authenticated account's draft. Revision checks reject stale tab writes; identical retries are idempotent. Clinical responses and Clinical section progress remain memory-only until submission. Closing before a save is confirmed can lose the current edit. Main-site deployment is separate from the sandbox release.

## Audited retention policy (internal sandbox)

New sandbox completions additionally store `privateBaseline.fields` with the 37 audit-selected fields that were previously external-only. Together with the existing 13 `fields`, this retains 50 answers/states. The 11 external-only fields never enter this copy. All 48 clinical fields still go to auntEDNA and keep external references. Section membership, Performance-only autosave, and completion receipts remain unchanged. The private copy is inside the existing client-denied collection and is not returned in GET receipts or exposed to coaches. It is written only after partner delivery succeeds; no clinical drafts or full-answer retry queue are introduced.

Policy implementation: `src/lib/questionnaires/cau-retention.ts`, version `cau-private-retention-v1`. The ordinary route defaults to no expansion and requires both `CAU_PRIVATE_RETENTION_ENABLED=true` and the trusted assignment's matching `retentionPolicyVersion`. No real-athlete assignments or production settings were activated. The legal role and executed data-sharing terms remain to be confirmed before enabling that policy for real athletes. Existing completed submissions are immutable and are not backfilled.

## Consolidated Performance module

Performance now contains the existing 13 setup/self-report prompts followed by the existing skills assessment's 8 state answers, 8 familiarity ratings and 8 challenges (37 response/task items). Skills draft state saves separately on each Continue; the server reconstructs evidence scores from the known options and validates all activities at completion. Well-being section membership and auntEDNA's 48-field payload are unchanged. Skills are not part of the clinical payload.

New submissions require completed skills. Already completed questionnaire records remain complete. On the ordinary assigned route, an existing canonical version-5 skills baseline is reused; otherwise completion invokes the canonical baseline endpoint before final questionnaire submission is allowed. Native gate changes refresh canonical progress on return. Those native changes passed compilation but have not been installed or verified on a physical phone. Main-site deployment remains separate. Sandbox skills records and results remain under sandbox-specific keys and never update canonical app progress.

Validation: 17 focused questionnaire/route checks passed, including skills resume, incomplete-activity rejection, server-side score reconstruction, repeat completion, sandbox isolation, retention and clinical routing. TypeScript passed; skills rendering and reload restoration were exercised in a local isolated browser harness. Full live signed-in completion and web-to-phone return remain to be verified.

### Reopening older sandbox completions

Sandbox status now requires both the original submitted questionnaire and completed consolidated skills. Older submitted records restore only their original Performance answers and reopen missing skills, with Well-being already complete and locked. Skills completion returns the original partner receipt and makes no partner call; submitted questionnaire records are not overwritten. The earlier note about already-completed records remaining complete is superseded for sandbox only. Production legacy completion behavior is unchanged. Regression coverage verifies reopen, finish, original receipt preservation and a single clinical delivery.


## Agreed baseline scope, September 18

User approved keeping the current 69-item maximum sandbox flow: 45 questionnaire prompts plus 24 skills ratings and activities. The conditional injury narrative makes the total 68 when it is not applicable. Keep all eight current-state ratings and the optional final comment. Do not apply the proposed further reduction to 60. Sixteen administrative and feedback prompts have been removed from the athlete-facing flow; source IDs remain available for compatibility. Published sandbox deploy: 6aad84f63d17fb943c985c7e. Native releases and the main production site are separate from this sandbox deployment.
