# PulseCheck Scoring V2 Contract

Status: implemented reference contract  
Methodology version: `2.0.0`  
Default window: 14 athlete-local calendar days

## Purpose

PulseCheck reports four separate scores because each answers a different question:

| Score | Question | Athlete state affects it? | Follow-through affects it? |
| --- | --- | --- | --- |
| Wellbeing | How has the athlete described their recent wellbeing? | Yes | No |
| Recovery | What do current subjective, sleep, and source-normalized autonomic signals show? | Yes | No |
| Adherence | Did the athlete complete scheduled check-ins and verified commitments? | No | Yes |
| Coherence | Did the athlete's final commitment and verified action line up while they continued showing up? | No | Yes |

A difficult day can lower Wellbeing or Recovery without lowering Adherence. An honest difficult-day check-in counts as showing up. Coherence can never exceed Adherence.

## Shared output contract

Every score includes:

- `score`: integer from 0 through 100, or `null` when the evidence is still building or insufficient.
- `status`: `building`, `available`, `recalibrating`, or `insufficient_evidence`.
- `confidence`: `limited`, `moderate`, or `strong`.
- `evidenceCoveragePercent`: how much of the configured evidence was available.
- `observedDays` and `windowDays`.
- `trendDelta`: current score minus the prior comparable 14-day window, or `null`.
- component scores, configured weights, plain-language evidence details, and limitations.

Missing evidence remains missing. It never becomes zero. Available components are reweighted for the displayed score while evidence coverage shows what was absent.

## Wellbeing

Configured components:

1. Daily wellbeing check-ins: 50%.
2. Current periodic wellbeing instrument: 50%.

The daily five-choice response maps to `0, 25, 50, 75, 100`. This is a PulseCheck product transformation, not a validated instrument scoring rule.

The periodic instrument slot is implemented as a versioned input. The WHO-5 is the intended evidence anchor after commercial-use rights and final instrument governance are confirmed. PulseCheck must not ship altered or unlicensed WHO-5 wording.

If a current periodic instrument is absent, daily responses can produce a provisional score. Evidence coverage remains lower.

## Recovery

Configured components:

1. Athlete-reported recovery: 40%.
2. Sleep: 35%.
3. Autonomic stability: 25%.

Sleep uses:

- Duration against the athlete or coach configured target: 50% of sleep.
- Efficiency or continuity: 25% of sleep.
- Timing consistency: 25% of sleep.

Sleep-stage percentages are excluded because stage estimates are not interchangeable across consumer devices.

Autonomic stability uses:

- Source-normalized HRV: 50% of autonomic stability.
- Source-normalized resting heart rate: 50% of autonomic stability.

The final maximum contribution is 12.5% HRV and 12.5% resting heart rate.

### Measurement lanes

Raw HRV and resting heart rate are never pooled across devices or methods. Each lane is identified by:

`source family + device + metric + method + measurement window + algorithm version`

Examples:

- Apple HealthKit HRV uses SDNN and typically represents a different observation window from a sleep-derived vendor value.
- WHOOP and Oura HRV are commonly sleep-derived RMSSD.
- Android Health Connect HRV uses RMSSD records.

Each lane needs 14 valid prior observations within 28 days. A new lane displays `recalibrating` until that baseline exists. PulseCheck compares the current value with that athlete's same-lane mean and standard deviation. HRV moves in the direct direction. Resting heart rate moves in the inverse direction. The resulting normalized state is bounded to 0 through 100.

One primary lane is selected per metric and day. An explicit primary source wins. Otherwise, the lane with the strongest recent history wins, with a direct vendor source breaking a same-day tie over an aggregator. Source transitions are written to the scorecard audit surface.

## Adherence

Configured components:

1. Scheduled check-in completion: 40%.
2. Verified commitment follow-through: 60%.

Connected-device wear is excluded. App opens and passive usage are excluded.

Scorable commitment states:

| State | Outcome |
| --- | --- |
| `completed` | Followed through |
| `planned_rest` | Followed through when rest fits the plan and weekly follow-through remains met |
| `rest_over_plan` | Not followed through |
| `missed` | Not followed through |
| `accepted` | Pending today, missed after the day closes without a verified outcome |
| `replacement_accepted` | Pending today, missed after the day closes without a verified outcome |
| `coach_excused` | Excluded |
| `technical_failure` | Excluded |
| `no_assignment` | Excluded |

The product must not offer `Already completed elsewhere` because that state cannot be verified by the current system.

The server evaluates planned rest against the assignment, program, or curriculum policy. When no explicit policy is stored, the current default is one planned-rest day in a rolling seven-day window. Consecutive planned-rest days fail weekly follow-through. A rest request outside the active policy is stored as `rest_over_plan`, not silently accepted as followed through.

`Try another skill` creates a replacement assignment with lineage back to the original commitment. The replacement remains pending until it receives a final, verifiable outcome.

## Coherence

Commitment Congruence is the percentage of days with both:

1. An athlete wellbeing check-in.
2. A final, scorable commitment outcome that followed through.

Coherence is available after at least three congruence days.

Formula:

```text
Coherence = min(
  Adherence,
  sqrt(Adherence * CommitmentCongruence)
)
```

This makes showing up a hard constraint. A high congruence percentage from a few isolated days cannot produce a high Coherence score while overall Adherence is low. Wellbeing and Recovery never enter the Coherence formula.

## Athlete and coach boundaries

Athletes may see their four scores, direction, evidence coverage, and neutral status language. Athlete copy never recommends rest, reduced intensity, return to participation, or another physical training decision.

Coaches may receive a source-qualified mixed-signal observation. Example:

> Mixed recovery signals. The athlete reports feeling recovered. Overnight HRV is below their personal WHOOP range and sleeping resting heart rate is above range on 2 of the last 3 valid nights. This is informational. Review it alongside workload, symptoms, and direct observation.

The coach and sports medicine team retain training and care decisions.

Athlete scorecard responses remove raw autonomic values and internal source-lane identifiers. Coach context requires active team scope and preserves source transitions for review.

## Nora behavior

The default post-check-in response is:

> Thanks for checking in. If you have a little time, we can talk more about what is behind it.

Pro athletes receive a `Talk with Nora` action. Nora asks a feeling-specific question only after the athlete opens that conversation. Junior athletes stay in the bounded guided flow.

Nora does not produce an unsolicited sleep, activity, recovery, calorie, or energy story. Health-data explanations require an explicit athlete request for that domain.

## Governance and validation

- Formula, mappings, thresholds, and version are persisted with every scorecard.
- Score changes require a methodology version change, fixtures, and shadow comparison against the prior version.
- TypeScript owns the canonical calculation. Product QA verifies the same versioned response contract, null states, source transitions, and four-score display across Swift, Kotlin, and coach web fixtures.
- Prospective validation must assess reliability, convergent and discriminant validity, sensitivity to change, subgroup performance, missingness, and decision impact.
- Until that work is complete, PulseCheck describes these as evidence-informed proprietary indices.
