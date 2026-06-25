# Competitive Brief: Maintain a Macra Decision Log Tying Every Operational Change to Expected Metrics and Guardrails

## Question

What decision-log structure should Macra use to tie each operational change to an expected metric movement, a guardrail metric, and a review cadence using the artifacts it already has available?

## 5 Concrete Examples

### 1. Statsig — Guardrail Metrics Framework
- **Public URL:** <https://www.statsig.com/perspectives/guardrail-metrics-experimentation>
- **Short note on structure:** Statsig explicitly frames decision-making around a primary success metric plus supporting guardrail metrics so teams can ship changes only when the upside holds without hidden harm elsewhere.
- **Operational change mechanism:** Teams launch a feature or product change through an experiment and evaluate it against a predefined success metric plus companion guardrails rather than shipping on intuition alone. Source: <https://www.statsig.com/perspectives/guardrail-metrics-experimentation>
- **Expected metric movement:** The expected movement is improvement in the core success metric the team is trying to drive, while still interpreting the result in the broader product context. Source: <https://www.statsig.com/perspectives/guardrail-metrics-experimentation>
- **Guardrail metric:** Statsig's guidance is to watch adjacent metrics that would reveal hidden user harm, regressions, or unhealthy tradeoffs if the primary metric rises for the wrong reason. Source: <https://www.statsig.com/perspectives/guardrail-metrics-experimentation>
- **Decision cadence / owner:** Unverified at the team-operating level, but the article clearly assumes an experimentation owner or product team reviews experiment outcomes before rollout. Source: <https://www.statsig.com/perspectives/guardrail-metrics-experimentation>

### 2. Optimizely — Guardrail Metrics
- **Public URL:** <https://www.optimizely.com/optimization-glossary/guardrail-metrics/>
- **Short note on structure:** Optimizely documents a classic experiment structure where teams define a main target metric and monitor guardrails to catch negative side effects before operationalizing a win.
- **Operational change mechanism:** A product, marketing, or experience change is tested as a deliberate intervention, with the main decision framed around whether the tested variant should ship. Source: <https://www.optimizely.com/optimization-glossary/guardrail-metrics/>
- **Expected metric movement:** The intended outcome is movement in the target conversion or engagement metric associated with the change being tested. Source: <https://www.optimizely.com/optimization-glossary/guardrail-metrics/>
- **Guardrail metric:** Optimizely defines guardrails as the secondary metrics that ensure a "win" does not come with damage to retention, satisfaction, or other important outcomes. Source: <https://www.optimizely.com/optimization-glossary/guardrail-metrics/>
- **Decision cadence / owner:** Unverified at the organizational level, but the framework assumes experiment owners review results after a test window before rollout or rejection. Source: <https://www.optimizely.com/optimization-glossary/guardrail-metrics/>

### 3. LaunchDarkly — Experimentation Metrics
- **Public URL:** <https://launchdarkly.com/docs/home/experimentation/metrics>
- **Short note on structure:** LaunchDarkly treats metrics as first-class experiment objects so changes can be tied to explicit success criteria, monitored in rollout, and evaluated before broader release.
- **Operational change mechanism:** Teams define metrics before or alongside a flag-based change, then use the experiment and rollout system to connect operational release decisions to measured outcomes. Source: <https://launchdarkly.com/docs/home/experimentation/metrics>
- **Expected metric movement:** The expected movement is captured in the metric attached to the rollout or experiment, making success criteria explicit rather than implied. Source: <https://launchdarkly.com/docs/home/experimentation/metrics>
- **Guardrail metric:** Additional metrics can be attached to watch for side effects during rollout, giving teams a way to stop or refine a release when collateral damage appears. Source: <https://launchdarkly.com/docs/home/experimentation/metrics>
- **Decision cadence / owner:** The natural owner is the feature or experiment owner reviewing flag performance during rollout checkpoints, though exact governance cadence is Unverified in the doc excerpt. Source: <https://launchdarkly.com/docs/home/experimentation/metrics>

### 4. Amplitude — Guardrail Metrics / Experiment Measurement
- **Public URL:** <https://amplitude.com/explore/experiment/guardrail-metrics>
- **Short note on structure:** Amplitude's experimentation guidance emphasizes choosing the primary metric you expect to move while defining guardrails that protect the user experience and overall business health.
- **Operational change mechanism:** A team proposes a change, maps it to the behavioral metric it expects to improve, and reviews that change through experiment analysis instead of treating analytics as post-hoc reporting. Source: <https://amplitude.com/explore/experiment/guardrail-metrics>
- **Expected metric movement:** The framework expects a preselected primary metric to move in a positive direction if the intervention is actually working. Source: <https://amplitude.com/explore/experiment/guardrail-metrics>
- **Guardrail metric:** Guardrails are the metrics that protect overall product health by catching friction, degraded user experience, or business harm while the primary metric is being optimized. Source: <https://amplitude.com/explore/experiment/guardrail-metrics>
- **Decision cadence / owner:** Unverified in the excerpt, but the operating assumption is a product/growth owner reviewing experiment readouts before scaling the change. Source: <https://amplitude.com/explore/experiment/guardrail-metrics>

### 5. Microsoft ExP / OEC A/B Testing Guidance
- **Public URL:** <https://learn.microsoft.com/en-us/archive/msdn-magazine/2017/september/cutting-edge-guidelines-for-successful-ab-testing>
- **Short note on structure:** Microsoft's experimentation guidance centers on an Overall Evaluation Criterion (OEC) with disciplined measurement, making it a strong public example of tying product changes to expected impact while avoiding misleading local wins.
- **Operational change mechanism:** Microsoft describes A/B testing as a structured decision system where proposed product changes are evaluated against an Overall Evaluation Criterion instead of relying on fragmented local signals. Source: <https://learn.microsoft.com/en-us/archive/msdn-magazine/2017/september/cutting-edge-guidelines-for-successful-ab-testing>
- **Expected metric movement:** The expected movement is improvement in the OEC or other carefully chosen success metrics that reflect true user and business value. Source: <https://learn.microsoft.com/en-us/archive/msdn-magazine/2017/september/cutting-edge-guidelines-for-successful-ab-testing>
- **Guardrail metric:** The article warns against local wins and misleading metrics, implying the need for additional checks so a treatment does not improve one number while harming the broader system. Source: <https://learn.microsoft.com/en-us/archive/msdn-magazine/2017/september/cutting-edge-guidelines-for-successful-ab-testing>
- **Decision cadence / owner:** The guidance points to a disciplined experimentation practice owned by teams running repeated tests, with review occurring at the end of each valid experiment window rather than ad hoc. Source: <https://learn.microsoft.com/en-us/archive/msdn-magazine/2017/september/cutting-edge-guidelines-for-successful-ab-testing>

## Differentiated Opportunities

### 1. Turn Macra's Scoreboard + Experiments into a single decision-entry backbone
The strongest repeated pattern across Statsig, Optimizely, LaunchDarkly, Amplitude, and Microsoft ExP is that teams do not treat metrics as passive dashboards — they attach a proposed change to a named success metric before rollout and review the result against a defined frame. For Macra, the immediate opportunity is to pair **Scoreboard** with **Experiments** so every operational change gets logged with: hypothesis, owner, date launched, expected primary metric movement, and experiment status. That would let the team stop debating changes in narrative-only form and instead compare decisions against a stable before/after record.

### 2. Use purchase logs, cancel reasons, and user state as Macra's native guardrail layer
The public frameworks all emphasize guardrails, but Macra already has unusually concrete internal signals for them: **purchase logs**, **cancel reasons**, and **user state**. That creates a differentiated opportunity to define guardrails in customer-trust terms instead of only conversion terms. For example, a paywall or acquisition change could target improved trial starts as the primary metric while watching downstream cancel-reason mix, subscription conversion quality, refund-like patterns in purchase logs, and state transitions that suggest low-quality activation. This is stronger than generic experimentation because Macra can evaluate not just whether a metric rises, but whether it rises with durable intent.

### 3. Make source-quality decisions legible by joining retargeting state and AppsFlyer imports to the log
A repeated pattern in the external examples is that teams need one place to evaluate whether a change should scale. For Macra, the most differentiated version of that is a decision log that explicitly joins **retargeting state** and **AppsFlyer imports** to source-level operating decisions, especially ASA versus organic quality. Instead of logging "increase ASA" as a loose action item, Macra can log the channel change, expected primary movement, and guardrails tied to post-checkout quality, retargeting saturation, and attribution coverage. That would directly support the current operating need to separate channel quality from funnel quality before increasing paid focus.

## Recommended Test

### Pilot a one-change-per-entry Macra decision log for paywall refinement
- **Log entry format:** `date`, `owner`, `operational change`, `why now`, `expected primary metric`, `guardrail metric`, `supporting artifacts`, `review date`, `decision outcome`, and `next action`.
- **First operational change to track:** Log the next paywall or initiated-checkout refinement as a single decision entry — for example, one copy/proof/order-of-information change tied to the active funnel rather than a bundle of edits.
- **Expected primary metric:** `trial starts per paywall viewer` or `trial starts per initiated checkout`, depending on where the exact change is introduced.
- **Guardrail metric:** `early cancel rate / negative cancel-reason mix among newly acquired subscribers`, with purchase-log quality checks used to catch low-intent lift.
- **Review cadence:** Review the entry on a fixed weekly cadence, with an earlier check if Scoreboard or Experiments show an abnormal movement in either the primary metric or the guardrail.
- **Why this pilot fits Macra now:** It uses existing artifacts already named in the operating system — Scoreboard, Experiments, purchase logs, cancel reasons, user state, and AppsFlyer imports — and forces the team to separate one operational change from surrounding noise before deciding to scale, revert, or refine.

## Sources

- <https://www.statsig.com/perspectives/guardrail-metrics-experimentation>
- <https://www.optimizely.com/optimization-glossary/guardrail-metrics/>
- <https://launchdarkly.com/docs/home/experimentation/metrics>
- <https://amplitude.com/explore/experiment/guardrail-metrics>
- <https://learn.microsoft.com/en-us/archive/msdn-magazine/2017/september/cutting-edge-guidelines-for-successful-ab-testing>
