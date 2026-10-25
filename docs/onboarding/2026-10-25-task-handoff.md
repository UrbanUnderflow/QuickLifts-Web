# Coach surveys and institution onboarding checkpoint

## Source and branches

Repository: https://github.com/UrbanUnderflow/QuickLifts-Web

- `codex/coach-survey-flows`: published survey release, commit `34382acb63eacba3068d71cea81f0795c23e6066`.
- `codex/institution-onboarding-policy`: WIP institution-policy implementation, based on that release. The checkpoint commit containing this document is the resume point.
- Release includes main commit `4e3ba97bc1233122d685080fdcc5752872549a2b` (athlete baseline and admin app messages). Remote main advanced to `46ace5a748e1fa85e73b51e21e7bda4c5d2b6c74` at checkpoint. This newer main was NOT merged or deployed. Reconcile it before any later publication.

Local task checkout: `/Users/tremainegrant/Documents/Codex/2026-10-25/task-2/coach-surveys-release`.
Earlier feature checkout: sibling `coach-surveys`; its source work is included in the release branch. Original GitHub checkout was not modified.

## Published and verified

Production: https://fitwithpulse.ai
Netlify site `quickliftsapp`, site ID `05a6cac5-9994-4883-9e90-5adb69528bda`.
Published deploy `6ade4264e583bfcd83d11b6e`, October 25 2026 17:57:19 UTC.
Rollback deploy `6ade3b8aaf011cc48810fb33`.

Six-question coach baseline and two-question periodic survey; optional freewriting; sticky progress; private invitation collection and immutable/idempotent submissions. Existing provisioning contains survey management, team cadence and coach overrides, baseline link/manual email controls, and private results. Default cadence 21 days; dynamic recall/email copy follows cadence. Standalone survey admin URL redirects into provisioning.

Production collection enabled with server-controlled production Firebase mode. Administration writes, manual email, recurring delivery and SMS webhook remain off. Production private namespace rules already denied direct clients; no production rule changes made. No real-coach enrollment was created.

Two expiring user-test invitations use a synthetic participant/program, not a real coach account. User baseline submission is confirmed and periodic is unlocked. Do not regenerate or consume user links. Private test results entry: `/admin/pulsecheckProvisioning?coachSurveyTest=1`, existing administrator sign-in required. No new admin grants.

One earlier combined test email was delivered. No SMS was sent. Separate coach-facing baseline/check-in email drafts still await explicit sending approval. No new messages are authorized by this checkpoint.

## WIP: not deployed or ready to activate

Organization-level draft policy controls are embedded in provisioning. Fields: institutional email/verified phone required, exact approved domains, explicit coaches vs coaches-and-students rollout.

Draft API reuses existing same-project verified-email administrator authorization. Storage is in the existing client-denied namespace, separate draft and active collections. Draft saving and active enforcement each default off. There is no activation endpoint.

Team invitation server guard checks verified token claims: email domain, verified mailbox, verified phone, and no Google session for restricted onboarding. The invite UI hides its Google action for affected audiences. Existing policy absence preserves behavior.

Incomplete: Firebase phone OTP UI/provider setup, phone linking to canonical existing UID, phone-to-approved-coach/team mapping, shared nonsecret QR entry, server-owned restricted profile completion and old-client/rules bypass review, and automatic baseline continuation after setup. Existing targeted invites require verified institutional email; phone possession does not prove email ownership or membership. Do not remove verification or grant roles from QR/domain alone. Do not globally disable Google or migrate existing users. Student/UMES onboarding is unchanged and requires separate rollout review.

See `institution-policy-local-review.md` for architecture and release gates.

## Validation at checkpoint

- 47 synthetic unit tests pass (36 survey + 11 institution policy/API tests).
- TypeScript passed again after the final narrow layout adjustment.
- Full production Next compilation and Netlify packaging passed on the WIP. The final select-width adjustment was then typechecked and visually verified. No WIP deployment.
- Static component layout inspected at desktop and 390px with synthetic institution content. This was not an authenticated dashboard integration test.
- Published survey release previously passed full Netlify build and 58 targeted tests. Live baseline, baseline-before-periodic linkage, invalid payload rejection, unauthorized result denial, production review-mode disabling, admin redirect and sticky progress were checked.

## Resume on Mac mini

```sh
git fetch origin
git switch --track origin/codex/institution-onboarding-policy
npm ci --legacy-peer-deps
node --test tests/unit/institution-onboarding-policy.test.cjs tests/unit/coach-surveys.test.cjs
npx tsc --noEmit
```

If the branch already exists, switch to it and inspect status/upstream before updating. Do not overwrite unrelated work. Read AGENTS.md and the shared Pulse writing/design guide. Reconcile newer main before release; do not automatically deploy. Use the normal authorized local Firebase/Netlify environment on the destination; no credentials are included in Git.

## External gates and local-only artifacts

Firebase CLI administrative session expired. Phone-provider enabled state, SMS regions, billing/quota and authorized domains are unverified. No login/refresh/provider change was attempted in the policy work. Existing survey Twilio configuration is incomplete and is separate from Firebase phone authentication.

Any provider/security-policy changes, new role/access grants, phone-code sends and publication of expanded onboarding require separate approval. Preserve all survey delivery-off gates.

Private invitation manifests/provider journals are in laptop `/tmp`; they contain capability tokens or delivery identifiers and are deliberately NOT committed or copied to a new machine. Do not print their contents or recreate/send invitations as part of resume. Use existing authorized user links or approved server read-only verification when needed.

Untracked `coach-surveys/output/coach-surveys/` contains local QA outputs/screenshots and is deliberately excluded. Build `.next`, `.netlify`, dependencies and localhost synthetic preview under `/tmp/institution-policy-ui` are generated/ephemeral; none is needed to resume source work. The localhost preview and dev processes will stop when the laptop closes.
