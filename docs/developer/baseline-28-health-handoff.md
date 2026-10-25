# Mac mini handoff: 28-item baseline and default-on health

Checkpoint date: October 25, 2026. The user explicitly asked to STOP, check in the work, and provide this handoff. **This branch is a work-in-progress checkpoint, not a release. Do not merge or deploy it until the remaining integration and validation work is complete.**

## Fetch these exact repositories and branch

- Web/API/admin: `https://github.com/UrbanUnderflow/QuickLifts-Web.git`
- iOS: `https://github.com/UrbanUnderflow/PulseCheck.git`
- Branch in BOTH repositories: `codex/baseline-28-health-checkpoint-2026-10-25`
- iOS checkpoint commit: `b679341` (based on `a6cf5d6`).
- Web checkpoint is based on production commit `46ace5a748e1fa85e73b51e21e7bda4c5d2b6c74`. Use this branch's latest checkpoint commit.

Read each repo's AGENTS.md and applicable nested instructions. Use the actual checkout roots on the Mac mini; do not assume the previous Mac's paths, signing, or devices exist. Preserve independent incoming changes. The web production branch is `main`; pushing main triggers the Netlify production build. Keep work isolated until it is ready.

## Latest user decisions

1. Remove all eight custom mandatory baseline challenges. They are mainly hypothetical self-reports and text-ordering activities, with authored numerical weights, not validated measurements of demonstrated mental skills. Do not create competency, inhibition, working-memory, or other ability scores from them.
2. User approved the **28-item** version, replacing the earlier 40-item proposal:
   - 19 existing protected health/wellbeing/support questionnaire items, wording and stable IDs preserved.
   - 1 training-goal question, `cau-starting-point-46`.
   - 8 mental-skill prior-experience/familiarity ratings.
   - No eight current-state ratings in baseline. Keep the existing brief daily check-in separate.
   - Remove the purpose acknowledgement and the three past-week performance ratings (q01, q05, q09, q10) from the assessment count. Explain purpose and permissions in the opening/signing flow.
   - This is a starting profile for choosing a first practice, **not a validated competency assessment**. The 19 protected items are wellbeing/support intake, not, by themselves, a named validated clinical screening instrument.
3. Health is **on by default** for everyone. Only an explicit health-off provisioning configuration disables the program feature. Add a separate setting in `/admin/pulsecheckProvisioning`. Implemented policy is team override -> organization default -> on if unset.
4. Required health-authorization decisions belong in the initial team-join signing flow, with consistent web/native and existing-member re-consent behavior. Preserve separate participation, health, research, staff, and handoff decisions. Never fabricate an acceptance/signature or erase existing receipts. Personal authorization/decline is separate from the administrator's feature setting.
5. The user disliked the native black header against the charcoal survey. Match native safe areas/header/WKWebView/scroll background to web charcoal `#161c1c`.

## What was already LIVE before this checkpoint

- Redesigned baseline: larger type, visible timeframe/instructions, two-column training goals, plain-language labels, viewport Continue, native daily check-in emojis.
- Baseline is shared between iOS embedded web and mobile web, authenticated to the same UID. Server completion prevents repeats. Baseline blocks training until genuinely completed.
- Admin-driven Markdown announcements and version-driven What's New at `/admin/addVersion`.
- Existing coach-surveys release was preserved in production; do not overwrite it. Production ancestry includes `34382acb6`, UI redesign `e3846f7bb`, and pnpm lock repair `46ace5a74`.
- Last verified production Netlify deploy: `6ade484ca99d20b6b4b435d9`, ready, commit `46ace5a74`. This is dated evidence; verify current production before releasing.
- UMES sponsored team access was explicitly activated earlier. Do not change billing/access as part of this task.

No new 28-item/health-policy web release has been deployed. No clinical records, routing, credentials, or live consent receipts were changed during this checkpoint work.

## Current local implementation

### Web questionnaire and shortened UI

- `src/content/questionnaires/athlete-starting-point.json`: now content version `athlete-starting-point-v2`, 20 prompts (goal q46 plus the unchanged 19 health prompts).
- `src/content/questionnaires/athlete-starting-point-v1.json`: exact previous 24-prompt source retained for history.
- `src/lib/questionnaires/cau.ts`: new content constants and historical versions.
- `src/components/mentaltraining/ConsolidatedSkillsBaseline.tsx`: rewritten to tools/experience -> review/completion only. No challenge or current-state screens/scoring. Eight native select controls with readable skill descriptions. Unanswered experience is explicitly unknown, tracked by `answeredFamiliarity` rather than defaulting it into a real report.
- `src/pages/PulseCheck/questionnaire/cau.tsx`: performance count uses goal + 8 experience = 9. Completion callback passes the draft only, without local scoring. Introduction no longer promises activities.
- This page is **NOT fully integrated with the new health-on policy yet**: it still uses provider readiness to choose sharing/disable the health section in places. Fix those paths; only `healthBaselineEnabled === false` is the program-level off switch.

### Completion and old-draft compatibility

- Draft v2: `assessmentKind: 'self_report_starting_profile'`, steps `tools` / `result`, familiarity plus `answeredFamiliarity`; no currentState/challenge/evidence fields.
- Canonical v6 record: `assessmentKind: 'self_report_starting_profile'`, completion/source/sport metadata and explicitly reported familiarity. No invented competency, family ability, overall competency, or task-evidence scores. Helper can read optional old state when present but does not fabricate state.
- Files: `src/lib/questionnaires/cau-skills.ts`, baseline API `src/pages/api/pulsecheck/questionnaire/cau.ts`, `netlify/functions/complete-pulsecheck-baseline.js`, and new `netlify/functions/utils/self-report-starting-profile.js`.
- Historical completed v5 skills records and completed combined questionnaire records remain accepted. Do not force completed athletes to retake anything.
- The server agent's last atomic write added **UNTESTED** read-only projection of older in-progress drafts into the new version: preserve only q46/name/performance completion and prior familiarity; drop obsolete state/challenge scoring; start new namespace revisions at zero. Old documents are not rewritten. Verify carefully before using.
- Health authorization was filtered out of baseline *eligibility* checks in API/standard assignment so a newly required, unsigned health document cannot accidentally turn `required` false and bypass the baseline. Participation/research and completed-entry conditions remain. Audit this with actual re-consent behavior.
- Organization policy lookup currently uses team organization ID with a membership fallback. Verify team/org ownership consistency; do not trust caller-supplied routing or mismatched membership scope.

### Honest downstream profiles

- New helpers/types in `mentalSkillsBaseline.ts` distinguish reported experience from measured skills.
- `profileSnapshotRuntime.js` and duplicated pilot-metrics runtime return null taxonomy/empty ability scores for new v6 profiles. Unknown means unknown, not neutral 50.
- Initial prescription is an explicitly provisional foundation plan. Existing daily readiness may select a recovery practice independently; it is not reintroduced into the baseline.
- `recommendationService.ts` does not award High confidence merely because this baseline exists.
- `taxonomyProfileService.ts`, `types.ts`, and `MentalProgressCard.tsx` support absent taxonomy profiles.
- Preserve genuine SIM/session observations and raw history. If clearing an existing cached taxonomy profile on a new v6 completion, review whether task-specific evidence needs to be retained separately; never retain invented broad abilities just because the same object contains real observations.

### Provisioning and consents

- New `src/api/firebase/pulsecheckProvisioning/healthBaselinePolicy.ts`: optional bool, team > org > default on.
- Org default and separate team On/Off/Inherit controls added to provisioning admin page; service/admin field handling and types updated.
- `consentPolicy.ts`, `service.ts`, and `src/lib/server/pulsecheck/atomicConsent.ts` use the same effective health documents. Append stock health authorization only if on and no custom health document exists. Off removes the health requirement while preserving stored terms and historical receipts.
- Baseline GET now exposes `healthBaselineEnabled`, `healthAuthorizationRequired`, decision state, and a server-derived `/PulseCheck/athlete-onboarding?organizationId=...&teamId=...` link.
- Missing authorization must lead to an actual signing/decision flow, not silent acceptance or a dead-end button. Embedded WKWebView only allows baseline routes for security; a consent-route bridge/native refresh or safe authenticated handoff still needs implementation.
- Admin controls compile but have NOT had signed-in visual/write workflow verification. Review consent-form preview counts when off, legacy/orphan enrollment handling, and individual/non-team onboarding.

### iOS

- `RequiredQuestionnaireGate.swift`: header/safe area, WKWebView background, scroll background and under-page background now charcoal.
- Appearance-only signed AthleticMind build passed, installed and launched on Tremaine's iPhone Air earlier in this turn. Later consent-source edits below were NOT included in that installed build.
- `PulseCheckAthleteTeamOnboardingView.swift`: added `applyingHealthBaselinePolicy` helper with team/org/default-on behavior and stock health-document fallback.
- `ContentView.swift`: effective consent resolver now accepts verified organization snapshot and applies that helper before join/re-consent gating. These later changes need build/tests/device verification.
- Native progress parser currently accepts a nonempty canonical baseline as completed; inspect any other profile consumers for absent taxonomy/v6 fields. The strict combined-baseline server gate still controls completion, so do not replace it with local flags.

## Critical unfinished clinical integration

Health feature activation must be separate from delivery readiness. **Do not resolve the old CAU restriction by inventing a UMES code, using CAU for UMES, or storing protected answers in a new Pulse database.**

Observed live public receiver specification: `https://partner-api.auntedna.ai/openapi.json` (and `/docs`). This was fetched read-only, no clinical submissions made.

- Live `BaselineIn.universityCode` is a required generic string (1–20 characters), provider-assigned and used to choose the clinic. The live schema does not itself restrict the value to CAU.
- The Pulse adapter `src/lib/questionnaires/auntedna-partner.ts`, baseline GET readiness check, and local published baseline schema still hardcode CAU. These need a safe trusted organization connection model rather than a school equality check.
- `POST /partner/athletes` accepts universityCode, organizationId and teamId; it can route by org/team and then key default if code absent. It is a write. Do not use a key-default fallback that could route UMES into a CAU clinic. The public response schema does not establish a verified routing result.
- A live-key prefix proves environment, not UMES authorization. Outbound baseline credentials are different from inbound snapshot/HMAC credentials.
- Verified production team: `fc02cbd64a7fefd5adc97701482fe2d9b147f48ea6dd56168622132824475f95`.
- Verified UMES organization: `9b72a5f5a31c1a16c91138ca9e7f8fa1d0c57b7062ef56851479274245fc0351`, productBrand `athleticmind`, active. Browser read found no universityCode/care-routing field. Team already has a health-authorization document.
- Need establish the provider-approved UMES routing code/connection and credential scope through approved admin access. No provider backend repo was found locally; connected GitHub search returned only a public AuntEdna roadmap.
- Never claim final completion without the actual protected-answer receipt. Never silently disable the health feature merely because delivery is unconfigured. Avoid publishing a default-on flow that strands every athlete at an unsaveable final submission. Resolve and verify the delivery path before release, or explicitly report that external blocker rather than fabricating readiness.
- Existing 19 questions are protected participation/wellbeing/recovery/support intake. A formal validated annual clinical screening workflow is separate; do not relabel this set as PHQ/GAD/SMHAT validation.

## Validation at the stop point

- Checkpoint-wide TypeScript `tsc --noEmit`: **passed** immediately before check-in.
- Both repositories' `git diff --check`: **passed**.
- Profile agent: 8 new profile tests passed after no-state/28-item helper update; legacy/simulation and 33 pilot-metrics checks passed earlier.
- Health policy agent: 18 focused policy/access/consent tests and typecheck passed.
- Server agent: 41 tests passed for the EARLIER 40-item draft. **The final 28-item content/version/migration changes were NOT rerun. Those fixtures still need updating.**
- Existing offline E2E `tests/e2e/cau-starting-point-local.test.cjs` still expects the previous 48-item/challenge/state flow. Rewrite it for 20 questionnaire + 8 experience, consent/off/default-on behavior, version migration, retries and completion.
- New 28-item browser flow, provider route, signed-in admin settings, initial joining/re-consent, individual health path, and final native consent build/device behavior are unverified.

## Recommended continuation order

1. Fetch both checkpoint branches. Read the diffs and this handoff; do not redo completed research or assume a release is ready.
2. Finish 28-item version/history/migration and update tests. Ensure old completed users skip; old unfinished users retain goals/experience; neither source nor answers are renumbered.
3. Finish default-on health UI and signing integration across web/native/API. Distinguish program configuration, personal authorization, and actual delivery readiness. Keep all scopes admin-owned.
4. Verify the provider connection for UMES and remove CAU-only assumptions coherently across adapter/schema/config. Do not send real or synthetic data to a live clinical service just to probe routing without appropriate authorization.
5. Validate genuine null/unknown competency profiles and provisional training, preserving real task/session records. Do not create fake scores as a compatibility shortcut.
6. Run targeted unit/contract tests, full typecheck, actual mobile browser flow (including small screens/text enlargement), authenticated config/join/re-consent checks, then the native build/device checks needed for consent changes.
7. Before release, verify production's latest commit and preserve any newer independent work. Use the hosted Netlify Git build after a scoped merge/push to main. **Do not run a full local Netlify production upload:** ~400 functions produced a ~3GB upload and a long delay earlier. Watch ready/published identity and the exact live route/assets, then verify the signed-in phone flow.
8. Report local, deployed and physical-device proof separately, including any external configuration blocker. Do not publish announcements or bump app versions solely to test.

## Research context, already checked

The exact custom challenge items, score anchors, 20/80 weights, stage thresholds and derived cognitive scores have no validation/calibration evidence in the code/spec reviewed. Existing product approval is not psychometric validation. The sport-specific baseline uses broad archetype packs (golf -> precision, shared with archery/shooting/etc.), not the richer individual-sport module/report packs. The user has chosen to remove the challenges, so focus on finishing that decision rather than reintroducing games.

Useful primary sources for context (not validation of our custom questions):
- TOPS development/self-report measurement: https://pubmed.ncbi.nlm.nih.gov/10521001/
- Task reliability/individual-difference caution: https://pubmed.ncbi.nlm.nih.gov/28726177/
- Training-intervention evidence, not our assessment validity: https://pubmed.ncbi.nlm.nih.gov/27241124/
- Current IOC SMHAT2 research: https://bjsm.bmj.com/content/60/15/1131
