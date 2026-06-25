# Competitive Brief: Maintain a Macra Decision Log Tying Every Operational Change to Expected Metrics and Guardrails

## Question

What decision-log structure should Macra use to tie each operational change to an expected metric movement, a guardrail metric, and a review cadence using the artifacts it already has available?

## 5 Concrete Examples

### 1. Statsig — Guardrail Metrics Framework
- **Public URL:** <https://www.statsig.com/perspectives/guardrail-metrics-experimentation>
- **Short note on structure:** Statsig explicitly frames decision-making around a primary success metric plus supporting guardrail metrics so teams can ship changes only when the upside holds without hidden harm elsewhere.

### 2. Optimizely — Guardrail Metrics
- **Public URL:** <https://www.optimizely.com/optimization-glossary/guardrail-metrics/>
- **Short note on structure:** Optimizely documents a classic experiment structure where teams define a main target metric and monitor guardrails to catch negative side effects before operationalizing a win.

### 3. LaunchDarkly — Experimentation Metrics
- **Public URL:** <https://launchdarkly.com/docs/home/experimentation/metrics>
- **Short note on structure:** LaunchDarkly treats metrics as first-class experiment objects so changes can be tied to explicit success criteria, monitored in rollout, and evaluated before broader release.

### 4. Amplitude — Guardrail Metrics / Experiment Measurement
- **Public URL:** <https://amplitude.com/explore/experiment/guardrail-metrics>
- **Short note on structure:** Amplitude's experimentation guidance emphasizes choosing the primary metric you expect to move while defining guardrails that protect the user experience and overall business health.

### 5. Microsoft ExP / OEC A/B Testing Guidance
- **Public URL:** <https://learn.microsoft.com/en-us/archive/msdn-magazine/2017/september/cutting-edge-guidelines-for-successful-ab-testing>
- **Short note on structure:** Microsoft's experimentation guidance centers on an Overall Evaluation Criterion (OEC) with disciplined measurement, making it a strong public example of tying product changes to expected impact while avoiding misleading local wins.

## Differentiated Opportunities

_To be populated with exactly 3 opportunity subsections that map observed patterns onto Macra's existing artifacts: Scoreboard, Experiments, purchase logs, cancel reasons, user state, retargeting state, and AppsFlyer imports._

## Recommended Test

_To be populated with one concrete decision-log pilot, including the entry format, the first operational change to track, the expected primary metric, the guardrail metric, and the review cadence._

## Sources

_To be populated with the public URLs used in this brief._
