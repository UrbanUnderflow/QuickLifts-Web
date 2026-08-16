# PulseCheck Simulation Family Accuracy Audit

**Audit date:** 2026-08-15  
**Scope:** Noise Gate, Reset, Brake Point, Signal Window, Sequence Shift, and Endurance Lock  
**Status:** Corrected implementation contract. This is not validation evidence.

## Executive Finding

All six canonical simulation families now use a defined task, reproducible schedule, declared observed measures, explicit minimum-data rules, and bounded interpretation across web, iOS, and Android. The runtime no longer treats a game label as proof that a psychological construct was measured.

The correct claim is **evidence-informed and paradigm-aligned where noted**. PulseCheck has not yet established external validity, test-retest reliability, clinical validity, diagnostic use, readiness prediction, neural change, or transfer to sport performance.

## Governing Standard

Every family keeps four layers separate:

1. **Task:** what appears and what the athlete does.
2. **Observed measure:** the behavior calculated from this task.
3. **Construct hypothesis:** the process the task is intended to engage.
4. **Transfer hypothesis:** a possibility that requires a separate sport-relevant study.

Practice is excluded. Accuracy, correct-response time, wrong responses, early responses, and timeouts remain separate. Conditions are matched or balanced. Responses below the 150 ms artifact floor do not enter response-time estimates. No result is a diagnosis, brain score, readiness label, stable trait, or proof of sport transfer.

## Release Summary

| Family | Canonical task | Standard core result | Minimum-data rule | Interpretation boundary |
|---|---|---|---|---|
| Noise Gate | Find one visible called number in matched reference and distraction fields. | Reference accuracy minus distraction accuracy. | Core reporting needs equal condition counts and at least 5 rounds per condition; response-time shift needs 3 valid correct matched pairs. | Task-specific distraction effect, not a general attention trait. |
| Reset | Classify matched left/right arrows before or after one controlled interruption and fixed reset interval. | Median post-interruption minus reference response-time difference. | Needs 6 valid correct matched pairs. | Task re-entry observation, not emotional recovery or resilience. |
| Brake Point | Make left/right go responses and withhold when delayed STOP appears. | Stop success beside go accuracy and go response time. | Core reporting needs the 48 go and 16 stop trials in a standard rep; a stop-time estimate needs 150 valid go and 50 stop trials plus all quality checks. | Stop-signal task behavior, not trait impulsivity. |
| Signal Window | Choose the majority direction in a nine-arrow field at 5/9, 6/9, or 7/9 evidence. | Decision accuracy with correct response time beside it. | Reporting requires all 24 scored trials; overall response time needs 6 valid correct responses and each evidence level needs 2. | Brief perceptual decision, not sport vision or sport IQ. |
| Sequence Shift | Switch between cued Letter and Number rules with stable response keys. | Switch minus repeat response-time difference with accuracy beside it. | Needs 8 valid correct repeat and 8 valid correct switch trials. | Cued task switching, not working-memory capacity or broad flexibility. |
| Endurance Lock | Tap for one constant visual signal after unpredictable foreperiods across six blocks. | Fitted response-time change over elapsed minutes. | Needs 24 valid responses and at least 3 in every block. | This session's sustained-attention performance, not proof of fatigue or its cause. |

## Noise Gate

### Correction

The prior word-memory mechanic did not isolate distraction control and used language such as “live target” and “pressure starts” that obscured the actual action. The replacement is a visible-target visual-search task.

### Final contract

- Two unscored practice rounds.
- Each scored target appears once in a reference condition and once in the configured distraction condition.
- The called number remains visible. A visual distraction may highlight one wrong marker, never the correct marker.
- Visual, audio, and combined variants preserve the same number-search rule.
- Core: `accuracy_cost = reference_accuracy - distraction_accuracy`.
- Reporting accepts the core result only when matched condition counts are equal and each condition contains at least five scored rounds.
- Correct-response-time shift: median of distraction minus reference latency within valid correct matched pairs; unavailable below three pairs.
- Wrong taps, highlighted-distractor taps, timeouts, channel, input method, schedule version, and device class remain separate.

### Evidence boundary

Attentional-control and visual-search research support the interference hypothesis. They do not establish that one mobile session measures a general filtering ability or predicts performance under sport pressure. Any channel comparison requires separately balanced channel conditions.

## Reset

### Correction

The prior runtime changed tasks across tiers and called post-reset response time “recovery time.” Faster responses could also be recorded without requiring a correct matched task response.

### Final contract

- Two unscored practice trials followed by counterbalanced reference/post-interruption pairs.
- Both conditions use the same left/right arrow, response keys, 1700 ms pre-target interval, and 1500 ms response window.
- The post-interruption condition replaces the neutral hold with a 900 ms interruption and fixed 800 ms reset interval.
- Core: median within-pair correct-response difference, post-interruption minus reference.
- The core estimate is unavailable below six valid correct matched pairs.
- Condition accuracy, accuracy difference, first post-interruption correctness, premature responses, timeouts, and reset interval remain separate.

### Evidence boundary

Post-error slowing can reflect more than one process, including orienting and increased response caution. Faster is therefore not automatically better. PulseCheck may describe task re-entry after this controlled interruption; it may not label the result emotional recovery, resilience, mental toughness, or neural recovery.

## Brake Point

### Correction

The prior mechanic asked the athlete to choose a Brake button. That was a choice response, not cancellation of an initiated response, and it could not support a stop-signal reaction-time estimate.

### Final contract

- Four unscored practice trials.
- Most trials require a left/right response; 25% present STOP after the arrow begins and require withholding.
- No Brake button appears.
- Stop-signal delay begins at 250 ms, moves by 50 ms, and stays within 100-700 ms.
- Successful withholding moves the next delay up. Every failed stop response, including a premature response, moves it down.
- The standard 64-trial training rep uses `stop_success_rate` as its core result beside go accuracy and correct go response time.
- Program and evidence-layer reporting requires all 48 go and 16 stop trials. This is an implementation-completeness rule, not a claim of individual reliability.
- A secondary stop-time estimate is available only after at least 150 valid go trials and 50 stop trials.
- Estimate quality also requires complete delay capture, 25-75% stop success, at most 10% go omissions, at least 80% go accuracy, and failed-stop responses faster on average than correct go responses.

### Evidence boundary

The task follows the independent race-model structure and consensus stop-signal methods. Even a quality-controlled estimate is task-specific and may be unreliable for individual inference without further study. It does not establish impulsivity, diagnosis, safety risk, readiness, or on-field inhibition.

## Signal Window

### Correction

The prior text-choice task revealed the answer through option order and labels, confounded shrinking time windows with trial order, and combined speed and accuracy through an arbitrary score.

### Final contract

- Four unscored practice trials.
- The instruction appears before the field. Four practice trials use a 2000 ms field and 4000 ms total response window so the athlete can learn the task.
- Scored trials use a fixed 1400 ms field and 3000 ms total response window; five, six, or seven arrows agree with the target direction.
- Direction and evidence count are balanced. The response clock begins at field onset, and timing never changes with evidence strength or trial order.
- This timing contract is Signal Window protocol v3.1. Sessions recorded under the prior 650/1600 ms contract must not be pooled with v3.1 response-time observations without an explicit version adjustment.
- Core pair: `decision_accuracy` and `correct_decision_rt_ms`; neither replaces the other.
- Program and evidence-layer reporting accepts decision accuracy only when all 24 scored trials are present. This is an implementation-completeness rule, not validation evidence.
- Overall correct response time is unavailable below six valid correct responses.
- Evidence-level response time is unavailable below two valid correct responses in that level.
- Wrong choices, premature responses, timeouts, and results by evidence count remain separate.

### Evidence boundary

Psychophysics supports the expectation that weaker sensory evidence can affect speed and accuracy. That supports the manipulation, not a claim that the task measures tactical intelligence, game-day decision quality, readiness, or sport vision.

## Sequence Shift

### Correction

The prior interface identified which option matched the active or old rule, mixed timing across conditions, and described a task-switching mechanic as working-memory updating.

### Final contract

- Six unscored practice trials teach the stable mapping: left means vowel or odd; right means consonant or even.
- A neutral Letter or Number cue appears 400 ms before a letter-number stimulus.
- Repeat/switch status, rule, response side, and congruency are balanced with one 1800 ms response window.
- Core: mean correct artifact-valid switch response time minus repeat response time.
- The core estimate is unavailable below eight valid correct trials in either condition.
- Repeat accuracy, switch accuracy, accuracy cost, premature responses, and timeouts remain separate.
- An old-rule response is counted as perseveration only on an eligible incongruent switch trial.

### Evidence boundary

Classic task-switching studies support repeat-versus-switch comparisons. This short mobile task does not establish working-memory capacity, broad cognitive flexibility, readiness, sport IQ, or transfer to audibles and play changes.

## Endurance Lock

### Correction

The prior profiles tightened cadence and response windows, added clutter or late stakes, and then attributed late-session decline to time-on-task or fatigue. The old “slope” was not a fitted slope.

### Final contract

- Four unscored practice trials followed by six scored blocks.
- The visual signal, rule, display load, 1500 ms response window, scoring, and feedback remain constant.
- Only the 1500-3500 ms foreperiod varies unpredictably.
- Core: fitted artifact-valid response-time change in milliseconds per elapsed minute.
- The core estimate is unavailable below 24 valid responses or when any block has fewer than three.
- Median response time, variability, responses at or above the declared 500 ms threshold, false starts, timeouts, and valid counts by block remain separate.
- Legacy late-pressure and visual-ramp profiles now resolve to the same constant-task compatibility profile.

### Evidence boundary

Psychomotor-vigilance research supports response-time thresholds and variability as sustained-attention observations. A short mobile run cannot identify whether change came from sleep, fatigue, motivation, boredom, context, or device input. It does not measure a stable endurance trait or prove late-game transfer.

## Platform Status

| Platform | Implemented status | Remaining boundary |
|---|---|---|
| Web | Six canonical playable engines, deterministic schedules, calculators, build locks, and unit tests. | Browser/device timing equivalence still needs empirical calibration. |
| iOS | Six native canonical engines and Swift calculators; the focused XCTest suite passes on an iPhone 17 Pro simulator. | Device timing equivalence still needs empirical calibration. |
| Android | Six native canonical engines and Kotlin calculators; unit tests and debug build pass. | Noise Gate currently implements the canonical visual task. Audio and combined-channel parity with web/iOS remains future work. |

The three implementations follow the same formulas and thresholds, but source agreement is not proof of measurement equivalence. A shared cross-platform golden-fixture suite and device timing study remain required.

## Six-Layer Enforcement

| Layer | Enforced behavior |
|---|---|
| 1. Core simulation contracts | Each family has one canonical task, metric name, athlete label, calculation rule, quality gate, and result boundary. Build generation cannot replace those fields with generated alternatives. |
| 2. Sport content packs | Sport packs provide familiar examples only. Every pack repeats the task-specific result boundary, and a missing or unbounded pack falls back to neutral task language. |
| 3. Nora narration | Nora names the actual action, the canonical metric label, and the interpretation boundary. Narration cannot describe sport context as proof of personalization or transfer. |
| 4. Sport Intelligence | Simulation results remain task-specific evidence. Focus, composure, and decisioning movement stay unset until program-level validation supports broader interpretation. |
| 5. Profile scoring | Simulation sessions do not change broad pillar or skill scores. Canonical, quality-gated results are stored in a separate task-evidence profile. Correlations remain research-monitoring outputs. |
| 6. Native Program reporting | iOS and Android show recent task estimates rather than personal records or grades. Underpowered estimates are excluded instead of being displayed as zero, and every value keeps its task-specific label. |

Automated coverage includes 43 web policy, content, and measurement tests; 6 web build-contract tests; 11 focused iOS simulator tests; and 13 forced Android unit tests. TypeScript checking and repository diff checks also pass for the scoped implementation.

## Validation Roadmap

1. Verify timer fidelity, pause/background behavior, duplicate-input handling, and event completeness on supported devices.
2. Run shared fixtures through TypeScript, Swift, and Kotlin and require identical schedule counts and derived outputs.
3. Estimate completion, missingness, floor/ceiling behavior, and distribution quality for each task.
4. Estimate split-half and test-retest reliability before interpreting individual change.
5. Compare each family with an established task appropriate to its construct hypothesis.
6. Use blinded, representative sport tasks before making transfer or predictive claims.
7. Pre-register thresholds, exclusions, outcomes, and multiplicity handling before confirmatory studies.

## Primary Sources

- Verbruggen F, et al. (2019). A consensus guide to capturing the ability to inhibit actions and impulsive behaviors in the stop-signal task. *eLife*, 8:e46323. https://doi.org/10.7554/eLife.46323
- Logan GD, Cowan WB, Davis KA. (1984). On the ability to inhibit simple and choice reaction time responses: a model and a method. *J Exp Psychol Hum Percept Perform*, 10(2), 276-291. https://doi.org/10.1037/0096-1523.10.2.276
- Palmer J, Huk AC, Shadlen MN. (2005). The effect of stimulus strength on speed and accuracy of a perceptual decision. *Journal of Vision*, 5(5), 376-404. https://doi.org/10.1167/5.5.1
- Rogers RD, Monsell S. (1995). Costs of a predictable switch between simple cognitive tasks. *J Exp Psychol Gen*, 124(2), 207-231. https://doi.org/10.1037/0096-3445.124.2.207
- Meiran N. (1996). Reconfiguration of processing mode prior to task performance. *J Exp Psychol Learn Mem Cogn*, 22(6), 1423-1442. https://doi.org/10.1037/0278-7393.22.6.1423
- Notebaert W, et al. (2009). Post-error slowing: an orienting account. *Cognition*, 111(2), 275-279. https://doi.org/10.1016/j.cognition.2009.02.002
- Dutilh G, et al. (2012). Testing theories of post-error slowing. *Attention, Perception, & Psychophysics*, 74, 454-465. https://doi.org/10.3758/s13414-011-0243-2
- Dinges DF, Powell JW. (1985). Microcomputer analyses of performance on a portable, simple visual response-time task during sustained operations. *Behavior Research Methods, Instruments, & Computers*, 17, 652-655. https://doi.org/10.3758/BF03200977
- Van Dongen HPA, et al. (2003). The cumulative cost of additional wakefulness. *Sleep*, 26(2), 117-126. https://doi.org/10.1093/sleep/26.2.117
- Owen AM, et al. (2010). Putting brain training to the test. *Nature*, 465, 775-778. https://doi.org/10.1038/nature09042
