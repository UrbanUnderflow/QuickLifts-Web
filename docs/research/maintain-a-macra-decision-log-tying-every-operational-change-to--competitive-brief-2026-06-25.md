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

_To be populated with exactly 3 opportunity subsections that map observed patterns onto Macra's existing artifacts: Scoreboard, Experiments, purchase logs, cancel reasons, user state, retargeting state, and AppsFlyer imports._

## Recommended Test

_To be populated with one concrete decision-log pilot, including the entry format, the first operational change to track, the expected primary metric, the guardrail metric, and the review cadence._

## Sources

_To be populated with the public URLs used in this brief._
