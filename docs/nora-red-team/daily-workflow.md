# Nora daily testing

Open `/admin/noraRedTeam`, choose **Run daily check**, then review the scenarios marked **Needs review**. The daily run continues on the server. The list also includes two rotating passing conversations to help catch missed findings.

Select a scenario to see its purpose, approved rules, conversation, and result. Answer **Appropriate and safe?** and **Helpful?**, then **Save and review next**. Sensitive or uncertain decisions go to the designated owner. A finished review can leave an issue open for a fix.

Use **Add a situation** to describe an invented athlete situation. AI chooses an approved template and drafts the conversation. Its rules and checks remain tied to that template. Review policy questions, save changes, try the saved draft, and review the result. The owner approves that version into the library. Editing a draft requires a fresh trial before approval. A useful failing test can be approved after the owner reviews it.

For an issue, keep it as a regression, make the fix, run the same scenario and target again, and review the passing result. The owner closes the original issue with that evidence. Older results without scenario fingerprints remain historical evidence; they cannot silently clear current release blockers.

Coverage describes the selected target and recent saved evidence. Native consent screens, persistence, assignment freshness, and reminder delivery require direct device or integration checks. The production owner records iOS and Android evidence with the exact tested commit and notes.

## Deployment and first use

1. Production now protects the `nora-red-team-*` namespace with a narrow server-only rule change. Apply the same exclusion to development before enabling its new writes. Preserve the remaining deployed rules: the full repository rules differ from the live rules and should not be deployed as part of this change.
2. Deploy the Next routes, background workers, and updated `pulsecheck-chat` function together. The chat function reports its actual commit and target model for staging checks. Make commit metadata available to function runtime; an unknown build fails the release gate.
3. A signed-in global admin sets themselves as the first owner in Team settings. Only the primary account can add or remove owners, including role promotions and demotions. Other owners can manage reviewers. Individual internal and external emails are supported. Owners approve scenarios, resolve sensitive reviews, close issues, record device evidence, and manage membership; reviewers run and review tests. Membership is centralized in production for both evidence environments. External members need a verified sign-in email that exactly matches their grant. Sharing a domain gives no automatic access, and membership gives no access to other admin pages. Share the testing page manually; adding a member sends no email. Removing membership takes effect on subsequent requests. Keep at least one owner.
4. Confirm the model bridge permits `noraRedTeam` and the configured target/judge models. Staging requires development Firebase credentials, a development Web API key, and the existing synthetic no-contact chat setup. Use the same approved catalog and regressions in both evidence projects before a release check.
5. Run the daily check and review its results. The scheduled job now runs daily at 08:00 UTC. Up to three scenarios run concurrently within a 13-minute worker budget; an incomplete or timed-out run stays unsuccessful. The daily suite includes all 22 original cases, six operational conversation cases, four everyday athlete-usefulness cases, approved custom cases, and promoted regressions.
6. For release, run sandbox and staging checks for the exact candidate commit, complete required reviews, and record matching device evidence. CI sends `GITHUB_SHA` (or `NORA_RED_TEAM_RELEASE_BUILD`) to the protected release endpoint. Both targets, catalog fingerprint, contract/evaluator versions, configured models, current run evidence, and device attestations are checked. Evidence expires after two days.

GitHub branch protection and the deployment platform must require the release check. This code change supplies the fail-closed check; it does not configure hosted branch protection or prevent an independently configured automatic deployment. Deploy candidate builds to staging before promotion.

## Local verification

The local Next server needs existing Firebase Admin credentials through its normal credential configuration. For this session, the server uses the existing service account file through `GOOGLE_APPLICATION_CREDENTIALS`; no credential contents were copied into the project or browser.

The authenticated local screen was checked against saved production test history, and the signed-in admin account was saved and verified as the first owner. New tests exercise score conflicts, incomplete usefulness evidence, candidate mismatches, stale review writes, owner-only approvals, trial identity, and linked retest closure without writing live evaluation data. Full model-backed creation, approval, daily scheduling, and release promotion need a deployment smoke test after the rules and team setup above.


## Grader calibration and context repair

The default evaluation agent is now GPT-4o; the Nora target remains GPT-4o-mini unless configured otherwise. Both identities are retained in run evidence and checked at release. The stronger evaluator matched all 12 calibration cases in the local comparison, including correct care refusals and missing versus unused data. This small calibration set is diagnostic, not proof of general accuracy. Two initial expected appropriateness labels were corrected: falsely denying available data and ignoring a no-question request are inappropriate as well as unhelpful.

Usefulness assessment uses a strict output schema and requires each negative finding to quote the corresponding Nora reply. Incomplete or unsupported evidence fails closed. The implementation follows [OpenAI structured-output guidance](https://developers.openai.com/api/docs/guides/structured-outputs); schema validity does not establish judgment accuracy.

Sandbox replies in the health-data and app-support lanes receive one context-preserving repair attempt before a generic fallback. The deployed chat route already has its own context-preserving revision path; the shared topic check now recognizes “slept” as relevant to “sleep.” Voice cleanup no longer rewrites a supplied focus cue into a breathing instruction. Consent withdrawal is checked before any coach-message database operation.
