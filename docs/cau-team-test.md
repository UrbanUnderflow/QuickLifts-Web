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
