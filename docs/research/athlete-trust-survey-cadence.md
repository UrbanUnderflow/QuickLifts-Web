# Athlete trust survey: purpose, schedule, and evidence

Policy: `trust_milestones_v2`  
Implementation date: October 29, 2026  
Status: Implemented in local backend and iOS source. Deployment, native release, and signed-in device verification remain separate release steps.

## Purpose and instrument

This is voluntary product feedback about athletes' experience of PulseCheck's guidance. The primary item asks, “How much do you trust what PulseCheck is telling you right now?” Athletes answer from 1 to 10. The existing wording and score presentation are preserved.

The next screen asks, “What's shaping that feeling?” Athletes may select any of five existing positive statements, or skip them:

- Credibility: “PulseCheck actually knows what it's talking about.”
- Reliability: “Nora shows up consistently.”
- Comfort being honest: “I feel comfortable being honest here.”
- Relevance: “This feels built for someone like me.”
- Usefulness: “Something I've learned here has carried over.”

An optional note asks what is working, what is not working, or what the athlete wishes were different. At pilot midpoint and endpoint, the companion recommendation item asks, “Would you tell a teammate to try this?” on the existing 0–10 scale. Initial and quarterly trust requests omit the recommendation item. A recommendation-only request omits the trust item and drivers.

The trust score and driver selections are custom product feedback measures. This change does not validate their psychometric properties or establish clinical effectiveness, actual system reliability, privacy protection, or trust in coaches/clinicians. Unselected positive statements mean they were not selected; they should not be interpreted as validated negative judgments. Existing legacy binary driver storage/scoring remains unchanged.

## Implemented schedule

All dates are evaluated on the server. A due survey appears through the existing in-app eligibility refresh. This change does not send email, SMS, or push notifications.

| Stage | Eligibility | Questions | Completion rule |
| --- | --- | --- | --- |
| Early experience | After at least 3 completed assigned sessions, before a later milestone takes precedence | Trust score, optional drivers, optional note | Once when there is no earlier trust response in the pilot/enrollment context |
| Pilot midpoint | Pilot duration is at least 56 days; at least half its scheduled duration has elapsed; endpoint has not begun | Trust and recommendation, independently if due | Once per kind; at least 28 days since the previous response of that kind |
| Pilot endpoint | Scheduled pilot end, or an earlier finalized endpoint with a recorded date | Trust and recommendation, independently if due | One endpoint opportunity per kind, open for 28 days after the endpoint |
| Ongoing use | Active pilot enrollment, membership not inactive/removed/withdrawn/paused, and a completed session within the last 30 days | Trust score, optional drivers, optional note | At least 90 days after the later of the endpoint and latest trust response |
| Open-ended program | Existing pilot/enrollment context without an end date | Initial trust, followed by ongoing trust | After the initial answer, at least 90 days between trust responses, with the same active-use requirements |

“Quarterly” means 90 elapsed days, not calendar-quarter boundaries. The existing system requires a pilot/enrollment context; this change does not add surveys for standalone users without one. No quarterly surveys are inserted into an unfinished dated pilot.

### Spacing, coverage, and reminders

- Completed midpoint and endpoint surveys do not reappear when a cooldown expires.
- A response in the 28 days preceding the fixed endpoint satisfies endpoint coverage. Its original timestamp is retained. The API reports the response ID, actual date, and whether it preceded the endpoint. It is not rewritten as a new endpoint response.
- Endpoint coverage includes a response exactly 28 days before the endpoint. The endpoint collection window closes exactly 28 days afterward. An unanswered old endpoint never becomes a months-late endpoint request.
- If the initial response is too close to midpoint, midpoint waits until the 28-day spacing is met, provided the pilot has not ended. A skipped or expired earlier milestone is not queued behind a later one.
- Eligibility is tracked separately for trust and recommendation. If trust saves but recommendation does not, a later request can contain only recommendation. iOS also avoids re-sending a confirmed successful component during an in-view retry.
- iOS retains its existing 14-day local reminder delay after dismissal/submission for that stage. This is a reminder throttle, not permission to repeat a completed survey. Dismissal is not counted as completion, and the reminder delay is device-local rather than cross-device.
- Existing enrollment/consent and operational survey restrictions remain in force. The old iOS fallback that could independently revive the previous schedule is removed; the backend owns eligibility.
- Future-dated responses are excluded from cadence calculations. Historical responses without stage tags are interpreted by their dates, without rewriting them. Explicitly different enrollment IDs and non-athlete roles do not satisfy the athlete's schedule.
- New iOS submissions retain their stage and policy version. API coverage metadata is available for reporting; this change does not add new dashboard presentation of that metadata.
- Significant product changes do not automatically trigger extra surveys. Any targeted follow-up needs a separately defined purpose and collection window.

### Examples

These examples assume prompt completion when eligible and no operational restrictions.

| Pilot | Early trust | Midpoint trust | Endpoint trust | Trust total |
| --- | --- | --- | --- | --- |
| 12 weeks | Day 7 | Day 42 | Day 84 | 3 |
| 8 weeks | Day 7 | Day 35, after 28-day spacing | Day 56 uses day-35 response for coverage | 2 |
| 6 weeks | Day 7 | Omitted | Day 42 | 2 |
| 4 weeks | Day 7 | Omitted | Day 28 uses day-7 response for coverage | 1 |

Recommendation timing can differ because its own response history is evaluated separately. For example, in the 8-week example, a first recommendation response on day 28 can satisfy endpoint coverage on day 56.

After a 12-week pilot with an endpoint trust response on day 84, the first ongoing trust request is eligible on day 174, and only if enrollment and recent activity still qualify. A delayed response restarts the 90-day spacing from its actual submission date.

## Evidence and its limits

No identified study establishes an optimal PulseCheck trust-survey interval for student athletes. The 3-session, 28-day, 56-day, 90-day, and recent-activity thresholds are operating decisions informed by research. They should be evaluated with actual response coverage and usefulness rather than represented as validated scientific cutoffs.

### Experience-based trust

Merritt and Ilgen studied 255 students performing an automated X-ray screening task. The same trust items reflected different constructs before and after interaction: dispositional trust and history-based trust. This supports distinguishing early experience of the product from pre-use propensity to trust. It does not establish three sessions as an optimum or demonstrate validity in athlete wellbeing apps.

Merritt, S. M., & Ilgen, D. R. (2008). *Not All Trust Is Created Equal: Dispositional and History-Based Trust in Human-Automation Interactions*. Human Factors, 50(2), 194–210. https://doi.org/10.1518/001872008X288574

### Trust responds to interaction outcomes

Yang, Schemanske, and Searle studied 75 participants across 40 decision-aid trials. Trust changed with interaction outcomes; failures had larger effects than successes. This supports attending to experience and meaningful product events. A controlled task with frequent measurement does not establish a quarterly or milestone-based schedule for this product.

Yang, X. J., Schemanske, C., & Searle, C. (2023; online 2021). *Toward Quantifying Trust Dynamics: How People Adjust Their Trust After Moment-to-Moment Interaction With Automation*. Human Factors. https://pubmed.ncbi.nlm.nih.gov/34459266/ ; author manuscript: https://arxiv.org/abs/2107.07374

### Survey burden depends on length and context

Eisele and colleagues assigned 163 students to 30- or 60-item questionnaires, three, six, or nine times daily for 14 days. Longer questionnaires increased burden and compromised data quantity/quality; higher frequency did not show equivalent detrimental effects. The practical implication is to keep collection brief and purposeful. This is not evidence that a survey every two weeks is inherently harmful.

Eisele, G., et al. (2022; online 2020). *The Effects of Sampling Frequency and Questionnaire Length on Perceived Burden, Compliance, and Careless Responding in Experience Sampling Data in a Student Population*. Assessment, 29(2), 136–151. https://pubmed.ncbi.nlm.nih.gov/32909448/

A randomized trial of 492 older adults compared smaller survey batches every two weeks with full batches every four weeks, holding total survey volume constant. Smaller, more frequent batches maintained higher longitudinal response rates. Its population and survey workload differ substantially from PulseCheck, but it reinforces that frequency alone is an inadequate explanation of burden.

Zhang et al. (2025). *Smartphone App–Based Survey Deployment Patterns and Longitudinal Response Rate: Randomized Controlled Trial*. Journal of Medical Internet Research. https://www.jmir.org/2025/1/e73972/

## Why these operating choices

Three sessions provide a practical opportunity for initial experience. The eight-week minimum avoids crowding short pilots with a midpoint. Four-week spacing creates time for additional experience and avoids asking closely spaced versions of the same question. A fixed endpoint window keeps the timing interpretable. Ninety-day ongoing spacing provides occasional product feedback while prioritizing training. Recent use gives the answer a current experiential basis.

These are explicit design judgments. Neither these studies nor this implementation prove that fewer surveys improve retention, that trust changes only quarterly, or that high trust necessarily means appropriate reliance.

## Evaluation and release

Review completion by eligible stage, dismissals, time to complete, response timing, and concrete decisions informed by responses after a pilot cycle. Distinguish within-athlete change from changes in the responding population. Report respondent counts and missingness; active-user quarterly feedback can omit dissatisfied users who stopped using the product. Assess whether a shorter instrument and the chosen timing answer the product question before adding measurement frequency.

Local validation covers cadence boundaries, legacy coverage, partial-kind completion, post-pilot activity, operational restrictions, response metadata, and Swift survey flow. Full native build/render checks and signed-in live behavior remain release requirements. The backend and iOS changes should ship together because older iOS versions always displayed both survey types. No existing Android pilot-survey consumer was found in the inspected source; this work does not add an Android survey screen. This change does not introduce server-side exactly-once submission guarantees for ambiguous network failures.
